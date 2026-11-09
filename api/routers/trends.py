"""Trend & climate-twin endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Query, HTTPException

from api.deps import get_store, get_analysis
from api.services import store as svc

router = APIRouter()

_PARAMS = ["temperature", "precipitation", "ndvi", "sst", "sea_level", "solar_radiation", "humidity", "wind"]


@router.get("/trends/cell")
def trends_cell(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    try:
        store = get_store()
        analysis = get_analysis()
    except Exception as exc:
        raise HTTPException(503, detail=str(exc))
    cell, glat, glon = svc.nearest(store, lat, lon)
    out = {}
    for p in _PARAMS:
        rec = svc.trend_for(analysis, p, cell)
        if rec:
            out[p] = {k: (round(v, 4) if isinstance(v, float) else v) for k, v in rec.items()
                      if k in ("slope_per_decade", "p_value", "significant", "direction", "n")}
    return {"cell_index": cell, "grid_lat": glat, "grid_lon": glon, "trends": out}


@router.get("/trends/opposite")
def trends_opposite(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180),
                    limit: int = Query(8, ge=1, le=50)):
    try:
        store = get_store()
        analysis = get_analysis()
    except Exception as exc:
        raise HTTPException(503, detail=str(exc))
    cell, glat, glon = svc.nearest(store, lat, lon)
    return {"cell_index": cell, "grid_lat": glat, "grid_lon": glon,
            "opposite_trends": svc.opposite_near(analysis, cell, limit=limit)}


@router.get("/twins")
def twins(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    try:
        store = get_store()
        analysis = get_analysis()
    except Exception as exc:
        raise HTTPException(503, detail=str(exc))
    cell, glat, glon = svc.nearest(store, lat, lon)
    twin = svc.twin_label(analysis, cell)
    labels = analysis.get("climate_twins", {}).get("labels", [])
    members = [int(i) for i, lab in enumerate(labels) if lab == twin["cluster_id"]]
    cells = analysis.get("cells", [])
    twin["members"] = [cells[i] for i in members][:50]
    return {"cell_index": cell, "grid_lat": glat, "grid_lon": glon, "twin": twin}
