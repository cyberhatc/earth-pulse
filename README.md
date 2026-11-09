# Earth Pulse

**An open-source, AI-powered explorer of how every place on Earth has changed over the last 40 years.**

Built for the NASA Space Apps Challenge 2026, challenge: *Be An Earth System Trend Detective*.

---

## 1. The Idea

Click anywhere on the globe and instantly see how that place has changed: temperature, vegetation, rainfall, and sea level. Earth Pulse draws the long-term trend, forecasts the next few years, flags unusual events, and explains it all in plain English.

The signature feature is the **Opposite Trend Detector**: it finds neighbouring regions that are changing in opposite directions (one drying while the neighbour gets wetter) and explains why that can happen.

## 2. Who It Helps

- Students and teachers who want climate data without reading raw charts
- Journalists who need quick, credible visuals
- Researchers who want cleaned, ready-to-use datasets and trained models

## 3. Data Sources

| Data | Source | URL |
|---|---|---|
| Main hub for all NASA Earth data | NASA Earthdata | https://www.earthdata.nasa.gov |
| Search and download | Earthdata Search | https://search.earthdata.nasa.gov |
| Quick time-series analysis | NASA Giovanni | https://giovanni.gsfc.nasa.gov |
| Global imagery for map layers | NASA Worldview and GIBS | https://worldview.earthdata.nasa.gov |
| Land surface and vegetation | LP DAAC | https://lpdaac.usgs.gov |
| Precipitation | GES DISC | https://disc.gsfc.nasa.gov |
| Sea level and ocean physics | PO.DAAC | https://podaac.jpl.nasa.gov |
| Ice sheets, snow, sea ice | NSIDC | https://nsidc.org |
| Weather and solar data | NASA POWER | https://power.larc.nasa.gov |
| Global temperature anomalies | NASA GISS | https://data.giss.nasa.gov/gistemp |
| Fire hotspots | NASA FIRMS | https://firms.modaps.eosdis.nasa.gov |
| Challenge page | NASA Space Apps 2026 | https://www.spaceappschallenge.org/2026/challenges/ |
| Suggested datasets and starter code | Space Data Atlas | https://spacedata.swapniltamse.com |
| Historical global weather since 1940 | Copernicus Climate Data Store | https://cds.climate.copernicus.eu |
| Global weather and climate records | NOAA NCEI | https://www.ncei.noaa.gov |
| Free weather API, no key needed | Open-Meteo | https://open-meteo.com |
| Forest loss and gain | Global Forest Watch | https://www.globalforestwatch.org |
| Surface water change | JRC Global Surface Water | https://global-surface-water.appspot.com |
| Satellite archive | USGS EarthExplorer | https://earthexplorer.usgs.gov |
| Air quality | OpenAQ | https://openaq.org |
| Climate data for India | India Meteorological Department | https://mausam.imd.gov.in |
| Open government data for India | data.gov.in | https://data.gov.in |
| Country indicators | World Bank Open Data | https://data.worldbank.org |
| Dataset search | Google Dataset Search | https://datasetsearch.research.google.com |
| Datasets and models | Hugging Face | https://huggingface.co/datasets |

Suggested variables: sea surface temperature, vegetation greenness (NDVI), precipitation, and sea level. Use monthly gridded files.

## 4. Features

**Core**

1. Global trend map with a time slider
2. Click-to-inspect charts for any location
3. Opposite Trend Detector for neighbouring regions moving in opposite directions
4. Forecasting with uncertainty bands
5. Anomaly detection for sudden unusual events

**Signature**

6. Earth Memory: a place and a year that matters to you
7. Ground Truth Check: citizen reports compared with satellite data
8. Opposite Trend Detective: mystery case files for flagged regions

**Bonus**

9. Climate twins clustering
10. Plain-English language explainer
11. Multilingual and low-bandwidth mode (English, Hindi, Kannada and more)
12. Time-lapse, side-by-side compare, shareable cards, watchlist alerts, voice mode, public API

## 5. AI/ML Layers

| Layer | Model | Purpose |
|---|---|---|
| Trend estimation | Theil-Sen slope, Mann-Kendall test | Robust long-term trend per grid cell |
| Forecasting | LSTM or temporal transformer | Predict the next few years |
| Anomaly detection | Autoencoder or Isolation Forest | Flag unusual events automatically |
| Clustering | K-Means or HDBSCAN | Find climate twins |
| Explainer | Language model API | Turn numbers into a short story |

## 6. Architecture

- **Data layer:** download from Earthdata, clean with xarray, store as Zarr or NetCDF
- **Analysis layer:** Python with NumPy, SciPy, pymannkendall, scikit-learn, PyTorch
- **API layer:** FastAPI serving trends, forecasts, and anomalies per location
- **Frontend:** React with MapLibre GL or Leaflet, plus Plotly or D3 for charts
- **Deployment:** Vercel, Netlify, or GitHub Pages for the frontend, Hugging Face Spaces or Render for the API

## 7. Free-Tier Stack

Everything can run at zero cost. Free plans change, so check current limits.

- Code: GitHub
- Frontend hosting: Vercel, Netlify, or GitHub Pages
- API hosting: Hugging Face Spaces or Render
- Training: Google Colab and Kaggle notebooks
- Models and datasets: Hugging Face Hub
- Database for citizen reports: Supabase free tier
- Maps: MapLibre GL with OpenStreetMap tiles
- Language explainer: open models on Hugging Face or a free Gemini tier

**Staying free:** precompute everything, keep grids coarse, train on free GPUs, cache API calls, avoid paid map services.

## 8. Eight-Day Plan

| Day | Goal |
|---|---|
| Sun Nov 8 | Pick variables, register for the challenge, set up the repo |
| Mon Nov 9 | Team sync, download and clean data |
| Tue Nov 10 | Trend engine and Opposite Trend Detector |
| Wed Nov 11 | Forecasting model |
| Thu Nov 12 | Anomaly detection and web map |
| Fri Nov 13 | Frontend polish, kick-off event |
| Sat Nov 14 | Bonus features, README, demo video (submission opens 9:00 AM) |
| Sun Nov 15 | Final fixes, submit before 11:59 PM |

## 9. Team Roles

| Person | Role | Owns |
|---|---|---|
| Devil | Lead and architect | Overall design, trend engine, Opposite Trend Detector, integration |
| Experienced teammate | Machine learning | Forecasting and anomaly detection |
| Teammate at lead's level | Data pipeline | Earthdata download, cleaning with xarray, climate twins |
| Frontend teammate | Frontend | Map, time slider, charts, case file view |
| Beginner teammate | Support | README, testing, screenshots, demo video, explainer |

Agree on a shared JSON format for trend results on day one.

## 10. Repo Layout

```text
earth-pulse/
  README.md
  LICENSE
  data/
  pipeline/
  engine/
  models/
  api/
  web/
  notebooks/
  docs/
  tests/
```

## 11. Setup

1. Clone the repository from GitHub.
2. Create a free NASA Earthdata account and save your login as an environment variable.
3. Install the Python requirements and run the pipeline script.
4. Run the trend engine to produce the trend files.
5. Start the API locally, then start the web app.
6. Open the app and click anywhere on the globe.

## 12. Open Source

- Code license: MIT
- Data: follow each provider's terms and cite NASA Earthdata
- Contributions welcome via pull requests

## 13. Credits

Data courtesy of NASA Earthdata and partner space agencies. Built for the NASA Space Apps Challenge 2026.

---

## 14. What's implemented in this repo (v0.1.0)

This repository now contains a **working offline-first implementation** of the Earth Pulse stack (deterministic synthetic demo store; swap in real NASA products for research):

- **`pipeline/`** — sample store generator (`--sample`), NASA POWER point fetcher, GIBS tile builder, FIRMS fires (optional key), MERRA-2/MODIS/GPM OPeNDAP fetch path, CMR discovery, cleaning + feature engineering.
- **`engine/`** — Theil–Sen + Mann–Kendall trends for all grid cells, **Opposite Trend Detector** (NDVI/precipitation), K-Means **climate twins** → `data/processed/analysis.json`.
- **`models/`** — multivariate ridge-rollout forecaster with p10–p90 bands (trained artifact `models/artifacts/forecaster.npz`), transparent linear-trend fallback, rolling robust-z anomalies, rolling-origin backtest, dependency-free **SVG projected maps**, optional (disabled-by-default) AI scenario module.
- **`api/`** — FastAPI serving **unified `GET /place?lat&lon` payload** (trends, forecast, anomalies, opposite trends, GIBS past imagery, projected SVG maps, explainer), `/imagery/projected`, `/tier-b`, `/health`. Dockerfile for HF Spaces/Render free tier.
- **`web/`** — React + Vite + TypeScript + **MapLibre GL** frontend (click anywhere → charts with uncertainty ribbon, imagery gallery, case-file cards, coverage badge, EN/HI/KN, low-bandwidth mode, localStorage watchlist). `cd web && npm install && npm run dev`.
- **`docs/`** — architecture, data sources (with the honest 40-year coverage check), API contract, ML/accuracy notes, UI/UX spec, free deployment guide, parallel-session prompts.
- **`notebooks/`, `tests/`, CI** — 01 explore NASA POWER/GIBS · 02 train · 03 backtest; pytest suite; GitHub Actions CI + Pages deploy.

### Quickstart (offline)
```bash
pip install numpy scipy fastapi uvicorn httpx pydantic pytest
make sample-data engine train test   # deterministic demo store → analysis.json → artifact → tests
make api                             # http://localhost:8000 (try /place?lat=12.97&lon=77.59)
cd web && npm install && npm run dev # http://localhost:5173
```
`docker compose up` works too (API + web). See `docs/deploy.md` for free hosting (HF Spaces + Vercel/Netlify/Pages).

### Honest limitations
Bundled demo data is **synthetic** (physically motivated, deterministic). Real accuracy requires real products (`docs/data-sources.md`) and overlap-period training; forecasts are probabilistic (p10–p90), not certain futures. Never claim "40 years" for NDVI/SST/sea level (~2000/2002/1993 onward).
