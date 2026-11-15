"""Earth Pulse RAG service (Hugging Face Space, free CPU).

Retrieval over a bundled knowledge base (BM25, pure Python — no embedding
model needed) + a small instruct model re-wording FACTS (never changing
numbers). The caller (Earth Pulse FastAPI backend) re-applies post-generation
guards on whatever this service returns.

Endpoints:
  GET  /health    -> liveness + model/KB status
  POST /rag/chat  -> {text, model, sources}

Env:
  MODEL_ID     Hugging Face model id (default Qwen/Qwen2.5-0.5B-Instruct)
  KB_PATH      path to kb.json (default: ./kb.json bundled in this Space)
  KB_TOP_K     retrieved passages per query (default 4)
  RAG_PRELOAD  "1" (default) preloads the model in a background thread at boot
  MAX_NEW_TOKENS_CAP  server-side cap on generated tokens (default 300)
"""
from __future__ import annotations

import os
import re
import threading
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from rag_core import build_index, format_context, load_kb, source_refs

MODEL_ID = os.environ.get("MODEL_ID", "Qwen/Qwen2.5-0.5B-Instruct")
KB_PATH = Path(os.environ.get("KB_PATH", str(Path(__file__).with_name("kb.json"))))
TOP_K = int(os.environ.get("KB_TOP_K", "4"))
MAX_NEW_TOKENS_CAP = int(os.environ.get("MAX_NEW_TOKENS_CAP", "300"))
PRELOAD = os.environ.get("RAG_PRELOAD", "1").lower() not in ("0", "false", "no")

app = FastAPI(title="Earth Pulse RAG", version="1.0.0")

# ---------------------------------------------------------------- knowledge base
_kb_error: str | None = None
try:
    _kb = load_kb(KB_PATH)
    _index = build_index(_kb)
except Exception as exc:  # keep the container alive so /health can report the problem
    _kb, _index, _kb_error = None, None, str(exc)

# --------------------------------------------------------------------- model
_model = None
_tokenizer = None
_load_error: str | None = None
_load_lock = threading.Lock()
_gen_lock = threading.Lock()


def _load_model():
    global _model, _tokenizer, _load_error
    with _load_lock:
        if _model is not None or _load_error is not None:
            return
        try:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer

            tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
            model = AutoModelForCausalLM.from_pretrained(
                MODEL_ID,
                torch_dtype=torch.float32,
                low_cpu_mem_usage=True,
            )
            model.eval()
            _tokenizer, _model = tokenizer, model
        except Exception as exc:  # surfaced via /health and 503 on /rag/chat
            _load_error = f"{type(exc).__name__}: {exc}"


if PRELOAD:
    threading.Thread(target=_load_model, daemon=True, name="model-preload").start()

SYSTEM_PROMPT = """You are Earth Pulse, a careful climate-data interpreter embedded in a NASA satellite trend explorer.
Two sources of truth are provided below:
- FACTS SUMMARY: the only source of NUMBERS. Use numbers only from it. Never invent, round inconsistently, or alter a number.
- CONTEXT: retrieved background passages. Use them for general/domain questions. Cite them inline as [S1], [S2] ... when you use them. If CONTEXT and FACTS disagree, FACTS win.
STRICT RULES:
1. Forecast values are TOTAL NET CHANGE over the whole horizon, NOT per decade. Never call them per-decade rates.
2. A p-value measures trend significance only. NEVER turn it into a confidence percentage, a certainty level, or '100%'. Forecasts have p10-p90 uncertainty and are not certain futures.
3. If a trend is NOT statistically significant, say no statistically significant trend can be confirmed. Never call it warming/cooling certainty.
4. If a parameter is unavailable, say so; never fill gaps with numbers.
5. If data is synthetic, say it is synthetic demo data.
6. Answer in at most 3 short sentences of plain language (no bullet lists, no parameter-by-parameter dump). Focus on the user's case-file variable and at most one other parameter.
7. Call forecast numbers 'forecast net change', never 'trend'.
8. p-values are NOT a confidence percentage or certainty level. A non-significant trend means the data cannot confirm a trend at the 0.05 threshold, not that no change occurred."""


class ChatTurn(BaseModel):
    role: str = "user"
    content: str = ""


class RagChatRequest(BaseModel):
    messages: list[ChatTurn] = Field(default_factory=list)
    facts_summary: str = ""
    card_kind: str = "finding"
    language: str = "en"
    max_new_tokens: int = 170


def _last_user_query(messages: list[ChatTurn]) -> str:
    for turn in reversed(messages):
        if turn.role == "user" and turn.content.strip():
            return turn.content.strip()
    return messages[-1].content.strip() if messages else "Summarise this place."


def _build_prompt(req: RagChatRequest) -> tuple[list[dict], list[dict]]:
    query = _last_user_query(req.messages)
    chunks = (
        _index.retrieve(query, TOP_K) if _index is not None else []
    )
    # Citation ids must match what the model sees in the CONTEXT block.
    context = (
        format_context(chunks)
        if chunks
        else "No relevant passages retrieved; answer from FACTS SUMMARY only."
    )
    system = (
        SYSTEM_PROMPT
        + ("\nAnswer in the same language as the user's question." if req.language == "auto" else "")
        + f"\n\nFACTS SUMMARY:\n{req.facts_summary[:6000]}"
        + f"\n\nCONTEXT:\n{context}"
    )
    chat = [{"role": "system", "content": system}]
    for turn in req.messages[-11:]:
        role, content = turn.role, turn.content[:4000]
        if role in ("user", "assistant") and content.strip():
            chat.append({"role": role, "content": content})
    return chat, chunks


def _render_prompt(tokenizer, chat: list[dict]) -> str:
    if getattr(tokenizer, "chat_template", None):
        return tokenizer.apply_chat_template(
            chat, tokenize=False, add_generation_prompt=True
        )
    lines = []
    for turn in chat:
        label = {"system": "System", "user": "User", "assistant": "Assistant"}.get(
            turn["role"], turn["role"].title()
        )
        lines.append(f"{label}: {turn['content']}")
    lines.append("Assistant:")
    return "\n\n".join(lines)


@app.get("/health")
def health():
    return {
        "status": "ok" if _kb_error is None else "degraded",
        "service": "earth-pulse-rag",
        "model": MODEL_ID,
        "model_loaded": _model is not None,
        "load_error": _load_error,
        "kb_path": str(KB_PATH),
        "kb_chunks": len(_kb["chunks"]) if _kb else 0,
        "kb_error": _kb_error,
        "top_k": TOP_K,
        "time": int(time.time()),
    }


@app.post("/rag/chat")
def rag_chat(req: RagChatRequest):
    if _index is None:
        raise HTTPException(503, detail=f"knowledge base unavailable: {_kb_error}")
    _load_model()
    if _model is None or _tokenizer is None:
        raise HTTPException(503, detail=f"model unavailable: {_load_error}")

    chat, chunks = _build_prompt(req)
    prompt = _render_prompt(_tokenizer, chat)
    max_new = max(32, min(int(req.max_new_tokens), MAX_NEW_TOKENS_CAP))

    inputs = _tokenizer(prompt, return_tensors="pt")
    with _gen_lock:  # one generation at a time — free CPU has 2 vCPUs
        import torch

        with torch.no_grad():
            output = _model.generate(
                **inputs,
                max_new_tokens=max_new,
                do_sample=False,
                num_beams=1,
                pad_token_id=_tokenizer.eos_token_id,
            )
    new_tokens = output[0][inputs["input_ids"].shape[1]:]
    text = _tokenizer.decode(new_tokens, skip_special_tokens=True).strip()
    if not text:
        raise HTTPException(503, detail="model returned an empty answer")
    return JSONResponse(
        {
            "text": text,
            "model": MODEL_ID,
            "card_kind": req.card_kind,
            "sources": source_refs(chunks),
        }
    )
