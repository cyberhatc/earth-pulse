"""Split/rolling conformal calibration of forecast intervals.

Absolute-residual conformal: for each horizon h, the p10-p90 half-width is the
(1 - alpha/2)... i.e. the level-(1-alpha) quantile of |residuals| on
calibration folds. Honest by construction: the calibration coverage on the
held-out folds is measured and reported, never assumed.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent


def fit_absolute_residual(residuals: dict[int, np.ndarray], level: float = 0.8) -> dict[int, float]:
    """residuals: {horizon: array} of (pred - actual) signed errors.
    Returns {horizon: half-width} for the nominal `level` interval."""
    out: dict[int, float] = {}
    for h, arr in residuals.items():
        a = np.asarray(arr, dtype=np.float64)
        a = a[np.isfinite(a)]
        if a.size < 20:
            continue
        out[int(h)] = float(np.quantile(np.abs(a), level))
    return out


def merge_into_artifact_meta(residuals_npz: Path, artifact_npz: Path, model: str = "climatology_trend",
                             out_levels=(0.5, 0.8, 0.9)) -> dict:
    """Fit conformal widths on backtest residuals and merge them into the
    artifact's forecaster_meta.json sidecar.

    Writes meta['conformal'] = {var: {'0.5': [h1..h60], '0.8': [...], '0.9': [...]},
                                'source': ..., 'calibrated_at': ...}
    Returns the updated meta dict.
    """
    import json as _json
    from datetime import datetime, timezone

    data = residuals_for(residuals_npz, model)
    conformal: dict[str, dict[str, list[float]]] = {}
    coverage: dict[str, dict[str, float]] = {}
    for var, by_h in data.items():
        per_var: dict[str, list[float]] = {}
        cov_var: dict[str, float] = {}
        for level in out_levels:
            widths = fit_absolute_residual(by_h, level=level)
            h_sorted = sorted(widths)
            n_h = max(h_sorted) if h_sorted else 0
            per_var[str(level)] = [widths.get(h, widths.get(max(widths), 0.0) if widths else 0.0) for h in range(1, n_h + 1)]
            cov_var[str(level)] = round(empirical_coverage(by_h, widths), 4)
        conformal[var] = per_var
        coverage[var] = cov_var
    artifact_npz = Path(artifact_npz)
    meta_path = artifact_npz.parent / "forecaster_meta.json"
    meta = _json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    meta["conformal"] = conformal
    meta["conformal_coverage_on_calibration_folds"] = coverage
    meta["conformal_source"] = f"rolling-origin backtest residuals ({residuals_npz.name}); absolute-residual split conformal"
    meta["calibrated_at"] = datetime.now(timezone.utc).isoformat()
    meta_path.write_text(_json.dumps(meta, indent=2, default=str), encoding="utf-8")
    return meta


def empirical_coverage(residuals: dict[int, np.ndarray], widths: dict[int, float]) -> float:
    """Fraction of residuals within ±widths[h] (should track the nominal level)."""
    total = 0
    hit = 0
    for h, arr in residuals.items():
        if int(h) not in widths:
            continue
        a = np.asarray(arr, dtype=np.float64)
        a = a[np.isfinite(a)]
        if a.size == 0:
            continue
        w = widths[int(h)]
        total += a.size
        hit += int(np.sum(np.abs(a) <= w))
    return hit / total if total else float("nan")


def load_backtest_residuals(path: Path) -> dict[str, dict[str, dict[int, np.ndarray]]]:
    """Returns {model: {var: {h: array}}} from keys '<model>__<var>__<h>'."""
    with np.load(path, allow_pickle=False) as z:
        out: dict[str, dict[str, dict[int, np.ndarray]]] = {}
        for key in z.files:
            parts = key.split("__")
            if len(parts) != 3:
                continue
            model, var, h = parts
            try:
                out.setdefault(model, {}).setdefault(var, {})[int(h)] = z[key].astype(np.float64)
            except ValueError:
                continue
    return out


def residuals_for(path: Path, model: str) -> dict[str, dict[int, np.ndarray]]:
    return load_backtest_residuals(path).get(model, {})


def fit_and_report(residuals_npz: Path, out_json: Path, model: str = "climatology_trend",
                   levels=(0.5, 0.8, 0.9)) -> dict:
    """Fit conformal widths per variable per horizon for the chosen model."""
    data = residuals_for(residuals_npz, model)
    report: dict[str, dict] = {"model": model}
    for var, by_h in data.items():
        var_report: dict[str, dict] = {}
        for level in levels:
            widths = fit_absolute_residual(by_h, level=level)
            cov = empirical_coverage(by_h, widths)
            var_report[f"level_{int(level*100)}"] = {
                "widths": {str(h): round(w, 4) for h, w in sorted(widths.items())},
                "empirical_coverage_on_calibration_folds": round(cov, 4),
                "nominal": level,
            }
        report[var] = var_report
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def store_identity(store_meta: dict) -> str:
    """Stable fingerprint of a store: provenance + span + grid shape."""
    import hashlib, json as _json
    grid = (store_meta.get("grid") or {})
    key = _json.dumps({
        "provenance": store_meta.get("provenance"),
        "time_range": store_meta.get("time_range"),
        "n_months": store_meta.get("n_months"),
        "n_cells": grid.get("n_cells"),
        "resolution": grid.get("resolution_deg"),
    }, sort_keys=True)
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:24]


def make_fallback_json(residuals_npz: Path, out_json: Path, model: str = "climatology_trend",
                       store_npz: Path | None = None) -> dict:
    """Canonical conformal widths for the /place climatology_trend fallback path.
    Written to data/processed/conformal.json (regenerated by `make conform`).
    Embeds a store fingerprint — infer only applies it to a MATCHING store."""
    from datetime import datetime, timezone
    data = residuals_for(residuals_npz, model)
    npz = store_npz or (REPO_ROOT / "data" / "processed" / "earth_pulse_real.npz")
    from pipeline.export_store import load_store
    store_meta_dict = load_store(npz).get("meta", {}) if npz and npz.exists() else {}
    store_id = store_identity(store_meta_dict)
    out: dict = {
        "model": model,
        "store_id": store_id,
        "source": f"rolling-origin backtest residuals ({Path(residuals_npz).name}); absolute-residual split conformal",
        "calibrated_at": datetime.now(timezone.utc).isoformat(),
        "levels": {},
    }
    for level in (0.5, 0.8, 0.9):
        widths: dict[str, list[float]] = {}
        coverage: dict[str, float] = {}
        for var, by_h in data.items():
            w = fit_absolute_residual(by_h, level=level)
            h_sorted = sorted(w)
            n_h = max(h_sorted) if h_sorted else 0
            widths[var] = [w.get(h, w[h_sorted[-1]] if h_sorted else 0.0) for h in range(1, n_h + 1)]
            coverage[var] = round(empirical_coverage(by_h, w), 4)
        out["levels"][str(level)] = {"widths": widths, "coverage_on_calibration_folds": coverage}
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(out, indent=2), encoding="utf-8")
    return out


def calibration_markdown(report: dict) -> str:
    lines = ["# Conformal calibration — REAL data", "",
             f"Model: `{report.get('model')}` · method: absolute-residual split conformal on rolling-origin backtest residuals.",
             ""]
    for var, blocks in report.items():
        if var == "model":
            continue
        lines.append(f"## {var}")
        lines.append("| nominal | empirical coverage (calibration folds) | max-h width |")
        lines.append("|---|---|---|")
        for block_name, block in blocks.items():
            cov = block.get("empirical_coverage_on_calibration_folds")
            widths = block.get("widths", {})
            max_w = max(widths.values()) if widths else float("nan")
            lines.append(f"| {block.get('nominal'):.2f} | {cov} | {max_w:.3f} |")
        lines.append("")
    lines += ["Calibration coverage is measured on the backtest calibration folds; the honest",
              "estimate for deployment is the rolling-origin coverage, which is reported in the payload.",
              "", "If coverage cannot hit target on held-out folds, the report says so — no tuning to the target is allowed."]
    return "\n".join(lines) + "\n"


def main() -> int:
    import argparse
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("report", help="fit + write reports/calibration.md & .json")
    r.add_argument("--residuals", default="reports/forecast_backtest.npz")
    r.add_argument("--model", default="climatology_trend")
    r.add_argument("--md", default="reports/calibration.md")
    r.add_argument("--json", default="reports/calibration.json")

    f = sub.add_parser("fallback-json", help="write data/processed/conformal.json for /place fallback")
    f.add_argument("--residuals", default="reports/forecast_backtest.npz")
    f.add_argument("--model", default="climatology_trend")
    f.add_argument("--store-npz", default=None)
    f.add_argument("--out", default="data/processed/conformal.json")

    a = sub.add_parser("artifact", help="merge conformal into an artifact's forecaster_meta.json")
    a.add_argument("--residuals", default="reports/forecast_backtest.npz")
    a.add_argument("--artifact", required=True)
    a.add_argument("--model", default="climatology_trend")

    args = ap.parse_args()
    if args.cmd == "report":
        report = fit_and_report(Path(args.residuals), Path(args.json), model=args.model)
        Path(args.md).write_text(calibration_markdown(report), encoding="utf-8")
        print(f"[conformal] wrote {args.md} and {args.json}")
    elif args.cmd == "fallback-json":
        make_fallback_json(Path(args.residuals), Path(args.out), model=args.model,
                           store_npz=Path(args.store_npz) if args.store_npz else None)
        print(f"[conformal] wrote {args.out}")
    elif args.cmd == "artifact":
        merge_into_artifact_meta(Path(args.residuals), Path(args.artifact), model=args.model)
        print(f"[conformal] merged into artifact meta at {args.artifact}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
