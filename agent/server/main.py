"""FastAPI server wrapping the Baladiya ADK agent.

Endpoints
---------
POST /api/auth/signup
    JSON: { "email": str, "password": str }. Creates the user, returns a token.
POST /api/auth/login
    JSON: { "email": str, "password": str }. Verifies the password, returns a token.
GET  /api/tickets
    Auth required. Returns the caller's tickets from Firestore.
POST /api/report/start
    Auth required. Multipart form: latitude, longitude, image.
POST /api/report/check-duplicates
    Auth required. Multipart form: latitude, longitude, image.
    Runs YOLO and returns nearby open tickets of the same category.
POST /api/report/{session_id}/message
    Auth required. JSON: { "message": str }.
GET  /api/health
    Liveness probe.

Admin (admin / super_admin only):
GET  /api/admin/tickets
PATCH /api/admin/tickets/{ticket_id}
POST /api/admin/tickets/bulk
GET  /api/admin/stats

Super admin only:
GET    /api/admin/users
POST   /api/admin/users
PATCH  /api/admin/users/{email}
DELETE /api/admin/users/{email}

Public (no auth):
GET  /api/public/tickets
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
from baladiya_agent.tools import (
    CATEGORY_DEPARTMENTS,
    VALID_STATUSES,
    bulk_update_status,
    find_nearby_open_tickets,
    get_ticket,
    list_tickets,
    update_ticket_status,
)
from server.vision import classify_hazard, format_hint

load_dotenv()

logger = logging.getLogger("baladiya.server")

APP_NAME = "baladiya"
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 days
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PBKDF2_ITERS = 200_000

ROLE_CITIZEN = "citizen"
ROLE_ADMIN = "admin"
ROLE_SUPER = "super_admin"
ADMIN_ROLES = {ROLE_ADMIN, ROLE_SUPER}

SUPER_ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "habusaleh@liverx.me").lower()
SUPER_ADMIN_PASSWORD = os.getenv("SUPER_ADMIN_PASSWORD", "12345678")

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


def _user_doc_to_public(d: dict) -> dict:
    """Strip secrets before returning a user doc to the client."""
    safe = {k: v for k, v in d.items() if k not in ("password_hash", "salt")}
    ca = safe.get("created_at")
    if hasattr(ca, "isoformat"):
        safe["created_at"] = ca.isoformat()
    return safe


def get_user(email: str) -> Optional[dict]:
    snap = _users().document(email).get()
    if not snap.exists:
        return None
    return snap.to_dict() or None


def create_user(
    email: str,
    password: str,
    role: str = ROLE_CITIZEN,
    department: str | None = None,
    *,
    overwrite: bool = False,
    enforce_min_len: bool = True,
) -> None:
    if enforce_min_len and len(password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")
    salt = secrets.token_bytes(16)
    digest = _hash_password(password, salt)
    doc = _users().document(email)
    if not overwrite and doc.get().exists:
        raise HTTPException(409, "An account with this email already exists.")
    doc.set({
        "email": email,
        "password_hash": digest.hex(),
        "salt": salt.hex(),
        "role": role,
        "department": department,
        "created_at": datetime.now(timezone.utc),
    })


def update_user_fields(email: str, fields: dict) -> None:
    doc = _users().document(email)
    if not doc.get().exists:
        raise HTTPException(404, "User not found.")
    safe: dict = {}
    if "role" in fields:
        if fields["role"] not in (ROLE_CITIZEN, ROLE_ADMIN, ROLE_SUPER):
            raise HTTPException(400, "Invalid role.")
        safe["role"] = fields["role"]
    if "department" in fields:
        safe["department"] = fields["department"] or None
    if fields.get("password"):
        if len(fields["password"]) < 6:
            raise HTTPException(400, "Password must be at least 6 characters.")
        salt = secrets.token_bytes(16)
        safe["password_hash"] = _hash_password(fields["password"], salt).hex()
        safe["salt"] = salt.hex()
    if safe:
        doc.update(safe)


def verify_user(email: str, password: str) -> bool:
    data = get_user(email)
    if not data:
        return False
    try:
        expected = bytes.fromhex(data["password_hash"])
        salt = bytes.fromhex(data["salt"])
    except (KeyError, ValueError):
        return False
    return hmac.compare_digest(expected, _hash_password(password, salt))


def bootstrap_super_admin() -> None:
    """Create or repair the configured super-admin account on startup.

    On every boot: makes sure the configured email exists, has role
    super_admin, and that its password matches SUPER_ADMIN_PASSWORD.
    """
    try:
        salt = secrets.token_bytes(16)
        digest = _hash_password(SUPER_ADMIN_PASSWORD, salt).hex()
        ref = _users().document(SUPER_ADMIN_EMAIL)
        existing = ref.get()
        if not existing.exists:
            ref.set({
                "email": SUPER_ADMIN_EMAIL,
                "password_hash": digest,
                "salt": salt.hex(),
                "role": ROLE_SUPER,
                "department": None,
                "created_at": datetime.now(timezone.utc),
            })
            logger.info("Bootstrapped super-admin: %s", SUPER_ADMIN_EMAIL)
        else:
            ref.update({
                "role": ROLE_SUPER,
                "password_hash": digest,
                "salt": salt.hex(),
            })
            logger.info("Refreshed super-admin credentials: %s", SUPER_ADMIN_EMAIL)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not bootstrap super admin: %s", exc)


# --- App + CORS -------------------------------------------------------------

session_service = InMemorySessionService()
runner = Runner(
    agent=root_agent,
    app_name=APP_NAME,
    session_service=session_service,
)

app = FastAPI(title="Baladiya Agent API", version="0.4.0")

_extra_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_extra_origins,
    allow_origin_regex=r"https?://([a-zA-Z0-9-]+\.)*(localhost|127\.0\.0\.1|run\.app|web\.app|firebaseapp\.com)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)


@app.on_event("startup")
async def _on_startup():
    bootstrap_super_admin()


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


def get_current_user(email: str = Depends(get_current_email)) -> dict:
    user = get_user(email)
    if not user:
        raise HTTPException(401, "User no longer exists.")
    user["email"] = email
    return user


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ADMIN_ROLES:
        raise HTTPException(403, "Admin access required.")
    return user


def require_super_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != ROLE_SUPER:
        raise HTTPException(403, "Super-admin access required.")
    return user


def department_filter_for(user: dict) -> Optional[str]:
    """Super-admins see everything; department admins see only their dept."""
    if user.get("role") == ROLE_SUPER:
        return None
    return user.get("department") or None


# --- Models -----------------------------------------------------------------

class AuthBody(BaseModel):
    email: str
    password: str = Field(min_length=6, max_length=200)


class AuthReply(BaseModel):
    email: str
    token: str
    role: str = ROLE_CITIZEN
    department: Optional[str] = None


class MessageBody(BaseModel):
    message: str


class AgentReply(BaseModel):
    session_id: str
    reply: str
    ticket: Optional[dict] = None


class StatusUpdateBody(BaseModel):
    status: str
    note: Optional[str] = ""
    resolution_photo: Optional[str] = None  # data URL or http URL


class BulkStatusBody(BaseModel):
    ticket_ids: list[str]
    status: str
    note: Optional[str] = ""


class CreateUserBody(BaseModel):
    email: str
    password: str = Field(min_length=6, max_length=200)
    role: str = ROLE_ADMIN
    department: Optional[str] = None


class UpdateUserBody(BaseModel):
    role: Optional[str] = None
    department: Optional[str] = None
    password: Optional[str] = None


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
    return AuthReply(email=email, token=issue_token(email), role=ROLE_CITIZEN)


@app.post("/api/auth/login", response_model=AuthReply)
async def login(body: AuthBody):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Invalid email address.")
    if not verify_user(email, body.password):
        raise HTTPException(401, "Wrong email or password.")
    user = get_user(email) or {}
    return AuthReply(
        email=email,
        token=issue_token(email),
        role=user.get("role") or ROLE_CITIZEN,
        department=user.get("department"),
    )


@app.get("/api/me")
async def me(user: dict = Depends(get_current_user)):
    return _user_doc_to_public(user)


@app.get("/api/tickets")
async def get_tickets(email: str = Depends(get_current_email)):
    return {"tickets": list_tickets(user_email=email, limit=200)}


@app.post("/api/report/start", response_model=AgentReply)
async def start_report(
    latitude: float = Form(...),
    longitude: float = Form(...),
    image: UploadFile = File(...),
    address: str = Form(""),
    ui_language: str = Form("en"),
    email: str = Depends(get_current_email),
):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(400, "Uploaded file must be an image.")
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(400, "Empty image upload.")
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(413, "Image is too large (max 10 MB).")

    yolo = classify_hazard(image_bytes, image.content_type or "image/jpeg")
    hint_line = format_hint(yolo)

    # Photo is stored on the ticket as a data URL so it can be displayed on
    # citizen + admin detail views. Frontend resizes before upload (~120 KB).
    mime = image.content_type or "image/jpeg"
    photo_data_url = f"data:{mime};base64,{base64.b64encode(image_bytes).decode('ascii')}"

    lang = "ar" if (ui_language or "").lower().startswith("ar") else "en"
    session_id = uuid.uuid4().hex
    await session_service.create_session(
        app_name=APP_NAME,
        user_id=email,
        session_id=session_id,
        state={
            "user_email": email,
            "gps":        {"latitude": latitude, "longitude": longitude},
            "address":    address or "",
            "yolo":       yolo,
            "photo":      photo_data_url,
            "ui_language": lang,
        },
    )

    street_line = f"Street: {address}\n" if address else ""
    intro = (
        f"UI language: {lang}\n"
        f"GPS: {latitude}, {longitude}\n"
        f"{street_line}"
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


@app.post("/api/report/check-duplicates")
async def check_duplicates(
    latitude: float = Form(...),
    longitude: float = Form(...),
    image: UploadFile = File(...),
    _email: str = Depends(get_current_email),
):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(400, "Uploaded file must be an image.")
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(400, "Empty image upload.")

    yolo = classify_hazard(image_bytes, image.content_type or "image/jpeg") or {}
    label = (yolo.get("label") or "").strip().lower()
    confidence = float(yolo.get("confidence") or 0.0)

    duplicates: list[dict] = []
    if label in CATEGORY_DEPARTMENTS and confidence >= 0.35:
        duplicates = find_nearby_open_tickets(
            latitude=latitude,
            longitude=longitude,
            category=label,
            radius_m=50.0,
            max_results=5,
        )
    return {"yolo": yolo, "duplicates": duplicates}


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


# --- Admin: tickets ---------------------------------------------------------

def _scope_check_ticket_for_user(ticket: dict, user: dict) -> None:
    """Department admins can only touch tickets for their department."""
    dept = department_filter_for(user)
    if dept and (ticket.get("department") or "") != dept:
        raise HTTPException(403, "This ticket is outside your department.")


@app.get("/api/admin/tickets")
async def admin_list_tickets(
    user: dict = Depends(require_admin),
    status: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 500,
):
    dept = department_filter_for(user)
    tickets = list_tickets(
        limit=limit,
        department=dept,
        status=status,
        category=category,
    )
    return {"tickets": tickets, "scope": dept or "all"}


@app.get("/api/admin/tickets/{ticket_id}")
async def admin_get_ticket(ticket_id: str, user: dict = Depends(require_admin)):
    t = get_ticket(ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found.")
    _scope_check_ticket_for_user(t, user)
    return t


@app.patch("/api/admin/tickets/{ticket_id}")
async def admin_update_ticket(
    ticket_id: str,
    body: StatusUpdateBody,
    user: dict = Depends(require_admin),
):
    if body.status not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status. Use one of: {sorted(VALID_STATUSES)}.")
    existing = get_ticket(ticket_id)
    if not existing:
        raise HTTPException(404, "Ticket not found.")
    _scope_check_ticket_for_user(existing, user)
    if body.resolution_photo and len(body.resolution_photo) > 1_400_000:
        raise HTTPException(413, "Resolution photo is too large (max ~1 MB).")
    updated = update_ticket_status(
        ticket_id,
        body.status,
        actor_email=user["email"],
        note=body.note or "",
        resolution_photo=body.resolution_photo,
    )
    return updated


@app.post("/api/admin/tickets/bulk")
async def admin_bulk_update(
    body: BulkStatusBody,
    user: dict = Depends(require_admin),
):
    if body.status not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status. Use one of: {sorted(VALID_STATUSES)}.")
    if not body.ticket_ids:
        raise HTTPException(400, "ticket_ids is empty.")
    # Department admins: filter ticket_ids to ones in their dept.
    dept = department_filter_for(user)
    if dept:
        allowed: list[str] = []
        for tid in body.ticket_ids:
            t = get_ticket(tid)
            if t and t.get("department") == dept:
                allowed.append(tid)
        ids = allowed
    else:
        ids = list(body.ticket_ids)
    updated = bulk_update_status(ids, body.status, actor_email=user["email"], note=body.note or "")
    return {"updated": updated, "count": len(updated)}


@app.get("/api/admin/stats")
async def admin_stats(user: dict = Depends(require_admin)):
    dept = department_filter_for(user)
    tickets = list_tickets(limit=10_000, department=dept)
    by_status: dict[str, int] = {}
    by_category: dict[str, int] = {}
    by_severity: dict[str, int] = {}
    for t in tickets:
        by_status[t.get("status", "unknown")] = by_status.get(t.get("status", "unknown"), 0) + 1
        by_category[t.get("category", "unknown")] = by_category.get(t.get("category", "unknown"), 0) + 1
        by_severity[t.get("severity", "unknown")] = by_severity.get(t.get("severity", "unknown"), 0) + 1
    return {
        "total": len(tickets),
        "by_status": by_status,
        "by_category": by_category,
        "by_severity": by_severity,
        "scope": dept or "all",
    }


# --- Admin: user management (super_admin only) ------------------------------

@app.get("/api/admin/users")
async def admin_list_users(_: dict = Depends(require_super_admin)):
    docs = _users().stream()
    users = [_user_doc_to_public(d.to_dict() or {}) for d in docs]
    users.sort(key=lambda u: u.get("created_at") or "", reverse=True)
    return {"users": users, "departments": sorted(set(CATEGORY_DEPARTMENTS.values()))}


@app.post("/api/admin/users")
async def admin_create_user(body: CreateUserBody, _: dict = Depends(require_super_admin)):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Invalid email address.")
    if body.role not in (ROLE_CITIZEN, ROLE_ADMIN, ROLE_SUPER):
        raise HTTPException(400, "Invalid role.")
    if body.role == ROLE_ADMIN and not body.department:
        raise HTTPException(400, "Department admins must have a department.")
    create_user(email, body.password, role=body.role, department=body.department)
    user = get_user(email) or {}
    return _user_doc_to_public({**user, "email": email})


@app.patch("/api/admin/users/{email}")
async def admin_update_user(
    email: str,
    body: UpdateUserBody,
    _actor: dict = Depends(require_super_admin),
):
    target = email.strip().lower()
    if target == SUPER_ADMIN_EMAIL and body.role and body.role != ROLE_SUPER:
        raise HTTPException(400, "Cannot demote the bootstrap super admin.")
    update_user_fields(target, body.model_dump(exclude_unset=True, exclude_none=True))
    user = get_user(target) or {}
    return _user_doc_to_public({**user, "email": target})


@app.delete("/api/admin/users/{email}")
async def admin_delete_user(email: str, actor: dict = Depends(require_super_admin)):
    target = email.strip().lower()
    if target == SUPER_ADMIN_EMAIL:
        raise HTTPException(400, "Cannot delete the bootstrap super admin.")
    if target == actor["email"]:
        raise HTTPException(400, "Cannot delete yourself.")
    _users().document(target).delete()
    return {"ok": True}


# --- Public (unauthenticated, anonymized) -----------------------------------

@app.get("/api/public/tickets")
async def public_tickets(limit: int = 500):
    tickets = list_tickets(limit=limit)
    public_view = []
    for t in tickets:
        public_view.append({
            "ticket_id": t.get("ticket_id"),
            "category":  t.get("category"),
            "severity":  t.get("severity"),
            "status":    t.get("status"),
            "department": t.get("department"),
            "location":  t.get("location"),
            "created_at": t.get("created_at"),
            "updated_at": t.get("updated_at"),
        })
    return {"tickets": public_view}
