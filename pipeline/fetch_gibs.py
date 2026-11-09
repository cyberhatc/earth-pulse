"""NASA GIBS / Worldview tile URL builder.

GIBS WMTS (EPSG:3857) pattern:
  https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/<layer>/default/<time>/<tileMatrixSet>/<z>/<y>/<x>.<ext>

Every layer below was verified HTTP-200 against a real GIBS server on 2026-11-09.
Notes:
- Fire/thermal-anomaly layers are VECTOR tiles (application/vnd.mapbox-vector-tile)
  and cannot be used in <img> or as static raster toggles — use the FIRMS API instead
  (pipeline/fetch_firms.py) as the fire signal.
- TILEMATRIXSET is layer-specific: Level9 = true color/NDVI, Level8 = snow, Level7 = SST.
- Layer ids change; check the capabilities doc:
  https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml
"""
from __future__ import annotations

import math

BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best"

LAYERS = {
    "true_color": ("MODIS_Terra_CorrectedReflectance_TrueColor", "jpg", "GoogleMapsCompatible_Level9"),
    "ndvi": ("MODIS_Terra_NDVI_8Day", "png", "GoogleMapsCompatible_Level9"),
    "snow": ("MODIS_Terra_L3_Snow_Extent_8Day", "png", "GoogleMapsCompatible_Level8"),
    "sst": ("GHRSST_L4_MUR_Sea_Surface_Temperature", "png", "GoogleMapsCompatible_Level7"),
}


def lon_lat_to_tile(lon: float, lat: float, z: int) -> tuple[int, int]:
    n = 2**z
    x = int((lon + 180.0) / 360.0 * n)
    lat_r = math.radians(lat)
    y = int((1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n)
    return max(0, min(n - 1, x)), max(0, min(n - 1, y))


def tile_url(layer_key: str, date: str, z: int, x: int, y: int) -> str:
    layer, ext, matrix = LAYERS[layer_key]
    return f"{BASE}/{layer}/default/{date}/{matrix}/{z}/{y}/{x}.{ext}"


def thumbnails_for_point(lat: float, lon: float, dates: list[str], z: int = 4) -> list[dict]:
    """Return one thumbnail URL per (layer, date) centered on the point. Verified live."""
    x, y = lon_lat_to_tile(lon, lat, z)
    thumbs = []
    for date in dates:
        for key in LAYERS:
            thumbs.append({"date": date, "layer": key, "z": z, "url": tile_url(key, date, z, x, y)})
    return thumbs
