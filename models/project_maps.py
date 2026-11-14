"""Render model-projected heat maps as dependency-free SVG.

These are **model extrapolations** (Theil–Sen slope), never observations and never a
guaranteed future. Used by GET /imagery/projected?parameter=..&year=..
"""
from __future__ import annotations

import math

import numpy as np

# diverging palette: cool (blue) -> neutral -> warm (red)
_STOPS = [(59, 76, 192), (141, 176, 254), (221, 221, 221), (254, 173, 128), (204, 34, 34)]


def _lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def colormap(t: float) -> str:
    t = min(1.0, max(0.0, t))
    seg = t * (len(_STOPS) - 1)
    i = min(int(seg), len(_STOPS) - 2)
    return "#%02x%02x%02x" % _lerp(_STOPS[i], _STOPS[i + 1], seg - i)


def projected_field(store, parameter: str, slopes: dict[int, float],
                    last_date: str, year: int) -> np.ndarray:
    """Per-cell projected value from a linear Theil–Sen trend.

    ``slopes`` MUST be in *parameter units per month*. Callers holding a
    ``slope_per_decade`` value must divide by 120 for monthly data first (see
    ``api/routers/imagery.py``).

    The fitted line passes through (mean_time, mean_value). The projected value
    is therefore::

        mean(series) + slope * ((T-1 - mean_time) + months_ahead)

    where ``T-1`` is the last observed month and ``months_ahead`` reaches June of
    the target year. Anchoring at the mean *without* the ``T-1 - mean_time``
    offset (the previous behaviour) systematically misplaced the projection by
    half the record length — up to ~0.3 NDVI or tens of mm/month of rain here.
    """
    G = len(store["grid_lat"])
    arr = store[parameter]
    T = arr.shape[0]
    field = np.full(G, np.nan, dtype=np.float64)
    last_y, last_m = int(last_date[:4]), int(last_date[5:7])
    months_ahead = (year - last_y) * 12 + (6 - last_m)  # project to mid-year
    for cell in range(G):
        series = arr[:, cell]
        valid = np.isfinite(series)
        if not valid.any():
            continue
        mu = float(series[valid].mean())
        mean_time = float(np.flatnonzero(valid).mean())
        slope = float(slopes.get(cell, 0.0))  # per month
        field[cell] = mu + slope * ((T - 1 - mean_time) + months_ahead)
    return field


def svg_heatmap(lats, lons, values: np.ndarray, title: str, subtitle: str,
                width: int = 720, height: int = 420) -> str:
    v = np.asarray(values, dtype=np.float64).reshape(len(lats), len(lons))
    if np.isnan(v).all():
        v = np.zeros_like(v)  # nothing to show; render neutral grid
    vmin, vmax = np.nanmin(v), np.nanmax(v)
    if vmax - vmin < 1e-9:
        vmin, vmax = vmin - 1e-9, vmax + 1e-9
    v = np.nan_to_num(v, nan=(vmin + vmax) / 2.0)  # masked cells render neutral
    cw, ch = width / max(1, len(lons)), height / max(1, len(lats))
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height + 60}" role="img" aria-label="{title}">']
    parts.append(f'<rect width="{width}" height="{height + 60}" fill="#0f172a"/>')
    for i, lat in enumerate(lats):  # lats ordered N->S for display
        for j, lon in enumerate(lons):
            t = (v[i, j] - vmin) / (vmax - vmin)
            parts.append(f'<rect x="{j * cw:.1f}" y="{i * ch:.1f}" width="{cw + 0.5:.1f}" height="{ch + 0.5:.1f}" fill="{colormap(t)}"/>')
    parts.append(f'<text x="12" y="{height + 22}" fill="#e2e8f0" font-size="15" font-family="system-ui" font-weight="700">{title}</text>')
    parts.append(f'<text x="12" y="{height + 42}" fill="#94a3b8" font-size="11" font-family="system-ui">{subtitle}</text>')
    parts.append('</svg>')
    return "".join(parts)
