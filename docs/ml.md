# ML / AI layers — models, inputs, outputs, failure modes

Earth Pulse uses the right tool per layer. Numbers are computed by statistics/ML; the LLM only narrates structured facts and is templated-fallback capable. Accuracy = probabilistic skill + honest coverage — never vibes.

## 1. Trend estimation (per grid cell, per parameter)
- **Method:** Theil–Sen slope (median of all pairwise slopes) + **Mann–Kendall** test (S, normal approximation w/ tie correction, two-sided p).
- **Why:** ordinary least squares is wrecked by outliers/gaps; Theil–Sen is robust; MK gives a significance for "is this really changing?".
- **Output:** `{ slope_per_decade, p_value, significant, direction }` per cell/parameter.
- **Code:** `engine/trends.py`, precomputed by `engine/run_engine.py` → `data/processed/analysis.json`.

## 2. Opposite Trend Detector (signature feature)
- **Method:** grid neighbor graph (radius = `neighbor_radius_grid_steps`, default 1). For each parameter, flag neighbor pairs whose slopes have opposite signs; if both are Mann–Kendall significant → `strength: strong`, otherwise `weak`. Rank by min(|slope_a|, |slope_b|).
- **Why:** surfaces divergence across neighboring places (e.g., one drying, one greening) — the "case file" for the detective UI.
- **Output:** `[{ parameter, cell_a, cell_b, strength, context_note }]`.
- **Code:** `engine/opposite.py`.

## 3. Climate twins (clustering)
- **Method:** standardize (z-score) the per-cell multivariate vector `[temperature, precipitation, ndvi, sst]` (+ optional `sea_level`), then **K-Means** (NumPy implementation, seeded, k=8).
- **Note:** HDBSCAN is listed in `configs/model.yaml` as a pluggable option but is **not installed** and has no implementation path in the shipped code.
- **Output:** cluster id per cell; UI shows "places with the same climate signature".
- **Code:** `engine/climate_twins.py`.

## 4. Forecasting (multivariate, with uncertainty)
- **Implemented (used by default):** `models/forecast.py::RidgeRollout` — closed-form ridge regression on lag features, autoregressive roll-out, residual-based p10/p50/p90 bands inflated by √h. Works offline, trains in seconds.
- **LSTM / PyTorch:** `models/forecast.py` contains a `LSTMForecaster` **class stub** only. It is **never instantiated, trained, or saved** by `models/train.py`. The `--torch` flag in `train.py` is parsed but has no effect. The Colab notebook (`notebooks/02_train_forecast.ipynb`) is a **demo**, not a trained artifact. Treat LSTM as **unimplemented**.
- **Features:** flattened 24-month windows of all parameters (`prepare_cell_matrix`). No lat/lon features are added in the current implementation.
- **Horizon:** 60 months (5 years) default.
- **Uncertainty:** residual σ·√h widening per step. PicP ≥ 0.80 at 80% nominal is a **target**, not an enforced assertion — measured backtest PICP is 96–100% on the synthetic store.
- **Evaluation:** rolling-origin backtest (`models/backtest.py`) vs persistence & seasonal-naive & linear-trend baselines. Run on the synthetic store; PicP on synthetic data is not indicative of real-world coverage.
- **Code:** `models/forecast.py`, `models/dataset.py`, `models/backtest.py`, `models/train.py`, `models/infer.py`.

## 5. Anomaly detection
- **Method:** **rolling robust z-score** `(x − rolling_median) / (1.4826 · rolling_MAD)`, window 61 months, |z| ≥ 3.5 → flag. `models/anomaly.py` implements only this. The Isolation Forest backend listed in `configs/model.yaml` is **not wired** into `api/routers/place.py` today.
- **Output:** `{ parameter, date, z, severity (moderate|high), kind }`.
- **Code:** `models/anomaly.py`.

## 6. Explainable narrative (LLM)
- **Method:** facts-only prompt (numbers, coverage, uncertainty) → short plain-English paragraph. Implemented backends: **templated** (offline, always works) and **HF Inference API** (`HF_TOKEN`) — both in `api/services/explainer.py`.
- **Not wired:** a **Gemini** backend is referenced in docs but is **not implemented** in the codebase.
- The LLM only words numbers; it never computes them.
- **Code:** `api/services/explainer.py`.

## 7. “Future image” — what it honest & what it isn't
- **Default & honest:** `models/project_maps.py` renders **SVG heat-maps** of model-projected parameter fields (Theil–Sen extrapolation). URL: `GET /imagery/projected?parameter=temperature&year=2030`.
- **Optional & labeled:** `models/scenario_image.py` — conditioned diffusion image-to-image for lower/median/upper scenario cards. **Must** display "AI-generated scenario — not an observation."
- **Feature exists:** `models/scenario_cards.py` CLI can generate PNGs offline with a GPU (or CPU with SD-Turbo). `api/routers/scenario.py` exposes conditioning-only via HTTP.
- **But** `configs/model.yaml → scenario_image.enabled` is set to `true` in this repo because the pipeline is working; the doc’s “disabled by default” was the intended safe default, not the current state.
- **Past photos:** GIBS tiles (`pipeline/fetch_gibs.py`) + USGS EarthExplorer link for Landsat scene-level imagery.

## Real data (not synthetic)
- The API serves the **real NASA POWER store by default** when `data/processed/earth_pulse_power_real.npz` exists.
- **NDVI / SST / sea level are absent** from POWER and are shown as "No coverage" in the UI — never faked. Hi-Res `/point` mode fills NDVI from Sentinel-2 (10m, no login).
- Real-store backtest Artifact: `models/artifacts/forecaster_real.npz` (trained on 126,480 real pooled windows). The grid-mode ridge artifact `forecaster.npz` is the same architecture but was trained on the synthetic store — if you want real-grid forecasts, set `EP_STORE_PATH=data/processed/earth_pulse_power_real.npz`.

## Alignment with `configs/model.yaml`
| Section | Used by | Status |
|---|---|---|
| `model.torch_lstm.*` | — | Unused (stub only) |
| `backtest.*` | `models/backtest.py` | Used; metrics reported, not enforced |
| `anomaly.*` | `models/anomaly.py` | Used (window/threshold only) |
| `opposite_trend.*` | `engine/opposite.py` | Used |
| `climate_twins.*` | `engine/climate_twins.py` | Used (k=8) |
| `scenario_image.*` | `models/scenario_image.py` + `scenario_cards.py` | Enabled in this repo; normally disabled |

## Known failure modes (be honest in the UI)
- Regime shifts outside the training distribution (e.g., volcanic aerosol, abrupt land-use change).
- Cross-sensor bias when stitching TRMM↔GPM or MODIS↔VIIRS.
- Static coast/ocean masks are ignored in the synthetic store (SST shown inland is symbolic).
- Extrapolation inflates p10/p90 optimistically — always show band width and backtest PicP.
- Synthetic-train PicP=96-100% says nothing about real-world skill.
