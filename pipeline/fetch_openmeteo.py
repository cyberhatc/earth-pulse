"""Open-Meteo ERA5 archive fetcher (free, no API key).

Fetches daily ERA5-derived series for a single point and aggregates them to
monthly means, maxima/minima or totals. This is an independent reanalysis
cross-check to NASA POWER, not a copy of it.

Docs: https://open-meteo.com/en/docs/historical-weather-api
"""
from __future__ import annotations

import json
import math
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / "data" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

DAILY_VARS = ",".join(
    [
        "temperature_2m_mean",
        "temperature_2m_max",
        "temperature_2m_min",
        "apparent_temperature_mean",
        "relative_humidity_2m_mean",
        "dew_point_2m_mean",
        "precipitation_sum",
        "rain_sum",
        "snowfall_sum",
        "wind_speed_10m_mean",
        "wind_gusts_10m_max",
        "wind_direction_10m_dominant",
        "et0_fao_evapotranspiration",
        "vapour_pressure_deficit_max",
        "soil_moisture_0_to_7cm_mean",
        "soil_moisture_7_to_28cm_mean",
        "soil_moisture_28_to_100cm_mean",
        "soil_temperature_0_to_7cm_mean",
        "soil_temperature_7_to_28cm_mean",
        "pressure_msl_mean",
        "surface_pressure_mean",
        "cloud_cover_mean",
        "sunshine_duration",
        "daylight_duration",
        "shortwave_radiation_sum",
    ]
)
CACHE_DAYS = 30
CACHE_VERSION = 2

# output parameter -> (Open-Meteo daily field, aggregation, multiplier)
# aggregation is one of: mean, sum, circular, max
DAILY_MAP: dict[str, tuple[str, str, float]] = {
    "temperature": ("temperature_2m_mean", "mean", 1.0),
    "temperature_max": ("temperature_2m_max", "mean", 1.0),
    "temperature_min": ("temperature_2m_min", "mean", 1.0),
    "apparent_temperature": ("apparent_temperature_mean", "mean", 1.0),
    "humidity": ("relative_humidity_2m_mean", "mean", 1.0),
    "dew_point": ("dew_point_2m_mean", "mean", 1.0),
    "precipitation": ("precipitation_sum", "sum", 1.0),
    "rainfall": ("rain_sum", "sum", 1.0),
    "snowfall": ("snowfall_sum", "sum", 1.0),
    "wind": ("wind_speed_10m_mean", "mean", 1.0 / 3.6),
    "wind_gusts": ("wind_gusts_10m_max", "mean", 1.0 / 3.6),
    "wind_direction": ("wind_direction_10m_dominant", "circular", 1.0),
    "et_reference": ("et0_fao_evapotranspiration", "sum", 1.0),
    "vapour_pressure_deficit": ("vapour_pressure_deficit_max", "mean", 1.0),
    "soil_moisture_0_7cm": ("soil_moisture_0_to_7cm_mean", "mean", 1.0),
    "soil_moisture_7_28cm": ("soil_moisture_7_to_28cm_mean", "mean", 1.0),
    "soil_moisture_28_100cm": ("soil_moisture_28_to_100cm_mean", "mean", 1.0),
    "soil_temperature_0_7cm": ("soil_temperature_0_to_7cm_mean", "mean", 1.0),
    "soil_temperature_7_28cm": ("soil_temperature_7_to_28cm_mean", "mean", 1.0),
    "pressure_msl": ("pressure_msl_mean", "mean", 1.0),
    "cloud_cover": ("cloud_cover_mean", "mean", 1.0),
    "sunshine_duration": ("sunshine_duration", "sum", 1.0 / 3600.0),
    "daylight_duration": ("daylight_duration", "sum", 1.0 / 3600.0),
    "solar_radiation": ("shortwave_radiation_sum", "mean", 1.0 / 3.6),
}


def _cache_path(lat: float, lon: float) -> Path:
    return (CACHE_DIR / f"openmeteo_{lat:.4f}_{lon:.4f}.json").with_name(
        f"openmeteo_{lat:.4f}_{lon:.4f}.json".replace("-", "m")
    )


def _read_cache(path: Path, *, stale_ok: bool = False) -> dict | None:
    """Read the local ERA5 cache.

    ``stale_ok`` lets a request reuse an older cache copy instead of blocking on
    a slow live fetch. The returned note says the copy is stale so the dossier
    never presents it as freshly fetched.
    """
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
        reasons: list[str] = []
        if data.get("cache_version") != CACHE_VERSION:
            if not stale_ok:
                return None
            reasons.append("older cache schema")
        try:
            generated = datetime.fromisoformat(data["generated_utc"])
            if generated.tzinfo is None:
                generated = generated.replace(tzinfo=timezone.utc)
            age_days = (datetime.now(timezone.utc) - generated).days
        except Exception:
            generated = None
            age_days = CACHE_DAYS + 1
        if age_days > CACHE_DAYS:
            if not stale_ok:
                return None
            reasons.append(f"{age_days} days old")
        if reasons:
            data["stale_cache"] = reasons
            existing = str(data.get("note") or "").strip()
            data["note"] = (
                existing + " " if existing else ""
            ) + "Using cached ERA5 copy (" + ", ".join(reasons) + "); not freshly fetched."
        return data
    except Exception:
        return None


def _clean(value: Any) -> float | None:
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return float(value)
    return None


def fetch_openmeteo_monthly(
    lat: float,
    lon: float,
    years: int = 40,
    timeout: int = 12,
    force: bool = False,
    stale_ok: bool = False,
) -> dict[str, Any]:
    """Return {"available": bool, "parameters": {name: {"YYYY-MM": value}}, ...}.

    Interactive callers pass ``stale_ok=True`` and a short ``timeout`` so a slow
    upstream never blocks a dossier request; older cached copies are labeled.
    """
    path = _cache_path(lat, lon)
    if not force:
        cached = _read_cache(path, stale_ok=stale_ok)
        if cached:
            return cached

    end = date.today() - timedelta(days=5)
    start = date(end.year - years, 1, 1)
    query = urllib.parse.urlencode(
        {
            "latitude": f"{lat:.4f}",
            "longitude": f"{lon:.4f}",
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "daily": DAILY_VARS,
            "timezone": "UTC",
        }
    )
    url = f"https://archive-api.open-meteo.com/v1/archive?{query}"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # pragma: no cover - network dependent
        return {"available": False, "note": f"openmeteo_unreachable: {exc}"}

    daily = payload.get("daily") or {}
    times = daily.get("time") or []
    if not times:
        return {"available": False, "note": "openmeteo_empty_response"}

    acc: dict[str, dict[str, list[float]]] = {}
    dir_acc: dict[str, list[tuple[float, float]]] = {}
    for i, stamp in enumerate(times):
        key = str(stamp)[:7]
        rec = acc.setdefault(key, {})
        for out_name, (src, agg, _mul) in DAILY_MAP.items():
            if i >= len(daily.get(src) or []):
                continue
            value = _clean((daily.get(src) or [])[i])
            if value is None:
                continue
            if agg == "circular":
                rad = math.radians(value)
                dir_acc.setdefault(key, []).append((math.sin(rad), math.cos(rad)))
            else:
                rec.setdefault(out_name, []).append(value)

    parameters: dict[str, dict[str, float]] = {p: {} for p in DAILY_MAP}
    for key in sorted(acc):
        rec = acc[key]
        for out_name, (_src, agg, mul) in DAILY_MAP.items():
            if out_name == "wind_direction":
                pairs = dir_acc.get(key) or []
                if pairs:
                    sx = sum(p[0] for p in pairs)
                    cy = sum(p[1] for p in pairs)
                    parameters[out_name][key] = round(
                        (math.degrees(math.atan2(sx, cy)) + 360.0) % 360.0, 2
                    )
                continue
            values = rec.get(out_name) or []
            if not values:
                continue
            if agg == "sum":
                out = sum(values) * mul
            elif agg == "max":
                out = max(values) * mul
            else:
                out = (sum(values) / len(values)) * mul
            parameters[out_name][key] = round(out, 3)

    months = sorted(parameters.get("temperature") or {})
    result = {
        "available": bool(months),
        "cache_version": CACHE_VERSION,
        "source": "Open-Meteo ERA5 archive (free, no API key)",
        "url": url,
        "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "period": [months[0], months[-1]] if months else None,
        "n_months": len(months),
        "parameters": parameters,
        "note": (
            "ERA5 reanalysis interpolated to the point; independent of NASA POWER. "
            "Daily values aggregated to monthly means, maxima or totals. Wind is "
            "converted from km/h to m/s, radiation from MJ/m²/day to kWh/m²/day, "
            "sunshine from seconds to hours, and snowfall is reported in cm."
        ),
    }
    try:
        path.write_text(json.dumps(result))
    except Exception:
        pass
    return result
