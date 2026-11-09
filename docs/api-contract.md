# API contract — `GET /place` and friends

Base URL: `http://localhost:8000` (local) or your deployed API origin.
All parameters are query-string. All responses are JSON unless noted. `schema_version` is `1.0.0`.

## `GET /health`
```json
{ "status": "ok", "schema_version": "1.0.0", "sample_store": true }
```

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

> `generator` values actually produced by `api/services/explainer.py`: `templated` (default, offline) and `hf_inference` (when `HF_TOKEN` is set and the endpoint responds). A `gemini` backend is reserved/planned and is **not yet wired**.

## Other endpoints
| Endpoint | Returns |
|---|---|
| `GET /trends/cell?lat&lon` | Trends for every parameter at the nearest cell |
| `GET /trends/opposite?lat&lon` | Opposite-trend pairs involving the nearest neighborhood |
| `GET /twins?lat&lon` | KMeans cluster id + the cells sharing it (\"climate twins\") |
| `GET /forecast?lat&lon&horizon_months=60` | Just the `forecast` block |
| `GET /anomalies?lat&lon` | Rolling robust-z anomalies per parameter |
| `POST /explain` | `{ "facts": {…} }` → `{ text, generator, confidence }` (numbers unchanged) |
| `GET /imagery/past?lat&lon` | GIBS URLs for several layers/dates + a Landsat EarthExplorer link |
| `GET /imagery/projected?parameter=temperature&year=2030` | **SVG** heat-map (Theil–Sen extrapolation), labeled model-projected |
| `GET /docs-payload` | **Planned — not yet served by the API.** Frontend dev fallback: embedded fixture `web/src/lib/fallbackPayload.json` (mirrors this contract) and the live `/openapi.json` |

## Error model
Non-2xx responses: `{ "error": "machine_code", "detail": "human-readable", "partial": { … } }`.
If a subsystem fails (e.g., no model artifact yet) the API still answers with `partial` and an explanatory `data_coverage.gaps` entry — it never fabricates numbers.

## Versioning
`schema_version` bumps on breaking changes; additions only otherwise. Frontend pins `^1.0`.
