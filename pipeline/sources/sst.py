"""NOAA Extended Reconstructed SST — ERSST v5 (absolute, 2 deg, 1854-present).

Product: sst.mnmean.nc — monthly mean SST, degC. No login required.
URL: https://downloads.psl.noaa.gov/Datasets/noaa.ersst.v5/sst.mnmean.nc
SST is ocean-only by construction (land cells are NaN in the product).
"""
from __future__ import annotations

from pathlib import Path

from pipeline.sources.common import cached_download

URL = "https://downloads.psl.noaa.gov/Datasets/noaa.ersst.v5/sst.mnmean.nc"
CACHE = "ersst_v5_sst.mnmean.nc"


def fetch_ersst_path() -> Path:
    return cached_download(URL, CACHE, ttl_seconds=86400 * 30, timeout=900)


def fetch_ersst():
    """Return xarray.Dataset(sst(time, lat, lon)), degC, NaN over land."""
    import xarray as xr

    ds = xr.open_dataset(fetch_ersst_path(), decode_times=False)
    var = "sst" if "sst" in ds.variables else list(ds.data_vars)[0]
    ds = ds[[var]].rename({var: "sst"})
    ds.attrs.update({
        "source": URL,
        "product": "ERSST v5",
        "version": "v5",
        "units": "degC",
        "retrieved_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    })
    return ds
