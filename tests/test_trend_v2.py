"""Phase 2 statistics cross-checks: Sen slope vs scipy, MK vs pymannkendall,
deseasonalisation, TFPW, FDR — synthetic series with known properties."""
from __future__ import annotations

import numpy as np
import pytest
from scipy import stats

from engine.preprocess import deseasonalise, annual_means, month_index
from engine.trend import sen_slope, mann_kendall, tfpw_mann_kendall, seasonal_mann_kendall
from engine.field_significance import benjamini_hochberg

pmk = pytest.importorskip("pymannkendall")


def _series(slope: float, n: int = 300, noise: float = 1.0, seed: int = 42) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return np.arange(n) * slope + rng.normal(0, noise, n)


def test_sen_slope_matches_scipy_theilslopes():
    y = _series(0.03)
    ours = sen_slope(y)["slope"]
    scipy_slope = stats.theilslopes(y).slope
    assert ours == pytest.approx(scipy_slope, abs=1e-6)


def test_mann_kendall_matches_pymannkendall():
    y = _series(0.03)
    ref = pmk.original_test(y)
    ours = mann_kendall(y)
    assert ours["S"] == pytest.approx(ref.s)
    assert ours["tau"] == pytest.approx(ref.Tau, abs=1e-9)
    assert ours["z"] == pytest.approx(ref.z, abs=1e-6)
    assert ours["p_value"] < 1e-10  # both agree the trend is highly significant


def test_sen_slope_on_annual_is_unbiased_for_known_trend():
    rng = np.random.default_rng(11)
    n_years = 46
    annual = np.arange(n_years) * 0.08 + rng.normal(0, 0.3, n_years)  # +0.8 degC/decade
    out = sen_slope(annual)
    assert out["slope"] * 10 == pytest.approx(0.8, abs=0.05)
    assert out["ci_low"] * 10 < out["slope"] * 10 < out["ci_high"] * 10


def test_deseasonalise_removes_seasonal_cycle():
    rng = np.random.default_rng(5)
    t = 360
    months = np.tile(np.arange(1, 13), 30)
    yy = 15 + 10 * np.cos(2 * np.pi * (months - 7) / 12) + rng.normal(0, 0.3, t)  # no trend
    years = 2000 + np.arange(t) // 12
    de = deseasonalise(yy, months, years, baseline=(2000, 2029))
    resid_clim = [float(de[months == m].mean()) for m in range(1, 13)]
    assert max(abs(v) for v in resid_clim) < 0.5


def test_annual_means_min_months_rule():
    years = np.array([2001] * 9 + [2002] * 10)
    y = np.concatenate([np.arange(9) + 5.0, np.arange(10) + 100.0])
    yrs, means = annual_means(y, years, min_months=10)
    assert yrs.tolist() == [2001, 2002]
    assert np.isnan(means[0])  # only 9 months -> excluded
    assert means[1] == pytest.approx(np.mean(np.arange(10) + 100.0))


def test_tfpw_corrects_spurious_significance_from_autocorrelation():
    p = 0.7
    rng = np.random.default_rng(42)
    e = rng.normal(0, 1, 400)
    x = np.zeros(400)
    for i in range(1, 400):
        x[i] = p * x[i - 1] + e[i]
    raw = mann_kendall(x)
    corrected = tfpw_mann_kendall(x)
    assert corrected["autocorr_corrected"] is True
    assert corrected["lag1_autocorr"] == pytest.approx(0.7, abs=0.15)
    assert corrected["p_value"] > raw["p_value"]  # TFPW is more conservative under AR(1)


def test_seasonal_mk_does_not_flag_pure_seasonal_cycle():
    rng = np.random.default_rng(9)
    t = 480
    months = np.tile(np.arange(1, 13), 40)
    yy = 20 + 12 * np.sin(2 * np.pi * months / 12) + rng.normal(0, 0.4, t)
    out = seasonal_mann_kendall(yy, months)
    assert out["significant"] is False


def test_benjamini_hochberg_known_case():
    # textbook example (Benjamini & Hochberg 1995, table 1)
    p = np.array([0.001, 0.008, 0.039, 0.041, 0.042, 0.06, 0.074, 0.205])
    adj, sig = benjamini_hochberg(p, q=0.05)
    # ranked adj: 0.008, 0.032, 0.0759, 0.0759, 0.0759, 0.0889, 0.1034, 0.205... clip matches 0.008,0.032,0.0759...
    assert sig[:2].all()          # the two tiny p-values survive FDR
    assert not sig[2:].any()      # larger ones do not
    assert adj[0] == pytest.approx(0.008)
    assert list(adj.argsort().argsort()) == list(range(8))  # monotone, permutation-preserving


def test_mann_kendall_insufficient_data():
    out = mann_kendall(np.arange(5, dtype=float))
    assert out["significant"] is False
    assert out["trend"] == "insufficient data"


def test_min_annual_n_enforced():
    out = tfpw_mann_kendall(np.arange(8, dtype=float) * 0.5)
    assert out["trend"] == "insufficient data"
