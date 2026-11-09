"""POST /explain — facts-only narrative (never alters numbers)."""
from __future__ import annotations

from fastapi import APIRouter

from api.schemas import ExplainRequest
from api.services import explainer

router = APIRouter()


@router.post("/explain")
def explain(req: ExplainRequest):
    result = explainer.explain(req.facts)
    return {"text": result["text"], "generator": result["generator"], "confidence": result["confidence"]}
