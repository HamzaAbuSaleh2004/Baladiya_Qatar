FROM ultralytics/ultralytics:latest

# Vertex AI custom-training auto-mounts every accessible GCS bucket at /gcs/<bucket>/.
# The trainer reads the dataset from there and writes weights back to a /gcs/ path.
WORKDIR /workspace
COPY train.py /workspace/train.py

# Dataset path and output path are passed in by Vertex via --args (see vertex_train_config.yaml).
ENTRYPOINT ["python", "/workspace/train.py"]
