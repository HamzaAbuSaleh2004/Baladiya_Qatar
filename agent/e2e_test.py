"""End-to-end test for the Baladiya app using Playwright.

Drives a real Chromium browser through:
  Authentication → Dashboard → SmartCapture (upload + GPS) → AIAgentChat → Confirmation

Captures:
  * Screenshots at every step (./e2e_screens/*.png)
  * Browser console messages (warnings, errors)
  * Failed network requests
  * Final ticket payload from the agent

Usage:
    python e2e_test.py
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

from playwright.sync_api import Page, sync_playwright, TimeoutError as PlaywrightTimeoutError

FRONTEND_URL = "http://localhost:5173"
BACKEND_URL = "http://localhost:8000"
TEST_EMAIL = "e2e@example.com"
TEST_IMAGE = Path(__file__).parent / "test_pothole.jpg"
SCREENS = Path(__file__).parent / "e2e_screens"
SCREENS.mkdir(exist_ok=True)

# Doha-ish coordinates so it feels realistic
DOHA = {"latitude": 25.2854, "longitude": 51.5310}


def shot(page: Page, name: str) -> None:
    path = SCREENS / f"{name}.png"
    page.screenshot(path=str(path), full_page=True)
    print(f"  [shot] {path.name}")


def banner(text: str) -> None:
    print(f"\n{'='*60}\n {text}\n{'='*60}")


def main() -> int:
    console_messages: list[tuple[str, str]] = []
    failed_requests: list[tuple[str, str, str]] = []
    network_log: list[tuple[str, int, str]] = []

    with sync_playwright() as p:
        banner("Launching Chromium")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 414, "height": 896},  # iPhone-ish for mobile-first UI
            geolocation=DOHA,
            permissions=["geolocation"],
            locale="en-US",
        )
        page = context.new_page()

        # Hooks
        page.on("console", lambda msg: console_messages.append((msg.type, msg.text)))
        page.on("pageerror", lambda exc: console_messages.append(("pageerror", str(exc))))
        page.on("requestfailed", lambda req: failed_requests.append(
            (req.method, req.url, req.failure or "?")
        ))

        def on_response(resp):
            if "/api/" in resp.url:
                try:
                    network_log.append((resp.request.method, resp.status, resp.url))
                except Exception:
                    pass
        page.on("response", on_response)

        # ------------------------------------------------------------------
        banner("Step 1 — Open the app")
        # ------------------------------------------------------------------
        try:
            page.goto(FRONTEND_URL, wait_until="domcontentloaded", timeout=15000)
        except PlaywrightTimeoutError:
            print("[fail] Could not reach frontend. Is `npm run dev` running on :5173?")
            return 2
        page.wait_for_load_state("networkidle")
        shot(page, "01_initial")

        # Force-clear any persisted email (so we always land on /auth)
        page.evaluate("() => localStorage.removeItem('baladiya.app.v2')")
        page.goto(FRONTEND_URL, wait_until="networkidle")
        shot(page, "02_auth_landing")

        # ------------------------------------------------------------------
        banner("Step 2 — Sign in")
        # ------------------------------------------------------------------
        page.fill("input[type=email]", TEST_EMAIL)
        page.click("button[type=submit]")
        page.wait_for_url(f"{FRONTEND_URL}/", timeout=5000)
        shot(page, "03_dashboard_empty")
        print(f"  [ok] Logged in as {TEST_EMAIL}, on Dashboard")

        # ------------------------------------------------------------------
        banner("Step 3 — Tap 'Report New Issue'")
        # ------------------------------------------------------------------
        page.get_by_role("button", name="Report New Issue").click()
        page.wait_for_url(f"{FRONTEND_URL}/capture", timeout=5000)
        # Wait a beat for the GPS chip to populate
        page.wait_for_timeout(800)
        shot(page, "04_capture_initial")

        # ------------------------------------------------------------------
        banner("Step 4 — Upload test image")
        # ------------------------------------------------------------------
        if not TEST_IMAGE.exists():
            print(f"[fail] Test image missing: {TEST_IMAGE}")
            return 2

        # The "Upload" button triggers the hidden file input. We bypass the click
        # and set the input value directly — it's the same input the React handler reads.
        file_inputs = page.locator("input[type=file]")
        # Use the first non-camera input (gallery / generic upload)
        file_inputs.first.set_input_files(str(TEST_IMAGE))
        page.wait_for_timeout(500)
        shot(page, "05_capture_image_loaded")
        print(f"  [ok] Image uploaded ({TEST_IMAGE.stat().st_size} bytes)")

        # ------------------------------------------------------------------
        banner("Step 5 — Click 'Analyze Issue'")
        # ------------------------------------------------------------------
        # Capture the API response body so we can inspect what the agent said.
        first_reply = {"text": None, "ticket": None, "session_id": None, "status": None}

        def capture_start(resp):
            if resp.url.endswith("/api/report/start"):
                first_reply["status"] = resp.status
                try:
                    first_reply.update(resp.json())
                except Exception as e:
                    first_reply["text"] = f"<could not parse JSON: {e}>"

        page.on("response", capture_start)

        analyze_btn = page.get_by_role("button", name="Analyze Issue")
        analyze_btn.click()

        # Wait for either: navigation to /chat (success) OR an error toast (failure).
        try:
            page.wait_for_url(f"{FRONTEND_URL}/chat", timeout=60000)
            shot(page, "06_chat_after_analyze")
            print(f"  [ok] Navigated to chat. Backend status={first_reply.get('status')}")
            print(f"    Agent's first reply: {(first_reply.get('reply') or first_reply.get('text') or '')[:200]}")
        except PlaywrightTimeoutError:
            print("[fail] Did not reach /chat within 60s. Check backend terminal for the real error.")
            shot(page, "06_capture_stuck")
            print(f"    Backend status: {first_reply.get('status')}")
            print(f"    Backend body  : {first_reply}")
            return _finish(browser, context, page, console_messages, failed_requests, network_log, exit_code=3)

        # ------------------------------------------------------------------
        banner("Step 6 — Send confirmation messages")
        # ------------------------------------------------------------------
        # Try a generic confirmation. The agent typically asks ONE clarifying
        # question first, then waits for confirmation.
        for i, msg in enumerate(["medium severity, please file it", "yes submit", "yes"]):
            textarea = page.locator("textarea").first
            textarea.fill(msg)
            page.get_by_role("button", name="").nth(0)  # noop just to ensure DOM stable
            page.locator("button >> .material-symbols-outlined", has_text="send").first.click()
            page.wait_for_timeout(2000)
            shot(page, f"07_chat_turn_{i+1}")
            # Did the agent move us to /confirm?
            if page.url.endswith("/confirm"):
                break

        # ------------------------------------------------------------------
        banner("Step 7 — Confirmation page")
        # ------------------------------------------------------------------
        if page.url.endswith("/confirm"):
            page.wait_for_timeout(800)
            shot(page, "08_confirmation")
            print("  [ok] Reached /confirm — ticket was created.")
        else:
            print("  [warn] Never reached /confirm. Final URL:", page.url)
            shot(page, "08_chat_final")

        return _finish(browser, context, page, console_messages, failed_requests, network_log, exit_code=0)


def _finish(browser, context, page, console_messages, failed_requests, network_log, exit_code):
    banner("Network log (/api/* only)")
    for method, status, url in network_log:
        marker = "[ok]" if 200 <= status < 300 else "[fail]"
        print(f"  {marker} {status} {method} {url}")

    banner("Console messages")
    for kind, text in console_messages:
        if kind in ("error", "warning", "pageerror") or "Error" in text:
            print(f"  [{kind}] {text[:300]}")

    banner("Failed network requests")
    if not failed_requests:
        print("  (none)")
    for method, url, reason in failed_requests:
        print(f"  [fail] {method} {url} — {reason}")

    browser.close()
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
