"""Vertex AI custom prediction container.

Implements the prediction protocol Vertex expects:
  GET  /health   -> 200 when the model is loaded
  POST /predict  -> { "instances": [{"image_b64": "..."}] } returns
                    { "predictions": [{class, confidence, bbox, all_boxes}, ...] }

Also accepts multipart uploads at POST /raw_predict for direct calls from the
agent backend (which posts raw image bytes, not Vertex JSON).
"""
from __future__ import annotations

import base64
import io
import os
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image
from pydantic import BaseModel
from ultralytics import YOLO

MODEL_PATH = os.environ.get("MODEL_PATH", "/model/best.pt")
CONF_THRESHOLD = float(os.environ.get("CONF_THRESHOLD", "0.25"))
PORT = int(os.environ.get("AIP_HTTP_PORT", os.environ.get("PORT", "8080")))

print(f"[serve] loading model from {MODEL_PATH}", flush=True)
model = YOLO(MODEL_PATH)
print("[serve] model loaded.", flush=True)

app = FastAPI(title="Baladiya YOLO server", version="0.1.0")


class PredictRequest(BaseModel):
    instances: list[dict[str, Any]]


def _classify(img: Image.Image) -> dict:
    """Run YOLO and return the most-confident detection (or null if none)."""
    results = model.predict(img, conf=CONF_THRESHOLD, verbose=False)
    r = results[0]
    boxes = []
    for box in r.boxes:
        cls_id = int(box.cls.item())
        boxes.append({
            "class": r.names[cls_id],
            "confidence": float(box.conf.item()),
            "bbox": [float(x) for x in box.xyxy[0].tolist()],
        })
    if not boxes:
        return {"class": None, "confidence": 0.0, "bbox": None, "all_boxes": []}
    top = max(boxes, key=lambda b: b["confidence"])
    return {
        "class": top["class"],
        "confidence": top["confidence"],
        "bbox": top["bbox"],
        "all_boxes": boxes,
    }


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/predict")
def predict(req: PredictRequest):
    """Vertex AI online-prediction format."""
    out = []
    for inst in req.instances:
        b64 = inst.get("image_b64")
        if not b64:
            raise HTTPException(400, "Each instance needs an `image_b64` field.")
        try:
            img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(400, f"Could not decode image: {exc}") from exc
        out.append(_classify(img))
    return {"predictions": out}


@app.post("/raw_predict")
async def raw_predict(image: UploadFile = File(...)):
    """Convenience endpoint for the agent backend (direct multipart upload)."""
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(400, "Upload must be an image.")
    data = await image.read()
    if not data:
        raise HTTPException(400, "Empty upload.")
    img = Image.open(io.BytesIO(data)).convert("RGB")
    return _classify(img)
