# NASA POWER primer (curated summary)

Curated by the Earth Pulse team from NASA's public documentation. This is a
plain-English summary for the chatbot's knowledge base, not an official NASA
text. When in doubt, consult the official source: https://power.larc.nasa.gov

## What NASA POWER is
NASA POWER (Prediction Of Worldwide Energy Resources) provides solar and
meteorological time series for renewable-energy, building, and agroclimatology
applications. It fuses satellite observations and model reanalysis into a
analysis-ready monthly (and daily) time series, distributed free of charge via
the POWER API, with no login required for most parameters.

## Why Earth Pulse uses it
- Free, open, reproducible — matches the project's open-data rule.
- Monthly resolution matches the app's trend detection (Theil–Sen + Mann–Kendall).
- Long record: the MERRA-2-based backbone starts around 1980/1981, which is
  enough for 40+ years of trend estimation per cell — but per-parameter
  coverage still differs and must always be reported, never assumed.

## Parameters NASA POWER provides (used by Earth Pulse)
- Temperature (T2M): 2-meter air temperature, in °C.
- Precipitation (PRECTOTCORR): bias-corrected total precipitation, mm/month (or mm/day in daily products).
- Solar radiation (ALLSKY_SFC_SW_DWN): all-sky surface shortwave downward irradiance; POWER publishes Wh/m²/day or kWh/m²/day depending on community (Earth Pulse uses community=RE, metric, kWh/m²/day).
- Relative humidity (RH2M): 2-meter relative humidity, %.
- Wind speed (WS2M): 2-meter wind speed, m/s.

## What NASA POWER does NOT provide
- NDVI / vegetation index — use MODIS/VIIRS via LP DAAC (~2000–present), not POWER.
- Sea surface temperature — use PO.DAAC / MUR GHRSST (~2002–present), not POWER.
- Sea-level height — use altimetry products (~1993–present), not POWER.
Earth Pulse reports these as **unavailable** at POWER-backed cells rather than
inventing values.

## Grid and resolution
The POWER community=RE native grid is roughly 0.5° × 0.625°. Earth Pulse ships
an illustrative 15° × 15° grid (10 latitudes × 24 longitudes = 240 cells) so
the hackathon build stays small and fast; the finest click point is the
nearest 15° cell center, not sub-cell truth. Real deployments should regrid to
the native POWER resolution or finer.

## Community, units and access
- Community: RE (renewable energy) is the default for agroclimatology use in Earth Pulse.
- Access: HTTPS API at power.larc.nasa.gov — no key required. `pipeline/fetch_power.py` shows the request pattern used here.
- Provenance string in the store metadata: `nasa_power_monthly_1981_present`.

## Honest caveats
- POWER is satellite+model agroclimatology, not a physical weather station at your exact location.
- Parameter record lengths differ; "1981–present" applies to the POWER backbone, not to MODIS-era parameters.
- POWER monthly values are regional/point agroclimatology; local microclimates differ.
- Trend estimates are statistical associations in the record, not causal attribution to human activity.
