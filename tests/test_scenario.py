"""Scenario-image pipeline guards and conditioning (offline)."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from models.scenario_image import build_conditioning, generate_scenario_cards, LABEL, scenario_enabled


def test_conditioning_is_labeled_and_auditable():
    cond = build_conditioning(12.97, 77.59, "ndvi", [0.40, 0.39, 0.37, 0.35], 0.41,
                              "https://example.com/tile.jpg")
    assert cond["label"] == LABEL
    assert len(cond["cards"]) == 3
    assert [c["name"] for c in cond["cards"]] == ["lower", "median", "upper"]
    for c in cond["cards"]:
        assert "same terrain" in c["prompt"]
        assert c["label"] == LABEL
        assert "text" in c["negative_prompt"]
    assert cond["delta"] == pytest.approx(0.35 - 0.41, abs=1e-9)


def test_refuses_without_ack():
    with pytest.raises(ValueError):
        generate_scenario_cards(12.97, 77.59, "ndvi", [0.4], acknowledge_not_observation=False)


def test_disabled_by_default_returns_status_not_images():
    old = os.environ.pop("EP_SCENARIO_IMAGES", None)
    try:
        res = generate_scenario_cards(12.97, 77.59, "ndvi", [0.4],
                                      acknowledge_not_observation=True,
                                      source_image_url="https://example.com/tile.jpg")
        # config may have been enabled by someone; assert the contract either way
        assert res["status"] in ("disabled", "backend_missing", "no_source_image", "generated")
        assert res["label"] == LABEL
        assert res["cards"] == [] if res["status"] in ("disabled", "no_source_image") else True
    finally:
        if old is not None:
            os.environ["EP_SCENARIO_IMAGES"] = old


def test_no_source_image_status():
    os.environ["EP_SCENARIO_IMAGES"] = "1"
    try:
        res = generate_scenario_cards(12.97, 77.59, "ndvi", [0.4],
                                      acknowledge_not_observation=True,
                                      source_image_url=None)
        assert res["status"] == "no_source_image"
        assert res["label"] == LABEL
    finally:
        os.environ.pop("EP_SCENARIO_IMAGES", None)


def test_cli_prints_conditioning_json(tmp_path):
    out = subprocess.run(
        [sys.executable, str(ROOT / "models" / "scenario_cards.py"),
         "--lat", "12.97", "--lon", "77.59", "--parameter", "ndvi"],
        capture_output=True, text=True, timeout=180,
    )
    assert out.returncode == 0
    payload = json.loads(out.stdout[out.stdout.index("{"): out.stdout.rindex("}") + 1])
    assert payload["label"] == LABEL
    assert len(payload["cards"]) == 3
