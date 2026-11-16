#!/usr/bin/env python3
"""End-to-end offline verification: sample -> engine -> forecast -> payload keys.

Exit 0 on success, non-zero with a message on failure. Safe to run in CI.
Usage: python3 scripts/verify_offline.py
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PY = sys.executable


def run(cmd: list[str]) -> None:
    print(f"$ {' '.join(cmd)}")
    subprocess.run(cmd, cwd=ROOT, check=True)


def main() -> int:
    run([PY, "pipeline/run_pipeline.py", "--sample"])
    run([PY, "engine/run_engine.py"])
    run([PY, "models/train.py"])

    sys.path.insert(0, str(ROOT))
    from pipeline.export_store import load_store, DEFAULT_SAMPLE_PATH
    from models.infer import forecast_place

    store = load_store(DEFAULT_SAMPLE_PATH)
    cell = 134
    fc = forecast_place(store, cell, 12)
    series = fc["timeseries"]["temperature"]
    assert len(fc["dates"]) == 12, "horizon mismatch"
    assert len(series["mean"]) == 12
    assert all(series["lower"][i] <= series["mean"][i] <= series["upper"][i] for i in range(12)), "band ordering violated"

    analysis_path = ROOT / "data" / "processed" / "analysis.json"
    analysis = json.loads(analysis_path.read_text(encoding="utf-8"))
    for key in ("trends", "opposite_trends", "climate_twins", "cells"):
        assert key in analysis, f"analysis.json missing {key}"
    assert len(analysis["cells"]) == 240
    print("[verify] offline pipeline OK — store, engine, forecast, analysis.json all consistent")
    return 0


if __name__ == "__main__":
    sys.exit(main())
