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
- **Deployment:** one Render Docker web service (`render.yaml`) — FastAPI serves the built Vite app **and** the API from the same URL; GitHub Pages / Vercel / Netlify remain possible for the frontend only

## 7. Free-Tier Stack

Everything can run at zero cost. Free plans change, so check current limits.

- Code: GitHub
- Frontend hosting: same-service on Render (recommended) · Vercel / Netlify / GitHub Pages optional
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
- **`web/`** — React + Vite + TypeScript frontend (**Leaflet** map, conversation-first UI, fact-locked Ollama chat, live coverage/forecast/opposite/twin/evidence cards, dark theme, localStorage dossier). In dev it proxies `/api` → `:8000`; in production the backend serves `web/dist` directly from the same origin. `cd web && npm install && npm run dev` (http://localhost:3000).
- **`docs/`** — architecture, data sources (with the honest 40-year coverage check), API contract, ML/accuracy notes, UI/UX spec, free deployment guide, parallel-session prompts.
- **`notebooks/`, `tests/`, CI** — 01 explore NASA POWER/GIBS · 02 train · 03 backtest; pytest suite; GitHub Actions CI + Pages deploy.

### Quickstart (offline)
```bash
pip install numpy scipy fastapi uvicorn httpx pydantic pytest
make sample-data engine train test   # deterministic demo store → analysis.json → artifact → tests
make api                             # http://localhost:8000 (try /place?lat=12.97&lon=77.59)
cd web && npm install && npm run dev  # http://localhost:3000 (Vite proxies /api -> :8000)
```
`docker compose up --build api` runs the **single-service** image on :8000 (API + built frontend), or run native: `npm run build` in `web/` first, then `uvicorn api.main:app --port 8000` — same URL for the app and `/api/*`. `render.yaml` deploys that image to Render as one free Docker web service (`healthCheckPath: /api/health`); see `docs/deploy.md`.

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
| `web/` | React + Vite + TS + Leaflet; `npm run build` → ~366 KB JS (114 KB gzip); served same-origin by the API in production |
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

> **Superseded by sections 19–21 (2026-11-16):** the significance figures above came from the old monthly Mann–Kendall on seasonally raw series (inflated). Corrected stats (deseasonalised annual means + TFPW + Benjamini–Hochberg FDR) and the 2.5° store are below. Kept for history.

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

`POST /chat` now has an optional retrieval layer, keeping the facts-locked design (the LLM never computes a number; guards reject certainty claims, p-value misuse, band misuse, non-significant-as-significant, and invented numbers — on every backend):

```bash
python3 scripts/build_rag_kb.py --sync-space   # build data/rag/kb.json (BM25 KB: docs + NASA POWER/method notes + store-derived coverage)
# in nasa/.env (not committed): EP_RAG_BACKEND=hf-router   # or hf + HF_RAG_SPACE_URL
#   (needs HF_TOKEN with "Make calls to Inference Providers" — huggingface.co → Settings → Access Tokens → edit token)
uvicorn api.main:app --port 8000
```

With `EP_RAG_BACKEND=hf-router`, answers carry `sources: [{id, title, source}]` (rendered as a muted "Sources" line in the chat UI); local BM25 retrieval + HF serverless inference — no servers. **Note:** this account currently gets HTTP 402 from HF for serverless calls — it needs pre-paid credits or PRO. A fully free alternative is live at **https://devildead-earth-pulse-ai.static.hf.space/** (on-device WebGPU, linked from the chat UI via "On-device AI ↗"). If the RAG backend is down, chat falls back to Ollama, then to templated prose — never a hard failure. Design, deploy runbook, token setup and rollback: `docs/rag.md`.

## 19. REAL 2.5Â° global store, corrected statistics, backtest + conformal calibration (v0.4.x Â· 2026-11-16)

This session executed Phases 1â€“4 of `docs/BACKEND_PLAN.md`. Everything below was run on this tree.

**Phase 1 â€” real 2.5Â° store (`data/processed/earth_pulse_real.{zarr,npz}`)** â€” no login:
- Temperature: **GISTEMP v4 LOTI** anomalies (2Â°, degC vs 1951â€“1980 baseline) â€” anomalies, clearly labelled; GISTEMP publishes no absolute gridded field.
- Precipitation: **GPCP v2.3** monthly, 1979â†’present, mm/month (converted from mm/day).
- SST: **NOAA ERSST v5**, 1854â†’present, degC, ocean-only (real NOAA lsmask re-applied post-regrid).
- NDVI, sea level, solar radiation, humidity, wind: **unavailable without logins/products â€” NaN, never faked.**
- Grid 72Ã—144 (2.5Â°), 550 months 1981-01â†’2026-10, `data/processed/manifest.json`, `source: GISTEMP_v4_LOTI + GPCP_v2.3 + ERSST_v5`, `synthetic_demo: false`.

```bash
python pipeline/build_store.py --fast      # ~2 min (sources cached)
make real-analysis                          # -> data/processed/analysis_real.json (schema 1.1.0)
EP_STORE_PATH=$PWD/data/processed/earth_pulse_real.npz \
EP_ANALYSIS_PATH=$PWD/data/processed/analysis_real.json uvicorn api.main:app --port 8000
# try /place?lat=12.97&lon=77.59&horizon_months=60
```
- Honest gridding notes: POWER is point-only and was NOT used for the grid; temperature is an interpolated analysis; GPCP/ERSST regridded by bilinear with nearest-finite fill; masks re-applied after regrid.
- Engine on real store: temperature **FDR-significant 73.9%** of cells (raw 79.2%); precipitation **FDR 26.4%** (raw 37.2%); SST **FDR 42.3%**. Validation vs GISTEMP: EP global-mean T trend **+0.272 Â°C/decade** vs GISTEMP **+0.212** (abs diff **0.06**) â€” `reports/trend_validation.md`.

**Phase 2 â€” statistics engine rewrite** (`engine/trend.py`, `engine/preprocess.py`, `engine/field_significance.py`):
- Deseasonalise vs 1991â€“2020 climatology â†’ annual-mean series (min 10 finite months/yr) â†’ **Sen slope + Mannâ€“Kendall headline on annual means**, with **Yueâ€“Wang TFPW pre-whitening** (lag-1 autocorrelation corrected; reported), and seasonal Mannâ€“Kendall on monthly anomalies alongside.
- **Benjaminiâ€“Hochberg FDR across all cells** (q=0.05) with both raw and FDR-adjusted flags; `schema_version 1.1.0` gains `ci_low/ci_high`, `p_value_uncorrected`, `p_value_seasonal`, `p_value_fdr`, `tau`, `lag1_autocorr`, `autocorr_corrected`, `fdr_summary` per variable.
- Cross-checked vs `pymannkendall` (S/z/tau exact match) and `scipy.stats.theilslopes`; 10 new tests (`tests/test_trend_v2.py`).

**Phase 3 â€” honest backtest** (`models/evaluate.py`, rolling origin every 24 months from 2005, horizon 60, 24 stratified cells, prefix-only training):
- `climatology_trend` (Theilâ€“Sen + monthly climatology) beats seasonal-naive and `direct_ridge` at every horizon; per-variable MASE: temperature 0.69â€“0.85 (skill to hâ‰ˆ60), precipitation 0.71â€“0.82 (marginal), **SST unskillful beyond ~6 months** â€” do not present SST forecasts as trustworthy past h=6.
- `direct_ridge` never beats the baseline â†’ not shipped as default. Ridge artifact trained (`models/artifacts/forecaster_power_real_grid.npz`) remains opt-in via `EP_FORECAST_ARTIFACT`.
- Full numbers: `reports/forecast_backtest.{json,md}`.

**Phase 4 â€” conformal calibration** (`models/conformal.py`): absolute-residual split conformal on the backtest residuals; nominal 0.80 â†’ empirical **0.797/0.802**, nominal 0.90 â†’ **0.896**, nominal 0.50 â†’ **0.500**. `/place` now serves `band_method: "conformal"` with a `calibration` block (`empirical_coverage_p10_p90`, `calibration_date`); widths apply only to the fingerprinted store (`models/infer.py`). `EP_BAND_METHOD=sqrt_h` reverts. `reports/calibration.{json,md}`.

**Backend fixes folded in** (full review: see `docs/VERIFICATION.md` and commit log): SPA-fallback path traversal closed; ~20 text I/O calls now explicit `utf-8` (un-breaks Windows; 4 RAG tests pass); `/place` backtest failure degrades to `null` instead of HTTP 500; NASA POWER `-999` sentinel filtered; `/imagery/scenario` parameter whitelist; CORS default tightened; rate limiter evicts stale buckets; unpinned deps pinned (`requirements.txt` + mirrors + CI); `docker-compose.yml` no longer shadows the baked forecaster artifact; junk `lhr2.err`/`lt.err` removed; `pytest` **80 passed**.

**Honest bottom line**: the real store is genuinely real (GISTEMP/GPCP/ERSST), the statistics are defensible (TFPW-prewhitened MK + FDR), the forecast intervals are calibrated to ~nominal coverage, and the accuracy claims are now traceable to `reports/` â€” including the unflattering ones (SST skill ends ~6 months; no neural/ridge model beats the transparent baseline).
## 20. Parallel track: Opposite Trend Detector v2, API v1.1 hardening, frontend pass & handoff (v0.5 · 2026-11-16)

**Phase 5 — Opposite Trend Detector v2** (`engine/opposite_v2.py`): 8-neighbourhood pairs with **dateline-wrap** (longitude periodic, latitude clamped at poles); both partners must be **Benjamini–Hochberg FDR-significant** *and* slopes must clear a per-variable **minimum effect size** (e.g. precipitation ≥ 0.5 mm/month per decade). Contiguous same-sign cells merge into **patches**; patch pairs are ranked by magnitude × area. Each flagged pair ships a **case file** (slopes with CIs, p/FDR-p, coverage, patch areas) with **CANDIDATE hypotheses** from a curated YAML (`data/knowledge/case_hypotheses.yaml`) — explicitly labelled hypotheses, never conclusions, and never generated by an LLM. A **random-permutation null baseline** (trend multiset shuffled across the grid) reports the chance expectation alongside the observed count:

- sample store: 8 NDVI patch-pairs / 6 precipitation patch-pairs (eligible cells 105/150) — **no clustering beyond chance** (p≈0.67 / p≈1.0);
- real store: precipitation **53 patch-pairs, 326 cell-pairs vs null expectation 1294** (p≈1.0) — **no evidence of spatial clustering beyond chance**. Reported as such, not as a discovery.

Wiring: engine (`opposite_meta` in `analysis*.json`), API (`/place.opposite_meta`, `/trends/opposite.opposite_meta`), tests (`tests/test_opposite_v2.py`), report: `reports/opposite_trends.md`.

**Phase 7 — API v1.1 hardening (schema `1.1.0`, additive-only)**: pydantic response models on `/place`, `/health`, `/chat`, `/explain` (all `extra="allow"`); `lon` normalised to [-180, 180) on **every** endpoint (out-of-range values accepted then normalised, not 422 — contract-safe); structured JSON request logging + `X-Request-ID`; 1 MiB request-size cap (413); `RequestValidationError` → `{error: "validation_error"}`; `/health` extended (`api_version`, `uptime_seconds`, `manifest_hash` (sha256[:16] of `manifest.json`), `models` block with conformal/artifact provenance); `POST /chat` input caps (12 msgs, 4000 chars/msg); facts cap on `/explain`; CORS default tightened; rate-limiter bucket eviction; SPA-fallback path traversal closed; `/place` backtest degrades to `null` instead of 500. **Contract-snapshot tests** pin the top-level shape of 12 endpoints (`tests/test_contract_snapshots.py`). Full addendum: `docs/api-contract.md` (Schema 1.1.0).

**`/place` performance fix**: the rolling-origin ridge backtest ran on **every request** (~2–4s CPU). Now cached per `(cell, artifact config)` (`api/routers/place.py`); sequential `/place` p50 went **~2.8s → ~0.13s** (see `docs/performance.md` — measured numbers, incl. the GIL/concurrency caveat and the `EP_RATE_LIMIT_PER_MIN` 429 trap).

**`GET /forecast`** grew additive `horizon_months` + `issued` (matches the `/place.forecast` block).

**Frontend pass** (`web/`): renamed package `earth-pulse-web`; removed dead deps (`@google/genai`, `lucide-react`, `motion`, `dotenv`, Tailwind stack — 86 packages); fixed the **ref-during-render** bug so landing scroll/animation effects actually run (typed refs, typed Lenis instance — no more `__lenis`); wired the fetch timeout to the caller's `AbortSignal`; memoized investigation context; persisted chat trimmed to 50; non-JSON responses raise a clear `ApiError`; static-space `?region=` param no longer reaches `innerHTML`; favicon added; dead tunnel URLs removed from `vercel.json` ×2; duplicate `#main-content` fixed; `"use client"` directives removed. `npm ci` (275 pkgs), `npm run typecheck`, `npm test` (13), `npm run build` all green.

**Handoff**: `docs/CONTINUATION.md` is the guide book for the next agent/environment (current state, verification commands, environment quirks — PowerShell 5.1, repo-local git identity, no Docker, no Earthdata login — ranked list of what remains, landmines). A `HANDBOOK.md` banner points there; `HANDBOOK.md` itself is stale (v0.1–v0.3 stack).

**Honest bottom line (v0.5)**: the signature feature now ships with a chance baseline and survives the null (no clustering beyond chance — said so), the API validates its public shape in CI, the demo frontend no longer ships dead weight or broken effects, and the handoff is written down. Remaining caveats unchanged: SST forecasts unskillful past ~6 months; demo store synthetic by default; no Docker verification on this machine.
