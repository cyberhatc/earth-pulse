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
| Explainer | Local Ollama LLM (default `qwen2.5:1.5b`) + templated fallback | Turn pre-computed facts into plain English without inventing numbers |

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
| Pick variables, register for the challenge, set up the repo |
| Team sync, download and clean data |
| Trend engine and Opposite Trend Detector |
| Forecasting model |
| Anomaly detection and web map |
|  Frontend polish, kick-off event |
|  Bonus features, README, demo video (submission opens 9:00 AM) |
| Final fixes, submit before 11:59 PM |

## 9. Team Roles



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
- **`models/`** — multivariate ridge-rollout forecaster with p10–p90 bands (real-POWER artifact `data/processed/forecaster_power_real.npz`, synthetic demo artifact `models/artifacts/forecaster.npz`; the loader picks the one trained on the same store distribution), transparent linear-trend fallback, rolling robust-z anomalies, rolling-origin backtest, dependency-free **SVG projected maps**, optional (disabled-by-default) AI scenario module.
- **`api/`** — FastAPI serving **unified `GET /place?lat&lon` payload** (trends, forecast, anomalies, opposite trends, GIBS past imagery, projected SVG maps, explainer), `/imagery/projected`, `/tier-b`, `/health` (including local-LLM status), and **`POST /chat`** (facts-locked Ollama conversation). Dockerfile for HF Spaces/Render free tier.
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

---

## 15. Implementation status — verified 2026-11-09, 10:06 IST (Session D/E/F append)

Everything below was **run and verified on this tree on Nov 9, 2026**; see `docs/parallel-prompts.md` status log. Full detail: `docs/limitations.md` (honest limits) and `docs/submission-checklist.md` (Space Apps pre-submit QA).

**Implemented pieces (all verified today)**

| Piece | What ships |
|---|---|
| `pipeline/` | deterministic synthetic store generator (`--sample` → `data/samples/earth_pulse_sample.npz`, 498 months 1985-01→2026-06, 240-cell 15° grid), NASA POWER fetch, GIBS tiles, FIRMS/OPeNDAP/CMR (opt-in) |
| `engine/` | Theil–Sen + Mann–Kendall per cell → `data/processed/analysis.json` (407 KB), Opposite Trend Detector (120+120 candidate pairs), K-Means climate twins |
| `models/` | ridge-rollout forecaster; real-POWER artifact `forecaster_power_real.npz` (126,480 pooled samples), synthetic demo artifact `forecaster.npz`, p10–p90 bands, backtest, projected SVG maps; store-matched artifact selection |
| `api/` | FastAPI `GET /health` (LLM status), `/place`, `/imagery/past|projected`, `/trends/cell|/opposite`, `/twins`, `/forecast`, `/anomalies`, `/tier-b`, `POST /explain`, **`POST /chat`** (local Ollama) — schema_version `1.0.0` |
| `web/` | React + Vite + TS + MapLibre; `npm run build` = 51 modules / 1.0 MB JS (286 KB gzip) |
| `docs/` | architecture, api-contract, data-sources, deploy, ml, ui-ux, **limitations (new)**, **submission-checklist (new)** |

**Verified today (actual outputs, not claims)**

- `docker compose config` → parses; services `api`, `web`. ✅
- `docker compose build api` → image **`nasa-api:latest`** built: python-3.12-slim + numpy/scipy/fastapi/uvicorn, sample + engine + **train** executed at build time (artifact baked in). First attempt hit a transient PyPI metadata error for scipy; retry succeeded. ✅
- `uvicorn api.main:app --port 8000` → `/health` `{"status":"ok","schema_version":"1.0.0","sample_store":true,"store":{"synthetic":false,"provenance":"nasa_power_monthly_1981_present"},"analysis":true}`; `/place?lat=12.97&lon=77.59` → full payload (ridge_rollout forecast, 4 opposite-trend pairs, templated explainer, climate_twin); `/imagery/projected?parameter=temperature&year=2030` → SVG; `/tier-b` → **fetched 596 months of real NASA POWER data, cached**. ✅
- `cd web && npm install && VITE_API_BASE=http://localhost:8000 npm run build` → ✅ (API base confirmed embedded in `dist/assets/*.js`); `npm run preview -- --port 4173` → HTML + JS + CSS + favicon all HTTP 200. ✅

**Quickstart (all offline-capable)**

```bash
pip install numpy scipy fastapi uvicorn httpx pydantic pytest
make sample-data engine train test   # synthetic store → analysis.json → artifact → tests
make api                             # http://localhost:8000/health
cd web && npm install && npm run build && npm run preview   # http://localhost:4173
docker compose up --build            # same stack in containers (image verified above)
```

**Limitations** — the demo store is synthetic (15°×15° grid, trends baked in); the default real-POWER store has no NDVI/SST/sea-level, so those parameters are omitted rather than faked; forecast skill decays with horizon and the local 1.5B LLM is small (post-generation guards reject certainty claims, p-value misreadings, p10–p90 band misreadings, false significance claims, and any number absent from the facts, then fall back to deterministic prose); Gemini/HF explainer backends remain optional and are not required (`/docs-payload` likewise future). Specifics: `docs/limitations.md`.

## 15. Land/ocean mask + AI scenario cards (v0.2.0)

- **Mask layer** (`pipeline/land_ocean.py`): demo store now masks SST/sea level over land and NDVI over ocean (illustrative 15° dominant-class mask, labeled). Production mask derives from real SST NaN fraction — see `docs/real-data-ingestion.md`.
- **Tier B cache** (`pipeline/cache.py`): POWER/FIRMS responses cached in `data/cache/` (TTL `EP_CACHE_TTL`).
- **AI scenario cards** (`models/scenario_image.py` + `models/scenario_cards.py` + notebook 04): disabled-by-default, GPU-offline pipeline; `GET /imagery/scenario` returns conditioning only — generation never happens inside HTTP. Always labeled "AI-generated scenario — not an observation". See `docs/scenario-images.md`.
- **Strict JSON**: engine writes `allow_nan=False`; masked parameters are omitted from API payloads (UI shows explicit "No coverage").
- Quick check: `python3 models/scenario_cards.py --lat 12.97 --lon 77.59 --parameter ndvi` (prints prompts, no GPU needed).

## 16. REAL NASA data is now wired in — no credentials needed (v0.3.0)

The demo ships a deterministic synthetic store, but the repo can now build and serve a **real, measured/modelled NASA POWER record (1981-01 → 2026-11, monthly, 240 cells, 0 failures)** with zero login:

```bash
python3 pipeline/build_real_power_store.py     # ~10 min, 240 open NASA POWER calls, cached
python3 engine/run_engine.py --input data/processed/earth_pulse_power_real.npz \
    --output data/processed/analysis_power_real.json
EP_STORE_PATH=$PWD/data/processed/earth_pulse_power_real.npz \
EP_ANALYSIS_PATH=$PWD/data/processed/analysis_power_real.json uvicorn api.main:app --port 8000
```

Highlights from the first real run: global mean warming **+0.21 °C/decade** (115/240 cells significant), Siberian cell **+0.67 °C/decade, p=0.004**; NDVI/SST/sea level honestly absent (POWER has none); strict JSON; `data_coverage` flips `synthetic_demo: false` automatically. Details & verification: `docs/power-real-store.md`.

For the full real stack (NDVI/SST/sea level from MODIS/PO.DAAC + real mask) you need a free **NASA Earthdata login** — see `docs/real-data-ingestion.md`.

## 17. High-resolution, real-data path (Belgaum case study)

Sub-kilometre analysis for a single place is now supported via the point-level
pipeline:

```bash
python3 scripts/build_belgaum.py            # builds data/processed/point_15m8497_74m4977.npz + .json
uvicorn api.main:app --port 8000
# GET /point?lat=15.8497&lon=74.4977&horizon_months=60
```

See `docs/highres-belgaum.md` for the resolution ladder (POWER 40-yr point series,
MODIS 250 m NDVI, Sentinel-2 10 m imagery), the AI scenario-card image
generation pipeline, and the frontend 🛰 Hi-Res / 📍 Belgaum controls.

## 18. RAG chatbot — retrieval-augmented, facts-locked narration (v0.4.0)

`POST /chat` now has an optional retrieval layer and a Hugging Face Space backend, keeping the facts-locked design (the LLM never computes a number; guards reject certainty claims, p-value misuse, band misuse, non-significant-as-significant, and invented numbers — on every backend):

```bash
python3 scripts/build_rag_kb.py --sync-space   # builds data/rag/kb.json (BM25 KB: docs + NASA POWER/method notes + store-derived coverage) and syncs hf-space/
# after creating a Space at huggingface.co/spaces (Docker SDK, free CPU):
EP_RAG_BACKEND=hf HF_RAG_SPACE_URL=https://<you>-earth-pulse-rag.hf.space uvicorn api.main:app --port 8000
```

With `EP_RAG_BACKEND=hf`, answers carry `sources: [{id, title, source}]` (rendered as a muted "Sources" line in the chat UI); with the Space down, chat falls back to Ollama, then to templated prose — never a hard failure. Design, deploy runbook, token setup and rollback: `docs/rag.md`.
