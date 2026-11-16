"""GPCP v2.3 Combined Precipitation Dataset — monthly, 2.5 deg, 1979-present.

Product: precip.mon.mean.nc — average monthly rate of precipitation, mm/day.
The store expresses precipitation as mm/month (rate x days in month) to match
the synthetic demo store and the UI. No login required.
URL: https://psl.noaa.gov/thredds/fileServer/Datasets/gpcp/precip.mon.mean.nc
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from pipeline.sources.common import cached_download

URL = "https://psl.noaa.gov/thredds/fileServer/Datasets/gpcp/precip.mon.mean.nc"
CACHE = "gpcp_precip.mon.mean.nc"
DAYS_IN_MONTH = np.array([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])


def fetch_gpcp_path() -> Path:
    return cached_download(URL, CACHE, ttl_seconds=86400 * 30, timeout=900)


def _days_in_month(years: np.ndarray, months: np.ndarray) -> np.ndarray:
    out = DAYS_IN_MONTH[months - 1].astype(float)
    leap = ((years % 4 == 0) & (years % 100 != 0)) | (years % 400 == 0)
    out[leap & (months == 2)] = 29.0
    return out


def fetch_gpcp():
    """Return xarray.Dataset(precip(time, lat, lon)) in mm/month."""
    import xarray as xr
    import pandas as pd

    ds = xr.open_dataset(fetch_gpcp_path(), decode_times=False)
    p = ds["precip"]
    # time is 'days since 1800-01-01' (CF); convert to monthly stamps
    times = pd.to_datetime(ds["time"].values.astype(np.float64), unit="D", origin="1800-01-01")
    years = times.year.values
    months = times.month.values
    days = _days_in_month(years, months)
    precip_mm = p.astype(np.float32) * days[:, None, None]
    out = xr.Dataset(
        {"precip": (("time", "lat", "lon"), precip_mm.values.astype(np.float32))},
        coords={"time": times.to_numpy(), "lat": ds["lat"].values, "lon": ds["lon"].values},
        attrs={
            "source": URL,
            "product": "GPCP Version 2.3 Combined Precipitation Dataset (Final)",
            "version": "V2.3",
            "units": "mm/month",
            "original_units": "mm/day (average monthly rate x days in month)",
            "retrieved_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        },
    )
    out["precip"].attrs["units"] = "mm/month"
    return out
