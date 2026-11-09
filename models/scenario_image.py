"""Scenario image generation (OPTIONAL, DISABLED by default).

This module implements the *honest* version of "generate a future photo of that
place": an AI-generated **scenario card** (lower / median / upper), explicitly
labeled. It is NOT a prediction of an actual future photograph.

Guardrails enforced here:
1. Refuses to run unless `configs/model.yaml → scenario_image.enabled: true`
   (or EP_SCENARIO_IMAGES=1) AND a generative image backend is installed.
2. Refuses to run without an explicit `acknowledge_not_observation=True`.
3. The returned payload always carries label: "AI-generated scenario — not an observation".
"""
from __future__ import annotations

import os


def scenario_enabled() -> bool:
    if os.environ.get("EP_SCENARIO_IMAGES") == "1":
        return True
    try:
        import yaml
        with open("configs/model.yaml") as fh:
            cfg = yaml.safe_load(fh)
        return bool(cfg.get("scenario_image", {}).get("enabled", False))
    except Exception:
        return False


def generate_scenario_cards(lat: float, lon: float, parameter: str,
                            forecast_mean: list[float], acknowledge_not_observation: bool = False) -> dict:
    if not acknowledge_not_observation:
        raise ValueError("Refusing: pass acknowledge_not_observation=True (scenario ≠ observation).")
    if not scenario_enabled():
        return {
            "status": "disabled",
            "reason": "scenario_image.enabled is false (configs/model.yaml / EP_SCENARIO_IMAGES=1).",
            "how_to_enable": "Install a diffusion backend (e.g. diffusers), enable the flag, and keep the label visible.",
            "label": "AI-generated scenario — not an observation",
            "cards": [],
        }
    try:
        import diffusers  # noqa: F401
    except ImportError:
        return {
            "status": "backend_missing",
            "reason": "diffusers not installed (pip install diffusers transformers accelerate).",
            "label": "AI-generated scenario — not an observation",
            "cards": [],
        }
    # Deliberately not wired to a specific model here: any inpainting/img2img pipeline
    # conditioned on the latest real image + predicted parameter deltas fits the same contract.
    raise NotImplementedError(
        "Wire your chosen pipeline here (load weights from EP_MODEL_REPO/Hugging Face Hub), "
        "produce lower/median/upper variants, and keep the 'not an observation' label."
    )
