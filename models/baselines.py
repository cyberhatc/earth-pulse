"""Forecasting baselines: persistence, seasonal naive, climatology+trend.

Used by the Phase 3 evaluation harness as the yardstick models must beat.
Each returns {"model": <name>, "mean": [H floats]}.
"""
from __future__ import annotations

import numpy as np


def persistence(series: np.ndarray, horizon: int) -> dict:
    y = np.asarray(series, dtype=np.float64)
    finite = y[np.isfinite(y)]
    last = float(finite[-1]) if finite.size else 0.0
    return {"model": "persistence", "mean": [last] * horizon}


def seasonal_naive(series: np.ndarray, dates: list[str], horizon: int) -> dict:
    y = np.asarray(series, dtype=np.float64)
    months = np.array([int(d[5:7]) for d in dates])
    clim = {}
    for m in range(1, 13):
        vals = y[months == m]
        vals = vals[np.isfinite(vals)]
        clim[m] = float(vals.mean()) if vals.size else 0.0
    out = []
    y_, m_ = int(dates[-1][:4]), int(dates[-1][5:7])
    for _ in range(horizon):
        m_ += 1
        if m_ > 12:
            m_ = 1
            y_ += 1
        out.append(clim[m_])
    return {"model": "seasonal_naive", "mean": out}


def climatology_trend(series: np.ndarray, dates: list[str], horizon: int) -> dict:
    from models.forecast import linear_trend_seasonal_forecast
    res = linear_trend_seasonal_forecast(series, dates, horizon)
    return {"model": "climatology_trend", "mean": res["mean"]}
