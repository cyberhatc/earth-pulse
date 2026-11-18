"""POST /chat — conversational, facts-locked LLM narration.

The backend assembles the FACTS from the same point-level analysis used by the
notebook dossier: the real NASA POWER monthly record for the requested
coordinate (or the region centre), Theil–Sen/Mann–Kendall trends, rolling
robust-z anomalies, the blended ridge-rollout ML forecast and its rolling
backtest. A gridded fallback is used only when no point store can be built, and
the facts mark that explicitly.

With EP_RAG_BACKEND=hf-router, retrieval runs locally over the bundled knowledge
base and generation runs on HF's serverless router; with EP_RAG_BACKEND=hf the
query goes to the Hugging Face RAG Space. Otherwise a local Ollama model
re-words those facts. The model never computes or changes a number. If no LLM is
available the endpoint falls back to a deterministic templated answer. Every
LLM draft passes the same guards regardless of backend, and the prompt tells the
model to answer about the region the user is viewing.
"""
from __future__ import annotations

import numpy as np
from fastapi import APIRouter, HTTPException

from api.deps import get_store, get_analysis, normalise_lon
from api.schemas import ChatRequest, ChatResponse, SCHEMA_VERSION
from api.services import store as svc
from api.services import explainer
from models.infer import forecast_place
from models.anomaly import anomalies_for_cell
from models.point_forecast import horizon_delta

router = APIRouter()


def _r3(value: float) -> float:
    try:
        return round(float(value), 3)
    except Exception:
        return 0.0


def _grid_facts(req: ChatRequest) -> dict:
    """Fallback facts when no point-level record can be built."""
    store = get_store()
    analysis = get_analysis()
    cell, glat, glon = svc.nearest(store, req.lat, req.lon)

    finite = {p: (int(np.isfinite(store[p][:, cell]).sum()) if p in store else 0)
              for p in svc.TS_PARAMS}
    usable = [p for p, n in finite.items() if n >= 12]
    missing = [p for p, n in finite.items() if n < 12]

    trends: dict[str, dict] = {}
    for p in svc.TS_PARAMS:
        rec = svc.trend_for(analysis, p, cell)
        if rec:
            trends[p] = {
                "slope_per_decade": _r3(rec.get("slope_per_decade", 0)),
                "p_value": round(float(rec.get("p_value", 1)), 4),
                "significant": bool(rec.get("significant")),
                "direction": rec.get("direction", "no trend"),
                "n": int(rec.get("n", 0)),
            }

    fc = forecast_place(store, cell, req.horizon_months, variables=usable)
    deltas: dict[str, float | None] = {}
    for p, block in (fc.get("timeseries") or {}).items():
        mean = block.get("mean") or []
        deltas[p] = horizon_delta(mean) if mean else None
    fc_dates = list(fc.get("dates") or [])

    anomaly_params = [p for p in ("temperature", "precipitation", "ndvi") if p in store]
    anomalies = anomalies_for_cell(
        store, cell, anomaly_params, window=61, threshold=3.5
    )
    anomaly_count = len(anomalies)
    anomalies = anomalies[-20:]
    for a in anomalies:
        a["z"] = _r3(a.get("z", 0))

    opposite = svc.opposite_near(analysis, cell, limit=4)
    twin = svc.twin_label(analysis, cell)
    meta = store.get("meta", {})
    dates = list(store["dates"])
    synthetic = bool(meta.get("synthetic", True))
    ocean_mask = store.get("ocean_mask")
    ocean_cell = bool(ocean_mask[cell] == 1) if ocean_mask is not None else None
    sources = {k: v for k, v in svc.source_map(synthetic).items() if k in usable}

    # Keep only JSON-safe, presentation-ready fields for the prompt.
    return {
        "data_basis": "grid",
        "lat": req.lat,
        "lon": req.lon,
        "region_name": req.region_name,
        "region_slug": req.region_slug,
        "variable": req.variable,
        "grid_lat": _r3(glat),
        "grid_lon": _r3(glon),
        "cell_index": int(cell),
        "time_range": [str(dates[0]), str(dates[-1])],
        "trends": trends,
        "forecast_deltas": deltas,
        "forecast_model": fc.get("model", "ridge_rollout"),
        "forecast_window": [fc_dates[0], fc_dates[-1]] if fc_dates else [],
        "horizon_months": req.horizon_months,
        "anomalies_count": anomaly_count,
        "anomaly_samples": anomalies[-5:],
        "opposite_count": len(opposite),
        "opposite_pairs": opposite[:2],
        "climate_twin": twin,
        "synthetic": synthetic,
        "ocean_cell": ocean_cell,
        "parameters_used": usable,
        "parameters_unavailable": missing,
        "sources": sources,
        "gap_notes": (
            (["Synthetic demo store — not real observations."] if synthetic else
             ["Real NASA POWER monthly record; NDVI/SST/sea level are not available "
              "from POWER and are reported as unavailable, never fabricated."])
            + (["Sea level & SST are ocean parameters; NDVI is a land parameter."]
               if ocean_cell is not None else [])
        ),
    }


def _build_facts(req: ChatRequest) -> dict:
    """Prefer the real point record for the region; fall back to the grid."""
    try:
        from api.services.location_facts import facts_for_chat

        facts = facts_for_chat(
            req.lat,
            req.lon,
            horizon_months=req.horizon_months,
            region_name=req.region_name,
            region_slug=req.region_slug,
            variable=req.variable,
        )
        if facts:
            return facts
    except Exception:
        # A missing point store must not take chat down; use the grid below.
        pass
    return _grid_facts(req)


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    req.lon = normalise_lon(req.lon)
    try:
        facts = _build_facts(req)
    except Exception as exc:
        raise HTTPException(503, detail=f"facts_unavailable: {exc}")

    messages = [m.model_dump() for m in req.messages]
    result = explainer.chat(messages, facts, language=req.language)
    return {
        "schema_version": SCHEMA_VERSION,
        "text": result["text"],
        "generator": result["generator"],
        "model": result.get("model"),
        "confidence": result["confidence"],
        "card_kind": result["card_kind"],
        "llm_available": result["llm_available"],
        "guard_reason": result.get("guard_reason"),
        "guard_numbers": result.get("guard_numbers", []),
        "sources": result.get("sources", []),
        "facts": facts,
    }
