"""FastAPI server wrapping the Baladiya ADK agent.

Endpoints
---------
POST /api/auth/signup
    JSON: { "email": str, "password": str }. Creates the user, returns a token.
POST /api/auth/login
    JSON: { "email": str, "password": str }. Verifies the password, returns a token.
GET  /api/tickets
    Auth required. Returns the caller's tickets from SQLite.
POST /api/report/start
    Auth required. Multipart form: latitude, longitude, image.
POST /api/report/{session_id}/message
    Auth required. JSON: { "message": str }.
GET  /api/health
    Liveness probe.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import re
import secrets
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.cloud import firestore
from google.genai import types
from pydantic import BaseModel, Field

from baladiya_agent.agent import root_agent
from baladiya_agent.tools import list_tickets
from server.vision import classify_hazard, format_hint

load_dotenv()

logger = logging.getLogger("baladiya.server")

APP_NAME = "baladiya"
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 days
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PBKDF2_ITERS = 200_000

_SECRET = os.getenv("BALADIYA_SECRET", "dev-secret-change-me").encode("utf-8")


# --- User store (Firestore) -------------------------------------------------

_fs_client: Optional[firestore.Client] = None


def _users() -> firestore.CollectionReference:
    global _fs_client
    if _fs_client is None:
        project = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("VERTEX_PROJECT")
        _fs_client = firestore.Client(project=project) if project else firestore.Client()
    return _fs_client.collection("users")


def _hash_password(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERS)


def create_user(email: str, password: str) -> None:
    salt = secrets.token_bytes(16)
    digest = _hash_password(password, salt)
    doc = _users().document(email)
    if doc.get().exists:
        raise HTTPException(409, "An account with this email already exists.")
    doc.set({
        "email": email,
        "password_hash": digest.hex(),
        "salt": salt.hex(),
        "created_at": datetime.now(timezone.utc),
    })


def verify_user(email: str, password: str) -> bool:
    snap = _users().document(email).get()
    if not snap.exists:
        return False
    data = snap.to_dict() or {}
    try:
        expected = bytes.fromhex(data["password_hash"])
        salt = bytes.fromhex(data["salt"])
    except (KeyError, ValueError):
        return False
    return hmac.compare_digest(expected, _hash_password(password, salt))


# --- App + CORS -------------------------------------------------------------

session_service = InMemorySessionService()
runner = Runner(
    agent=root_agent,
    app_name=APP_NAME,
    session_service=session_service,
)

app = FastAPI(title="Baladiya Agent API", version="0.3.0")

# Permissive CORS for local dev (any localhost / 127.0.0.1 port) and explicit
# production origins via CORS_ORIGINS. Using allow_origin_regex sidesteps the
# wildcard+credentials limitation in browsers.
_extra_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_extra_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)


# --- Token helpers ----------------------------------------------------------

def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _sign(payload: bytes) -> str:
    return _b64url(hmac.new(_SECRET, payload, hashlib.sha256).digest())


def issue_token(email: str) -> str:
    expiry = int(time.time()) + TOKEN_TTL_SECONDS
    body = f"{email}|{expiry}".encode("utf-8")
    return f"{_b64url(body)}.{_sign(body)}"


def verify_token(token: str) -> str:
    try:
        body_b64, sig = token.split(".", 1)
    except ValueError as exc:
        raise HTTPException(401, "Malformed token") from exc
    body = _b64url_decode(body_b64)
    if not hmac.compare_digest(_sign(body), sig):
        raise HTTPException(401, "Invalid token signature")
    try:
        email, expiry_str = body.decode("utf-8").rsplit("|", 1)
        expiry = int(expiry_str)
    except (UnicodeDecodeError, ValueError) as exc:
        raise HTTPException(401, "Malformed token payload") from exc
    if expiry < int(time.time()):
        raise HTTPException(401, "Token expired")
    return email


def get_current_email(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing bearer token")
    return verify_token(authorization.split(" ", 1)[1].strip())


# --- Models -----------------------------------------------------------------

class AuthBody(BaseModel):
    email: str
    password: str = Field(min_length=6, max_length=200)


class AuthReply(BaseModel):
    email: str
    token: str


class MessageBody(BaseModel):
    message: str


class AgentReply(BaseModel):
    session_id: str
    reply: str
    ticket: Optional[dict] = None


# --- Agent runner -----------------------------------------------------------

def _extract(events) -> tuple[str, Optional[dict]]:
    reply_chunks: list[str] = []
    ticket: Optional[dict] = None
    for ev in events:
        if not ev.content or not ev.content.parts:
            continue
        for part in ev.content.parts:
            if getattr(part, "text", None):
                reply_chunks.append(part.text)
            fr = getattr(part, "function_response", None)
            if fr and fr.name == "create_ticket":
                resp = fr.response or {}
                ticket = resp.get("result", resp) if isinstance(resp, dict) else resp
    return ("".join(reply_chunks).strip(), ticket)


async def _run_agent(user_id: str, session_id: str, content: types.Content):
    events = []
    try:
        async for ev in runner.run_async(
            user_id=user_id, session_id=session_id, new_message=content
        ):
            events.append(ev)
    except Exception as exc:  # noqa: BLE001
        msg = str(exc)
        logger.exception("Agent run failed: %s", msg)
        if "API key not valid" in msg or "API_KEY_INVALID" in msg:
            raise HTTPException(
                503,
                "Gemini API key is invalid or missing. Set GOOGLE_API_KEY in agent/.env "
                "to a valid AI Studio key (https://aistudio.google.com/app/apikey).",
            ) from exc
        if "PERMISSION_DENIED" in msg or "credentials" in msg.lower():
            raise HTTPException(503, f"Auth/permission error talking to the model: {msg}") from exc
        raise HTTPException(500, f"Agent error: {msg}") from exc
    return _extract(events)


# --- Routes -----------------------------------------------------------------

@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/docs")


@app.get("/api/health")
async def health():
    return {"ok": True, "app": APP_NAME}


@app.post("/api/auth/signup", response_model=AuthReply)
async def signup(body: AuthBody):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Invalid email address.")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")
    create_user(email, body.password)
    return AuthReply(email=email, token=issue_token(email))


@app.post("/api/auth/login", response_model=AuthReply)
async def login(body: AuthBody):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Invalid email address.")
    if not verify_user(email, body.password):
        raise HTTPException(401, "Wrong email or password.")
    return AuthReply(email=email, token=issue_token(email))


@app.get("/api/tickets")
async def get_tickets(email: str = Depends(get_current_email)):
    return {"tickets": list_tickets(user_email=email, limit=200)}


@app.post("/api/report/start", response_model=AgentReply)
async def start_report(
    latitude: float = Form(...),
    longitude: float = Form(...),
    image: UploadFile = File(...),
    email: str = Depends(get_current_email),
):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(400, "Uploaded file must be an image.")
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(400, "Empty image upload.")
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(413, "Image is too large (max 10 MB).")

    # Run YOLOv8 first (if a backend is configured) so the agent gets a strong
    # classification hint before it looks at the image. Failures are non-fatal.
    yolo = classify_hazard(image_bytes, image.content_type or "image/jpeg")
    hint_line = format_hint(yolo)

    session_id = uuid.uuid4().hex
    await session_service.create_session(
        app_name=APP_NAME,
        user_id=email,
        session_id=session_id,
        state={
            "user_email": email,
            "gps": {"latitude": latitude, "longitude": longitude},
            "yolo": yolo,
        },
    )

    intro = (
        f"GPS: {latitude}, {longitude}\n"
        f"Reporter: {email}\n"
        f"{hint_line}\n"
        "Please analyze the attached photo and proceed with the reporting workflow."
    )
    content = types.Content(
        role="user",
        parts=[
            types.Part.from_bytes(data=image_bytes, mime_type=image.content_type),
            types.Part.from_text(text=intro),
        ],
    )
    reply, ticket = await _run_agent(email, session_id, content)
    return AgentReply(session_id=session_id, reply=reply, ticket=ticket)


@app.post("/api/report/{session_id}/message", response_model=AgentReply)
async def send_message(
    session_id: str,
    body: MessageBody,
    email: str = Depends(get_current_email),
):
    session = await session_service.get_session(
        app_name=APP_NAME, user_id=email, session_id=session_id
    )
    if session is None:
        raise HTTPException(404, "Session not found. Start a new report first.")
    content = types.Content(role="user", parts=[types.Part.from_text(text=body.message)])
    reply, ticket = await _run_agent(email, session_id, content)
    return AgentReply(session_id=session_id, reply=reply, ticket=ticket)
