# API contract — `GET /place` and friends

Base URL: `http://localhost:8000` (local) or your deployed API origin.
All parameters are query-string. All responses are JSON unless noted. `schema_version` is `1.0.0`.

## `GET /health`
```json
{
  "status": "ok",
  "schema_version": "1.0.0",
  "sample_store": true,
  "store": {
    "path": "data/processed/earth_pulse_power_real.npz",
    "name": "earth_pulse_power_real.npz",
    "exists": true,
    "synthetic": false,
    "real_data": true,
    "provenance": "nasa_power_monthly_1981_present",
    "time_range": ["1981-01", "2026-11"],
    "n_months": 551
  },
  "analysis": true,
  "analysis_path": "data/processed/analysis_power_real.json",
  "llm": {
    "backend": "ollama",
    "available": true,
    "model": "qwen2.5:1.5b",
    "base_url": "http://localhost:11434",
    "installed_models": ["qwen2.5:1.5b"]
  }
}
```
`store.synthetic` is the authoritative real-vs-demo flag; the legacy `sample_store` field only means “a store file exists.” `llm.backend` is `ollama` when a local model answers, `templated` when no LLM is reachable or `EP_LLM_BACKEND` disables it.

## `GET /place?lat={float}&lon={float}&horizon_months={int=60}`
The unified on-click payload. Example (abridged; arrays truncated with …):

```json
{
  "schema_version": "1.0.0",
  "location": { "lat": 12.97, "lon": 77.59, "cell_index": 134, "grid_lat": 15.0, "grid_lon": 75.0, "name": null },
  "data_coverage": {
    "synthetic_demo": true,
    "parameters_used": ["temperature","precipitation","ndvi","sst","sea_level","solar_radiation","humidity","wind"],
    "sources": { "temperature": "merra2/nasa_power (sample: synthetic)" },
    "time_range": ["1985-01", "2026-06"],
    "overlap_used_for_training": ["2000-01", "2026-06"],
    "gaps": ["Sea level & SST are coastal/ocean-relevant; synthetic everywhere in demo"],
    "notes": "NASA POWER + GIBS + precomputed engine outputs. Tier B discovery is opt-in."
  },
  "past": {
    "dates": ["1985-01", "…"],
    "timeseries": {
      "temperature": [23.1, "…"],
      "precipitation": […],
      "ndvi": […],
      "sst": […],
      "sea_level": […],
      "solar_radiation": […],
      "humidity": […],
      "wind": […]
    },
    "imagery": [
      { "date": "2024-06-01", "type": "gibs", "layer": "MODIS_Terra_CorrectedReflectance_TrueColor", "url": "https://gibs.earthdata.nasa.gov/..." }
    ],
    "anomalies": [
      { "parameter": "temperature", "date": "2016-04", "z": 3.9, "severity": "high", "kind": "warm" }
    ]
  },
  "trends": {
    "temperature": { "slope_per_decade": 0.31, "p_value": 0.0002, "significant": true, "direction": "increasing", "cell_lat": 15.0, "cell_lon": 75.0 },
    "precipitation": { "slope_per_decade": -1.8, "p_value": 0.04, "significant": true, "direction": "decreasing" }
  },
  "forecast": {
    "horizon_months": 60,
    "issued": "2026-06",
    "dates": ["2026-07", "…"],
    "timeseries": {
      "temperature": { "mean": […], "lower": […], "upper": […] }
    },
    "backtest": { "mae": 0.62, "rmse": 0.83, "picp_p10_p90": 0.86, "vs_baselines": { "persistence": 0.71 } },
    "projected_images": [
      { "date": "2030", "parameter": "temperature", "url": "/imagery/projected?parameter=temperature&year=2030", "label": "Model-projected (Theil–Sen extrapolation)" }
    ],
    "scenarios": [
      { "name": "median", "generated_image_url": null, "label": "AI-generated scenario — not an observation" }
    ]
  },
  "opposite_trends": [
    {
      "parameter": "precipitation",
      "cell_a": { "lat": 15.0, "lon": 75.0, "slope_per_decade": -1.8 },
      "cell_b": { "lat": 15.0, "lon": 90.0, "slope_per_decade": 1.6 },
      "strength": "strong",
      "explanation": "Neighboring cells trend in opposite directions…"
    }
  ],
  "climate_twin": { "cluster_id": 7, "k": 8, "features": ["temperature_mean", "precipitation_mean", "ndvi_mean", "sst_mean"] },
  "explanation": {
    "text": "…",
    "language": "en",
    "generator": "templated|hf_inference",
    "confidence": "low|medium|high"
  }
}
```

> `generator` values actually produced by `api/services/explainer.py`: `templated` (default for `/place`), `ollama` (local LLM), `hf-router` (when `EP_RAG_BACKEND=hf-router`: local BM25 retrieval over the bundled knowledge base + HF serverless inference), `hf-rag` (when `EP_RAG_BACKEND=hf` and the Hugging Face RAG Space answers), `hf_inference` (when `HF_TOKEN` is set and the endpoint responds), and `templated-guard` (the LLM failed a post-generation fact check, so deterministic prose was substituted). A `gemini` backend is reserved/planned and is **not yet wired**. The forecast block includes `artifact` (e.g. `forecaster_power_real.npz`) so callers can see which trained model produced it. See `docs/rag.md` for the RAG design and runbook.

## `POST /chat`
Conversational, facts-locked narration backed by the Hugging Face serverless router (when `EP_RAG_BACKEND=hf-router`), the Hugging Face RAG Space (when `EP_RAG_BACKEND=hf`), a local Ollama model (default), or deterministic templated prose (fallback). The server prefers the **same point-level analysis used by the notebook dossier** — the real NASA POWER monthly record for the requested coordinate (or region centre), Theil–Sen/Mann–Kendall trends, rolling anomalies, the blended ridge-rollout forecast and its backtest — and falls back to the gridded store only if no point record can be built. The facts dict carries `data_basis: "point" | "grid"` and the request should include `region_slug`; the model only re-words the facts and never computes or changes a number. With a RAG backend enabled, retrieval runs over a BM25 knowledge base (repo docs + NASA POWER / method notes + store-derived coverage facts) and answers carry `sources: [{id, title, source}]`. Every draft passes the same post-generation guards regardless of backend.

Request:
```json
{
  "lat": 15.8497,
  "lon": 74.4977,
  "region_name": "Western Ghats + Arabian Sea",
  "region_slug": "western-ghats",
  "variable": "Precipitation",
  "horizon_months": 60,
  "language": "en",
  "messages": [
    { "role": "user", "content": "What does the 5-year forecast say, and how uncertain is it?" }
  ]
}
```

Response:
```json
{
  "text": "The 5-year forecast shows a +0.165 °C change in the annual mean temperature between the start and end of the horizon …",
  "generator": "ollama",
  "model": "qwen2.5:1.5b",
  "confidence": "medium",
  "card_kind": "forecast",
  "llm_available": true,
  "guard_reason": null,
  "guard_numbers": [],
  "sources": [{ "id": "S1", "title": "Earth Pulse methodology", "source": "docs/rag-corpus/earth-pulse-method.md" }],
  "facts": { "trends": {}, "forecast_deltas": {}, "parameters_unavailable": [] }
}
```
`guard_reason` and `guard_numbers` are always present; the latter is empty unless a numeric guard rejected a draft.
Forecast deltas compare the mean of the final up-to-12 months of the horizon with the mean of the initial up-to-12 months (seasonal-cycle safe), not per-decade rates. If Ollama is unreachable the endpoint returns deterministic `templated` prose instead of failing. Post-generation guards protect the facts: answers that convert a p-value into a certainty/probability claim, call a non-significant trend significant, or contain a number absent from the facts are rejected and replaced with `templated-guard` prose. `guard_reason` is one of `certainty_claim`, `p_value_misuse`, `band_misuse`, `significance_misread`, or `unverified_numbers`; `guard_numbers` lists any rejected numerical tokens (empty otherwise).

## `GET /dossier?lat&lon&horizon_months=60`
The notebook's full point payload. `mode` is `point_real` for a real point store
and `grid_demo` for the legacy synthetic grid. Key sections:

```json
{
  "mode": "point_real",
  "synthetic": false,
  "data_basis": "point",
  "area": { "bbox": [76.6464, 13.7072, 76.6564, 13.7172], "width_km": 10, "height_km": 10 },
  "coverage": { "parameters_used": ["temperature", "…"], "time_range": ["1981-01", "2026-09"] },
  "parameter_groups": [
    { "name": "Atmosphere", "parameters": [
      { "key": "temperature", "label": "Air temperature (2 m)", "unit": "°C",
        "source": "NASA POWER T2M", "resolution_m": 55000, "n": 549 }
    ]}
  ],
  "requested_unavailable": {
    "runoff": { "label": "Surface runoff", "source": "GLDAS / GPM land-hydrology subsets",
                "reason": "No free no-login monthly point endpoint; GLDAS is imagery-only in GIBS." }
  },
  "forecast": { "dates": ["2026-10", "…"], "timeseries": { "temperature": { "mean": [], "lower": [], "upper": [] } },
                "next_move": { "temperature": { "delta": 0.099, "window": ["2029-10", "2030-09"] } } },
  "ml": { "model": "ridge_rollout_point", "models_by_parameter": { "ndvi": "ridge_single_point" },
          "backtest": { "per_parameter": { "temperature": { "mae": 0.53 } } } },
  "imagery": { "gibs": { "groups": [ { "name": "Optical / vegetation", "frames": [] } ] } }
}
```

The registry lives in `models/parameter_registry.py` (`PARAM_ORDER`, `GROUPS`,
`PARAMETERS`, `REQUESTED_UNAVAILABLE`) and is the single source of truth for
labels, units, physical bounds, provenance, effective resolution and coverage.
`PARAMETERS` currently covers 64 parameters; the six groups are Atmosphere,
Radiation, Water & land, Air quality, Vegetation & surface and Snow &
cryosphere. `SATELLITE_PARAMS` identifies series that start after 1981 and are
fitted by their own ridge model over the observed span; `ML_EXCLUDE` marks
categorical/circular variables. `GET /dossier/report` renders the same payload
as a printable HTML visual report with charts, imagery gallery and the
unavailable-parameter table.

## Other endpoints
| Endpoint | Returns |
|---|---|
| `GET /trends/cell?lat&lon` | Trends for every parameter at the nearest cell |
| `GET /trends/opposite?lat&lon` | Opposite-trend pairs involving the nearest neighborhood |
| `GET /twins?lat&lon` | KMeans cluster id + the cells sharing it (\"climate twins\") |
| `GET /forecast?lat&lon&horizon_months=60` | Just the `forecast` block |
| `GET /anomalies?lat&lon` | Rolling robust-z anomalies per parameter |
| `POST /explain` | `{ "facts": {…} }` → `{ text, generator, confidence }` (numbers unchanged) |
| `POST /chat` | Facts-locked conversation via HF serverless RAG / Space / local Ollama; falls back to templated prose. Replies may carry `sources` (RAG citations) |
| `GET /imagery/past?lat&lon` | GIBS URLs for several layers/dates + a Landsat EarthExplorer link |
| `GET /imagery/projected?parameter=temperature&year=2030` | **SVG** heat-map (Theil–Sen extrapolation), labeled model-projected |
| `GET /docs-payload` | **Planned — not yet served by the API.** Frontend dev fallback: embedded fixture `web/src/lib/fallbackPayload.json` (mirrors this contract) and the live `/openapi.json` |

## Error model
Non-2xx responses: `{ "error": "machine_code", "detail": "human-readable", "partial": { … } }`.
If a subsystem fails (e.g., no model artifact yet) the API still answers with `partial` and an explanatory `data_coverage.gaps` entry — it never fabricates numbers.

## Versioning
`schema_version` bumps on breaking changes; additions only otherwise. Frontend pins `^1.0`.

## Schema 1.1.0 additions (2026-11-16)
- `analysis.json` (schema 1.1.0): each per-cell trend record adds `ci_low`, `ci_high`, `p_value_uncorrected`, `p_value_seasonal`, `p_value_fdr`, `tau`, `lag1_autocorr`, `autocorr_corrected`, `significant_raw`, `significant_fdr`, `method`, `n` (annual), `n_monthly`, `period_start`, `period_end`, `baseline`. Top level adds `fdr_summary` (fraction of significant cells per variable, raw vs FDR) and `trend_baseline`.
- `/place` `forecast` block adds `band_method` (`conformal` | `sqrt_h`) and `calibration` = `{ nominal_p10_p90, empirical_coverage_p10_p90 (per variable, calibration folds), calibration_date, calibration_model }` when conformal widths are available for the active store (fingerprinted; otherwise `sqrt_h`).
- Statistics: deseasonalised anomalies (1991-2020 baseline), annual means (>=10 of 12 months), Sen slope + TFPW-corrected Mann-Kendall headline, seasonal MK on monthly anomalies alongside. FDR (Benjamini-Hochberg, q=0.05) across all grid cells per variable.
