"""Train the multivariate forecaster (pooled across all grid cells).

Usage: python3 models/train.py [--input data/samples/earth_pulse_sample.npz]
                               [--output models/artifacts/forecaster.npz]
                               [--torch]   # if PyTorch installed (see notebooks/02)
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.export_store import load_store, VARIABLES
from pipeline.build_features import prepare_cell_matrix
from models.forecast import make_windows, RidgeRollout

SEQ_LEN = 24
STORE_VARIABLES = list(VARIABLES)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default=None)
    ap.add_argument("--output", default=None)
    ap.add_argument("--seq-len", type=int, default=SEQ_LEN)
    ap.add_argument("--lam", type=float, default=1e-2)
    ap.add_argument("--max-cells", type=int, default=0,
                    help="subsample cells for pooled training (0 = all; use ~1500 for 2.5deg stores)")
    ap.add_argument("--stride", type=int, default=1, help="use every Nth cell (overrides nothing if --max-cells set)")
    ap.add_argument("--variables", default=None, help="comma-separated variable list (default: all store variables)")
    args = ap.parse_args()

    t0 = time.time()
    store = load_store(args.input)
    variables = [v.strip() for v in args.variables.split(",")] if args.variables else STORE_VARIABLES
    variables = [v for v in variables if v in store]
    print(f"[train] variables: {variables}")
    G = len(store["grid_lat"])
    cell_ids = list(range(0, G, max(1, args.stride)))
    if args.max_cells and len(cell_ids) > args.max_cells:
        stride = max(1, len(cell_ids) // args.max_cells)
        cell_ids = list(range(0, G, stride))[:args.max_cells]
    print(f"[train] using {len(cell_ids)}/{G} cells")
    xs_all, ys_all = [], []
    used = 0
    for cell in cell_ids:
        try:
            dates, X = prepare_cell_matrix(store, cell, variables)
        except Exception:
            continue
        xs, ys = make_windows(X, args.seq_len)
        if len(xs) == 0:
            continue
        xs_all.append(xs)
        ys_all.append(ys)
        used += 1
    if not xs_all:
        raise RuntimeError("no trainable cells — check variable coverage")
    Xs = np.vstack(xs_all)
    Ys = np.vstack(ys_all)
    print(f"[train] pooled samples: {Xs.shape} -> targets {Ys.shape}")

    model = RidgeRollout(lam=args.lam).fit(Xs, Ys)
    print(f"[train] fitted ridge in {time.time()-t0:.1f}s; resid_std (raw units) = {np.round(model.resid_std, 3)}")

    out = Path(args.output) if args.output else Path("models/artifacts/forecaster.npz")
    out.parent.mkdir(parents=True, exist_ok=True)
    model.save(out)
    meta = {
        "artifact": out.name,
        "variables": variables,
        "seq_len": args.seq_len,
        "lam": args.lam,
        "samples": int(Xs.shape[0]),
        "cells_used": int(used),
        "cells_total": int(G),
        "note": "Ridge rollout trained on pooled cells. For PyTorch LSTM see notebooks/02_train_forecast.ipynb.",
    }
    (out.parent / "forecaster_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"[train] wrote -> {out} (+ forecaster_meta.json)")


if __name__ == "__main__":
    main()
