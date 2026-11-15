"""Build an EXTENDED NASA POWER store — all extractable parameters, all cells.

Re-uses the 240-cell 15°×15° grid of the real store and requests every POWER
monthly parameter that is plausibly available for 1981–present, then keeps only
those with >= ``--min-coverage`` finite values (across all cells and months).
Everything not available from POWER (NDVI/SST/sea_level/...) is reported as
unavailable and never faked.

Writes the same npz layout as the real store (dates, lats, lons, grid_lat,
grid_lon, <param> (T, G), meta_json) with full provenance. Network required;
responses are cached in data/cache/ (key prefix ``power-full-all:``), so reruns
are cheap. ~0.25 s pause between requests; 240 cells total.

Usage:
  python3 pipeline/build_power_full_store.py [--out data/processed/earth_pulse_power_full.npz]
                                             [--refresh]   # bypass 30-day cache
                                             [--min-coverage 0.9]
                                             [--probe]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from pipeline.fetch_power import fetch_power_point  # noqa: E402
from pipeline.cache import cached_json  # noqa: E402

GRID_LATS = np.arange(-60.0, 76.0, 15.0)
GRID_LONS = np.arange(-180.0, 180.0, 15.0)
CACHE_TTL = 30 * 24 * 3600

# POWER monthly parameter -> local variable name. Every one of these is a real
# NASA POWER monthly series; parameters that come back all -999/None are dropped
# by the coverage filter rather than filled.
PARAM_MAP = {
    "T2M": "temperature",
    "T2M_MAX": "temperature_max",
    "T2M_MIN": "temperature_min",
    "T2MDEW": "dew_point",
    "TS": "skin_temperature",
    "PRECTOTCORR": "precipitation",
    "RH2M": "humidity",
    "QV2M": "specific_humidity",
    "WS2M": "wind",
    "ALLSKY_SFC_SW_DWN": "solar_radiation",
    "ALLSKY_SFC_LW_DWN": "longwave_radiation",
    "CLRSKY_SFC_SW_DWN": "clear_sky_solar_radiation",
    "PS": "surface_pressure",
    "GWETPROF": "soil_moisture_profile",
    "GWETROOT": "soil_moisture_rootzone",
    "GWETTOP": "soil_moisture_surface",
    "EVPTRNS": "evapotranspiration",
    "AOD_55": "aerosol_optical_depth",
    "T2M_RANGE": "diurnal_temperature_range",
    # CLOUD is rejected by the monthly RE API (HTTP 422) — omitted honestly.
}


def fetch_cell(lat: float, lon: float, ttl_seconds: float = CACHE_TTL) -> dict:
    key = f"power-full-all:{lat:.1f},{lon:.1f}"

    def _produce():
        from datetime import date as _date
        end = _date.today().year
        res = fetch_power_point(lat, lon, 1981, end, parameters=list(PARAM_MAP), timeout=120)
        if "error" in res:
            raise RuntimeError(res["error"])  # failures are never cached
        return {"available": True, **res}

    try:
        return cached_json(key, ttl_seconds=ttl_seconds, producer=_produce)
    except Exception as exc:
        return {"available": False, "note": str(exc)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/processed/earth_pulse_power_full.npz")
    ap.add_argument("--refresh", action="store_true", help="bypass the 30-day cache")
    ap.add_argument("--min-coverage", type=float, default=0.90,
                    help="minimum fraction of finite values (per parameter, all cells×months) to keep")
    ap.add_argument("--pause", type=float, default=0.25)
    ap.add_argument("--probe", action="store_true", help="fetch one cell, print availability, exit")
    args = ap.parse_args()

    ttl = 0 if args.refresh else CACHE_TTL
    probe = fetch_cell(0.0, 0.0, ttl_seconds=ttl)
    if not probe.get("available"):
        print("[power-full] FATAL: POWER unreachable:", probe)
        return 2
    params = probe["parameters"]
    dates = sorted({d for series in params.values() for d in series})
    if not dates:
        print("[power-full] FATAL: no dates returned")
        return 2
    T = len(dates)
    import calendar
    days_in_month = {d: calendar.monthrange(int(d[:4]), int(d[5:7]))[1] for d in dates}
    print(f"[power-full] canonical axis: {dates[0]} .. {dates[-1]} ({T} months)")

    if args.probe:
        for src, dst in sorted(PARAM_MAP.items()):
            series = params.get(src, {})
            print(f"  {dst:28s} n={len(series)}")
        return 0

    grid = [(lat, lon) for lat in GRID_LATS for lon in GRID_LONS]
    G = len(grid)
    grid_lat = np.array([g[0] for g in grid])
    grid_lon = np.array([g[1] for g in grid])

    arrays = {dst: np.full((T, G), np.nan, dtype=np.float64) for dst in PARAM_MAP.values()}
    date_idx = {d: i for i, d in enumerate(dates)}
    failures = 0
    t0 = time.time()
    for j, (lat, lon) in enumerate(grid):
        cell = fetch_cell(lat, lon, ttl_seconds=ttl)
        if not cell.get("available"):
            failures += 1
            print(f"[power-full] cell {j+1}/{G} ({lat:.0f},{lon:.0f}) FAILED: {cell.get('note')}")
            time.sleep(args.pause)
            continue
        for src, dst in PARAM_MAP.items():
            series = cell["parameters"].get(src, {})
            for d, v in series.items():
                i = date_idx.get(d)
                if i is not None:
                    try:
                        f = float(v)
                    except (TypeError, ValueError):
                        continue
                    if f <= -999.0:
                        continue  # POWER missing-value marker -> NaN
                    if src == "PRECTOTCORR":
                        # POWER monthly reports mm/day; the store is mm/month.
                        f *= days_in_month[d]
                    arrays[dst][i, j] = f
        if (j + 1) % 40 == 0:
            print(f"[power-full] {j+1}/{G} cells fetched ({time.time()-t0:.0f}s)")
        time.sleep(args.pause)

    # Coverage filter: keep only parameters present almost everywhere.
    kept, dropped = {}, {}
    for dst, arr in arrays.items():
        finite = float(np.isfinite(arr).mean())
        if finite >= args.min_coverage:
            kept[dst] = arr
        else:
            dropped[dst] = {"coverage": round(finite, 4)}
    if dropped:
        print("[power-full] dropped parameters (insufficient coverage): "
              + ", ".join(f"{k} ({v['coverage']:.1%})" for k, v in dropped.items()))

    out = REPO_ROOT / args.out if not Path(args.out).is_absolute() else Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    meta = {
        "provenance": "nasa_power_monthly_full_1981_present",
        "synthetic": False,
        "real_data": True,
        "source": "NASA POWER (https://power.larc.nasa.gov) — monthly, community=RE, metric",
        "note": ("Real NASA POWER monthly values for the 1981-present record. "
                 "NDVI/SST/sea_level are NOT available from POWER and are not present; "
                 "never faked. Power data is satellite+model agroclimatology; grid = illustrative 15°×15°."),
        "time_range": [dates[0], dates[-1]],
        "n_months": T,
        "n_cells": G,
        "parameters_kept": list(kept),
        "parameters_dropped": dropped,
        "grid": {"lats": list(map(float, GRID_LATS)), "lons": list(map(float, GRID_LONS)), "n_cells": G},
        "failed_cells": failures,
        "units": {"precipitation": "mm/month (POWER mm/day × days-in-month)"},
        "generate_command": "python3 pipeline/build_power_full_store.py --refresh",
    }
    np.savez(out, dates=np.array(dates), lats=GRID_LATS, lons=GRID_LONS,
             grid_lat=grid_lat, grid_lon=grid_lon, meta_json=np.array(json.dumps(meta)),
             **kept)
    print(f"[power-full] wrote {out} · T={T} months · {G} cells · kept={len(kept)} · dropped={len(dropped)} · failed={failures}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
