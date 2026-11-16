"""Lazy, cached handles to the data store and precomputed analysis."""
from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
_START_TIME = __import__("time").time()
# Prefer the real FULL NASA POWER store (all extractable parameters) when
# present, else the 5-parameter real store, else the bundled synthetic sample.
_default_store = REPO_ROOT / "data" / "processed" / "earth_pulse_power_full.npz"
if not _default_store.exists():
    _default_store = REPO_ROOT / "data" / "processed" / "earth_pulse_power_real.npz"
if not _default_store.exists():
    _default_store = REPO_ROOT / "data" / "samples" / "earth_pulse_sample.npz"
SAMPLE_PATH = Path(os.environ.get("EP_STORE_PATH", _default_store))
_default_analysis = REPO_ROOT / "data" / "processed" / "analysis_power_full.json"
if not _default_analysis.exists():
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
    return json.loads(ANALYSIS_PATH.read_text(encoding="utf-8"))


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


def uptime_seconds() -> float:
    return round(__import__("time").time() - _START_TIME, 1)


def manifest_hash() -> str | None:
    """sha256[:16] of data/processed/manifest.json (when the real store was built)."""
    import hashlib
    fp = REPO_ROOT / "data" / "processed" / "manifest.json"
    if not fp.exists():
        return None
    return hashlib.sha256(fp.read_bytes()).hexdigest()[:16]


def models_info() -> dict:
    """Which forecaster artifact would serve + whether conformal calibration is wired."""
    info: dict = {"artifact": None, "conformal_calibrated": False,
                  "calibration_date": None, "band_methods": ["sqrt_h"]}
    try:
        meta_fp = REPO_ROOT / "models" / "artifacts" / "forecaster_meta.json"
        if meta_fp.exists():
            meta = json.loads(meta_fp.read_text(encoding="utf-8"))
            info["artifact"] = meta.get("artifact")
        conformal_fp = REPO_ROOT / "data" / "processed" / "conformal.json"
        if conformal_fp.exists():
            c = json.loads(conformal_fp.read_text(encoding="utf-8"))
            info["conformal_calibrated"] = bool(c.get("levels"))
            info["calibration_date"] = c.get("calibrated_at")
            info["calibration_model"] = c.get("model")
            info["band_methods"] = ["conformal", "sqrt_h"]
    except Exception:
        pass
    return info


def normalise_lon(lon: float) -> float:
    """Wrap longitude into [-180, 180) — matches the store's grid_lon convention."""
    return ((lon + 180.0) % 360.0) - 180.0
