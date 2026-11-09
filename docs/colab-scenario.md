# One-click: AI scenario cards in Google Colab (free GPU)

**Requirements:** none beyond a Google account. No API keys, no sign-ups, no credits.

## Steps (about 10–15 minutes)

1. Open this URL (it loads the notebook directly from the repo):
   **https://colab.research.google.com/github/cyberhatc/earth-pulse/blob/main/notebooks/04_scenario_images.ipynb**
2. Top menu: **Runtime → Change runtime type → GPU** (T4). Click **Save**.
3. Top menu: **Runtime → Run all** (or press `Ctrl+F9`).
4. Wait for the download (~4 GB model on first run) — do nothing; it's normal.
5. When it finishes, **Section 5 shows the three images** inline: lower / median / upper.
6. **Files pane (left sidebar)** → `earth-pulse-scenarios.zip` → hover → **Download**. Everything you need for the demo.

What the notebook does, in order:

| Cell | Action |
|---|---|
| 1 | checks `nvidia-smi` (must list a GPU) |
| 2 | shallow-clones `github.com/cyberhatc/earth-pulse` |
| 3 | installs deps (`diffusers`, `transformers`, …) |
| 4 | builds the bundled demo store + engine + ridge forecaster |
| 5 | runs `models/scenario_cards.py --generate --lat 12.97 --lon 77.59 --parameter ndvi` with `EP_SCENARIO_IMAGES=1` |
| 6 | displays the PNGs from `models/artifacts/scenarios/` |
| 7 | zips them for download |
| 8+ | troubleshooting + optional HF Hub push |

## Honesty guarantees (enforced in code, not just docs)

- Label on every card/UI: `AI-generated scenario — not an observation`.
- Conditioning: **same geography** (coastline, rivers, roads, settlements) — only land-cover balance shifts.
- Prompts are **printed in the output** (Section 4 prints the exact three prompts) — auditable, not magic.

## What it will look like

Three satellite-style map tiles of Bengaluru with shifted vegetation cover:
browner (lower), ~unchanged-ish (median), slightly greener/denser (upper) — or whatever the current model forecast says. The exact pixels depend on the model + seed; the pipeline itself is deterministic.

## If something breaks

- No GPU → you forgot step 2. Fix and re-run.
- Download fails → network blip; **Runtime → Restart and run all**.
- Rate limit → wait, or set `EP_SCENARIO_MODEL=<other-repo>` cell before Section 4 and re-run from there.
- Still stuck → `models/scenario_cards.py --lat 12.97 --lon 77.59 --parameter ndvi` locally prints the exact conditioning JSON without any GPU — paste the output into an issue and I'll debug it line by line.

## Optional: serve the images in the live app

```python
!huggingface-cli login
!huggingface-cli upload <you>/earth-pulse-scenarios /content/earth-pulse/models/artifacts/scenarios
```
Then point the `forecast.scenarios[].generated_image_url` fields in the payload at the Hub URLs — the frontend already renders them under the red "AI-generated scenario" badge.
