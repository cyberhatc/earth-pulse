"""Ridge-rollout ML forecaster for a single-point store.

Trains the repository's closed-form ridge model (models.forecast.RidgeRollout)
on lag windows of every available parameter plus month-of-year features, then
rolls the model forward autoregressively. Long-horizon paths are blended with a
transparent Theil–Sen trend + monthly-climatology baseline so autoregressive
drift cannot dominate a 5-year projection; the ML weight is high for the first
year (the horizon the rolling backtest validates) and decays afterwards.

Uncertainty bands combine both one-step residual spreads and scale by sqrt(h),
i.e. the p10–p90 interval of a normal approximation (z = 1.2816).

A rolling-origin backtest (12-month horizons, origins every 12 months) reports
MAE, RMSE, pinball loss and p10–p90 coverage, plus the skill versus a
persistence baseline. Everything is computed locally from the fetched series —
no numbers are invented.
"""
from __future__ import annotations

import math
from typing import Any

import numpy as np

from models.forecast import (
    RidgeRollout,
    future_dates,
    linear_trend_seasonal_forecast,
    make_windows,
)
from pipeline.build_features import time_features
from pipeline.clean import fill_missing_linear
from models.parameter_registry import (
    ML_EXCLUDE,
    PARAM_ORDER,
    param_bounds,
)

SEQ_LEN = 24
Z80 = 1.2816
FULL_RECORD_MIN = 120
SHORT_RECORD_MIN = 36


def _bounds(param: str) -> tuple[float | None, float | None]:
    return param_bounds(param)


def _clip(values: np.ndarray, param: str) -> np.ndarray:
    lo, hi = _bounds(param)
    arr = np.asarray(values, dtype=float)
    if lo is not None:
        arr = np.maximum(arr, lo)
    if hi is not None:
        arr = np.minimum(arr, hi)
    return arr


def _finite_span(store: dict, param: str):
    """Return (first, last, array) for a parameter's real observed span."""
    if param not in store:
        return None
    arr = np.asarray(store[param], dtype=float)
    idx = np.where(np.isfinite(arr))[0]
    if idx.size == 0:
        return None
    return int(idx[0]), int(idx[-1]), arr


def usable_params(store: dict) -> list[str]:
    """Parameters with a complete-enough record for the joint ridge model.

    A series with leading NaNs (satellite products begin in 2000, CAMS in 2023)
    is excluded here. Filling those leading gaps with the first observed value
    would fabricate decades of training data, so those parameters instead get
    their own ridge model fitted over their real observed span.
    """
    out = []
    for p in PARAM_ORDER:
        if p in ML_EXCLUDE:
            continue
        span = _finite_span(store, p)
        if span is None:
            continue
        first, _last, arr = span
        if first <= 0 and int(np.isfinite(arr).sum()) >= FULL_RECORD_MIN:
            out.append(p)
    return out


def short_record_params(store: dict) -> list[str]:
    out = []
    for p in PARAM_ORDER:
        if p in ML_EXCLUDE:
            continue
        span = _finite_span(store, p)
        if span is None:
            continue
        _first, _last, arr = span
        n = int(np.isfinite(arr).sum())
        if SHORT_RECORD_MIN <= n < FULL_RECORD_MIN:
            out.append(p)
    return out


def _matrix(store: dict, params: list[str]) -> tuple[list[str], np.ndarray]:
    dates = [str(d) for d in store["dates"]]
    cols = [_clip(fill_missing_linear(np.asarray(store[p], dtype=float)), p) for p in params]
    feats = time_features(dates)
    X = np.column_stack(cols + [feats["month_sin"], feats["month_cos"]])
    return dates, X


def _pinball(actual: np.ndarray, quantile_pred: np.ndarray, q: float) -> float:
    diff = actual - quantile_pred
    return float(np.mean(np.maximum(q * diff, (q - 1.0) * diff)))


def rolling_backtest(
    store: dict,
    params: list[str],
    horizon: int = 12,
    step: int = 12,
    seq_len: int = SEQ_LEN,
    lam: float = 1e-2,
) -> dict[str, Any]:
    """Rolling-origin evaluation against a persistence baseline."""
    dates, X = _matrix(store, params)
    T = len(dates)
    mintrain = seq_len + 120
    first = max(mintrain, T - 4 * step - horizon)
    origins = list(range(first, T - horizon + 1, step))
    if not origins:
        return {"available": False, "note": "series too short for a rolling backtest", "n": T}

    acc: dict[str, dict[str, list[float]]] = {
        p: {"ae": [], "se": [], "pinball": [], "inside": [], "base_ae": [], "base_se": []}
        for p in params
    }
    for t in origins:
        Xtr, Ytr = make_windows(X[:t], seq_len)
        model = RidgeRollout(lam=lam).fit(Xtr, Ytr)
        fd = future_dates(dates[t - 1], horizon)
        ff = time_features(fd)
        known = np.column_stack([ff["month_sin"], ff["month_cos"]])
        pred = model.rollout(X[t - seq_len:t], horizon, known_future=known)
        actual = X[t:t + horizon]
        last = X[t - 1]
        steps = np.arange(1, horizon + 1, dtype=float)
        for i, p in enumerate(params):
            mu = _clip(pred[:, i], p)
            a = actual[:, i]
            scale = Z80 * float(model.resid_std[i]) * np.sqrt(steps)
            lower, upper = mu - scale, mu + scale
            rec = acc[p]
            rec["ae"].extend(np.abs(mu - a).tolist())
            rec["se"].extend(((mu - a) ** 2).tolist())
            rec["inside"].extend(((a >= lower) & (a <= upper)).astype(float).tolist())
            rec["pinball"].append(
                (_pinball(a, lower, 0.1) + _pinball(a, mu, 0.5) + _pinball(a, upper, 0.9)) / 3.0
            )
            base = np.full_like(a, last[i])
            rec["base_ae"].extend(np.abs(base - a).tolist())
            rec["base_se"].extend(((base - a) ** 2).tolist())

    per_parameter: dict[str, dict[str, float]] = {}
    for p, rec in acc.items():
        mae = float(np.mean(rec["ae"])) if rec["ae"] else float("nan")
        rmse = float(math.sqrt(np.mean(rec["se"]))) if rec["se"] else float("nan")
        base_mae = float(np.mean(rec["base_ae"])) if rec["base_ae"] else float("nan")
        skill = 1.0 - mae / base_mae if base_mae and math.isfinite(base_mae) and base_mae > 0 else float("nan")
        per_parameter[p] = {
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "pinball": round(float(np.mean(rec["pinball"])), 4) if rec["pinball"] else float("nan"),
            "picp_p10_p90": round(float(np.mean(rec["inside"])), 3) if rec["inside"] else float("nan"),
            "persistence_mae": round(base_mae, 4),
            "skill_vs_persistence": round(skill, 3) if math.isfinite(skill) else None,
        }
    return {
        "available": True,
        "horizon_months": horizon,
        "origins": len(origins),
        "seq_len": seq_len,
        "per_parameter": per_parameter,
        "note": (
            "Rolling-origin backtest on the fetched record; persistence = last value "
            "repeated. picp_p10_p90 should be ≈0.80 if the bands are calibrated."
        ),
    }


def _blend_weights(steps: np.ndarray) -> np.ndarray:
    return 0.85 * np.exp(-(steps - 1.0) / 15.0) + 0.05


def _single_series_rollout(
    store: dict,
    param: str,
    horizon: int,
    seq_len: int = SEQ_LEN,
    lam: float = 1e-2,
) -> dict[str, list[float]] | None:
    """Ridge rollout for one parameter over its real observed span only.

    Used for satellite/CAMS series that start after 1981. Their leading NaNs
    are never edge-filled into the training matrix.
    """
    span = _finite_span(store, param)
    if span is None:
        return None
    first, last, arr = span
    all_dates = [str(d) for d in store["dates"]]
    dates = all_dates[first:last + 1]
    y = fill_missing_linear(arr[first:last + 1])
    if len(y) < seq_len + 24:
        return None

    feats = time_features(dates)
    X = np.column_stack([y, feats["month_sin"], feats["month_cos"]])
    Xtr, Ytr = make_windows(X, seq_len)
    model = RidgeRollout(lam=lam).fit(Xtr, Ytr)

    # Align the forecast to the store's horizon even if this series ends early.
    offset = max(0, len(all_dates) - 1 - last)
    total_h = horizon + offset
    fd = future_dates(dates[-1], total_h)
    ff = time_features(fd)
    known = np.column_stack([ff["month_sin"], ff["month_cos"]])
    pred = model.rollout(X[-seq_len:], total_h, known_future=known)[offset:offset + horizon, 0]

    base = linear_trend_seasonal_forecast(y, dates, total_h)
    base_mean = np.asarray(base["mean"], dtype=float)[offset:offset + horizon]
    steps = np.arange(1, horizon + 1, dtype=float)
    bw = _blend_weights(steps)
    mu = _clip(bw * pred + (1.0 - bw) * base_mean, param)
    ml_sigma = float(model.resid_std[0])
    base_sigma = float(base.get("resid_sigma", 0.0))
    step_sigma = np.sqrt((bw * ml_sigma) ** 2 + ((1.0 - bw) * base_sigma) ** 2)
    scale = Z80 * step_sigma * np.sqrt(steps)
    lo, hi = _bounds(param)
    lower, upper = mu - scale, mu + scale
    if lo is not None:
        lower = np.maximum(lower, lo)
    if hi is not None:
        upper = np.minimum(upper, hi)
    return {
        "mean": [round(float(v), 4) for v in mu],
        "lower": [round(float(v), 4) for v in lower],
        "upper": [round(float(v), 4) for v in upper],
    }


def _single_series_backtest(
    store: dict,
    param: str,
    seq_len: int = SEQ_LEN,
    lam: float = 1e-2,
) -> dict[str, Any] | None:
    span = _finite_span(store, param)
    if span is None:
        return None
    first, last, arr = span
    dates = [str(d) for d in store["dates"]][first:last + 1]
    y = fill_missing_linear(arr[first:last + 1])
    if len(y) < seq_len + 144:
        return None
    try:
        return rolling_backtest(
            {"dates": dates, param: y}, [param],
            seq_len=seq_len, lam=lam,
        )
    except Exception:  # pragma: no cover - defensive
        return None


def ml_forecast(
    store: dict,
    horizon: int = 60,
    params: list[str] | None = None,
    seq_len: int = SEQ_LEN,
    lam: float = 1e-2,
    backtest: bool = True,
) -> dict[str, Any]:
    """Train honest ridge models for every available parameter.

    Parameters with a complete record use one joint multivariate ridge rollout.
    Satellite/CAMS series, whose record starts later, get a separate ridge
    rollout fitted only over their observed span; no leading values are invented.
    """
    requested = (
        list(params) if params
        else [
            p for p in PARAM_ORDER
            if p not in ML_EXCLUDE and _finite_span(store, p) is not None
            and int(np.isfinite(np.asarray(store[p], dtype=float)).sum()) >= 18
        ]
    )
    if not requested:
        return {"dates": [], "timeseries": {}, "model": "none"}

    all_dates = [str(d) for d in store["dates"]]
    fdates = future_dates(all_dates[-1], horizon)
    steps = np.arange(1, horizon + 1, dtype=float)
    blend_w = _blend_weights(steps)
    timeseries: dict[str, dict[str, list[float]]] = {}
    model_map: dict[str, str] = {}

    joint = [p for p in requested if p in usable_params(store)]
    Xtr = np.empty((0, 0))
    model = None
    baseline_sigma: dict[str, float] = {}
    if joint:
        dates, X = _matrix(store, joint)
        if len(dates) > seq_len + 24:
            Xtr, Ytr = make_windows(X, seq_len)
            model = RidgeRollout(lam=lam).fit(Xtr, Ytr)
            feats = time_features(fdates)
            known = np.column_stack([feats["month_sin"], feats["month_cos"]])
            pred = model.rollout(X[-seq_len:], horizon, known_future=known)
            for i, p in enumerate(joint):
                base = linear_trend_seasonal_forecast(X[:, i], dates, horizon)
                base_mean = np.asarray(base["mean"], dtype=float)
                pred[:, i] = blend_w * pred[:, i] + (1.0 - blend_w) * base_mean
                baseline_sigma[p] = float(base.get("resid_sigma", 0.0))
                mu = _clip(pred[:, i], p)
                ml_sigma = float(model.resid_std[i])
                step_sigma = np.sqrt(
                    (blend_w * ml_sigma) ** 2
                    + ((1.0 - blend_w) * baseline_sigma[p]) ** 2
                )
                scale = Z80 * step_sigma * np.sqrt(steps)
                lo, hi = _bounds(p)
                lower, upper = mu - scale, mu + scale
                if lo is not None:
                    lower = np.maximum(lower, lo)
                if hi is not None:
                    upper = np.minimum(upper, hi)
                timeseries[p] = {
                    "mean": [round(float(v), 4) for v in mu],
                    "lower": [round(float(v), 4) for v in lower],
                    "upper": [round(float(v), 4) for v in upper],
                }
                model_map[p] = "ridge_rollout_point"
        else:
            joint = []

    # Parameters with a late start get their own model over the observed span.
    for p in requested:
        if p in timeseries:
            continue
        single = _single_series_rollout(store, p, horizon, seq_len=seq_len, lam=lam)
        if single is None:
            span = _finite_span(store, p)
            if span is None:
                continue
            first, last, arr = span
            sdates = all_dates[first:last + 1]
            y = fill_missing_linear(arr[first:last + 1])
            base = linear_trend_seasonal_forecast(y, sdates, horizon)
            lo, hi = _bounds(p)
            mu = _clip(base["mean"], p)
            single = {
                "mean": [round(float(v), 4) for v in mu],
                "lower": [round(float(v), 4) if lo is None else round(float(max(lo, v)), 4)
                          for v in base["lower"]],
                "upper": [round(float(v), 4) if hi is None else round(float(min(hi, v)), 4)
                          for v in base["upper"]],
            }
            model_map[p] = "linear_trend_seasonal_point"
        else:
            model_map[p] = "ridge_single_point"
        timeseries[p] = single

    if not timeseries:
        return {"dates": [], "timeseries": {}, "model": "none"}

    out: dict[str, Any] = {
        "dates": fdates,
        "timeseries": timeseries,
        "model": "ridge_rollout_point" if joint else "ridge_single_point",
        "models_by_parameter": model_map,
        "joint_params": joint,
        "single_series_params": [p for p in requested if p not in joint],
        "seq_len": seq_len,
        "n_rows": int(Xtr.shape[0]),
        "n_features": int(Xtr.shape[1]),
        "trained_artifact": False,
        "short_record_params": short_record_params(store),
        "short_record_note": (
            "Parameters whose record starts after 1981 (satellite 2000+, CAMS "
            "2023+, some radiation components 1984+) are fitted only over their "
            "real observed span; leading gaps are never filled with invented "
            "values."
        ),
        "blend": {
            "method": (
                "ridge rollout blended with a Theil–Sen trend + monthly "
                "climatology baseline"
            ),
            "weight_ml_first_month": round(float(blend_w[0]), 3),
            "weight_ml_12th_month": round(float(blend_w[min(11, len(blend_w) - 1)]), 3),
            "weight_ml_last_month": round(float(blend_w[-1]), 3),
            "note": (
                "ML weight decays with horizon to limit autoregressive drift; "
                "uncertainty bands combine both residual spreads."
            ),
        },
    }
    if backtest:
        bt: dict[str, Any]
        if joint and model is not None:
            try:
                bt = rolling_backtest(store, joint, seq_len=seq_len, lam=lam)
            except Exception as exc:  # pragma: no cover - defensive
                bt = {"available": False, "note": f"backtest_failed: {exc}"}
        else:
            bt = {"available": False, "note": "no full-record params for joint backtest"}
        bt.setdefault("per_parameter", {})
        if bt.get("available"):
            bt["note"] += (
                " Single-series parameters are backtested separately over their "
                "observed span."
            )
        for p in out["single_series_params"]:
            res = _single_series_backtest(store, p, seq_len=seq_len, lam=lam)
            if res and res.get("available"):
                bt["per_parameter"].update(res.get("per_parameter", {}))
                bt["origins"] = max(int(bt.get("origins", 0)), int(res.get("origins", 0)))
                bt["available"] = True
        out["backtest"] = bt
    return out

