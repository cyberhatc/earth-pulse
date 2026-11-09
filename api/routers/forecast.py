"""GET /forecast — forecast block only (same as /place's forecast)."""
from __future__ import annotations

from fastapi import APIRouter, Query, HTTPException

from api.deps import get_store
from api.services import store as svc
from models.infer import forecast_place, artifact_available

router = APIRouter()


@router.get("/forecast")
def forecast(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180),
             horizon_months: int = Query(60, ge=3, le=240)):
    try:
        store = get_store()
    except Exception as exc:
        raise HTTPException(503, detail=str(exc))
    cell, glat, glon = svc.nearest(store, lat, lon)
    fc = forecast_place(store, cell, horizon_months)
    return {
        "cell_index": cell,
        "grid_lat": glat,
        "grid_lon": glon,
        **fc,
        "trained_artifact": artifact_available(),
        "note": "p10–p90 band = 80% interval under model residual σ inflated by √h. Probabilistic outlook, not a certainty.",
    }
