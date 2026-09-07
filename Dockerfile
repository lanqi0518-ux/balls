# syntax=docker/dockerfile:1.7
#
# Balls — single container that ships both the built frontend and the Node
# backend. The Express server statically serves the frontend from ./public
# and proxies /api/* to itself, so the whole app runs behind one port.

# ---------- stage 1: build the frontend ----------
FROM node:20-alpine AS frontend
WORKDIR /app/frontend

# Copy manifest first so Docker can cache the install layer
COPY frontend/package.json frontend/package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY frontend/ ./
# Same-origin API — the container serves the frontend and API from one port
ENV VITE_API_URL=""
RUN npm run build


# ---------- stage 2: build the backend ----------
FROM node:20-alpine AS backend
WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY backend/ ./
RUN npm run build


# ---------- stage 3: production image ----------
FROM node:20-alpine AS runtime
WORKDIR /app

# Only what the runtime actually needs
ENV NODE_ENV=production \
    PORT=8080 \
    FRONTEND_DIR=/app/public

# Copy backend manifest and install production-only deps for a slim image
COPY backend/package.json backend/package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Copy the compiled backend and the frontend bundle
COPY --from=backend  /app/backend/dist  ./dist
COPY --from=frontend /app/frontend/dist ./public

# Drop root
RUN addgroup -S balls && adduser -S balls -G balls && chown -R balls:balls /app
USER balls

EXPOSE 8080

# Basic container-level healthcheck — Fly.io also runs its own HTTP check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:8080/health >/dev/null || exit 1

CMD ["node", "dist/index.js"]
