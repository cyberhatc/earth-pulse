"""Region-grounded facts for POST /chat.

The chat model must answer from the data of the region the user is looking at,
not from a synthetic sample grid. This module turns the same point-level
analysis used by the notebook dossier into the compact `facts` dict that
`explainer`/RAG consume:

  * NASA POWER monthly point record for the requested coordinate (1981+);
  * Theil–Sen / Mann–Kendall trends and rolling robust-z anomalies;
  * the ridge-rollout ML forecast and its rolling-origin backtest;
  * ERA5 (Open-Meteo) and GISTEMP context when an already-cached dossier
    provides them.

If a point store cannot be built, `facts_for_chat` returns None and the caller
falls back to the gridded store — and the facts then say so.
"""
from __future__ import annotations

import math
import time
from typing import Any

import numpy as np

from models.point_forecast import horizon_delta
from models.parameter_registry import (
    PARAM_ORDER,
    REQUESTED_UNAVAILABLE,
    param_label,
    param_unit,
    parameter_meta,
)

POINT_PARAMS = PARAM_ORDER
EXTRA_PARAMS = ["sst", "sea_level"]
ALL_PARAMS = POINT_PARAMS + EXTRA_PARAMS


def _r(value: Any, digits: int = 3) -> float:
    try:
        out = float(value)
    except (TypeError, ValueError):
        return 0.0
    if not math.isfinite(out):
        return 0.0
    return round(out, digits)


def _count_finite(values: Any) -> int:
    arr = np.asarray(values, dtype=float) if values is not None else np.array([])
    return int(np.isfinite(arr).sum()) if arr.size else 0


def _forecast_deltas(timeseries: dict[str, Any]) -> dict[str, float | None]:
    out: dict[str, float | None] = {}
    for param, block in (timeseries or {}).items():
        mean = (block or {}).get("mean") or []
        if len(mean) >= 2:
            try:
                out[param] = horizon_delta(mean)
            except (TypeError, ValueError):
                out[param] = None
    return out


def _trends(raw: dict[str, Any]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for param, rec in (raw or {}).items():
        if not isinstance(rec, dict):
            continue
        out[param] = {
            "slope_per_decade": _r(rec.get("slope_per_decade", 0)),
            "p_value": round(float(rec.get("p_value", 1) or 1), 4),
            "significant": bool(rec.get("significant")),
            "direction": rec.get("direction", "no trend"),
            "n": int(rec.get("n", 0) or 0),
        }
    return out


def _anomalies(raw: list[dict] | None) -> tuple[int, list[dict]]:
    items = [a for a in (raw or []) if isinstance(a, dict)]
    trimmed = []
    for a in items[-20:]:
        trimmed.append(
            {
                "parameter": a.get("parameter"),
                "date": str(a.get("date")),
                "z": _r(a.get("z", 0)),
                "severity": a.get("severity"),
                "kind": a.get("kind"),
            }
        )
    return len(items), trimmed


def _backtest(ml: dict[str, Any] | None) -> dict[str, dict]:
    block = (ml or {}).get("backtest") or {}
    per = block.get("per_parameter") or {}
    out: dict[str, dict] = {}
    for param, rec in per.items():
        if not isinstance(rec, dict):
            continue
        out[param] = {
            "mae": _r(rec.get("mae", 0)),
            "rmse": _r(rec.get("rmse", 0)),
            "picp_p10_p90": _r(rec.get("picp_p10_p90", 0), 3),
            "skill_vs_persistence": (
                _r(rec.get("skill_vs_persistence"), 3)
                if rec.get("skill_vs_persistence") is not None
                else None
            ),
        }
    return out


def _cross_check(raw: dict[str, Any] | None) -> dict[str, Any]:
    raw = raw or {}
    out: dict[str, Any] = {}
    om = (raw.get("sources") or {}).get("Open-Meteo (ERA5)") or {}
    if om.get("available"):
        trends: dict[str, dict] = {}
        for param, rec in (om.get("trends") or {}).items():
            if not isinstance(rec, dict):
                continue
            trends[param] = {
                "slope_per_decade": _r(rec.get("slope_per_decade", 0)),
                "p_value": round(float(rec.get("p_value", 1) or 1), 4),
                "significant": bool(rec.get("significant")),
                "n": int(rec.get("n", 0) or 0),
            }
        out["era5"] = {
            "source": "Open-Meteo ERA5 archive (independent reanalysis)",
            "period": om.get("period"),
            "n_months": om.get("n_months"),
            "trends": trends,
        }
    gis = raw.get("gistemp") or {}
    if gis.get("available"):
        out["gistemp"] = {
            "source": "NASA GISS GISTEMP v4 (global context only)",
            "period": gis.get("period"),
            "slope_per_decade": _r(gis.get("slope_per_decade", 0)),
            "p_value": round(float(gis.get("p_value", 1) or 1), 4),
            "significant": bool(gis.get("significant")),
            "latest_year": gis.get("latest_year"),
            "latest_anomaly": _r(gis.get("latest_anomaly", 0), 2),
            "base_period": gis.get("base_period", "1951-1980"),
        }
    return out


def _facts_from_parts(
    *,
    lat: float,
    lon: float,
    horizon: int,
    region_name: str | None,
    region_slug: str | None,
    variable: str | None,
    mode: str,
    coverage: dict[str, Any],
    past: dict[str, Any],
    trends: dict[str, Any],
    forecast: dict[str, Any],
    anomalies: list[dict] | None,
    ml: dict[str, Any] | None,
    cross_check: dict[str, Any] | None,
) -> dict:
    dates = [str(d) for d in (past.get("dates") or [])]
    series = past.get("timeseries") or {}
    used = list(coverage.get("parameters_used") or [])
    if not used:
        used = [
            p
            for p in ALL_PARAMS
            if p in series and _count_finite(series[p]) >= 12
        ]
    missing = [p for p in ALL_PARAMS if p not in used]

    fc_dates = [str(d) for d in (forecast.get("dates") or [])]
    anomaly_count, anomaly_samples = _anomalies(anomalies)

    sources = {
        k: v
        for k, v in (coverage.get("sources") or {}).items()
        if k in used
    }

    point = mode == "point_real"
    pmeta = coverage.get("parameter_meta") or {}
    labels = {
        p: {
            "label": param_label(p) if p in PARAM_ORDER else p,
            "unit": param_unit(p) if p in PARAM_ORDER else "",
            "source": (pmeta.get(p) or {}).get("source") or (coverage.get("sources") or {}).get(p),
            "native": (pmeta.get(p) or {}).get("native"),
            "coverage": (pmeta.get(p) or {}).get("coverage"),
            "n": (pmeta.get(p) or {}).get("n"),
        }
        for p in used
    }
    gaps = [
        (
            "Real NASA POWER monthly point record for this coordinate."
            if point
            else "Gridded fallback record — treat it as coarser than the point dossier."
        ),
        (
            f"NASA POWER is a 0.5° × 0.625° source grid (~55 × 62 km); the "
            f"nominal {coverage.get('area_km', 100)} km² box is not resolved "
            "by the 40-year record."
            if point
            else "Gridded store cell — not a point measurement."
        ),
    ]
    if missing:
        gaps.append(
            "Unavailable at this location: "
            + ", ".join(missing)
            + " — reported as missing, never fabricated."
        )
    if coverage.get("satellite_mode") in (None, "none", "unavailable"):
        gaps.append(
            "MODIS satellite series is not yet backfilled for this point; "
            "satellite imagery is available, but NDVI/LST/ET/GPP values may be missing."
        )
    if coverage.get("air_quality_period"):
        gaps.append(
            "CAMS air-quality parameters start in 2023 and are a short record, "
            "not a 40-year series."
        )

    return {
        "data_basis": "point" if point else "grid",
        "lat": round(lat, 4),
        "lon": round(lon, 4),
        "region_name": region_name,
        "region_slug": region_slug,
        "variable": variable,
        "grid_lat": round(lat, 3),
        "grid_lon": round(lon, 3),
        "cell_index": None if point else coverage.get("cell_index"),
        "time_range": coverage.get("time_range")
        or ([dates[0], dates[-1]] if dates else ["?", "?"]),
        "trends": _trends(trends),
        "forecast_deltas": _forecast_deltas(forecast.get("timeseries") or {}),
        "forecast_delta_basis": "end-of-horizon mean minus start-of-horizon mean (up to 12-month windows)",
        "forecast_model": forecast.get("model", "ridge_rollout_point"),
        "forecast_window": (
            [fc_dates[0], fc_dates[-1]] if fc_dates else []
        ),
        "horizon_months": horizon,
        "anomalies_count": anomaly_count,
        "anomaly_samples": anomaly_samples[-5:],
        "opposite_count": 0,
        "opposite_pairs": [],
        "climate_twin": None,
        "synthetic": not point,
        "ocean_cell": None,
        "parameters_used": used,
        "parameters_unavailable": missing,
        "requested_unavailable": REQUESTED_UNAVAILABLE,
        "parameter_labels": labels,
        "parameter_meta": pmeta,
        "sources": sources,
        "model_backtest": _backtest(ml),
        "cross_check": _cross_check(cross_check),
        "resolution_m": coverage.get("resolution_m"),
        "satellite": {
            "mode": coverage.get("satellite_mode"),
            "note": coverage.get("satellite_note"),
            "products": coverage.get("satellite_products"),
            "air_quality_period": coverage.get("air_quality_period"),
        },
        "gap_notes": gaps,
    }


def _cached_cross_check(lat: float, lon: float) -> dict[str, Any] | None:
    """Reuse independent-source caches without triggering a network fetch.

    Chat must stay fast. If the dossier has already populated the Open-Meteo
    and GISTEMP caches, include them; otherwise return None and let the next
    notebook visit fill them.
    """
    try:
        from api.routers import dossier as dossier_router
        from pipeline.fetch_gistemp import CACHE as GISTEMP_CACHE
        from pipeline.fetch_openmeteo import CACHE_DAYS, _cache_path

        path = _cache_path(lat, lon)
        if not path.exists() or not GISTEMP_CACHE.exists():
            return None
        if time.time() - path.stat().st_mtime > CACHE_DAYS * 86400:
            return None
        return dossier_router._cross_check(lat, lon, [], force=False)
    except Exception:
        return None


def _facts_from_point_payload(
    payload: dict[str, Any],
    *,
    lat: float,
    lon: float,
    horizon: int,
    region_name: str | None,
    region_slug: str | None,
    variable: str | None,
    cross_check: dict[str, Any] | None = None,
) -> dict:
    coverage = dict(payload.get("data_coverage") or {})
    forecast = payload.get("forecast") or {}
    coverage.setdefault("time_range", None)
    return _facts_from_parts(
        lat=lat,
        lon=lon,
        horizon=horizon,
        region_name=region_name,
        region_slug=region_slug,
        variable=variable,
        mode="point_real",
        coverage=coverage,
        past=payload.get("past") or {},
        trends=payload.get("trends") or {},
        forecast=forecast,
        anomalies=(payload.get("past") or {}).get("anomalies"),
        ml=payload.get("ml"),
        cross_check=cross_check,
    )


def _facts_from_dossier(
    d: dict[str, Any],
    *,
    lat: float,
    lon: float,
    horizon: int,
    region_name: str | None,
    region_slug: str | None,
    variable: str | None,
) -> dict:
    coverage = dict(d.get("coverage") or {})
    area = d.get("area") or {}
    if area.get("approx_km2"):
        coverage["area_km"] = area["approx_km2"]
    history = d.get("history") or {}
    past = {
        "dates": history.get("dates") or [],
        "timeseries": history.get("series") or {},
    }
    return _facts_from_parts(
        lat=lat,
        lon=lon,
        horizon=horizon,
        region_name=region_name or (d.get("location") or {}).get("name"),
        region_slug=region_slug,
        variable=variable,
        mode=str(d.get("mode") or "grid_demo"),
        coverage=coverage,
        past=past,
        trends=d.get("trends") or {},
        forecast=d.get("forecast") or {},
        anomalies=d.get("anomalies"),
        ml=d.get("ml"),
        cross_check=d.get("cross_check"),
    )


def facts_for_chat(
    lat: float,
    lon: float,
    horizon_months: int = 60,
    region_name: str | None = None,
    region_slug: str | None = None,
    variable: str | None = None,
) -> dict | None:
    """Return point-grounded chat facts, or None when no point record exists.

    Reuses the dossier's in-memory cache when the notebook already loaded the
    same coordinate (so chat is instant and includes ERA5/GISTEMP). Otherwise
    it builds the point analysis directly — POWER fetch on first use for a new
    coordinate, cached on disk afterwards.
    """
    try:
        from api.routers import dossier as dossier_router
    except Exception:
        return None

    key = (round(lat, 4), round(lon, 4), horizon_months)
    hit = getattr(dossier_router, "_CACHE", {}).get(key)
    ttl = getattr(dossier_router, "_CACHE_TTL", 600.0)
    if hit and time.time() - hit[0] < ttl:
        try:
            return _facts_from_dossier(
                hit[1],
                lat=lat,
                lon=lon,
                horizon=horizon_months,
                region_name=region_name,
                region_slug=region_slug,
                variable=variable,
            )
        except Exception:
            pass

    try:
        payload, _built = dossier_router._point_payload(
            lat, lon, horizon_months, False
        )
    except Exception:
        return None
    if not payload or not (payload.get("past") or {}).get("dates"):
        return None
    try:
        return _facts_from_point_payload(
            payload,
            lat=lat,
            lon=lon,
            horizon=horizon_months,
            region_name=region_name,
            region_slug=region_slug,
            variable=variable,
            cross_check=_cached_cross_check(lat, lon),
        )
    except Exception:
        return None
