"""Opposite Trend Detector tests on a hand-built 2x2 grid."""
from __future__ import annotations

import numpy as np

from engine.opposite import find_opposite_pairs


def _trends(slopes, sigs):
    rec = {}
    for i, (s, g) in enumerate(zip(slopes, sigs)):
        rec[i] = {"ndvi": {"slope_per_decade": s, "significant": g,
                           "p_value": 0.01 if g else 0.5, "direction": "increasing" if s > 0 else "decreasing",
                           "n": 100}}
    return rec


def test_opposite_pair_detected():
    lats = np.array([0.0, 15.0])   # 1 x 2 grid
    lons = np.array([0.0, 15.0])
    grid_lat = np.array([0.0, 0.0, 15.0, 15.0])
    grid_lon = np.array([0.0, 15.0, 0.0, 15.0])
    # west cell browning (-), east cell greening (+)
    trends = _trends([-1.0, 1.0, -0.9, 0.9], [True, True, True, True])
    pairs = find_opposite_pairs(grid_lat, grid_lon, n_lats=2, n_lons=2, trends=trends,
                                parameter="ndvi", radius=1)
    assert any((p["cell_a"]["index"], p["cell_b"]["index"]) == (0, 1) for p in pairs)
    p01 = next(p for p in pairs if (p["cell_a"]["index"], p["cell_b"]["index"]) == (0, 1))
    assert p01["strength"] == "strong"


def test_same_sign_not_flagged():
    grid_lat = np.array([0.0, 0.0, 15.0, 15.0])
    grid_lon = np.array([0.0, 15.0, 0.0, 15.0])
    trends = _trends([1.0, 1.2, 0.8, 0.9], [True] * 4)
    pairs = find_opposite_pairs(grid_lat, grid_lon, 2, 2, trends, "ndvi", radius=1)
    assert pairs == []


def test_weak_when_not_significant():
    grid_lat = np.array([0.0, 0.0, 15.0, 15.0])
    grid_lon = np.array([0.0, 15.0, 0.0, 15.0])
    trends = _trends([-1.0, 1.0, 0.5, 0.6], [True, False, False, False])
    pairs = find_opposite_pairs(grid_lat, grid_lon, 2, 2, trends, "ndvi", radius=1)
    pair01 = next(p for p in pairs if (p["cell_a"]["index"], p["cell_b"]["index"]) == (0, 1))
    assert pair01["strength"] == "weak"
