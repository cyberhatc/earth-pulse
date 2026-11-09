# NASA (and partner) data sources — what to use, where to get it, how much history

Earth Pulse is built **only** on free, open data. This document lists every source,
what parameters it provides, how to access it, and — critically — **how many years of
history you can realistically get**. Coverage varies by variable; never claim "40 years
for everything" in the UI. Per-parameter coverage is surfaced in the app via
`data_coverage` (see `configs/params.yaml`).

Legend: **access** = how the code fetches it · **history** = typical start of usable record.

---

## 1. NASA Earthdata (hub) + Earthdata Search
- **What:** discovery + download for almost all NASA Earth-observation products (DAAC holdings).
- **Gives you:** virtually any gridded/remote-sensing variable, via CMR / `earthaccess`.
- **Access:** `earthaccess` Python API or direct OPeNDAP/download. Requires a **free Earthdata login** (set `EARTHDATA_USERNAME` / `EARTHDATA_PASSWORD`).
- **History:** product-dependent (see per-DAAC rows below).
- **Links:** https://www.earthdata.nasa.gov · https://search.earthdata.nasa.gov
- **In this repo:** `pipeline/auth.py` (login), `pipeline/discover.py` (CMR discovery), `pipeline/fetch_gridded.py` (OPeNDAP/xarray fetch).

## 2. NASA Giovanni
- **What:** quick, interactive time-series and area-average analysis across hundreds of variables.
- **Gives you:** many of the same variables as time series/maps — ideal for **prototyping and validation**, not bulk production.
- **Access:** web UI; some service endpoints. Best used to sanity-check the numbers produced by this repo.
- **Links:** https://giovanni.gsfc.nasa.gov

## 3. NASA GIBS / Worldview
- **What:** global **map tile layers** (near-real-time + historical), best for showing imagery on click and past views.
- **Gives you:** true color, corrected reflectance, NDVI/EVI layers, fires/thermal anomalies, aerosols, SST, snow/ice, precipitation, blue marble.
- **Access:** **GIBS WMTS** tiles, e.g. `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/<layer>/default/<date>/GoogleMapsCompatible_Level9/<z>/<y>/<x>.jpg|png`. No key.
- **History:** layer-dependent; most modern MODIS/VIIRS layers are ~2000+.
- **Links:** https://worldview.earthdata.nasa.gov
- **In this repo:** `pipeline/fetch_gibs.py` builds tile URLs; the frontend `LayerToggles`/`ImageryGallery` render them.

## 4. LP DAAC (land) — via Earthdata
- **What:** land surface and vegetation.
- **Gives you:** **NDVI/EVI** (MODIS MOD13A3/MYD13A3), **LST** (MOD11A2), land cover, evapotranspiration (MOD16A2), burned area.
- **Access:** earthaccess/OPeNDAP, subset by bounding box or point.
- **History:** ~**2000–present** for MODIS (VIIRS continues post-2012). **Not 40 years.**
- **Links:** https://lpdaac.usgs.gov

## 5. GES DISC (precipitation / atmosphere) — via Earthdata
- **What:** precipitation, soil moisture, atmospheric composition, aerosols.
- **Gives you:** **precipitation** (GPM IMERG V07; TRMM V7 before it), humidity, surface met fields, aerosol optical depth.
- **Access:** earthaccess / OPeNDAP; subset to monthly.
- **History:** GPM/IMERG **~2000–present** (stitch with TRMM 1998–2015 carefully). **Not 40 years** for the consistent record. MERRA-2 lives here too (see §11).
- **Links:** https://disc.gsfc.nasa.gov

## 6. PO.DAAC (ocean) — via Earthdata
- **What:** ocean physics — sea surface temperature, sea level, winds, salinity, currents.
- **Gives you:** **SST** (e.g., GHRSST MUR 0.01° daily), **sea-level anomalies** (satellite altimetry).
- **Access:** earthaccess / PO.DAAC APIs / OPeNDAP.
- **History:** SST MUR **~2002–present**; altimetry **~1993–present**. **Not 40 years.**
- **Links:** https://podaac.jpl.nasa.gov

## 7. NSIDC (cryosphere) — via Earthdata
- **What:** ice sheets, snow, sea ice.
- **Gives you:** sea-ice concentration/extent (Sea Ice Index / SMMR–SSM/I), snow cover fraction.
- **Access:** earthaccess / direct.
- **History:** sea-ice concentration **~1979–present** (product-dependent); snow cover similar; ice-sheet products vary.
- **Links:** https://nsidc.org

## 8. NASA POWER
- **What:** agroclimatology / energy-oriented point time series.
- **Gives you:** **T2M (mean/max/min), precipitation, solar radiation (ALLSKY_SFC_SW_DWN), relative humidity (RH2M), wind speed (WS2M), surface pressure (PS)** — queried for any lat/lon.
- **Access:** **POWER REST API, no key**, e.g. `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M&latitude=..&longitude=..&start=1981&end=2024&format=JSON`.
- **History:** ~**1981–present** (parameter-dependent; solar & met core are long).
- **Links:** https://power.larc.nasa.gov/data-access-viewer/
- **In this repo:** `pipeline/fetch_power.py` (Tier A on-click); sample demo also uses MERRA-2-style series.

## 9. NASA GISS (GISTEMP)
- **What:** global surface air temperature anomaly.
- **Gives you:** monthly global & coarse-grid anomaly context.
- **Access:** published datasets (CSV), https://data.giss.nasa.gov/gistemp/.
- **History:** **1880–present**. Perfect for long-term context, not local full-field mapping.

## 10. NASA FIRMS (fire hotspots)
- **What:** near-real-time active fire / thermal anomaly detections.
- **Gives you:** fire pixel detections (MODIS/VIIRS), fire radiative power.
- **Access:** FIRMS API with a **free map key** (`FIRMS_MAP_KEY`), e.g. `https://firms.modaps.eosdis.nasa.gov/api/area/csv/<key>/MODIS_NRT/<W,S,E,N>/<day_range>`.
- **History:** ~**2000–present**.
- **In this repo:** `pipeline/fetch_firms.py`; used as an anomaly/event signal, not a continuous climate field.

## 11. MERRA-2 (NASA GMAO reanalysis, via GES DISC)
- **What:** the best **NASA backbone for 40+ years** of consistent multivariate fields.
- **Gives you:** 2m temperature, total precipitation, humidity, winds, radiation, pressure — consistently across **1980–present**.
- **Access:** earthaccess/OPeNDAP; monthly means (e.g., `M2TSMNXSLV`, `M2TMNXPER` collections).
- **History:** **1980–present (~45 years).** This is what powers genuine 40-year multivariate training in Earth Pulse.
- **Note:** ERA5 (Copernicus, 1940–present) can extend further but is not NASA; it is listed in the README as an allowed partner source.

## 12. Partner / supplementary sources (from README)
| Source | What it adds | History |
|---|---|---|
| **USGS EarthExplorer (Landsat)** | Real historical **photos/scenes** of any place | 1972–present (practical continuous ~1984+) |
| **Copernicus CDS (ERA5)** | 5th-generation atmospheric reanalysis | **1940–present** |
| **NOAA NCEI** | Global weather/climate records, GHCN | varies |
| **Open-Meteo** | Free weather API, no key — forecast companion | recent years |
| **Global Forest Watch** | Forest loss/gain | ~2000–present |
| **JRC Global Surface Water** | Surface water occurrence change | ~1984–2021 |
| **OpenAQ** | Air quality | varies |
| **IMD / data.gov.in** | India-specific weather & open govt data | varies |
| **World Bank Open Data** | Country indicators | varies |
| **Hugging Face Hub** | Hosting trained models/datasets | n/a |

---

## How much history can you honestly get? (the 40-year check)

| Parameter | Source | Realistic range |
|---|---|---|
| Air temperature / solar / humidity / wind / pressure (point) | NASA POWER | **~1981–present** |
| Consistent multivariate met (gridded) | MERRA-2 | **1980–present** |
| Global temperature anomaly context | GISTEMP | **1880–present** |
| Sea ice concentration | NSIDC | **~1979–present** (product-dependent) |
| Sea surface temperature | PO.DAAC MUR | ~2002–present |
| Sea level (altimetry) | PO.DAAC | ~1993–present |
| NDVI/EVI, LST, evapotranspiration, burned area | LP DAAC (MODIS) | **~2000–present** |
| Precipitation (satellite) | GPM IMERG / TRMM | ~2000–present |
| Fire hotspots | FIRMS | ~2000–present |
| Real-scene imagery | Landsat | 1972–present |

**Bottom line:** a genuine **~40-year backbone** exists (MERRA-2 / NASA POWER / GISTEMP / NSIDC sea ice, plus ERA5 if you opt in). Modern-sensor parameters (NDVI, SST, sea level, fires) have **~20–25 years** — do not stretch them. The app always reports per-parameter coverage, trains multivariate models on the **overlap period**, and shows gaps instead of hiding them.

---

## Practical fetch order used by Earth Pulse
1. **Tier A (on click, instant):** NASA POWER point series + GIBS imagery tiles + FIRMS events (if key) + precomputed gridded trends/forecasts. No login, no heavy downloads.
2. **Tier B (on demand, bounded):** `discover.py` queries CMR/OPeNDAP for the exact product coverage at that point; subsets and caches. Results are merged into the place payload with an explicit `data_coverage` report.
3. **Precompute (offline/CI):** the full globe is processed into a Zarr store by `pipeline/run_pipeline.py` + `engine/run_engine.py`; the API serves ready-made results keyed by grid cell.

## Licensing & citation
- NASA Earthdata data are generally free and open; **cite NASA Earthdata** and the specific product (e.g., "MODIS/Terra Vegetation Indices, LP DAAC") per each provider's terms.
- Code is MIT. See `LICENSE`.
