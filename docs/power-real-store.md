# Real data run — NASA POWER store (built & verified)

**Built 2026-11-09** by `pipeline/build_real_power_store.py`. No login required — NASA POWER is open.

## What it is
A **real, measured/modelled** multivariate store (1981-01 → 2026-11, monthly) covering the demo grid:

| Field | Source (POWER parameter) | Coverage | Units |
|---|---|---|---|
| temperature | T2M | 1981-01 → 2026-09 (2 trailing months pending upstream) | °C |
| precipitation | PRECTOTCORR × days-in-month | same | mm/month |
| solar_radiation | ALLSKY_SFC_SW_DWN | 511 months (1981–1984 gaps) | kWh/m²/day (auto-converted from MJ ÷3.6 if upstream changes) |
| humidity | RH2M | same | % |
| wind | WS2M | same | m/s |
| ndvi, sst, sea_level | — | **not available from POWER; intentionally NaN** | — |

Build log: **240/240 cells, 0 failures, 8.5 MB**, dates `1981-01..2026-11` (551 months). POWER `-999` sentinels parsed to NaN; the API injects nothing, only reports `< 12 finite months` ⇒ parameter is dropped from that cell's payload (never fabricated).

## How to reproduce
```bash
python3 pipeline/build_real_power_store.py          # ~10 min (240 REST calls, cached 30 days in data/cache/)
python3 engine/run_engine.py --input data/processed/earth_pulse_power_real.npz \
    --output data/processed/analysis_power_real.json
python3 models/train.py --input data/processed/earth_pulse_power_real.npz \
    --output data/processed/forecaster_power_real.npz
EP_STORE_PATH=$PWD/data/processed/earth_pulse_power_real.npz \
EP_ANALYSIS_PATH=$PWD/data/processed/analysis_power_real.json \
uvicorn api.main:app --port 8000
```

## Verified results (real output, not claims)
- `synthetic_demo: false` in `data_coverage`; `provenance: nasa_power_monthly_1981_present`
- Global mean Theil–Sen warming **+0.21 °C/decade** across 115/240 cells significant-increasing
- Siberian cell (75°N, 60°E): **+0.67 °C/decade, p = 0.004** — clear Arctic amplification
- Engine analysis is strict-JSON (`allow_nan=False`); 0 opposite-NDVI pairs (masked — honest), 120 opposite precipitation pairs
- API served from real store reports `data_coverage` sources as `NASA POWER … (1981→present)` — no longer mislabeled as synthetic
- Forecaster trained on the real store: `forecaster_power_real.npz` (residual σ ≈ 1.4 °C temperature / 45 mm rain / 0.4 humidity / 0.6 wind)
- `docker compose build api` re-ran with the honest-source fix inside the image

## Serving it vs the demo
| | Demo (default) | Real POWER |
|---|---|---|
| Store | synthetic (labeled) | `earth_pulse_power_real.npz` (labeled real) |
| `make sample-data engine train test` | ✓ works | point `EP_STORE_PATH`/`EP_ANALYSIS_PATH` at the real artifacts |
| NDVI / SST / sea level | synthetic values shown | **absent — shown as "No coverage"** |
| Forecaster artifact | `models/artifacts/forecaster.npz` (gitignored, rebuilt) | `data/processed/forecaster_power_real.npz` (real-trained copy) |
| CI | green without network | unchanged; real fetch is opt-in |

## What this is NOT
- POWER is **satellite+model agroclimatology** (CERES/GEOS-class), not raw native satellite — excellent for a free 40-year record, slightly conservative vs raw in-situ/reanalysis (see docs/limitations.md).
- NDVI/SST/sea level still need **Earthdata login** (MODIS/PO.DAAC) — see `docs/real-data-ingestion.md`; the POWER path is the no-credentials real-data backbone.
- 15°×15° grid is illustrative; production → 1° (same code, ~4000× more cells — watch memory on the monthly chunks).
