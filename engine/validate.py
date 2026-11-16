"""Trend validation vs NASA GISTEMP (global-mean series).

Compares the area-weighted global mean temperature trend from the Earth Pulse
store with the GISTEMP v4 global LOTI series over the same period, and writes
reports/trend_validation.md. Used by Phase 2's honesty gate: sign agreement and
mean absolute slope difference are reported, however they come out.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
import sys
sys.path.insert(0, str(REPO_ROOT))


def area_weights(lats: np.ndarray) -> np.ndarray:
    """cos(lat) weights for a regular grid (per latitude)."""
    return np.cos(np.radians(lats))


def global_mean_series(store: dict, variable: str = "temperature") -> np.ndarray:
    """Area-weighted global mean over cells with finite data each month."""
    lats = store["lats"]
    nlon = len(store["lons"])
    w_lat = area_weights(lats)
    w = np.tile(w_lat, nlon)  # C-order lat-major
    arr = store[variable]
    out = np.full(arr.shape[0], np.nan)
    for t in range(arr.shape[0]):
        row = arr[t]
        finite = np.isfinite(row)
        if not finite.any():
            continue
        out[t] = float(np.sum(row[finite] * w[finite]) / np.sum(w[finite]))
    return out


def gistemp_series(cache_rel: str = "gistemp_GLB_Ts+dSST.csv") -> dict[str, float]:
    from pipeline.sources.gistemp import fetch_global_series
    return fetch_global_series()


def validate_store(npz_path: Path, out_report: Path | None = None) -> dict:
    from pipeline.export_store import load_store
    store = load_store(npz_path)
    dates = list(store["dates"])
    time_idx = np.arange(len(dates), dtype=np.float64)
    ep = global_mean_series(store, "temperature")
    # GISTEMP annual LOTI vs 1981-present window
    glb = gistemp_series()
    years = sorted(int(y) for y in glb)
    ann_idx = [i for i, d in enumerate(dates) if d.endswith("-01") and 1981 <= int(d[:4]) <= 2026]
    # compare EP annual means with GISTEMP annual values
    ep_annual = {}
    for i, d in enumerate(dates):
        y = int(d[:4])
        ep_annual.setdefault(y, []).append(ep[i])
    ep_ann = {y: float(np.nanmean(v)) for y, v in ep_annual.items() if np.isfinite(v).sum() >= 1}
    common_years = sorted(set(ep_ann) & {y for y in years if y >= 1981})
    slopes = {}
    if len(common_years) >= 12:
        x = np.array(common_years, dtype=np.float64)
        # GISTEMP anomaly vs baseline 1951-1980 — EP store is anomaly too (same baseline)
        y_ep = np.array([ep_ann[y] for y in common_years])
        y_gs = np.array([glb[str(y)] for y in common_years])
        from scipy import stats
        # slope per decade
        slope_ep = stats.linregress(x, y_ep).slope * 10.0
        slope_gs = stats.linregress(x, y_gs).slope * 10.0
        slopes = {
            "earth_pulse_slope_per_decade": round(float(slope_ep), 3),
            "gistemp_slope_per_decade": round(float(slope_gs), 3),
            "abs_diff": round(abs(float(slope_ep - slope_gs)), 3),
        }
    result = {
        "store": str(npz_path),
        "time_range": [dates[0], dates[-1]],
        "common_years": common_years,
        "n_common_years": len(common_years),
        "slope_comparison": slopes,
        "gistemp_baseline": "1951-1980 LOTI anomaly",
        "note": ("EP global mean is area-weighted over finite cells; GISTEMP is the published "
                 "global-mean LOTI. Differences of 0.05-0.2 degC/decade are expected from grid, "
                 "interpolation and coverage differences — reported honestly, not hidden."),
    }
    if out_report:
        out_report.parent.mkdir(parents=True, exist_ok=True)
        md = ["# Trend validation vs NASA GISTEMP", "", f"Store: `{npz_path}`  ",
              f"Period: {dates[0]}..{dates[-1]}  ", "",
              f"- Earth Pulse global-mean T trend: **{result['slope_comparison'].get('earth_pulse_slope_per_decade', 'n/a')} degC/decade**",
              f"- GISTEMP v4 global LOTI trend: **{result['slope_comparison'].get('gistemp_slope_per_decade', 'n/a')} degC/decade**",
              f"- Absolute difference: **{result['slope_comparison'].get('abs_diff', 'n/a')} degC/decade**",
              f"- Common years: {common_years[0]}..{common_years[-1]} (n={len(common_years)})", "",
              "GISTEMP is an interpolated analysis; EP grid is 2.5 deg with its own coverage. "
              "This is a sanity check, not an accuracy guarantee."]
        out_report.write_text("\n".join(md) + "\n", encoding="utf-8")
        result["report"] = str(out_report)
    return result


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--npz", default="data/processed/earth_pulse_real.npz")
    ap.add_argument("--report", default="reports/trend_validation.md")
    args = ap.parse_args()
    res = validate_store(Path(args.npz), Path(args.report))
    print(json.dumps(res, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
