"""Rolling-origin backtesting for the forecaster.

Holds out the last `test_months`, trains on the prefix, scores vs baselines.
Metrics per parameter: MAE, RMSE, PicP (p10–p90 coverage).
"""
from __future__ import annotations

import math

import numpy as np

from models.forecast import make_windows, RidgeRollout


def mae(a, b):
    return float(np.mean(np.abs(np.asarray(a) - np.asarray(b))))


def rmse(a, b):
    return float(math.sqrt(np.mean((np.asarray(a) - np.asarray(b)) ** 2)))


def picp(lower, upper, actual) -> float:
    lower, upper, actual = map(np.asarray, (lower, upper, actual))
    return float(np.mean((actual >= lower) & (actual <= upper)))


def backtest_cell(X_full: np.ndarray, variables: list[str], seq_len: int = 24,
                  test_months: int = 24, horizon: int = 24, lam: float = 1e-2) -> dict:
    """X_full: (T, F) for ONE cell. Trains ridge on prefix, evaluates next `horizon`."""
    T, F = X_full.shape
    train_end = T - horizon
    if train_end <= seq_len + 12:
        return {"error": "series too short for backtest", "n": T}
    Xs_tr, ys_tr = make_windows(X_full[:train_end], seq_len)
    model = RidgeRollout(lam=lam).fit(Xs_tr, ys_tr)
    init = X_full[train_end - seq_len: train_end]
    pred = model.rollout(init, horizon)  # (horizon, F)
    actual = X_full[train_end: train_end + horizon]
    out = {}
    for i, var in enumerate(variables):
        p = pred[:, i]
        a = actual[:, i]
        scale = 1.645 * (model.resid_std[i] if model.resid_std is not None else a.std()) * np.sqrt(np.arange(1, horizon + 1))
        out[var] = {
            "mae": mae(p, a),
            "rmse": rmse(p, a),
            "picp_p10_p90": picp(p - scale, p + scale, a),
            "bias": float(np.mean(p - a)),
        }
    return {"seq_len": seq_len, "horizon": horizon, "per_parameter": out}
