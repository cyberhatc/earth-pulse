# Earth Pulse

**An open-source environmental investigation platform that turns Earth observation data, statistical analysis, and machine learning into place-based climate evidence you can inspect.**

> *Click (or search) a place on Earth to investigate multi-decade environmental change, uncertainty-aware forecasts, anomaly signals, contrasting regional trends, and evidence-grounded explanations — with a clear distinction between observations, model outputs, and synthetic demo data.*

**NASA Space Apps Challenge 2026** · Challenge: [*Be An Earth System Trend Detective*](https://www.spaceappschallenge.org/2026/challenges/)

<p>
  <a href="https://earth-pulse-kkud.vercel.app/"><strong>🌍 Live Demo (primary)</strong></a> ·
  <a href="https://github.com/cyberhatc/earth-pulse"><strong>GitHub Repository</strong></a> ·
  <a href="docs/README.md"><strong>Documentation Index</strong></a>
</p>

<p>
  <a href="https://github.com/cyberhatc/earth-pulse/actions/workflows/ci.yml"><img alt="CI workflow" src="https://github.com/cyberhatc/earth-pulse/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-green.svg"></a>
  <img alt="Python 3.12" src="https://img.shields.io/badge/python-3.12-blue.svg">
  <img alt="Node 22" src="https://img.shields.io/badge/node-22-339933.svg">
  <img alt="FastAPI" src="https://img.shields.io/badge/API-FastAPI-009688.svg">
  <img alt="React + Vite" src="https://img.shields.io/badge/frontend-React%20%2B%20Vite-61dafb.svg">
</p>

> **Live demo status:** the Vercel deployment above is the project’s primary live demo URL. Reachability was checked from the audit environment on **2026-11-16** (HTTP 200 response observed), but availability, content, and runtime configuration can change over time. Treat it as the deployed demo entry point, not a guarantee of uptime or of identical data/configuration to a local run.

### At a glance

| | |
|---|---|
| **What it is** | An offline-capable, open-source climate/environment investigation app: FastAPI backend + React/Vite frontend + data pipeline, analysis engine, and forecasting/anomaly modules. |
| **Core question** | *“What is happening to this place — based on evidence?”* |
| **Signature capability** | **Opposite Trend Detector** — finds neighbouring grid cells with contrasting trend directions (and reports statistical strength), useful as an investigation lead rather than proof of causation. |
| **Evidence principle** | **AI explains the evidence. Statistical methods calculate the evidence.** |
| **Data modes** | Deterministic **synthetic demo store** (offline), optional **real NASA POWER** store/path (no Earthdata login), and a **high-resolution point** workflow (`/point`) for place-specific analysis where supported. |
| **Honesty guardrails** | No claim that synthetic data are observations; no “40 years for everything”; forecasts are probabilistic (p10–p90), not certain; trend direction ≠ statistical significance; no causation inferred from correlation or neighbouring trends. |

---

## Table of contents

- [1. Project introduction](#1-project-introduction)
- [2. The environmental problem](#2-the-environmental-problem)
- [3. Earth Pulse’s solution](#3-earth-pulses-solution)
- [4. Why the project is different](#4-why-the-project-is-different)
- [5. Signature features](#5-signature-features)
- [6. Interactive user journey](#6-interactive-user-journey)
- [7. Data sources and provenance](#7-data-sources-and-provenance)
- [8. Scientific variables and temporal coverage](#8-scientific-variables-and-temporal-coverage)
- [9. Statistical methods](#9-statistical-methods)
- [10. Machine-learning architecture](#10-machine-learning-architecture)
- [11. Opposite Trend Detector methodology](#11-opposite-trend-detector-methodology)
- [12. Forecasting and uncertainty](#12-forecasting-and-uncertainty)
- [13. Anomaly detection](#13-anomaly-detection)
- [14. Climate twins](#14-climate-twins)
- [15. Facts-locked AI and RAG architecture](#15-facts-locked-ai-and-rag-architecture)
- [16. System architecture diagram](#16-system-architecture-diagram)
- [17. Technology stack](#17-technology-stack)
- [18. Repository structure](#18-repository-structure)
- [19. Data ingestion workflow](#19-data-ingestion-workflow)
- [20. Backend API documentation](#20-backend-api-documentation)
- [21. Frontend architecture](#21-frontend-architecture)
- [22. Synthetic versus real-data distinction](#22-synthetic-versus-real-data-distinction)
- [23. NASA POWER integration](#23-nasa-power-integration)
- [24. Belgaum high-resolution case study](#24-belgaum-high-resolution-case-study)
- [25. AI scenario generation and safety limitations](#25-ai-scenario-generation-and-safety-limitations)
- [26. Setup and installation](#26-setup-and-installation)
- [27. Offline demo quickstart](#27-offline-demo-quickstart)
- [28. Real NASA data setup](#28-real-nasa-data-setup)
- [29. Docker instructions](#29-docker-instructions)
- [30. Deployment instructions](#30-deployment-instructions)
- [31. Testing and verification](#31-testing-and-verification)
- [32. Environment configuration](#32-environment-configuration)
- [33. Troubleshooting](#33-troubleshooting)
- [34. Scientific limitations](#34-scientific-limitations)
- [35. Roadmap](#35-roadmap)
- [36. Contributing guidelines](#36-contributing-guidelines)
- [37. Documentation index](#37-documentation-index)
- [38. License and attribution](#38-license-and-attribution)
- [39. Acknowledgements](#39-acknowledgements)

---

## 1. Project introduction

**Earth Pulse** is an open-source, AI-assisted **environmental investigation platform** created for the **NASA Space Apps Challenge 2026** (*Be An Earth System Trend Detective*). It connects Earth observation context, geospatial exploration, robust statistics, lightweight machine learning, and evidence-grounded language generation so users can inspect how a place has changed over time and what the available data can (and cannot) support.

The repository contains a working, offline-capable stack: a **Python pipeline** for data preparation, an **analysis engine** for trends/opposite-trend detection/clustering, **models** for forecasting and anomaly analysis, a **FastAPI** service exposing investigation payloads, and a **React + Vite + TypeScript** web application. The default demo path runs on a deterministic synthetic sample store; the project also includes a no-login real-data path based on **NASA POWER** and a point-level high-resolution workflow.

**Important:** Earth Pulse is an educational and exploratory tool. It is **not** an operational forecast system, a peer-reviewed attribution study, or a substitute for authoritative climate services. All outputs must be interpreted with the provenance, coverage, and limitation information surfaced by the app and documentation.

## 2. The environmental problem

Environmental and climate signals are abundant but difficult to investigate coherently:

- **Data is fragmented:** observations, reanalysis/modelled products, imagery, and derived indicators live across different services, formats, resolutions, and time spans.
- **Long-term context is hard to access:** meaningful change often requires multi-year to multi-decade context, but not every variable is available for the same period or quality.
- **Raw values are not explanations:** a chart or map does not by itself communicate trend robustness, uncertainty, anomalies, or contrasting behaviour across nearby regions.
- **Uncertainty is easy to hide:** forecasts and trend summaries can appear falsely certain when significance, confidence intervals, and coverage gaps are not explicit.
- **AI can overstate evidence:** language models can sound confident while inventing numbers or causal stories if they are not constrained to computed facts.

The challenge is not only to *show* data, but to help people **investigate** it responsibly.

## 3. Earth Pulse’s solution

Earth Pulse treats a place as an investigation target and assembles an evidence bundle around it:

1. **Acquire or load** time-series data (synthetic demo, real NASA POWER, or point-level sources where configured).
2. **Precompute and analyze** robust trends, opposing neighbourhood patterns, anomalies, and similarity clusters.
3. **Forecast** selected signals with uncertainty bands (p10–p90) and explicit model/coverage context.
4. **Serve** a unified, facts-first payload through the API (and chat/explanation endpoints with guardrails).
5. **Present** maps, charts, imagery context, coverage labels, and plain-language narration in a frontend designed for investigation rather than decoration.

The result is a system where **computed evidence** (statistics, model outputs, provenance metadata) is separated from **narration** (templated or LLM-assisted text constrained by facts).

## 4. Why the project is different

- **Investigation, not just visualization:** beyond charts/maps, it combines trend robustness, anomaly flags, opposite-trend “case files”, climate similarity, forecast context, and coverage/provenance in one workflow.
- **Signature detective lens:** the **Opposite Trend Detector** highlights neighbouring regions moving in different directions — a prompt for deeper inquiry, not a causal claim.
- **Evidence-first AI boundary:** **AI explains the evidence. Statistical methods calculate the evidence.** Narration is facts-locked and guarded; numbers are not invented by the language layer.
- **Honesty as a feature:** synthetic vs real data, parameter availability, time-range limits, and uncertainty are treated as first-class outputs (e.g. `data_coverage`, gaps/notes, “no coverage” handling).
- **Offline-first reproducibility:** the default sample pipeline, precomputation, and tests can run without external credentials, while real-data paths are documented as opt-in.
- **Open-source, inspectable stack:** pipeline, engine, models, API, frontend, docs, notebooks, and tests live in one repository under an MIT license.

## 5. Signature features

| Area | Capability | Status / notes (repo-evidenced) |
|---|---|---|
| **Investigation** | Place-based payload combining past series, trends, forecast, anomalies, opposite trends, imagery/context, and coverage | Implemented (API `/place`, `/point` and related endpoints; see [§20](#20-backend-api-documentation)) |
| **Signature** | **Opposite Trend Detector** (neighbouring cells with contrasting slopes; strength informed by significance) | Implemented in `engine/opposite.py`; surfaced in API/UI payloads |
| **Trends** | Robust trend estimation (Theil–Sen) with significance testing (Mann–Kendall) | Implemented in `engine/trends.py`, precomputed via `engine/run_engine.py` |
| **Forecasting** | Multivariate ridge-rollout forecaster with p10–p90 bands; fallback linear-trend+seasonal path; backtesting utilities | Implemented in `models/forecast.py`, `models/infer.py`, `models/backtest.py`, `models/train.py`, `models/point_forecast.py` |
| **Anomalies** | Rolling robust z-score anomaly detection | Implemented in `models/anomaly.py` |
| **Similarity** | **Climate twins** via K-Means clustering on per-cell features | Implemented in `engine/climate_twins.py` |
| **Imagery/context** | GIBS imagery URLs, projected SVG maps, optional scenario conditioning endpoint; timelapse/point imagery helpers where available | Implemented in `pipeline/fetch_gibs.py`, `models/project_maps.py`, `api/routers/imagery.py`, `api/routers/scenario.py` (see docs) |
| **AI narration** | Facts-locked explanations/chat with templated fallback and optional Ollama/HF-RAG backends; post-generation guards | Implemented in `api/services/explainer.py`, `api/services/rag*.py`, `api/routers/explain.py`, `api/routers/chat.py` |
| **Concepts / product ideas** | **Earth Memory**, **Ground Truth Check**, **Mystery Case Files** as named investigation concepts | **Partially represented / conceptual in current repo:** e.g. opposite-trend “case” context and local dossier/storage patterns exist in parts of the UI, but a full end-to-end implementation of every named concept should not be assumed without verifying specific routes/components and backend support. Treat as **roadmap/experience framing** unless explicitly evidenced in code for a given claim. |

## 6. Interactive user journey

The frontend is a single-page React application (client-side routing) with a landing experience and region/investigation views. Exact UX details depend on the running build and available backend data.

```mermaid
flowchart TD
    A[Visitor opens Earth Pulse] --> B[Landing page / entry experience]
    B --> C{Choose investigation path}
    C -->|Browse regions| D[/regions — region selection/]
    C -->|Open a region| E[/region/:slug — region hub/]
    E --> F[Region chat / investigation view\n/region/:slug/chat]
    E --> G[Region map view\n/region/:slug/map]
    E --> H[Region notebook / evidence view\n/region/:slug/notebook]
    F --> I[Frontend requests backend facts\n(e.g. /api/place, /api/chat)]
    G --> I
    H --> I
    I --> J[Backend assembles evidence:\ncoverage, trends, forecast,\nanomalies, opposite trends, imagery context]
    J --> K[User interprets results with\nuncertainty & provenance labels]
```

**Notes:** route structure is defined in `web/src/App.tsx`. The legacy README and `HANDBOOK.md` also describe map-click/panel workflows; the current routed UI should be treated as the source of truth for navigation. Where a specific interaction is not verified in the running deployment, describe it as implementation-dependent.

## 7. Data sources and provenance

Earth Pulse is designed around free/open data sources and transparent provenance. The repository documents and/or integrates multiple sources to different extents; **availability depends on the selected store, configuration, credentials, and network access**.

### 7.1 Core and referenced sources (with URLs)

| Category | Source | URL | Role in this project (as documented/implemented) |
|---|---|---|---|
| NASA hub | NASA Earthdata | https://www.earthdata.nasa.gov | Discovery/access hub for Earth observation products (real-data paths) |
| NASA discovery | Earthdata Search | https://search.earthdata.nasa.gov | Product discovery/download entry point |
| NASA analysis | NASA Giovanni | https://giovanni.gsfc.nasa.gov | Validation/prototyping context (referenced) |
| NASA imagery | NASA Worldview / GIBS | https://worldview.earthdata.nasa.gov | GIBS tile imagery used/built for map/imagery context (`pipeline/fetch_gibs.py`, API imagery routes) |
| NASA land | LP DAAC | https://lpdaac.usgs.gov | Land/vegetation products (e.g. MODIS NDVI/LST) for real ingestion paths (documented; requires Earthdata login for full access) |
| NASA precip/atmos | GES DISC | https://disc.gsfc.nasa.gov | Precipitation/atmospheric/reanalysis products (documented) |
| NASA ocean | PO.DAAC | https://podaac.jpl.nasa.gov | SST/sea level/ocean products (documented; often Earthdata-protected) |
| NASA cryosphere | NSIDC | https://nsidc.org | Snow/ice products (documented) |
| NASA met/energy | NASA POWER | https://power.larc.nasa.gov | **Implemented no-login real-data backbone** for point/monthly variables via API/builder (`pipeline/fetch_power.py`, `pipeline/build_real_power_store.py`) |
| NASA climate context | NASA GISS (GISTEMP) | https://data.giss.nasa.gov/gistemp | Long-term temperature anomaly context (referenced) |
| NASA fires | NASA FIRMS | https://firms.modaps.eosdis.nasa.gov | Active fire/thermal anomalies (optional integration; key-dependent) |
| Challenge | NASA Space Apps Challenge 2026 | https://www.spaceappschallenge.org/2026/challenges/ | Challenge attribution |
| Starter resources | Space Data Atlas | https://spacedata.swapniltamse.com | Suggested datasets/starter resources (referenced) |
| Reanalysis | Copernicus Climate Data Store (ERA5) | https://cds.climate.copernicus.eu | Partner/supplementary long-record source (referenced, not a NASA product) |
| Climate records | NOAA NCEI | https://www.ncei.noaa.gov | Supplementary records (referenced) |
| Weather API | Open-Meteo | https://open-meteo.com | Supplementary/companion data source (referenced) |
| Forest | Global Forest Watch | https://www.globalforestwatch.org | Supplementary land-change context (referenced) |
| Water | JRC Global Surface Water | https://global-surface-water.appspot.com | Surface water change (referenced) |
| Imagery archive | USGS EarthExplorer | https://earthexplorer.usgs.gov | Landsat/scene-level historical imagery access (referenced/linked) |
| Air quality | OpenAQ | https://openaq.org | Supplementary air-quality context (referenced) |
| India weather | India Meteorological Department | https://mausam.imd.gov.in | Regional context (referenced) |
| India open data | data.gov.in | https://data.gov.in | Regional open data (referenced) |
| Indicators | World Bank Open Data | https://data.worldbank.org | Country indicators (referenced) |
| Dataset discovery | Google Dataset Search | https://datasetsearch.research.google.com | Dataset discovery (referenced) |
| Models/datasets | Hugging Face | https://huggingface.co/datasets | Model/dataset hosting and optional inference integrations (repo includes HF-related workflows/docs) |

### 7.2 NASA POWER vs additional NASA Earthdata-protected products

- **NASA POWER** provides agroclimatology/meteorological and solar parameters via a public REST API and is used in-repo as a **no-login** path for building/serving a real monthly record (see [§23](#23-nasa-power-integration)).
- **Additional NASA Earthdata products** (e.g. many MODIS/LP DAAC, GPM/IMERG via GES DISC, GHRSST/altimetry via PO.DAAC, some OPeNDAP/CMR workflows) typically require a **free NASA Earthdata login** and may involve different access patterns, quotas, and preprocessing. The repository includes pipeline/auth/discovery/fetch modules and documentation for these paths, but **credentials and network access are not bundled**.

### 7.3 Provenance in outputs

When served, payloads expose provenance/coverage metadata (for example `data_coverage`, store/analysis provenance in `/health` and place responses) so users can distinguish **synthetic demo**, **real NASA POWER**, or other configured sources — and see which parameters/time ranges were actually used.

## 8. Scientific variables and temporal coverage

Coverage is **parameter-, source-, and store-dependent**. The application and docs must not overstate it.

| Variable / signal | Typical/possible source(s) | Honest coverage guidance | In default/bundled demo & real POWER paths |
|---|---|---|---|
| Air temperature, humidity, wind, solar radiation, precipitation (monthly point/grid series) | NASA POWER (and MERRA-2/others in broader real-data paths) | POWER backbone commonly **~1981–present** (parameter-dependent); MERRA-2 **~1980–present** (documented) | **Synthetic demo:** bundled 498-month synthetic series (1985-01→2026-06, 240-cell 15° grid) — **not observations**. **Real POWER store:** 1981-01→2026-11 build documented (551 months, 240 cells; 1 fetch failure noted in that run) with trailing-month availability depending on upstream. |
| NDVI / vegetation greenness | MODIS (LP DAAC), Sentinel-2 (point/imagery paths) | MODIS **~2000–present**; Sentinel-2 **~2015+** (imagery/indices vary) — **not 40 years** | **Default real POWER store:** NDVI **not available from POWER** and reported as absent/no coverage (never faked). **Point/high-res path:** Sentinel-2 NDVI may be available for some locations/periods (documented). |
| Sea surface temperature (SST) | PO.DAAC (e.g. GHRSST) | Typically **~2002–present** for common products — **not 40 years** | **Default real POWER store:** absent/no coverage. Synthetic demo may include illustrative values in its generated grid (labeled synthetic). |
| Sea level / altimetry | PO.DAAC / altimetry products | Typically **~1993–present** — **not 40 years** | **Default real POWER store:** absent/no coverage. Synthetic demo may include illustrative values (labeled synthetic). |
| Fire / thermal anomalies | NASA FIRMS | ~2000–present (product-dependent), often key-dependent | Optional integration; reported unavailable if not configured/fetched. |
| Imagery tiles / scenes | NASA GIBS, Landsat/Sentinel sources | Layer-dependent; often ~2000+ for many MODIS layers | GIBS URL construction supported; availability depends on layer/date/network. |

**Rule:** never claim “40 years of coverage” for variables that do not have it in the **selected** store. The API/UI should expose per-parameter coverage and gaps.

## 9. Statistical methods

Implemented analysis emphasizes robust, interpretable statistics (primarily in `engine/` and related model utilities):

- **Trend estimation:** **Theil–Sen slope** (robust to outliers) with **Mann–Kendall** significance testing (two-sided p-value) per grid cell/parameter where sufficient data exist. Outputs include slope (e.g. per decade), p-value, significance flag, and direction/insufficiency states.
- **Opposite trend detection:** neighbour-graph comparison of slope signs (and significance/strength criteria) to identify contrasting nearby cells — see [§11](#11-opposite-trend-detector-methodology).
- **Anomaly detection:** **rolling robust z-score** using rolling median and MAD (window/threshold configured in code; e.g. 61-month window, |z| threshold as implemented) to flag unusual deviations.
- **Backtesting/validation utilities:** rolling-origin evaluation and interval-coverage metrics (e.g. MAE/RMSE/PICP) for forecast behaviour on available data/stores (interpretation depends on store realism).

**Interpretation notes:** trend **direction** is not the same as statistical **significance**; non-significant results must not be described as significant. Robust methods reduce sensitivity to outliers but do not eliminate uncertainty or data-quality issues.

## 10. Machine-learning architecture

Earth Pulse uses lightweight, inspectable ML/statistical modeling components (not large end-to-end black-box climate models):

| Layer | Implementation (repo) | Purpose | Notes |
|---|---|---|---|
| Trend / significance | `engine/trends.py` (Theil–Sen, Mann–Kendall) | Robust long-term trend and significance per cell/parameter | Precomputed into analysis artifacts |
| Forecasting | `models/forecast.py` (`RidgeRollout`), `models/train.py`, `models/infer.py`, `models/point_forecast.py` | Multivariate rollout forecasts with uncertainty bands (p10/p50/p90) and fallbacks | Default shipped path uses ridge-based/linear-seasonal approaches as implemented; optional LSTM is **not** a complete wired training/inference path in current code (see `docs/ml.md`) |
| Anomaly detection | `models/anomaly.py` | Flag unusual events via rolling robust z-scores | Isolation Forest is referenced in config/docs in places but not the primary wired path described by current implementation notes |
| Clustering (climate twins) | `engine/climate_twins.py` (K-Means, NumPy) | Group cells with similar multivariate signatures | k/features seeded/configured in code/config; interpretive aid, not a formal climate classification |
| Projected visuals | `models/project_maps.py` | SVG heatmaps/projections from model/statistical extrapolation context | Labeled as model-projected, not observations |
| AI scenario conditioning/generation | `models/scenario_image.py`, `models/scenario_cards.py`, `api/routers/scenario.py` | Optional, offline/guarded scenario-card workflow | **Disabled by default in safe usage patterns** and must always be labeled AI-generated (see [§25](#25-ai-scenario-generation-and-safety-limitations)) |
| Language narration | `api/services/explainer.py`, `api/services/rag*.py` | Reword backend-computed facts into plain language (templated/Ollama/HF options) | No number computation by LLM; guarded outputs |

Model artifacts and selection depend on the active store/distribution (e.g. real-POWER vs synthetic demo artifacts referenced in code/docs).

## 11. Opposite Trend Detector methodology

The **Opposite Trend Detector** is Earth Pulse’s signature investigation feature (`engine/opposite.py`, exposed via analysis/API payloads):

1. **Input:** per-cell trend estimates (slopes) and significance results for selected parameters (notably parameters such as precipitation/NDVI in the implemented analysis, subject to data availability).
2. **Neighbourhood:** evaluate neighbouring grid cells on the analysis grid (implementation uses a grid-neighbour relationship/radius as configured).
3. **Contrast condition:** identify pairs where slopes have **opposite signs** (one increasing, one decreasing) for the same parameter.
4. **Strength/context:** pairs are characterized by magnitude/strength; stronger cases are those where both trends are statistically significant (e.g. “strong”) versus weaker/mixed significance (“weak”) as implemented.
5. **Output:** ranked pairs with cell locations, slopes, significance/strength indicators, and explanatory/context notes for investigation.

**Why it matters:** contrasting nearby trends can help users spot spatial heterogeneity worth investigating (e.g. differing local conditions or data regimes). **Why caution is required:** the detector identifies **statistical contrasts**, not mechanisms — it does **not** establish causation, attribution, or a specific physical explanation.

## 12. Forecasting and uncertainty

- **What is forecast:** parameter time series at selected locations/cells (subject to availability) using implemented forecast models (ridge rollout, linear-trend/seasonal fallbacks, point-forecast utilities).
- **Horizon:** configurable (commonly 60 months in documented flows/API defaults in parts of the system); skill generally **degrades** with horizon.
- **Uncertainty representation:** forecasts are presented with **p10 / p50 / p90** style bands (lower/median/upper quantile-like bounds as produced by the implemented method). These express model uncertainty under assumptions — **not guarantees**.
- **Backtesting:** rolling-origin/backtest metrics (e.g. MAE, RMSE, PICP) are computed for evaluation contexts; results depend on the dataset/store (synthetic demo results do **not** validate real-world performance).
- **Limitations:** extrapolation widens uncertainty; regime shifts, teleconnections, and unmodeled drivers can invalidate outlooks. Forecasts must never be presented as certain futures.

## 13. Anomaly detection

- **Method:** rolling robust z-score based on rolling median and MAD (`models/anomaly.py`), flagging values that deviate strongly from local robust behaviour.
- **Output:** anomaly records (parameter, date/index, z-score/severity/kind as implemented) included in analysis/place payloads where applicable.
- **Interpretation:** anomalies indicate unusual values relative to the modeled baseline/window; they are **signals for investigation**, not definitive explanations of cause or impact.

## 14. Climate twins

- **Method:** **K-Means** clustering over standardized per-cell multivariate features (e.g. means of selected parameters, with NaN-safe handling as implemented) to assign a cluster/twin group (`engine/climate_twins.py`).
- **Purpose:** provide an intuitive “places with similar climate signatures” view for exploration.
- **Caveat:** results depend on feature choice, scaling, and `k`; twins are a **didactic similarity aid**, not a formal or authoritative climate classification.

## 15. Facts-locked AI and RAG architecture

Earth Pulse’s language features are designed so that **AI explains the evidence; statistical methods calculate the evidence**.

```mermaid
flowchart LR
    subgraph Evidence[Computed evidence layer]
        S[Store + analysis + models]
        S --> F[Facts payload\ntrends, coverage, forecast deltas,\nanomalies, opposite pairs, twins]
    end

    subgraph Retrieval[Optional retrieval layer]
        KB[BM25 knowledge base\n(docs + curated notes + store-derived facts)]
        Q[User question + context] --> R[Retrieve passages]
        KB --> R
    end

    subgraph Generation[Narration layer]
        F --> P[Prompt with facts + constraints]
        R --> P
        P --> M{Backend}
        M -->|HF router / HF Space| H[LLM draft]
        M -->|Local Ollama| O[LLM draft]
        M -->|Unavailable/fallback| T[Templated prose]
        H --> G[Post-generation guards]
        O --> G
        G -->|pass| A[Answer + optional sources]
        G -->|reject\n(certainty/stat/number issues)| TG[Templated-guard prose]
    end

    T --> A
    TG --> A
```

**Key properties (repo-evidenced):**
- `/chat` and explanation flows assemble facts from backend/store/analysis; the model rewords facts and **must not compute or alter numbers**.
- **RAG (optional):** BM25 retrieval over a local knowledge base (`data/rag/kb.json`, buildable via `scripts/build_rag_kb.py`) can add domain passages and return `sources` with citations; configured via `EP_RAG_BACKEND` (`ollama`, `hf-router`, `hf`, `templated`).
- **Guards:** post-generation checks reject unsafe/unsupported outputs (e.g. certainty framing, p-value/significance misuse, band misinterpretation, unverified numbers) and substitute deterministic guarded/templated responses.
- **Fallback chain:** RAG/LLM backends can fall back (e.g. to Ollama or templated prose) to avoid hard failures; behaviour depends on configuration and availability.

See: [docs/rag.md](docs/rag.md), [docs/api-contract.md](docs/api-contract.md).

## 16. System architecture diagram

```mermaid
flowchart TB
    subgraph Sources[Data sources]
        DS1[NASA POWER / Earthdata products\n(GIBS, LP DAAC, GES DISC, PO.DAAC, NSIDC, FIRMS, etc.)]
        DS2[Partner/supplementary sources\n(Copernicus, NOAA, USGS, etc. as applicable)]
        DS3[Deterministic synthetic demo generator]
    end

    subgraph Pipeline[pipeline/ — ingestion & preparation]
        P1[Fetch/discover/auth/cache\n(power, gridded, gibs, firms, high-res point, ...)]
        P2[Clean, mask, features, export store]
    end

    subgraph Storage[data/ — stores & artifacts]
        D1[(Sample .npz / real stores\nprocessed analysis JSON\ncache / artifacts as configured)]
    end

    subgraph Analysis[engine/ + models/ — compute evidence]
        E1[Trends: Theil–Sen + Mann–Kendall]
        E2[Opposite Trend Detector]
        E3[Climate twins K-Means]
        M1[Forecasting + uncertainty bands]
        M2[Anomaly detection]
        M3[Projected maps / optional scenario conditioning]
    end

    subgraph API[api/ — FastAPI]
        A1[Unified endpoints\n/place, /point, /trends, /forecast,\n/anomalies, /imagery, /chat, /explain, /health, ...]
        A2[Services: store, on-demand, explainer, RAG]
    end

    subgraph Web[web/ — React + Vite + TypeScript]
        W1[Landing + region/investigation views\nmaps, charts, evidence panels]
    end

    subgraph User[User investigation]
        U1[Inspect evidence, uncertainty,\ncoverage, and explanations]
    end

    DS1 --> P1
    DS2 --> P1
    DS3 --> P2
    P1 --> P2 --> D1
    D1 --> E1
    D1 --> E2
    D1 --> E3
    D1 --> M1
    D1 --> M2
    D1 --> M3
    E1 --> A2
    E2 --> A2
    E3 --> A2
    M1 --> A2
    M2 --> A2
    M3 --> A1
    A2 --> A1
    A1 --> W1 --> U1
    U1 -->|queries/clicks/search| W1
```

For a component-level narrative, see [docs/architecture.md](docs/architecture.md).

## 17. Technology stack

| Layer | Technologies (repo-evidenced) |
|---|---|
| **Backend API** | Python, FastAPI, Uvicorn, Pydantic (see `api/requirements.txt`, `api/main.py`) |
| **Data/analysis/models** | NumPy, SciPy; project modules in `pipeline/`, `engine/`, `models/` (additional optional deps for real-data/scenario workflows documented in code/docs) |
| **Frontend** | React 19, TypeScript, Vite 8, React Router, Leaflet, Tailwind CSS 4, Motion/GSAP/Lenis/animejs (see `web/package.json`) |
| **Packaging/runtime** | Docker / Docker Compose, Render blueprint (`render.yaml`), Vercel config (`vercel.json`), GitHub Actions CI/deploy workflows |
| **Testing** | pytest (Python), TypeScript typecheck/build scripts for web |
| **Optional integrations** | Ollama (local LLM), Hugging Face router/Space flows for RAG/chat, Earthdata-authenticated fetch paths, FIRMS key, scenario image generation dependencies (GPU/offline) |

## 18. Repository structure

```text
earth-pulse/
├─ api/                  # FastAPI app, routers, schemas, services (store/explainer/RAG/on-demand)
├─ configs/              # Configuration files (e.g. model/parameter configs)
├─ data/                 # Data workspace (samples/raw/processed/cache as used; some paths gitignored)
├─ docs/                 # Architecture, API contract, data sources, ML, deploy, limitations, RAG, etc.
├─ engine/               # Trend analysis, opposite-trend detection, climate twins, engine runner
├─ hf-space/             # Hugging Face Space-related assets (separate deployment context)
├─ models/               # Forecasting, anomaly detection, training/inference, maps, scenario utilities
├─ notebooks/            # Exploration/training/backtest/scenario notebooks
├─ pipeline/             # Ingestion/fetch/clean/features/export/build scripts for stores
├─ scripts/              # Helper scripts (e.g. Belgaum build, RAG KB build, offline verification)
├─ static-space/         # Static/on-device Space assets (separate deployment context)
├─ tests/                # Python test suite (pipeline, trends, models, API, payload, guards, RAG, etc.)
├─ web/                  # React + Vite + TypeScript frontend
├─ .github/workflows/    # CI and frontend deployment workflows
├─ docker-compose.yml
├─ Dockerfile
├─ HANDBOOK.md
├─ LICENSE
├─ Makefile
├─ README.md
├─ render.yaml
└─ vercel.json
```

> Note: this tree reflects the repository at audit time; generated artifacts, caches, and some local/untracked files are intentionally excluded from source control per `.gitignore` and project workflow.

## 19. Data ingestion workflow

Earth Pulse supports multiple data-preparation paths:

1. **Offline synthetic demo (default reproducible path):**
   - Generate a deterministic sample store: `python pipeline/run_pipeline.py --sample` (or `make sample-data`).
   - Produces `data/samples/earth_pulse_sample.npz` used for offline demos, engine precomputation, and tests.

2. **Precomputation (analysis artifacts):**
   - Run `engine/run_engine.py` to compute trends, opposite-trend pairs, and climate twins into analysis JSON (e.g. `data/processed/analysis.json`).

3. **Model training/artifacts (demo path):**
   - Run `models/train.py` to produce forecaster artifacts (paths depend on store/config; see Makefile/docs).

4. **Real NASA POWER store (no Earthdata login):**
   - Build via `pipeline/build_real_power_store.py` (network calls to NASA POWER; cached where applicable).
   - Run engine/training against the real store and point API to it with `EP_STORE_PATH` / `EP_ANALYSIS_PATH`.

5. **Earthdata-authenticated / broader real-data ingestion (optional):**
   - Modules such as `pipeline/auth.py`, `pipeline/discover.py`, `pipeline/fetch_gridded.py`, `pipeline/fetch_firms.py` and related docs support authenticated and product-specific workflows. These require credentials, compatible environments, and careful subsetting/caching.

6. **High-resolution point workflow:**
   - `scripts/build_belgaum.py` (and `pipeline/fetch_highres_point.py`) build per-location point stores/analysis for place-specific investigation (see [§24](#24-belgaum-high-resolution-case-study)).

See: [docs/real-data-ingestion.md](docs/real-data-ingestion.md), [docs/power-real-store.md](docs/power-real-store.md), [docs/data-sources.md](docs/data-sources.md).

## 20. Backend API documentation

The backend is a FastAPI application (`api/main.py`) serving API routes at root and mirrored under `/api` (for same-origin frontend builds). It also serves the built SPA from `web/dist` when present.

**Base URL (local default):** `http://localhost:8000`
**OpenAPI docs:** `/docs` (FastAPI default, when enabled)
**Schema version:** `1.0.0` (as exposed by health/payloads)

### Key endpoints (implemented)

| Endpoint | Method | Purpose |
|---|---|---|
| `/health`, `/api/health` | GET | Service/store/analysis/LLM/RAG status and provenance hints |
| `/place`, `/api/place` | GET | Unified place investigation payload (`lat`, `lon`, optional `horizon_months`) |
| `/point`, `/api/point` | GET | High-resolution point payload for a specific location |
| `/point/imagery`, `/api/point/imagery` | GET | Point/scene imagery listing where available |
| `/trends/*`, `/api/trends/*` | GET | Trend-related views (e.g. cell/opposite/grid as implemented) |
| `/forecast`, `/api/forecast` | GET | Forecast block for a location |
| `/anomalies`, `/api/anomalies` | GET | Anomaly records for a location |
| `/imagery/past`, `/api/imagery/past` | GET | Past imagery/GIBS URL context |
| `/imagery/projected`, `/api/imagery/projected` | GET | Model-projected SVG visualization |
| `/imagery/*timelapse*` (if exposed by router) | GET | Timelapse imagery endpoint as implemented in `api/routers/imagery.py` |
| `/tier-b`, `/api/tier-b` | GET | Opt-in on-demand/bounded fetch/cache workflows (implementation-dependent availability) |
| `/explain`, `/api/explain` | POST | Facts-to-text explanation (numbers preserved) |
| `/chat`, `/api/chat` | POST | Facts-locked conversational narration (templated/Ollama/RAG backends with guards) |
| `/imagery/scenario`, `/api/imagery/scenario` | GET | Scenario conditioning/status (does not generate images via HTTP) |

> **Source of truth:** inspect `api/routers/*.py`, `api/schemas.py`, and [docs/api-contract.md](docs/api-contract.md). Some endpoints mentioned in older docs may be planned or context-specific; do not assume availability without checking the running service.

## 21. Frontend architecture

- **Framework/tooling:** React 19 + TypeScript + Vite (`web/`), with client-side routing via React Router (`web/src/App.tsx`).
- **Entry points:** `web/index.html`, `web/src/main.tsx`.
- **Routing:** `/` (landing), `/regions`, `/region/:slug`, `/region/:slug/chat`, `/region/:slug/map`, `/region/:slug/notebook` (plus redirect for unknown routes).
- **State/context:** investigation/context providers and hooks under `web/src/lib/` and `web/src/hooks/` (implementation-specific).
- **API integration:** `web/src/lib/api.ts` targets `VITE_API_BASE` when set (absolute URL) or defaults to `/api` (same-origin/dev-proxy-friendly). Vite dev server proxies `/api` to the backend (default `http://localhost:8000`, override via `VITE_API_PROXY`).
- **UI/components:** landing sections, maps/charts/chat/evidence components under `web/src/components/` and pages under `web/src/pages/`.
- **Styling/assets:** global/landing CSS and Tailwind-based styling; Leaflet and other visualization/animation libraries included as dependencies.

For UI intent and notes, see [docs/ui-ux.md](docs/ui-ux.md) and [docs/earth-pulse-landing-redesign.md](docs/earth-pulse-landing-redesign.md).

## 22. Synthetic versus real-data distinction

| Aspect | Synthetic demo | Real-data paths |
|---|---|---|
| **What it is** | Deterministically generated, physically motivated sample data for offline demos and tests (`pipeline/run_pipeline.py --sample`, `data/samples/earth_pulse_sample.npz`) | Data fetched/built from real sources (e.g. NASA POWER monthly API; optional Earthdata-protected products; point-level sources) |
| **Is it an observation?** | **No.** It must never be described as actual NASA observations or measurements. | Can represent measured/modelled source products **as provided by those sources**, subject to provenance, processing, and coverage limits. |
| **Coverage/variables** | Fixed synthetic grid/time span and variables as generated; may include illustrative values not present in real POWER for some parameters | Depends on source/product: e.g. NASA POWER provides certain met/solar variables but **not** NDVI/SST/sea level; other products require credentials and separate ingestion |
| **How it is labeled** | Payload/health/coverage fields indicate synthetic/demo status (e.g. `synthetic_demo`/provenance fields as implemented) | Payload/health/coverage should reflect real provenance and unavailable parameters explicitly |
| **Use case** | Reproducible offline quickstart, CI/tests, UI development | More realistic investigation workflows where configured and verified |

Always prefer the provenance reported by the running API/store over assumptions.

## 23. NASA POWER integration

- **Purpose:** provide a **real**, no-Earthdata-login data backbone for selected variables and time ranges using the NASA POWER API.
- **Builder:** `pipeline/build_real_power_store.py` fetches/caches data and writes a processed store (documented example: `data/processed/earth_pulse_power_real.npz`).
- **Analysis/model steps:** run `engine/run_engine.py` and (optionally) `models/train.py` against the real store; serve with `EP_STORE_PATH` and `EP_ANALYSIS_PATH`.
- **Documented reference run (attribution):** the repository documents a **2026-11-09** NASA POWER build/analysis run (e.g. 240 cells, 1981-01→2026-11 monthly range, 551 months, 1 fetch failure; global mean warming trend and example regional trend statistics; real-trained forecaster artifact naming as recorded). These figures are **specific to that documented run/configuration** and must not be presented as freshly reproduced results unless re-run and verified.
- **Coverage honesty:** NASA POWER does **not** provide NDVI, SST, or sea-level fields in this workflow; the system reports them as unavailable rather than fabricating values.

Details: [docs/power-real-store.md](docs/power-real-store.md), [docs/data-sources.md](docs/data-sources.md).

## 24. Belgaum high-resolution case study

The repository includes a **point-level, higher-resolution investigation path** demonstrated with **Belgaum (Belagavi), Karnataka, India (15.8497, 74.4977)** but designed to accept arbitrary coordinates.

- **Build:** `python scripts/build_belgaum.py` (or point fetch/build utilities) creates point store/analysis artifacts under `data/processed/` (e.g. `point_15m8497_74m4977.npz/.json` as documented).
- **Serve/query:** `GET /point?lat=15.8497&lon=74.4977&horizon_months=60` (and related point imagery endpoints) returns point-specific payloads when available.
- **Resolution ladder (documented):** combines sources such as NASA POWER point series (long record), MODIS/Sentinel-derived products where configured/available, and imagery/scene links; exact availability depends on credentials, network, and provider access.
- **Frontend support:** UI includes high-res/point-oriented controls in supported builds (see docs/HANDBOOK and frontend implementation).
- **Caveats:** inland/ocean parameter masking applies (e.g. SST/sea level not meaningful inland), forecasts remain probabilistic (p10–p90), and imagery/scenario outputs must be labeled appropriately.

Details: [docs/highres-belgaum.md](docs/highres-belgaum.md), [scripts/build_belgaum.py](scripts/build_belgaum.py), `pipeline/fetch_highres_point.py`.

## 25. AI scenario generation and safety limitations

- **What it is:** an **optional, guardrailed** scenario-card workflow that can condition (and, in offline/GPU contexts, generate) illustrative “what-if” imagery based on model deltas and source imagery context (`models/scenario_image.py`, `models/scenario_cards.py`, `api/routers/scenario.py`, `docs/scenario-images.md`).
- **What it is not:** **not** an observation, **not** a satellite photo of the future, and **not** a guaranteed outcome.
- **Safety/labeling rules (by design):** generation is intended to be disabled/opt-in and require explicit acknowledgement; HTTP endpoints expose conditioning/status rather than performing generation; outputs must carry labels such as **“AI-generated scenario — not an observation.”**
- **Practical constraints:** generation depends on optional heavy dependencies/models, compute availability (GPU recommended; CPU paths may be slow/limited), and source imagery quality; results can be misleading if interpreted as evidence.
- **Repo note:** some configuration/doc states may differ by environment or file version; always verify current `configs/model.yaml`, environment variables (e.g. `EP_SCENARIO_IMAGES`), and endpoint behaviour before claiming availability.

## 26. Setup and installation

### Prerequisites

- **Git**
- **Python** ≥ 3.10 (CI uses 3.12)
- **Node.js** ≥ 18 and npm (CI uses Node 22; frontend uses a lockfile in `web/`)
- (Optional) **Docker** / Docker Compose
- (Optional) **Ollama** for local `/chat` LLM backend
- (Optional) **NASA Earthdata credentials** for authenticated real-product ingestion paths
- (Optional) GPU + extra Python packages for offline scenario image generation

### Clone

```bash
git clone https://github.com/cyberhatc/earth-pulse.git
cd earth-pulse
```

### Python environment (local)

```bash
python -m venv .venv
# Linux/macOS: source .venv/bin/activate
# Windows PowerShell: .\.venv\Scripts\Activate.ps1

pip install numpy scipy fastapi uvicorn httpx pydantic pytest
```

> The repository also contains per-area requirement files (e.g. `api/requirements.txt`, `pipeline/requirements.txt`, `engine/requirements.txt`, `models/requirements.txt`) and `Makefile` targets; install additional dependencies as needed for the specific workflow you run.

### Frontend dependencies

```bash
cd web
npm ci
# or: npm install
```

### Environment variables

- Copy `.env.example` to `.env` and/or `web/.env.example` to `web/.env` as needed.
- Do **not** commit secrets. Real credentials (Earthdata, FIRMS, HF tokens, etc.) are optional and only required for specific integrations.

## 27. Offline demo quickstart

Runs without external credentials using the bundled deterministic **synthetic** sample store.

```bash
# from repo root (with Python deps installed)
make sample-data engine test
make api
# API: http://localhost:8000  (health: /api/health or /health)

# in a second terminal
cd web
npm install
npm run dev
# Frontend dev server (Vite): typically http://localhost:3000
```

**What this does:** generates the sample store, precomputes analysis artifacts, runs Python tests, starts the API, and serves the frontend in dev mode (proxying `/api` to the backend per `web/vite.config.ts`).

**Single-service local run (backend serves built frontend):**

```bash
cd web && npm run build && cd ..
uvicorn api.main:app --host 0.0.0.0 --port 8000
# open http://localhost:8000
```

## 28. Real NASA data setup

### Option A — NASA POWER (no Earthdata login)

```bash
python pipeline/build_real_power_store.py
python engine/run_engine.py --input data/processed/earth_pulse_power_real.npz --output data/processed/analysis_power_real.json
# (optional, if you train a real-store model) python models/train.py --input data/processed/earth_pulse_power_real.npz --output <artifact>

# serve with real store selected
# Linux/macOS example:
# EP_STORE_PATH=$PWD/data/processed/earth_pulse_power_real.npz EP_ANALYSIS_PATH=$PWD/data/processed/analysis_power_real.json uvicorn api.main:app --port 8000
# Windows PowerShell example:
# $env:EP_STORE_PATH="$PWD\data\processed\earth_pulse_power_real.npz"; $env:EP_ANALYSIS_PATH="$PWD\data\processed\analysis_power_real.json"; uvicorn api.main:app --port 8000
```

See [docs/power-real-store.md](docs/power-real-store.md) for the documented reference run, caveats, and verification notes.

### Option B — Earthdata-authenticated / broader real ingestion

Requires free NASA Earthdata credentials and additional dependencies/tools depending on the product path. Follow [docs/real-data-ingestion.md](docs/real-data-ingestion.md) and the relevant `pipeline/fetch_*` modules. Do not claim parameter coverage that the selected products do not provide.

### Option C — High-resolution point (e.g. Belgaum case study)

```bash
python scripts/build_belgaum.py
uvicorn api.main:app --port 8000
# GET /point?lat=15.8497&lon=74.4977&horizon_months=60
```

See [docs/highres-belgaum.md](docs/highres-belgaum.md).

## 29. Docker instructions

### Single image (frontend + API)

```bash
docker build -t earth-pulse .
docker run --rm -p 8000:8000 -e PORT=8000 earth-pulse
# App + API: http://localhost:8000  (health: /api/health)
```

The image builds the frontend, installs Python API dependencies, and generates sample data/analysis/model artifacts at build time (see `Dockerfile`). To serve a real store, mount or provide it and set `EP_STORE_PATH` / `EP_ANALYSIS_PATH`.

### Docker Compose

```bash
# production-like single service on :8000
docker compose up --build api

# dev-style split (hot-reload frontend + api), as defined in docker-compose.yml
docker compose up --build
```

See [docker-compose.yml](docker-compose.yml) and [docs/deploy.md](docs/deploy.md).

## 30. Deployment instructions

- **Render (recommended in-repo path):** `render.yaml` defines a free Docker web service using the root `Dockerfile`, with health check at `/api/health`. One service can serve both the SPA and API.
- **Vercel:** `vercel.json` builds the frontend from `web/` and outputs `web/dist` with SPA rewrites. **Audit finding:** `vercel.json` currently sets build env `VITE_API_BASE` to `https://oxide-interpreted-phys-come.trycloudflare.com` (an ephemeral tunnel-style URL). This may be stale or environment-specific; treat as a deployment/configuration risk and verify against your intended backend before relying on it. The frontend defaults to `/api` when `VITE_API_BASE` is unset, which is suitable for same-origin deployments but not for a static-only frontend without a colocated API.
- **GitHub Pages:** `.github/workflows/deploy-web.yml` builds and deploys `web/dist` on pushes to `main` (requires `VITE_API_BASE` repo variable for a remote API).
- **Other hosts (HF Spaces, Netlify, etc.):** feasible with appropriate Docker/static configuration; see [docs/deploy.md](docs/deploy.md) for options and caveats.

Always configure CORS/API base URLs and secrets via host secret stores — never commit `.env` files or credentials.

## 31. Testing and verification

### Automated checks (repo-defined)

```bash
# Python (from repo root, with deps and sample store prepared as needed)
make sample-data
make engine
python -m pytest tests/ -q

# Frontend (from web/)
npm ci
npm run typecheck
npm run build
```

### CI

GitHub Actions workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs:
- **Python job:** install deps, `make sample-data engine test`, and `python -m pytest tests/ -q` on Ubuntu with Python 3.12.
- **Web job:** `npm ci`, `npm run typecheck`, `npm run build` in `web/` on Ubuntu with Node 22.

### Verification notes (evidence-based)

- The repository includes extensive verification/status documentation (e.g. [docs/VERIFICATION.md](docs/VERIFICATION.md), [docs/power-real-store.md](docs/power-real-store.md), [docs/submission-checklist.md](docs/submission-checklist.md), [HANDBOOK.md](HANDBOOK.md)). These documents record results and context for specific dates/environments; **do not treat historical pass counts or metrics as freshly reproduced** unless you rerun them.
- Known environment-dependent checks (e.g. Docker availability, deployed URL reachability, optional LLM/RAG backends, GPU-dependent scenario generation) may be unavailable in some audit environments and should be reported as such.

## 32. Environment configuration

### Root `.env` (see `.env.example`)

| Variable | Purpose | Notes |
|---|---|---|
| `EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD` | NASA Earthdata login for authenticated downloads | Optional; not needed for synthetic demo or NASA POWER builder |
| `HF_TOKEN` | Hugging Face token for model/inference/RAG router use cases | Optional; permissions/scopes matter (see `docs/rag.md`) |
| `EP_MODEL_REPO` | Hugging Face model repo reference | Optional |
| `EP_RAG_BACKEND` | `ollama` (default), `hf-router`, `hf`, or `templated` | Controls `/chat` narration/retrieval backend |
| `HF_ROUTER_MODEL`, `HF_RAG_SPACE_URL`, `EP_RAG_TIMEOUT`, `EP_RAG_KB_PATH`, `EP_RAG_TOP_K` | RAG/HF configuration | Optional; see `.env.example` and `docs/rag.md` |
| `GEMINI_API_KEY` | Reserved/optional in config; Gemini explainer backend is **not wired** as a primary implemented path in current code | Do not assume availability |
| `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `EP_LLM_BACKEND`, `EP_EXPLAIN_LLM`, `EP_LLM_TIMEOUT` | Local Ollama chat/explainer configuration | Optional |
| `FIRMS_MAP_KEY` | NASA FIRMS access | Optional |
| `VITE_API_BASE` | Frontend API origin (used by web build/runtime conventions) | For local dev, proxy is often used instead |
| `HOST`, `PORT` | API bind settings | Optional |
| `EP_STORE_PATH`, `EP_ANALYSIS_PATH` | Point API at alternate store/analysis artifacts | Key for real-data serving |
| `EP_CACHE_TTL`, `EP_SCENARIO_*`, `EP_REQUIRE_REAL_DATA` | Caching, scenario generation, and strict test behaviour | Optional/advanced |

### Web `.env` (see `web/.env.example`)

| Variable | Purpose |
|---|---|
| `VITE_API_BASE` | Deployed API origin for frontend builds (empty in dev to use `/api` proxy) |
| `VITE_API_PROXY` | Dev proxy target (default `http://localhost:8000`) |
| `GEMINI_API_KEY`, `APP_URL` | Template placeholders for hosted environments; not required for core local Earth Pulse flows |

### Runtime/server notes

- CORS origins can be configured via `CORS_ORIGINS` (see `api/main.py`).
- Rate limiting is controlled via `EP_RATE_LIMIT_PER_MIN` (best-effort, in-process).

## 33. Troubleshooting

| Symptom | Likely cause | What to check |
|---|---|---|
| Frontend cannot reach backend | Wrong API base/proxy, backend not running, CORS mismatch | Start API on :8000; in dev rely on Vite proxy or set `VITE_API_BASE`/`VITE_API_PROXY` correctly; verify `/api/health` |
| `/place` or analysis endpoints return errors/empty data | Missing sample store or analysis artifacts | Run `make sample-data engine` (or point to valid `EP_STORE_PATH`/`EP_ANALYSIS_PATH`) |
| Chat returns templated/guarded responses | LLM/RAG backend unavailable, misconfigured, or guard rejection | Check `/health` (`llm`, `rag`), Ollama status/model, HF token/permissions/model availability; see `docs/rag.md` |
| NDVI/SST/sea level shown as unavailable | Selected store/source does not include them (e.g. NASA POWER) | Expected for POWER-only stores; use appropriate ingestion paths if those variables are required and available |
| Forecasts look overly certain or confusing | Misinterpretation of p10–p90 bands or horizon | Treat bands as uncertainty ranges, not guarantees; review [§12](#12-forecasting-and-uncertainty) and [docs/limitations.md](docs/limitations.md) |
| Real-data build is slow/fails partially | Network, upstream API limits, or transient fetch errors | Check caches (`data/cache/`), retry, and inspect builder logs; some documented runs include partial failures |
| Docker build/run issues | Docker not installed, port conflicts, missing mounted data for real stores | Verify Docker installation, ports, and env/mount paths |
| CI failures on npm install in lockstep environments | Lockfile/manifest drift | Ensure `web/package-lock.json` and `web/package.json` are consistent (see CI workflow) |

## 34. Scientific limitations

- **Synthetic demo data is not real:** bundled sample outputs illustrate behaviour but are **not observations** and must not be cited as measured climate evidence.
- **Coverage is incomplete and uneven:** do not claim 40-year coverage for NDVI (~2000+), SST (~2002+), or sea-level altimetry (~1993+) or for any parameter absent in the selected store.
- **Forecasts are uncertain:** probabilistic (p10–p90), horizon-dependent, and vulnerable to regime shifts/unmodeled dynamics; they are **not** certain futures.
- **Trend direction ≠ significance:** statistical significance (e.g. Mann–Kendall p-values) must be reported separately from slope direction.
- **No causation claims:** correlations, anomalies, and opposite trends are investigative signals, not proof of mechanism or attribution.
- **Model simplifications:** coarse demo grids, masking assumptions, clustering choices (e.g. fixed `k`), and limited features/teleconnections constrain interpretation.
- **AI narration limits:** even with facts-locking and guards, language outputs can be imperfect; when backends fail or are rejected, templated/guarded fallbacks are used by design.
- **Operational limits:** demo-oriented API/runtime (rate limiting, no auth hardening), free-tier cold starts, optional external dependencies, and localStorage-based client persistence are not production guarantees.

For detailed, code-aligned limitations, read [docs/limitations.md](docs/limitations.md), [docs/ml.md](docs/ml.md), and [HANDBOOK.md](HANDBOOK.md).

## 35. Roadmap

Items below reflect **concepts, partial implementations, or future directions** discussed in repository materials — they are **not all complete features**:

- **Earth Memory:** richer, user-centered place-and-time narratives tied to evidence (concept/experience direction; verify current implementation depth before claiming completeness).
- **Ground Truth Check:** workflows to compare citizen/local reports with satellite or modeled evidence (conceptual unless fully implemented end-to-end).
- **Mystery Case Files:** structured investigation narratives around detected contrasts/events (partially reflected by opposite-trend outputs; full productization may be future work).
- **Expanded real-data coverage:** broader, authenticated ingestion for NDVI/SST/sea-level and other products with robust masking and provenance.
- **Model and evaluation improvements:** stronger calibration, broader backtesting on real datasets, and clearer skill communication.
- **RAG/LLM reliability:** improved retrieval quality, model availability, and citation UX subject to provider constraints and cost.
- **Deployment hardening:** more reproducible hosted environments, configuration hygiene, and observability.

See [docs/submission-checklist.md](docs/submission-checklist.md) and repository docs for planning/status context.

## 36. Contributing guidelines

Contributions are welcome when they improve accuracy, clarity, reproducibility, and maintainability.

- Read [CONTRIBUTING.md](CONTRIBUTING.md) for workflow, scope, and verification expectations.
- Prefer evidence-backed documentation and small, reviewable changes.
- Do not add fabricated metrics, badges, screenshots, or claims.
- Follow the project’s scientific-integrity rules (provenance, uncertainty, and limitations must remain explicit).
- For bugs and feature proposals, use the repository issue templates when available.

## 37. Documentation index

Start here: [docs/README.md](docs/README.md)

Key documents:
- [docs/architecture.md](docs/architecture.md) — system architecture and data flow
- [docs/api-contract.md](docs/api-contract.md) — API endpoints and payload contract
- [docs/data-sources.md](docs/data-sources.md) — sources, access, and coverage guidance
- [docs/deploy.md](docs/deploy.md) — deployment options and configuration notes
- [docs/limitations.md](docs/limitations.md) — honest limitations and interpretation guidance
- [docs/ml.md](docs/ml.md) — ML/statistical methods, status, and caveats
- [docs/rag.md](docs/rag.md) — facts-locked chat/RAG design and operations
- [docs/real-data-ingestion.md](docs/real-data-ingestion.md) — moving from synthetic demo to real ingestion
- [docs/power-real-store.md](docs/power-real-store.md) — NASA POWER real-store build/run notes
- [docs/highres-belgaum.md](docs/highres-belgaum.md) — high-resolution point case study
- [docs/scenario-images.md](docs/scenario-images.md) — AI scenario-card workflow and safeguards
- [docs/ui-ux.md](docs/ui-ux.md) — UI/UX notes
- [docs/VERIFICATION.md](docs/VERIFICATION.md) — verification/status report (date-specific)
- [docs/submission-checklist.md](docs/submission-checklist.md) — challenge submission checklist
- [HANDBOOK.md](HANDBOOK.md) — comprehensive implementation handbook

## 38. License and attribution

- **Code license:** [MIT](LICENSE) (Copyright (c) 2026 Earth Pulse Contributors).
- **Data and third-party content:** follow each provider’s terms of use and citation requirements. NASA Earthdata and specific product attributions must be provided where applicable.
- **Challenge attribution:** built for **NASA Space Apps Challenge 2026 — *Be An Earth System Trend Detective***.
- **Trademarks and endorsements:** NASA, Space Apps, and data-provider names/logos are referenced for attribution and interoperability context only; no endorsement is implied.

## 39. Acknowledgements

- **NASA** and the NASA Earthdata ecosystem (including POWER, GIBS/Worldview, and DAAC/distributed data services) for open Earth observation data and infrastructure referenced by this project.
- **NASA Space Apps Challenge** community and organizers for the challenge context.
- **Open-source communities** behind the scientific Python, geospatial, and web tooling used in this repository.
- **Contributors and maintainers** of Earth Pulse. See the Git history and [CONTRIBUTING.md](CONTRIBUTING.md) for participation pathways.

---

<details>
<summary><strong>Maintainer/audit notes (documentation integrity)</strong></summary>

- The primary live demo is <https://earth-pulse-kkud.vercel.app/>. Do not replace it with older demo URLs in project-facing documentation without explicit maintainer intent.
- Keep synthetic/demo labels, coverage limits, uncertainty language, and “AI explains / statistics calculate” boundaries intact in all future edits.
- When adding metrics, screenshots, badges, or deployment claims, include verifiable evidence (command output, artifact path, CI run, or reproducible steps) or omit them.
- For historical run statistics (e.g. the 2026-11-09 NASA POWER build documented in `docs/power-real-store.md`), preserve attribution to that run/date and avoid presenting them as current unless re-verified.

</details>
