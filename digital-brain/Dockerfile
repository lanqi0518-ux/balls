# ---- Digital Human Brain: container for Fly.io ---------------------------
# CPU-only PyTorch keeps the image small enough for Fly's free tier.

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8080 \
    PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers

WORKDIR /app

# System deps: curl + Chromium runtime libs Playwright needs.
# Using system chromium binary + Playwright as the driver saves ~150MB
# vs. letting Playwright download its own bundled Chromium.
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates \
        chromium fonts-liberation fonts-noto-color-emoji \
        libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
        libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
        libgbm1 libpango-1.0-0 libcairo2 libasound2 libxshmfence1 \
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

# Data directory (mounted from a Fly volume so cortex weights & paper book
# survive across restarts and rolling deploys).
RUN mkdir -p /data
ENV DATA_DIR=/data

# Fly.io injects $PORT; uvicorn honours it.
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:${PORT}/health || exit 1

CMD ["sh", "-c", "python -m uvicorn backend.server:app --host 0.0.0.0 --port ${PORT}"]
