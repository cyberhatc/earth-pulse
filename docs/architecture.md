# Earth Pulse — Architecture

**Goal:** click anywhere on Earth → see past + present + forecast for that place over
up to ~40 years (where data exists), with real imagery, honest uncertainty, and a
plain-English explanation. Everything runs free and open.

## System diagram

```text
                        ┌──────────────────────────────┐
                        │  NASA / partner open data    │
                        │  Earthdata · Giovanni · GIBS │
                        │  LP DAAC · GES DISC · PO.DAAC│
                        │  NSIDC · POWER · GISS · FIRMS│
                        │  (+ ERA5, Landsat — README)  │
                        └───────────────┬──────────────┘
                                        │  (offline / CI)
                        ┌───────────────▼──────────────┐
                        │  pipeline/  (Python)          │
                        │  auth · discover · fetch_*    │
                        │  clean · build_features       │
                        │  export_store → data/samples/ │
                        │  earth_pulse_sample.npz       │
                        └───────────────┬───────────────┘
                                        │
                        ┌───────────────▼──────────────┐
                        │  engine/  (precompute)        │
                        │  Theil–Sen + Mann–Kendall     │
                        │  Opposite Trend Detector      │
                        │  KMeans climate twins         │
                        │  → data/processed/analysis.json│
                        └───────────────┬───────────────┘
                                        │
                        ┌───────────────▼───────────────┐
                        │ models/  (train + inference)   │
                        │ Ridge/LSTM forecaster +        │
                        │ p10/p50/p90 bands · anomaly    │
                        │ backtest → artifacts/forecaster │
                        └───────────────┬───────────────┘
                                        │
                        ┌───────────────▼───────────────┐
                        │ api/  (FastAPI)                │
                        │ GET /place?lat&lon → unified   │
                        │ payload (Tier A instant)       │
                        │ + Tier B discover/cache hooks  │
                        │ + LLM explainer (fallback tpl) │
                        └───────────────┬───────────────┘
                                        │
                        ┌───────────────▼───────────────┐
                        │ web/  (React + Vite + TS)      │
                        │ MapLibre GL · SVG ch/erts      │
                        │ coverage badges · imagery      │
                        │ gallery · opposite/explainer   │
                        └────────────────────────────────┘
```

## Layers

| Layer | Tech | Folder | Purpose |
|---|---|---|---|
| Data pipeline | Python, xarray (optional), NumPy | `pipeline/` | Ingest/clean NASA data → portable `.npz`/Zarr store + coverage metadata |
| Analysis engine | NumPy / SciPy (+ pymannkendall optional) | `engine/` | Robust trends, Opposite Trend Detector, climate twins |
| ML models | NumPy ridge (default) · PyTorch LSTM (optional) | `models/` | Multivariate forecast + uncertainty bands, anomaly detection, backtest |
| API | FastAPI + Uvicorn | `api/` | Unified on-click payload; Tier A (precomputed) + Tier B (on-demand, bounded/cached) |
| Frontend | React, Vite, TypeScript, MapLibre GL | `web/` | Map-first UI: click → charts, imagery, coverage, explainer |
| Docs | Markdown | `docs/` | This file, data sources, API contract, ML, UI/UX, deployment |

## On-click data flow (Tier A — instant)
1. User clicks `(lat, lon)` on the MapLibre GL map.
2. Frontend → `GET /place?lat=..&lon=..&horizon_months=60`.
3. API finds nearest grid cell, assembles: precomputed trends (Theil–Sen/Mann–Kendall), forecast (bundled model), anomalies (rolling robust z), opposite-trend pairs nearby, GIBS past imagery, POWER/FIRMS hints (Tier A), `data_coverage` provenance, plain-English narrative.
4. UI renders: coverage badge → charts (past + forecast with p10–p90 band) → past imagery gallery → optional data-driven projected map → Opposite Trend card → explainer.

Tier B (`api/services/ondemand.py`) does bounded live discovery via CMR and caches; it is **opt-in**, never required for the demo, and never blocks Tier A.

## Data store formats
**Sample/demo (`data/samples/earth_pulse_sample.npz`)** — deterministic synthetic gridded multivariate series (see `pipeline/export_store.py`). Keys: `dates`, `lats`, `lons`, `grid_lat`, `grid_lon`, and one array per parameter `(T, G)`.

**Real-data path** — `run_pipeline.py --gridded` (requires Earthdata login) would write a consolidated Zarr store (`pipeline/export_store.py::export_zarr`) and the engine reads it with the same variable layout. The demo intentionally ships a tiny synthetic store so anyone can run the project offline.

## Unified payload contract
See `docs/api-contract.md`. `schema_version` is versioned (`1.0.0`); the frontend types in `web/src/types/payload.ts` mirror it.

## Accuracy & honesty guarantees
- Robust stats (Theil–Sen/Mann–Kendall) alongside ML — trends carry significance, not vibes.
- Forecasts are probabilistic: **p10/p50/p90**; UI never shows a single "certain" future.
- `data_coverage` reports which parameters/sources/years were actually used per place.
- Observed vs Forecast vs **AI-generated scenario** are visually distinct labels.
- The bundled demo data is **synthetic** (deterministic, physically motivated) and labeled as such everywhere; swap in real products for real analysis (`docs/data-sources.md`).

## Free-tier deployment path
GitHub (code) → HF Hub (model weights/artifacts) → API on Hugging Face Spaces or Render (Dockerfile in `api/`) → frontend on Vercel/Netlify/GitHub Pages (static build from `web/`). Details in `docs/deploy.md`.
