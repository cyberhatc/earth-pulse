"""Open-Meteo Air Quality (CAMS) fetcher — free, no API key.

The CAMS global atmospheric composition record served by Open-Meteo starts in
2023, so these parameters get an honest short-record label in the dossier. They
are never back-filled with synthetic values.

Docs: https://open-meteo.com/en/docs/air-quality-api
"""
from __future__ import annotations

import json
import math
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / "data" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

HOURLY_VARS = ",".join(
    [
        "pm10",
        "pm2_5",
        "carbon_monoxide",
        "nitrogen_dioxide",
        "sulphur_dioxide",
        "ozone",
        "aerosol_optical_depth",
        "dust",
        "uv_index",
    ]
)
OUT_PARAMS = [
    "pm2_5", "pm10", "nitrogen_dioxide", "sulphur_dioxide", "ozone",
    "carbon_monoxide", "aerosol_optical_depth", "dust", "uv_index",
]
CACHE_DAYS = 7
CACHE_VERSION = 2


def _cache_path(lat: float, lon: float) -> Path:
    return (CACHE_DIR / f"airquality_{lat:.4f}_{lon:.4f}.json").with_name(
        f"airquality_{lat:.4f}_{lon:.4f}.json".replace("-", "m")
    )


def _read_cache(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
        if data.get("cache_version") != CACHE_VERSION:
            return None
        generated = datetime.fromisoformat(data["generated_utc"])
        if (datetime.utcnow() - generated).days <= CACHE_DAYS:
            return data
    except Exception:
        return None
    return None


def _finite(value: Any) -> float | None:
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return float(value)
    return None


def fetch_air_quality_monthly(
    lat: float,
    lon: float,
    timeout: int = 120,
    force: bool = False,
) -> dict[str, Any]:
    """Return monthly means of CAMS air-quality fields for one point."""
    path = _cache_path(lat, lon)
    if not force:
        cached = _read_cache(path)
        if cached:
            return cached

    start = date(2023, 1, 1)
    end = date.today() - timedelta(days=2)
    if end <= start:
        return {"available": False, "note": "air_quality_record_not_started"}
    query = urllib.parse.urlencode(
        {
            "latitude": f"{lat:.4f}",
            "longitude": f"{lon:.4f}",
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "hourly": HOURLY_VARS,
            "timezone": "UTC",
        }
    )
    url = f"https://air-quality-api.open-meteo.com/v1/air-quality?{query}"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # pragma: no cover - network dependent
        return {"available": False, "note": f"air_quality_unreachable: {exc}"}

    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    if not times:
        return {"available": False, "note": "air_quality_empty_response"}

    acc: dict[str, dict[str, list[float]]] = {}
    for i, stamp in enumerate(times):
        key = str(stamp)[:7]
        rec = acc.setdefault(key, {p: [] for p in OUT_PARAMS})
        for p in OUT_PARAMS:
            values = hourly.get(p) or []
            if i >= len(values):
                continue
            v = _finite(values[i])
            if v is not None:
                rec[p].append(v)

    parameters: dict[str, dict[str, float]] = {p: {} for p in OUT_PARAMS}
    for key, rec in sorted(acc.items()):
        for p, values in rec.items():
            if values:
                parameters[p][key] = round(sum(values) / len(values), 3)

    months = sorted(parameters.get("pm2_5") or parameters.get("ozone") or {})
    result = {
        "available": bool(months),
        "cache_version": CACHE_VERSION,
        "source": "Open-Meteo Air Quality (CAMS), free and no API key",
        "url": url,
        "generated_utc": datetime.utcnow().isoformat(timespec="seconds"),
        "period": [months[0], months[-1]] if months else None,
        "n_months": len(months),
        "parameters": parameters,
        "note": (
            "CAMS atmospheric composition starts in 2023. Monthly means of hourly "
            "values; this is a short record, not a 40-year series."
        ),
    }
    try:
        path.write_text(json.dumps(result))
    except Exception:
        pass
    return result
