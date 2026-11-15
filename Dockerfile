# Earth Pulse — single-service image (frontend + backend).
# Build:  docker build -t earth-pulse .
# Run:    docker run --rm -p 8000:8000 -e PORT=8000 earth-pulse
# Serves: /            -> built Vite app (web/dist)
#         /api/*       -> FastAPI endpoints (same handlers also at root for back-compat)
# Data:   the bundled SYNTHETIC sample store, built at image time (offline-safe).
#         For real NASA POWER data set EP_STORE_PATH after mounting a real store,
#         e.g. -e EP_STORE_PATH=/data/earth_pulse_power_real.npz -e EP_ANALYSIS_PATH=/data/analysis_power_real.json

# ---------- stage 1: build the frontend ----------
FROM node:22-bookworm-slim AS web
WORKDIR /build/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# ---------- stage 2: runtime ----------
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    EP_STORE_PATH=/app/data/samples/earth_pulse_sample.npz \
    EP_ANALYSIS_PATH=/app/data/processed/analysis.json \
    PORT=8000

WORKDIR /app

COPY api/requirements.txt api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt

COPY . .
RUN python pipeline/run_pipeline.py --sample \
 && python engine/run_engine.py \
 && python models/train.py

COPY --from=web /build/web/dist ./web/dist

EXPOSE 8000
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT}"]
