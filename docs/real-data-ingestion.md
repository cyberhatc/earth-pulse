# From synthetic demo → real NASA data (end-to-end)

The repo ships a deterministic synthetic store so everything runs offline. This guide flips it to real NASA products with **no code changes** — only environment variables and one ingestion run.

## What changes

| Piece | Synthetic (default) | Real data |
|---|---|---|
| Store | `data/samples/earth_pulse_sample.npz` (7.4 MB, deterministic) | Zarr store from `pipeline/run_pipeline.py --gridded` |
| Mask | Embedded 15° dominant-class mask (`pipeline/land_ocean.py`) | Derived: ocean where SST is finite ≥50% of climatology |
| `data_coverage.synthetic_demo` | `true` | `false` (auto) |
| `synthetic_demo` labels in UI/API | shown | gone |

## Prerequisites

```bash
pip install earthaccess xarray netCDF4 zarr
export EARTHDATA_USERNAME=you@example.com   # free: https://urs.earthdata.nasa.gov
export EARTHDATA_PASSWORD=...               # never commit; use Space secrets in deploy
```

## Step 1 — Real ingestion (Tier B / batch)

`pipeline/fetch_gridded.py` (already in repo) discovers granules via earthaccess and opens them with xarray; subset to monthly, to a bounding box or point:

```bash
python3 - <<'PY'
from pipeline.fetch_gridded import fetch_gridded_subset
ds = fetch_gridded_subset(12.97, 77.59, "2000-01-01", "2026-06-30", product="ndvi_mod13")
print(ds)
PY
```

Known `product` keys (see `fetch_gridded.PRODUCTS`): `merra2_slv`, `merra2_per`, `ndvi_mod13`, `gpm_imerg`, `ghrsst_mur_sst`.

Batch-to-Zarr (adapt for your grid):

```python
import xarray as xr
from pipeline.export_store import export_zarr   # requires xarray+zarr
export_zarr(merged_ds, "data/raw/earth_pulse_real.zarr")
```

## Step 2 — Mask derivation (no extra downloads)

```python
from pipeline.land_ocean import derive_mask_from_sst
import xarray as xr
sst = xr.open_zarr("data/raw/earth_pulse_real.zarr")["analysed_sst"].values  # (time, lat, lon)
mask = derive_mask_from_sst(sst, min_fraction_finite=0.5)  # 1=ocean, 0=land
```

Apply semantics: SST & sea level → ocean cells only; NDVI → land cells only. For the demo store this is already applied in `export_store.py`; for real Zarr stores apply the same in your export step (or mask at read time in `services/store.py`).

## Step 3 — Serve the real store

```bash
export EP_STORE_PATH=/abs/path/store.zarr_or_npz   # engine/models accept either layout via load_store
python3 engine/run_engine.py --input "$EP_STORE_PATH" --output data/processed/analysis_real.json
export EP_ANALYSIS_PATH=/abs/path/analysis_real.json
uvicorn api.main:app --port 8000
```

`EP_REQUIRE_REAL_DATA=1 pytest` fails CI if the analysis still reports `synthetic_demo == true`.

## Step 4 — Cache (Tier B, on-demand)

`pipeline/cache.py` stores JSON responses in `data/cache/<slug>.json` with TTL. Wired into `api/services/ondemand.py` for POWER and FIRMS (TTL `EP_CACHE_TTL`, default 3600 s; FIRMS 300 s when no key). Delete `data/cache/` to flush; for production swap the file backend for Redis/Supabase — call sites stay unchanged.

## NaN & JSON hygiene (the silent killer)

Every artifact must be **strict JSON** (no `NaN` tokens — browsers reject them):

- Engine sanitizes non-finite slopes/p-values → `0.0 / 1.0 / direction: "insufficient data"` (`engine/run_engine.py`).
- `analysis.json` is written with `allow_nan=False` — CI will fail loudly if a NaN leaks in.
- API omits parameters with <12 finite months from charts/forecasts instead of emitting NaN (`api/routers/place.py`); the UI renders "No coverage" cards for them.
- SVG projected maps render masked cells as neutral gray (`models/project_maps.py`).

## Verification

```bash
python3 scripts/verify_offline.py                 # synthetic path sanity
EP_REQUIRE_REAL_DATA=1 python3 -m pytest tests/   # must NOT be synthetic_demo
curl -s localhost:8000/place?lat=12.97\&lon=77.59 | python3 -m json.tool > /dev/null   # strict parse
```

## Cost & rate limits

Everything here is free: Earthdata (no egress fee for small subsets), POWER (unmetered), GIBS (no key), FIRMS (free MAP_KEY). Tier B is **opt-in per click** (`/tier-b`) and cached — never run it in a tight loop; for the full globe, precompute offline once.

## Recommended product set (start small, verify, then widen)

1. `merra2_slv` + `merra2_per` (temp, precip, winds, humidity, pressure) — 1980+, the backbone.
2. `ndvi_mod13` (NDVI/EVI) — 2000+, land-only.
3. `gpm_imerg` (precip) — cross-check MERRA-2 precip.
4. `ghrsst_mur_sst` — ocean only; needed for the real mask.
5. ERA5 (Copernicus CDS) if you want 1940+ met backbone — not NASA but listed in README; one Accept-CDS-terms opt-in.
