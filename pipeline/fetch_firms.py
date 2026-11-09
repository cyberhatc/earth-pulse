"""NASA FIRMS active-fire hotspots fetcher.

Requires a free MAP_KEY: https://firms.modaps.eosdis.nasa.gov/api/map_key/
Set FIRMS_MAP_KEY in the environment. Without a key this returns an empty list
with an explanatory note (it does not fabricate data).
"""
from __future__ import annotations

import csv
import io
import os
import urllib.request
import urllib.error

BASE = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"


def fetch_firms_area(lat: float, lon: float, radius_deg: float = 1.5,
                     days: int = 7, source: str = "MODIS_NRT") -> dict:
    key = os.environ.get("FIRMS_MAP_KEY", "")
    west, east = lon - radius_deg, lon + radius_deg
    south, north = max(-90.0, lat - radius_deg), min(90.0, lat + radius_deg)
    if not key:
        return {"fires": [], "note": "FIRMS_MAP_KEY not set — fire data unavailable (free key at firms.modaps.eosdis.nasa.gov)", "available": False}
    url = f"{BASE}/{key}/{source}/{west:.3f},{south:.3f},{east:.3f},{north:.3f}/{days}"
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            text = resp.read().decode("utf-8", errors="replace")
        rows = list(csv.DictReader(io.StringIO(text)))
        fires = [
            {
                "latitude": float(r.get("latitude", "nan")),
                "longitude": float(r.get("longitude", "nan")),
                "acq_date": r.get("acq_date"),
                "frp": float(r["frp"]) if r.get("frp") not in (None, "") else None,
                "confidence": r.get("confidence"),
            }
            for r in rows
        ]
        return {"fires": fires, "count": len(fires), "available": True, "source": source, "bbox": [west, south, east, north]}
    except urllib.error.URLError as exc:
        return {"fires": [], "note": f"firms_unreachable: {exc}", "available": False}
    except Exception as exc:
        return {"fires": [], "note": f"firms_error: {exc}", "available": False}
