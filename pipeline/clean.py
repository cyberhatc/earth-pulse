"""Cleaning utilities: alignment, missing data, standardisation.

NumPy-first so the demo works offline; xarray helpers are included for the real path.
"""
from __future__ import annotations

import numpy as np


def fill_missing_linear(series: np.ndarray) -> np.ndarray:
    """Linearly interpolate NaNs; edge NaNs filled with nearest valid value."""
    y = np.asarray(series, dtype=np.float64).copy()
    n = y.shape[0]
    idx = np.arange(n)
    mask = np.isfinite(y)
    if mask.all():
        return y
    if not mask.any():
        return np.zeros(n)
    y[~mask] = np.interp(idx[~mask], idx[mask], y[mask])
    return y


def monthly_climatology(dates: list[str], values: np.ndarray) -> np.ndarray:
    """Return (12,) climatological monthly means from valid values."""
    month = np.array([int(d.split("-")[1]) - 1 for d in dates])
    clim = np.full(12, np.nan)
    for m in range(12):
        sel = values[month == m]
        sel = sel[np.isfinite(sel)]
        if sel.size:
            clim[m] = sel.mean()
    # fill any empty months with nearest climatology value
    ok = np.isfinite(clim)
    if ok.any() and not ok.all():
        clim = np.interp(np.arange(12), np.where(ok)[0], clim[ok])
    return clim


def deseasonalize(dates: list[str], values: np.ndarray) -> np.ndarray:
    clim = monthly_climatology(dates, values)
    month = np.array([int(d.split("-")[1]) - 1 for d in dates])
    return values - clim[month]


def standardize(train: np.ndarray, full: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    mean = train.mean(axis=0)
    std = train.std(axis=0)
    std = np.where(std == 0, 1.0, std)
    return (train - mean) / std, (full - mean) / std, (mean, std)


def rolling_mean(x: np.ndarray, window: int) -> np.ndarray:
    c = np.cumsum(np.insert(np.nan_to_num(x), 0, 0.0))
    out = (c[window:] - c[:-window]) / window
    return np.concatenate([np.full(window - 1, np.nan), out])


def rolling_median(x: np.ndarray, window: int) -> np.ndarray:
    n = len(x)
    out = np.full(n, np.nan)
    half = window // 2
    for i in range(n):
        seg = x[max(0, i - half): i + half + 1]
        seg = seg[np.isfinite(seg)]
        if seg.size:
            out[i] = np.median(seg)
    return out


def rolling_mad(x: np.ndarray, window: int) -> np.ndarray:
    n = len(x)
    med = rolling_median(x, window)
    out = np.full(n, np.nan)
    half = window // 2
    for i in range(n):
        seg = x[max(0, i - half): i + half + 1]
        seg = seg[np.isfinite(seg)]
        if seg.size:
            out[i] = np.median(np.abs(seg - med[i]))
    return out
