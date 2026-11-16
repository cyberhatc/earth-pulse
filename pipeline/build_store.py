"""Build the REAL multi-variable store (Prompt 1, --fast tier: no login needed).

Sources (all free, no login):
  temperature : NASA GISTEMP v4 LOTI anomalies, 2 deg     (degC anomaly, 1951-1980)
  precipitation: GPCP v2.3 monthly, 2.5 deg               (mm/month)
  sst         : NOAA ERSST v5 monthly, 2 deg              (degC, ocean-only)
  humidity, wind, solar_radiation, ndvi, sea_level : UNAVAILABLE without extra
                products/logins — NaN, reported in manifest, never faked.

Grid: 2.5 deg global, lats -88.75..88.75 x lons -178.75..178.75 (144x72).
Writes:
  data/processed/earth_pulse_real.zarr   (canonical xarray/Zarr dataset)
  data/processed/earth_pulse_real.npz    (engine/API-compatible mirror)
  data/processed/manifest.json           (per-variable provenance + coverage)

Usage:
  python pipeline/build_store.py --fast            # ~2 min (downloads cached)
  python pipeline/build_store.py --start 1981 --fast
"""
from __future__ import annotations

import argparse
import gzip
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from pipeline.sources.common import target_grid, normalise_lon, regrid_to_target, coverage_arrays  # noqa: E402
from pipeline.sources import gistemp, sst, precip  # noqa: E402
from pipeline.land_ocean import apply_mask_in_place  # noqa: E402

BASE_DATE = __import__("datetime").datetime(1800, 1, 1)


def _decode_times(raw: np.ndarray, units: str | None = None) -> list[str]:
    """Decode CF 'days since YYYY-MM-DD' times to 'YYYY-MM' labels."""
    base = BASE_DATE
    if units:
        import re as _re
        m = _re.match(r"days since (\d{4})-(\d{2})-(\d{2})", units.strip())
        if m:
            base = __import__("datetime").datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    out = []
    for v in np.asarray(raw).astype(np.float64):
        if not np.isfinite(v):
            out.append("????-??")
            continue
        d = base + __import__("datetime").timedelta(days=int(v))
        out.append(f"{d.year:04d}-{d.month:02d}")
    return out


def _load_gistemp():
    import xarray as xr
    ds = gistemp.fetch_gridded()  # tempanomaly(time, lat, lon)
    tem = ds["tempanomaly"].values  # float32
    times = _decode_times(ds["time"].values, ds["time"].attrs.get("units"))
    lats = ds["lat"].values
    lons = ds["lon"].values
    return times, lats, lons, tem, dict(ds.attrs)


def _load_ersst():
    import xarray as xr
    ds = sst.fetch_ersst()
    arr = ds["sst"].values
    times = _decode_times(ds["time"].values, ds["time"].attrs.get("units"))
    return times, ds["lat"].values, ds["lon"].values, arr, dict(ds.attrs)


def _load_gpcp():
    import pandas as pd
    ds = precip.fetch_gpcp()
    times = pd.Series(ds["time"].values).dt.strftime("%Y-%m").tolist()
    return times, ds["lat"].values, ds["lon"].values, ds["precip"].values.transpose(0, 1, 2), dict(ds.attrs)


def _common_time_index(*time_lists, start_year: int) -> list[str]:
    sets = [set(t) for t in time_lists]
    common = sorted(set.intersection(*sets))
    common = [t for t in common if t >= f"{start_year:04d}-01"]
    if not common:
        raise RuntimeError("no overlapping months between sources")
    return common


def _align(times: list[str], arr: np.ndarray, axis: int, common: list[str]) -> np.ndarray:
    idx = {t: i for i, t in enumerate(times)}
    sel = [idx[t] for t in common]
    return np.take(arr, sel, axis=axis)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fast", action="store_true", default=True,
                    help="no-login tier: GISTEMP + GPCP + ERSST (default)")
    ap.add_argument("--start", type=int, default=1981)
    ap.add_argument("--zarr-out", default="data/processed/earth_pulse_real.zarr")
    ap.add_argument("--npz-out", default="data/processed/earth_pulse_real.npz")
    ap.add_argument("--manifest-out", default="data/processed/manifest.json")
    args = ap.parse_args()

    t0 = __import__("time").time()
    print("[build_store] loading sources (cached under data/cache/realstore/) ...")
    gt, glat, glon, gtem, g_attrs = _load_gistemp()
    et, elat, elon, gsst, e_attrs = _load_ersst()
    pt, plat, plon, gp, p_attrs = _load_gpcp()
    print(f"[build_store] GISTEMP {gt[0]}..{gt[-1]} | ERSST {et[0]}..{et[-1]} | GPCP {pt[0]}..{pt[-1]}")

    common = _common_time_index(gt, et, pt, start_year=args.start)
    T = len(common)
    print(f"[build_store] common months {common[0]}..{common[-1]} ({T})")

    d_lat, d_lon = target_grid()
    lats, lons = d_lat, d_lon
    nlat, nlon = len(lats), len(lons)
    G = nlat * nlon
    print(f"[build_store] regridding -> {nlat}x{nlon} = {G} cells ...")

    temp = regrid_to_target(glat, glon, _align(gt, gtem, 0, common))
    sst_a = regrid_to_target(elat, elon, _align(et, gsst, 0, common))
    precip_a = _align(pt, gp, 0, common).astype(np.float64)
    if not (np.allclose(plat, lats) and np.allclose(((plon + 180) % 360) - 180, lons)):
        precip_a = regrid_to_target(plat, plon, precip_a)
    else:
        _, precip_a = normalise_lon(plon, precip_a, lon_axis=-1)

    # ---- land/ocean mask: ocean = cell whose mean ocean fraction >= 0.5 ----
    import xarray as xr
    lsmask = xr.open_dataset(REPO_ROOT / "data" / "cache" / "realstore" / "lsmask.oisst.nc")["lsmask"].isel(time=0).values
    mlat = np.linspace(-89.875, 89.875, lsmask.shape[0])
    mlon = np.linspace(0.125, 359.875, lsmask.shape[1])
    mask2d = regrid_to_target(mlat, mlon, lsmask[np.newaxis, ...].astype(np.float64))[0]
    ocean_mask = (mask2d >= 0.5).astype(np.float32).ravel()  # 1=ocean, 0=land

    # sea-surface temperature only over ocean (product is NaN over land already;
    # re-apply the mask for the land-fraction cells)
    sst_a = sst_a.reshape(T, nlat, nlon)
    sst_a = np.where(ocean_mask.reshape(nlat, nlon)[None, ...] == 1, sst_a, np.nan)

    # ---- G grid flatten (C-order lat, lon) ----
    grid_lat = np.repeat(lats, nlon)
    grid_lon = np.tile(lons, nlat)

    temp_f = temp.reshape(T, G)
    precip_f = precip_a.reshape(T, G)
    sst_f = sst_a.reshape(T, G)
    # unavailable in the no-login tier — NaN everywhere, reported, never faked
    nan_f = np.full((T, G), np.nan)

    variables = {
        "temperature": temp_f,     # GISTEMP LOTI anomaly, degC (1951-1980 baseline)
        "precipitation": precip_f,
        "sst": sst_f,
        "ndvi": nan_f.copy(),
        "sea_level": nan_f.copy(),
        "solar_radiation": nan_f.copy(),
        "humidity": nan_f.copy(),
        "wind": nan_f.copy(),
    }

    # ---- Zarr (canonical) ----
    print("[build_store] writing Zarr ...")
    import xarray as xr
    ds = xr.Dataset(
        {name: (("time", "cell"), arr.astype(np.float32)) for name, arr in variables.items()},
        coords={
            "time": common,
            "grid_lat": ("cell", grid_lat.astype(np.float32)),
            "grid_lon": ("cell", grid_lon.astype(np.float32)),
            "ocean_mask": ("cell", ocean_mask),
        },
        attrs={
            "title": "Earth Pulse real store (--fast tier)",
            "synthetic": "false",
            "provenance": "GISTEMP_v4_LOTI + GPCP_v2.3 + ERSST_v5",
            "grid": "2.5deg global (lats -88.75..88.75 x lons -178.75..178.75)",
            "regridding": "bilinear with nearest-finite fill; masks re-applied post-regrid",
            "generated_by": "python pipeline/build_store.py --fast",
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    for name, src in (("temperature", g_attrs), ("precipitation", p_attrs), ("sst", e_attrs)):
        ds[name].attrs.update({k: str(v) for k, v in src.items()})
    for name in ("ndvi", "sea_level", "solar_radiation", "humidity", "wind"):
        ds[name].attrs["availability"] = "unavailable in --fast tier (needs Earthdata login / extra products); NaN by design"
    # coverage arrays (first/last valid month per cell)
    for name, arr in variables.items():
        n_valid, first, last = coverage_arrays(arr)
        ds[f"coverage_{name}"] = (("cell",), n_valid)
        ds[f"coverage_first_{name}"] = (("cell",), first)
        ds[f"coverage_last_{name}"] = (("cell",), last)
    zarr_out = REPO_ROOT / args.zarr_out
    if zarr_out.exists():
        shutil.rmtree(zarr_out)
    ds.to_zarr(str(zarr_out), mode="w")

    # ---- NPZ mirror (engine/API contract) ----
    print("[build_store] writing NPZ mirror ...")
    meta = {
        "provenance": "GISTEMP_v4_LOTI + GPCP_v2.3 + ERSST_v5",
        "synthetic": False,
        "note": (
            "Real, measured/reconstructed monthly products, no login required. Temperature is the "
            "GISTEMP v4 land-ocean temperature INDEX anomaly (degC vs 1951-1980), NOT absolute "
            "temperature; precipitation is GPCP v2.3 in mm/month; SST is ERSST v5 in degC (ocean "
            "cells only; NaN over land). NDVI, sea level, solar radiation, humidity and wind are "
            "unavailable in the --fast tier and are NaN — never faked. GISTEMP LOTI is an interpolated "
            "analysis; Era differences vs station data apply."
        ),
        "mask": "lsmask.oisst.nc (NOAA OISST land-sea mask), ocean where fraction >= 0.5",
        "time_range": [common[0], common[-1]],
        "n_months": T,
        "grid": {"lats": lats.tolist(), "lons": lons.tolist(), "n_cells": G, "resolution_deg": 2.5},
        "sources": {
            "temperature": {"product": "GISTEMP v4 LOTI (gistemp1200_GHCNv4_ERSSTv5)", "units": "degC anomaly (1951-1980)", "url": g_attrs.get("source")},
            "precipitation": {"product": "GPCP v2.3 Combined Precipitation Dataset (Final)", "units": "mm/month", "url": p_attrs.get("source")},
            "sst": {"product": "NOAA ERSST v5", "units": "degC", "url": e_attrs.get("source")},
        },
        "unavailable": ["ndvi", "sea_level", "solar_radiation", "humidity", "wind"],
        "generate_command": "python pipeline/build_store.py --fast",
    }
    arrays: dict[str, np.ndarray] = {
        "dates": np.array(common),
        "lats": lats.astype(np.float32),
        "lons": lons.astype(np.float32),
        "grid_lat": grid_lat.astype(np.float32),
        "grid_lon": grid_lon.astype(np.float32),
        "ocean_mask": ocean_mask.astype(np.float32),
        **{k: v.astype(np.float32) for k, v in variables.items()},
    }
    arrays["meta_json"] = np.array(json.dumps(meta))
    npz_out = REPO_ROOT / args.npz_out
    npz_out.parent.mkdir(parents=True, exist_ok=True)
    np.savez(npz_out, **arrays)

    # ---- manifest.json ----
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "build_seconds": round(__import__("time").time() - t0, 1),
        "grid": {"resolution_deg": 2.5, "n_lats": nlat, "n_lons": nlon, "n_cells": G},
        "time_range": [common[0], common[-1]],
        "n_months": T,
        "variables": {},
    }
    for name, arr in variables.items():
        n_valid, first, last = coverage_arrays(arr)
        manifest["variables"][name] = {
            "n_valid_cells": int((n_valid > 0).sum()),
            "n_cells_total": G,
            "mean_valid_months_per_cell": round(float(n_valid.mean()), 1),
            "first_month": common[int(first[first >= 0].min())] if (first >= 0).any() else None,
            "last_month": common[int(last.max())] if (last >= 0).any() else None,
            "available": bool((n_valid > 0).any()),
        }
    manifest_path = REPO_ROOT / args.manifest_out
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(json.dumps(manifest["variables"], indent=2))
    print(f"[build_store] done in {manifest['build_seconds']}s -> {zarr_out} | {npz_out} | {manifest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
