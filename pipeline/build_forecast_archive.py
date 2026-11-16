"""Build a per-parameter forecast archive from the real NASA POWER store.

Two phases, run in order:

  A. VERIFICATION (``--verify-only`` or always) — the accuracy harness.
     Trains on the FIRST ``--train-years`` (default 35) of the record, rolls out
     on the remaining holdout (e.g. 2016-01 .. present), and reports per
     parameter: MAE, RMSE, bias, PICP (p10–p90 coverage) before and after band
     calibration, for a 12-month rollout horizon. The band multiplier is
     chosen so coverage reaches ``--target-picp`` (default 0.95) on the holdout.

  B. ARCHIVE — refits on ALL months, rolls out ``--horizons`` months
     (default 60 and 120), and writes one NPZ per parameter per horizon into
     ``--out-dir``. One file per parameter, all 240 grid cells, mean + p10 +
     p90 + future dates + grid coordinates.

Everything is deterministic (closed-form ridge regression, no random seed) and
runs fully OFFLINE once the store exists. Outputs are model projections, never
observations. All-NaN parameters in the store (NDVI/SST/sea_level for POWER)
are reported as unavailable and skipped, never extrapolated.

Usage:
  python3 pipeline/build_forecast_archive.py                 # verify + archive
  python3 pipeline/build_forecast_archive.py --verify-only   # report only, no files
  python3 pipeline/build_forecast_archive.py --train-years 35 --target-picp 0.95
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
from models.forecast import RidgeRollout, future_dates  # noqa: E402

RESERVED_KEYS = {
    "dates", "lats", "lons", "grid_lat", "grid_lon", "meta", "meta_json", "ocean_mask",
}
DEFAULT_STORE = REPO_ROOT / "data" / "processed" / "earth_pulse_power_full.npz"
DEFAULT_OUT = REPO_ROOT / "data" / "forecasts_full"
SEQ_LEN = 24
LAM = 1e-2  # default ridge penalty; --lam overrides


def usable_params(store: dict, dates: list[str], G: int, min_coverage: float = 0.90) -> list[str]:
    """Every 2-D parameter array with enough finite values — no hard-coded list."""
    out = []
    for key, value in store.items():
        if key in RESERVED_KEYS or not isinstance(value, np.ndarray):
            continue
        if value.ndim != 2 or value.shape[0] != len(dates) or value.shape[1] != G:
            continue
        if float(np.isfinite(value).mean()) >= min_coverage:
            out.append(key)
    return sorted(out)


def rollout_geo(model, X: np.ndarray, geo: np.ndarray | None, horizon: int) -> np.ndarray:
    """Autoregressive rollout that appends static cell features each step."""
    window = X.copy()
    out = []
    for _ in range(horizon):
        flat = window.reshape(-1)
        if geo is not None:
            flat = np.concatenate([flat, geo])
        nxt = model.predict_next(flat)
        out.append(nxt)
        window = np.vstack([window[1:], nxt.reshape(1, -1)])
    return np.array(out)


def cell_geo(store: dict, cell: int) -> np.ndarray:
    """Static location features — everything extractable about the cell itself."""
    lat = float(store["grid_lat"][cell])
    lon = float(store["grid_lon"][cell])
    return np.array([
        lat / 90.0,
        abs(lat) / 90.0,
        np.sin(np.radians(lon)),
        np.cos(np.radians(lon)),
    ])


def make_windows_geo(X: np.ndarray, geo: np.ndarray | None, seq_len: int):
    """Lag windows, optionally with static cell features [lat, |lat|, sin(lon), cos(lon)]."""
    T, F = X.shape
    xs, ys = [], []
    for t in range(T - seq_len):
        flat = X[t:t + seq_len].reshape(-1)
        xs.append(flat if geo is None else np.concatenate([flat, geo]))
        ys.append(X[t + seq_len])
    return np.array(xs), np.array(ys)


def cell_matrix(store: dict, cell: int, params: list[str]) -> np.ndarray:
    cols = [fill_missing_linear(store[v][:, cell]) for v in params]
    return np.stack(cols, axis=1)


def cut_index(dates: list[str], train_years: int) -> int:
    """First index belonging to the holdout (train = first ``train_years``)."""
    cutoff = int(dates[0][:4]) + train_years
    for i, d in enumerate(dates):
        if int(d[:4]) >= cutoff:
            return i
    return len(dates)


def backtest_cell(
    X: np.ndarray,
    params: list[str],
    cut: int,
    horizon: int = 12,
    seq_len: int = SEQ_LEN,
    step: int = 6,
    geo: np.ndarray | None = None,
    lam: float = LAM,
) -> list[dict]:
    """Expanding-origin evaluation inside the holdout window.

    For each origin month t >= cut (stride ``step`` months), train on
    ``X[:t]`` and roll out ``min(horizon, T - t)`` months. Returns one dict per
    origin with predictions, actuals and raw 1-step residual sigma.
    """
    T = X.shape[0]
    out = []
    for t0 in range(cut, T, step):
        h = min(horizon, T - t0)
        if t0 < seq_len + 24:
            continue
        Xs, ys = make_windows_geo(X[:t0], geo, seq_len)
        if Xs.shape[0] < 100:
            continue
        model = RidgeRollout(lam=lam).fit(Xs, ys)
        pred = rollout_geo(model, X[t0 - seq_len:t0], geo, h)
        actual = X[t0:t0 + h]
        out.append({
            "origin": t0,
            "h": h,
            "pred": pred,
            "actual": actual,
            "resid_std": model.resid_std,
        })
    return out


def calibrate_band(results: list[dict], params: list[str], target: float) -> dict:
    """Smallest per-parameter multiplier b with coverage >= target.

    band = b * 1.645 * resid_std[p] * sqrt(step_index). Computed exactly from
    the empirical holdout residuals, per parameter.
    """
    multipliers = {}
    for pi, p in enumerate(params):
        r = []
        for rec in results:
            h = rec["h"]
            steps = np.sqrt(np.arange(1, h + 1, dtype=np.float64))
            sigma = rec["resid_std"][pi] * steps
            denom = 1.645 * np.where(sigma > 0, sigma, np.nan)
            ratio = np.abs(rec["actual"][:, pi] - rec["pred"][:, pi]) / denom
            r.append(ratio[np.isfinite(ratio)])
        if not r:
            multipliers[p] = 1.0
            continue
        ratios = np.concatenate(r)
        multipliers[p] = float(np.quantile(ratios, target))
    return multipliers


def summarise(
    results: list[dict],
    params: list[str],
    calibration: dict,
) -> dict:
    report = {}
    for pi, p in enumerate(params):
        b = calibration.get(p, 1.0)
        actual, pred, sigma = [], [], []
        cov_raw, cov_cal = [], []
        mae, rmse, bias = [], [], []
        for rec in results:
            h = rec["h"]
            steps = np.sqrt(np.arange(1, h + 1, dtype=np.float64))
            raw_scale = 1.645 * rec["resid_std"][pi] * steps
            lo, hi = rec["pred"][:, pi] - raw_scale, rec["pred"][:, pi] + raw_scale
            lo_c, hi_c = rec["pred"][:, pi] - b * raw_scale, rec["pred"][:, pi] + b * raw_scale
            a = rec["actual"][:, pi]
            cov_raw.append(float(np.mean((a >= lo) & (a <= hi))))
            cov_cal.append(float(np.mean((a >= lo_c) & (a <= hi_c))))
            mae.append(float(np.mean(np.abs(a - rec["pred"][:, pi]))))
            rmse.append(float(np.sqrt(np.mean((a - rec["pred"][:, pi]) ** 2))))
            bias.append(float(np.mean(rec["pred"][:, pi] - a)))
        report[p] = {
            "mae": float(np.mean(mae)),
            "rmse": float(np.mean(rmse)),
            "bias": float(np.mean(bias)),
            "picp_p10_p90_raw": float(np.mean(cov_raw)),
            "band_multiplier": b,
            "picp_p10_p90_calibrated": float(np.mean(cov_cal)),
            "n_forecasts": int(sum(len(r["pred"]) for r in results)),
        }
    return report


def write_npz(path: Path, arrays: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savez(path, **arrays)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--store", default=str(DEFAULT_STORE), help="POWER npz store (real store by default)")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT), help="where to write per-parameter forecast NPZs")
    ap.add_argument("--horizons", default="60,120", help="comma-separated forecast horizons in months")
    ap.add_argument("--train-years", type=int, default=35, help="years of history used for VERIFICATION training")
    ap.add_argument("--target-picp", type=float, default=0.95, help="holdout coverage the bands are calibrated to (p10-p90)")
    ap.add_argument("--backtest-horizon", type=int, default=12, help="rollout horizon per holdout origin")
    ap.add_argument("--origin-step", type=int, default=6, help="months between expanding holdout origins")
    ap.add_argument("--seq-len", type=int, default=SEQ_LEN)
    ap.add_argument("--store-params", default="", help="comma-separated parameter allowlist; default: all usable")
    ap.add_argument("--min-coverage", type=float, default=0.90, help="minimum finite fraction to keep a parameter")
    ap.add_argument("--lam", type=float, default=LAM, help="ridge penalty (larger = stronger shrinkage, helps wide models)")
    ap.add_argument("--no-geo", dest="geo_features", action="store_false", help="do not add lat/|lat|/sin(lon)/cos(lon) cell features")
    ap.set_defaults(geo_features=True)
    ap.add_argument("--verify-only", action="store_true", help="write verification.json but no forecast NPZs")
    args = ap.parse_args()

    t0 = time.time()
    store = load_store(Path(args.store))
    dates = list(store["dates"])
    G = len(store["grid_lat"])
    meta = store.get("meta", {}) or {}
    print(f"[archive] store: {args.store}")
    print(f"[archive] months: {dates[0]} .. {dates[-1]} ({len(dates)}) · cells: {G} · provenance: {meta.get('provenance')}")

    if args.store_params:
        usable = [p for p in args.store_params.split(",") if p in store]
    else:
        usable = usable_params(store, dates, G, args.min_coverage)
    skipped = sorted({"ndvi", "sst", "sea_level"} - set(usable))
    if skipped:
        print(f"[archive] parameters unavailable in store (never fabricated): {', '.join(skipped)}")
    print(f"[archive] parameters used ({len(usable)}): {', '.join(usable)}")

    # ---------------- Phase A: verification on the holdout ----------------
    cut = cut_index(dates, args.train_years)
    train_end = dates[cut - 1]
    print(f"[archive] VERIFY split: train {dates[0]}..{train_end} · holdout {dates[cut]}..{dates[-1]}")
    per_cell = []
    for cell in range(G):
        X = cell_matrix(store, cell, usable)
        geo = cell_geo(store, cell) if args.geo_features else None
        per_cell.append(backtest_cell(X, usable, cut, args.backtest_horizon, args.seq_len, args.origin_step, geo, args.lam))
        if (cell + 1) % 60 == 0:
            print(f"[archive]   backtest cells {cell + 1}/{G}")
    results = [rec for cell_res in per_cell for rec in cell_res]
    calibration = calibrate_band(results, usable, args.target_picp)
    verification = {
        "method": "expanding-origin rolling forecast on the post-train holdout",
        "store": str(Path(args.store)),
        "train_years": args.train_years,
        "train_end": train_end,
        "holdout_start": dates[cut],
        "holdout_end": dates[-1],
        "horizon_months_per_origin": args.backtest_horizon,
        "origin_step_months": args.origin_step,
        "target_picp": args.target_picp,
        "geo_features": args.geo_features,
        "ridge_lam": args.lam,
        "features": "flattened 24-month lag windows" + (
            " + cell features [lat, |lat|, sin(lon), cos(lon)]" if args.geo_features else ""),
        "parameters": summarise(results, usable, calibration),
        "unavailable_parameters": skipped,
        "disclaimer": (
            "Point-forecast accuracy is NOT 95%. The p10-p90 bands are calibrated "
            "to reach {target} coverage on the holdout (PICP), at the cost of wider bands. "
            "Forecasts are model projections, not observations."
        ).format(target=args.target_picp),
        "elapsed_seconds": round(time.time() - t0, 2),
    }
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "verification.json").write_text(json.dumps(verification, indent=2), encoding="utf-8")
    print(f"[archive] verification written -> {out_dir / 'verification.json'}")
    for p, r in verification["parameters"].items():
        print(f"[archive]   {p:16s} MAE={r['mae']:.3f} RMSE={r['rmse']:.3f} "
              f"bias={r['bias']:+.3f} PICP_raw={r['picp_p10_p90_raw']:.2f} "
              f"-> calibrated b={r['band_multiplier']:.2f} PICP={r['picp_p10_p90_calibrated']:.2f}")

    if args.verify_only:
        print("[archive] --verify-only set; skipping forecast NPZs")
        return 0

    # ---------------- Phase B: archive forecasts (refit on ALL data) ----------------
    horizons = [int(h) for h in args.horizons.split(",") if h.strip()]
    future = future_dates(dates[-1], max(horizons))
    files = []
    for horizon in horizons:
        H = horizon
        fc_dates = future[:H]
        for pi, p in enumerate(usable):
            mean = np.full((H, G), np.nan)
            lower = np.full((H, G), np.nan)
            upper = np.full((H, G), np.nan)
            resid = np.full((G,), np.nan)
            b = calibration.get(p, 1.0)
            for cell in range(G):
                X = cell_matrix(store, cell, usable)
                geo = cell_geo(store, cell) if args.geo_features else None
                Xs, ys = make_windows_geo(X, geo, args.seq_len)
                model = RidgeRollout(lam=args.lam).fit(Xs, ys)
                pred = rollout_geo(model, X[-args.seq_len:], geo, H)
                m = pred[:, pi]
                steps = np.sqrt(np.arange(1, H + 1, dtype=np.float64))
                scale = b * 1.645 * model.resid_std[pi] * steps
                mean[:, cell], lower[:, cell], upper[:, cell] = m, m - scale, m + scale
                resid[cell] = model.resid_std[pi]
            suffix = f"{horizon // 12}yr" if horizon % 12 == 0 else f"{horizon}m"
            fname = f"forecast_{p}_{suffix}.npz"
            rec_meta = {
                "parameter": p,
                "horizon_months": H,
                "model": "ridge_rollout",
                "trained_on": f"{dates[0]}..{dates[-1]} (ALL months, refit for archive)",
                "band_multiplier": b,
                "band_source": f"holdout {dates[cut]}..{dates[-1]} calibration to PICP={args.target_picp}",
                "backtest": verification["parameters"].get(p, {}),
                "ridge_lam": args.lam,
                "grid": {"lats": list(map(float, store["grid_lat"])), "lons": list(map(float, store["grid_lon"]))},
                "n_cells": int(G),
                "issued": dates[-1],
                "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "features": "flattened 24-month lag windows" + (
                    " + cell features [lat, |lat|, sin(lon), cos(lon)]" if args.geo_features else ""
                ) + " (see pipeline/build_features.py / make_windows_geo)",
                "disclaimer": (
                    "MODEL PROJECTION, NOT AN OBSERVATION. Bands are p10-p90 at the "
                    f"calibrated {args.target_picp} holdout coverage; climate forecasts "
                    "degrade with horizon and cannot anticipate regime shifts."
                ),
            }
            write_npz(out_dir / fname, {
                "dates": np.array(fc_dates),
                "grid_lat": np.array(store["grid_lat"], dtype=np.float64),
                "grid_lon": np.array(store["grid_lon"], dtype=np.float64),
                "mean": mean,
                "lower": lower,
                "upper": upper,
                "resid_std": resid,
                "meta_json": np.array(json.dumps(rec_meta)),
            })
            files.append(fname)
            print(f"[archive] wrote {out_dir / fname}  (mean over {G} cells x {H} months)")

    manifest = {
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "store": str(Path(args.store)),
        "store_time_range": [dates[0], dates[-1]],
        "store_meta": meta,
        "grid_cells": int(G),
        "parameters": usable,
        "unavailable_parameters": skipped,
        "horizons_months": horizons,
        "verification": "verification.json",
        "files": files,
        "note": "One NPZ per parameter per horizon. Load with numpy.load; arrays are (H, G).",
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, default=str), encoding="utf-8")
    print(f"[archive] manifest written -> {out_dir / 'manifest.json'} · total elapsed {time.time() - t0:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
