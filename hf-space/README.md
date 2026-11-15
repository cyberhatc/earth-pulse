---
title: Earth Pulse RAG
emoji: 🌍
colorFrom: green
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: apache-2.0
short_description: Retrieval-augmented, facts-locked climate trend chatbot for the Earth Pulse NASA explorer
---

# Earth Pulse RAG

Retrieval-augmented, **facts-locked** language service behind the Earth Pulse
chatbot (a NASA Earth-data trend explorer). It retrieves relevant passages from
a bundled knowledge base (project docs, curated NASA POWER / method notes, and
coverage facts derived from the data store) and re-words them — it **never
computes or changes a number**. A p-value is never a certainty; a forecast band
is never a guaranteed future.

The heavy lifting (facts assembly, post-generation guards, fallback to templated
prose) stays in the calling backend; this Space is the retrieval + generation
stage.

## API

- `GET /health` → `{ status, model, model_loaded, kb_chunks, top_k, ... }`
- `POST /rag/chat` with JSON:
  ```json
  {
    "messages": [{"role": "user", "content": "Is the trend significant?"}],
    "facts_summary": "Place: California Coast ...",
    "card_kind": "caveat",
    "language": "en",
    "max_new_tokens": 170
  }
  ```
  → `{ "text": "...", "model": "Qwen/Qwen2.5-0.5B-Instruct", "sources": [{"id": "S1", ...}] }`

## Caller responsibilities (kept out of this Space on purpose)

- Assemble the numeric FACTS (Theil–Sen/Mann–Kendall trends, forecast deltas,
  anomalies, coverage) from the Earth Pulse store.
- Re-apply the post-generation guards to the returned `text` and fall back to
  deterministic templated prose if any guard trips.

## Running locally

```bash
pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 7860
```

Environment variables: `MODEL_ID` (default `Qwen/Qwen2.5-0.5B-Instruct`),
`KB_PATH`, `KB_TOP_K`, `RAG_PRELOAD`, `MAX_NEW_TOKENS_CAP`.

## Limitations (honest)

- Free CPU Spaces are 2 vCPU — expect tens of seconds per answer on the 0.5B
  model. Upgrade `MODEL_ID` to `Qwen/Qwen2.5-1.5B-Instruct` only on a paid tier.
- The default model is small; it can follow instructions but will sometimes
  fail a guard upstream. That is by design: guarded fallback over false claims.
- The KB is a snapshot. Rebuild it with `scripts/build_rag_kb.py --sync-space`
  in the main repo and re-push when docs change.
- Answers cite the retrieved passages (`[S1]`, `[S2]` …) — treat citations as
  "which local document was used", not as independent verification.

## License

Apache-2.0. The default model, Qwen2.5-0.5B-Instruct, is Apache-2.0.
