# UI handoff — full point catalogue and 10 km dossier

This branch contains the completed backend/data side of the clicked-point
notebook. The next collaborator should focus on the UI.

## What is ready

- `GET /dossier?lat=<lat>&lon=<lon>&horizon_months=12`
  - `mode: point_real`, `synthetic: false`, `data_basis: point`
  - 6 parameter groups, 64 registered parameters
  - real NASA POWER (1981-01 onward), ERA5 cross-check, CAMS air quality,
    GISTEMP context, GIBS imagery, MODIS point samples and ML/backtest
  - `requested_unavailable` entries are honest gaps (runoff, glacier thickness,
    MERRA-2, CERES net radiation, VIIRS point series); never invent values.
- `GET /dossier/report?...` — printable HTML report with the same catalogue.
- `POST /chat` — facts-locked, region-scoped answers; templated fallback works
  without any LLM/RAG backend.
- Deep link used for verification:
  `http://localhost:3000/region/western-ghats/notebook?pt=13.7122,76.6514`

## Data included in this branch

`data/processed/points/*.npz` are rebuilt point stores, so the collaborator
does not have to wait ~8 minutes per point for MODIS mosaics:

| Store | Meaning |
| --- | --- |
| `point_13.7122_76.6514.npz` | pinned clicked point (Western Ghats) |
| `point_14.0000_74.0000.npz` | Western Ghats centre |
| `point_36.0000_117.5000.npz` | North China Plain centre (full 64-param store) |
| `point_37.0000_m119.5000.npz` | California coast centre |
| `point_20.5000_78.5000.npz` | fresh-point core + completed MODIS backfill |
| `point_22.0000_80.0000.npz` | fresh-point core, backfill pending by design |
| `point_16.1165_74.8311.npz`, `point_16.8490_74.8850.npz` | older Belgaum-area points |

`data/cache/*.json` contains the matching ERA5, air-quality and GISTEMP probe
responses so the demo works offline. A never-seen coordinate is built core-first
and shows `satellite.pending: true` while `pipeline/backfill_worker.py` fetches
MODIS in a separate process.

## Run locally

```bash
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
cd web && npm install && npm run dev -- --host 0.0.0.0 --port 3000
```

Checks already passing:

```bash
python -m pytest tests/ -q --ignore=tests/test_api.py   # 66 passed
cd web && npx tsc --noEmit && npm run build
```

## Where to work on the UI

- `web/src/components/PointDossier.tsx` — notebook, catalogue groups,
  imagery, unavailable table, ML/backtest metadata.
- `web/src/pages/RegionNotebookPage.tsx` — route/query-param handling.
- `web/src/components/ChatPanel.tsx` — region-scoped chat.
- `web/src/lib/api.ts` — dossier/chat TypeScript contracts.
- `web/src/styles/dossier.css` — notebook styling.

Keep the honesty labels visible: effective resolution, `satellite_pending`,
`requested_unavailable`, and the distinction between local point data and
global GISTEMP context.
