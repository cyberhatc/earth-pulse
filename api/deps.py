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


def clear_caches() -> None:
    get_store.cache_clear()
    get_analysis.cache_clear()
