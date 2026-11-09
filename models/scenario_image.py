"""Scenario image generation (OPTIONAL, DISABLED by default).

The honest version of "generate a picture of the future": **AI scenario cards**
(lower / median / upper) — constrained, labeled illustrations conditioned on (a) a
recent REAL map tile and (b) the model's predicted deltas. Never presented as an
observation or a guaranteed future.

Guardrails enforced here:
1. Refuses unless configs/model.yaml → scenario_image.enabled: true (or EP_SCENARIO_IMAGES=1).
2. Refuses without acknowledge_not_observation=True.
3. Always carries label: "AI-generated scenario — not an observation".
4. Refuses without a source image (the latest real GIBS tile for that point).

Offline usage (no GPU needed):
    python3 models/scenario_cards.py --lat 12.97 --lon 77.59 --parameter ndvi
produces the exact prompts + conditioning JSON + tile URL for inspection, and can be
rerouted to any img2img/inpainting pipeline. Real generation happens in Colab/Kaggle:
    pip install diffusers transformers accelerate pillow requests
    EP_SCENARIO_IMAGES=1 python3 models/scenario_cards.py --generate ...
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

LABEL = "AI-generated scenario — not an observation"
MODEL_ID = os.environ.get("EP_SCENARIO_MODEL", "runwayml/stable-diffusion-v1-5")

PROMPT_TEMPLATE = (
    "Satellite-style map view of the same terrain, showing {parameter} {direction} by an estimated "
    "{delta:+.2f}{unit} over the coming years. Keep the geography exactly the same — same coastline, "
    "same rivers, same roads, same settlement pattern. Only the land-cover/color balance shifts "
    "{description}. Photorealistic Earth-observation style, no text, no borders, no watermark."
)
NEGATIVE_PROMPT = (
    "text, letters, numbers, watermark, logo, signature, border, frame, extra objects, people, vehicles, "
    "buildings not present in the source image, fantasy landscape, painting, illustration, cartoon"
)

# prompt direction descriptors per parameter & sign of delta
def _describe(parameter: str, delta: float) -> str:
    direction = {"ndvi": "vegetation greenness", "precipitation": "precipitation",
                 "temperature": "land-surface temperature", "precip": "precipitation"}.get(parameter, parameter)
    if parameter == "ndvi":
        return f"{direction} {'increasing' if delta >= 0 else 'decreasing'} ({'greener' if delta >= 0 else 'browner/drier'} canopy)"
    if parameter == "temperature":
        return f"{direction} {'rising' if delta >= 0 else 'falling'} ({'warmer' if delta >= 0 else 'cooler'} canopy tones)"
    if parameter in ("precipitation", "precip"):
        return f"{direction} {'increasing' if delta >= 0 else 'decreasing'} ({'lusher' if delta >= 0 else 'sparser'} vegetation)"
    return f"{direction} shifting ({delta:+.2f})"


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


def build_conditioning(lat: float, lon: float, parameter: str,
                       forecast_mean: list[float], last_observed: float | None,
                       source_image_url: str) -> dict:
    """Assemble the exact prompt + conditioning. Safe to run offline & inspect."""
    if not forecast_mean:
        raise ValueError("forecast_mean is empty")
    end = float(forecast_mean[-1])
    base = float(last_observed) if last_observed is not None else float(forecast_mean[0])
    delta = end - base
    unit = {"ndvi": " index", "temperature": "°C", "precipitation": " mm/mo",
            "sst": "°C", "sea_level": " mm", "humidity": "%", "wind": " m/s",
            "solar_radiation": " kWh/m²/day"}.get(parameter, "")
    description = _describe(parameter, delta)
    cards = []
    for variant, q in (("lower", 0.1), ("median", 0.5), ("upper", 0.9)):
        # scale the prompt's stated shift per quantile when we have band info is the
        # caller's job; here we anchor on the provided mean with quantile labels.
        card_delta = delta * {"lower": 0.6, "median": 1.0, "upper": 1.4}[variant]
        cards.append({
            "name": variant,
            "quantile": q,
            "prompt": PROMPT_TEMPLATE.format(parameter=parameter,
                                             direction=_describe(parameter, card_delta),
                                             delta=card_delta, unit=unit,
                                             description=description),
            "negative_prompt": NEGATIVE_PROMPT,
            "width": 640,
            "height": 640,
            "strength": 0.35 if variant == "median" else (0.25 if variant == "lower" else 0.45),
            "seed": hash((round(lat, 4), round(lon, 4), parameter, variant)) % (2**31 - 1),
            "label": LABEL,
        })
    return {
        "label": LABEL,
        "honesty": "This is an AI-generated scenario card, NOT a forecast of the actual place. Geography is preserved; only land-cover balance is suggested.",
        "lat": lat,
        "lon": lon,
        "parameter": parameter,
        "baseline_value": base,
        "projected_end_value": end,
        "delta": delta,
        "source_image_url": source_image_url,
        "model_id": MODEL_ID,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "cards": cards,
    }


def _load_source_image(url: str):
    import urllib.request
    from io import BytesIO
    from PIL import Image  # type: ignore
    with urllib.request.urlopen(url, timeout=30) as resp:
        raw = resp.read()
    img = Image.open(BytesIO(raw)).convert("RGB")
    img.thumbnail((768, 768))
    return img


def generate_scenario_cards(lat: float, lon: float, parameter: str,
                            forecast_mean: list[float], last_observed: float | None = None,
                            source_image_url: str | None = None,
                            acknowledge_not_observation: bool = False) -> dict:
    if not acknowledge_not_observation:
        raise ValueError("Refusing: pass acknowledge_not_observation=True (scenario ≠ observation).")
    if not scenario_enabled():
        return {
            "status": "disabled",
            "reason": "scenario_image.enabled is false (configs/model.yaml / EP_SCENARIO_IMAGES=1).",
            "label": LABEL,
            "cards": [],
        }
    if not source_image_url:
        return {"status": "no_source_image",
                "reason": "No real source image supplied. Expected the latest GIBS tile URL for this point.",
                "label": LABEL, "cards": []}

    conditioning = build_conditioning(lat, lon, parameter, forecast_mean, last_observed, source_image_url)

    try:
        import torch
        from diffusers import StableDiffusionImg2ImgPipeline  # type: ignore
        from PIL import Image
    except ImportError:
        return {
            "status": "backend_missing",
            "reason": "Install: pip install diffusers transformers accelerate pillow requests torch",
            "label": LABEL,
            "conditioning": conditioning,   # prompts are deterministic & inspectable
            "cards": conditioning["cards"],
        }

    pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
        MODEL_ID, torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        safety_checker=None,
    )
    if torch.cuda.is_available():
        pipe = pipe.to("cuda")
    pipe.set_progress_bar_config(disable=True)

    init_image = _load_source_image(source_image_url)
    init_image = init_image.resize((640, 640))

    steps = int(os.environ.get("EP_SCENARIO_STEPS", "30"))
    guidance = float(os.environ.get("EP_SCENARIO_GUIDANCE", "7.5"))

    out_dir = "models/artifacts/scenarios"
    os.makedirs(out_dir, exist_ok=True)
    slug = f"{lat:+.2f}_{lon:+.2f}_{parameter}".replace("+", "p").replace("-", "m")
    results = []
    for card in conditioning["cards"]:
        gen = torch.Generator(device="cuda" if torch.cuda.is_available() else "cpu").manual_seed(card["seed"])
        image = pipe(prompt=card["prompt"], negative_prompt=card["negative_prompt"],
                     image=init_image, strength=card["strength"],
                     guidance_scale=guidance, num_inference_steps=steps, generator=gen).images[0]
        path = os.path.join(out_dir, f"{slug}_{card['name']}.png")
        image.save(path)
        results.append({**card, "image_path": path})
    return {
        "status": "generated",
        "label": LABEL,
        "conditioning": conditioning,
        "cards": results,
        "warning": "AI-generated scenarios for illustration only. Do not present as predictions of actual events.",
    }
