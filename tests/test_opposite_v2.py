"""Opposite Trend Detector v2 tests — FDR gating, effect size, dateline wrap,
patch merging, case files, null model."""
from __future__ import annotations

import numpy as np

from engine.opposite_v2 import (
    neighbor_pairs,
    find_patches,
    find_opposite_v2,
    null_model_check,
    min_effect_from_config,
    case_file,
)


def _rec(slope, sig=True, fdr=True, p=0.01, ci=None):
    return {
        "slope_per_decade": slope,
        "significant": sig,
        "significant_fdr": fdr,
        "significant_raw": sig,
        "p_value": p,
        "p_value_fdr": p * 2,
        "ci_low": ci[0] if ci else slope - 0.1,
        "ci_high": ci[1] if ci else slope + 0.1,
        "n": 46,
    }


def _grid(n_lats=3, n_lons=8):
    lats = np.array([60.0, 45.0, 0.0])[:n_lats]
    lons = np.arange(n_lons) * 2.5 - 178.75
    grid_lat = np.repeat(lats, n_lons)
    grid_lon = np.tile(lons, n_lats)
    return grid_lat, grid_lon, n_lats, n_lons


def _build_trends(assignments):
    """assignments: {cell_index: (slope, fdr_sig)} -> nested trends dict"""
    trends = {}
    for c, (slope, fdr) in assignments.items():
        trends[str(c)] = {"precipitation": _rec(slope, sig=True, fdr=fdr)}
    return trends


def test_dateline_wrap_finds_pair():
    grid_lat, grid_lon, NL, NO = _grid(3, 8)
    # increasing cell at (row 1, col 7) and decreasing cell at (row 1, col 0) — dateline neighbours
    inc = 1 * NO + 7
    dec = 1 * NO + 0
    trends = _build_trends({inc: (2.0, True), dec: (-2.0, True)})
    out = find_opposite_v2(grid_lat, grid_lon, NL, NO, trends, "precipitation",
                           min_effect_size=0.5, dates=["2000-01", "2020-12"])
    pairs = out["pairs"]
    assert pairs, "expected a pair across the dateline"
    idxs = {pairs[0]["cell_a"]["index"], pairs[0]["cell_b"]["index"]}
    assert idxs == {inc, dec}


def test_both_must_be_fdr_significant():
    grid_lat, grid_lon, NL, NO = _grid(3, 8)
    inc = 1 * NO + 6
    dec = 1 * NO + 7
    trends = _build_trends({inc: (2.0, True), dec: (-2.0, False)})
    out = find_opposite_v2(grid_lat, grid_lon, NL, NO, trends, "precipitation",
                           min_effect_size=0.5)
    assert out["pairs"] == []


def test_min_effect_size_filters():
    grid_lat, grid_lon, NL, NO = _grid(3, 8)
    inc = 1 * NO + 6
    dec = 1 * NO + 7
    trends = _build_trends({inc: (2.0, True), dec: (-0.1, True)})
    out = find_opposite_v2(grid_lat, grid_lon, NL, NO, trends, "precipitation",
                           min_effect_size=0.5)
    assert out["pairs"] == []


def test_patches_merge_and_rank():
    grid_lat, grid_lon, NL, NO = _grid(3, 8)
    assignments = {}
    # 2-cell increasing patch (cols 4-5, row 1) vs 2-cell decreasing patch (cols 6-7, row 1)
    for col in (4, 5):
        assignments[1 * NO + col] = (2.0, True)
    for col in (6, 7):
        assignments[1 * NO + col] = (-2.0, True)
    trends = _build_trends(assignments)
    labels = np.zeros((NL, NO), dtype=np.int8)
    elig = np.zeros((NL, NO), dtype=bool)
    for c, (s, fdr) in assignments.items():
        labels[c // NO, c % NO] = 1 if s > 0 else -1
        elig[c // NO, c % NO] = fdr
    patches = find_patches(labels, elig)
    assert len(patches) == 2
    areas = sorted(p["area_cells"] for p in patches)
    assert areas == [2, 2]
    out = find_opposite_v2(grid_lat, grid_lon, NL, NO, trends, "precipitation",
                           min_effect_size=0.5, dates=["1985-01", "2026-06"])
    assert out["pairs"], "expected patches to pair"
    assert out["pairs"][0]["rank_score"] > 0
    cf = out["pairs"][0]["case_file"]
    assert cf["variables"] == ["precipitation"]
    assert cf["fdr_significant"]["cell_a"] and cf["fdr_significant"]["cell_b"]
    assert cf["hypotheses"]
    assert "candidate" in cf["hypotheses_label"].lower()


def test_case_file_fields():
    grid_lat, grid_lon, NL, NO = _grid(2, 8)
    inc = 0 * NO + 2
    dec = 0 * NO + 3
    trends = _build_trends({inc: (1.5, True), dec: (-1.5, True)})
    out = find_opposite_v2(grid_lat, grid_lon, 2, NO, trends, "precipitation",
                           min_effect_size=0.5, dates=["1981-01", "2026-10"])
    cf = out["pairs"][0]["case_file"]
    assert cf["slopes_per_decade"]["cell_a"] > 0 and cf["slopes_per_decade"]["cell_b"] < 0
    assert cf["slope_ci_per_decade"]["cell_a"][0] < cf["slope_ci_per_decade"]["cell_a"][1]
    assert set(cf["p_values"]) == {"cell_a", "cell_b"}
    assert cf["coverage"]["cell_a"]["time_range"] == ["1981-01", "2026-10"]
    assert cf["hypotheses_label"]


def test_null_model_stats_sane():
    grid_lat, grid_lon, NL, NO = _grid(3, 8)
    rng = np.random.default_rng(7)
    recs = {c: _rec(float(rng.normal(0, 2)), sig=True, fdr=bool(rng.random() < 0.5)) for c in range(NL * NO)}
    null = null_model_check(recs, NL, NO, 1, 0.5, n_perm=50, seed=1)
    assert null["n_perm"] == 50
    assert 0.0 <= null["p_value"] <= 1.0
    assert null["expected_pairs"] >= 0.0


def test_min_effect_from_config_defaults():
    cfg = min_effect_from_config()
    assert "temperature" in cfg and "default" in cfg
