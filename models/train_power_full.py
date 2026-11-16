"""Train the live real-store forecaster on ALL available POWER parameters.

Unlike models/train.py (which targets the fixed 8-variable synthetic layout),
this trains on every 2-D (T × cells) parameter array in a NASA POWER store that
meets the coverage threshold — including the location-adjacent extended params
from build_power_full_store.py. Ridge lambda defaults to 1000, which was selected
on an internal 2011-2015 validation split (NOT the 2016-2026 holdout).

Usage:
  python3 models/train_power_full.py [--input data/processed/earth_pulse_power_full.npz]
                                     [--output data/processed/forecaster_power_real.npz]
                                     [--lam 1000] [--min-coverage 0.90]
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

from pipeline.export_store import load_store  # noqa: E402
from pipeline.clean import fill_missing_linear  # noqa: E402
from pipeline.build_features import prepare_cell_matrix  # noqa: E402
from models.forecast import make_windows, RidgeRollout  # noqa: E402

RESERVED = {"dates", "lats", "lons", "grid_lat", "grid_lon", "meta", "meta_json", "ocean_mask"}
SEQ_LEN = 24


def usable_params(store: dict, dates: list[str], G: int, min_coverage: float) -> list[str]:
    out = []
    for key, value in store.items():
        if key in RESERVED or not isinstance(value, np.ndarray):
            continue
        if value.ndim != 2 or value.shape[0] != len(dates) or value.shape[1] != G:
            continue
        if float(np.isfinite(value).mean()) >= min_coverage:
            out.append(key)
    return sorted(out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="data/processed/earth_pulse_power_full.npz")
    ap.add_argument("--output", default="data/processed/forecaster_power_real.npz")
    ap.add_argument("--lam", type=float, default=1000.0)
    ap.add_argument("--min-coverage", type=float, default=0.90)
    args = ap.parse_args()

    t0 = time.time()
    store = load_store(args.input)
    dates = list(store["dates"])
    G = len(store["grid_lat"])
    params = usable_params(store, dates, G, args.min_coverage)
    print(f"[train-full] store: {args.input} ({dates[0]}..{dates[-1]}, {len(dates)} months × {G} cells)")
    print(f"[train-full] parameters ({len(params)}): {', '.join(params)}")

    xs_all, ys_all = [], []
    for cell in range(G):
        _, X = prepare_cell_matrix(store, cell, params)
        xs, ys = make_windows(X, SEQ_LEN)
        xs_all.append(xs)
        ys_all.append(ys)
    Xs = np.vstack(xs_all)
    Ys = np.vstack(ys_all)
    print(f"[train-full] pooled samples: {Xs.shape} -> targets {Ys.shape}")

    model = RidgeRollout(lam=args.lam).fit(Xs, Ys)
    print(f"[train-full] fitted ridge in {time.time()-t0:.1f}s; resid_std = {np.round(model.resid_std, 3)}")

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    model.save(out)
    meta = {
        "artifact": out.name,
        "variables": params,
        "seq_len": SEQ_LEN,
        "lam": args.lam,
        "samples": int(Xs.shape[0]),
        "store": str(args.input),
        "store_time_range": [dates[0], dates[-1]],
        "provenance": store.get("meta", {}).get("provenance"),
        "note": ("Ridge rollout trained on ALL usable NASA POWER parameters (auto-detected, "
                 ">=90% finite). Lambda selected on internal 2011-2015 validation split."),
    }
    (out.parent / "forecaster_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"[train-full] wrote -> {out} (+ forecaster_meta.json) in {time.time()-t0:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
