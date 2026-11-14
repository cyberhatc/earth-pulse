"""Point-level analysis + forecast for a single location (high-res store).

Works on the per-location npz produced by pipeline/fetch_highres_point.py.
Computes Theil-Sen/Mann-Kendall trends per parameter, rolling robust-z
anomalies, and a multivariate ridge-rollout forecast with p10-p90 bands.
Also produces a "next move" summary (direction + magnitude over 5 years).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
import sys
sys.path.insert(0, str(ROOT))

from engine.trends import analyse_series
from models.forecast import future_dates, linear_trend_seasonal_forecast


PARAMS = ["temperature", "precipitation", "ndvi", "humidity", "wind", "solar_radiation"]


def load_point_store(path: Path) -> dict:
    with np.load(path, allow_pickle=False) as z:
        out = {k: z[k] for k in z.files}
    raw_meta = out.pop("meta_json", None)
    if isinstance(raw_meta, np.ndarray):
        meta_text = str(raw_meta.item()) if raw_meta.size == 1 else str(raw_meta)
    else:
        meta_text = str(raw_meta) if raw_meta is not None else ""
    out["meta"] = json.loads(meta_text or "{}")
    return out


def point_trends(store: dict) -> dict[str, dict]:
    dates = list(store["dates"])
    periods = 120.0
    out: dict[str, dict] = {}
    for p in PARAMS:
        if p not in store:
            continue
        arr = np.asarray(store[p], dtype=float)
        if not np.isfinite(arr).any():
            out[p] = {"slope_per_decade": 0.0, "p_value": 1.0, "significant": False,
                      "direction": "no data", "n": int(np.isfinite(arr).sum())}
            continue
        res = analyse_series(arr, periods)
        res["n"] = int(np.isfinite(arr).sum())
        if not np.isfinite(res.get("slope_per_decade", 0)):
            res["slope_per_decade"] = 0.0
        if not np.isfinite(res.get("p_value", 1)):
            res["p_value"] = 1.0
        out[p] = res
    return out


def point_anomalies(store: dict, window: int = 61, threshold: float = 3.0) -> list[dict]:
    out = []
    dates = list(store["dates"])
    for p in ("temperature", "precipitation", "ndvi"):
        if p not in store:
            continue
        arr = np.asarray(store[p], dtype=float)
        if not np.isfinite(arr).any():
            continue
        # rolling robust z
        for i in range(window, len(arr)):
            w = arr[i - window:i]
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
    return out[-30:]


def _matrix(store: dict, params: list[str]) -> tuple[list[str], np.ndarray]:
    dates = list(store["dates"])
    cols = []
    for p in params:
        arr = np.asarray(store[p], dtype=float)
        # fill NaN with column mean for model input
        if not np.isfinite(arr).all():
            m = np.nanmean(arr)
            arr = np.where(np.isfinite(arr), arr, m if np.isfinite(m) else 0.0)
        cols.append(arr)
    X = np.column_stack(cols)
    return dates, X


BOUNDS = {
    "temperature": (None, None),
    "precipitation": (0.0, None),
    "ndvi": (0.0, 1.0),
    "humidity": (0.0, 100.0),
    "wind": (0.0, None),
    "solar_radiation": (0.0, None),
}


def _clip(arr, lo, hi):
    a = np.asarray(arr, dtype=float)
    if lo is not None:
        a = np.maximum(a, lo)
    if hi is not None:
        a = np.minimum(a, hi)
    return a.tolist()


def point_forecast(store: dict, horizon_months: int = 60,
                   params: list[str] | None = None) -> dict:
    params = params or [p for p in PARAMS if p in store and np.isfinite(store[p]).any()]
    if not params:
        return {"dates": [], "timeseries": {}, "model": "none"}
    dates, X = _matrix(store, params)
    out_ts = {}
    fdates = future_dates(dates[-1], horizon_months)
    for j, p in enumerate(params):
        res = linear_trend_seasonal_forecast(X[:, j], dates, horizon_months)
        lo, hi = BOUNDS.get(p, (None, None))
        out_ts[p] = {
            "mean": _clip(res["mean"], lo, hi),
            "lower": _clip(res["lower"], lo, hi),
            "upper": _clip(res["upper"], lo, hi),
        }
    return {"dates": fdates, "timeseries": out_ts, "model": "linear_trend_seasonal_point",
            "trained_artifact": False}


def next_move_summary(store: dict, forecast: dict) -> dict:
    """Plain-language 'next move' over the 5-year horizon."""
    moves = {}
    for p, ts in forecast.get("timeseries", {}).items():
        mean = np.asarray(ts.get("mean", []), dtype=float)
        if mean.size < 12:
            continue
        # Use annual means at the start and end of the horizon so the seasonal
        # cycle does not masquerade as a trend.
        k = min(12, mean.size // 2)
        start_mean = float(np.mean(mean[:k]))
        end_mean = float(np.mean(mean[-k:]))
        delta = end_mean - start_mean
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
    return {
        "schema_version": "1.0.0",
        "location": {"lat": lat, "lon": lon, "name": "point"},
        "data_coverage": {
            "synthetic_demo": False,
            "parameters_used": [p for p in PARAMS if p in store and np.isfinite(store[p]).any()],
            "sources": meta.get("sources", {}),
            "ocean_cell": meta.get("ocean_cell", None),
            "time_range": [str(store["dates"][0]), str(store["dates"][-1])],
            "resolution_m": meta.get("resolution_m", {}),
            "notes": "High-resolution point store built from real NASA products. "
                     "See pipeline/fetch_highres_point.py.",
        },
        "past": {"dates": [str(d) for d in store["dates"]],
                 "timeseries": {p: [round(float(v), 4) if np.isfinite(v) else None
                                    for v in store[p]] for p in PARAMS if p in store},
                 "anomalies": an},
        "trends": tr,
        "forecast": {"horizon_months": 60, "issued": str(store["dates"][-1]),
                     "model": fc["model"], "dates": fc["dates"],
                     "timeseries": fc["timeseries"], "next_move": nm,
                     "projected_images": [], "scenarios": []},
        "next_move": nm,
        "explanation": {"text": "", "language": "en", "generator": "templated", "confidence": "medium"},
    }
