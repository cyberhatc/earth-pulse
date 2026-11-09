"""Model inference for one grid cell.

Priority: trained RidgeRollout artifact (models/artifacts/forecaster.npz)
→ transparent LinearTrendSeasonal fallback. Always returns p10/p50/p90 bands.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from models.forecast import (
    RidgeRollout,
    future_dates,
    linear_trend_seasonal_forecast,
)
from pipeline.build_features import prepare_cell_matrix
from pipeline.export_store import VARIABLES as STORE_VARIABLES

REPO_ROOT = Path(__file__).resolve().parent.parent
ARTIFACT = REPO_ROOT / "models" / "artifacts" / "forecaster.npz"
ARTIFACT_META = ARTIFACT.parent / "forecaster_meta.json"
SEQ_LEN = 24


def artifact_available() -> bool:
    return ARTIFACT.exists()


def _artifact_config() -> tuple[list[str], int]:
    """Return (variable order, seq_len) used to train the artifact.

    The column order is load-bearing: ``RidgeRollout`` flattens each lag window
    column-wise, so features must be supplied in exactly the training order.
    Read the sidecar metadata written by ``models/train.py``; fall back to the
    canonical store order and default sequence length when it is absent.
    """
    variables = list(STORE_VARIABLES)
    seq_len = SEQ_LEN
    try:
        meta = json.loads(ARTIFACT_META.read_text())
        meta_vars = meta.get("variables")
        if isinstance(meta_vars, list) and meta_vars and set(meta_vars) <= set(STORE_VARIABLES):
            variables = [str(v) for v in meta_vars]
        meta_seq = int(meta.get("seq_len", SEQ_LEN))
        if meta_seq > 0:
            seq_len = meta_seq
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        pass
    return variables, seq_len


def _forecast_with_ridge(model: RidgeRollout, X: np.ndarray, variables: list[str],
                         horizon: int, dates: list[str], seq_len: int = SEQ_LEN) -> dict:
    if X.shape[0] < seq_len:
        raise ValueError(f"Need at least {seq_len} months to seed the rollout; got {X.shape[0]}")
    init = X[-seq_len:]
    pred = model.rollout(init, horizon)  # (H, F)
    fdates = future_dates(dates[-1], horizon)
    out = {}
    for j, var in enumerate(variables):
        mean = pred[:, j]
        steps = np.arange(1, horizon + 1)
        base_std = model.resid_std[j] if model.resid_std is not None else X[:, j].std()
        spread = 1.645 * base_std * np.sqrt(steps)
        out[var] = {
            "mean": mean.tolist(),
            "lower": (mean - spread).tolist(),
            "upper": (mean + spread).tolist(),
        }
    return {"dates": fdates, "timeseries": out, "model": "ridge_rollout", "seq_len": seq_len}


def _forecast_with_baseline(X: np.ndarray, variables: list[str], horizon: int,
                            dates: list[str]) -> dict:
    out = {}
    fdates = future_dates(dates[-1], horizon)
    for j, var in enumerate(variables):
        res = linear_trend_seasonal_forecast(X[:, j], dates, horizon)
        out[var] = {"mean": res["mean"], "lower": res["lower"], "upper": res["upper"]}
    return {"dates": fdates, "timeseries": out, "model": "linear_trend_seasonal", "seq_len": SEQ_LEN}


def forecast_place(store, cell: int, horizon_months: int = 60,
                   variables: list[str] | None = None) -> dict:
    requested = list(variables) if variables else list(STORE_VARIABLES)
    if artifact_available():
        model = RidgeRollout.load(ARTIFACT)
        model_vars, seq_len = _artifact_config()
        # Prepare the model's training columns in the model's training order,
        # regardless of the order/subset the caller asked for.
        dates, X = prepare_cell_matrix(store, cell, model_vars)
        fc = _forecast_with_ridge(model, X, model_vars, horizon_months, dates, seq_len)
        if requested != model_vars:
            missing = [v for v in requested if v not in fc["timeseries"]]
            if missing:
                raise KeyError(f"Requested variables absent from trained artifact: {missing}")
            fc["timeseries"] = {v: fc["timeseries"][v] for v in requested}
        return fc
    dates, X = prepare_cell_matrix(store, cell, requested)
    return _forecast_with_baseline(X, requested, horizon_months, dates)
