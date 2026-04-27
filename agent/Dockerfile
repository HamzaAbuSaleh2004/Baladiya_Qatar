FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY baladiya_agent ./baladiya_agent
COPY server ./server

EXPOSE 8080

CMD ["sh", "-c", "uvicorn server.main:app --host 0.0.0.0 --port ${PORT}"]
