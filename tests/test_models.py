"""Model-level tests: forecasting shapes, bands, dates."""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from models.forecast import RidgeRollout, make_windows, future_dates
from models.backtest import backtest_cell
from models.infer import forecast_place

ROOT = Path(__file__).resolve().parent.parent
SAMPLE = ROOT / "data" / "samples" / "earth_pulse_sample.npz"


def test_future_dates_sequence():
    fut = future_dates("2026-06", 15)
    assert fut[0] == "2026-07"
    assert fut[6] == "2027-01"
    assert fut[-1] == "2027-09"
    assert len(fut) == 15


def test_make_windows_shapes():
    X = np.arange(120.0).reshape(60, 2)
    xs, ys = make_windows(X, 12)
    assert xs.shape == (48, 24)
    assert ys.shape == (48, 2)


def test_ridge_rollout_band_ordering():
    rng = np.random.default_rng(0)
    n, F = 240, 3
    base = np.sin(np.linspace(0, 8 * np.pi, n))[:, None]
    X = base * np.array([[1.0, 2.0, 0.5]]) + rng.normal(0, 0.05, (n, F)) + np.linspace(0, 1, n)[:, None] * 0.5
    xs, ys = make_windows(X, 12)
    model = RidgeRollout(lam=1e-2).fit(xs, ys)
    pred = model.rollout(X[-12:], 12)
    assert pred.shape == (12, F)
    assert np.all(np.isfinite(pred))


def test_backtest_cell_runs():
    rng = np.random.default_rng(0)
    n, F = 120, 2
    X = np.column_stack([np.linspace(0, 1, n) + rng.normal(0, 0.05, n),
                         np.sin(np.linspace(0, 6, n)) + rng.normal(0, 0.05, n)])
    res = backtest_cell(X, ["a", "b"], seq_len=12, horizon=12)
    assert "per_parameter" in res
    assert set(res["per_parameter"]) == {"a", "b"}
    assert res["per_parameter"]["a"]["rmse"] >= 0


@pytest.fixture(scope="module")
def store():
    if not SAMPLE.exists():
        pytest.skip("sample store missing — run `make sample-data`")
    from pipeline.export_store import load_store
    return load_store(SAMPLE)


@pytest.mark.parametrize("horizon", [12, 60])
def test_forecast_place_contract(store, horizon):
    fc = forecast_place(store, cell=134, horizon_months=horizon)

    # exactly horizon_months future dates, strictly increasing, after the last observed month
    dates = fc["dates"]
    assert len(dates) == horizon
    assert dates == sorted(dates) and len(set(dates)) == horizon
    assert dates[0] == "2026-07"
    assert all(d > str(store["dates"][-1]) for d in dates)

    # all 8 parameters present, each with horizon values and ordered bands
    assert len(fc["timeseries"]) == 8
    for name, series in fc["timeseries"].items():
        assert len(series["mean"]) == horizon, f"{name}: horizon mismatch"
        assert len(series["lower"]) == horizon
        assert len(series["upper"]) == horizon
        for lo, mean, hi in zip(series["lower"], series["mean"], series["upper"]):
            assert np.isfinite([lo, mean, hi]).all(), f"{name}: non-finite band"
            assert lo <= mean <= hi, f"{name}: lower <= mean <= upper violated"

    assert fc["model"] in ("ridge_rollout", "linear_trend_seasonal")
