"""NASA GIBS / Worldview tile URL builder.

GIBS WMTS (EPSG:3857) pattern:
  https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/<layer>/default/<time>/<tileMatrixSet>/<z>/<y>/<x>.<ext>
<time> is the layer's time (YYYY-MM-DD for dated layers).

Layer identifiers occasionally change — check https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml
"""
from __future__ import annotations

import math

BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best"
MATRIX = "GoogleMapsCompatible_Level9"

# Curated, safe defaults. Prefer PNG for scientific layers, JPEG for true color.
LAYERS = {
    "true_color": ("MODIS_Terra_CorrectedReflectance_TrueColor", "jpg"),
    "ndvi": ("MODIS_Terra_NDVI_8Day", "png"),
    "fires": ("MODIS_Combined_Thermal_Anomalies_All", "png"),
    "snow": ("MODIS_Terra_Snow_Cover", "png"),
    "sst": ("MODIS_Aqua_L3_SST_MidIR4_Monthly", "png"),  # verify layer id at build time
}


def lon_lat_to_tile(lon: float, lat: float, z: int) -> tuple[int, int]:
    n = 2**z
    x = int((lon + 180.0) / 360.0 * n)
    lat_r = math.radians(lat)
    y = int((1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n)
    return max(0, min(n - 1, x)), max(0, min(n - 1, y))


def tile_url(layer_key: str, date: str, z: int, x: int, y: int) -> str:
    layer, ext = LAYERS[layer_key]
    return f"{BASE}/{layer}/default/{date}/{MATRIX}/{z}/{y}/{x}.{ext}"


def thumbnails_for_point(lat: float, lon: float, dates: list[str], z: int = 4) -> list[dict]:
    """Return one thumbnail URL per (layer, date) centered on the point."""
    x, y = lon_lat_to_tile(lon, lat, z)
    thumbs = []
    for date in dates:
        for key in LAYERS:
            thumbs.append({"date": date, "layer": key, "z": z, "url": tile_url(key, date, z, x, y)})
    return thumbs
