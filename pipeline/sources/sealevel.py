"""NASA/PO.DAAC gridded sea surface height (1993+) — requires Earthdata login.

Not available in the offline --fast build. Reported unavailable rather than
faked when credentials are absent; see docs/real-data-ingestion.md for the
PO.DAAC/AppEEARS route.
"""
from __future__ import annotations

import os

EARTHDATA_LOGIN = bool(os.environ.get("EARTHDATA_USERNAME") and os.environ.get("EARTHDATA_PASSWORD"))
URL = "https://podaac.jpl.nasa.gov/dataset/AVISO_L4_SSALTO_SSH_MERGED_DEDUP_V_JPL2205"


def fetch(**_ignored):
    return {
        "available": False,
        "reason": (
            "Gridded sea surface height (PO.DAAC/AVISO) requires a free NASA Earthdata login. "
            "Set EARTHDATA_USERNAME/EARTHDATA_PASSWORD and follow docs/real-data-ingestion.md. "
            "Sea level is intentionally NaN in the --fast store — never interpolated or faked."
        ),
        "credentials_present": EARTHDATA_LOGIN,
        "source": URL,
        "product": "PO.DAAC gridded SSH (AVISO merged)",
    }
