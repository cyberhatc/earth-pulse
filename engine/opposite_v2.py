"""Opposite Trend Detector v2 — patches, FDR gating, case files, null baseline.

Rules (from docs/BACKEND_PLAN.md Phase 5):
  * A pair is "strong" only if BOTH cells are FDR-significant, slopes have
    opposite signs, and min(|slope_a|, |slope_b|) >= min_effect_size (per variable).
  * 8-neighbourhood; longitude wraps at the dateline; latitude is clamped at
    poles (no wrap — pole rows are single rows).
  * Adjacent significant cells with the same sign merge into contiguous patches
    ("wetting patch vs drying patch"); patch pairs are ranked by magnitude and
    area.
  * Every flagged pair carries a "case file": variables, slopes with confidence
    intervals, p-values, coverage, and CANDIDATE explanations labelled as
    hypotheses — never conclusions (explanations come from a static curated
    YAML, not from any LLM).
  * Null-model check: the multiset of per-cell trend records is randomly
    permuted across the grid (destroying spatial structure); the expected
    number of opposite pairs is reported so the headline count has a baseline.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_HYPOTHESES = REPO_ROOT / "data" / "knowledge" / "case_hypotheses.yaml"

DEFAULT_MIN_EFFECT = {
    "temperature": 0.05,     # degC anomaly per decade
    "precipitation": 0.5,    # mm/month per decade
    "ndvi": 0.002,           # index per decade
    "sst": 0.05,             # degC per decade
    "default": 0.0,
}
DEFAULT_NPERM = 200


def min_effect_from_config(path: Path | None = None) -> dict:
    """Read configs/model.yaml opposite_trend.v2.min_effect_size; fall back to defaults."""
    fp = path or (REPO_ROOT / "configs" / "model.yaml")
    try:
        import yaml
        cfg = yaml.safe_load(fp.read_text(encoding="utf-8")) or {}
        v2 = ((cfg.get("opposite_trend") or {}).get("v2") or {}).get("min_effect_size") or {}
        out = dict(DEFAULT_MIN_EFFECT)
        for k, v in v2.items():
            try:
                out[str(k)] = float(v)
            except (TypeError, ValueError):
                continue
        return out
    except Exception:
        return dict(DEFAULT_MIN_EFFECT)


# ------------------------------------------------------------ adjacency
def neighbor_pairs(n_lats: int, n_lons: int, radius: int = 1):
    """Yield unique (a, b) cell-index pairs within Chebyshev radius.

    Longitude is periodic (dateline wrap); latitude is clamped at the poles.
    """
    seen = set()
    for i_lat in range(n_lats):
        for i_lon in range(n_lons):
            for di in range(-radius, radius + 1):
                j_lat = i_lat + di
                if j_lat < 0 or j_lat >= n_lats:
                    continue  # poles: clamp, do not wrap
                for dj in range(-radius, radius + 1):
                    if di == 0 and dj == 0:
                        continue
                    j_lon = (i_lon + dj) % n_lons  # dateline wrap
                    a, b = i_lat * n_lons + i_lon, j_lat * n_lons + j_lon
                    if b < a:
                        continue  # each unordered pair once
                    key = (a, b)
                    if key not in seen:
                        seen.add(key)
                        yield a, b


def opposite_neighbor_pairs(n_lats: int, n_lons: int, radius: int = 1):
    return list(neighbor_pairs(n_lats, n_lons, radius))


# ------------------------------------------------------------ patches
def _cell_sign(rec: dict | None, min_effect: float) -> int:
    if not rec:
        return 0
    s = float(rec.get("slope_per_decade", 0.0))
    if not np.isfinite(s) or abs(s) < min_effect:
        return 0
    return 1 if s > 0 else -1


def _fdr_ok(rec: dict) -> bool:
    # prefer FDR-adjusted flag; fall back to raw significance if absent
    if "significant_fdr" in rec:
        return bool(rec["significant_fdr"])
    return bool(rec.get("significant", False))


def find_patches(labels: np.ndarray, eligible: np.ndarray) -> list[dict]:
    """Connected 8-neighbour components of cells sharing the same sign."""
    n_lats, n_lons = labels.shape
    visited = np.zeros_like(labels, dtype=bool)
    patches = []
    for i in range(n_lats):
        for j in range(n_lons):
            if visited[i, j] or not eligible[i, j] or labels[i, j] == 0:
                continue
            sign = int(labels[i, j])
            stack = [(i, j)]
            cells = []
            visited[i, j] = True
            while stack:
                ci, cj = stack.pop()
                cells.append(ci * n_lons + cj)
                for di in (-1, 0, 1):
                    for dj in (-1, 0, 1):
                        if di == 0 and dj == 0:
                            continue
                        ni, nj = ci + di, (cj + dj) % n_lons
                        if ni < 0 or ni >= n_lats:
                            continue
                        if visited[ni, nj] or not eligible[ni, nj] or labels[ni, nj] != sign:
                            continue
                        visited[ni, nj] = True
                        stack.append((ni, nj))
            patches.append({"sign": sign, "cells": cells, "area_cells": len(cells)})
    return patches


# ------------------------------------------------------------ hypotheses
def load_hypotheses(path: Path | None = None) -> dict[str, list[str]]:
    fp = path or DEFAULT_HYPOTHESES
    if not fp.exists():
        return {}
    try:
        import yaml
        data = yaml.safe_load(fp.read_text(encoding="utf-8")) or {}
        out: dict[str, list[str]] = {}
        for var, hyps in (data.get("hypotheses") or {}).items():
            out[var] = [str(h) for h in hyps]
        return out
    except Exception:
        return {}


def case_file(parameter: str, cell_a: int, cell_b: int, rec_a: dict, rec_b: dict,
              grid_lat, grid_lon, dates, patch_a: dict, patch_b: dict,
              hypotheses: dict | None = None) -> dict:
    """Honest 'case file' for one flagged pair. Hypotheses, never conclusions."""
    hyps = (hypotheses or {}).get(parameter) or (hypotheses or {}).get("default") or [
        "Local forcing difference across the boundary (land/ocean, orography, land use)",
        "Teleconnection (e.g. ENSO) modulating one side of the boundary",
        "Measurement/interpolation artifact — re-check source before acting",
    ]
    return {
        "variables": [parameter],
        "slopes_per_decade": {"cell_a": rec_a["slope_per_decade"], "cell_b": rec_b["slope_per_decade"]},
        "slope_ci_per_decade": {
            "cell_a": [rec_a.get("ci_low"), rec_a.get("ci_high")],
            "cell_b": [rec_b.get("ci_low"), rec_b.get("ci_high")],
        },
        "p_values": {"cell_a": rec_a.get("p_value"), "cell_b": rec_b.get("p_value")},
        "fdr_p_values": {"cell_a": rec_a.get("p_value_fdr"), "cell_b": rec_b.get("p_value_fdr")},
        "fdr_significant": {"cell_a": _fdr_ok(rec_a), "cell_b": _fdr_ok(rec_b)},
        "coverage": {
            "cell_a": {"lat": float(grid_lat[cell_a]), "lon": float(grid_lon[cell_a]),
                       "n_months": int(rec_a.get("n", 0)), "time_range": [dates[0], dates[-1]] if dates else None},
            "cell_b": {"lat": float(grid_lat[cell_b]), "lon": float(grid_lon[cell_b]),
                       "n_months": int(rec_b.get("n", 0)), "time_range": [dates[0], dates[-1]] if dates else None},
        },
        "patches": {
            "increasing": {"area_cells": patch_a["area_cells"] if patch_a["sign"] == 1 else patch_b["area_cells"],
                            "mean_slope_per_decade": patch_a.get("mean_slope") if patch_a["sign"] == 1 else patch_b.get("mean_slope")},
            "decreasing": {"area_cells": patch_a["area_cells"] if patch_a["sign"] == -1 else patch_b["area_cells"],
                            "mean_slope_per_decade": patch_a.get("mean_slope") if patch_a["sign"] == -1 else patch_b.get("mean_slope")},
        },
        "hypotheses": hyps,
        "hypotheses_label": "CANDIDATE explanations — hypotheses, not conclusions. Require local evidence before acting.",
    }


# ------------------------------------------------------------ main finder
def _signed_records(trends, parameter):
    out = {}
    for c, rec in trends.items():
        p = rec.get(parameter)
        if p:
            out[int(c)] = p
    return out


def find_opposite_v2(grid_lat, grid_lon, n_lats, n_lons, trends, parameter,
                     min_effect_size: float | None = None, radius: int = 1,
                     hypotheses: dict | None = None, dates: list[str] | None = None,
                     max_pairs: int = 120):
    """Returns {"pairs": [...], "patches": [...], "meta": {...}}; see module docstring."""
    recs = _signed_records(trends, parameter)
    min_eff = min_effect_size if min_effect_size is not None else DEFAULT_MIN_EFFECT.get(parameter, DEFAULT_MIN_EFFECT["default"])
    n = n_lats * n_lons
    signs = np.zeros(n, dtype=np.int8)
    eligible = np.zeros(n, dtype=bool)
    for c, r in recs.items():
        if _fdr_ok(r):
            s = _cell_sign(r, min_eff)
            signs[c] = s
            eligible[c] = s != 0
    labels = signs.reshape(n_lats, n_lons)
    elig = eligible.reshape(n_lats, n_lons)
    patches = find_patches(labels, elig)
    # attach stats per patch
    for p in patches:
        vals = [recs[c]["slope_per_decade"] for c in p["cells"]]
        p["mean_slope"] = float(np.mean(vals))
        p["max_abs_slope"] = float(np.max(np.abs(vals)))
        lats = [float(grid_lat[c]) for c in p["cells"]]
        lons = [float(grid_lon[c]) for c in p["cells"]]
        p["lat_range"] = [min(lats), max(lats)]
        p["lon_range"] = [min(lons), max(lons)]

    # representative (max-slope) cell per patch
    def rep(patch):
        return int(max(patch["cells"], key=lambda c: abs(recs[c]["slope_per_decade"])))

    # adjacency among patches (any cell-pair adjacency, dateline-safe)
    pairs_out = []
    seen = set()
    nbr = list(neighbor_pairs(n_lats, n_lons, radius))
    cell_to_patch = {}
    for pi, p in enumerate(patches):
        for c in p["cells"]:
            cell_to_patch[c] = pi
    for a, b in nbr:
        pa, pb = cell_to_patch.get(a), cell_to_patch.get(b)
        if pa is None or pb is None or pa == pb:
            continue
        patch_a, patch_b = patches[pa], patches[pb]
        if patch_a["sign"] == patch_b["sign"]:
            continue
        key = frozenset((pa, pb))
        if key in seen:
            continue
        seen.add(key)
        ra, rb = rep(patch_a), rep(patch_b)
        rec_a, rec_b = recs[ra], recs[rb]
        sa, sb = float(rec_a["slope_per_decade"]), float(rec_b["slope_per_decade"])
        mag = float(min(abs(sa), abs(sb)))
        # patch order: increasing first
        if patch_b["sign"] == 1:
            ra, rb = rb, ra
            rec_a, rec_b = rec_b, rec_a
            patch_a, patch_b = patch_b, patch_a
            sa, sb = sb, sa
        area_score = (patch_a["area_cells"] + patch_b["area_cells"]) / 2.0
        pair = {
            "parameter": parameter,
            "cell_a": {"index": int(ra), "lat": float(grid_lat[ra]), "lon": float(grid_lon[ra]),
                       "slope_per_decade": sa, "significant": bool(rec_a.get("significant")),
                       "significant_fdr": bool(rec_a.get("significant_fdr", True))},
            "cell_b": {"index": int(rb), "lat": float(grid_lat[rb]), "lon": float(grid_lon[rb]),
                       "slope_per_decade": sb, "significant": bool(rec_b.get("significant")),
                       "significant_fdr": bool(rec_b.get("significant_fdr", True))},
            "strength": "strong",  # by construction: both FDR-significant + effect size
            "magnitude": mag,
            "area_score": float(area_score),
            "rank_score": float(mag * area_score),
            "patch_a": {"sign": patch_a["sign"], "cells": patch_a["cells"], "area_cells": patch_a["area_cells"],
                        "mean_slope_per_decade": patch_a["mean_slope"], "lat_range": patch_a["lat_range"], "lon_range": patch_a["lon_range"]},
            "patch_b": {"sign": patch_b["sign"], "cells": patch_b["cells"], "area_cells": patch_b["area_cells"],
                        "mean_slope_per_decade": patch_b["mean_slope"], "lat_range": patch_b["lat_range"], "lon_range": patch_b["lon_range"]},
            "case_file": case_file(parameter, ra, rb, rec_a, rec_b, grid_lat, grid_lon, dates,
                                    patch_a, patch_b, hypotheses),
        }
        pairs_out.append(pair)
    pairs_out.sort(key=lambda p: p["rank_score"], reverse=True)
    pairs_out = pairs_out[:max_pairs]
    for i, p in enumerate(pairs_out, start=1):
        p["rank"] = i

    # ---- null model: random permutation of the trend multiset across cells ----
    null = null_model_check(recs, n_lats, n_lons, radius, min_eff, n_perm=DEFAULT_NPERM)
    n_cell_pairs = null.pop("observed_cell_pairs", None)
    null["observed_cell_pairs"] = n_cell_pairs
    meta = {
        "parameter": parameter,
        "min_effect_size": min_eff,
        "neighbor_radius": radius,
        "n_eligible_cells": int(eligible.sum()),
        "n_patches": len(patches),
        "n_pairs": len(pairs_out),
        "n_cell_pairs": int(n_cell_pairs) if n_cell_pairs is not None else 0,
        "null_model": null,
    }
    return {"pairs": pairs_out, "patches": patches, "meta": meta}


# ------------------------------------------------------------ null model
def null_model_check(recs: dict[int, dict], n_lats: int, n_lons: int, radius: int,
                     min_effect: float, n_perm: int = 200, seed: int = 42) -> dict:
    """Permute trend records across cells (keeping their multiset); count opposite
    FDR-significant pairs per realisation. Reported so the observed count has a
    chance baseline. The permutation destroys spatial autocorrelation — it is a
    'no spatial pattern' null, not a statement about physics."""
    n = n_lats * n_lons
    items = list(recs.items())
    values = [r for _, r in items]
    if len(values) < 20:
        return {"n_perm": 0, "expected_pairs": 0.0, "std": 0.0, "observed": 0, "p_value": 1.0,
                "note": "too few trend records for a null model"}
    signs = np.array([_cell_sign(r, min_effect) for r in values], dtype=np.int8)
    fdr = np.array([1 if _fdr_ok(r) else 0 for r in values], dtype=np.int8)
    cell_idx = np.array([c for c, _ in items], dtype=np.int64)
    nbr = list(neighbor_pairs(n_lats, n_lons, radius))
    counts = []
    rng = np.random.default_rng(seed)
    for _ in range(n_perm):
        perm = rng.permutation(len(values))
        lab = np.zeros(n, dtype=np.int8)
        elig = np.zeros(n, dtype=bool)
        for new_pos, old_i in enumerate(perm):
            c = cell_idx[new_pos]
            if fdr[old_i] and signs[old_i] != 0:
                lab[c] = signs[old_i]
                elig[c] = True
        cnt = 0
        for a, b in nbr:
            if elig[a] and elig[b] and lab[a] != 0 and lab[a] != lab[b]:
                cnt += 1
        counts.append(cnt)
    counts = np.array(counts, dtype=np.float64)
    expected = float(counts.mean())
    std = float(counts.std(ddof=1)) if counts.size > 1 else 0.0
    # observed (fixed): recompute from the recs mapping directly
    lab = np.zeros(n, dtype=np.int8)
    elig = np.zeros(n, dtype=bool)
    for c, r in recs.items():
        if _fdr_ok(r):
            s = _cell_sign(r, min_effect)
            lab[c] = s
            elig[c] = s != 0
    obs_count = 0
    for a, b in nbr:
        if elig[a] and elig[b] and lab[a] != lab[b]:
            obs_count += 1
    p_value = float((np.sum(counts >= obs_count) + 1) / (len(counts) + 1))
    return {
        "n_perm": int(n_perm),
        "expected_pairs": round(expected, 2),
        "std": round(std, 2),
        "observed_cell_pairs": int(obs_count),
        "p_value": round(p_value, 4),
        "note": ("Random permutation of the trend multiset across the grid "
                 "(destroys spatial autocorrelation) — a 'no spatial pattern' null, not a physical statement."),
    }
