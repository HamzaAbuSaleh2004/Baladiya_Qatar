"""Ticket store backed by Firestore + the create_ticket tool exposed to the agent.

Collections:
  - tickets   : one doc per ticket, doc id == ticket_id
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from threading import Lock
from typing import Optional

from google.adk.tools import ToolContext
from google.cloud import firestore

CATEGORY_DEPARTMENTS = {
    "pothole":      "Roads & Infrastructure Department",
    "falling_tree": "Parks & Public Vegetation Department",
}

VALID_SEVERITY = {"low", "medium", "high"}

_lock = Lock()
_client: Optional[firestore.Client] = None


def _db() -> firestore.Client:
    global _client
    if _client is None:
        with _lock:
            if _client is None:
                project = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("VERTEX_PROJECT")
                _client = firestore.Client(project=project) if project else firestore.Client()
    return _client


def list_tickets(user_email: str | None = None, limit: int = 200) -> list[dict]:
    """Read tickets, newest first."""
    coll = _db().collection("tickets")
    q = coll.where("user_email", "==", user_email) if user_email else coll
    q = q.order_by("created_at", direction=firestore.Query.DESCENDING).limit(limit)
    out: list[dict] = []
    for doc in q.stream():
        d = doc.to_dict() or {}
        d["ticket_id"] = doc.id
        # Firestore returns DatetimeWithNanoseconds for timestamps; normalise to ISO.
        ca = d.get("created_at")
        if hasattr(ca, "isoformat"):
            d["created_at"] = ca.isoformat()
        ua = d.get("updated_at")
        if hasattr(ua, "isoformat"):
            d["updated_at"] = ua.isoformat()
        out.append(d)
    return out


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
        location, description, and created_at — or an "error" key if validation fails.
    """
    if category not in CATEGORY_DEPARTMENTS:
        return {
            "error": f"Unsupported category '{category}'. "
                     f"Pilot supports only: {list(CATEGORY_DEPARTMENTS.keys())}."
        }
    if severity not in VALID_SEVERITY:
        return {"error": f"Invalid severity '{severity}'. Use one of: {sorted(VALID_SEVERITY)}."}

    state = tool_context.state
    user_email = state.get("user_email", "anonymous")
    gps = state.get("gps") or {}
    latitude = gps.get("latitude")
    longitude = gps.get("longitude")
    yolo = state.get("yolo")

    ticket_id = f"BLD-{uuid.uuid4().hex[:8].upper()}"
    department = CATEGORY_DEPARTMENTS[category]
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    ticket = {
        "category":    category,
        "severity":    severity,
        "description": description,
        "department":  department,
        "status":      "investigating",
        "user_email":  user_email,
        "location":    {"latitude": latitude, "longitude": longitude},
        "yolo":        yolo,
        "created_at":  now,
        "updated_at":  now,
    }

    _db().collection("tickets").document(ticket_id).set(ticket)

    # Return shape matches what the frontend expects (ISO strings).
    return {
        "ticket_id":   ticket_id,
        "category":    category,
        "severity":    severity,
        "description": description,
        "department":  department,
        "status":      "investigating",
        "user_email":  user_email,
        "location":    {"latitude": latitude, "longitude": longitude},
        "yolo":        yolo,
        "created_at":  now_iso,
    }
