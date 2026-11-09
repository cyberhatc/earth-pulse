"""GET /health — liveness/readiness for deployments and CI."""
from __future__ import annotations

from fastapi import APIRouter

from api.deps import store_available, analysis_available

router = APIRouter()


@router.get("/health")
def health():
    return {
        "status": "ok",
        "schema_version": "1.0.0",
        "sample_store": store_available(),
        "analysis": analysis_available(),
    }
