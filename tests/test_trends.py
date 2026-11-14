"""Trend engine correctness tests (synthetic, seeded)."""
from __future__ import annotations

import numpy as np

from engine.trends import theil_sen_slope, mann_kendall, analyse_series


def _series_with_trend(slope: float, n: int = 360, noise: float = 0.5, seed: int = 1) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return np.arange(n) * slope + rng.normal(0, noise, n)


def test_theil_sen_detects_positive_slope():
    y = _series_with_trend(0.05, noise=0.1)
    slope, _ = theil_sen_slope(y)
    assert slope > 0.03, f"expected positive slope, got {slope}"


def test_theil_sen_detects_negative_slope():
    y = _series_with_trend(-0.05, noise=0.1)
    slope, _ = theil_sen_slope(y)
    assert slope < -0.03


def test_mann_kendall_significant_uptrend():
    y = _series_with_trend(0.05, noise=0.3)
    mk = mann_kendall(y)
    assert mk["significant"] is True
    assert mk["trend"] == "increasing"
    assert 0.0 <= mk["p_value"] < 0.05


def test_mann_kendall_flat_series_not_significant():
    rng = np.random.default_rng(7)
    y = rng.normal(0, 0.5, 400)
    mk = mann_kendall(y)
    assert mk["significant"] is False
    assert mk["p_value"] >= 0.05


def test_analyse_series_units():
    y = _series_with_trend(0.01, n=240, noise=0.05)  # +0.01/month -> +1.2/decade
    res = analyse_series(y, periods_per_decade=120.0)
    assert abs(res["slope_per_decade"] - 1.2) < 0.3


def test_robust_to_outliers():
    rng = np.random.default_rng(3)
    y = np.arange(200) * 0.02 + rng.normal(0, 0.5, 200)
    y[::37] += 25.0  # gross outliers
    mk = mann_kendall(y)
    assert mk["trend"] == "increasing"
