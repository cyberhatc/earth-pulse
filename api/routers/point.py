"""High-resolution, point-level prediction endpoint.

GET /point?lat&lon&horizon_months=60

Builds (or loads) a per-location store from real NASA products via
pipeline/fetch_highres_point.py, runs point-level trends + forecast + anomalies
+ a 'next move' summary, and returns a unified payload (schema 1.0.0).
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter, Query, HTTPException

ROOT = Path(__file__).resolve().parent.parent.parent
import sys
sys.path.insert(0, str(ROOT))

from pipeline.fetch_highres_point import build_point_store
from models.point_forecast import analyse_point
from api.deps import normalise_lon

router = APIRouter()

_CACHE_DIR = ROOT / "data" / "processed" / "points"
_CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _store_path(lat: float, lon: float) -> Path:
    return _CACHE_DIR / f"point_{lat:.4f}_{lon:.4f}.npz".replace("-", "m")


@router.get("/point")
def point(lat: float = Query(..., ge=-90, le=90),
          lon: float = Query(..., ge=-360, le=360),
          horizon_months: int = Query(60, ge=3, le=240),
          rebuild: bool = Query(False)):
    lon = normalise_lon(lon)
    p = _store_path(lat, lon)
    if rebuild or not p.exists():
        try:
            build_point_store(lat, lon, p)
        except Exception as exc:
            raise HTTPException(503, detail=f"point_store_build_failed: {exc}")
    if not p.exists():
        raise HTTPException(503, detail="point store not available")
    try:
        payload = analyse_point(p)
    except Exception as exc:
        raise HTTPException(503, detail=f"point_analysis_failed: {exc}")
    # override horizon in forecast dates? analyse_point fixes 60; regenerate if needed
    if horizon_months != 60:
        from models.point_forecast import load_point_store, point_forecast, next_move_summary
        store = load_point_store(p)
        fc = point_forecast(store, horizon_months)
        payload["forecast"]["horizon_months"] = horizon_months
        payload["forecast"]["dates"] = fc["dates"]
        payload["forecast"]["timeseries"] = fc["timeseries"]
        payload["forecast"]["next_move"] = next_move_summary(store, fc)
        payload["next_move"] = payload["forecast"]["next_move"]
    return payload


@router.get("/point/imagery")
def point_imagery(lat: float = Query(..., ge=-90, le=90),
                  lon: float = Query(..., ge=-360, le=360)):
    lon = normalise_lon(lon)
    from pipeline.fetch_highres_point import fetch_satellite_imagery_links
    return fetch_satellite_imagery_links(lat, lon)
