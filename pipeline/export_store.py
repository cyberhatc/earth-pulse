"""Sample data store for Earth Pulse.

Two modes:
1. Synthetic demo store (default, offline): a deterministic, globally gridded
   multivariate series generated from physical intuition (equator-hot/wet,
   storm-belt winds, global warming trend, regional opposite gradients).
   It exists so the whole app runs with zero network/credentials.
2. Real-data export helpers (xarray/Zarr) used by the actual NASA pipeline.

The .npz store layout (kept stable for engine/models/api/tests):
  dates        (T,)   str  'YYYY-MM'
  lats         (La,)  float64
  lons         (Lo,)  float64
  grid_lat     (G,)   float64   cell centers, C-order over (lat, lon)
  grid_lon     (G,)   float64
  <var>        (T, G) float64   temperature, precipitation, ndvi, sst,
                                 sea_level, solar_radiation, humidity, wind
  meta_json    ()     str       JSON: provenance, synthetic flag, ranges
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SAMPLE_PATH = REPO_ROOT / "data" / "samples" / "earth_pulse_sample.npz"
META_PATH = REPO_ROOT / "data" / "samples" / "earth_pulse_sample_meta.json"

VARIABLES = [
    "temperature",
    "precipitation",
    "ndvi",
    "sst",
    "sea_level",
    "solar_radiation",
    "humidity",
    "wind",
]


def _month_list() -> list[str]:
    dates: list[str] = []
    for year in range(1985, 2027):
        for month in range(1, 13):
            if year == 2026 and month > 6:
                break
            dates.append(f"{year:04d}-{month:02d}")
    return dates


def _seasonal_phase(month_idx: np.ndarray, lat: float) -> np.ndarray:
    """Phase of the seasonal cycle. In the northern hemisphere the peak is in July,
    in the southern hemisphere in January."""
    peak = 7 if lat >= 0 else 1
    return np.cos(2.0 * np.pi * (month_idx + 1 - peak) / 12.0)


def build_sample_arrays():
    rng = np.random.default_rng(42)
    lats = np.arange(-60.0, 76.0, 15.0)
    lons = np.arange(-180.0, 180.0, 15.0)
    dates = _month_list()
    T = len(dates)
    month_idx = np.array([int(d.split("-")[1]) - 1 for d in dates], dtype=np.int64)
    year_frac = np.array([int(d.split("-")[0]) + month_idx[i] / 12.0 for i, d in enumerate(dates)])
    t_index = np.arange(T, dtype=np.float64)

    grid = [(lat, lon) for lat in lats for lon in lons]
    G = len(grid)
    grid_lat = np.array([g[0] for g in grid])
    grid_lon = np.array([g[1] for g in grid])

    temp = np.zeros((T, G))
    precip = np.zeros((T, G))
    ndvi = np.zeros((T, G))
    sst = np.zeros((T, G))
    slev = np.zeros((T, G))
    solar = np.zeros((T, G))
    humid = np.zeros((T, G))
    wind = np.zeros((T, G))

    for j, (lat, lon) in enumerate(grid):
        abs_lat = abs(lat)
        phase = _seasonal_phase(month_idx, lat)
        # High-frequency "regional dipole" so neighboring cells can genuinely
        # trend in opposite directions (drives the Opposite Trend Detector demo).
        dipole = math.sin(math.radians(lon * 3.0)) + 0.8 * math.cos(math.radians(lat * 4.0))

        # Temperature: ~0.27 degC/decade trend + strong latitude structure
        t_trend = (0.27 + 0.12 * np.sin(math.radians(lon * 2.0))) * (t_index / 120.0)  # per ~10 years
        temp[:, j] = (
            29.0
            - 0.62 * abs_lat
            + (3.0 + 7.0 * abs_lat / 60.0) * phase
            + t_trend
            + rng.normal(0, 0.9, T)
        )

        # Precipitation (mm/month): ITCZ band + latitude drydown; opposing trend dipole
        p_base = 130.0 - 0.95 * abs_lat + 25.0 * math.cos(math.radians(lat * 2.0))
        p_trend = (-0.055 * np.sign(dipole) * (abs(dipole) + 0.15)) * t_index
        precip[:, j] = np.clip(
            p_base + 35.0 * phase + p_trend + rng.normal(0, 18.0, T),
            0.0,
            None,
        )

        # NDVI: equator-rich vegetation; trend tracks precipitation dipole (damped + offset)
        e_base = 0.15 + 0.55 * math.cos(math.radians(lat * 1.35))
        e_trend = (0.00045 * np.sign(dipole) * (abs(dipole) + 0.2)) * t_index
        ndvi[:, j] = np.clip(
            e_base + 0.10 * phase + e_trend + rng.normal(0, 0.03, T),
            0.0,
            0.95,
        )

        # Sea surface temperature: ~0.10 degC/decade
        sst[:, j] = 28.0 - 0.30 * abs_lat + 1.6 * phase + 0.10 / 120.0 * t_index + rng.normal(0, 0.5, T)

        # Sea level anomaly (mm) relative to 1993 mean; ~3.4 mm/yr global mean rise
        mm_per_month = 3.4 / 12.0
        baseline_offset = -(year_frac[0] - 1993.0) * 12.0 * mm_per_month
        slev[:, j] = baseline_offset + mm_per_month * t_index + 4.0 * math.sin(math.radians(lon * 2.0 + lat)) + rng.normal(0, 3.0, T)

        solar[:, j] = 0.185 + 0.075 * math.cos(math.radians(lat * 1.4)) + 0.02 * phase + rng.normal(0, 0.012, T)
        humid[:, j] = np.clip(72.0 - 0.28 * abs_lat + 9.0 * phase + rng.normal(0, 3.5, T), 5.0, 100.0)
        wind[:, j] = np.clip(2.6 + 2.6 * math.cos(math.radians(2.0 * lat)) + 2.5 * math.sin(math.radians(lon * 1.5)) + rng.normal(0, 0.7, T), 0.2, None)

    arrays = {
        "dates": np.array(dates),
        "lats": lats,
        "lons": lons,
        "grid_lat": grid_lat,
        "grid_lon": grid_lon,
    }
    for name, arr in zip(
        VARIABLES,
        [temp, precip, ndvi, sst, slev, solar, humid, wind],
    ):
        arrays[name] = arr

    # --- land/ocean mask: SST & sea level only over ocean; NDVI only over land ---
    from pipeline.land_ocean import demo_mask_flat, apply_mask_in_place
    mask = demo_mask_flat()
    apply_mask_in_place(arrays, mask)
    n_ocean = int(mask.sum())
    print(f"[pipeline] demo land/ocean mask applied — ocean cells: {n_ocean}/{len(mask)} (illustrative, labeled)")

    meta = {
        "provenance": "synthetic_demo",
        "synthetic": True,
        "note": (
            "Deterministic synthetic data generated by pipeline/export_store.py. "
            "Shapes and trends are physically motivated but NOT real observations. "
            "SST/sea_level are NaN over land cells and NDVI over ocean cells via an "
            "ILLUSTRATIVE embedded 15-degree mask (pipeline/land_ocean.py) — dominant-class "
            "approximation, not authoritative. Replace with MERRA-2/POWER/MODIS-derived stores "
            "for real analysis (see docs/data-sources.md)."
        ),
        "mask": "illustrative_15deg_dominant_class (1=ocean, 0=land)",
        "time_range": [dates[0], dates[-1]],
        "n_months": T,
        "grid": {"lats": lats.tolist(), "lons": lons.tolist(), "n_cells": G},
        "generate_command": "python3 pipeline/run_pipeline.py --sample",
    }
    arrays["meta_json"] = np.array(json.dumps(meta))
    return arrays


def generate_sample(output: str | Path | None = None) -> Path:
    out = Path(output) if output else DEFAULT_SAMPLE_PATH
    out.parent.mkdir(parents=True, exist_ok=True)
    arrays = build_sample_arrays()
    np.savez(out, **arrays)
    try:
        META_PATH.write_text(arrays["meta_json"].item())
    except Exception:
        pass
    return out


def load_store(path: str | Path | None = None) -> dict[str, np.ndarray]:
    p = Path(path) if path else DEFAULT_SAMPLE_PATH
    if not p.exists():
        raise FileNotFoundError(
            f"Sample store not found at {p}. Run: python3 pipeline/run_pipeline.py --sample"
        )
    with np.load(p, allow_pickle=False) as z:
        store = {k: z[k] for k in z.files}
    # meta_json is stored as a 0-d unicode array. Use .item() rather than str()
    # so a future 1-element array cannot leak "['...']" into json.loads().
    raw_meta = store.pop("meta_json", None)
    if isinstance(raw_meta, np.ndarray):
        meta_text = str(raw_meta.item()) if raw_meta.size == 1 else str(raw_meta)
    else:
        meta_text = str(raw_meta) if raw_meta is not None else ""
    store["meta"] = json.loads(meta_text or "{}")
    return store


def nearest_cell_index(store: dict[str, np.ndarray], lat: float, lon: float) -> int:
    """Index of the grid cell nearest to (lat, lon) (equirectangular approximation)."""
    dlat = store["grid_lat"] - lat
    dlon = (store["grid_lon"] - lon + 180.0) % 360.0 - 180.0
    # cheap anisotropic scaling so lon degrees count less at high latitude
    scale = np.cos(np.radians(np.clip(lat, -85, 85)))
    dist2 = dlat**2 + (dlon * max(scale, 0.15)) ** 2
    return int(np.argmin(dist2))


def cell_series(store: dict[str, np.ndarray], var: str, cell: int) -> np.ndarray:
    return store[var][:, cell].astype(np.float64)


def export_zarr(dataset_xarray, path: str | Path) -> None:
    """Real-data export hook (requires xarray + zarr). Optional; not used by the demo."""
    try:
        import xarray as xr  # noqa: F401
    except ImportError as exc:  # pragma: no cover - environment dependent
        raise RuntimeError(
            "xarray is required for Zarr export. Install it: pip install xarray zarr netCDF4"
        ) from exc
    dataset_xarray.to_zarr(str(path), mode="w", consolidated=True)
