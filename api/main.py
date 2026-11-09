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
from api.routers import place, imagery, trends, forecast, anomalies, explain, health, tierb

app = FastAPI(
    title="Earth Pulse API",
    version="0.1.0",
    description="NASA Space Apps 2026 — click anywhere on Earth: past, present, forecast. "
                "Bundled with a deterministic SYNTHETIC sample store; swap in real NASA products for production use.",
)

_origins = os.environ.get("CORS_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins.split(",")] if _origins != "*" else ["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

for r in (health.router, place.router, imagery.router, trends.router,
          forecast.router, anomalies.router, explain.router, tierb.router):
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
        "projected_svg": "/imagery/projected?parameter=temperature&year=2030",
    }
