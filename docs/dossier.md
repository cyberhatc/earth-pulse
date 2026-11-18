# Per-location dossier (`GET /dossier`)

The notebook page (`/region/<slug>/notebook`) calls this endpoint for the
clicked coordinate (or the region centre when nothing is pinned). It returns a
single JSON payload with everything below, plus a printable HTML view at
`GET /dossier/report`.

## What is fetched and analysed

| Layer | Source | Access | Resolution / record |
|---|---|---|---|
| Point meteorology | NASA POWER monthly point API (chunked ≤25 params/request) | free, no key | 1981 → latest complete month; gridded ≈55 × 62 km |
| Air quality | Open-Meteo **CAMS** hourly → monthly | free, no key | 2023 → present; ≈11 km |
| Independent reanalysis | Open-Meteo **ERA5 archive** | free, no key | last 40 years, daily → monthly; ≈28 km |
| Global context | NASA GISS **GISTEMP v4** | free, no key | 1880 → present, global annual anomalies |
| Satellite time series | **Microsoft Planetary Computer** MODIS mosaic point API | free, no key | MOD13Q1 (250 m), MOD09A1 (500 m), MOD11A2 (1 km), MOD16A3GF/MOD17A3HGF (500 m), MOD10A1 (500 m) |
| Satellite imagery | NASA **GIBS / Worldview** tiles | free, no key | MODIS + VIIRS true/false colour, LST, NDVI/NDSI, snow mass/SWE, GLDAS |
| Scene imagery | **Microsoft Planetary Computer** STAC | free, no key | Sentinel-2 L2A (10 m) + Landsat 8/9 (30 m) thumbnails |
| Catalogue | the 26 sources in the project brief | mixed | each row carries a per-request status |

The point catalogue now contains 64 registry-backed parameters, grouped as
**Atmosphere**, **Radiation**, **Water & land**, **Air quality**,
**Vegetation & surface**, and **Snow & cryosphere**. It includes the brief's
reflectance bands (red/NIR/blue plus green/NIR2/SWIR1/SWIR2), NDVI/EVI, day and
night LST, NDSI/snow cover/snow albedo, meteorology, shortwave/longwave/PAR and
POWER-derived **net radiation**, trace gases + AOD, precipitation, soil moisture,
ET/PET/GPP. Runoff, glacier/ice thickness, MERRA-2 point subsets, direct CERES
net radiation and VIIRS point series are returned under
`requested_unavailable` with an explicit reason — never invented.

A never-seen coordinate is built **core first**: NASA POWER, ERA5, CAMS and
scene links are fetched, the store is written with `satellite_mode: "none"`, and
the MODIS mosaic backfill runs in a **separate process** (`pipeline/backfill_worker.py`)
so the server's urllib client is never shared across threads. The first response
therefore returns quickly with `satellite.pending: true`, and later requests
read the completed arrays. No satellite values are fabricated while pending.

The dossier deliberately requests a **nominal 10 × 10 km area of interest**
(`area.bbox`), and states the effective resolution of every source. No 40-year
source can resolve 10 km; the satellite thumbnails can, the time series cannot.
Nothing is upsampled to pretend otherwise.

## Statuses in the source table

- **used** — data was fetched for this request and flows into the analysis
  (NASA POWER, GIBS, Planetary Computer, Open-Meteo).
- **context** — fetched live but global-only (GISTEMP); never presented as a
  local measurement.
- **restricted** — needs a free NASA Earthdata login or a product/API key
  (Earthdata Search, LP DAAC, GES DISC, PO.DAAC, NSIDC, FIRMS). Values are not
  fabricated. Set `EARTHDATA_USERNAME` / `EARTHDATA_PASSWORD` (or
  `EARTHDATA_TOKEN`) to enable the AppEEARS NDVI path in
  `pipeline/fetch_highres_point.py`.
- **link** — reference source, not ingested.

## ML model

`models/point_ml.py` trains the repository's closed-form **ridge regression**
on 24-month lag windows plus month-of-year features, then rolls it forward
autoregressively for 60 months. Parameters with a complete record (no leading
gaps) share one multivariate model. Satellite and CAMS series, whose records
start after 1981, get a **separate ridge rollout fitted only over their real
observed span**: leading gaps are never edge-filled into the 1981 design matrix.
A transparent Theil–Sen trend + monthly-climatology baseline is blended in: ML
weight is high for the first year (the horizon the backtest validates) and
decays by year five. Blend weights and `models_by_parameter` are exposed under
`ml`. Every parameter with at least 18 observations gets a forecast; parameters
with fewer than 24 months fall back to the linear/seasonal trend forecast. The
rolling backtest is reported jointly for full-record parameters and per-parameter
for late-start series.

- Bands combine both one-step residual spreads and are scaled by `sqrt(horizon)`
  as a p10–p90 normal approximation.
- A **rolling-origin backtest** (12-month horizons) reports MAE, RMSE, pinball
  loss, p10–p90 coverage and skill versus a persistence baseline.
- **Forecast change** compares the mean of the final up-to-12 months of the
  horizon with the mean of the first up-to-12 months. This is seasonal-cycle
  safe; a raw first-vs-last-month difference would report the seasonal cycle
  (for example October vs September in a monsoon region), not a trend.
- The UI shows these metrics; the JSON includes them under `ml.backtest`.
- Forecasts are statistical extrapolations, not climate-model projections.

## Region-grounded chat (`POST /chat`)

`/region/<slug>/chat` sends the region slug, the selected coordinate, and the
case-file variable to `POST /chat`. The backend then builds facts from the same
point-level analysis used by the notebook dossier (`api/services/location_facts.py`):

- the real NASA POWER 1981→latest monthly record for that coordinate (not the
  synthetic sample grid);
- Theil–Sen/Mann–Kendall trends and rolling robust-z anomalies;
- the blended ridge-rollout forecast and its rolling backtest;
- ERA5 (Open-Meteo) and GISTEMP context when the caches already exist (the chat
  never blocks on a slow network fetch).

The facts dict carries `data_basis: "point"`, `region_slug`, and the case-file /
question focus. The RAG system prompt and the deterministic fallback are both
instructed to answer about that place, never substitute another region or
generic global averages, and never invent values for parameters that POWER does
not provide (NDVI, SST, sea level). If a point store cannot be built, chat falls
back to the grid and the facts explicitly say `data_basis: "grid"`.

Chat reuse: if the notebook already loaded the same coordinate and horizon, the
in-memory dossier cache is reused, including ERA5/GISTEMP.


## Data hygiene

NASA POWER uses `-999` as its missing-value fill. The loader maps it to `NaN`
and drops trailing months with no temperature, so trends, anomalies and the
forecaster never see a fake `-999` observation. This is covered by
`models/point_forecast.load_point_store`.

## Payload sections

```
mode              point_real | grid_demo
synthetic         false for point_real, true for grid_demo
data_basis        point | grid
area              bbox, width/height km, approx area, resolution note
coverage          parameters used, time range, per-parameter sources
history           monthly dates + series
trends            Theil–Sen slope/decade + Mann–Kendall p-value per parameter
forecast          ML model, dates, median + p10/p90 bands, next-move summary
ml                training shape + rolling backtest metrics
cross_check       Open-Meteo (ERA5) trends/series and GISTEMP context
anomalies         rolling robust-z ≥ 3 events
imagery           GIBS frames, STAC scenes, external links
sources           26-row catalogue with per-request status
explanation       deterministic facts-locked text
warnings          anything that failed, stated explicitly
```

## Frontend

`web/src/components/PointDossier.tsx` renders area, trends, observed charts,
forecast bands, ML backtest, independent cross-check, anomalies, imagery and
the source table. The **Open visual report ↗** button opens `/dossier/report`,
which prints to PDF without JavaScript.
