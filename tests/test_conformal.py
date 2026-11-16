"""Conformal calibration tests (Phase 4): coverage must land near nominal."""
from __future__ import annotations

import numpy as np
import pytest

from models.conformal import (
    fit_absolute_residual,
    empirical_coverage,
    store_identity,
    residuals_for,
)


def _heteroscedastic_residuals(n=400, seed=0):
    """Synthetic residuals whose scale grows with horizon."""
    rng = np.random.default_rng(seed)
    by_h = {}
    for h in range(1, 61):
        sigma = 0.2 + 0.05 * h
        by_h[h] = rng.normal(0.0, sigma, n)
    return by_h


def test_fit_returns_ascending_widths():
    by_h = _heteroscedastic_residuals()
    w50 = fit_absolute_residual(by_h, 0.5)
    w90 = fit_absolute_residual(by_h, 0.9)
    assert w50 and w90
    h_sorted = sorted(w50)
    assert all(w50[h] <= w90[h] for h in h_sorted)
    # heteroscedastic noise: later horizons should need wider intervals
    widths = [w50[h] for h in h_sorted]
    assert widths[-1] > widths[0]


def test_coverage_within_threshold_of_nominal():
    rng_train = _heteroscedastic_residuals(n=1500, seed=1)
    rng_test = _heteroscedastic_residuals(n=500, seed=2)
    for level in (0.5, 0.8, 0.9):
        widths = fit_absolute_residual(rng_train, level)
        cov = empirical_coverage(rng_test, widths)
        assert abs(cov - level) < 0.05


def test_insufficient_data_returns_empty():
    by_h = {1: np.array([0.1, 0.2])}
    assert fit_absolute_residual(by_h, 0.8) == {}


def test_store_identity_stable_and_discriminating():
    m1 = {"provenance": "A", "time_range": ["1981-01", "2026-10"], "n_months": 550,
          "grid": {"n_cells": 10368, "resolution_deg": 2.5}}
    m2 = {"provenance": "A", "time_range": ["1981-01", "2026-10"], "n_months": 550,
          "grid": {"n_cells": 10368, "resolution_deg": 2.5}}
    m3 = {"provenance": "B", "time_range": ["1981-01", "2026-10"], "n_months": 550,
          "grid": {"n_cells": 10368, "resolution_deg": 2.5}}
    assert store_identity(m1) == store_identity(m2)
    assert store_identity(m1) != store_identity(m3)
