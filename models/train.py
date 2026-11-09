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


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default=None)
    ap.add_argument("--output", default=None)
    ap.add_argument("--seq-len", type=int, default=SEQ_LEN)
    ap.add_argument("--lam", type=float, default=1e-2)
    args = ap.parse_args()

    t0 = time.time()
    store = load_store(args.input)
    G = len(store["grid_lat"])
    xs_all, ys_all = [], []
    for cell in range(G):
        dates, X = prepare_cell_matrix(store, cell, VARIABLES)
        xs, ys = make_windows(X, args.seq_len)
        xs_all.append(xs)
        ys_all.append(ys)
    Xs = np.vstack(xs_all)
    Ys = np.vstack(ys_all)
    print(f"[train] pooled samples: {Xs.shape} → targets {Ys.shape}")

    model = RidgeRollout(lam=args.lam).fit(Xs, Ys)
    print(f"[train] fitted ridge in {time.time()-t0:.1f}s; resid_std (raw units) = {np.round(model.resid_std, 3)}")

    out = Path(args.output) if args.output else Path("models/artifacts/forecaster.npz")
    out.parent.mkdir(parents=True, exist_ok=True)
    model.save(out)
    meta = {
        "artifact": out.name,
        "variables": VARIABLES,
        "seq_len": args.seq_len,
        "lam": args.lam,
        "samples": int(Xs.shape[0]),
        "note": "Ridge rollout trained on pooled cells. For PyTorch LSTM see notebooks/02_train_forecast.ipynb.",
    }
    (out.parent / "forecaster_meta.json").write_text(json.dumps(meta, indent=2))
    print(f"[train] wrote → {out} (+ forecaster_meta.json)")


if __name__ == "__main__":
    main()
