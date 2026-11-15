"""Earth Pulse API — FastAPI application.

Local:  uvicorn api.main:app --reload --port 8000
Docker: build `api/Dockerfile` (used for Hugging Face Spaces / Render free tier).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# make repo root importable (pipeline/, engine/, models/)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.schemas import SCHEMA_VERSION
from api.routers import place, imagery, trends, forecast, anomalies, explain, health, tierb, scenario, point, chat

app = FastAPI(
    title="Earth Pulse API",
    version="0.1.0",
    description="NASA Space Apps 2026 — click anywhere on Earth: past, present, forecast. "
                "Bundled with a deterministic SYNTHETIC sample store; swap in real NASA products for production use.",
)

_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:4173,https://example.github.io")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins.split(",")] if _origins != "*" else ["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Lightweight in-process rate limiter (best-effort, single instance).
import time as _time
_rate_bucket: dict[str, list[float]] = {}
_RATE_LIMIT = int(os.environ.get("EP_RATE_LIMIT_PER_MIN", "120"))


@app.middleware("http")
async def _rate_limit(request, call_next):
    if _RATE_LIMIT <= 0:
        return await call_next(request)
    ip = request.client.host if request.client else "unknown"
    now = _time.time()
    window = _rate_bucket.setdefault(ip, [])
    # drop entries older than 60s
    cutoff = now - 60.0
    while window and window[0] < cutoff:
        window.pop(0)
    if len(window) >= _RATE_LIMIT:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=429, content={"error": "rate_limited",
                                                     "detail": f"more than {_RATE_LIMIT} requests/minute"})
    window.append(now)
    return await call_next(request)

for r in (health.router, place.router, imagery.router, trends.router,
          forecast.router, anomalies.router, explain.router, tierb.router, scenario.router,
          point.router, chat.router):
    app.include_router(r)


@app.exception_handler(RuntimeError)
async def runtime_error_handler(_: Request, exc: RuntimeError):
    return JSONResponse(status_code=503, content={"error": "runtime_error", "detail": str(exc)})


@app.get("/")
def root():
    return {
        "name": "Earth Pulse API",
        "schema_version": SCHEMA_VERSION,
        "docs": "/docs",
        "health": "/health",
        "place": "/place?lat=12.97&lon=77.59",
        "chat": "POST /chat",
        "projected_svg": "/imagery/projected?parameter=temperature&year=2030",
    }
