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

> `generator` values actually produced by `api/services/explainer.py`: `templated` (default for `/place`), `ollama` (local LLM), `hf-rag` (when `EP_RAG_BACKEND=hf` and the Hugging Face RAG Space answers — retrieval over the bundled knowledge base + a small instruct model), `hf_inference` (when `HF_TOKEN` is set and the endpoint responds), and `templated-guard` (the LLM failed a post-generation fact check, so deterministic prose was substituted). A `gemini` backend is reserved/planned and is **not yet wired**. The forecast block includes `artifact` (e.g. `forecaster_power_real.npz`) so callers can see which trained model produced it. See `docs/rag.md` for the RAG design and runbook.

## `POST /chat`
Conversational, facts-locked narration backed by the Hugging Face RAG Space (when `EP_RAG_BACKEND=hf`), a local Ollama model (default), or deterministic templated prose (fallback). The server assembles the facts (trends, forecast deltas, anomalies, opposite pairs, climate twin, coverage) from the same store and engine as `/place`; the model only re-words them and never computes or changes a number. With `EP_RAG_BACKEND=hf`, retrieval runs over a bundled BM25 knowledge base (repo docs + NASA POWER / method notes + store-derived coverage facts) and answers carry `sources: [{id, title, source}]`. Every draft passes the same post-generation guards regardless of backend.

Request:
```json
{
  "lat": 15.8497,
  "lon": 74.4977,
  "region_name": "Western Ghats + Arabian Sea",
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
  "text": "The 5-year forecast indicates a net increase in temperature of +0.165 °C over 60 months …",
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
Forecast deltas are **net change across the full horizon**, not per-decade rates. If Ollama is unreachable the endpoint returns deterministic `templated` prose instead of failing. Post-generation guards protect the facts: answers that convert a p-value into a certainty/probability claim, call a non-significant trend significant, or contain a number absent from the facts are rejected and replaced with `templated-guard` prose. `guard_reason` is one of `certainty_claim`, `p_value_misuse`, `band_misuse`, `significance_misread`, or `unverified_numbers`; `guard_numbers` lists any rejected numerical tokens (empty otherwise).

## Other endpoints
| Endpoint | Returns |
|---|---|
| `GET /trends/cell?lat&lon` | Trends for every parameter at the nearest cell |
| `GET /trends/opposite?lat&lon` | Opposite-trend pairs involving the nearest neighborhood |
| `GET /twins?lat&lon` | KMeans cluster id + the cells sharing it (\"climate twins\") |
| `GET /forecast?lat&lon&horizon_months=60` | Just the `forecast` block |
| `GET /anomalies?lat&lon` | Rolling robust-z anomalies per parameter |
| `POST /explain` | `{ "facts": {…} }` → `{ text, generator, confidence }` (numbers unchanged) |
| `POST /chat` | Facts-locked conversation via HF RAG Space or local Ollama; falls back to templated prose. Replies may carry `sources` (RAG citations) |
| `GET /imagery/past?lat&lon` | GIBS URLs for several layers/dates + a Landsat EarthExplorer link |
| `GET /imagery/projected?parameter=temperature&year=2030` | **SVG** heat-map (Theil–Sen extrapolation), labeled model-projected |
| `GET /docs-payload` | **Planned — not yet served by the API.** Frontend dev fallback: embedded fixture `web/src/lib/fallbackPayload.json` (mirrors this contract) and the live `/openapi.json` |

## Error model
Non-2xx responses: `{ "error": "machine_code", "detail": "human-readable", "partial": { … } }`.
If a subsystem fails (e.g., no model artifact yet) the API still answers with `partial` and an explanatory `data_coverage.gaps` entry — it never fabricates numbers.

## Versioning
`schema_version` bumps on breaking changes; additions only otherwise. Frontend pins `^1.0`.
