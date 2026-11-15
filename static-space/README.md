---
title: Earth Pulse On-Device AI
emoji: 🌍
colorFrom: green
colorTo: indigo
sdk: static
pinned: false
license: apache-2.0
short_description: On-device, facts-locked AI for Earth Pulse (WebGPU)
---

# Earth Pulse On-Device AI

Retrieval-augmented, **facts-locked** assistant for the Earth Pulse NASA
Earth-data trend explorer — running **entirely in your browser** (WebGPU, no
servers, nothing uploaded).

- **Retrieval:** BM25 (pure JS) over a bundled knowledge base — Earth Pulse
  docs, curated NASA POWER / method notes, and store-derived coverage facts.
- **Generation:** `onnx-community/Qwen2.5-0.5B-Instruct` (q4) via
  [transformers.js](https://github.com/huggingface/transformers.js). First load
  downloads ~400 MB (cached afterwards). Falls back to WASM when WebGPU is
  unavailable (slow but functional).
- **Facts-locked:** the model only re-words the numeric facts passed in the
  URL (`?region=&variable=&slope=&pvalue=&sig=&delta=&horizon=&synth=…`);
  it never computes or changes numbers. A deterministic guard subset
  (certainty claims / significance misread / unverified numbers) substitutes
  for the model if it misbehaves — answers are never knowingly wrong.
- **Citations:** passages used are cited `[S1]`, `[S2]` and listed under the
  answer.

Opened from the Earth Pulse app, the URL carries the current region's facts;
without them the page answers general knowledge from the bundled KB only.

## Limitations (honest)

- 0.5B model — capable but shallow. Always verify numbers against the app's
  Evidence card before publishing anything.
- Guard subset in JS is narrower than the backend's Python guards (no
  p-value-as-probability and no p10–p90-as-chance checks) — treat answers as
  leads, not verdicts.
- BM25 ≠ semantic search. Rare-word lookups are great; paraphrases are not.
- The KB is a snapshot rebuilt from the repo — redeploy this Space when the
  docs change.
- The knowledge base contains project documentation and NASA POWER/method
  notes; it is not medical, legal, or financial advice. Same for climate
  attribution claims.

## License

Apache-2.0. The model is Apache-2.0 (Qwen2.5). transformers.js is Apache-2.0.
