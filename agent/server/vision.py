"""Thin client for the YOLOv8 hazard classifier.

Two backends are supported, picked via env:

  * VERTEX endpoint  — set VERTEX_ENDPOINT_ID + VERTEX_PROJECT + VERTEX_REGION.
                       Uses google-cloud-aiplatform.
  * Direct service   — set YOLO_SERVICE_URL (e.g. http://localhost:8080).
                       Calls /raw_predict over multipart. Useful for local dev.

If neither is configured, classify_hazard() returns None and the agent simply
runs without a vision hint — the rest of the workflow is unaffected.
"""
from __future__ import annotations

import base64
import logging
import os
from typing import Optional

logger = logging.getLogger("baladiya.vision")


def _direct_classify(image_bytes: bytes, content_type: str) -> Optional[dict]:
    url = os.environ["YOLO_SERVICE_URL"].rstrip("/") + "/raw_predict"
    try:
        import httpx
    except ImportError:
        logger.warning("httpx not installed; skipping YOLO call.")
        return None
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.post(
                url,
                files={"image": ("upload.jpg", image_bytes, content_type or "image/jpeg")},
            )
            r.raise_for_status()
            return r.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("YOLO direct call failed: %s", exc)
        return None


def _vertex_classify(image_bytes: bytes) -> Optional[dict]:
    project = os.environ["VERTEX_PROJECT"]
    region = os.environ["VERTEX_REGION"]
    endpoint_id = os.environ["VERTEX_ENDPOINT_ID"]
    try:
        from google.cloud import aiplatform
    except ImportError:
        logger.warning("google-cloud-aiplatform not installed; skipping YOLO call.")
        return None
    try:
        aiplatform.init(project=project, location=region)
        endpoint = aiplatform.Endpoint(
            endpoint_name=f"projects/{project}/locations/{region}/endpoints/{endpoint_id}"
        )
        b64 = base64.b64encode(image_bytes).decode("ascii")
        prediction = endpoint.predict(instances=[{"image_b64": b64}])
        preds = prediction.predictions if hasattr(prediction, "predictions") else prediction[0]
        return preds[0] if preds else None
    except Exception as exc:  # noqa: BLE001
        logger.warning("Vertex YOLO call failed: %s", exc)
        return None


def classify_hazard(image_bytes: bytes, content_type: str = "image/jpeg") -> Optional[dict]:
    """Return {class, confidence, bbox, all_boxes} or None if no backend is configured."""
    if os.environ.get("VERTEX_ENDPOINT_ID"):
        return _vertex_classify(image_bytes)
    if os.environ.get("YOLO_SERVICE_URL"):
        return _direct_classify(image_bytes, content_type)
    return None


def format_hint(prediction: Optional[dict]) -> str:
    """Render the YOLO result as a single line for the agent prompt."""
    if not prediction or not prediction.get("class"):
        return "Vision hint: none (YOLO did not detect a known hazard)."
    cls = prediction["class"]
    conf = prediction.get("confidence", 0.0)
    return f"Vision hint: YOLO detected '{cls}' with confidence {conf:.2f}."
