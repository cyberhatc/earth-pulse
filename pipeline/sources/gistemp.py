"""NASA GISTEMP v4 — gridded land-ocean temperature index (LOTI).

Product: gistemp1200_GHCNv4_ERSSTv5.nc — 2 x 2 deg grid, 1880-present,
NASA GISS surface temperature analysis, monthly anomalies vs 1951-1980.
No login required. Used as the real-store temperature variable (ANOMALIES,
clearly labelled — GISTEMP does not publish absolute gridded temperatures)
and as the validation reference series in engine/validate.py.

URL: https://data.giss.nasa.gov/pub/gistemp/gistemp1200_GHCNv4_ERSSTv5.nc.gz
Global mean series (for validation): GLB.Ts+dSST.csv (land-ocean, 1880+).
"""
from __future__ import annotations

import gzip
import json
import shutil
from pathlib import Path

import numpy as np

from pipeline.sources.common import cached_download, normalise_lon

GRIDDED_URL = "https://data.giss.nasa.gov/pub/gistemp/gistemp1200_GHCNv4_ERSSTv5.nc.gz"
GLB_URL = "https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv"
GRIDDED_CACHE = "gistemp1200_GHCNv4_ERSSTv5.nc.gz"
GLB_CACHE = "gistemp_GLB_Ts+dSST.csv"


def fetch_gridded_path() -> Path:
    """Download (cached) and decompress the GISTEMP gridded file; returns .nc path."""
    gz = cached_download(GRIDDED_URL, GRIDDED_CACHE, ttl_seconds=86400 * 30)
    nc = gz.with_suffix("")  # strip .gz
    if not nc.exists():
        with gzip.open(gz, "rb") as fi, open(nc, "wb") as fo:
            shutil.copyfileobj(fi, fo)
    return nc


def fetch_gridded():
    """Return xarray.Dataset(tempanomaly(time, lat, lon)), anomalies vs 1951-1980, degC."""
    import xarray as xr

    ds = xr.open_dataset(fetch_gridded_path(), decode_times=False)
    ds = ds[["tempanomaly"]]
    ds.attrs.update({
        "source": GRIDDED_URL,
        "product": "gistemp1200_GHCNv4_ERSSTv5",
        "version": "v4",
        "units": "degC anomaly (1951-1980 baseline)",
        "retrieved_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    })
    return ds


def fetch_global_series() -> dict[str, float]:
    """Global-mean LOTI anomaly per year (validation reference). {year: anomaly}."""
    fp = cached_download(GLB_URL, GLB_CACHE, ttl_seconds=86400 * 30)
    out: dict[str, float] = {}
    for raw in fp.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("Year") or line.startswith("Land-Ocean"):
            continue
        parts = [p.strip() for p in line.split(",")]
        year, annual = parts[0], parts[13] if len(parts) > 13 else ""
        if not year.isdigit() or annual in ("", "***"):
            continue
        try:
            out[year] = float(annual)
        except ValueError:
            continue
    return out
