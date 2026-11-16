"""Precompute engine outputs -> data/processed/analysis.json

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
from engine.trend import analyse
from engine.preprocess import month_index, year_index
from engine.field_significance import benjamini_hochberg
from engine.opposite_v2 import find_opposite_v2, load_hypotheses, min_effect_from_config
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

    # ---- trends (Phase 2: deseasonalised, annual-headline, FDR across cells) ----
    trends: dict[str, dict] = {}
    fdr_summary: dict[str, dict] = {}
    months = month_index(dates)
    years = year_index(dates)
    baseline = tuple(int(x) for x in (__import__("os").environ.get("EP_TREND_BASELINE", "1991-2020").split("-")))
    start_label, end_label = dates[0], dates[-1]
    for var in VARIABLES:
        if var not in store:
            print(f"[engine] trends skipped: {var} (absent from store)")
            continue
        arr = store[var]
        per_cell = {}
        pvals = np.empty(G, dtype=np.float64)
        for cell in range(G):
            res = analyse(arr[:, cell], months, years, periods_per_decade=120.0,
                          baseline=baseline, start_label=start_label, end_label=end_label)
            n_finite = int(np.isfinite(arr[:, cell]).sum())
            if n_finite < 8:
                res["direction"] = "insufficient data"
                res["significant"] = False
                res["p_value"] = 1.0
            res["n_finite"] = n_finite
            for k in ("slope_per_decade", "ci_low", "ci_high", "p_value", "p_value_uncorrected",
                      "p_value_seasonal", "tau", "lag1_autocorr"):
                v = res.get(k)
                if v is not None and not np.isfinite(v):
                    res[k] = 0.0 if k in ("slope_per_decade",) else 1.0
            pvals[cell] = res["p_value"]
            per_cell[str(cell)] = res
        # Benjamini–Hochberg FDR across this variable's grid cells (q=0.05)
        adj, sig_fdr = benjamini_hochberg(pvals, q=0.05)
        raw_flags = np.array([bool(per_cell[str(i)]["significant"]) for i in range(G)])
        for i in range(G):
            per_cell[str(i)]["p_value_fdr"] = float(adj[i])
            per_cell[str(i)]["significant_fdr"] = bool(sig_fdr[i])
            per_cell[str(i)]["significant_raw"] = bool(raw_flags[i])
        trends[var] = per_cell
        fdr_summary[var] = {
            "n_cells": G,
            "fraction_significant_raw": round(float(raw_flags.mean()), 4),
            "fraction_significant_fdr": round(float(sig_fdr.mean()), 4),
            "fdr_q": 0.05,
        }
        print(f"[engine] trends done: {var} (raw sig {fdr_summary[var]['fraction_significant_raw']:.1%}, "
              f"FDR sig {fdr_summary[var]['fraction_significant_fdr']:.1%})")

    # ---- opposite trends v2 (patches, FDR gate, case files, null baseline) ----
    per_cell_all: dict[int, dict] = {c: {} for c in range(G)}
    for var in trends:
        for c, rec in ((int(k), v) for k, v in trends[var].items()):
            per_cell_all[c][var] = rec

    hypotheses = load_hypotheses()
    min_effects = min_effect_from_config()
    opposite_ndvi: list[dict] = []
    opposite_precip: list[dict] = []
    opposite_meta: dict[str, dict] = {}
    for param, sink in (("ndvi", opposite_ndvi), ("precipitation", opposite_precip)):
        if param not in trends:
            continue
        out = find_opposite_v2(grid_lat, grid_lon, n_lats, n_lons, per_cell_all, param,
                               min_effect_size=min_effects.get(param, min_effects["default"]),
                               hypotheses=hypotheses, dates=dates)
        sink.extend(out["pairs"])
        opposite_meta[param] = out["meta"]
        print(f"[engine] opposite v2 {param}: {len(out['pairs'])} pairs "
              f"({out['meta']['n_cell_pairs']} cell-pairs; null expected {out['meta']['null_model']['expected_pairs']}, "
              f"p={out['meta']['null_model']['p_value']})")

    # ---- climate twins (NaN-safe: fill masked params with that parameter's column mean) ----
    def _nan_col_mean(a: np.ndarray) -> np.ndarray:
        with __import__("numpy").errstate(invalid="ignore"):
            m = np.nanmean(a, axis=0)
        m = np.where(np.isfinite(m), m, 0.0)
        return m

    def _filled_col(a: np.ndarray) -> np.ndarray:
        m = _nan_col_mean(a)
        out = a.copy()
        for j in range(out.shape[1]):
            col = out[:, j]
            bad = ~np.isfinite(col)
            if bad.any():
                col[bad] = m[j]
        return out

    twin_feats = [("temperature_mean", "temperature"), ("precipitation_mean", "precipitation"),
                  ("ndvi_mean", "ndvi"), ("sst_mean", "sst"), ("sea_level_mean", "sea_level")]
    present = [name for name, src in twin_feats if src in store]
    if len(present) >= 2:
        twin_names = [name for name, _ in twin_feats if name in present]
        feat = np.stack([_filled_col(store[src]).mean(axis=0) for _, src in twin_feats if src in store], axis=1)
        labels, _, _, scaler = cluster_cells(feat, k=8)
        twins = {"labels": [int(x) for x in labels], "k": 8,
                 "features": twin_names,
                 "scaler": scaler}
    else:
        labels = np.zeros(G, dtype=int)
        twins = {"labels": [int(x) for x in labels], "k": 0,
                 "features": [],
                 "scaler": None}
    print("[engine] climate twins done")

    payload = {
        "schema_version": "1.1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": str(args.input or "data/samples/earth_pulse_sample.npz"),
        "synthetic_demo": bool(store.get("meta", {}).get("synthetic", True)),
        "time_range": [dates[0], dates[-1]],
        "n_months": len(dates),
        "grid": {"n_lats": n_lats, "n_lons": n_lons, "lats": lats.tolist(), "lons": lons.tolist()},
        "trend_baseline": list(baseline),
        "trend_method": "deseasonalised(climatology 1991-2020) -> annual means -> Sen slope + TFPW Mann-Kendall (headline); seasonal MK on monthly anomalies alongside",
        "fdr_summary": fdr_summary,
        "trends": trends,
        "opposite_trends": {"ndvi": opposite_ndvi, "precipitation": opposite_precip},
        "opposite_meta": opposite_meta,
        "climate_twins": twins,
        "cells": [{"index": i, "lat": float(grid_lat[i]), "lon": float(grid_lon[i])} for i in range(G)],
        "compute_seconds": round(time.time() - t0, 2),
    }
    out = Path(args.output) if args.output else Path("data/processed/analysis.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, allow_nan=False), encoding="utf-8")
    print(f"[engine] wrote -> {out} ({out.stat().st_size/1024:.0f} KB) in {time.time()-t0:.1f}s")


if __name__ == "__main__":
    main()
