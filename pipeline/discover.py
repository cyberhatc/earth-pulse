"""Tier B discovery: which NASA/partner products actually cover this point & period?

Live CMR granule search is attempted when network allows; on failure we fall back
to the documented static registry (configs/datasets.yaml). Results are always
labeled with a `method` field so the UI can show provenance honestly.
"""
from __future__ import annotations

import json
import urllib.request
import urllib.error

CMR = "https://cmr.earthdata.nasa.gov/search/granules.json"

# Static coverage registry — mirrors configs/datasets.yaml; used as offline fallback.
STATIC_REGISTRY = {
    "merra2": {"years": (1980, 2026), "variables": ["t2m", "precip", "humidity", "wind", "pressure"], "grain": "gridded 0.5°", "auth": "earthdata"},
    "nasa_power": {"years": (1981, 2026), "variables": ["t2m", "t2m_max", "t2m_min", "precip", "rh", "ws", "ps", "solar"], "grain": "point", "auth": "none"},
    "gistemp": {"years": (1880, 2026), "variables": ["temperature_anomaly"], "grain": "coarse global", "auth": "none"},
    "modis_ndvi": {"years": (2000, 2026), "variables": ["ndvi", "evi"], "grain": "gridded 1 km", "auth": "earthdata"},
    "modis_lst": {"years": (2000, 2026), "variables": ["lst"], "grain": "gridded 1 km", "auth": "earthdata"},
    "gpm_imerg": {"years": (2000, 2026), "variables": ["precipitation"], "grain": "gridded 0.1°", "auth": "earthdata"},
    "podaac_sst": {"years": (2002, 2026), "variables": ["sst"], "grain": "gridded 0.01°", "auth": "earthdata", "note": "ocean/coast only"},
    "podaac_ssh": {"years": (1993, 2026), "variables": ["sea_level"], "grain": "gridded/along-track", "auth": "earthdata", "note": "coastal/ocean"},
    "nsidc_seaice": {"years": (1979, 2026), "variables": ["sea_ice"], "grain": "gridded 25 km", "auth": "earthdata", "note": "polar/cold regions"},
    "firms": {"years": (2000, 2026), "variables": ["fires"], "grain": "point events", "auth": "free MAP_KEY"},
    "landsat": {"years": (1972, 2026), "variables": ["imagery"], "grain": "scene", "auth": "earthdata/usgs", "note": "via USGS EarthExplorer"},
    "era5": {"years": (1940, 2026), "variables": ["t2m", "precip", "wind", "humidity", "solar"], "grain": "gridded 0.25°", "auth": "cds (copernicus)"},
}


def discover_coverage(lat: float, lon: float, start_year: int = 1985, end_year: int = 2026,
                      timeout: int = 15) -> dict:
    registry = {k: dict(v) for k, v in STATIC_REGISTRY.items()}
    method = "static_registry"
    try:
        url = f"{CMR}?point[]={lon},{lat}&temporal[]={start_year}-01-01T00:00:00Z,{end_year}-12-31T23:59:59Z&page_size=50"
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        entries = body.get("entries", [])
        method = "cmr_live"
        hits = [e.get("short_name") for e in entries if e.get("short_name")]
        registry["_cmr_hits"] = {"count": len(hits), "sample": hits[:10]}
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        method = "static_registry_fallback"
    for k, v in registry.items():
        if k.startswith("_"):
            continue
        y0, y1 = v["years"]
        v["covers_period"] = not (end_year < y0 or start_year > y1)
        v["overlap_years"] = [max(y0, start_year), min(y1, end_year)]
    return {"method": method, "lat": lat, "lon": lon, "period": [start_year, end_year], "products": registry}
