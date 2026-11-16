"""Generate reports/opposite_trends.md from an engine analysis JSON.

Usage: python scripts/report_opposite_trends.py [--analysis data/processed/analysis_real.json] [--out reports/opposite_trends.md]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--analysis", default="data/processed/analysis_real.json")
    ap.add_argument("--out", default="reports/opposite_trends.md")
    ap.add_argument("--top", type=int, default=10)
    args = ap.parse_args()

    a = json.loads(Path(args.analysis).read_text(encoding="utf-8"))
    opposites = a.get("opposite_trends", {})
    meta = a.get("opposite_meta", {})
    synthetic = a.get("synthetic_demo", True)
    time_range = a.get("time_range", ["?", "?"])

    md = [
        "# Opposite Trend Detector v2 — report",
        "",
        f"Store: `{args.analysis}` (synthetic_demo={synthetic}) · months {time_range[0]}..{time_range[1]}",
        "",
        "A pair is kept only when **both** cells are Benjamini–Hochberg FDR-significant, slopes",
        "have opposite signs, and min(|slope|) exceeds the per-variable minimum effect size.",
        "Cells belonging to the same-sign contiguous patch are merged (8-neighbourhood, longitude",
        "wraps at the dateline); patch pairs are ranked by magnitude × area.",
        "",
        "**Null baseline**: the trend multiset is randomly permuted across the grid (destroys",
        "spatial autocorrelation — a 'no spatial pattern' null). Counts are *cell-pairs*, not patch pairs.",
        "",
    ]
    for param in ("ndvi", "precipitation"):
        pairs = opposites.get(param, [])
        m = meta.get(param, {})
        null = m.get("null_model", {})
        md += [
            f"## {param}",
            "",
            f"- strong patch pairs reported: **{m.get('n_pairs', len(pairs))}** (top {min(args.top, len(pairs))} shown)",
            f"- eligible (FDR-significant, above effect size) cells: {m.get('n_eligible_cells')}",
            f"- cell-pairs: **observed {null.get('observed_cell_pairs')} vs random-permutation expected {null.get('expected_pairs')} ± {null.get('std')}** (p={null.get('p_value')})",
            "- verdict: " + ("spatial clustering beyond chance" if null.get("observed_cell_pairs", 0) > null.get("expected_pairs", 0) + 2 * null.get("std", 0)
                              else "no evidence of spatial clustering beyond chance" if null.get("observed_cell_pairs", 0) <= null.get("expected_pairs", 0) + 2 * null.get("std", 0)
                              else "undetermined"),
            "",
        ]
        if not pairs:
            md += ["_No strong pairs found under the current FDR gate + effect size._", ""]
            continue
        for p in pairs[: args.top]:
            ca, cb = p["cell_a"], p["cell_b"]
            pa, pb = p["patch_a"], p["patch_b"]
            cf = p["case_file"]
            hs = cf.get("hypotheses")
            md += [
                f"### #{p.get('rank')} — ({ca['lat']:.1f}, {ca['lon']:.1f}) ↑ vs ({cb['lat']:.1f}, {cb['lon']:.1f}) ↓",
                "",
                f"- slopes: {ca['slope_per_decade']:+.3f} vs {cb['slope_per_decade']:+.3f} {cf['variables'][0]}/decade",
                f"- p (FDR): {cf['fdr_p_values']['cell_a']:.4f} vs {cf['fdr_p_values']['cell_b']:.4f} · both FDR-significant: {cf['fdr_significant']}",
                f"- patches: {pa['area_cells']} cells (mean {pa['mean_slope_per_decade']:+.3f}) vs {pb['area_cells']} cells (mean {pb['mean_slope_per_decade']:+.3f})",
                f"- rank score (magnitude × area): {p['rank_score']:.2f}",
                f"- candidate explanations (HYPOTHESES, not conclusions): {', '.join(hs[:4])}" if hs else "- candidate explanations: (none curated)",
                "",
            ]
    if synthetic:
        md += ["*Note: this run used the synthetic demo store. Regenerate with the real store:*",
               "```", "python pipeline/build_store.py --fast && make real-analysis",
               "python scripts/report_opposite_trends.py --analysis data/processed/analysis_real.json", "```", ""]
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"[report] wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
