"""GET /anomalies — rolling robust-z anomaly flags for a place."""
from __future__ import annotations

from fastapi import APIRouter, Query, HTTPException

from api.deps import get_store
from api.services import store as svc
from models.anomaly import anomalies_for_cell

router = APIRouter()


@router.get("/anomalies")
def anomalies(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180),
              threshold: float = Query(3.5, ge=2.0, le=6.0)):
    try:
        store = get_store()
    except Exception as exc:
        raise HTTPException(503, detail=str(exc))
    cell, glat, glon = svc.nearest(store, lat, lon)
    flags = anomalies_for_cell(store, cell, ["temperature", "precipitation", "ndvi", "wind", "humidity"],
                               window=61, threshold=threshold)
    for f in flags:
        f["z"] = round(float(f["z"]), 3)
    return {"cell_index": cell, "grid_lat": glat, "grid_lon": glon,
            "threshold_abs_z": threshold, "anomalies": flags}
