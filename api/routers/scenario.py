"""GET /imagery/scenario — scenario-card status & conditioning preview.

Generation NEVER happens in an HTTP request (GPU + latency + honesty rules).
This endpoint returns the deterministic conditioning JSON (prompts, deltas, tile
URL) and whether the pipeline is enabled. Actual image creation is done offline
via models/scenario_cards.py --generate (Colab/Kaggle GPU).
"""
from __future__ import annotations

from fastapi import APIRouter, Query, HTTPException

from api.deps import get_store, normalise_lon
from api.services import store as svc
from models.infer import forecast_place
from pipeline.fetch_gibs import thumbnails_for_point
from models.scenario_image import build_conditioning, scenario_enabled, LABEL

router = APIRouter()


@router.get("/imagery/scenario")
def scenario(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-360, le=360),
             parameter: str = Query("ndvi"), horizon_months: int = Query(60, ge=3, le=240)):
    lon = normalise_lon(lon)
    try:
        store = get_store()
    except Exception as exc:
        raise HTTPException(503, detail=str(exc))
    if parameter not in svc.TS_PARAMS:
        raise HTTPException(400, detail=f"unknown parameter '{parameter}' (allowed: {', '.join(svc.TS_PARAMS)})")
    cell, _, _ = svc.nearest(store, lat, lon)

    fc = forecast_place(store, cell, horizon_months, variables=[parameter])
    if parameter not in fc["timeseries"]:
        return {"status": "no_coverage", "reason": f"no usable {parameter} history at the nearest cell (masked or <12 months).",
                "label": LABEL, "cards": []}
    mean = fc["timeseries"][parameter]["mean"]
    valid = int(__import__("numpy").isfinite(store[parameter][:, cell]).sum())
    last_observed = float(store[parameter][:, cell][-1]) if valid else None
    tiles = thumbnails_for_point(lat, lon, ["2025-06-01"], z=4)
    src = tiles[0]["url"] if tiles else None
    if not src:
        raise HTTPException(503, detail="could not build source tile URL")

    conditioning = build_conditioning(lat, lon, parameter, mean, last_observed, src)
    enabled = scenario_enabled()
    return {
        "status": "ready_for_offline_generation" if enabled else "disabled_in_config",
        "enabled": enabled,
        "instruction": "Run: EP_SCENARIO_IMAGES=1 python3 models/scenario_cards.py --generate --lat {0} --lon {1} --parameter {2}  (GPU; never inside HTTP)".format(lat, lon, parameter),
        "label": LABEL,
        "usable_months": valid,
        "conditioning": conditioning,
        "cards": conditioning["cards"] if enabled else [],
    }
