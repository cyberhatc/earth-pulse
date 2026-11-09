"""Imagery endpoints: past GIBS/Landsat references and model-projected SVG maps."""
from __future__ import annotations

from functools import lru_cache

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import Response

from api.deps import get_store, get_analysis
from api.services import ondemand
from models.project_maps import projected_field, svg_heatmap

router = APIRouter()

_ALLOWED = {"temperature", "precipitation", "ndvi", "sst", "sea_level", "solar_radiation", "humidity", "wind"}


@router.get("/imagery/past")
def imagery_past(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    return {
        "point": {"lat": lat, "lon": lon},
        "gibs": ondemand.gibs_past(lat, lon),
        "landsat_query": ondemand.landsat_link(lat, lon),
        "note": "GIBS tiles render current layer defaults; historical layer dates vary by product. Landsat gives true scenes via EarthExplorer.",
    }


@lru_cache(maxsize=64)
def _projected_svg(parameter: str, year: int) -> str:
    store = get_store()
    analysis = get_analysis()
    # slope per month from Theil–Sen slope per decade
    trends = analysis.get("trends", {}).get(parameter, {})
    slopes = {int(k): v["slope_per_decade"] / 120.0 for k, v in trends.items()}
    last_date = list(store["dates"])[-1]
    field = projected_field(store, parameter, slopes, last_date, year)
    n_lats, n_lons = len(store["lats"]), len(store["lons"])
    grid = field.reshape(n_lats, n_lons)[::-1]  # north on top
    lats_n = store["lats"][::-1]
    title = f"{parameter.replace('_', ' ').title()} — projected {year}"
    subtitle = "Model-projected (Theil–Sen extrapolation of the trend) · not an observation · synthetic demo store"
    return svg_heatmap(lats_n, store["lons"], grid.ravel(), title, subtitle)


@router.get("/imagery/projected")
def imagery_projected(parameter: str = Query("temperature"),
                      year: int = Query(2030, ge=2026, le=2080)):
    if parameter not in _ALLOWED:
        raise HTTPException(400, detail=f"parameter must be one of {sorted(_ALLOWED)}")
    try:
        svg = _projected_svg(parameter, year)
    except Exception as exc:
        raise HTTPException(503, detail=str(exc))
    return Response(content=svg, media_type="image/svg+xml",
                    headers={"Cache-Control": "public, max-age=3600"})
