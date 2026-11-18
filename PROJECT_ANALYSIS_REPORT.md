# Earth Pulse — Project Analysis Report

**Repository:** `cyberhatc/earth-pulse` (NASA Space Apps Challenge 2026, *Be An Earth System Trend Detective*)  
**Analysis date:** 2026-11-16  
**Working copy analyzed:** `/root/chat/2026-11-16/session-f2468c8e-2f4b-4eb3-ab87-9d572e648462/opencode`

---

## 1. Executive Summary

Earth Pulse is an open-source, AI-assisted explorer for understanding how places on Earth have changed over time (up to ~40 years where data exists). The application combines a **FastAPI backend**, a **Python data/analysis/ML pipeline**, and a **React + Vite + TypeScript frontend** to provide location-based climate/environment insights including trends, forecasts, anomalies, opposite-trend detection, imagery, and plain-English explanations.

This codebase includes an **offline-first demo mode** backed by a deterministic synthetic sample store, with documented paths to integrate real NASA/open data sources (e.g. NASA POWER, GIBS, FIRMS, MODIS/PO.DAAC, etc.).

---

## 2. Repository Structure (High-Level)

| Area | Purpose |
|---|---|
| `api/` | FastAPI app, routers, schemas, services; serves API and (in production) built frontend |
| `pipeline/` | Data ingestion/export utilities (sample store generation, NASA POWER/GIBS/FIRMS/CMR hooks, cleaning/features/caching) |
| `engine/` | Precomputation of trends, opposite-trend pairs, and climate twins (`analysis.json`) |
| `models/` | Forecasting, anomaly detection, backtesting, scenario/image helpers, trained artifacts |
| `web/` | React + Vite + TypeScript frontend (Leaflet/map UI, pages, API client) |
| `configs/` | App/dataset/model/parameter configuration |
| `docs/` | Architecture, API contract, data sources, ML notes, deployment, limitations, checklists, RAG docs |
| `tests/` | Python test suite |
| `notebooks/` | Exploration/training/backtesting/scenario notebooks |
| `scripts/` | Utility scripts (e.g. point/high-res builds, RAG KB build) |
| `hf-space/`, `static-space/` | Deployment-related space artifacts |
| Root files | `Dockerfile`, `docker-compose.yml`, `Makefile`, `render.yaml`, `vercel.json`, etc. |

**Scale (observed):** ~1345 source/doc files (`.py`, `.ts`, `.tsx`, `.md`) in the repository tree.

---

## 3. Architecture & Data Flow

### 3.1 Core layers
- **Data layer (`pipeline/`)**: builds/loads data stores (demo synthetic `.npz` or real-data paths), fetches external sources where configured.
- **Analysis layer (`engine/`)**: computes robust trend statistics and derived insights per grid cell.
- **Model layer (`models/`)**: generates forecasts with uncertainty bands and anomaly-related outputs; supports backtesting and artifact selection.
- **API layer (`api/`)**: assembles unified, location-based payloads for the frontend (Tier A precomputed/instant path; optional Tier B/on-demand hooks).
- **Frontend layer (`web/`)**: map-first UI for exploring a location’s past/present/forecast and explanations.

### 3.2 On-click flow (Tier A)
1. User selects/clicks a location in the web UI.
2. Frontend calls backend endpoint(s) (e.g. `/place?lat&lon`) via `/api` proxy in dev.
3. Backend resolves nearest grid cell and returns a unified payload: coverage/provenance, historical timeseries, trends, forecast (with uncertainty), anomalies, opposite trends, imagery references, climate twin info, and explanation.
4. UI renders charts/cards/maps/explanations with explicit coverage and uncertainty labeling.

### 3.3 Deployment model (as designed)
- Single-service deployment supported: FastAPI can serve `web/dist` and API from the same origin (`/` SPA + `/api/*`).
- Also supports split/static frontend deployments (e.g. Vercel/Netlify/GitHub Pages) with configured API base.

---

## 4. Key Components & Capabilities

### 4.1 API (`api/main.py`, `api/routers/*`)
- **Framework:** FastAPI + Uvicorn, CORS enabled, lightweight in-process rate limiting (`EP_RATE_LIMIT_PER_MIN`, default 120/min).
- **Routers included:** `health`, `place`, `imagery`, `trends`, `forecast`, `anomalies`, `explain`, `tierb`, `scenario`, `point`, `chat` (mounted at root and under `/api` prefix for compatibility).
- **Notable endpoints/features (from app/docs/types):**
  - `GET /health` (and `/api/health`): status, store/analysis/LLM/RAG metadata
  - `GET /place?lat=&lon=`: unified location payload (trends, forecast, anomalies, opposite trends, imagery, coverage, explainer, climate twin)
  - `GET /imagery/...` (including projected imagery endpoints as documented)
  - `GET /tier-b` / on-demand discovery hooks (opt-in/bounded)
  - `GET /point?...` for point/high-resolution flows
  - `POST /chat` for facts-locked chat/RAG-assisted narration (backend-dependent)
- **SPA serving:** if `web/dist` exists, `/` serves frontend and unknown non-API paths fall back to SPA `index.html`.

### 4.2 Pipeline (`pipeline/`)
- **Demo store generation:** `pipeline/run_pipeline.py --sample` → `data/samples/earth_pulse_sample.npz` (deterministic synthetic demo).
- **Additional fetch/discovery commands:** NASA POWER point fetch, GIBS imagery URLs, FIRMS hotspots, coverage discovery (as implemented/available).
- **Real-data support hooks:** scripts/utilities exist for building real stores (e.g. NASA POWER real store build, documented in repo docs).
- **Caching/processing utilities:** `cache.py`, `clean.py`, `features.py`, `land_ocean.py`, etc.

### 4.3 Engine (`engine/run_engine.py`, `engine/trends.py`, `engine/opposite.py`, `engine/climate_twins.py`)
- **Inputs:** gridded store (e.g. sample `.npz`)
- **Outputs:** `data/processed/analysis.json`
- **Computed artifacts (sample run):**
  - Per-cell trends (Theil–Sen slope per decade + Mann–Kendall significance) for available variables
  - Opposite-trend pairs (e.g. NDVI and precipitation)
  - Climate twins via K-Means clustering on selected features
- **Sample run observed:** 498 months × 240 cells (10×24), opposite pairs `ndvi=81`, `precipitation=120`, analysis written (~419 KB).

### 4.4 Models (`models/`)
- **Forecasting:** multivariate ridge-rollout forecaster with uncertainty bands (p10/p50/p90 style outputs as exposed by API schema/types); artifact-based inference.
- **Training:** `models/train.py` trains on store and writes `models/artifacts/forecaster.npz` (+ metadata).
- **Sample training observed:** pooled samples `(113760, 192) -> (113760, 8)`, artifact written to `models/artifacts/forecaster.npz`.
- **Other capabilities present:** anomaly detection, backtesting, projected map/SVG utilities, optional scenario image/card generation (documented; often disabled/offline/GPU-dependent paths).

### 4.5 Frontend (`web/`)
- **Stack:** React 19, Vite 8, TypeScript, React Router, Leaflet, Tailwind (v4 plugin), and additional UI/animation libs.
- **Dev server:** Vite on port `3000`, host `0.0.0.0`; proxy `/api` → `http://localhost:8000`.
- **Routing/pages (`web/src/App.tsx`):**
  - `/` → Landing page
  - `/regions` → Regions listing
  - `/region/:slug` → Region hub
  - `/region/:slug/chat` → Region chat
  - `/region/:slug/map` → Region map
  - `/region/:slug/notebook` → Region notebook
- **API client/types:** `web/src/lib/api.ts` defines typed contracts for place payloads, trends, forecasts, anomalies, coverage, chat sources, etc.
- **UX intent (from docs/code):** map-first exploration with coverage/uncertainty-aware presentation and explainability/chat features.

### 4.6 Documentation & Ops
- Rich documentation in `docs/` (architecture, API contract, data sources, ML, UI/UX, deployment, limitations, RAG, real-data ingestion, submission checklist, etc.).
- `Makefile` targets for setup/data/engine/train/test/api/web/build.
- Containerization and deployment configs: `Dockerfile`, `docker-compose.yml`, `render.yaml`, `vercel.json`.

---

## 5. Data, Accuracy, and Honesty Characteristics (from repo design)

- **Demo mode:** bundled/sample store is deterministic and synthetic (labeled as such in API health/store metadata).
- **Coverage/provenance:** payloads include `data_coverage` and parameter availability/relevance information.
- **Uncertainty-aware forecasts:** probabilistic outputs (bands/interval-style presentation) rather than single certain predictions.
- **Robust trend analysis:** combines statistical trend/significance methods (e.g. Theil–Sen, Mann–Kendall) with ML components.
- **Optional advanced features:** RAG/LLM explainers and scenario generation are configuration-dependent and have fallbacks (e.g. templated explanations when LLM/RAG unavailable).

---

## 6. Work Performed in This Session (Local Environment)

### 6.1 Repository acquisition and workspace setup
1. Retrieved source for `https://github.com/cyberhatc/earth-pulse`.
   - Direct `git clone`/`curl` attempts encountered environment crashes; repository was successfully downloaded via Python `urllib` and extracted.
2. Created working folder: `opencode/` inside the session workspace.
3. Copied repository contents into:  
   `/root/chat/2026-11-16/session-f2468c8e-2f4b-4eb3-ab87-9d572e648462/opencode`

### 6.2 Dependency installation
- **Python:** installed required packages using `python3 -m pip install --break-system-packages` (system venv creation unavailable due to missing `ensurepip`):  
  `numpy`, `scipy`, `fastapi`, `uvicorn[standard]`, `pydantic`, `httpx`, `pytest`
- **Frontend:** installed dependencies with `npm --prefix web install` (completed successfully).

### 6.3 Demo data, analysis, and model artifact preparation
Executed in `opencode/`:
1. `python3 pipeline/run_pipeline.py --sample`  
   - Generated `data/samples/earth_pulse_sample.npz` (demo store)
2. `python3 engine/run_engine.py --input data/samples/earth_pulse_sample.npz --output data/processed/analysis.json`  
   - Generated `data/processed/analysis.json` (trends, opposite pairs, climate twins)
3. `python3 models/train.py --input data/samples/earth_pulse_sample.npz --output models/artifacts/forecaster.npz`  
   - Generated `models/artifacts/forecaster.npz` (+ metadata)

### 6.4 Local hosting (backend + frontend)
Started both services in background:

- **Backend (FastAPI/Uvicorn)**
  - Command: `python3 -m uvicorn api.main:app --host 0.0.0.0 --port 8000`
  - PID: `745`
  - Log: `/tmp/ep-api.log`
  - Status: running, health endpoint responding `200 OK`

- **Frontend (Vite dev server)**
  - Command: `npm run dev -- --port 3000 --host 0.0.0.0` (in `web/`)
  - PID: `744`
  - Log: `/tmp/ep-web.log`
  - Status: running on `http://localhost:3000/` (HTTP 200)

### 6.5 Verification performed
- `GET http://localhost:8000/health` returned `status: ok` with sample store and analysis loaded (LLM/RAG not enabled in this environment).
- `http://localhost:3000` responded successfully (frontend served by Vite dev server).

---

## 7. Current Local Run State

| Component | URL | Status | Notes |
|---|---|---|---|
| Backend API | `http://localhost:8000` | Running | FastAPI + sample store + analysis loaded |
| Frontend UI | `http://localhost:3000` | Running | Vite dev server proxies `/api` to backend |
| API health | `http://localhost:8000/health` | OK | `sample_store=true`, `analysis=true`, templated explainer |

**Logs:** `/tmp/ep-api.log`, `/tmp/ep-web.log`  
**Stop:** `kill 745 744` (or terminate equivalent processes if restarted)

---

## 8. Observations, Risks, and Recommendations

### 8.1 Observations
- The project is well-structured and includes substantial implementation depth across pipeline, analytics, ML, API, frontend, and documentation.
- Offline demo workflow is functional and suitable for local exploration without external credentials.
- Environment constraints were encountered during setup (`git/curl` crashes in this runtime, missing `ensurepip` for venv); workable fallbacks were used successfully.

### 8.2 Limitations / notes
- Current local run uses the **synthetic demo store** (not real NASA gridded products for all parameters).
- LLM/RAG features were not enabled/configured in this session (`/health` indicated templated explainer, RAG off).
- `npm install` emitted a `free(): invalid pointer` message at the end in this environment, but dependencies were installed and the dev server started successfully.
- Vite reported a non-blocking config warning (`__dirname` with `configLoader: 'native'`).

### 8.3 Recommended next steps
1. **Define target changes** (bug fix, feature, UI/API enhancement, deployment task) and implement within `opencode/`.
2. **Run tests/build checks** as relevant (e.g. `python3 -m pytest tests/ -q`, `npm --prefix web run build`, `npm --prefix web run lint` if configured).
3. **Switch to real-data mode** (if needed) by building/loading real stores and updating `EP_STORE_PATH` / `EP_ANALYSIS_PATH` per docs.
4. **Package changes for GitHub** (commit/patch/export) since direct push access is not configured in this environment.

---

## 9. Conclusion

The Earth Pulse repository is a comprehensive, multi-layer climate exploration application with a functioning offline demo path. In this session, the project was copied into `opencode/`, dependencies were installed, demo data/analysis/model artifacts were generated, and both backend and frontend were successfully hosted locally for use and further development.