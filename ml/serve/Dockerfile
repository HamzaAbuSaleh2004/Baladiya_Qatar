FROM python:3.11-slim

# OpenCV needs a couple of system libs that aren't in -slim.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Bake the trained weights into the image. Copy your downloaded best.pt to ml/serve/model/best.pt
# before building.
COPY model/best.pt /model/best.pt
COPY serve.py /app/serve.py

ENV PORT=8080
EXPOSE 8080

# Vertex sets AIP_HTTP_PORT (defaults to 8080); uvicorn reads it via PORT env in serve.py if set.
CMD ["sh", "-c", "uvicorn serve:app --host 0.0.0.0 --port ${AIP_HTTP_PORT:-${PORT:-8080}}"]
