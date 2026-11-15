# RAG pipeline — design, build, deploy, rollback

`POST /chat` used to answer from a hand-built FACTS summary (trends, forecast
deltas, anomalies, coverage) re-worded by a small local Ollama model. The RAG
change adds **retrieval**, keeps the **facts-locked** design, and runs on
**Hugging Face** via its serverless inference router — $0 hosting, no servers.

**Live status:** not wired to the running backend until `EP_RAG_BACKEND` is set
in `nasa/.env` (see "Enabling it"). Until then chat behaves exactly as before.

## Architecture

```
Browser → frontend (/api/chat) → Earth Pulse FastAPI  (this repo)
                                     │  1. build FACTS from the store/analysis
                                     │  2. EP_RAG_BACKEND?
                                     ├─ hf-router ─▶ BM25 retrieval over local kb.json (BM25, pure Python)
                                     │                 + POST router.huggingface.co/v1/chat/completions
                                     │                   (model = HF_ROUTER_MODEL, Bearer HF_TOKEN)
                                     │             ◀── {text, model, sources:[S1..]}
                                     ├─ hf        ─▶ HF Space (hf-space/) — same contract; needs PRO
                                     │             ◀── {text, model, sources:[S1..]}
                                     │  3. re-apply guards (certainty / stat misuse / band misuse /
                                     │     significance misread / unverified numbers) — identical on every path
                                     │  4. RAG backend failed → Ollama → templated prose
                                     └─ otherwise   ─▶ Ollama (default) → templated fallback
```

Key points, unchanged from the pre-RAG design:

- The model **never computes or changes a number**. Numbers come only from the
  backend's FACTS dict.
- Every LLM draft — Ollama, HF Space, HF serverless — passes the **same
  post-generation guards**. A failure substitutes deterministic templated prose
  (`generator: "templated-guard"`), never a risky answer.
- `[S1]`-style citation markers are stripped before the numeric guard counts
  numbers, so citations cannot trip it.
- Fallbacks are layered: RAG backend → Ollama → templated. The endpoint never
  5xxs because an LLM misbehaved.

## What retrieval adds

- **Domain knowledge** the local model lacks: NASA POWER methodology and
  parameters, data-source history tables, limitations, and the repo's method
  notes (Theil–Sen, Mann–Kendall, robust-z anomalies, PICP bands, climate
  twins, guardrail rationale). Curated, plain-English, labeled in
  `docs/rag-corpus/`.
- **Store-derived facts** from the active store/analysis: provenance, coverage
  window, grid shape, per-parameter trend coverage / significant-cell counts,
  twin clustering, opposite-trend counts. No raw series are embedded.
- **Citations**: passages used are returned as `sources: [{id, title, source,
  score}]` and rendered as a muted "Sources" line in the chat UI.

## Building the knowledge base

```bash
cd nasa
python3 scripts/build_rag_kb.py               # → data/rag/kb.json (229 chunks, 16 sources)
python3 scripts/build_rag_kb.py --sync-space  # also copies kb.json + rag_core.py into hf-space/
```

Deterministic; rerun whenever docs or the analysis JSON change. Retrieval is
BM25 (pure Python, `api/services/rag_core.py`) — no embedding model, no extra
dependencies, fast. Curated store-derived chunks carry a small score boost.

## Enabling it (serverless — the recommended free path)

1. Give the HF token in `nasa/.env` the inference permission (it can't call the
   router today): huggingface.co → **Settings → Access Tokens** → edit the
   fine-grained **nasa** token → enable **Make calls to Inference Providers**
   → Save. (Or create a new token with that scope and replace `HF_TOKEN` in
   `nasa/.env`.)
2. `nasa/.env`:
   ```
   EP_RAG_BACKEND=hf-router
   # HF_ROUTER_MODEL=meta-llama/Llama-3.1-8B-Instruct   # any model an inference provider offers for this account
   ```
   (`HF_TOKEN` is already there; the app does not load dotenv itself, but the
   RAG client falls back to reading `nasa/.env` directly — see `api/services/rag.py`.)
3. Restart the API and check `/health` — expect:
   `"rag": {"backend": "hf-router", "enabled": true, "kb_chunks": 229, "model": ...}`
   The chat engine badge shows "Live backend · HF serverless RAG · <model>".
4. List models your account can actually call:
   `curl -H "Authorization: Bearer $HF_TOKEN" https://router.huggingface.co/v1/models`
   then set `HF_ROUTER_MODEL` accordingly.

Cost: serverless inference draws from your monthly free credit (small models
are effectively free for hackathon volume). No hosting, nothing to keep alive.

Honest caveat: provider availability and exact free allowances change; if a
model isn't served for your account, the router answers 404/403 and chat
silently falls back to Ollama. `/health → rag.model` + the server logs tell you
which model actually answered.

## Enabling it (HF Space — optional, needs PRO)

Hugging Face requires a **PRO subscription** for Docker/Gradio Spaces on free
cpu-basic ("Static Spaces are free for everyone" but can't run a model). If you
subscribe (or use an existing Team/paid org):

```bash
huggingface-cli repo create earth-pulse-rag --type space --space_sdk docker --exist-ok
cd hf-space && git init -b main && git add -A && git commit -m "Earth Pulse RAG space"
git remote add origin https://huggingface.co/spaces/<you>/earth-pulse-rag
git push -u origin main
```

Then in `nasa/.env`: `EP_RAG_BACKEND=hf` and
`HF_RAG_SPACE_URL=https://<you>-earth-pulse-rag.hf.space`, restart the API.
Free-CPU generation with Qwen2.5-0.5B-Instruct takes tens of seconds per answer.

The Space was built and verified offline with a stubbed model (full HTTP
contract); real weights were not downloaded locally because PyPI/HF were
unreliable from this machine at build time.

## Environment variables

| Var | Default | Meaning |
|---|---|---|
| `EP_RAG_BACKEND` | `ollama` | `ollama` · `hf-router` · `hf` · `templated` |
| `HF_TOKEN` | — | Bearer token (hf-router required) |
| `HF_ROUTER_MODEL` | `meta-llama/Llama-3.1-8B-Instruct` | Router model id |
| `HF_RAG_SPACE_URL` | — | Space base URL (backend=hf) |
| `EP_RAG_TIMEOUT` | `90` | Seconds before giving up on the backend |
| `EP_RAG_KB_PATH` | `data/rag/kb.json` | KB path |
| `EP_RAG_TOP_K` | `4` | Retrieved passages |
| Space-side: `MODEL_ID` | `Qwen/Qwen2.5-0.5B-Instruct` | Model served by the Space |
| Space-side: `KB_TOP_K` | `4` | Passages the Space retrieves |
| Space-side: `RAG_PRELOAD` | `1` | Preload the model at boot |

## Rollback

- Delete `EP_RAG_BACKEND` (or set `ollama`) → exact pre-RAG behaviour.
- `hf-space/` can be deleted; nothing else depends on it.
- `data/rag/kb.json` can stay (it only feeds the RAG path / `/health`).

## Honest limitations

- BM25 ≠ semantic search — great on rare words, weaker on paraphrase. Add
  `sentence-transformers` embeddings later if recall matters.
- Citations show *which local passage* was used, not external verification.
- The KB is a snapshot of the docs — rebuild + re-push/redeploy on doc changes.
- Serverless inference quality ≠ a dedicated endpoint; small models will
  occasionally trip a guard and serve `templated-guard` — by design.
- The chat UI shows at most 3 source titles; full ids are in the message's
  `sources` array for the curious.
