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

import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from api.schemas import SCHEMA_VERSION, API_VERSION
from api.routers import place, imagery, trends, forecast, anomalies, explain, health, tierb, scenario, point, chat

log = logging.getLogger("earth_pulse")
if not log.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter('{"ts":"%(asctime)s","level":"%(levelname)s","msg":%(message)s}', datefmt="%Y-%m-%dT%H:%M:%S"))
    log.addHandler(handler)
    log.setLevel(logging.INFO)
    log.propagate = False

MAX_REQUEST_BYTES = int(os.environ.get("EP_MAX_REQUEST_BYTES", str(1024 * 1024)))  # 1 MiB

app = FastAPI(
    title="Earth Pulse API",
    version=API_VERSION,
    description="NASA Space Apps 2026 — click anywhere on Earth: past, present, forecast. "
                "Bundled with a deterministic SYNTHETIC sample store; swap in real NASA products for production use.",
)

_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:4173")
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


# Observability + request-size guard. Logs one JSON line per request.
@app.middleware("http")
async def _observe(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    content_length = request.headers.get("content-length")
    if content_length and content_length.isdigit() and int(content_length) > MAX_REQUEST_BYTES:
        return JSONResponse(status_code=413, content={"error": "request_too_large",
                                                      "detail": f"body exceeds {MAX_REQUEST_BYTES} bytes"})
    import time as _t
    t0 = _t.time()
    response = await call_next(request)
    latency_ms = round((_t.time() - t0) * 1000.0, 1)
    response.headers["X-Request-ID"] = request_id
    log.info(f'{{"request_id":"{request_id}","method":"{request.method}","path":"{request.url.path}",'
             f'"status":{response.status_code},"latency_ms":{latency_ms}}}')
    return response


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
    # evict empty buckets so the dict doesn't grow without bound
    if not window and len(_rate_bucket) > 512:
        for k in [k for k, v in _rate_bucket.items() if not v]:
            _rate_bucket.pop(k, None)
    if len(window) >= _RATE_LIMIT:
        return JSONResponse(status_code=429, content={"error": "rate_limited",
                                                     "detail": f"more than {_RATE_LIMIT} requests/minute"})
    window.append(now)
    return await call_next(request)

for r in (health.router, place.router, imagery.router, trends.router,
          forecast.router, anomalies.router, explain.router, tierb.router, scenario.router,
          point.router, chat.router):
    app.include_router(r)

# Same handlers under /api so the production single-service frontend build
# (Vite default base "/api") works same-origin. Root paths stay for back-compat.
for r in (health.router, place.router, imagery.router, trends.router,
          forecast.router, anomalies.router, explain.router, tierb.router, scenario.router,
          point.router, chat.router):
    app.include_router(r, prefix="/api")


@app.exception_handler(RuntimeError)
async def runtime_error_handler(_: Request, exc: RuntimeError):
    return JSONResponse(status_code=503, content={"error": "runtime_error", "detail": str(exc)})


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"error": "validation_error",
                                                  "detail": str(exc.errors())[:2000]})


REPO_ROOT = Path(__file__).resolve().parent.parent
WEB_DIST = REPO_ROOT / "web" / "dist"

@app.get("/")
def root():
    if WEB_DIST.is_dir():
        return FileResponse(WEB_DIST / "index.html")
    return {
        "name": "Earth Pulse API",
        "schema_version": SCHEMA_VERSION,
        "docs": "/docs",
        "health": "/health",
        "place": "/place?lat=12.97&lon=77.59",
        "chat": "POST /chat",
        "projected_svg": "/imagery/projected?parameter=temperature&year=2030",
    }


# ---------------------------------------------------------------------------
# Single-service deployment: serve the built frontend (web/dist) + API together.
# Anything that is not an explicit API route falls back to the SPA bundle so
# BrowserRouter deep links work. /api/* paths NEVER fall back — they 404 JSON.
# ---------------------------------------------------------------------------
if WEB_DIST.is_dir():
    from fastapi.staticfiles import StaticFiles

    app.mount("/assets", StaticFiles(directory=str(WEB_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        if full_path.startswith("api/") or full_path == "api":
            return JSONResponse(status_code=404, content={"error": "not_found", "detail": f"unknown API route: {full_path}"})
        # Prevent path traversal out of WEB_DIST (e.g. /..%2f..%2f<file>)
        web_root = WEB_DIST.resolve()
        candidate = (web_root / full_path).resolve() if full_path else web_root
        if candidate.is_file() and candidate.is_relative_to(web_root):
            return FileResponse(str(candidate))
        return FileResponse(str(web_root / "index.html"))
