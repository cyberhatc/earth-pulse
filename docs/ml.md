# ML / AI layers — models, inputs, outputs, failure modes

Earth Pulse uses the right tool per layer. Numbers are computed by statistics/ML; the LLM
only narrates structured facts and is templated-fallback capable. Accuracy = probabilistic
skill + honest coverage — never vibes.

## 1. Trend estimation (per grid cell, per parameter)
- **Method:** Theil–Sen slope (median of all pairwise slopes) + **Mann–Kendall** test (S, normal approximation w/ tie correction, two-sided p).
- **Why:** ordinary least squares is wrecked by outliers/gaps; Theil–Sen is robust; MK gives a significance for \"is this really changing?\".
- **Output:** `{ slope_per_decade, p_value, significant, direction }` per cell/parameter.
- **Code:** `engine/trends.py`, precomputed by `engine/run_engine.py` → `data/processed/analysis.json`.

## 2. Opposite Trend Detector (signature feature)
- **Method:** grid neighbor graph (radius = `neighbor_radius_grid_steps`, default 1). For each parameter, flag neighbor pairs whose slopes have opposite signs; if both are Mann–Kendall significant → `strength: strong`, otherwise `weak`. Rank by min(|slope_a|, |slope_b|).
- **Why:** surfaces divergence across neighboring places (e.g., one drying, one greening) — the \"case file\" for the detective UI.
- **Output:** `[{ parameter, cell_a, cell_b, strength, context_note }]`.
- **Code:** `engine/opposite.py`.

## 3. Climate twins (clustering)
- **Method:** standardize (z-score) the per-cell multivariate vector `[temperature, precipitation, ndvi, sst]` (+ optional `sea_level`), then **K-Means** (NumPy implementation, seeded, k=8). HDBSCAN is pluggable via `configs/model.yaml` (`climate_twins.algorithm: hdbscan`) if `hdbscan` is installed.
- **Output:** cluster id per cell; UI shows \"places with the same climate signature\".
- **Code:** `engine/climate_twins.py`.

## 4. Forecasting (multivariate, with uncertainty)
- **Default (dependency-light):** `MultivariateRidgeRollout` — closed-form ridge regression on lag features, autoregressive roll-out, residual-based p10/p50/p90 bands inflated by √h. Works offline, trains in seconds. **Accuracy:** good at linear trend + seasonality; cannot capture nonlinear regime shifts.
- **Optional (accuracy):** `LSTMForecaster` — PyTorch seq2seq LSTM, quantile head (p10/p50/p90), trained on sliding windows over the **overlap period** of all inputs. Use Colab/Kaggle GPU (`notebooks/02_train_forecast.ipynb`). Larger but still a small model (hidden 64×2 layers).
- **Features:** flattened 24-month windows of all parameters + static `lat/lon/grid biome proxy` + `sin/cos(month)` and `year_index`.
- **Horizon:** 60 months (5 years) default; configurable (`configs/model.yaml → model.torch_lstm.horizon_months`).
- **Uncertainty:** quantile outputs (or residual σ·√h fallback). PicP coverage target ≥ 0.80 at 80% nominal.
- **Evaluation:** rolling-origin backtest vs persistence & seasonal-naive & linear-trend baselines. Report MAE/RMSE/PicP per parameter.
- **Code:** `models/forecast.py`, `models/dataset.py`, `models/backtest.py`, `models/train.py`, `models/infer.py`.

## 5. Anomaly detection
- **Method:** **rolling robust z-score** `(x − rolling_median) / (1.4826 · rolling_MAD)`, window 61 months, |z| ≥ 3.5 → flag. Optional **Isolation Forest** (`configs/model.yaml`) for multivariate tabular anomalies when scikit-learn is installed.
- **Output:** `{ parameter, date, z, severity (moderate|high), kind }`.
- **Code:** `models/anomaly.py`.

## 6. Explainable narrative (LLM)
- **Method:** facts-only prompt (numbers, coverage, uncertainty) → short plain-English paragraph. Backends currently implemented, in order: **templated** (always works, no network) → **HF Inference API** (`HF_TOKEN`). A **Gemini free tier** backend (`GEMINI_API_KEY`) is planned but **not yet wired** — the key is already plumbed through `docker-compose.yml` for when it lands. The LLM is forbidden to alter numbers; it only words them.
- **Code:** `api/services/explainer.py`.

## 7. “Future image” — what it honest & what it isn't
- **Default & honest:** `models/project_maps.py` renders **SVG heat-maps** of model-projected parameter fields (Theil–Sen extrapolation / forecast mean − not a photo, not a guaranteed outcome). URL: `GET /imagery/projected?parameter=temperature&year=2030`.
- **Optional & labeled:** `models/scenario_image.py` (disabled by default). Conditioned diffusion image-to-image for *lower/median/upper* scenario cards. **Must** display \"AI-generated scenario — not an observation.\" Never presented as the future photo.
- **Past photos come from reality:** GIBS tiles (map-level) and USGS EarthExplorer / Landsat (scene-level). See `api/routers/imagery.py` & `web/src/components/ImageryGallery.tsx`.

## Alignment with `configs/model.yaml`
| Section | Used by |
|---|---|
| `model.torch_lstm.*` | train/infer |
| `backtest.*` | `models/backtest.py` & CI reporting |
| `anomaly.*` | `models/anomaly.py` |
| `opposite_trend.*` | `engine/opposite.py` |
| `climate_twins.*` | `engine/climate_twins.py` |
| `scenario_image.enabled: false` | `models/scenario_image.py` refuses to run |

## Known failure modes (be honest in the UI)
- Regime shifts (unused in training; e.g., volcanic aerosol pulses, sudden land-use change).
- Cross-sensor bias if you stitch TRMM↔GPM or MODIS↔VIIRS — apply homogeneous corrections or restrict overlap.
- Static coast/ocean masks ignored in the synthetic store (SST shown inland is symbolic).
- Extrapolation beyond training distribution inflates p10/p90 optimistically — always show band width and backtest PicP.
