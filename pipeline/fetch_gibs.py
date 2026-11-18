"""NASA GIBS / Worldview raster tile URL catalogue.

GIBS WMTS (EPSG:3857) pattern:
  https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/<layer>/default/<time>/<tileMatrixSet>/<z>/<y>/<x>.<ext>

Every layer/date combination below was checked against the live GIBS server.
The matrix set and maximum practical zoom are layer-specific, so they live in
the catalogue rather than being assumed.

Vector layers (thermal anomalies / fires) cannot be embedded as <img>; use the
FIRMS API for those instead. No imagery is fabricated: a layer with a shorter
record simply gets fewer dates.
"""
from __future__ import annotations

import math

BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best"

# key -> (GIBS layer id, extension, tile matrix set, zoom, available dates)
# Dates are chosen inside each product's real record; monthly layers use the
# first day of the month, 8-day layers a date with a composite.
LAYERS: dict[str, tuple[str, str, str, int, list[str]]] = {
    "true_color": (
        "MODIS_Terra_CorrectedReflectance_TrueColor", "jpg",
        "GoogleMapsCompatible_Level9", 8,
        ["2005-07-01", "2012-07-01", "2019-07-01", "2025-07-01"],
    ),
    "false_color": (
        "MODIS_Terra_CorrectedReflectance_Bands721", "jpg",
        "GoogleMapsCompatible_Level9", 8,
        ["2005-07-01", "2012-07-01", "2019-07-01", "2025-07-01"],
    ),
    "ndvi": (
        "MODIS_Terra_L3_NDVI_Monthly", "png",
        "GoogleMapsCompatible_Level7", 7,
        ["2001-07-01", "2010-07-01", "2019-07-01", "2025-07-01"],
    ),
    "evi": (
        "MODIS_Terra_L3_EVI_Monthly", "png",
        "GoogleMapsCompatible_Level7", 7,
        ["2001-07-01", "2010-07-01", "2019-07-01", "2025-07-01"],
    ),
    "lst_day": (
        "MODIS_Terra_Land_Surface_Temp_Day", "png",
        "GoogleMapsCompatible_Level7", 7,
        ["2005-07-01", "2012-07-01", "2019-07-01", "2025-07-01"],
    ),
    "lst_night": (
        "MODIS_Terra_Land_Surface_Temp_Night", "png",
        "GoogleMapsCompatible_Level7", 7,
        ["2005-07-01", "2012-07-01", "2019-07-01", "2025-07-01"],
    ),
    "snow": (
        "MODIS_Terra_L3_Snow_Extent_8Day", "png",
        "GoogleMapsCompatible_Level8", 7,
        ["2005-01-15", "2012-01-15", "2019-01-15", "2025-01-15"],
    ),
    "aerosol": (
        "MODIS_Terra_Aerosol_Optical_Depth_3km", "png",
        "GoogleMapsCompatible_Level6", 6,
        ["2005-07-01", "2012-07-01", "2019-07-01", "2025-07-01"],
    ),
    "no2": (
        "OMI_Nitrogen_Dioxide_Tropo_Column", "png",
        "GoogleMapsCompatible_Level6", 6,
        ["2005-07-01", "2012-07-01", "2019-07-01", "2025-07-01"],
    ),
    "so2": (
        "TROPOMI_L2_Sulfur_Dioxide_Total_Vertical_Column", "png",
        "GoogleMapsCompatible_Level6", 6,
        ["2019-07-01", "2025-07-01"],
    ),
    "co": (
        "AIRS_L3_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Monthly_Day", "png",
        "GoogleMapsCompatible_Level6", 6,
        ["2005-07-01", "2012-07-01", "2019-07-01", "2025-07-01"],
    ),
    "precipitation": (
        "IMERG_Precipitation_Rate", "png",
        "GoogleMapsCompatible_Level6", 6,
        ["2005-07-01", "2012-07-01", "2019-07-01", "2025-07-01"],
    ),
    "soil_moisture": (
        "GLDAS_Underground_Soil_Moisture_Monthly", "png",
        "GoogleMapsCompatible_Level6", 6,
        ["2005-07-01", "2012-07-01", "2019-07-01", "2025-07-01"],
    ),
    "viirs_true_color": (
        "VIIRS_SNPP_CorrectedReflectance_TrueColor", "jpg",
        "GoogleMapsCompatible_Level9", 8,
        ["2016-07-01", "2020-07-01", "2025-07-15"],
    ),
    "viirs_false_color": (
        "VIIRS_SNPP_CorrectedReflectance_BandsM11-I2-I1", "jpg",
        "GoogleMapsCompatible_Level9", 8,
        ["2016-07-01", "2020-07-01", "2025-07-15"],
    ),
    "viirs_lst_day": (
        "VIIRS_SNPP_Land_Surface_Temp_Day", "png",
        "GoogleMapsCompatible_Level7", 7,
        ["2016-01-15", "2020-01-15", "2025-01-15"],
    ),
    "ndsi": (
        "MODIS_Terra_L3_NDSI_Snow_Cover_Daily", "png",
        "GoogleMapsCompatible_Level8", 7,
        ["2005-01-15", "2012-01-15", "2019-01-15", "2025-01-15"],
    ),
    "viirs_ndsi": (
        "VIIRS_SNPP_NDSI_Snow_Cover", "png",
        "GoogleMapsCompatible_Level8", 7,
        ["2016-01-15", "2020-01-15", "2025-01-15"],
    ),
    "snow_pct": (
        "MODIS_Terra_L3_Snow_Cover_Monthly_Average_Pct", "png",
        "GoogleMapsCompatible_Level6", 6,
        ["2005-01-01", "2012-01-01", "2019-01-01", "2025-01-01"],
    ),
    "snow_mass": (
        "SMAP_L4_Snow_Mass", "png",
        "GoogleMapsCompatible_Level6", 6,
        ["2016-01-15", "2020-01-15", "2025-01-15"],
    ),
    "snow_water_equivalent": (
        "AMSRU2_Snow_Water_Equivalent_Monthly", "png",
        "GoogleMapsCompatible_Level6", 6,
        ["2016-01-01", "2020-01-01", "2025-01-01"],
    ),
    "gldas_air_temperature": (
        "GLDAS_Near_Surface_Air_Temperature_Monthly", "png",
        "GoogleMapsCompatible_Level6", 6,
        ["2005-07-01", "2012-07-01", "2019-07-01", "2025-07-01"],
    ),
    "gldas_precipitation": (
        "GLDAS_Surface_Total_Precipitation_Rate_Monthly", "png",
        "GoogleMapsCompatible_Level6", 6,
        ["2005-07-01", "2012-07-01", "2019-07-01", "2025-07-01"],
    ),
}

# grouped for the notebook gallery headings
GROUPS = [
    ("Optical / vegetation", [
        "true_color", "false_color", "ndvi", "evi",
        "viirs_true_color", "viirs_false_color",
    ]),
    ("Temperature & snow", [
        "lst_day", "lst_night", "viirs_lst_day",
        "snow", "ndsi", "viirs_ndsi", "snow_pct",
        "snow_mass", "snow_water_equivalent",
    ]),
    ("Atmosphere", ["aerosol", "no2", "so2", "co", "precipitation"]),
    ("Water & soil", ["soil_moisture", "gldas_air_temperature", "gldas_precipitation"]),
]


def lon_lat_to_tile(lon: float, lat: float, z: int) -> tuple[int, int]:
    n = 2**z
    x = int((lon + 180.0) / 360.0 * n)
    lat_r = math.radians(lat)
    y = int((1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n)
    return max(0, min(n - 1, x)), max(0, min(n - 1, y))


def tile_url(layer_key: str, date: str, z: int | None = None,
             x: int | None = None, y: int | None = None,
             lon: float | None = None, lat: float | None = None) -> str:
    layer, ext, matrix, default_z, _dates = LAYERS[layer_key]
    if z is None:
        z = default_z
    if x is None or y is None:
        if lon is None or lat is None:
            raise ValueError("tile_url needs x/y or lon/lat")
        x, y = lon_lat_to_tile(lon, lat, z)
    return f"{BASE}/{layer}/default/{date}/{matrix}/{z}/{y}/{x}.{ext}"


def thumbnails_for_point(lat: float, lon: float,
                         dates: list[str] | None = None,
                         z: int | None = None) -> list[dict]:
    """Return one thumbnail URL per (layer, available date) centred on the point.

    `dates` and `z` are kept as optional overrides for callers that need a
    specific comparison date, but the layer catalogue supplies the safe default.
    """
    thumbs: list[dict] = []
    for key, (_layer, _ext, _matrix, default_z, layer_dates) in LAYERS.items():
        use_dates = dates or layer_dates
        use_z = z if z is not None else default_z
        x, y = lon_lat_to_tile(lon, lat, use_z)
        for date in use_dates:
            thumbs.append(
                {
                    "date": date,
                    "layer": key,
                    "z": use_z,
                    "url": tile_url(key, date, z=use_z, x=x, y=y),
                }
            )
    return thumbs


def layer_groups() -> list[dict]:
    return [{"name": name, "layers": keys} for name, keys in GROUPS]
