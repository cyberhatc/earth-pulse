# Earth Pulse: Backend, ML and RAG Upgrade Plan

> **Status 2026-11-16 (phases 1–4 done):** Phase 1 ✅ (real 2.5° store: GISTEMP+GPCP+ERSST — see `pipeline/build_store.py`, `reports/`). Phase 2 ✅ (engine/trend.py: deseasonalised annual means, Sen CI, seasonal MK, TFPW, BH-FDR; schema 1.1.0). Phase 3 ✅ (rolling-origin backtest `reports/forecast_backtest.md`: climatology_trend beats direct_ridge at all horizons; SST unskillful beyond ~6 months). Phase 4 ✅ (conformal calibration `reports/calibration.md`: 0.80→0.797/0.802, 0.90→0.896). Phases 5+ not started. ROADMAP deviations: temperature is GISTEMP anomalies (no absolute gridded source, no login); POWER is point-only so the grid uses GISTEMP/GPCP/ERSST; ridge/LSTM not shipped as defaults. All numbers in this file and downstream docs updated accordingly (README §19).

Repo: https://github.com/cyberhatc/earth-pulse
Goal: turn the current synthetic-demo backend into a **real-data, statistically defensible, forecasting + RAG backend** for NASA Space Apps 2026 (Earth System Trend Detective).

How to use this file:
1. Put it in the repo root as `docs/BACKEND_PLAN.md` (or `AGENTS.md`).
2. Paste **Prompt 0 (Master Context)** into your coding agent (OpenCode / Claude Code / Cursor) first.
3. Run Prompts 1 to 9 **one at a time, in order**. After each, run the "Done when" checks and commit.

---

## A. Honest status (read before coding)

What the repo already has (from README, verified 2026-11-09):
- `pipeline/` synthetic store (240 cells, 15° grid, 1985-2026) + real NASA POWER store (1981-2026, temperature etc. only, 0 failed calls)
- `engine/` Theil-Sen + Mann-Kendall, opposite-trend pairs (NDVI/precip), K-Means twins -> `analysis.json`
- `models/` ridge rollout (113,760 samples x 192 lag features), p10-p90 from residuals, robust-z anomalies, backtest, SVG maps
- `api/` FastAPI: `/health /place /imagery /tier-b /point /chat ...`
- RAG/LLM: **not enabled** (templated explainer only). Video, federated learning, image fusion: **not built**.

### Problems I found in the four documents (fix these first, they affect credibility)

| # | Issue | Why it matters | Fix (prompt) |
|---|-------|----------------|--------------|
| 1 | Technical whitepaper + paper 2 report backtest MAE 0.67-0.90 C and PICP 0.96-1.00 "on real NASA POWER cells". The draft research paper (paper 3) says the forecaster was **only backtested on synthetic data** and "no forecast accuracy is claimed yet". | The documents contradict each other. Judges may check. | Prompt 3 produces one real backtest; then make all docs quote only that. |
| 2 | PICP of 0.96-1.00 for an **80%** interval means the bands are too wide (over-covered), not "conservative = good". | Miscalibrated uncertainty. | Prompt 4 (conformal calibration), target 0.78-0.82. |
| 3 | Mann-Kendall is applied to monthly series with a strong seasonal cycle and autocorrelation. | p-values are inflated or unreliable; only 115/240 cells significant on 45 years of temperature looks suspicious. | Prompt 2 (seasonal MK / annual means, prewhitening, FDR). |
| 4 | Grid is 15 deg (10x24 cells). Whitepaper says "0.5 deg" in places. | A 15 deg cell (~1500 km) is not a "place". | Prompt 1 moves to 2.5-5 deg for global + 0.5 deg point mode. |
| 5 | NDVI, SST, sea level, precipitation are synthetic or unavailable in the real store. | Challenge asks for these variables. | Prompt 1. |
| 6 | "Five guards" in the LLM validator is claimed but RAG is not enabled. | Claim not backed by code. | Prompt 6. |
| 7 | Forecast horizon differs across docs (next months vs 2035 vs 2045). | Ridge rollout error compounds. | Prompt 3/4: report skill per horizon, cap displayed horizon to where skill > baseline. |
| 8 | `lhr2.err`, `lt.err` committed to repo root. | Junk files. | Prompt 9 cleanup. |

---

## B. Target architecture

~~~
pipeline/   fetch -> clean -> regrid -> mask -> Zarr store (xarray)        [real data only, synthetic flagged]
engine/     deseasonalise -> seasonal MK / TFPW -> Theil-Sen + CI -> FDR -> opposite pairs -> twins
models/     baselines -> ridge -> LightGBM (direct multi-horizon) -> LSTM/TFT-lite (quantile)
            -> ensemble -> conformal calibration -> registry + backtest reports
rag/        corpus ingest -> embeddings -> vector store -> retriever (citations only, never numbers)
agent/      tool registry (typed functions) -> LLM tool-calling loop -> fact-lock validator -> template fallback
api/        /place /trend /forecast /anomalies /opposite /chat /video /health (schema 1.1.0)
video/      frames (observed + PROJECTED) -> ffmpeg MP4
eval/       backtest, trend validation vs GISTEMP, RAG grounding eval -> reports/*.md
~~~

Principles: LLM never computes numbers; every payload has `meta` (source, units, span, processing, synthetic flag); unavailable variables are reported, never interpolated; forecasts are labelled trend extrapolations, not climate projections.

---

## C. Phases and order

| Phase | Prompt | Output |
|-------|--------|--------|
| 0 | Master context | agent knows the rules |
| 1 | Real data ingestion | multi-variable real Zarr store + mask |
| 2 | Statistics engine | correct, tested trend/significance |
| 3 | Forecasting ML | baselines + models + honest real backtest |
| 4 | Uncertainty calibration | conformal bands with measured coverage |
| 5 | Anomalies + opposite trends | multivariate anomalies, significant opposite pairs |
| 6 | RAG + agent + fact-lock | grounded chat with citations |
| 7 | API v1.1 | stable endpoints, caching, tests |
| 8 | Video generator | observed + projected MP4 |
| 9 | Eval, docs, cleanup | reports, README update, CI |
| 10 | Stretch | federated simulation, image prediction |

---

## D. Prompts

### Prompt 0: Master context (paste first, once per session)

~~~
You are working on the open-source repo "earth-pulse" (NASA Space Apps Challenge 2026, "Be An Earth System Trend Detective").
Read README.md, HANDBOOK.md and everything in docs/ first, then list the repo tree and summarise what exists. Do not change anything yet.

Project: click a location -> unified payload with history, trend + significance, probabilistic forecast, anomalies, opposite-trend neighbours, climate twin, imagery and a plain-English explanation.
Stack: Python 3.12, NumPy/SciPy/xarray, scikit-learn, FastAPI, pytest; frontend in web/ (React + Vite + MapLibre) must not break.

HARD RULES for all work:
1. Never fabricate data or results. If a dataset can't be downloaded, say so, keep the code path, and mark outputs synthetic. Never present synthetic output as real.
2. Every number shown to users must come from a computed payload. The LLM may re-word numbers but never compute or invent them.
3. Coverage honesty: if a variable has no real data for a cell/time range, return it as unavailable. Do not interpolate leading/trailing gaps.
4. Forecasts are statistical trend extrapolations, labelled as such, with uncertainty bands whose empirical coverage is measured on a backtest.
5. Keep API backwards compatible unless a docs/api-contract.md change is made in the same commit.
6. Add pytest tests for every new module. Run `make test` before finishing. Fix failures, don't skip tests.
7. Small commits, one per logical change, conventional messages (feat:, fix:, docs:, test:).
8. Prefer free, no-login or free-login data sources (NASA POWER, NOAA PSL/NCEI, GISTEMP, Earthdata with env-var credentials). Never commit secrets; use .env.example.
9. After each phase, append a dated entry to docs/parallel-prompts.md status log with what ran and the actual outputs.

Confirm you understand, then wait for the phase prompt.
~~~

---

### Prompt 1: Real multi-variable data store

~~~
PHASE 1: Replace the synthetic demo as the default with a REAL multi-variable store.

Tasks:
1. Create pipeline/sources/ with one module per source, each exposing fetch(bbox|grid, start, end) -> xarray.Dataset with units + attrs (source, product, version, url, retrieved_at):
   - power.py: NASA POWER monthly T2M, PRECTOTCORR, RH2M, WS2M, ALLSKY_SFC_SW_DWN (exists; refactor into this interface, keep caching)
   - gistemp.py: NASA GISTEMP v4 gridded (or zonal) anomaly 1880+ (validation reference, no login)
   - precip.py: GPCP v3.x monthly (1979+) via NOAA PSL / GES DISC. If Earthdata login needed, read EARTHDATA_USER/EARTHDATA_PASS from env; else fall back to NOAA PSL open copy.
   - ndvi.py: MODIS MOD13C2 monthly CMG (2000+) via LP DAAC (Earthdata login). Optional AVHRR/GIMMS for 1981+ with sensor-change flag in attrs.
   - sst.py: NOAA OISST v2.1 or ERSSTv5 monthly (no login, 1982+/1854+), plus MUR via PO.DAAC if credentials exist.
   - sealevel.py: NASA/PO.DAAC gridded sea surface height (1993+) with Earthdata login. If not available, mark unavailable.
2. pipeline/build_store.py: regrid everything to a common grid (default 2.5 deg global, configurable via configs/), build monthly time axis, write a single Zarr store data/processed/earth_pulse_real.zarr with variables, a `coverage` array (first/last valid month per variable per cell) and a `synthetic` attr = false.
3. Land/ocean mask from a real land-sea mask (e.g. Natural Earth via regionmask, or NOAA land-sea mask file), not the "dominant class 15 deg" hack. Rules: SST + sea level only over ocean; NDVI only over land; meteorology everywhere.
4. Keep the synthetic generator but write to a different path and force data_coverage.synthetic_demo = true when used.
5. Add `make real-store` to the Makefile, with a --fast mode that builds only POWER + GISTEMP + OISST (no login) so the team can run it quickly.
6. Cache raw downloads in data/cache/ with TTL (EP_CACHE_TTL), resumable, with progress logging and retry/backoff. Write a manifest data/processed/manifest.json (variable -> product, version, start, end, n_valid_cells).
7. Tests: unit tests for mask rules, regridding (conserves mean within tolerance), coverage computation, and a tiny offline fixture (mock responses) so CI doesn't hit the network.

Done when: `make real-store ARGS=--fast` completes, manifest.json lists POWER, GISTEMP and SST with true start years, `pytest` passes, and docs/data-sources.md is updated with the real start years per variable. Paste the manifest and the coverage summary in your final message.
~~~

---

### Prompt 2: Statistics engine (correct significance)

~~~
PHASE 2: Make trend estimation and significance statistically defensible.

Current issue: Mann-Kendall is run on monthly series with seasonality and autocorrelation, which inflates significance. Fix in engine/:

1. engine/preprocess.py: monthly climatology removal (anomalies vs 1991-2020 or 1985-2014, configurable), annual-mean series builder with minimum-months-per-year rule (>=10 of 12), no filling of leading/trailing gaps, interior linear interpolation only for charts.
2. engine/trend.py (replace internals, keep function names used by api/):
   - Theil-Sen slope per decade with Sen's confidence interval (tie-corrected variance).
   - Seasonal Mann-Kendall (Hirsch-Slack) on monthly data AND standard MK on annual means. Report both; headline = annual-means version.
   - Autocorrelation handling: Yue-Wang trend-free pre-whitening (TFPW) or Hamed-Rao modified MK. Report `autocorr_corrected: true` and lag-1 autocorrelation.
   - Keep the OLS t-test as supplementary only, label it "parametric, not robust".
   - Minimum n: 12 annual values (or 120 monthly) else return "insufficient data".
3. engine/field_significance.py: Benjamini-Hochberg FDR across all grid cells (q = 0.05) and report both raw and FDR-adjusted "significant" flags, plus the fraction of significant cells. Add a spatial-autocorrelation note in metadata.
4. engine/validate.py: compare Earth Pulse global-mean and regional temperature trend vs NASA GISTEMP over the same period (sign agreement %, mean absolute slope difference in C/decade) and write reports/trend_validation.md.
5. Cross-check every trend function against `pymannkendall` and `scipy.stats.theilslopes` in tests on synthetic series with known slope, with ties, with AR(1) noise, and with seasonal cycle. Tolerance 1e-6 for the slope.
6. Output schema: slope_per_decade, ci_low, ci_high, p_value, p_value_corrected, significant_raw, significant_fdr, tau, n, lag1_autocorr, method, period_start, period_end. Update docs/api-contract.md.

Done when: tests pass, reports/trend_validation.md exists with real numbers, and the global "fraction of significant cells" is reported before vs after correction (show both honestly, even if it drops).
~~~

---

### Prompt 3: Forecasting ML + honest real-data backtest

~~~
PHASE 3: Build a proper forecasting stack and measure it on REAL data.

Rules: forecast deseasonalised anomalies, add the climatology back afterwards. One model per variable (do NOT stack 8 variables x 24 lags into one pooled ridge unless it wins the backtest).

1. models/baselines.py: persistence, seasonal-naive, climatology + Theil-Sen trend, Holt-Winters/ETS (statsmodels).
2. models/ridge.py: keep the existing ridge rollout, but add (a) per-variable variant, (b) direct multi-horizon variant (separate model per horizon 1..H) to avoid recursive error compounding, (c) lambda chosen by time-series cross-validation, not fixed 1e-2.
3. models/gbm.py: LightGBM (or sklearn HistGradientBoosting) direct multi-horizon with lag, rolling-mean, month sin/cos, neighbour-cell mean and optional ENSO index (Nino3.4 from NOAA PSL) as exogenous features.
4. models/seq.py: small LSTM (or TFT-lite) in PyTorch trained with pinball loss at q = 0.1, 0.5, 0.9, trained on pooled cells with cell embedding. Must run on a free Colab/Kaggle GPU; provide notebooks/02_train_seq.ipynb. CPU path must still work with a tiny config.
5. models/ensemble.py: weighted mean of the best models, weights from validation pinball loss.
6. models/backtest.py: rolling-origin evaluation: origins every 12 months from 2005, train on data before origin only (NO leakage, including the normalisation and climatology), horizons 1..60 months, stratified by region (tropics, mid-lat, polar, ocean, land). Metrics: MAE, RMSE, MASE vs seasonal-naive, pinball at 0.1/0.5/0.9, CRPS approx, empirical coverage of p10-p90, per-horizon curves.
7. models/registry.py: save each trained artifact with metadata (git commit, data manifest hash, config, metrics) in models/artifacts/<name>/<version>/. API loads the best-by-backtest model per variable and falls back to the linear-trend baseline if the artifact is missing.
8. Write reports/forecast_backtest.md and reports/forecast_backtest.json with the real numbers and a plot per metric. Include a "skill horizon" table: the max horizon at which the best model still beats seasonal-naive MASE < 1.

Done when: the report exists, built only from the real store, and the docs state which model is the default and up to what horizon forecasts are shown. If a model does NOT beat the baseline, say so and do not ship it as default.
~~~

---

### Prompt 4: Uncertainty calibration

~~~
PHASE 4: Calibrate the prediction intervals. Current bands are sigma*sqrt(h) with 1.645, which over-covers (reported PICP 0.96-1.00 for a nominal 80%).

1. models/conformal.py: implement split / rolling conformal prediction (CQR for quantile models, absolute-residual conformal for point models), horizon-specific, per variable and per region cluster, using calibration residuals from the backtest folds only.
2. Replace the sqrt(h) band in the forecaster with conformal bands. Keep the old method behind a flag `band_method="sqrt_h"` for comparison.
3. Report empirical coverage for nominal 50%, 80%, 90% by horizon and by region in reports/calibration.md plus a reliability plot. Target: 80% band coverage within 0.75-0.85 on held-out folds.
4. Add the coverage number to the API payload: forecast.meta.empirical_coverage_p10_p90 and the calibration date.
5. Tests: conformal coverage on synthetic data with known noise must be within 0.03 of nominal.

Done when: reports/calibration.md exists and the numbers are real. If coverage can't hit the target, say so in the report and the UI copy.
~~~

---

### Prompt 5: Anomalies and Opposite Trend Detector v2

~~~
PHASE 5: Upgrade anomalies and the signature feature.

Anomalies (models/anomaly.py):
1. Keep rolling robust-z (median/MAD, window 61, threshold 3.5) on deseasonalised data.
2. Add multivariate Isolation Forest per region on [temperature anomaly, precipitation anomaly, NDVI anomaly] to flag compound events (e.g. hot + dry + browning).
3. Event catalogue: merge consecutive flagged months into events with start, end, peak z, variables involved. Cross-reference with ENSO phase (ONI) as context only, do not claim causality.

Opposite Trend Detector v2 (engine/opposite.py):
1. A pair is "strong" only if BOTH cells are FDR-significant, slopes have opposite signs, and the smaller |slope| exceeds a minimum effect size (configurable, per variable).
2. Use 8-neighbourhood on the grid, handle longitude wrap-around at 180 deg and poles correctly.
3. Merge adjacent pairs into contiguous regions ("wetting patch vs drying patch") and rank by magnitude and area.
4. Add the "case file": variables involved, slopes with CIs, p-values, data coverage, and a list of CANDIDATE explanations (monsoon shift, land-use change, irrigation, ENSO phase) labelled as hypotheses, never conclusions. Explanations come from a static curated file (data/knowledge/case_hypotheses.yaml), not from the LLM.
5. Add a null-model check: shuffle spatially (or block-permute) and report how many opposite pairs appear by chance, so the headline count has a baseline.

Done when: tests pass, reports/opposite_trends.md lists top 10 real regions with the chance baseline, and /place returns the new fields.
~~~

---

### Prompt 6: RAG + agent + fact-lock (the LLM layer)

~~~
PHASE 6: Build the agentic RAG layer. Design: the LLM is a coordinator, not a source of facts (adapted from OceanAI, arXiv:2511.01019).

1. agent/tools.py: a typed tool registry. Each tool returns the same payload: {text, images, json_data, meta:{source, units, lat, lon, cell, time_span, processing, synthetic}}. Tools: get_place, get_trend, get_forecast, get_anomalies, get_opposite_trends, get_point_series (Tier B POWER), get_imagery (GIBS), find_fires (FIRMS), compare_places, search_papers (RAG), render_video. Use Pydantic models + JSON schema for arguments; validate args and clamp lat/lon/date ranges.
2. agent/llm.py: provider-agnostic client with adapters for Gemini (free tier) and an open model via Ollama or Hugging Face Inference. Provider chosen by env var EP_LLM_PROVIDER. If none configured or call fails, use the template explainer (graceful degrade). Timeouts, retries, token budget, per-IP rate limit.
3. agent/loop.py: tool-calling loop, max 4 tool calls per question, then a "summary" call that receives ONLY the tool payloads plus retrieved passages.
4. rag/: ingest script (rag/ingest.py) for a curated corpus placed in data/knowledge/: NASA product user guides (POWER, GISTEMP, MODIS MOD13, GPCP, OISST), ATBDs, the relevant IPCC AR6 WG1 chapters, and Mann-Kendall / Theil-Sen references. Chunk by section (~500 tokens, 80 overlap), embed with a free sentence-transformer (e.g. all-MiniLM-L6-v2 or bge-small), store in Chroma or FAISS. Retriever returns passages WITH citation (title, section, url, page). Passages are used for context and citations only, never as a source of numbers.
5. agent/factlock.py: validator guard(response, facts) that:
   a. extracts every number/date/percentage from the response and rejects any not present in the backend fact dictionary (allow rounding to the displayed precision, allow years that appear in facts, allow small whitelisted constants like 0.05);
   b. rejects certainty language derived from p-values ("proves", "certainly") and reinterpretation of p as the probability a hypothesis is true;
   c. rejects describing the p10-p90 band as a probability of the future outcome without "prediction interval" wording;
   d. rejects claiming significance when facts say not significant (and the reverse);
   e. rejects causal claims about opposite trends not marked as hypothesis;
   f. rejects claims about variables whose coverage is unavailable.
   On failure: one automatic retry with the violation list fed back, then fall back to templated(facts).
6. Safety: prompt-injection hardening (retrieved text and user text are data, never instructions), no tool calls outside the registry, log tool calls and guard decisions (no PII).
7. Languages: support EN/HI/KN output. Numbers must still pass the guard after translation (compare normalised numerals).
8. rag/eval.py + data/eval/qa_set.jsonl: build 40+ questions with known answers computed from the store (e.g. "warmest year at this cell since 1981?", "is the trend significant?", "which neighbour trends opposite?"). Score numeric correctness, citation presence, guard-rejection rate vs a no-tool LLM baseline. Write reports/rag_eval.md.

Done when: POST /chat works with and without an LLM key, 40-question eval report exists with real scores, guard unit tests cover each of rules a-f with positive and negative cases, and nothing in the response can contain a number absent from the facts.
~~~

---

### Prompt 7: API v1.1 hardening

~~~
PHASE 7: Harden the FastAPI backend and publish schema 1.1.0.

1. Endpoints: GET /health, /place, /trend, /forecast, /anomalies, /opposite, /imagery/past, /imagery/projected, /point (Tier B), POST /chat, GET /video/{id}. Pydantic response models; auto OpenAPI at /docs. Add `schema_version`, `data_coverage`, `model_version`, `generated_at` to every payload.
2. Performance: load Zarr store lazily with dask/xarray, in-memory LRU for hot cells, precompute analysis for the whole grid at build time; target p95 < 300 ms for /place on the precomputed tier (add a load test with locust or k6 script in scripts/).
3. Tier B: bounded on-demand fetch (POWER/FIRMS) with TTL cache, request timeout, concurrency limit, clear "live_fetch": true flag.
4. Validation + errors: lat in [-90,90], lon normalised to [-180,180], consistent error JSON, 404 for ocean-only variables on land with an explanation, never 500 on missing data.
5. Security: CORS allow-list from env, per-IP rate limit, request size limit, no stack traces to clients, secrets only from env, /chat input length cap.
6. Observability: structured logging (request id, latency, cache hit), /health reports store version, manifest hash, model versions, LLM provider status, RAG index size.
7. Contract tests: snapshot tests for each endpoint using a tiny fixture store; frontend in web/ must still build (`cd web && npm run build`) and the types in web/src should be regenerated from OpenAPI.
8. Update docs/api-contract.md and Dockerfile (one image serving API + built frontend, healthcheck, non-root user).

Done when: pytest passes, `docker build` + `docker run` serves /health ok, load test numbers are pasted in docs/performance.md.
~~~

---

### Prompt 8: History-to-forecast video

~~~
PHASE 8: Implement render_video for a clicked place.

1. video/render.py: for (lat, lon, variable, start_year, end_year) render one frame per year (optionally per month for seasonal view) with matplotlib/Pillow: map layer (GIBS true-colour frame if available, else projected SVG/raster), growing time-series chart, trend badge (slope per decade, CI, significance), coverage badge with the variable's true start year, caption track generated from the payload via templates (no LLM numbers).
2. Observed segment starts at each variable's true first year (never claim 40 years if fewer). Projected segment uses forecast p50 with the calibrated band and a persistent "PROJECTED - not an observation" label. Show only up to the skill horizon from the backtest.
3. Encode with ffmpeg (libx264, yuv420p, 1280x720) and also write an SRT/VTT caption file. Cache by hash of (place, variable, model_version, data_manifest_hash).
4. Run as a background job: POST /video returns job id, GET /video/{id} returns status then the MP4. Never block a request on rendering. Add a CLI: `python -m video.render --lat 15.85 --lon 74.50 --variable temperature`.
5. Produce 3 demo videos for places where a contrast is physically plausible and data exist (e.g. a high-latitude warming cell, a monsoon belt, a coastal delta); store in docs/demo/ with a short README listing the data used.
6. Tests: frame count, label presence on forecast frames, deterministic output hash for a fixed seed/fixture.

Done when: 3 MP4s render from the real store and every projected frame carries the PROJECTED label.
~~~

---

### Prompt 9: Evaluation, docs, cleanup, CI

~~~
PHASE 9: Make the repo submission-ready and consistent.

1. Create reports/SUMMARY.md that pulls the real numbers from reports/*.json: data coverage per variable, trend validation vs GISTEMP, forecast skill + horizon, calibration coverage, opposite-trend chance baseline, RAG eval scores. Generate it by script (scripts/make_summary.py), not by hand.
2. Update README.md sections 14-17, docs/limitations.md, docs/ml.md, docs/data-sources.md so they quote ONLY numbers from reports/SUMMARY.md. Remove or correct any claim not backed by a report (especially forecast accuracy and "five guards").
3. Fix document consistency: one grid resolution statement, one forecast horizon statement, one list of implemented vs proposed features (federated learning and image prediction = proposed unless Phase 10 done).
4. Remove junk files (lhr2.err, lt.err), add them to .gitignore. Make sure data/cache and large artifacts are gitignored, use Git LFS or release assets for the real store if > 50 MB.
5. CI (.github/workflows): lint (ruff), type-check (mypy on engine/models/agent), pytest with coverage >= 70% on engine/models/agent, web build, docker build. Nightly job optional: refresh POWER store.
6. Add CITATION.cff, a data-citation block (NASA Earthdata, POWER, GISTEMP, GPCP, NOAA OISST, MODIS) and the OceanAI citation (Chen et al., 2025, arXiv:2511.01019).
7. docs/submission-checklist.md: reproduce-from-scratch commands tested in a clean clone, demo script (2 minutes), and a limitations slide.

Done when: a fresh clone + `make real-store ARGS=--fast engine train test api` works, CI is green, and every number in the docs is traceable to a report file.
~~~

---

### Prompt 10: Stretch (only after 1-9 are done)

~~~
PHASE 10 (STRETCH, label everything "experimental"):

A. Federated simulation: models/federated/ with FedAvg across 4-5 region clients (South Asia, Africa, Americas, Europe/Asia, Oceans/Polar) using the Phase 3 sequence model. Compare (i) central, (ii) federated, (iii) leave-one-region-out generalisation using the same backtest protocol. Report honestly even if federated is worse. Note: NASA data are open, so the benefit is scalability and the generalisation experiment, not privacy.

B. Image prediction prototype: ConvLSTM or small U-Net on GIBS/MODIS NDVI tiles for ONE region (e.g. Belgaum), 12-step input, predict next steps. Evaluate against persistence with SSIM/RMSE on held-out years. Outputs always labelled "AI-generated scenario, not an observation"; generation runs offline in notebooks/04, never inside an HTTP request.

C. Spatio-temporal image fusion (Landsat + MODIS + Sentinel-2): design doc only unless time remains; each frame must carry a flag observed | fused | generated.

Done when: reports/federated.md and reports/image_prediction.md exist with real numbers vs baselines, or the docs clearly say these remain proposals.
~~~

---

## E. Quick commands once everything works

~~~
make real-store ARGS=--fast     # real data, no login
make engine train backtest       # stats + models + reports
make rag-ingest                  # build vector index
make api                         # http://localhost:8000/docs
cd web && npm run dev            # http://localhost:5173
~~~

## F. Environment variables (put in .env, never commit)

~~~
EARTHDATA_USER=...        # free NASA Earthdata login (NDVI, sea level)
EARTHDATA_PASS=...
EP_LLM_PROVIDER=gemini    # gemini | ollama | hf | none
GEMINI_API_KEY=...        # free tier
EP_CACHE_TTL=86400
EP_STORE_PATH=data/processed/earth_pulse_real.zarr
EP_ANALYSIS_PATH=data/processed/analysis_real.json
~~~

## G. Priority if time is short

1. Prompt 1 (real NDVI/precip/SST data), the challenge asks for these variables.
2. Prompt 2 (correct significance), the challenge asks for significance testing.
3. Prompt 3 + 4 (real backtest + calibrated bands), your biggest credibility gap.
4. Prompt 5 (opposite trends with a chance baseline), your signature feature.
5. Prompt 6 (RAG + fact-lock), then 7, 8, 9. Skip 10 unless everything else is done.
