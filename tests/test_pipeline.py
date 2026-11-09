"""Pipeline store generation + features tests."""
from __future__ import annotations

import numpy as np

from pipeline.export_store import VARIABLES, build_sample_arrays
from pipeline.build_features import time_features


def test_sample_store_shapes():
    arrays = build_sample_arrays()
    T = len(arrays["dates"])
    G = len(arrays["grid_lat"])
    assert T == 498, T          # 1985-01 .. 2026-06
    assert G == 240             # 10 lats x 24 lons
    for var in VARIABLES:
        assert arrays[var].shape == (T, G)
    # dates strictly increasing, YYYY-MM format
    assert list(arrays["dates"]) == sorted(arrays["dates"])
    assert all(len(d) == 7 and d[4] == '-' for d in arrays["dates"])


def test_sample_store_deterministic():
    a = build_sample_arrays()
    b = build_sample_arrays()
    np.testing.assert_allclose(a["temperature"], b["temperature"])


def test_time_features():
    dates = ["2000-01", "2000-07"]
    tf = time_features(dates)
    assert set(tf) == {"month_sin", "month_cos", "year_index", "decimal_year"}
    assert np.isclose(tf["month_sin"][0], 0.0, atol=1e-9)
    assert tf["year_index"][1] > tf["year_index"][0]


def test_temperature_trend_positive():
    # synthetic store must warm over time (it is the point of the demo)
    arrays = build_sample_arrays()
    t = np.arange(len(arrays["dates"]))
    per_cell = []
    for c in range(0, arrays["temperature"].shape[1], 17):
        per_cell.append(np.polyfit(t, arrays["temperature"][:, c], 1)[0])
    assert float(np.mean(per_cell)) > 0
