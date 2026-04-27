"""Run the Baladiya backend and frontend together.

Usage:
    python dev.py

Starts:
  - uvicorn  on http://localhost:8000  (FastAPI / ADK agent)
  - vite     on http://localhost:5173  (React frontend)

Streams both processes' stdout/stderr to this terminal with a [backend]/[frontend]
prefix. Ctrl+C stops both cleanly.
"""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent
AGENT_DIR = ROOT / "agent"
FRONTEND_DIR = ROOT / "frontend"

BACKEND_CMD = [sys.executable, "-m", "uvicorn", "server.main:app", "--reload", "--port", "8000"]
# `npm.cmd` on Windows, `npm` elsewhere. Vite is invoked via `npm run dev`.
NPM = "npm.cmd" if os.name == "nt" else "npm"
FRONTEND_CMD = [NPM, "run", "dev"]


def _stream(proc: subprocess.Popen, prefix: str) -> None:
    assert proc.stdout is not None
    for line in proc.stdout:
        sys.stdout.write(f"{prefix} {line}")
        sys.stdout.flush()


def _start(name: str, cmd: list[str], cwd: Path) -> subprocess.Popen:
    print(f"[dev] starting {name}: {' '.join(cmd)}  (cwd={cwd})")
    return subprocess.Popen(
        cmd,
        cwd=str(cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )


def main() -> int:
    if not AGENT_DIR.exists() or not FRONTEND_DIR.exists():
        print("[dev] expected `agent/` and `frontend/` folders next to this script.", file=sys.stderr)
        return 2

    backend = _start("backend", BACKEND_CMD, AGENT_DIR)
    frontend = _start("frontend", FRONTEND_CMD, FRONTEND_DIR)

    threading.Thread(target=_stream, args=(backend, "[backend] "), daemon=True).start()
    threading.Thread(target=_stream, args=(frontend, "[frontend]"), daemon=True).start()

    print("\n[dev] backend  → http://localhost:8000  (docs: /docs, health: /api/health)")
    print("[dev] frontend → http://localhost:5173")
    print("[dev] Ctrl+C to stop both.\n")

    procs = [("backend", backend), ("frontend", frontend)]

    def shutdown(*_):
        print("\n[dev] stopping…")
        for name, p in procs:
            if p.poll() is None:
                try:
                    if os.name == "nt":
                        p.send_signal(signal.CTRL_BREAK_EVENT)
                    else:
                        p.terminate()
                except Exception:
                    pass
        for name, p in procs:
            try:
                p.wait(timeout=8)
            except subprocess.TimeoutExpired:
                print(f"[dev] {name} did not exit, killing.")
                p.kill()

    try:
        # Exit as soon as any one of them dies — running half the stack is rarely useful.
        while True:
            for name, p in procs:
                rc = p.poll()
                if rc is not None:
                    print(f"[dev] {name} exited with code {rc}; stopping the other.")
                    shutdown()
                    return rc or 1
            try:
                # Sleep a beat so we're not busy-looping.
                threading.Event().wait(0.5)
            except KeyboardInterrupt:
                raise
    except KeyboardInterrupt:
        shutdown()
        return 0


if __name__ == "__main__":
    sys.exit(main())
