# RAG pipeline — design, build, deploy, rollback

`POST /chat` used to answer from a hand-built FACTS summary (trends, forecast
deltas, anomalies, coverage) re-worded by a small local Ollama model. The RAG
change adds **retrieval** on top of that, keeps the **facts-locked** design,
and can run on **Hugging Face Spaces** (free CPU) instead of Ollama.

**Nothing is deployed until you explicitly approve it.** This document is the
runbook.

## Architecture

```
Browser → frontend (/api/chat) → Earth Pulse FastAPI  (this repo)
                                     │  1. build FACTS from the store/analysis
                                     │  2. EP_RAG_BACKEND=hf?
                                     ▼
                        ┌─ yes ─▶ Hugging Face Space   (hf-space/)
                        │            · BM25 retrieve top-k passages from kb.json
                        │            · small instruct model (default Qwen2.5-0.5B-Instruct)
                        │            · returns {text, model, sources:[S1..]}
                        │         ◀──┘
                        │  3. re-apply guards (certainty / stat misuse / band misuse /
                        │     unverified numbers) — identical to the Ollama path
                        │  4. on Space failure → Ollama → templated prose
                        └─ no ──▶ Ollama (default) → templated fallback
```

Key points, deliberately unchanged from the pre-RAG design:

- The model **never computes or changes a number**. Numbers come only from the
  backend's FACTS dict.
- Every LLM draft — Ollama or HF RAG — passes the **same post-generation
  guards**. A failure substitutes deterministic templated prose
  (`generator: "templated-guard"`), never a risky answer.
- `[S1]`-style citation markers are stripped before the numeric guard counts
  numbers, so citations cannot trip it.
- Fallbacks are layered: Space → Ollama → templated. The endpoint never 5xxs
  because an LLM misbehaved.

## What retrieval adds

- **Domain knowledge** the local model lacks: NASA POWER methodology and
  parameters, data-source history tables, limitations, and the repo's own
  method notes (Theil–Sen, Mann–Kendall, robust-z anomalies, PICP bands,
  climate twins, guardrail rationale). Curated, plain-English, and clearly
  labeled in `docs/rag-corpus/`.
- **Store-derived facts** from the active store/analysis
  (`analysis_power_real.json` or `analysis.json`): provenance, coverage window,
  grid shape, per-parameter trend coverage / significant-cell counts, climate
  twin clustering parameters, opposite-trend counts. No raw series are embedded
  — only summaries.
- **Citations**: the Space returns `sources: [{id, title, source, score}]`;
  the backend passes them through; the chat UI renders a muted "Sources" line
  under the answer.

## Building the knowledge base

```bash
cd nasa
python3 scripts/build_rag_kb.py            # → data/rag/kb.json
python3 scripts/build_rag_kb.py --sync-space  # also copies kb.json + rag_core.py into hf-space/
```

Deterministic; rerun whenever the docs or analysis JSON change, then re-push
the Space. The KB is ~140 KB (`data/rag/kb.json`) and safe to commit; the same
file is bundled inside the Space.

Current size: **222 chunks / 16 sources**. Retrieval is BM25 (pure Python,
`api/services/rag_core.py`) — no embedding model, no extra dependencies, fast
on free CPU. Curated store-derived chunks carry a small score boost (1.25×).

## Running the Space locally (no HF account needed)

```bash
cd hf-space
pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 7860
curl localhost:7860/health
curl -X POST localhost:7860/rag/chat -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Is the trend significant?"}],"facts_summary":"…","card_kind":"caveat"}'
```

Verified offline in this change-set with a stubbed model (full HTTP roundtrip,
prompt assembly, citations, 503 failure path). Real weights were **not**
downloaded locally — PyPI was unreachable from this machine; the model is
fetched by the Space's Docker build instead. Expect first boot to download
~1 GB (Qwen2.5-0.5B-Instruct, fp32).

## Creating + pushing the Space (only after approval)

1. Create the token (see README section in this doc: "HF token setup").
2. `huggingface-cli login` (or `HF_TOKEN=hf_… huggingface-cli upload`), or:
   ```bash
   huggingface-cli repo create earth-pulse-rag --type space --space_sdk docker --exist-ok
   cd hf-space && git init && git remote add origin https://huggingface.co/spaces/<you>/earth-pulse-rag && git push origin HEAD:main --force
   ```
3. Wait for the Space build (~2–5 min incl. model download). `GET /health`
   should report `"model_loaded": true`.
4. Wire the backend:
   ```bash
   # nasa/.env (never committed)
   EP_RAG_BACKEND=hf
   HF_RAG_SPACE_URL=https://<you>-earth-pulse-rag.hf.space
   # optional, if the Space is private: HF_TOKEN=hf_…
   ```
   Restart uvicorn (`make api` / previous process). `/health` will then show a
   `rag` block with `"enabled": true`, `"backend": "hf-rag"`, `"kb_chunks": 222`.
   The frontend needs no rebuild beyond the sources UI; it picks up
   `rag`/`sources` automatically.

## Environment variables

| Var | Default | Meaning |
|---|---|---|
| `EP_RAG_BACKEND` | `ollama` | `ollama` · `hf` · `templated` |
| `HF_RAG_SPACE_URL` | — | Space base URL (required when backend=hf) |
| `HF_TOKEN` | — | Optional bearer for a private Space |
| `EP_RAG_TIMEOUT` | `90` | Seconds before giving up on the Space |
| `EP_RAG_KB_PATH` | `data/rag/kb.json` | /health stats only |
| `EP_RAG_TOP_K` | `4` | Informational; enforced Space-side |
| Space-side: `MODEL_ID` | `Qwen/Qwen2.5-0.5B-Instruct` | Any causal instruct model on the Hub |
| Space-side: `KB_TOP_K` | `4` | Passages retrieved per query |
| Space-side: `RAG_PRELOAD` | `1` | Preload the model at boot (background thread) |
| Space-side: `MAX_NEW_TOKENS_CAP` | `300` | Server-side generation cap |

## HF token setup (what you asked me to walk through)

1. Log in at https://huggingface.co → avatar (top right) → **Settings** →
   **Access Tokens** → **Create new token**.
2. Choose **Fine-grained** or **Write** role; for creating/pushing a Space you
   need write access. Scope to just what you need if fine-grained
   (Repositories → create/write). Copy `hf_…` immediately.
3. Put it in `nasa/.env` as `HF_TOKEN=hf_…` (or pass it to `huggingface-cli
   login`). It is **never** committed — `.gitignore` in this repo excludes
   `.env`, and I have not written it anywhere.
4. To let the backend *call* a private Space, the same token works
   (`Authorization: Bearer`). For a public Space, no token is needed at runtime.
5. Optional: push a different `MODEL_ID` as a private model repo and set
   `MODEL_ID` on the Space via its **Settings → Variables**.

## Rollback

- Set `EP_RAG_BACKEND=ollama` (or delete it) and restart the backend → exactly
  the pre-RAG behaviour. The frontend degrades gracefully too.
- `hf-space/` can be deleted entirely; the repo has no other dependencies on
  it. `data/rag/kb.json` can stay or be regenerated.

## Honest limitations

- Free CPU Space (2 vCPU): **tens of seconds per answer** with the 0.5B model.
  If that's too slow, use `Qwen/Qwen2.5-0.5B-Instruct` still, or upgrade the
  Space to a paid tier / use Ollama locally instead (`EP_RAG_BACKEND=ollama`).
- The 0.5B model is weak; the guards exist precisely so its output is only
  published when it re-words facts correctly. Expect occasional `templated-guard`.
- KB is a snapshot of the docs at build time — drift is real. Rebuild + re-push
  on doc changes.
- Citations tell you *which local passage* was used, not external verification.
- BM25 ≠ semantic search: rare-word lookups are great, subtle paraphrases are
  not. If recall quality matters, add `sentence-transformers` embeddings Space-side.
