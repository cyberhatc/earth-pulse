"""Build a REAL NASA POWER store for the demo grid (no login required).

Fetches monthly POWER data (1981-01 .. present) for the 15°×15° demo grid used by
the synthetic store — 240 cells × 8 POWER parameters — and writes a store with the
same npz layout (`dates`, `lats`, `lons`, `grid_lat`, `grid_lon`, parameters …).

Honest scope:
  REAL (measured/modelled by NASA POWER, 1981+): temperature, precipitation,
    solar_radiation, humidity, wind.
  NOT from POWER -> left as NaN (never faked): ndvi, sst, sea_level.

POWER is agroclimatology built from satellite + model output (CERES/GEWOS-class),
not raw native satellite — it is real published NASA data and ideal for a 40-year
record. For NDVI/SST/sea level you need Earthdata login (see docs/real-data-ingestion.md).

Usage:
  python3 pipeline/build_real_power_store.py [--out data/processed/earth_pulse_power_real.npz]
                                              [--probe]   # fetch one cell only, print, exit

Network is required. Responses are cached in data/cache/ (TTL 30 days) so reruns
are free. Be polite: ~0.25 s between requests, 240 requests total.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.export_store import VARIABLES
from pipeline.fetch_power import fetch_power_point
from pipeline.cache import cached_json
from pipeline.land_ocean import demo_mask_flat, apply_mask_in_place

POWER_PARAMS = ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "RH2M", "WS2M", "ALLSKY_SFC_SW_DWN"]
GRID_LATS = np.arange(-60.0, 76.0, 15.0)
GRID_LONS = np.arange(-180.0, 180.0, 15.0)
CACHE_TTL = 30 * 24 * 3600

PARAM_MAP = {
    "T2M": "temperature",
    "PRECTOTCORR": "precipitation",
    "ALLSKY_SFC_SW_DWN": "solar_radiation",
    "RH2M": "humidity",
    "WS2M": "wind",
}


def fetch_cell(lat: float, lon: float) -> dict:
    key = f"power-full:{lat:.1f},{lon:.1f}"

    def _produce():
        from datetime import date as _date
        end = min(_date.today().year, 2026)
        res = fetch_power_point(lat, lon, 1981, end, parameters=POWER_PARAMS, timeout=60)
        if "error" in res:
            return {"available": False, "note": res["error"]}
        return {"available": True, **res}

    return cached_json(key, ttl_seconds=CACHE_TTL, producer=_produce)


def probe() -> None:
    res = fetch_cell(0.0, 0.0)
    if not res.get("available"):
        print("POWER probe failed:", res)
        return
    for p, series in res["parameters"].items():
        vals = list(series.values())
        print(f"  {p}: n={len(vals)} min={min(vals):.2f} max={max(vals):.2f} mean={np.mean(vals):.2f}  first={next(iter(series))}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/processed/earth_pulse_power_real.npz")
    ap.add_argument("--probe", action="store_true")
    ap.add_argument("--pause", type=float, default=0.25)
    args = ap.parse_args()
    if args.probe:
        probe()
        return 0

    # canonical date axis from one successful probe
    probe_res = fetch_cell(0.0, 0.0)
    if not probe_res.get("available"):
        print("[real-store] FATAL: POWER unreachable — cannot build a real store. Aborting.")
        return 2
    dates = sorted(probe_res["parameters"]["T2M"].keys())
    T = len(dates)
    month_idx = np.array([int(d.split("-")[1]) for d in dates], dtype=np.int64)
    days_in_month = np.array([__import__("calendar").monthrange(int(d[:4]), int(d[5:7]))[1] for d in dates], dtype=np.float64)

    grid = [(lat, lon) for lat in GRID_LATS for lon in GRID_LONS]
    G = len(grid)
    grid_lat = np.array([g[0] for g in grid])
    grid_lon = np.array([g[1] for g in grid])

    arrays = {name: np.full((T, G), np.nan, dtype=np.float64) for name in
              ["temperature", "precipitation", "ndvi", "sst", "sea_level", "solar_radiation", "humidity", "wind"]}
    failures = 0
    t0 = time.time()
    for j, (lat, lon) in enumerate(grid):
        cell = fetch_cell(lat, lon)
        if not cell.get("available"):
            failures += 1
            print(f"[real-store] cell {j+1}/{G} ({lat:.0f},{lon:.0f}) FAILED: {cell.get('note', '?')}")
            continue
        for src, dst in PARAM_MAP.items():
            series = cell["parameters"].get(src, {})
            vec = np.full(T, np.nan, dtype=np.float64)
            for i, d in enumerate(dates):
                if d in series:
                    v = float(series[d])
                    vec[i] = np.nan if v <= -999.0 else v  # POWER fill value -> NaN
            arrays[dst][:, j] = vec
        arrays["precipitation"][:, j] = arrays["precipitation"][:, j] * days_in_month  # mean mm/day -> total mm
        if j % 20 == 19:
            print(f"[real-store] {j+1}/{G} cells fetched ({time.time()-t0:.0f}s)")
        time.sleep(args.pause)

    # unit sanity: POWER metric solar is MJ/m²/day -> convert to kWh/m²/day to match store schema
    solar = arrays["solar_radiation"]
    finite = solar[np.isfinite(solar)]
    if finite.size and float(np.nanmedian(finite)) > 10.0:
        arrays["solar_radiation"] = solar / 3.6
        print("[real-store] solar converted MJ -> kWh (÷3.6)")

    arrays.update({
        "dates": np.array(dates),
        "lats": GRID_LATS.astype(np.float64),
        "lons": GRID_LONS.astype(np.float64),
        "grid_lat": grid_lat,
        "grid_lon": grid_lon,
    })
    mask = demo_mask_flat()
    apply_mask_in_place(arrays, mask)
    meta = {
        "provenance": "nasa_power_monthly_1981_present",
        "synthetic": False,
        "real_data": True,
        "source": "NASA POWER (https://power.larc.nasa.gov) — monthly, community=RE, metric",
        "note": ("Temperature, precipitation (mm total), solar (kWh/m²/day), relative humidity %, "
                 "wind m/s are real NASA POWER values 1981-01 through present. NDVI/SST/sea_level "
                 "are NOT available from POWER and are intentionally NaN — never faked. "
                 "Power data is satellite+model agroclimatology; grid = illustrative 15°×15°."),
        "time_range": [dates[0], dates[-1]],
        "n_months": T,
        "grid": {"lats": GRID_LATS.tolist(), "lons": GRID_LONS.tolist(), "n_cells": G},
        "failed_cells": failures,
        "generate_command": "python3 pipeline/build_real_power_store.py",
    }
    arrays["meta_json"] = np.array(json.dumps(meta))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    np.savez(out, **arrays)
    print(f"[real-store] wrote -> {out} ({out.stat().st_size/1e6:.1f} MB) · "
          f"T={T} months ({dates[0]}..{dates[-1]}) · G={G} cells · failed={failures} · "
          f"real params: temperature, precipitation, solar_radiation, humidity, wind")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
