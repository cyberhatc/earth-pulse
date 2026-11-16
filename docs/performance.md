# Earth Pulse — performance notes (measured, 2026-11-16)

Measured on the dev machine (Windows 11, Python 3.12.10, bundled **synthetic sample
store** `data/samples/earth_pulse_sample.npz`, single uvicorn worker, `EP_RATE_LIMIT_PER_MIN=0`).
Anything served from the real 2.5° store (`EP_STORE_PATH=data/processed/earth_pulse_real.npz`)
has the same code path; absolute numbers will be similar (numpy work is per-request on
one cell/row) but **have not been re-measured** — re-run before quoting them.

## Bench shape

`python scripts/load_test.py --url <base> --path <path> --n <N> --concurrency <C>`
(prints min / p50 / p90 / p95 / p99 / max + mean/median; `scripts/load_test.py`).

## Numbers

| endpoint                                | n   | conc. | errors | p50   | p95   | rps   | notes |
|-----------------------------------------|-----|-------|--------|-------|-------|-------|-------|
| `GET /health`                           | 500 | 10    | 0      | 32ms  | 60ms  | ~102  | p99 spiked to ~3s on the very first burst (analysis lazy-load) |
| `GET /twins?lat=12.97&lon=77.59`        | 200 | 10    | 0      | 11ms  | 14ms  | ~480  | cached `lru_cache` handles |
| `GET /forecast?...horizon_months=60`    | 200 | 10    | 0      | 58ms  | 90ms  | ~154  | ridge artifact path |
| `GET /place?...horizon_months=60`       | 50  | 1     | 0      | 132ms | 170ms | 7.3   | sequential; first request after boot ~0.5–0.9s (cold caches) |
| `GET /place?...horizon_months=60`       | 100 | 10    | 0      | 1709ms| 1920ms| 5.8   | **CPU/GIL-bound**: ~0.1–0.3s numpy work per request serializes on one worker |

## What the bench surfaced, and what was fixed in this pass

1. **`/place` was re-running a rolling-origin ridge backtest on every request**
   (~2–4s of CPU) even though it is diagnostic metadata, not the forecast.
   Fixed: result cached per `(cell, artifact config)` in `api/routers/place.py`
   (`_cell_backtest`, 512-entry cache + lock for concurrent first hits) and
   `configs/model.yaml` is now parsed once per process instead of per request.
   Sequential `/place` p50: **2849ms → ~132ms**.
2. Warm single-request `/place` is ~0.11s (verified with cProfile: anomalies
   ~0.12s dominate user code; the rest is transport + JSON + pydantic).
3. Under `--concurrency 10`, a single Python worker degrades badly (GIL). For
   anything real, run multiple workers behind a real server:
   `uvicorn api.main:app --workers 4` (each worker lazy-loads the store ~once).
4. **Rate limiter**: default `EP_RATE_LIMIT_PER_MIN=120` per IP. A burst of >120
   requests/min yields HTTP 429 by design (verified: 117×200 + 13×429 at the
   limiter boundary). Benchmarks must start the server with
   `EP_RATE_LIMIT_PER_MIN=0` (as above) or they measure the limiter, not the API.
5. **Unknown GET paths return the SPA** (`index.html`, 200) by design (static
   SPA fallback). `GET /chat` therefore returns HTML, not JSON — the API only
   answers `POST /chat`. Benchmarks/clients must use real API paths.
6. `GET /forecast` grew additive `horizon_months` and `issued` keys in this
   pass (matching the `/place.forecast` block). Additive → contract-safe.

## Not measured / known gaps

- Real 2.5° store numbers (`EP_STORE_PATH=data/processed/earth_pulse_real.npz`).
- Multi-worker (`--workers 4`) throughput.
- Cold-start time of the full app including store + analysis load.
- Docker (Docker is not installed on the dev machine; `api/Dockerfile` and
  `docker-compose.yml` are unverified).
