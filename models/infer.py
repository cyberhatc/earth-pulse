"""Model inference for one grid cell.

Priority: the RidgeRollout artifact trained on the *same kind of store* as the
one being queried (real NASA POWER vs synthetic demo), then the transparent
LinearTrendSeasonal fallback. Always returns p10/p50/p90 bands.

Using a synthetic-trained forecaster on the real POWER store produced absurd
projections (e.g. +11.9 °C over five years), so artifact selection is explicit:
never feed a real store to a model trained on the demo distribution.
"""
from __future__ import annotations

import json
import os
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
_artifacts = REPO_ROOT / "models" / "artifacts"
_synthetic_artifact = _artifacts / "forecaster.npz"
_real_artifacts = (
    _artifacts / "forecaster_real.npz",
    REPO_ROOT / "data" / "processed" / "forecaster_power_real.npz",
)
SEQ_LEN = 24


def _artifact_for(store: dict | None = None) -> Path:
    """Pick the forecaster trained on the same distribution as ``store``.

    ``EP_FORECAST_ARTIFACT`` always wins. Otherwise a real store tries the
    real-POWER artifacts first (and only falls back to the synthetic one when
    no real artifact exists); a synthetic store uses the synthetic artifact.
    """
    override = os.environ.get("EP_FORECAST_ARTIFACT")
    if override:
        candidate = Path(override).expanduser()
        if candidate.exists():
            return candidate
    meta = (store or {}).get("meta") or {}
    synthetic = bool(meta.get("synthetic", True))
    if not synthetic:
        for candidate in _real_artifacts:
            if candidate.exists():
                return candidate
    return _synthetic_artifact


def artifact_available(store: dict | None = None) -> bool:
    return _artifact_for(store).exists()


def _artifact_config(artifact: Path) -> tuple[list[str], int]:
    """Return (variable order, seq_len) used to train the artifact.

    The column order is load-bearing: ``RidgeRollout`` flattens each lag window
    column-wise, so features must be supplied in exactly the training order.
    Read the sidecar metadata written by ``models/train.py``; fall back to the
    canonical store order and default sequence length when it is absent.
    """
    variables = list(STORE_VARIABLES)
    seq_len = SEQ_LEN
    try:
        meta = json.loads((artifact.parent / "forecaster_meta.json").read_text())
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
    _BOUNDS = {"precipitation": (0.0, None), "ndvi": (0.0, 1.0),
                "humidity": (0.0, 100.0), "wind": (0.0, None),
                "solar_radiation": (0.0, None)}

    def _clip_series(ts, lo, hi):
        for key in ("mean", "lower", "upper"):
            arr = np.asarray(ts[key], dtype=float)
            if lo is not None:
                arr = np.maximum(arr, lo)
            if hi is not None:
                arr = np.minimum(arr, hi)
            ts[key] = arr.tolist()
        return ts

    artifact = _artifact_for(store)
    if artifact.exists():
        model = RidgeRollout.load(artifact)
        model_vars, seq_len = _artifact_config(artifact)
        dates, X = prepare_cell_matrix(store, cell, model_vars)
        fc = _forecast_with_ridge(model, X, model_vars, horizon_months, dates, seq_len)
        if requested != model_vars:
            missing = [v for v in requested if v not in fc["timeseries"]]
            if missing:
                raise KeyError(f"Requested variables absent from trained artifact: {missing}")
            fc["timeseries"] = {v: fc["timeseries"][v] for v in requested}
        fc["artifact"] = artifact.name
        for v, ts in fc["timeseries"].items():
            lo, hi = _BOUNDS.get(v, (None, None))
            _clip_series(ts, lo, hi)
        return fc
    dates, X = prepare_cell_matrix(store, cell, requested)
    fc = _forecast_with_baseline(X, requested, horizon_months, dates)
    fc["artifact"] = None
    for v, ts in fc["timeseries"].items():
        lo, hi = _BOUNDS.get(v, (None, None))
        _clip_series(ts, lo, hi)
    return fc
