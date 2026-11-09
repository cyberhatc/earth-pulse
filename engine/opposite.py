"""Opposite Trend Detector.

Finds pairs of neighboring grid cells whose robust trends for the same parameter
move in opposite directions. A pair is 'strong' when both slopes are Mann–Kendall
significant; otherwise 'weak'.
"""
from __future__ import annotations

import numpy as np


def neighbor_offsets(radius: int = 1):
    """(di, dj) offsets for neighbors within Chebyshev radius on the lon/lat index grid."""
    offs = []
    for di in range(-radius, radius + 1):
        for dj in range(-radius, radius + 1):
            if di == 0 and dj == 0:
                continue
            offs.append((di, dj))
    return offs


def find_opposite_pairs(grid_lat: np.ndarray, grid_lon: np.ndarray, n_lats: int, n_lons: int,
                        trends: dict[int, dict], parameter: str = "ndvi",
                        radius: int = 1, min_abs_slope: float = 0.0,
                        require_significant_strong: bool = True,
                        max_pairs: int = 200) -> list[dict]:
    """trends: {cell_index: {parameter: {slope_per_decade, significant, ...}}}"""
    pairs = []
    for i_lat in range(n_lats):
        for i_lon in range(n_lons):
            a = i_lat * n_lons + i_lon
            ta = trends.get(a, {}).get(parameter)
            if not ta:
                continue
            for di, dj in neighbor_offsets(radius):
                j_lat, j_lon = i_lat + di, i_lon + dj
                if not (0 <= j_lat < n_lats and 0 <= j_lon < n_lons):
                    continue
                b = j_lat * n_lons + j_lon
                if b <= a:  # avoid duplicates
                    continue
                tb = trends.get(b, {}).get(parameter)
                if not tb:
                    continue
                sa, sb = ta["slope_per_decade"], tb["slope_per_decade"]
                if abs(sa) < min_abs_slope or abs(sb) < min_abs_slope:
                    continue
                if sa == 0 or sb == 0 or (sa > 0) == (sb > 0):
                    continue
                # Keep only pairs where at least one trend is significant (unless
                # explicitly disabled). "strong" requires BOTH slopes significant.
                both_significant = bool(ta["significant"] and tb["significant"])
                if require_significant_strong and not (ta["significant"] or tb["significant"]):
                    continue
                strength = "strong" if both_significant else "weak"
                pairs.append({
                    "parameter": parameter,
                    "cell_a": {"index": int(a), "lat": float(grid_lat[a]), "lon": float(grid_lon[a]),
                               "slope_per_decade": float(sa), "significant": bool(ta["significant"])},
                    "cell_b": {"index": int(b), "lat": float(grid_lat[b]), "lon": float(grid_lon[b]),
                               "slope_per_decade": float(sb), "significant": bool(tb["significant"])},
                    "strength": strength,
                    "magnitude": float(min(abs(sa), abs(sb))),
                })
    pairs.sort(key=lambda p: p["magnitude"], reverse=True)
    return pairs[:max_pairs]
