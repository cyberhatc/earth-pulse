"""Contract tests: precomputed analysis.json and the README example payload shape."""
from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
ANALYSIS = ROOT / "data" / "processed" / "analysis.json"


def _analysis():
    if not ANALYSIS.exists():
        pytest.skip("data/processed/analysis.json not built — run `make engine`")
    return json.loads(ANALYSIS.read_text())


def test_analysis_has_required_blocks():
    a = _analysis()
    for key in ("schema_version", "trends", "opposite_trends", "climate_twins", "cells", "time_range"):
        assert key in a, f"missing {key}"
    assert a["schema_version"] == "1.0.0"


def test_trends_cover_all_cells():
    a = _analysis()
    n_cells = len(a["cells"])
    for param, recs in a["trends"].items():
        assert len(recs) == n_cells, f"{param} trends cover {len(recs)}/{n_cells} cells"
        sample = next(iter(recs.values()))
        for key in ("slope_per_decade", "p_value", "significant", "direction", "n"):
            assert key in sample


def test_opposite_pairs_structure():
    a = _analysis()
    for param in ("ndvi", "precipitation"):
        for p in a["opposite_trends"][param]:
            assert p["strength"] in ("strong", "weak")
            assert p["cell_a"]["slope_per_decade"] * p["cell_b"]["slope_per_decade"] <= 0
            for side in ("cell_a", "cell_b"):
                for key in ("index", "lat", "lon", "slope_per_decade", "significant"):
                    assert key in p[side]


def test_climate_twins_labels_cover_cells():
    a = _analysis()
    labels = a["climate_twins"]["labels"]
    assert len(labels) == len(a["cells"])
    assert max(labels) < a["climate_twins"]["k"]


def test_engine_is_probably_synthetic():
    a = _analysis()
    # guard against silently shipping the demo store as "real" results
    if os.environ.get("EP_REQUIRE_REAL_DATA") == "1":
        assert a.get("synthetic_demo") is False
    else:
        assert a.get("synthetic_demo") in (True, False)
