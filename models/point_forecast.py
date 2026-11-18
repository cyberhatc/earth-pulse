"""Point-level analysis + forecast for a single location (high-res store).

Works on the per-location npz produced by pipeline/fetch_highres_point.py.
Computes Theil-Sen/Mann-Kendall trends for every available parameter, rolling
robust-z anomalies for the headline variables, and a linear-trend + seasonal
baseline forecast. The richer multivariate ridge-rollout model and rolling
backtest live in models/point_ml.py and are preferred by the dossier API when
the record is long enough.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from engine.trends import analyse_series
from models.forecast import future_dates, linear_trend_seasonal_forecast
from models.parameter_registry import (
    ML_EXCLUDE,
    PARAM_ORDER,
    PARAMETERS,
    param_bounds,
    parameter_meta as registry_parameter_meta,
)

PARAMS = PARAM_ORDER
ANOMALY_PARAMS = [
    "temperature", "precipitation", "ndvi", "lst_day",
    "soil_moisture_surface", "pm2_5", "aerosol_optical_depth",
    "net_radiation", "snow_cover", "ndsi",
]
MIN_FORECAST_POINTS = 18


def load_point_store(path: Path) -> dict:
    with np.load(path, allow_pickle=False) as z:
        out = {k: z[k] for k in z.files}
    raw_meta = out.pop("meta_json", None)
    if isinstance(raw_meta, np.ndarray):
        meta_text = str(raw_meta.item()) if raw_meta.size == 1 else str(raw_meta)
    else:
        meta_text = str(raw_meta) if raw_meta is not None else ""
    out["meta"] = json.loads(meta_text or "{}")

    # NASA POWER uses -999 as its "no data" fill. Left as-is it is a finite
    # value, which would silently poison trends, anomalies and the forecaster.
    for key, values in list(out.items()):
        if key in ("dates", "meta"):
            continue
        arr = np.asarray(values)
        if arr.ndim == 1 and arr.dtype.kind in "fi":
            cleaned = arr.astype(np.float64, copy=True)
            cleaned[cleaned <= -998.0] = np.nan
            out[key] = cleaned

    # Drop trailing months that hold no temperature at all (POWER lag).
    if "temperature" in out:
        valid = np.isfinite(np.asarray(out["temperature"], dtype=float))
        if valid.any():
            last = int(np.where(valid)[0][-1]) + 1
            if last < len(out["dates"]):
                out["dates"] = out["dates"][:last]
                for key, values in list(out.items()):
                    arr = np.asarray(values)
                    if arr.ndim == 1 and arr.shape[0] > last:
                        out[key] = arr[:last]
    return out


def point_trends(store: dict) -> dict[str, dict]:
    dates = list(store["dates"])
    periods = 120.0
    out: dict[str, dict] = {}
    for p in PARAMS:
        if p not in store:
            continue
        arr = np.asarray(store[p], dtype=float)
        finite = int(np.isfinite(arr).sum())
        if finite < 12:
            out[p] = {"slope_per_decade": 0.0, "p_value": 1.0, "significant": False,
                      "direction": "no data", "n": finite}
            continue
        res = analyse_series(arr, periods)
        res["n"] = finite
        if not np.isfinite(res.get("slope_per_decade", 0)):
            res["slope_per_decade"] = 0.0
        if not np.isfinite(res.get("p_value", 1)):
            res["p_value"] = 1.0
        out[p] = res
    return out


def point_anomalies(store: dict, window: int = 61, threshold: float = 3.0) -> list[dict]:
    out = []
    dates = list(store["dates"])
    for p in ANOMALY_PARAMS:
        if p not in store:
            continue
        arr = np.asarray(store[p], dtype=float)
        if not np.isfinite(arr).any():
            continue
        # rolling robust z
        for i in range(window, len(arr)):
            w = arr[i - window:i]
            if int(np.isfinite(w).sum()) < 20:
                continue
            med = np.nanmedian(w)
            mad = np.nanmedian(np.abs(w - med))
            scale = 1.4826 * mad if mad > 0 else np.nanstd(w)
            if not np.isfinite(scale) or scale == 0:
                continue
            z = (arr[i] - med) / scale
            if abs(z) >= threshold and np.isfinite(arr[i]):
                out.append({"parameter": p, "date": str(dates[i]), "z": round(float(z), 2),
                            "severity": "high" if abs(z) >= 4 else "moderate",
                            "kind": "high" if z > 0 else "low"})
    out.sort(key=lambda a: a["date"])
    return out[-40:]


def _clip(arr, lo, hi):
    a = np.asarray(arr, dtype=float)
    if lo is not None:
        a = np.maximum(a, lo)
    if hi is not None:
        a = np.minimum(a, hi)
    return a.tolist()


def point_forecast(store: dict, horizon_months: int = 60,
                   params: list[str] | None = None) -> dict:
    if params is None:
        params = [
            p for p in PARAMS
            if p not in ML_EXCLUDE
            and p in store
            and p in PARAMETERS
            and int(np.isfinite(np.asarray(store[p], dtype=float)).sum()) >= MIN_FORECAST_POINTS
        ]
    if not params:
        return {"dates": [], "timeseries": {}, "model": "none"}
    dates = [str(d) for d in store["dates"]]
    out_ts = {}
    fdates = future_dates(dates[-1], horizon_months)
    for p in params:
        series = np.asarray(store[p], dtype=float)
        res = linear_trend_seasonal_forecast(series, dates, horizon_months)
        lo, hi = param_bounds(p)
        out_ts[p] = {
            "mean": _clip(res["mean"], lo, hi),
            "lower": _clip(res["lower"], lo, hi),
            "upper": _clip(res["upper"], lo, hi),
        }
    return {"dates": fdates, "timeseries": out_ts, "model": "linear_trend_seasonal_point",
            "trained_artifact": False}


def horizon_delta(mean: list[float] | np.ndarray, window: int = 12) -> float:
    """Seasonal-safe change over a forecast horizon.

    Compares the mean of the last ``window`` months with the mean of the first
    ``window`` months, capped at half the horizon. A raw first-vs-last month
    difference would mostly measure the seasonal cycle.
    """
    arr = np.asarray(mean, dtype=float)
    arr = arr[np.isfinite(arr)]
    if arr.size < 2:
        return 0.0
    k = max(1, min(window, arr.size // 2))
    return round(float(np.mean(arr[-k:]) - np.mean(arr[:k])), 3)


def next_move_summary(store: dict, forecast: dict) -> dict:
    """Plain-language 'next move' over the 5-year horizon."""
    moves = {}
    for p, ts in forecast.get("timeseries", {}).items():
        mean = np.asarray(ts.get("mean", []), dtype=float)
        if mean.size < 12:
            continue
        delta = horizon_delta(mean)
        arr = np.asarray(store.get(p, []), dtype=float)
        std = float(np.nanstd(arr)) if arr.size else 1.0
        std = std if std > 0 else 1.0
        if abs(delta) < 1e-9:
            direction = "stable"
        elif delta > 0:
            direction = "rising"
        else:
            direction = "falling"
        moves[p] = {
            "delta_over_horizon": round(delta, 3),
            "direction": direction,
            "magnitude_in_std": round(delta / std, 2),
        }
    return moves


def analyse_point(path: Path) -> dict:
    store = load_point_store(path)
    tr = point_trends(store)
    fc = point_forecast(store, 60)
    an = point_anomalies(store)
    nm = next_move_summary(store, fc)
    lat = float(store.get("lat", 0))
    lon = float(store.get("lon", 0))
    meta = store.get("meta", {})
    used = [
        p for p in PARAMS
        if p in store and int(np.isfinite(np.asarray(store[p], dtype=float)).sum()) >= 12
    ]
    timeseries = {
        p: [round(float(v), 4) if np.isfinite(v) else None for v in np.asarray(store[p], dtype=float)]
        for p in used
    }
    parameter_meta = meta.get("parameter_meta") or {
        p: registry_parameter_meta(p) for p in used
    }
    return {
        "schema_version": "1.3.0",
        "location": {"lat": lat, "lon": lon, "name": "point",
                     "resolution_m": meta.get("resolution_m", {})},
        "data_coverage": {
            "synthetic_demo": False,
            "parameters_used": used,
            "parameters_unavailable": [p for p in PARAMS if p not in used],
            "sources": {p: s for p, s in (meta.get("sources") or {}).items() if p in used},
            "ocean_cell": meta.get("ocean_cell", None),
            "time_range": [str(store["dates"][0]), str(store["dates"][-1])],
            "resolution_m": meta.get("resolution_m", {}),
            "parameter_meta": parameter_meta,
            "satellite_mode": meta.get("satellite_mode"),
            "satellite_note": meta.get("satellite_note"),
            "satellite_products": meta.get("satellite_products"),
            "air_quality_period": meta.get("air_quality_period"),
            "notes": "High-resolution point store built from real NASA POWER, "
                     "Open-Meteo ERA5/CAMS and MODIS products. See "
                     "pipeline/fetch_highres_point.py.",
        },
        "past": {"dates": [str(d) for d in store["dates"]],
                 "timeseries": timeseries,
                 "anomalies": an},
        "trends": tr,
        "forecast": {"horizon_months": 60, "issued": str(store["dates"][-1]),
                     "model": fc["model"], "dates": fc["dates"],
                     "timeseries": fc["timeseries"], "next_move": nm,
                     "projected_images": [], "scenarios": []},
        "next_move": nm,
        "explanation": {"text": "", "language": "en", "generator": "templated", "confidence": "medium"},
    }
