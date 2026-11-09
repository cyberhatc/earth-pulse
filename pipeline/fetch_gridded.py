"""Gridded NASA product fetch (Tier B), via earthaccess + OPeNDAP/xarray.

This module is *not* exercised by the offline demo. It documents and automates the
real path: discover products at a point/date → subset → return xarray Dataset.
Requires: pip install earthaccess xarray netCDF4 zarr
"""
from __future__ import annotations

from pipeline.auth import have_earthdata_credentials, earthaccess_login

PRODUCTS = {
    "merra2_slv": {
        "short_name": "M2TSMNXSLV",   # Monthly Time-averaged Single-Level Diagnostics
        "variables": ["T2M", "U10M", "V10M", "PS"],
        "version": None,
    },
    "merra2_per": {
        "short_name": "M2TMNXPER",   # monthly assimilation diagnostics
        "variables": ["PRECTOT", "QV2M", "T2MDEW"],
        "version": None,
    },
    "ndvi_mod13": {
        "short_name": "MOD13A3",     # monthly NDVI/EVI 1 km
        "variables": ["_250m_16_days_NDVI", "_250m_16_days_EVI"],
        "version": None,
    },
    "gpm_imerg": {
        "short_name": "GPM_3IMERGM",
        "variables": ["precipitation"],
        "version": None,
    },
    "ghrsst_mur_sst": {
        "short_name": "MUR-JPL-L4-GLOB-v4.1",
        "variables": ["analysed_sst"],
        "version": None,
    },
}


def fetch_gridded_subset(lat: float, lon: float, start: str, end: str,
                         product: str = "merra2_slv", half_size_deg: float = 1.5):
    """Discover and subset a NASA product around (lat, lon).

    Returns an xarray Dataset (lazy) or raises RuntimeError with guidance.
    Example: fetch_gridded_subset(12.97, 77.59, "2000-01-01", "2020-12-31")
    """
    if product not in PRODUCTS:
        raise ValueError(f"Unknown product '{product}'. Known: {sorted(PRODUCTS)}")
    spec = PRODUCTS[product]
    if not have_earthdata_credentials():
        raise RuntimeError(
            "EARTHDATA_USERNAME / EARTHDATA_PASSWORD not set. "
            "Register free at https://urs.earthdata.nasa.gov and export the env vars."
        )
    try:
        import earthaccess  # type: ignore
        import xarray as xr  # noqa: F401
    except ImportError as exc:
        raise RuntimeError("pip install earthaccess xarray netCDF4 zarr") from exc

    earthaccess_login()
    results = earthaccess.search_data(
        short_name=spec["short_name"],
        bounding_box=(lon - half_size_deg, lat - half_size_deg, lon + half_size_deg, lat + half_size_deg),
        temporal=(start, end),
        count=1,
    )
    if not results:
        raise RuntimeError(f"No granules found for {spec['short_name']} at ({lat}, {lon}) in {start}..{end}")
    files = earthaccess.download(results, local_path="data/raw/")
    import xarray as xr  # type: ignore
    ds = xr.open_mfdataset(files, combine="by_coords", autoclose=True)
    return ds
