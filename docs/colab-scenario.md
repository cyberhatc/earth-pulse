# One-click: AI scenario cards in Google Colab (free GPU)

**Requirements:** just a Google account. No API keys, no sign-ups, no credits. GPU optional — the notebook auto-switches to a CPU-friendly distilled model when no GPU is available.

## Steps (about 10–15 minutes)

1. Open this URL (it loads the notebook directly from the repo):
   **https://colab.research.google.com/github/cyberhatc/earth-pulse/blob/main/notebooks/04_scenario_images.ipynb**
2. Optional: **Runtime → Change runtime type → GPU** (T4) → Save. Not connected? Don't panic — Section 4 **auto-detects**: GPU → SD 1.5 @ 30 steps; no GPU → SD-Turbo @ 4 steps (works on CPU).
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

**“await connected: disconnected” (runtime never connects):**
1. Close the tab → **private/incognito window** with **extensions OFF** (ad-block/privacy extensions block `ssl.gstatic.com`); allow third-party cookies on `*.google.com`.
2. Reload the notebook → click **Connect** → **Runtime → Run all**.
3. Likely **free GPU quota exhausted** → wait a few hours, or let Section 4 auto-switch to CPU mode (it now picks `sd-turbo` @ 4 steps automatically when no GPU is present).
4. **Different network** — this network dropped external hosts all evening (codeload/OSM/raw fetches failed).
5. **Sync your system clock** — TLS handshakes to gstatic fail otherwise even when the page looks loaded.
6. `Runtime → Restart and run all` and try again.

**Other issues:**
- No GPU → you forgot Step 2 (GPU). Section 4 auto-falls back to CPU mode regardless.
- First run downloads ~4 GB — don't close the tab during Section 4.
- Rate limit/429 → wait, or set `EP_SCENARIO_MODEL=<repo>` before Section 4.
- Want more quality on CPU → `EP_SCENARIO_STEPS=8` (default CPU is 4).

## Optional: serve the images in the live app

```python
!huggingface-cli login
!huggingface-cli upload <you>/earth-pulse-scenarios /content/earth-pulse/models/artifacts/scenarios
```
Then point the `forecast.scenarios[].generated_image_url` fields in the payload at the Hub URLs — the frontend already renders them under the red "AI-generated scenario" badge.
