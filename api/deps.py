"""Lazy, cached handles to the data store and precomputed analysis."""
from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
# Prefer the real NASA POWER store when present, else the bundled synthetic sample.
_default_store = REPO_ROOT / "data" / "processed" / "earth_pulse_power_real.npz"
if not _default_store.exists():
    _default_store = REPO_ROOT / "data" / "samples" / "earth_pulse_sample.npz"
SAMPLE_PATH = Path(os.environ.get("EP_STORE_PATH", _default_store))
_default_analysis = REPO_ROOT / "data" / "processed" / "analysis_power_real.json"
if not _default_analysis.exists():
    _default_analysis = REPO_ROOT / "data" / "processed" / "analysis.json"
ANALYSIS_PATH = Path(os.environ.get("EP_ANALYSIS_PATH", _default_analysis))


@lru_cache(maxsize=1)
def get_store() -> dict:
    from pipeline.export_store import load_store
    return load_store(SAMPLE_PATH)


@lru_cache(maxsize=1)
def get_analysis() -> dict:
    if not ANALYSIS_PATH.exists():
        raise RuntimeError(
            f"Precomputed analysis not found at {ANALYSIS_PATH}. "
            "Run: python3 engine/run_engine.py (or `make engine`)."
        )
    return json.loads(ANALYSIS_PATH.read_text())


def analysis_available() -> bool:
    return ANALYSIS_PATH.exists()


def store_available() -> bool:
    return SAMPLE_PATH.exists()


def store_info() -> dict:
    """Authoritative, cheap description of the active store (metadata only)."""
    info: dict = {
        "path": str(SAMPLE_PATH),
        "name": SAMPLE_PATH.name,
        "exists": SAMPLE_PATH.exists(),
    }
    if not SAMPLE_PATH.exists():
        return info
    try:
        with np.load(SAMPLE_PATH, allow_pickle=False) as z:
            raw = z["meta_json"] if "meta_json" in z.files else None
            if raw is None:
                return info
            text = str(raw.item()) if getattr(raw, "size", 1) == 1 else str(raw)
            meta = json.loads(text or "{}")
        info.update(
            {
                "synthetic": bool(meta.get("synthetic", True)),
                "real_data": bool(
                    meta.get("real_data", not bool(meta.get("synthetic", True)))
                ),
                "provenance": meta.get("provenance"),
                "time_range": meta.get("time_range"),
                "n_months": meta.get("n_months"),
            }
        )
    except Exception as exc:  # a corrupt store should not take down /health
        info["error"] = str(exc)
    return info


def clear_caches() -> None:
    get_store.cache_clear()
    get_analysis.cache_clear()
