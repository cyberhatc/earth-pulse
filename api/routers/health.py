"""GET /health — liveness/readiness for deployments and CI."""
from __future__ import annotations

from fastapi import APIRouter

from api.deps import (
    ANALYSIS_PATH,
    analysis_available,
    store_available,
    store_info,
    manifest_hash,
    models_info,
    uptime_seconds,
)
from api.schemas import SCHEMA_VERSION, API_VERSION, HealthResponse
from api.services import explainer, rag

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health():
    return {
        "status": "ok",
        "schema_version": SCHEMA_VERSION,
        "api_version": API_VERSION,
        "uptime_seconds": uptime_seconds(),
        # Legacy field: true when the configured store file exists. It does NOT
        # mean the data is synthetic; read store.synthetic for that.
        "sample_store": store_available(),
        "store": store_info(),
        "manifest_hash": manifest_hash(),
        "models": models_info(),
        "analysis": analysis_available(),
        "analysis_path": str(ANALYSIS_PATH),
        "llm": explainer.llm_status(),
        "rag": rag.rag_status(),
    }
