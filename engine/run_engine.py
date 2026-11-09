"""Precompute engine outputs → data/processed/analysis.json

Computes, for every grid cell and parameter:
  trends:        Theil–Sen slope per decade + Mann–Kendall significance
  opposite_pairs: neighboring cells with significant opposite trends (NDVI & precipitation)
  twins:         KMeans cluster labels on [temperature, precipitation, ndvi, sst]

Usage: python3 engine/run_engine.py [--input data/samples/earth_pulse_sample.npz]
                                     [--output data/processed/analysis.json]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.export_store import load_store, VARIABLES
from engine.trends import analyse_series
from engine.opposite import find_opposite_pairs
from engine.climate_twins import cluster_cells


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default=None)
    ap.add_argument("--output", default=None)
    args = ap.parse_args()

    t0 = time.time()
    store = load_store(args.input)
    dates = list(store["dates"])
    lats, lons = store["lats"], store["lons"]
    n_lats, n_lons = len(lats), len(lons)
    grid_lat, grid_lon = store["grid_lat"], store["grid_lon"]
    G = len(grid_lat)

    print(f"[engine] loaded store: {len(dates)} months × {G} cells ({n_lats}×{n_lons})")

    # ---- trends ----
    trends: dict[str, dict] = {}
    trend_lookup: dict[int, dict] = {}
    periods_per_decade = 120.0  # monthly
    for var in VARIABLES:
        arr = store[var]
        per_cell = {}
        for cell in range(G):
            res = analyse_series(arr[:, cell], periods_per_decade)
            per_cell[str(cell)] = res
        trends[var] = per_cell
        trend_lookup = {int(k): v for k, v in per_cell.items()}
        print(f"[engine] trends done: {var}")

    # ---- opposite trends (ndvi & precipitation) ----
    # rebuild per-cell nested dict once (needed by find_opposite_pairs)
    per_cell_all: dict[int, dict] = {c: {} for c in range(G)}
    for var in VARIABLES:
        for c, rec in ((int(k), v) for k, v in trends[var].items()):
            per_cell_all[c][var] = rec

    opposite_ndvi = find_opposite_pairs(grid_lat, grid_lon, n_lats, n_lons, per_cell_all, "ndvi", max_pairs=120)
    opposite_precip = find_opposite_pairs(grid_lat, grid_lon, n_lats, n_lons, per_cell_all, "precipitation", max_pairs=120)
    print(f"[engine] opposite pairs: ndvi={len(opposite_ndvi)} precipitation={len(opposite_precip)}")

    # ---- climate twins ----
    feat = np.stack([store["temperature"].mean(axis=0),
                     store["precipitation"].mean(axis=0),
                     store["ndvi"].mean(axis=0),
                     store["sst"].mean(axis=0)], axis=1)
    labels, _, _, scaler = cluster_cells(feat, k=8)
    print("[engine] climate twins done")

    payload = {
        "schema_version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": str(args.input or "data/samples/earth_pulse_sample.npz"),
        "synthetic_demo": bool(store.get("meta", {}).get("synthetic", True)),
        "time_range": [dates[0], dates[-1]],
        "n_months": len(dates),
        "grid": {"n_lats": n_lats, "n_lons": n_lons, "lats": lats.tolist(), "lons": lons.tolist()},
        "trends": trends,
        "opposite_trends": {"ndvi": opposite_ndvi, "precipitation": opposite_precip},
        "climate_twins": {"labels": [int(x) for x in labels], "k": 8,
                          "features": ["temperature_mean", "precipitation_mean", "ndvi_mean", "sst_mean"],
                          "scaler": scaler},
        "cells": [{"index": i, "lat": float(grid_lat[i]), "lon": float(grid_lon[i])} for i in range(G)],
        "compute_seconds": round(time.time() - t0, 2),
    }
    out = Path(args.output) if args.output else Path("data/processed/analysis.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload))
    print(f"[engine] wrote → {out} ({out.stat().st_size/1024:.0f} KB) in {time.time()-t0:.1f}s")


if __name__ == "__main__":
    main()
