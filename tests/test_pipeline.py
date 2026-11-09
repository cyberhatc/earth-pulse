"""Pipeline store generation + features tests.

Generates the sample store into a pytest tmp dir so the repo artifacts are not
touched, then asserts the shape/format contract every downstream module relies on.
"""
from __future__ import annotations

import numpy as np

from pipeline.export_store import (
    VARIABLES,
    build_sample_arrays,
    generate_sample,
    load_store,
)
from pipeline.build_features import time_features

EXPECTED_MONTHS = 498        # 1985-01 .. 2026-06
EXPECTED_CELLS = 240         # 10 lats x 24 lons
EXPECTED_PARAMETERS = 8


def test_sample_store_generates_to_tmp_path(tmp_path):
    out = generate_sample(tmp_path / "earth_pulse_sample.npz")
    assert out.exists() and out.stat().st_size > 0

    with np.load(out, allow_pickle=False) as z:
        files = set(z.files)
        T = len(z["dates"])
        G = len(z["grid_lat"])

        assert T == EXPECTED_MONTHS, T
        assert G == EXPECTED_CELLS, G
        assert len(z["grid_lon"]) == G

        # 8 named parameters, all (T, G)
        assert len(VARIABLES) == EXPECTED_PARAMETERS
        for var in VARIABLES:
            assert var in files, f"missing parameter array {var}"
            assert z[var].shape == (T, G), f"{var}: {z[var].shape}"
            assert np.all(np.isfinite(z[var])), f"{var}: non-finite values"

        # dates strictly increasing, YYYY-MM format
        dates = [str(d) for d in z["dates"]]
        assert dates == sorted(dates)
        assert len(set(dates)) == len(dates), "duplicate dates"
        assert all(len(d) == 7 and d[4] == "-" for d in dates)
        assert dates[0] == "1985-01" and dates[-1] == "2026-06"

        assert "meta_json" in files


def test_sample_store_round_trips(tmp_path):
    out = generate_sample(tmp_path / "store.npz")
    store = load_store(out)
    assert store["meta"]["synthetic"] is True
    assert store["meta"]["n_months"] == EXPECTED_MONTHS
    assert store["temperature"].shape == (EXPECTED_MONTHS, EXPECTED_CELLS)


def test_sample_store_deterministic():
    a = build_sample_arrays()
    b = build_sample_arrays()
    np.testing.assert_allclose(a["temperature"], b["temperature"])
    np.testing.assert_allclose(a["precipitation"], b["precipitation"])


def test_time_features():
    dates = ["2000-01", "2000-07"]
    tf = time_features(dates)
    assert set(tf) == {"month_sin", "month_cos", "year_index", "decimal_year"}
    np.testing.assert_allclose(tf["month_sin"] ** 2 + tf["month_cos"] ** 2, np.ones(len(dates)), atol=1e-9)
    assert tf["year_index"][1] > tf["year_index"][0]


def test_temperature_trend_positive():
    # synthetic store must warm over time (it is the point of the demo)
    arrays = build_sample_arrays()
    t = np.arange(len(arrays["dates"]))
    per_cell = []
    for c in range(0, arrays["temperature"].shape[1], 17):
        per_cell.append(np.polyfit(t, arrays["temperature"][:, c], 1)[0])
    assert float(np.mean(per_cell)) > 0
