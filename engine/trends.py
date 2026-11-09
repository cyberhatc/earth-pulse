"""Robust trend detection: Theil–Sen slope + Mann–Kendall significance.

Self-contained (NumPy/SciPy only) — no pymannkendall dependency required.
"""
from __future__ import annotations

import math

import numpy as np
from scipy import stats


def theil_sen_slope(y: np.ndarray) -> tuple[float, float]:
    """Return (slope per index, intercept) using the median of pairwise slopes.

    Theil–Sen is O(n²) in time and memory because the exact median needs every
    pairwise slope. For the demo series (n = 498 months) that is ~124k slopes
    (~1 MB), which is fine. Do not call this on multi-million-point series;
    downsample or aggregate first.
    """
    y = np.asarray(y, dtype=np.float64)
    n = y.size
    mask = np.isfinite(y)
    finite = y[mask]
    if finite.size < 3:
        # No usable trend: report a flat slope and the mean of whatever is valid.
        return 0.0, float(finite.mean()) if finite.size else 0.0
    x = np.arange(n, dtype=np.float64)[mask]
    yv = finite
    m = yv.size
    slopes = []
    # Pairwise slopes between every pair of valid observations. Keeping the
    # original x indices makes this correct when NaNs are present (irregular
    # spacing) — do not replace x with a compacted arange.
    for i in range(m):
        d = yv[i + 1:] - yv[i]
        denom = x[i + 1:] - x[i]
        slopes.append(d / denom)
    slope = float(np.median(np.concatenate(slopes)))
    intercept = float(np.median(yv - slope * x))
    return slope, intercept


def mann_kendall(y: np.ndarray, alpha: float = 0.05) -> dict:
    """Mann–Kendall trend test. Returns dict with S, z, p_value, trend, significant."""
    y = np.asarray(y, dtype=np.float64)
    y = y[np.isfinite(y)]
    n = y.size
    if n < 8:
        return {"S": 0, "z": 0.0, "p_value": 1.0, "trend": "insufficient data", "significant": False, "n": n}
    s = 0
    for i in range(n - 1):
        s += np.sum(np.sign(y[i + 1:] - y[i]))
    # tie correction
    _, counts = np.unique(y, return_counts=True)
    tie_sum = np.sum(counts * (counts - 1) * (2 * counts + 5))
    var_s = (n * (n - 1) * (2 * n + 5) - tie_sum) / 18.0
    if var_s <= 0:
        return {"S": int(s), "z": 0.0, "p_value": 1.0, "trend": "no trend", "significant": False, "n": n}
    if s > 0:
        z = (s - 1) / math.sqrt(var_s)
    elif s < 0:
        z = (s + 1) / math.sqrt(var_s)
    else:
        z = 0.0
    p = 2.0 * (1.0 - stats.norm.cdf(abs(z)))
    significant = p < alpha
    trend = "no trend"
    if significant:
        trend = "increasing" if z > 0 else "decreasing"
    return {"S": int(s), "z": float(z), "p_value": float(p), "trend": trend, "significant": bool(significant), "n": int(n)}


def trend_per_decade(y: np.ndarray, periods_per_decade: float) -> float:
    slope, _ = theil_sen_slope(y)
    return slope * periods_per_decade


def analyse_series(y: np.ndarray, periods_per_decade: float = 120.0) -> dict:
    slope_pd = trend_per_decade(y, periods_per_decade)
    mk = mann_kendall(y)
    direction = mk["trend"]
    return {
        "slope_per_decade": float(slope_pd),
        "p_value": mk["p_value"],
        "significant": mk["significant"],
        "direction": direction,
        "S": mk["S"],
        "z": mk["z"],
        "n": mk["n"],
    }
