# AI scenario cards — the honest "future image" feature

**What this is:** an optional, disabled-by-default pipeline that produces three labeled **scenario images** (lower / median / upper) of a place, conditioned on the latest real map tile and the model's predicted parameter deltas.\n\n**What this is not:** a photograph of the future; a prediction of actual events; a replacement for observed data. The label `AI-generated scenario — not an observation` travels with every card (file-level metadata, UI badge, and this doc).

## Design rules (enforced in code)
1. OFF unless `configs/model.yaml → scenario_image.enabled: true` **or** `EP_SCENARIO_IMAGES=1`.
2. Every call must pass `acknowledge_not_observation=True` (CLI sets it; HTTP never generates).
3. Generation happens **offline** (Colab/Kaggle GPU), never inside an API request — the endpoint `/imagery/scenario` only returns the deterministic conditioning (prompts, deltas, source tile) and enablement status.
4. Negative prompt bans text/borders/people/fake buildings; geography (coastline, rivers, roads, settlements) must be preserved; only land-cover color balance shifts.
5. Strength: lower 0.25 / median 0.35 / upper 0.45 — lower variants are nearer the source tile, so they are conservative.

## Files
| File | Role |
|---|---|
| `models/scenario_image.py` | Guards + `build_conditioning` (offline-inspectable) + `generate_scenario_cards` (diffusers path) |
| `models/scenario_cards.py` | CLI: `--lat --lon --parameter` → prints conditioning; `--generate` on GPU → PNGs in `models/artifacts/scenarios/` |
| `notebooks/04_scenario_images.ipynb` | Colab/Kaggle walkthrough + HF Hub push |
| `api/routers/scenario.py` | `GET /imagery/scenario?lat&lon&parameter=ndvi` → status + conditioning; never generates |
| `web/src/components/ScenarioStatus.tsx` | "Check scenario pipeline" button + prompt viewer in the panel |
| `configs/model.yaml` | `scenario_image.enabled: false` by default |

## Run it (COLAB / KAGGLE, free GPU)
```bash
pip install diffusers transformers accelerate pillow requests torch
# offline inspection first (no GPU):
python3 models/scenario_cards.py --lat 12.97 --lon 77.59 --parameter ndvi
# then generate:
EP_SCENARIO_IMAGES=1 python3 models/scenario_cards.py --generate --lat 12.97 --lon 77.59 --parameter ndvi
```
Outputs: `models/artifacts/scenarios/<slug>_{lower,median,upper}.png` + prompts in the printed conditioning JSON.

## Model choice
Default `runwayml/stable-diffusion-v1-5` via `StableDiffusionImg2ImgPipeline` (override with `EP_SCENARIO_MODEL=...`). Rules for any model you swap in: img2img/inpainting only (preserves geometry), license compatible with redistribution, and keep the label.

## Why the prompts look like maps
The prompt fixes the **same terrain** and asks only for parameter-driven land-cover shift derived from the **trained model's own forecast** (e.g., ΔNDVI = projected end − last observed). The conditioning JSON is auditable — the web UI shows the exact three prompts.

## Known failure modes
- Mode shift (out-of-distribution prompts) → generic-looking images; mitigate with lower strength and seed variation.
- Cloud/shadow artifacts from the source tile are copied (img2img) → pick cloud-free tiles.
- Human bias: users may read any image as "the future" → the UI never removes the red badge.

## Shipping to users
1. Generate the three PNGs offline; push to HF Hub (`huggingface-cli upload <you>/earth-pulse-scenarios ./models/artifacts/scenarios`).
2. Serve the folder statically or from the Space; reference URLs in the payload's `forecast.scenarios` array.
3. Keep `scenario_image.enabled: false` by default; demos enable per-event.
