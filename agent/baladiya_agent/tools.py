"""Ticket store backed by Firestore + the create_ticket tool exposed to the agent.

Collections:
  - tickets   : one doc per ticket, doc id == ticket_id
"""
from __future__ import annotations

import math
import os
import uuid
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Iterable, Optional

from google.adk.tools import ToolContext
from google.cloud import firestore

# Active categories (the agent can create tickets for these). The slider on the
# main page shows many more, but only these route to a real department right now.
CATEGORY_DEPARTMENTS = {
    "pothole":      "Roads & Infrastructure Department",
    "falling_tree": "Parks & Public Vegetation Department",
}

VALID_SEVERITY = {"low", "medium", "high"}
VALID_STATUSES = {"investigating", "in_progress", "resolved", "rejected"}
OPEN_STATUSES = {"investigating", "in_progress"}

# SLA in hours — used to compute `expected_resolution_at` at creation time.
SLA_HOURS = {
    "pothole":      {"low": 168, "medium": 72, "high": 24},   # 7 d / 3 d / 24 h
    "falling_tree": {"low": 48,  "medium": 24, "high": 4},    # 48 h / 24 h / 4 h
}

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


def _normalize(d: dict, doc_id: str) -> dict:
    """Coerce Firestore datetime fields to ISO strings and inject ticket_id."""
    d["ticket_id"] = doc_id
    for key in ("created_at", "updated_at", "expected_resolution_at"):
        v = d.get(key)
        if hasattr(v, "isoformat"):
            d[key] = v.isoformat()
    history = d.get("history") or []
    for h in history:
        v = h.get("at")
        if hasattr(v, "isoformat"):
            h["at"] = v.isoformat()
    d["history"] = history
    return d


def list_tickets(
    user_email: str | None = None,
    limit: int = 200,
    department: str | None = None,
    status: str | None = None,
    category: str | None = None,
) -> list[dict]:
    coll = _db().collection("tickets")
    needs_filter = bool(user_email or department or status or category)
    if needs_filter:
        q = coll
        if user_email:
            q = q.where("user_email", "==", user_email)
        if department:
            q = q.where("department", "==", department)
        if status:
            q = q.where("status", "==", status)
        if category:
            q = q.where("category", "==", category)
        docs = list(q.stream())
    else:
        docs = list(coll.order_by("created_at", direction=firestore.Query.DESCENDING).limit(limit).stream())

    out: list[dict] = [_normalize(doc.to_dict() or {}, doc.id) for doc in docs]
    out.sort(key=lambda d: d.get("created_at") or "", reverse=True)
    return out[:limit]


def get_ticket(ticket_id: str) -> Optional[dict]:
    snap = _db().collection("tickets").document(ticket_id).get()
    if not snap.exists:
        return None
    return _normalize(snap.to_dict() or {}, snap.id)


# --- Distance helpers (duplicate detection) ---------------------------------

def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def find_nearby_open_tickets(
    latitude: float,
    longitude: float,
    category: str,
    radius_m: float = 50.0,
    max_results: int = 5,
) -> list[dict]:
    if latitude is None or longitude is None or not category:
        return []
    coll = _db().collection("tickets")
    q = coll.where("category", "==", category)
    matches: list[tuple[float, dict]] = []
    for doc in q.stream():
        d = doc.to_dict() or {}
        if d.get("status") not in OPEN_STATUSES:
            continue
        loc = d.get("location") or {}
        dlat, dlon = loc.get("latitude"), loc.get("longitude")
        if dlat is None or dlon is None:
            continue
        distance = _haversine_m(latitude, longitude, float(dlat), float(dlon))
        if distance <= radius_m:
            matches.append((distance, _normalize(d, doc.id)))
    matches.sort(key=lambda pair: pair[0])
    return [{"distance_m": round(dist, 1), **doc} for dist, doc in matches[:max_results]]


# --- Admin operations -------------------------------------------------------

def update_ticket_status(
    ticket_id: str,
    new_status: str,
    actor_email: str,
    note: str = "",
    resolution_photo: str | None = None,
) -> Optional[dict]:
    if new_status not in VALID_STATUSES:
        raise ValueError(f"Invalid status: {new_status}")
    ref = _db().collection("tickets").document(ticket_id)
    snap = ref.get()
    if not snap.exists:
        return None
    now = datetime.now(timezone.utc)
    history_entry = {
        "status": new_status,
        "at": now,
        "by": actor_email,
        "note": note or "",
    }
    if resolution_photo and new_status == "resolved":
        history_entry["resolution_photo"] = resolution_photo
    update: dict = {
        "status": new_status,
        "updated_at": now,
        "history": firestore.ArrayUnion([history_entry]),
    }
    if resolution_photo and new_status == "resolved":
        update["resolution_photo"] = resolution_photo
    ref.update(update)
    return get_ticket(ticket_id)


def bulk_update_status(
    ticket_ids: Iterable[str],
    new_status: str,
    actor_email: str,
    note: str = "",
) -> list[dict]:
    if new_status not in VALID_STATUSES:
        raise ValueError(f"Invalid status: {new_status}")
    updated: list[dict] = []
    for tid in ticket_ids:
        try:
            t = update_ticket_status(tid, new_status, actor_email, note=note)
            if t:
                updated.append(t)
        except Exception:  # noqa: BLE001
            continue
    return updated


# --- create_ticket tool exposed to the agent --------------------------------

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
        description: A friendly, elaborate, 2-3 sentence description in the
            user's UI language. Mention what's seen, why it matters, and the
            street name if known.

    Returns:
        Full ticket dict including expected_resolution_at, photo, address, etc.
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
    photo = state.get("photo")          # data URL — set by /api/report/start
    address = state.get("address") or "" # set by /api/report/start

    ticket_id = f"BLD-{uuid.uuid4().hex[:8].upper()}"
    department = CATEGORY_DEPARTMENTS[category]
    now = datetime.now(timezone.utc)
    sla_h = SLA_HOURS.get(category, {}).get(severity, 72)
    eta = now + timedelta(hours=sla_h)
    now_iso = now.isoformat()
    eta_iso = eta.isoformat()

    initial_history = [{
        "status": "investigating",
        "at": now,
        "by": user_email,
        "note": "Ticket created",
    }]

    ticket = {
        "category":               category,
        "severity":               severity,
        "description":            description,
        "department":             department,
        "status":                 "investigating",
        "user_email":             user_email,
        "location":               {"latitude": latitude, "longitude": longitude},
        "address":                address,
        "yolo":                   yolo,
        "photo":                  photo,
        "sla_hours":              sla_h,
        "created_at":             now,
        "updated_at":             now,
        "expected_resolution_at": eta,
        "history":                initial_history,
    }

    _db().collection("tickets").document(ticket_id).set(ticket)

    return {
        "ticket_id":              ticket_id,
        "category":               category,
        "severity":               severity,
        "description":            description,
        "department":             department,
        "status":                 "investigating",
        "user_email":             user_email,
        "location":               {"latitude": latitude, "longitude": longitude},
        "address":                address,
        "yolo":                   yolo,
        "photo":                  photo,
        "sla_hours":              sla_h,
        "created_at":             now_iso,
        "expected_resolution_at": eta_iso,
        "history":                [{
            "status": "investigating",
            "at":     now_iso,
            "by":     user_email,
            "note":   "Ticket created",
        }],
    }
