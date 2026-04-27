import os
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from google.adk.tools import ToolContext

CATEGORY_DEPARTMENTS = {
    "pothole":      "Roads & Infrastructure Department",
    "falling_tree": "Parks & Public Vegetation Department",
}

VALID_SEVERITY = {"low", "medium", "high"}

# --- SQLite (local POC store) -----------------------------------------------

_DEFAULT_DB = Path(__file__).resolve().parent.parent / "tickets.db"
_DB_PATH = Path(os.getenv("SQLITE_PATH", str(_DEFAULT_DB))).resolve()
_lock = threading.Lock()
_initialised = False


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH, check_same_thread=False, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn


def _ensure_schema() -> None:
    global _initialised
    if _initialised:
        return
    with _lock:
        if _initialised:
            return
        with _connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS tickets (
                    ticket_id   TEXT PRIMARY KEY,
                    category    TEXT NOT NULL,
                    severity    TEXT NOT NULL,
                    description TEXT NOT NULL,
                    department  TEXT NOT NULL,
                    status      TEXT NOT NULL,
                    user_email  TEXT NOT NULL,
                    latitude    REAL,
                    longitude   REAL,
                    created_at  TEXT NOT NULL,
                    updated_at  TEXT NOT NULL
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_tickets_email ON tickets(user_email);")
        _initialised = True


def list_tickets(user_email: str | None = None, limit: int = 50) -> list[dict]:
    """Read tickets from the local SQLite store. Used by the /api/tickets endpoint."""
    _ensure_schema()
    with _connect() as conn:
        if user_email:
            cur = conn.execute(
                "SELECT * FROM tickets WHERE user_email = ? ORDER BY created_at DESC LIMIT ?",
                (user_email, limit),
            )
        else:
            cur = conn.execute(
                "SELECT * FROM tickets ORDER BY created_at DESC LIMIT ?",
                (limit,),
            )
        rows = [dict(r) for r in cur.fetchall()]
    for r in rows:
        r["location"] = {"latitude": r.pop("latitude"), "longitude": r.pop("longitude")}
    return rows


# --- Tool exposed to the agent ----------------------------------------------

def create_ticket(
    category: str,
    severity: str,
    description: str,
    tool_context: ToolContext,
) -> dict:
    """Create a civic-issue ticket and route it to the correct municipality department.

    Args:
        category: One of "pothole" or "falling_tree".
        severity: One of "low", "medium", or "high".
        description: A short, plain-language description of the issue
            in the user's language.

    Returns:
        A dict with ticket_id, category, severity, department, status,
        location, and created_at — or an "error" key if validation fails.
    """
    if category not in CATEGORY_DEPARTMENTS:
        return {
            "error": f"Unsupported category '{category}'. "
                     f"Pilot supports only: {list(CATEGORY_DEPARTMENTS.keys())}."
        }
    if severity not in VALID_SEVERITY:
        return {"error": f"Invalid severity '{severity}'. Use one of: {sorted(VALID_SEVERITY)}."}

    _ensure_schema()

    state = tool_context.state
    user_email = state.get("user_email", "anonymous")
    gps = state.get("gps") or {}
    latitude = gps.get("latitude")
    longitude = gps.get("longitude")

    ticket_id = f"BLD-{uuid.uuid4().hex[:8].upper()}"
    department = CATEGORY_DEPARTMENTS[category]
    now_iso = datetime.now(timezone.utc).isoformat()

    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO tickets
                (ticket_id, category, severity, description, department, status,
                 user_email, latitude, longitude, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                ticket_id, category, severity, description, department, "investigating",
                user_email, latitude, longitude, now_iso, now_iso,
            ),
        )

    return {
        "ticket_id":  ticket_id,
        "category":   category,
        "severity":   severity,
        "description": description,
        "department": department,
        "status":     "investigating",
        "location":   {"latitude": latitude, "longitude": longitude},
        "created_at": now_iso,
    }
