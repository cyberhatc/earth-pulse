"""Shared machinery for the real-data sources (cache, retry, regridding)."""
from __future__ import annotations

import os
import time
import urllib.request
from pathlib import Path

import numpy as np
from scipy.ndimage import distance_transform_edt, map_coordinates

REPO_ROOT = Path(__file__).resolve().parents[2]
CACHE_DIR = REPO_ROOT / "data" / "cache" / "realstore"

# 2.5 deg global grid (GPCP native) — lats ascending, lons ascending in [-180, 180)
TARGET_LATS = np.arange(-88.75, 89.0, 2.5)
TARGET_LONS = np.arange(-178.75, 179.0, 2.5)


def target_grid() -> tuple[np.ndarray, np.ndarray]:
    return TARGET_LATS.copy(), TARGET_LONS.copy()


def cache_path(name: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return CACHE_DIR / name


def cached_download(url: str, name: str, ttl_seconds: int | None = None,
                    retries: int = 4, timeout: int = 300) -> Path:
    """Download ``url`` to the cache if absent/expired. Retries with backoff."""
    fp = cache_path(name)
    ttl = ttl_seconds if ttl_seconds is not None else int(os.environ.get("EP_CACHE_TTL", "86400"))
    if fp.exists() and (ttl <= 0 or time.time() - fp.stat().st_mtime < ttl):
        return fp
    last_exc: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "earth-pulse/0.3 (+https://github.com/cyberhatc/earth-pulse)"}
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp, open(fp, "wb") as out:
                while True:
                    chunk = resp.read(1 << 20)
                    if not chunk:
                        break
                    out.write(chunk)
            return fp
        except Exception as exc:  # noqa: BLE001 — retried, then reported
            last_exc = exc
            time.sleep(min(2 ** attempt * 5, 60))
    raise RuntimeError(f"download failed after {retries} attempts: {url}: {last_exc}")


def normalise_lon(lons: np.ndarray, field: np.ndarray, lon_axis: int = -1) -> tuple[np.ndarray, np.ndarray]:
    """Convert 0..360 lons to -180..180 and sort ascending (field rolled to match)."""
    lons = np.asarray(lons, dtype=np.float64)
    lons = (lons + 180.0) % 360.0 - 180.0
    order = np.argsort(lons)
    field = np.take(field, order, axis=lon_axis)
    return lons[order], field


def _fill_nearest(arr2d: np.ndarray) -> np.ndarray:
    """Fill NaN with nearest finite value (for interpolation only)."""
    mask = ~np.isnan(arr2d)
    if mask.all():
        return arr2d
    if not mask.any():
        return arr2d  # entirely NaN — caller's responsibility
    ind = distance_transform_edt(~mask, return_distances=False, return_indices=True)
    return arr2d[tuple(ind)]


def regrid_to_target(src_lats: np.ndarray, src_lons: np.ndarray, field: np.ndarray,
                     dst_lats: np.ndarray | None = None, dst_lons: np.ndarray | None = None) -> np.ndarray:
    """Bilinear-interpolate a (time, lat, lon) regular grid onto the target grid.

    Both axes must be uniform and ascending (all sources here are). NaN source
    cells are filled from the nearest finite neighbour *for the interpolation
    only* — callers re-apply masks to the output so no fabricated values survive
    (e.g. SST is re-masked to ocean cells after regridding).
    """
    field = np.asarray(field)
    d_lat = TARGET_LATS if dst_lats is None else dst_lats
    d_lon = TARGET_LONS if dst_lons is None else dst_lons
    s_lat = np.asarray(src_lats, dtype=np.float64)
    if s_lat[0] > s_lat[-1]:  # descending latitude (e.g. ERSST) — flip to ascending
        s_lat = s_lat[::-1]
        field = field[:, ::-1, :] if field.ndim == 3 else field[::-1, :]
    s_lon, field = normalise_lon(src_lons, field, lon_axis=-1)
    assert s_lat.ndim == 1 and len(s_lat) >= 2
    lat_pos = (d_lat - s_lat[0]) / (s_lat[1] - s_lat[0])
    lat_pos = np.clip(lat_pos, 0.0, len(s_lat) - 1.0)
    lon_pos = (d_lon - s_lon[0]) / (s_lon[1] - s_lon[0])
    LAT, LON = np.meshgrid(lat_pos, lon_pos, indexing="ij")  # (n_dst_lat, n_dst_lon)
    out = np.empty((field.shape[0], len(d_lat), len(d_lon)), dtype=np.float64)
    for t in range(field.shape[0]):
        plane = np.asarray(field[t], dtype=np.float64)
        filled = _fill_nearest(plane)
        out[t] = map_coordinates(filled, [LAT, LON], order=1, mode="grid-wrap")
    return out


def coverage_arrays(var: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Per cell: (n_valid, first_idx, last_idx) along time. int16, -1 when none."""
    T = var.shape[0]
    finite = np.isfinite(var)
    n_valid = finite.sum(axis=0).astype(np.int16)
    idx = np.arange(T, dtype=np.int16).reshape((T,) + (1,) * (var.ndim - 1))
    first = np.where(finite, idx, T).min(axis=0)
    first = np.where(first == T, -1, first).astype(np.int16)
    last = np.where(finite, idx, -1).max(axis=0).astype(np.int16)
    return n_valid, first, last
