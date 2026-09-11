# ---- Digital Human Brain: container for Fly.io ---------------------------
# CPU-only PyTorch keeps the image small enough for Fly's free tier.

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8080

WORKDIR /app

# System deps kept minimal
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
    && rm -rf /var/lib/apt/lists/*

# PyTorch CPU wheels first (large, cache-friendly)
RUN pip install --index-url https://download.pytorch.org/whl/cpu \
    "torch==2.4.1+cpu"

# Everything else
COPY requirements.txt ./
RUN pip install -r requirements.txt

# Application
COPY backend ./backend
COPY frontend ./frontend

# Fly.io injects $PORT; uvicorn honours it.
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:${PORT}/health || exit 1

CMD ["sh", "-c", "python -m uvicorn backend.server:app --host 0.0.0.0 --port ${PORT}"]
