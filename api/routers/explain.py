"""POST /explain — facts-only narrative (never alters numbers)."""
from __future__ import annotations

from fastapi import APIRouter

from api.schemas import ExplainRequest, ExplainResponse, SCHEMA_VERSION
from api.services import explainer

router = APIRouter()


@router.post("/explain", response_model=ExplainResponse)
def explain(req: ExplainRequest):
    result = explainer.explain(req.facts)
    return {"schema_version": SCHEMA_VERSION,
            "text": result["text"], "generator": result["generator"], "confidence": result["confidence"]}
