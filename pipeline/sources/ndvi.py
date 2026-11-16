"""MODIS MOD13C2 monthly NDVI (CMG) — requires a free NASA Earthdata login.

Not available in the offline --fast build. With credentials set via
EARTHDATA_USERNAME / EARTHDATA_PASSWORD this module reports availability and
the (documented) AppEEARS/LAADS path; without them it reports
``available=False`` — we never fabricate NDVI.
"""
from __future__ import annotations

import os

EARTHDATA_LOGIN = bool(os.environ.get("EARTHDATA_USERNAME") and os.environ.get("EARTHDATA_PASSWORD"))
PRODUCT = "MODIS/Terra MOD13C2 v6.1 Vegetation Indices 16-Day L3 Global"
URL = "https://modis.gsfc.nasa.gov/data/dataprod/mod13.php"


def fetch(**_ignored):
    return {
        "available": False,
        "reason": (
            "MODIS NDVI (MOD13C2 CMG) is distributed via NASA Earthdata/LP DAAC and requires a free login. "
            "Set EARTHDATA_USERNAME/EARTHDATA_PASSWORD and use scripts/fetch_ndvi_sentinel.py (Sentinel-2 path, "
            "no login) or the AppEEARS route documented in docs/real-data-ingestion.md. "
            "NDVI is intentionally NaN in the --fast store — never interpolated or faked."
        ),
        "credentials_present": EARTHDATA_LOGIN,
        "source": URL,
        "product": PRODUCT,
    }
