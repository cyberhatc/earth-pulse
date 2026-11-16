"""Field significance: Benjamini–Hochberg FDR across grid cells."""
from __future__ import annotations

import numpy as np


def benjamini_hochberg(p_values: np.ndarray, q: float = 0.05) -> tuple[np.ndarray, np.ndarray]:
    """Return (adjusted_p, significant) arrays, same order as input.

    adjusted_p[i] = min over k >= rank(p_i) of p_(k) * m / k  (monotone).
    """
    p = np.asarray(p_values, dtype=np.float64)
    m = p.size
    if m == 0:
        return p.copy(), np.zeros(0, dtype=bool)
    order = np.argsort(p)
    ranked = p[order]
    adj = ranked * m / (np.arange(m) + 1)
    adj = np.minimum.accumulate(adj[::-1])[::-1]  # enforce monotonicity
    adj = np.clip(adj, 0.0, 1.0)
    out = np.empty_like(adj)
    out[order] = adj
    return out, out <= q


def fdr_adjust_cell_trends(cells: dict[str, dict], q: float = 0.05) -> dict:
    """Mutates + returns per-cell trend records with FDR fields.

    Expects each cell record to carry a 'p_value'. Adds:
      p_value_fdr, significant_fdr, fdr_significant_fraction handled by caller.
    """
    keys = list(cells.keys())
    p = np.array([cells[k].get("p_value", 1.0) for k in keys], dtype=np.float64)
    adj, sig = benjamini_hochberg(p, q)
    for i, k in enumerate(keys):
        rec = cells[k]
        rec["p_value_fdr"] = float(adj[i])
        rec["significant_fdr"] = bool(sig[i])
        rec["significant_raw"] = bool(rec.get("significant", False))
    return cells
