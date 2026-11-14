# Earth Pulse — Complete Handbook

> Everything about the system: architecture, data, models, accuracy, LLM, training, and how it all connects.

---

## 1. What Earth Pulse Does

Earth Pulse is an open-source climate explorer. Click anywhere on Earth (or search any place) and get:

- **Past ~40 years** of temperature, precipitation, vegetation, humidity, wind, solar radiation (where data exists)
- **5-year forecast** with uncertainty bands (p10 / p50 / p90)
- **Anomaly detection** (unusual events flagged with robust z-scores)
- **Opposite Trend Detector** — neighbouring regions moving in opposite directions
- **Climate twins** — K-Means clusters of similar climate signatures
- **Real satellite imagery** — MODIS true-colour, NDVI, snow, SST (GIBS tiles)
- **Time-lapse video** — animated GIF of observed satellite imagery, 2000→2025
- **AI scenario cards** — Stable Diffusion "what-if" illustrations (labelled, never observations)
- **Plain-English explainer** — templated narrative (LLM optional)
- **Multilingual** (EN / HI / KN), low-bandwidth mode, dark/light theme

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NASA / Partner Open Data                  │
│  POWER · GIBS · MODIS · Sentinel-2 · GPM · FIRMS · CMR     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  pipeline/  (Python)                                         │
│  fetch_power · fetch_gibs · fetch_gridded · fetch_firms       │
│  fetch_highres_point · fetch_ndvi_sentinel · clean · features │
│  land_ocean mask · cache (TTL) · export_store → .npz         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  engine/  (precompute, offline)                              │
│  Theil-Sen slope · Mann-Kendall significance                 │
│  Opposite Trend Detector (ndvi & precipitation)              │
│  K-Means climate twins (k=8)  →  analysis.json               │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  models/  (train + inference)                                │
│  RidgeRollout forecaster (p10/p50/p90) · anomaly (robust z)  │
│  backtest (rolling origin) · projected SVG maps              │
│  scenario_image (Stable Diffusion img2img, offline GPU)       │
│  point_forecast (per-location, linear trend + seasonality)    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  api/  (FastAPI)                                             │
│  /health  /place  /point  /imagery/*  /trends  /twins        │
│  /forecast  /anomalies  /tier-b  /explain  /point/imagery    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  web/  (React + Vite + TypeScript + MapLibre GL)             │
│  Map · Charts · Imagery gallery · Time-lapse video (GIF)      │
│  Coverage badge · Opposite cards · Explainer · i18n (EN/HI/KN)│
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Data Sources & Resolution

| Product | Resolution | Period | Used for | Login? |
|---|---|---|---|---|
| NASA POWER (point API) | ~0.5° source, interpolated to point | 1981→present | temperature, precipitation, humidity, wind, solar | No |
| MODIS MOD13Q1 NDVI | 250 m, 16-day | 2000→present | vegetation greenness | Earthdata (AppEEARS terms) |
| Sentinel-2 L2A | 10 m | 2015→present | NDVI (computed from B04/B08) + imagery | No (Planetary Computer) |
| GPM IMERG | 0.1°, 30-min | 2000→present | high-res precipitation | Earthdata (optional) |
| MODIS LST | 1 km | 2000→present | land surface temperature | Earthdata (optional) |
| GIBS MODIS true-colour | 250 m–1 km | 2000→present | map tiles, time-lapse video | No |
| Sentinel-2 / Landsat | 10–30 m | 2013/2015→present | satellite imagery | No (Planetary Computer) |
| FIRMS | point (hotspots) | near-real-time | fire detections | Optional key |

**Honesty rule:** no single product gives 40 years at 1 km. POWER gives the 40-year climate record at point level; Sentinel-2 adds 10 m imagery/NDVI from 2015; MODIS adds 250 m NDVI from 2000. Forecasts are probabilistic (p10–p90). Never claim native 1 km 40-year continuity where it does not exist.

---

## 4. Data Flow — Grid Mode (`/place`)

1. User clicks `(lat, lon)` on the MapLibre map.
2. Frontend → `GET /place?lat=..&lon=..&horizon_months=60`.
3. API finds nearest 15° grid cell.
4. Per-parameter availability check (finite count ≥ 12); masked params dropped.
5. Past time series extracted + linear gap fill.
6. Trends from precomputed `analysis.json` (Theil-Sen + Mann-Kendall).
7. Forecast: RidgeRollout (if artifact present) or linear-trend+seasonal fallback, filtered to usable params, clipped to physical bounds.
8. Anomalies: rolling robust z (61-month window, 3.5σ).
9. Opposite-trend pairs (up to 4, preferring pairs touching the clicked cell).
10. Climate twin label (K-Means cluster).
11. GIBS past imagery thumbnails.
12. `data_coverage` assembled (synthetic flag, sources, time range, gap notes, ocean_cell, relevance).
13. Templated explainer (facts → plain English).
14. Return unified `PlacePayload` (schema 1.0.0).

## 5. Data Flow — Hi-Res Point Mode (`/point`)

1. `GET /point?lat=..&lon=..&horizon_months=60`.
2. Load or build per-location store: `data/processed/points/point_<lat>_<lon>.npz`.
3. Build (if missing): fetch POWER (1981→present) + Sentinel-2 NDVI (2019→2025, 10m, no login) + land/ocean mask + imagery scene links.
4. Analyse: point trends (Theil-Sen/MK), rolling robust-z anomalies, linear-trend+seasonality 60-month forecast (p10/p90, clipped), next-move summary.
5. Return point payload (schema 1.0.0) with `next_move` (direction + magnitude per parameter).

---

## 6. ML Models

### 6.1 Forecasting — RidgeRollout
- **Type:** Multivariate ridge regression with autoregressive rollout.
- **Training:** `models/train.py` pools all grid cells → (113,760 samples × 192 lag features) → targets (8 variables). Trains in ~1 s.
- **Input:** 24 months of lag features (all variables).
- **Output:** next 60 months (5 years), mean + p10/p90 bands (1.645 × residual std × √step).
- **Artifact:** `models/artifacts/forecaster.npz` + `forecaster_meta.json`.
- **Fallback:** `linear_trend_seasonal_forecast` (Theil-Sen trend + monthly climatology of residuals) when no artifact.
- **Point mode:** uses linear-trend+seasonal (robust, no training needed) with physical bounds clipping.

### 6.2 Anomaly Detection
- **Method:** Rolling robust z-score: `(x − rolling_median) / (1.4826 × rolling_MAD)`.
- **Window:** 61 months. **Threshold:** |z| ≥ 3.5 → flag as high/low, moderate/high severity.
- **Optional:** Isolation Forest (disabled by default).

### 6.3 Trend Estimation
- **Theil-Sen slope:** median of all pairwise slopes (robust to outliers).
- **Mann-Kendall test:** non-parametric trend significance (p < 0.05 → significant).
- **Output:** slope per decade, p-value, significant flag, direction (increasing/decreasing/no trend/insufficient data).

### 6.4 Opposite Trend Detector
- Grid neighbour graph (radius = 1 step).
- For NDVI and precipitation: flag pairs with opposite slope signs.
- Both significant → `strength: strong`; else `weak`. Ranked by min(|slope_a|, |slope_b|).
- Up to 120 pairs per parameter.

### 6.5 Climate Twins
- K-Means (k=8) on per-cell mean [temperature, precipitation, ndvi, sst].
- NaN-safe (masked params filled with column mean).
- Standardized features.

### 6.6 Backtest (accuracy)
- Rolling-origin evaluation: train on prefix, evaluate next 24 months.
- Metrics: MAE, RMSE, PICP (prediction interval coverage), bias.
- Compared against baselines: persistence, seasonal naive, linear trend.

**Measured accuracy (3 grid cells, temperature):**

| Metric | Value |
|---|---|
| MAE | 0.67–0.90 °C |
| RMSE | 0.81–1.14 °C |
| PICP (p10–p90 coverage) | **96–100%** |
| Bias | -0.15 to -0.36 °C |

PICP of 96–100% means the uncertainty bands contain the actual value 96–100% of the time — exceeding the 95% target. The MAE of ~0.7–0.9 °C monthly is reasonable for climate forecasting.

**Precipitation backtest:**

| Metric | Value |
|---|---|
| MAE | 10.9–16.0 mm/month |
| RMSE | 14.6–19.8 mm/month |
| PICP | **100%** |
| Bias | -1.7 to -3.1 mm/month |

---

## 7. AI Image Generation (Scenarios)

- **Model:** Stable Diffusion v1.5 (runwayml/stable-diffusion-v1-5), img2img pipeline.
- **Downloaded:** 5.11 GB, cached in `~/.cache/huggingface/hub`.
- **Guardrails:**
  1. Refuses unless `configs/model.yaml → scenario_image.enabled: true` or `EP_SCENARIO_IMAGES=1`.
  2. Refuses without `acknowledge_not_observation=True`.
  3. Always carries label: "AI-generated scenario — not an observation".
  4. Refuses without a source image (latest real GIBS tile).
- **Process:** Conditioning JSON (prompts, deltas, tile URL) → Stable Diffusion img2img → 3 PNGs (lower/median/upper) at 640×640.
- **Generation never happens inside HTTP** — runs offline via CLI (GPU recommended, CPU works with fewer steps).
- **CLI:** `EP_SCENARIO_IMAGES=1 python models/scenario_cards.py --generate --lat X --lon Y --parameter ndvi`
- **Output:** `models/artifacts/scenarios/p<lat>_p<lon>_<param>_<variant>.png`

---

## 8. LLM / Explainer

- **Current backend:** Templated (always works, no network, no keys).
- **Planned:** Gemini free tier (`GEMINI_API_KEY`) and HF Inference API (`HF_TOKEN`).
- **Contract:** The LLM is forbidden to alter numbers — it only words them. Input is facts-only (numbers, coverage, uncertainty).
- **Endpoint:** `POST /explain` accepts `{ "facts": {...} }` → returns `{ text, generator, confidence }`.
- **Status:** Gemini backend is plumbed in `docker-compose.yml` but not yet wired in `explainer.py`.

---

## 9. Training Points

### Grid model (RidgeRollout)
- **Data:** Synthetic sample store (498 months × 240 cells) or real POWER store.
- **Samples:** 113,760 pooled (all cells, sliding windows).
- **Features:** 24-month lag × 8 variables = 192 features.
- **Targets:** next-month values for all 8 variables.
- **Regularization:** Ridge (λ=1e-2), standardized features/targets.
- **Training time:** ~1 second on CPU.
- **Command:** `make train` or `python models/train.py --input <store> --output models/artifacts/forecaster.npz`

### Real data training
- Build real store: `python pipeline/build_real_power_store.py` (~10 min, 240 cells).
- Train: `EP_STORE_PATH=data/processed/earth_pulse_power_real.npz python models/train.py ...`
- Engine: `EP_STORE_PATH=... EP_ANALYSIS_PATH=... python engine/run_engine.py ...`
- Serve: `EP_STORE_PATH=... EP_ANALYSIS_PATH=... uvicorn api.main:app`

### Point model
- No training needed — uses linear-trend + seasonal profile (transparent, robust).
- Location-specific: each point gets its own trend/forecast.

---

## 10. Data Points & Accuracy

### Grid store
- **Cells:** 240 (10 lats × 24 lons, 15° spacing).
- **Months:** 498 (1985-01 → 2026-06).
- **Variables:** 8 (temperature, precipitation, ndvi, sst, sea_level, solar_radiation, humidity, wind).
- **Mask:** SST & sea level = NaN over land; NDVI = NaN over ocean (illustrative 15° dominant-class mask).

### Hi-Res point store
- **Temperature/precip/humidity/wind/solar:** NASA POWER (1981→present, ~551 months).
- **NDVI:** Sentinel-2 L2A (10m, 2019→2025, ~5-60 clear scenes depending on cloud cover).
- **Resolution:** POWER ~0.5° source (interpolated to point); Sentinel-2 10m imagery; video ~1km.

### Accuracy guarantees
- Robust stats (Theil-Sen/Mann-Kendall) alongside ML.
- Probabilistic forecasts only (p10/p50/p90).
- `data_coverage` reports which params/sources/years were used per place.
- Observed vs Forecast vs AI-scenario visually distinct.
- Synthetic data labeled everywhere.
- Strict JSON (no NaN/Infinity tokens).

---

## 11. How Everything Connects (End Goal)

1. **User clicks a place** (or searches) → frontend sends `GET /place` or `GET /point`.
2. **API assembles payload**: trends (Theil-Sen + MK), forecast (ridge or linear), anomalies (robust z), opposite trends, climate twin, GIBS imagery, coverage, explainer.
3. **Frontend renders**: coverage badge → charts (past + forecast band) → imagery → time-lapse video → opposite cards → explainer → next-move (point mode).
4. **Accuracy maintained** through: robust statistics, probabilistic bands, backtest validation (PICP 96-100%), physical bounds clipping, honest masking.
5. **ML model** trained on real/synthetic data, validated via rolling-origin backtest.
6. **LLM** (planned) words numbers into plain English without altering them.
7. **Image generation** creates illustrative "what-if" scenarios, never presented as observations.

---

## 12. Running Everything

```bash
# Python deps
pip install numpy scipy fastapi uvicorn httpx pydantic pytest

# Build + test
make sample-data engine train test   # synthetic store -> analysis -> artifact -> tests
make api                            # http://localhost:8000
cd web && npm install && npm run dev # http://localhost:5173

# Real data (optional, ~10 min)
python pipeline/build_real_power_store.py
EP_STORE_PATH=data/processed/earth_pulse_power_real.npz EP_ANALYSIS_PATH=data/processed/analysis_power_real.json \
  python engine/run_engine.py --input data/processed/earth_pulse_power_real.npz --output data/processed/analysis_power_real.json
EP_STORE_PATH=... EP_ANALYSIS_PATH=... uvicorn api.main:app --port 8000

# Hi-Res point (any location)
python scripts/build_belgaum.py --lat 15.8497 --lon 74.4977
# or via API: GET /point?lat=..&lon=..

# AI scenarios (GPU)
EP_SCENARIO_IMAGES=1 python models/scenario_cards.py --generate --lat X --lon Y --parameter ndvi

# Network sharing
uvicorn api.main:app --host 0.0.0.0 --port 8000
cd web && npm run dev -- --host 0.0.0.0
```

---

## 13. File Inventory

| Folder | Key files | Purpose |
|---|---|---|
| `pipeline/` | fetch_power, fetch_gibs, fetch_gridded, fetch_firms, fetch_highres_point, fetch_ndvi_sentinel, clean, build_features, land_ocean, cache, auth, discover, export_store, run_pipeline, build_real_power_store | Data ingestion, cleaning, masking, caching, store export |
| `engine/` | run_engine, trends, opposite, climate_twins | Robust trends, opposite detector, clustering |
| `models/` | forecast, infer, train, anomaly, backtest, project_maps, scenario_image, scenario_cards, point_forecast, dataset, download_models | ML forecast, anomaly, backtest, maps, AI scenarios, point analysis |
| `api/` | main, deps, schemas, routers/* (place, point, imagery, trends, forecast, anomalies, explain, health, tierb, scenario), services/* (store, ondemand, explainer) | FastAPI backend |
| `web/` | src/pages/Home, src/components/* (MapView, PlacePanel, Charts, ImageryGallery, TimeLapse, ...), src/lib/* (api, i18n, format), src/types/payload | React frontend |
| `tests/` | test_pipeline, test_trends, test_models, test_opposite, test_scenario, test_payload_schema, test_api | pytest suite |
| `docs/` | architecture, data-sources, api-contract, ml, ui-ux, deploy, limitations, real-data-ingestion, scenario-images, power-real-store, highres-belgaum, colab-scenario, parallel-prompts, submission-checklist | Documentation |
| `scripts/` | build_belgaum, verify_offline | Build & verification scripts |
| `notebooks/` | 01_explore_power_gibs, 02_train_forecast, 03_backtest, 04_scenario_images | Jupyter notebooks |

---

## 14. Status Summary

| Component | Status |
|---|---|
| Backend API | ✅ Running, 40/40 tests pass |
| Frontend | ✅ Typecheck + build pass |
| Grid mode (synthetic) | ✅ Working |
| Hi-Res point mode (real POWER + Sentinel-2 NDVI) | ✅ Working for any lat/lon |
| 5-year forecast | ✅ Ridge (grid) / linear (point), p10-p90 |
| Anomaly detection | ✅ Rolling robust z |
| Opposite trend detector | ✅ 81-120 pairs |
| Climate twins | ✅ K-Means k=8 |
| Time-lapse video (GIF) | ✅ ~1km resolution, cached |
| AI scenario images | ✅ SD 1.5, 3 PNGs generated |
| LLM explainer | ⚠️ Templated only (Gemini planned) |
| Multilingual | ⚠️ EN/HI/KN keys present, partial |
| Real POWER store | ⚠️ Build in progress (background) |
| Network sharing | ✅ localhost.run tunnel active |

---

*Earth Pulse — NASA Space Apps Challenge 2026 — "Be An Earth System Trend Detective"*
*Code: MIT License | Data: follow provider terms | Built for free-tier deployment*
