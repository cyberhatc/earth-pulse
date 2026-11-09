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
    ridge_bands,
)
from pipeline.build_features import prepare_cell_matrix

REPO_ROOT = Path(__file__).resolve().parent.parent
ARTIFACT = REPO_ROOT / "models" / "artifacts" / "forecaster.npz"
SEQ_LEN = 24


def artifact_available() -> bool:
    return ARTIFACT.exists()


def _forecast_with_ridge(model: RidgeRollout, X: np.ndarray, variables: list[str],
                         horizon: int, dates: list[str]) -> dict:
    init = X[-SEQ_LEN:]
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
    return {"dates": fdates, "timeseries": out, "model": "ridge_rollout", "seq_len": SEQ_LEN}


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
    variables = variables or ["temperature", "precipitation", "ndvi", "sst", "sea_level", "humidity", "wind", "solar_radiation"]
    dates, X = prepare_cell_matrix(store, cell, variables)
    if artifact_available():
        model = RidgeRollout.load(ARTIFACT)
        return _forecast_with_ridge(model, X, variables, horizon_months, dates)
    return _forecast_with_baseline(X, variables, horizon_months, dates)
