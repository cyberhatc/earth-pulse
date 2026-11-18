"""Single source of truth for the point-level parameter catalogue.

The same labels, units, groups, physical bounds and provenance strings are used
by the point store builder, trend/ML analysis, the dossier API, the notebook UI
and the printable visual report. Keeping them here prevents the frontend and the
server from drifting apart as new sources are added.

Only parameters that can be backed by a real, free, no-login record are listed.
Anything that needs an Earthdata login is reported as restricted by the API and
is never filled with invented numbers.
"""
from __future__ import annotations

from typing import Any

# group order is also the order used in the notebook and the HTML report
GROUPS = [
    "Atmosphere",
    "Radiation",
    "Water & land",
    "Air quality",
    "Vegetation & surface",
    "Snow & cryosphere",
]

# ml=False marks circular or categorically encoded variables that must not be
# fed to the ridge regressor as ordinary scalars.
PARAMETERS: dict[str, dict[str, Any]] = {
    # ---------------------------------------------------------------- atmosphere
    "temperature": dict(
        label="Air temperature (2 m)", unit="°C", group="Atmosphere",
        source="NASA POWER T2M", native="monthly", resolution_m=55000,
        coverage="1981–present", bounds=(-80.0, 60.0),
    ),
    "temperature_max": dict(
        label="Maximum air temperature", unit="°C", group="Atmosphere",
        source="NASA POWER T2M_MAX", native="monthly", resolution_m=55000,
        coverage="1981–present", bounds=(-80.0, 70.0),
    ),
    "temperature_min": dict(
        label="Minimum air temperature", unit="°C", group="Atmosphere",
        source="NASA POWER T2M_MIN", native="monthly", resolution_m=55000,
        coverage="1981–present", bounds=(-80.0, 60.0),
    ),
    "temperature_range": dict(
        label="Diurnal temperature range", unit="°C", group="Atmosphere",
        source="NASA POWER T2M_RANGE", native="monthly", resolution_m=55000,
        coverage="1981–present", bounds=(0.0, 60.0),
    ),
    "dew_point": dict(
        label="Dew-point temperature", unit="°C", group="Atmosphere",
        source="NASA POWER T2MDEW", native="monthly", resolution_m=55000,
        coverage="1981–present", bounds=(-80.0, 45.0),
    ),
    "skin_temperature": dict(
        label="Skin temperature", unit="°C", group="Atmosphere",
        source="NASA POWER TS", native="monthly", resolution_m=55000,
        coverage="1981–present", bounds=(-80.0, 80.0),
    ),
    "apparent_temperature": dict(
        label="Apparent temperature", unit="°C", group="Atmosphere",
        source="Open-Meteo ERA5 apparent temperature", native="daily → monthly mean",
        resolution_m=28000, coverage="1986–present", bounds=(-80.0, 70.0),
    ),
    "humidity": dict(
        label="Relative humidity", unit="%", group="Atmosphere",
        source="NASA POWER RH2M", native="monthly", resolution_m=55000,
        coverage="1981–present", bounds=(0.0, 100.0),
    ),
    "specific_humidity": dict(
        label="Specific humidity", unit="g/kg", group="Atmosphere",
        source="NASA POWER QV2M", native="monthly", resolution_m=55000,
        coverage="1981–present", bounds=(0.0, 60.0),
    ),
    "surface_pressure": dict(
        label="Surface pressure", unit="kPa", group="Atmosphere",
        source="NASA POWER PS", native="monthly", resolution_m=55000,
        coverage="1981–present", bounds=(40.0, 115.0),
    ),
    "pressure_msl": dict(
        label="Mean sea-level pressure", unit="hPa", group="Atmosphere",
        source="Open-Meteo ERA5 pressure_msl", native="daily → monthly mean",
        resolution_m=28000, coverage="1986–present", bounds=(850.0, 1100.0),
    ),
    "cloud_cover": dict(
        label="Cloud cover", unit="%", group="Atmosphere",
        source="Open-Meteo ERA5 cloud_cover", native="daily → monthly mean",
        resolution_m=28000, coverage="1986–present", bounds=(0.0, 100.0),
    ),
    "wind": dict(
        label="Wind speed (2 m)", unit="m/s", group="Atmosphere",
        source="NASA POWER WS2M", native="monthly", resolution_m=55000,
        coverage="1981–present", bounds=(0.0, 120.0),
    ),
    "wind_10m": dict(
        label="Wind speed (10 m)", unit="m/s", group="Atmosphere",
        source="NASA POWER WS10M", native="monthly", resolution_m=55000,
        coverage="1981–present", bounds=(0.0, 120.0),
    ),
    "wind_direction": dict(
        label="Wind direction (from)", unit="°", group="Atmosphere",
        source="NASA POWER WD2M", native="monthly", resolution_m=55000,
        coverage="1981–present", bounds=(0.0, 360.0), ml=False,
    ),
    "wind_gusts": dict(
        label="Maximum wind gust", unit="m/s", group="Atmosphere",
        source="Open-Meteo ERA5 wind_gusts_10m_max", native="daily max → monthly mean",
        resolution_m=28000, coverage="1986–present", bounds=(0.0, 180.0),
    ),
    "vapour_pressure_deficit": dict(
        label="Vapour-pressure deficit", unit="kPa", group="Atmosphere",
        source="Open-Meteo ERA5 vapour_pressure_deficit_max",
        native="daily max → monthly mean", resolution_m=28000,
        coverage="1986–present", bounds=(0.0, 25.0),
    ),
    "sunshine_duration": dict(
        label="Sunshine duration", unit="h/month", group="Atmosphere",
        source="Open-Meteo ERA5 sunshine_duration", native="daily sum → monthly total",
        resolution_m=28000, coverage="1986–present", bounds=(0.0, 800.0),
    ),
    # ----------------------------------------------------------------- radiation
    "solar_radiation": dict(
        label="Downward shortwave radiation", unit="kWh/m²/day", group="Radiation",
        source="NASA POWER ALLSKY_SFC_SW_DWN", native="monthly", resolution_m=55000,
        coverage="1984–present", bounds=(0.0, 12.0),
    ),
    "clear_sky_solar_radiation": dict(
        label="Clear-sky shortwave radiation", unit="kWh/m²/day", group="Radiation",
        source="NASA POWER CLRSKY_SFC_SW_DWN", native="monthly", resolution_m=55000,
        coverage="1984–present", bounds=(0.0, 12.0),
    ),
    "longwave_radiation": dict(
        label="Downward longwave radiation", unit="MJ/m²/day", group="Radiation",
        source="NASA POWER ALLSKY_SFC_LW_DWN", native="monthly", resolution_m=55000,
        coverage="1984–present", bounds=(0.0, 50.0),
    ),
    "par": dict(
        label="Photosynthetically active radiation", unit="MJ/m²/day", group="Radiation",
        source="NASA POWER ALLSKY_SFC_PAR_TOT", native="monthly", resolution_m=55000,
        coverage="1984–present", bounds=(0.0, 20.0),
    ),
    "net_radiation": dict(
        label="Net surface radiation", unit="MJ/m²/day", group="Radiation",
        source="NASA POWER SW/LW down − up (derived)", native="monthly",
        resolution_m=55000, coverage="1984–present", bounds=(-100.0, 100.0),
    ),
    # ---------------------------------------------------------------- water & land
    "precipitation": dict(
        label="Precipitation", unit="mm/month", group="Water & land",
        source="NASA POWER PRECTOTCORR", native="monthly", resolution_m=55000,
        coverage="1981–present", bounds=(0.0, 4000.0),
    ),
    "rainfall": dict(
        label="Rainfall", unit="mm/month", group="Water & land",
        source="Open-Meteo ERA5 rain_sum", native="daily sum → monthly total",
        resolution_m=28000, coverage="1986–present", bounds=(0.0, 4000.0),
    ),
    "snowfall": dict(
        label="Snowfall", unit="cm/month", group="Water & land",
        source="Open-Meteo ERA5 snowfall_sum", native="daily sum → monthly total",
        resolution_m=28000, coverage="1986–present", bounds=(0.0, 500.0),
    ),
    "evapotranspiration": dict(
        label="Evapotranspiration", unit="mm/month", group="Water & land",
        source="NASA POWER EVPTRNS", native="monthly", resolution_m=55000,
        coverage="1981–present", bounds=(0.0, 2000.0),
    ),
    "et_reference": dict(
        label="Reference evapotranspiration (ET₀)", unit="mm/month", group="Water & land",
        source="Open-Meteo ERA5 et0_fao_evapotranspiration",
        native="daily sum → monthly total", resolution_m=28000,
        coverage="1986–present", bounds=(0.0, 2000.0),
    ),
    "evaporation": dict(
        label="Evaporation", unit="mm/month", group="Water & land",
        source="NASA POWER EVLAND", native="monthly", resolution_m=55000,
        coverage="1981–present", bounds=(0.0, 3000.0),
    ),
    "soil_moisture_surface": dict(
        label="Surface soil wetness", unit="fraction", group="Water & land",
        source="NASA POWER GWETTOP", native="monthly", resolution_m=55000,
        coverage="1981–present", bounds=(0.0, 1.0),
    ),
    "soil_moisture_rootzone": dict(
        label="Root-zone soil wetness", unit="fraction", group="Water & land",
        source="NASA POWER GWETROOT", native="monthly", resolution_m=55000,
        coverage="1981–present", bounds=(0.0, 1.0),
    ),
    "soil_moisture_profile": dict(
        label="Profile soil wetness", unit="fraction", group="Water & land",
        source="NASA POWER GWETPROF", native="monthly", resolution_m=55000,
        coverage="1981–present", bounds=(0.0, 1.0),
    ),
    "soil_moisture_0_7cm": dict(
        label="Soil moisture 0–7 cm", unit="m³/m³", group="Water & land",
        source="Open-Meteo ERA5 soil_moisture_0_to_7cm",
        native="daily mean → monthly mean", resolution_m=28000,
        coverage="1986–present", bounds=(0.0, 1.0),
    ),
    "soil_moisture_7_28cm": dict(
        label="Soil moisture 7–28 cm", unit="m³/m³", group="Water & land",
        source="Open-Meteo ERA5 soil_moisture_7_to_28cm",
        native="daily mean → monthly mean", resolution_m=28000,
        coverage="1986–present", bounds=(0.0, 1.0),
    ),
    "soil_moisture_28_100cm": dict(
        label="Soil moisture 28–100 cm", unit="m³/m³", group="Water & land",
        source="Open-Meteo ERA5 soil_moisture_28_to_100cm",
        native="daily mean → monthly mean", resolution_m=28000,
        coverage="1986–present", bounds=(0.0, 1.0),
    ),
    "soil_temperature_0_7cm": dict(
        label="Soil temperature 0–7 cm", unit="°C", group="Water & land",
        source="Open-Meteo ERA5 soil_temperature_0_to_7cm",
        native="daily mean → monthly mean", resolution_m=28000,
        coverage="1986–present", bounds=(-60.0, 80.0),
    ),
    "soil_temperature_7_28cm": dict(
        label="Soil temperature 7–28 cm", unit="°C", group="Water & land",
        source="Open-Meteo ERA5 soil_temperature_7_to_28cm",
        native="daily mean → monthly mean", resolution_m=28000,
        coverage="1986–present", bounds=(-60.0, 80.0),
    ),
    "frost_days": dict(
        label="Frost days", unit="days/month", group="Water & land",
        source="NASA POWER FROST_DAYS", native="monthly", resolution_m=55000,
        coverage="1981–present", bounds=(0.0, 31.0),
    ),
    # ---------------------------------------------------------------- air quality
    "aerosol_optical_depth": dict(
        label="Aerosol optical depth (550 nm)", unit="index", group="Air quality",
        source="NASA POWER AOD_55", native="monthly", resolution_m=55000,
        coverage="2001–present", bounds=(0.0, 10.0),
    ),
    "pm2_5": dict(
        label="PM₂.₅", unit="µg/m³", group="Air quality",
        source="Open-Meteo Air Quality (CAMS) pm2_5",
        native="hourly → monthly mean", resolution_m=11000,
        coverage="2023–present", bounds=(0.0, 2000.0),
    ),
    "pm10": dict(
        label="PM₁₀", unit="µg/m³", group="Air quality",
        source="Open-Meteo Air Quality (CAMS) pm10",
        native="hourly → monthly mean", resolution_m=11000,
        coverage="2023–present", bounds=(0.0, 5000.0),
    ),
    "nitrogen_dioxide": dict(
        label="Nitrogen dioxide (NO₂)", unit="µg/m³", group="Air quality",
        source="Open-Meteo Air Quality (CAMS) nitrogen_dioxide",
        native="hourly → monthly mean", resolution_m=11000,
        coverage="2023–present", bounds=(0.0, 1500.0),
    ),
    "sulphur_dioxide": dict(
        label="Sulphur dioxide (SO₂)", unit="µg/m³", group="Air quality",
        source="Open-Meteo Air Quality (CAMS) sulphur_dioxide",
        native="hourly → monthly mean", resolution_m=11000,
        coverage="2023–present", bounds=(0.0, 3000.0),
    ),
    "ozone": dict(
        label="Ozone (O₃)", unit="µg/m³", group="Air quality",
        source="Open-Meteo Air Quality (CAMS) ozone",
        native="hourly → monthly mean", resolution_m=11000,
        coverage="2023–present", bounds=(0.0, 1500.0),
    ),
    "carbon_monoxide": dict(
        label="Carbon monoxide (CO)", unit="µg/m³", group="Air quality",
        source="Open-Meteo Air Quality (CAMS) carbon_monoxide",
        native="hourly → monthly mean", resolution_m=11000,
        coverage="2023–present", bounds=(0.0, 50000.0),
    ),
    "dust": dict(
        label="Dust concentration", unit="µg/m³", group="Air quality",
        source="Open-Meteo Air Quality (CAMS) dust",
        native="hourly → monthly mean", resolution_m=11000,
        coverage="2023–present", bounds=(0.0, 5000.0),
    ),
    "uv_index": dict(
        label="UV index", unit="index", group="Air quality",
        source="Open-Meteo Air Quality (CAMS) uv_index",
        native="hourly → monthly mean", resolution_m=11000,
        coverage="2023–present", bounds=(0.0, 25.0),
    ),
    # -------------------------------------------------------- vegetation & surface
    "ndvi": dict(
        label="NDVI (vegetation greenness)", unit="index", group="Vegetation & surface",
        source="MODIS MOD13Q1 250 m via Microsoft Planetary Computer",
        native="16-day → monthly mean", resolution_m=250,
        coverage="2000–present", bounds=(-1.0, 1.0),
    ),
    "evi": dict(
        label="EVI (enhanced vegetation index)", unit="index", group="Vegetation & surface",
        source="MODIS MOD13Q1 250 m via Microsoft Planetary Computer",
        native="16-day → monthly mean", resolution_m=250,
        coverage="2000–present", bounds=(-1.0, 1.5),
    ),
    "lst_day": dict(
        label="Land-surface temperature — day", unit="°C", group="Vegetation & surface",
        source="MODIS MOD11A2 1 km via Microsoft Planetary Computer",
        native="8-day → monthly mean", resolution_m=1000,
        coverage="2000–present", bounds=(-80.0, 90.0),
    ),
    "lst_night": dict(
        label="Land-surface temperature — night", unit="°C", group="Vegetation & surface",
        source="MODIS MOD11A2 1 km via Microsoft Planetary Computer",
        native="8-day → monthly mean", resolution_m=1000,
        coverage="2000–present", bounds=(-100.0, 70.0),
    ),
    "surface_reflectance_red": dict(
        label="Surface reflectance — red", unit="reflectance", group="Vegetation & surface",
        source="MODIS MOD09A1 500 m via Microsoft Planetary Computer",
        native="8-day → monthly mean", resolution_m=500,
        coverage="2000–present", bounds=(0.0, 1.5),
    ),
    "surface_reflectance_nir": dict(
        label="Surface reflectance — NIR", unit="reflectance", group="Vegetation & surface",
        source="MODIS MOD09A1 500 m via Microsoft Planetary Computer",
        native="8-day → monthly mean", resolution_m=500,
        coverage="2000–present", bounds=(0.0, 1.5),
    ),
    "surface_reflectance_blue": dict(
        label="Surface reflectance — blue", unit="reflectance", group="Vegetation & surface",
        source="MODIS MOD09A1 500 m via Microsoft Planetary Computer",
        native="8-day → monthly mean", resolution_m=500,
        coverage="2000–present", bounds=(0.0, 1.5),
    ),
    "et_modis": dict(
        label="MODIS evapotranspiration", unit="mm/year", group="Vegetation & surface",
        source="MODIS MOD16A3GF 500 m via Microsoft Planetary Computer",
        native="annual", resolution_m=500,
        coverage="2000–present", bounds=(0.0, 5000.0),
    ),
    "pet_modis": dict(
        label="MODIS potential evapotranspiration", unit="mm/year",
        group="Vegetation & surface",
        source="MODIS MOD16A3GF 500 m via Microsoft Planetary Computer",
        native="annual", resolution_m=500,
        coverage="2000–present", bounds=(0.0, 6000.0),
    ),
    "gpp": dict(
        label="Gross primary production", unit="kg C/m²/year",
        group="Vegetation & surface",
        source="MODIS MOD17A3HGF 500 m via Microsoft Planetary Computer",
        native="annual", resolution_m=500,
        coverage="2000–present", bounds=(0.0, 10.0),
    ),
    # -------------------------------------------------- multispectral reflectance
    "surface_reflectance_green": dict(
        label="Surface reflectance — green (555 nm)", unit="fraction",
        group="Vegetation & surface",
        source="MODIS MOD09A1 band 4 via Microsoft Planetary Computer",
        native="8-day → monthly mean", resolution_m=500,
        coverage="2000–present", bounds=(0.0, 1.0),
    ),
    "surface_reflectance_nir2": dict(
        label="Surface reflectance — NIR2 (1240 nm)", unit="fraction",
        group="Vegetation & surface",
        source="MODIS MOD09A1 band 5 via Microsoft Planetary Computer",
        native="8-day → monthly mean", resolution_m=500,
        coverage="2000–present", bounds=(0.0, 1.0),
    ),
    "surface_reflectance_swir1": dict(
        label="Surface reflectance — SWIR1 (1640 nm)", unit="fraction",
        group="Vegetation & surface",
        source="MODIS MOD09A1 band 6 via Microsoft Planetary Computer",
        native="8-day → monthly mean", resolution_m=500,
        coverage="2000–present", bounds=(0.0, 1.0),
    ),
    "surface_reflectance_swir2": dict(
        label="Surface reflectance — SWIR2 (2130 nm)", unit="fraction",
        group="Vegetation & surface",
        source="MODIS MOD09A1 band 7 via Microsoft Planetary Computer",
        native="8-day → monthly mean", resolution_m=500,
        coverage="2000–present", bounds=(0.0, 1.0),
    ),
    # ------------------------------------------------------------ snow / cryosphere
    "ndsi": dict(
        label="Normalised difference snow index", unit="index",
        group="Snow & cryosphere",
        source="MODIS MOD10A1 NDSI via Microsoft Planetary Computer",
        native="daily → monthly mean", resolution_m=500,
        coverage="2000–present", bounds=(-1.0, 1.0),
    ),
    "snow_cover": dict(
        label="Snow cover fraction", unit="%",
        group="Snow & cryosphere",
        source="MODIS MOD10A1 NDSI snow cover via Microsoft Planetary Computer",
        native="daily → monthly mean", resolution_m=500,
        coverage="2000–present", bounds=(0.0, 100.0),
    ),
    "snow_albedo": dict(
        label="Snow albedo", unit="%",
        group="Snow & cryosphere",
        source="MODIS MOD10A1 snow albedo via Microsoft Planetary Computer",
        native="daily → monthly mean", resolution_m=500,
        coverage="2000–present", bounds=(0.0, 100.0),
    ),
}

# Requested by the product brief but not available from any free, no-login point
# API used here. Listed so the dossier can say "unavailable" instead of inventing.
REQUESTED_UNAVAILABLE: dict[str, dict[str, str]] = {
    "runoff": {
        "label": "Surface runoff",
        "source": "GLDAS / GPM land-hydrology subsets",
        "reason": "No free no-login monthly point endpoint; GLDAS is imagery-only in GIBS.",
    },
    "glacier_ice_thickness": {
        "label": "Glacier / ice-sheet thickness",
        "source": "NSIDC / IceBridge / altimetry",
        "reason": "Requires credentialed subsetting; only snow-mass imagery is available freely.",
    },
    "merra2_point": {
        "label": "MERRA-2 point meteorology",
        "source": "NASA GES DISC MERRA-2",
        "reason": "POWER/ERA5 provide the same meteorology at this point without login.",
    },
    "ceres_net_radiation": {
        "label": "CERES direct net radiation",
        "source": "NASA CERES",
        "reason": "Net radiation is derived from POWER shortwave/longwave up/down components.",
    },
    "viirs_point_series": {
        "label": "VIIRS point-level reflectance / LST / NDVI time series",
        "source": "VIIRS S-NPP / NOAA-20",
        "reason": "VIIRS is available as GIBS imagery only; free point-series API is not exposed.",
    },
}

# Ordering used by analysis, tables and charts. Keep the original core six at
# the head so the notebook stays legible; the rest follow by group.
PARAM_ORDER: list[str] = [
    "temperature",
    "precipitation",
    "ndvi",
    "humidity",
    "wind",
    "solar_radiation",
    "temperature_max",
    "temperature_min",
    "temperature_range",
    "dew_point",
    "skin_temperature",
    "apparent_temperature",
    "specific_humidity",
    "surface_pressure",
    "pressure_msl",
    "cloud_cover",
    "wind_10m",
    "wind_direction",
    "wind_gusts",
    "vapour_pressure_deficit",
    "sunshine_duration",
    "clear_sky_solar_radiation",
    "longwave_radiation",
    "net_radiation",
    "par",
    "rainfall",
    "snowfall",
    "evapotranspiration",
    "et_reference",
    "evaporation",
    "soil_moisture_surface",
    "soil_moisture_rootzone",
    "soil_moisture_profile",
    "soil_moisture_0_7cm",
    "soil_moisture_7_28cm",
    "soil_moisture_28_100cm",
    "soil_temperature_0_7cm",
    "soil_temperature_7_28cm",
    "frost_days",
    "aerosol_optical_depth",
    "pm2_5",
    "pm10",
    "nitrogen_dioxide",
    "sulphur_dioxide",
    "ozone",
    "carbon_monoxide",
    "dust",
    "uv_index",
    "evi",
    "lst_day",
    "lst_night",
    "surface_reflectance_red",
    "surface_reflectance_nir",
    "surface_reflectance_blue",
    "et_modis",
    "pet_modis",
    "gpp",
    "surface_reflectance_green",
    "surface_reflectance_nir2",
    "surface_reflectance_swir1",
    "surface_reflectance_swir2",
    "ndsi",
    "snow_cover",
    "snow_albedo",
]

# Values that are not ordinary scalars for regression.
ML_EXCLUDE = {"wind_direction"}

SATELLITE_PARAMS = {
    "ndvi", "evi", "lst_day", "lst_night", "surface_reflectance_red",
    "surface_reflectance_nir", "surface_reflectance_blue",
    "surface_reflectance_green", "surface_reflectance_nir2",
    "surface_reflectance_swir1", "surface_reflectance_swir2",
    "ndsi", "snow_cover", "snow_albedo",
    "et_modis", "pet_modis", "gpp",
}

SHORT_RECORD_PARAMS = {
    "pm2_5", "pm10", "nitrogen_dioxide", "sulphur_dioxide", "ozone",
    "carbon_monoxide", "dust", "uv_index",
}


def param_label(key: str) -> str:
    return PARAMETERS.get(key, {}).get("label", key.replace("_", " ").title())


def param_unit(key: str) -> str:
    return PARAMETERS.get(key, {}).get("unit", "")


def param_group(key: str) -> str:
    return PARAMETERS.get(key, {}).get("group", "Other")


def param_bounds(key: str) -> tuple[float | None, float | None]:
    lo, hi = PARAMETERS.get(key, {}).get("bounds", (None, None))
    return lo, hi


def parameter_meta(key: str) -> dict[str, Any]:
    rec = PARAMETERS.get(key, {})
    return {
        "label": rec.get("label", key),
        "unit": rec.get("unit", ""),
        "group": rec.get("group", "Other"),
        "source": rec.get("source", "unavailable"),
        "native": rec.get("native", "unknown"),
        "resolution_m": rec.get("resolution_m"),
        "coverage": rec.get("coverage"),
    }


def groups_payload() -> list[dict[str, Any]]:
    """Grouped parameter catalogue for the dossier/UI."""
    buckets: dict[str, list[dict[str, Any]]] = {g: [] for g in GROUPS}
    for key in PARAM_ORDER:
        rec = parameter_meta(key)
        rec["key"] = key
        buckets.setdefault(rec["group"], []).append(rec)
    return [{"name": g, "parameters": buckets.get(g, [])} for g in GROUPS]
