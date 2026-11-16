"""Deseasonalisation and aggregation helpers for trend analysis.

Hard rules (honesty): no filling of leading/trailing gaps; interior linear
interpolation only for chart display; annual means require a minimum number of
finite months per year; baseline climatology configurable.
"""
from __future__ import annotations

import numpy as np

DEFAULT_BASELINE = (1991, 2020)
DEFAULT_MIN_MONTHS = 10


def month_index(dates: list[str]) -> np.ndarray:
    """Month number (1-12) for each 'YYYY-MM' label; invalid labels -> -1."""
    out = np.full(len(dates), -1, dtype=np.int64)
    for i, d in enumerate(dates):
        try:
            out[i] = int(str(d)[5:7])
        except ValueError:
            out[i] = -1
    return out


def year_index(dates: list[str]) -> np.ndarray:
    out = np.full(len(dates), -1, dtype=np.int64)
    for i, d in enumerate(dates):
        try:
            out[i] = int(str(d)[:4])
        except ValueError:
            out[i] = -1
    return out


def deseasonalise(y: np.ndarray, months: np.ndarray, years: np.ndarray,
                  baseline: tuple[int, int] | None = None) -> np.ndarray:
    """Remove the monthly climatology. Climatology years need >= 10 finite months
    in the baseline window; months absent from the baseline are left unchanged
    at their raw value (never invented)."""
    y = np.asarray(y, dtype=np.float64)
    months = np.asarray(months)
    years = np.asarray(years)
    base = baseline or DEFAULT_BASELINE
    out = y.copy()
    for m in range(1, 13):
        idx = np.where(months == m)[0]
        if idx.size == 0:
            continue
        base_idx = idx[(years[idx] >= base[0]) & (years[idx] <= base[1])]
        vals = y[base_idx]
        vals = vals[np.isfinite(vals)]
        if vals.size < 2:
            continue  # no usable climatology for this month — keep raw values
        clim = float(np.mean(vals))
        out[idx] = y[idx] - clim
    return out


def annual_means(y: np.ndarray, years: np.ndarray, min_months: int = DEFAULT_MIN_MONTHS) -> tuple[np.ndarray, np.ndarray]:
    """Annual means with a minimum-months-per-year rule. Returns (years_out, means)."""
    y = np.asarray(y, dtype=np.float64)
    years = np.asarray(years)
    ys = np.unique(years[years > 0])
    means = np.full(ys.size, np.nan)
    for i, yr in enumerate(ys):
        vals = y[years == yr]
        finite = vals[np.isfinite(vals)]
        if finite.size >= min_months:
            means[i] = float(finite.mean())
    return ys, means


def lag1_autocorr(y: np.ndarray) -> float:
    """Lag-1 autocorrelation over consecutive finite pairs; NaN -> 0.0."""
    y = np.asarray(y, dtype=np.float64)
    if y.size < 4:
        return 0.0
    a = y[:-1]
    b = y[1:]
    mask = np.isfinite(a) & np.isfinite(b)
    if mask.sum() < 8:
        return 0.0
    a, b = a[mask], b[mask]
    if a.std() == 0.0 or b.std() == 0.0:
        return 0.0
    return float(np.corrcoef(a, b)[0, 1])


def interpolate_interior(y: np.ndarray) -> np.ndarray:
    """Interior linear interpolation for chart display ONLY (leading/trailing
    gaps are never filled)."""
    y = np.asarray(y, dtype=np.float64).copy()
    finite = np.isfinite(y)
    idx = np.where(finite)[0]
    if idx.size < 2:
        return np.full_like(y, np.nan)
    first, last = idx[0], idx[-1]
    y[first:last + 1] = np.interp(np.arange(first, last + 1), idx, y[idx])
    return y
