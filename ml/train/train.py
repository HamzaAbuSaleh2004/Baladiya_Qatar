"""Vertex AI custom-training entrypoint.

Reads a YOLOv8 dataset from a Cloud Storage path (mounted at /gcs/...), fine-tunes
yolov8n.pt on it, then writes best.pt + best.onnx to the output path.

Invoked by Vertex with args like:
    --dataset-root /gcs/<bucket>/<dataset-folder>
    --out          /gcs/<bucket>/models/v1
    --epochs       50

The dataset root must contain {train,valid,test}/images and {train,valid,test}/labels
folders. We rewrite data.yaml at runtime so paths resolve under /gcs/.
"""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

import yaml
from ultralytics import YOLO


def _build_dataset_yaml(dataset_root: Path) -> Path:
    """Materialise a yaml file that points Ultralytics at absolute /gcs/ paths."""
    classes = ["fallen_tree", "pothole"]
    src_yaml = dataset_root / "data.yaml"
    if src_yaml.exists():
        try:
            with src_yaml.open("r") as f:
                src = yaml.safe_load(f) or {}
            if isinstance(src.get("names"), list):
                classes = src["names"]
            elif isinstance(src.get("names"), dict):
                classes = [src["names"][k] for k in sorted(src["names"])]
        except Exception as exc:  # noqa: BLE001
            print(f"[train] Could not parse {src_yaml}: {exc}", flush=True)

    out_yaml = Path("/workspace/dataset.yaml")
    cfg = {
        "path": str(dataset_root),
        "train": "train/images",
        "val": "valid/images",
        "test": "test/images",
        "nc": len(classes),
        "names": classes,
    }
    with out_yaml.open("w") as f:
        yaml.safe_dump(cfg, f, sort_keys=False)
    print(f"[train] wrote runtime dataset config to {out_yaml}: {cfg}", flush=True)
    return out_yaml


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--dataset-root", required=True,
                   help="Folder containing {train,valid,test}/images (e.g. /gcs/<bucket>/<folder>)")
    p.add_argument("--out", required=True, help="Output dir to write best.pt / best.onnx into")
    p.add_argument("--epochs", type=int, default=50)
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--batch", type=int, default=16)
    p.add_argument("--base-model", default="yolov8n.pt")
    args = p.parse_args()

    print(f"[train] dataset-root={args.dataset_root}  out={args.out}  epochs={args.epochs}",
          flush=True)

    data_yaml = _build_dataset_yaml(Path(args.dataset_root))

    model = YOLO(args.base_model)
    model.train(
        data=str(data_yaml),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        project="/workspace/runs",
        name="train",
        exist_ok=True,
    )

    runs_dir = Path("/workspace/runs/train")
    best_pt = runs_dir / "weights" / "best.pt"
    if not best_pt.exists():
        raise SystemExit(f"[train] best.pt missing at {best_pt}")

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    # Copy PyTorch weights.
    shutil.copy(best_pt, out / "best.pt")
    print(f"[train] wrote {out / 'best.pt'}", flush=True)

    # Export ONNX for smaller, faster CPU inference at serving time.
    onnx_path = model.export(format="onnx", imgsz=args.imgsz)
    shutil.copy(onnx_path, out / "best.onnx")
    print(f"[train] wrote {out / 'best.onnx'}", flush=True)

    # Copy training metrics so the boss can see them in GCS.
    results_csv = runs_dir / "results.csv"
    if results_csv.exists():
        shutil.copy(results_csv, out / "results.csv")

    print("[train] done.", flush=True)


if __name__ == "__main__":
    main()
