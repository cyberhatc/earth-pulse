# Earth Pulse — continuation guide (2026-11-16, v0.5)

> **Read this first.** This file is the handoff for whoever continues the work
> (another agent, another machine, or the next session). It supersedes
> `HANDBOOK.md` (which describes the v0.1–v0.3 stack and is stale). Then read
> `docs/parallel-prompts.md` (status log — every completed phase has a dated
> entry) and `README.md` §19.

## 0. TL;DR

Backend phases 1–5 + most of phase 7 of `docs/BACKEND_PLAN.md` are **done and on
`main` (commit `7cf4a3c`)**. This branch (`feat/v0.5-frontend-pass`) adds the
**frontend review pass**, the **Phase 7 remainder** (load test, contract-snapshot
tests, `/place` perf fix, docs), and **this guide**.

**Nothing after this branch is untracked or "lost":** run
`git log --oneline main..HEAD` to see exactly what this branch adds, and
`git status` should be clean after the push.

## 1. Honest state of the system

- The bundled demo is **synthetic** (`data/samples/earth_pulse_sample.npz`) by
  design — deterministic, labelled synthetic everywhere in the UI/API.
- The **real 2.5° store** exists on the dev machine
  (`data/processed/earth_pulse_real.npz`, GISTEMP/GPCP/ERSST, 1981–2026) but is
  **gitignored** and is *not* the default served store. The API's default store
  resolution prefers `data/processed/earth_pulse_power_full.npz` →
  `earth_pulse_power_real.npz` → the synthetic sample; the POWER stores do not
  exist on this machine, so **the default is the synthetic sample**.
- To serve the real store:
  `EP_STORE_PATH=data/processed/earth_pulse_real.npz EP_ANALYSIS_PATH=data/processed/analysis_real.json uvicorn api.main:app --port 8000`
- **Never present synthetic output as observation.** Every response carries
  `data_coverage.synthetic_demo` / `store.synthetic`; the UI badges it.
- Forecast skill: temperature MASE 0.69–0.85 (h≤60), precipitation ~0.71–0.82,
  **SST unskillful beyond ~6 months** — do not demo SST forecasts as trustworthy.
- Opposite-trend headline (real store): 53 precipitation patch-pairs, 326
  cell-pairs vs random-permutation null expectation 1294 — **no spatial
  clustering beyond chance**; reported as such, not as a discovery.
- `/place` forecasts are conformal-calibrated (nominal 0.80 → empirical
  0.797/0.802) only when `data/processed/conformal.json` fingerprints match the
  active store; otherwise `band_method: sqrt_h`.

## 2. Environment quirks (this machine / Windows)

- **PowerShell 5.1:** no `&&`, no `grep` (use `Select-String`), `&` must be
  quoted inside arguments, heredocs get rejected by the shell scanner —
  **write commit messages to a file and `git commit -F`**.
- **git identity** is set **repo-locally** to `Nidhi <the.nidhi.bhat@gmail.com>`
  (no global identity exists). Do not "fix" this by setting a global one.
- Python 3.12.10, Node v24.9.0, npm 275 packages (`web/node_modules` installed).
- **Docker is NOT installed** — `api/Dockerfile` / `docker-compose.yml` are
  unverified. Do not claim they work.
- **No Earthdata login** — NDVI/sea level/solar/humidity/wind cannot be built on
  this machine; they are NaN by design (documented in `docs/limitations.md`).
- Network works for NASA/NOAA fetches (GISTEMP/GPCP/ERSST build took ~2 min).
- `python -m pytest tests/ -q` — **98 passed** at this commit (87 before this
  branch + 11 new contract-snapshot tests).
- `web/`: `npm ci && npm run typecheck && npm test && npm run build` all pass
  (13 unit tests in `web/src/lib/trend.test.ts`).

## 3. Verification commands (run these first, in order)

```powershell
# Python: engine artifacts present? (needed by API tests; gitignored? regenerate if missing)
python -m pytest tests/ -q

# Web
cd web; npm ci --no-audit --no-fund; npm run typecheck; npm test; npm run build; cd ..

# API smoke (default store = synthetic sample)
uvicorn api.main:app --port 8000
# → curl http://localhost:8000/health   (schema_version 1.1.0, api_version 0.4.1)
# → curl "http://localhost:8000/place?lat=12.97&lon=77.59&horizon_months=60"

# Load test (disables the rate limiter; see docs/performance.md)
$env:EP_RATE_LIMIT_PER_MIN='0'
uvicorn api.main:app --port 8010 &;  # background
python scripts/load_test.py --url http://127.0.0.1:8010 --path /health --n 500 --concurrency 10
```

## 4. What this branch completes

### Frontend review pass (`web/`) — findings from the web review, closed
- `package.json`: renamed `react-example` → `earth-pulse-web`, v0.5.0, `start`
  script (`node server.js`), cross-platform `clean`, `test` script, removed dead
  deps (`@google/genai`, `lucide-react`, `motion`, `dotenv`, `@tailwindcss/vite`,
  `tailwindcss`, `autoprefixer` — 86 packages gone); lockfile re-synced.
- `vite.config.ts`: dropped Tailwind plugin + AI-Studio comments; ESM-safe
  `__dirname`; removed `preview.allowedHosts: true` wildcard.
- `src/lib/api.ts`: fetch timeout is now actually linked to the caller's
  `AbortSignal` (both abort one controller; timeout vs caller-abort are
  distinguished); non-JSON 200 responses throw `ApiError` with the content-type;
  error copy no longer blames ":8000" blindly (mentions `VITE_API_BASE`);
  unused `API_ORIGIN` export deleted.
- `src/lib/context.tsx`: context value memoized; persisted `messages` validated
  as an array and trimmed to the last 50; abort-aware health-fetch error path;
  `"use client"` removed.
- Landing ref-during-render bug **fixed**: `useLandingScroll` / `useAnimeMicro`
  now take the **ref object** and read `ref.current` inside `useEffect`;
  `__lenis` casts deleted — `LandingPage` passes a typed
  `lenisRef: RefObject<Lenis | null>` for the anchor-click smooth scroll.
- `"use client"` directives removed from all 6 files (AI-Studio leftover).
- Duplicate `#main-content` fixed (App.tsx owns the skip-link target;
  `LandingPage`'s `<main>` no longer duplicates the id).
- `web/index.html`: favicon added (`public/favicon.svg`). (Do not delete
  `web/index.html` — it was almost lost once; see git history.)
- `earth_halftone_hero_*.jpg` (unreferenced) and `web/src/index.css` deleted;
  `web/bun.lock`, `web/metadata.json`, `web/.env.production` (dead Cloudflare
  tunnel URL), `web/public/assets/aistudio/Paste_November_15*` removed.
- `vercel.json` + `web/vercel.json`: dead trycloudflare URL removed; root
  `vercel.json` uses `npm ci`.
- `static-space/app.js`: `?region=` URL param no longer reaches `innerHTML` —
  chips are built with DOM APIs (`createElement`/`textContent`).
- tsconfig: `noFallthroughCasesInSwitch` + `forceConsistentCasingInFileNames`.

### Phase 7 remainder
- `scripts/load_test.py` (new): concurrent latency benchmark
  (min/p50/p90/p95/p99/max, rps, error count). `docs/performance.md` records
  measured numbers and the 429-rate-limiter trap (`EP_RATE_LIMIT_PER_MIN=0`).
- `/place` **performance fix**: the rolling-origin ridge backtest ran on every
  request (~2–4s CPU) — now cached per `(cell, artifact config)` with a lock
  (`api/routers/place.py`). Sequential p50: **2.8s → ~132ms**. `configs/model.yaml`
  is parsed once per process (was per request).
- `GET /forecast` grew additive `horizon_months` and `issued` (matches the
  `/place.forecast` block; contract-safe, additive-only).
- `tests/test_contract_snapshots.py` (new, 11 tests): pins top-level shape of
  `/health`, `/place`, `/forecast`, `/anomalies`, `/twins`, `/trends/cell`,
  `/trends/opposite`, `/trends/grid`, `POST /chat`, `POST /explain`, plus lon
  wrapping. Shallow on purpose — key presence, not value snapshots
  (additive-only contract).
- `docs/api-contract.md`: `/health` example updated to schema 1.1.0
  (`api_version`, `uptime_seconds`, `manifest_hash`, `models` block); `1.0.0`
  references purged. `docs/performance.md` new. `Makefile` gains `load-test`
  and `contract-test` targets.

## 5. What is NOT done (ranked, with reasons)

1. **Merge this branch.** `feat/v0.5-frontend-pass` is not merged; review, then
   merge to `main`. No PR was opened (no `gh` auth assumed on this machine).
2. **`web/src/components/cards.tsx` mega-component split** (~1 000 lines).
   Deliberately deferred: highest regression risk before a demo, zero user-visible
   upside. Do it behind tests, not before them.
3. **Docker verification.** Needs Docker — install it, then validate
   `docker-compose.yml` end-to-end.
4. **Real-store load test.** Numbers in `docs/performance.md` are for the
   bundled synthetic store; re-run with
   `EP_STORE_PATH=data/processed/earth_pulse_real.npz` before quoting.
5. **Multi-worker bench** (`uvicorn --workers 4`) for the GIL-bound `/place`.
6. **OpenAPI snapshot/contract artifact**: response models exist, but
   `openapi.json` is not snapshotted as a downloadable contract; web types are
   maintained manually. Low priority, additive.
7. **Earthdata-gated variables** (NDVI at scale, sea level, solar, humidity,
   wind) — blocked on credentials; `pipeline/sources/` has the structure.
8. **HF Space (`static-space/`) deployment** — works offline in-browser
   (BM25 + transformers.js); deployment not verified.
9. **Stable Diffusion scenario cards** — offline GPU pipeline only; never in the
   request path; labels are mandatory ("AI illustration, not observation").

## 6. Landmines

- **`web/index.html`** was nearly deleted during a bulk `git rm` — it is back
  and tracked. Never bulk-delete under `web/` without `git status` review.
- **`GET` unknown paths return the SPA** (`index.html`, 200) — `GET /chat` is not
  an error; `POST /chat` is the API. Benchmarks must target real API paths.
- **Rate limiter** (`EP_RATE_LIMIT_PER_MIN`, default **120/min per IP**) will
  429 a benchmark; set `0` to disable. This is intentional, not a bug.
- **`/place` backtest is cached per process**; the first request for a cell pays
  ~0.1–0.5s (cached afterwards). Tests that hit `/place` are unaffected.
- **`analysis_real.json` is gitignored?** — check `git check-ignore
  data/processed/analysis_real.json`; if it is untracked it must be regenerated
  (`make real-analysis`), not copied around.
- **Do not apply `data/processed/conformal.json` to a different store** — the
  fingerprint guard exists for a reason; mismatched bands are not honest.
- **`static-space/app.js` URL params are untrusted input** — keep all chips
  `textContent`-built; never reintroduce `innerHTML` for them.
- **Frontend↔backend types are manually synced** (`web/src/lib/api.ts` vs
  `docs/api-contract.md`); both carry schema_version 1.1.0.

## 7. Suggested next session (smallest useful increments)

1. Merge `feat/v0.5-frontend-pass` → `main` (PR or fast-forward).
2. `make load-test` against the **real store**; append results to
   `docs/performance.md`.
3. Docker: `docker compose build` on a machine with Docker; fix and document.
4. Demo rehearsal checklist (in `docs/submission-checklist.md`) — includes the
   "SST unskillful" and "no clustering beyond chance" honesty lines: keep them
   in demos.
5. Then, and only then, `cards.tsx` split or Earthdata credentials.

## 8. Where things live (map)

| area | path |
|---|---|
| Plan of record | `docs/BACKEND_PLAN.md` (Phases 1–7) |
| Status log (dated) | `docs/parallel-prompts.md` (append, never rewrite history) |
| API contract | `docs/api-contract.md` (schema 1.1.0) |
| Limitations / honesty | `docs/limitations.md` |
| Perf (measured) | `docs/performance.md` |
| Real store build | `pipeline/build_store.py`, `pipeline/sources/` |
| Stats core | `engine/trend.py`, `engine/field_significance.py` |
| Opposite-trend v2 | `engine/opposite_v2.py` |
| Backtest / conformal | `models/evaluate.py`, `models/conformal.py` |
| API | `api/routers/`, `api/schemas.py`, `api/deps.py` |
| Load test | `scripts/load_test.py` (+ `make load-test`) |
| Contract snapshots | `tests/test_contract_snapshots.py` |
| Web app | `web/` (React 19 + Vite + TS) |
| On-device Space | `static-space/` (fully client-side) |
