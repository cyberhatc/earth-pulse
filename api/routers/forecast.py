"""GET /forecast — forecast block only (same as /place's forecast)."""
from __future__ import annotations

from fastapi import APIRouter, Query, HTTPException

from api.deps import get_store, normalise_lon
from api.schemas import SCHEMA_VERSION
from api.services import store as svc
from models.infer import forecast_place

router = APIRouter()


@router.get("/forecast")
def forecast(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-360, le=360),
             horizon_months: int = Query(60, ge=3, le=240)):
    lon = normalise_lon(lon)
    try:
        store = get_store()
    except Exception as exc:
        raise HTTPException(503, detail=str(exc))
    cell, glat, glon = svc.nearest(store, lat, lon)
    fc = forecast_place(store, cell, horizon_months)
    band = fc.get("band_method")
    if band == "conformal":
        note = "p10–p90 band = conformal calibration on rolling-origin backtest residuals (see forecast.calibration). Probabilistic outlook, not a certainty."
    else:
        note = "p10–p90 band = 80% interval under model residual σ inflated by √h. Probabilistic outlook, not a certainty."
    return {
        "schema_version": SCHEMA_VERSION,
        "cell_index": cell,
        "grid_lat": glat,
        "grid_lon": glon,
        **fc,
        "trained_artifact": bool(fc.get("artifact")),
        "artifact": fc.get("artifact"),
        "note": note,
    }
