"""RAG client for POST /chat.

The retrieval + generation run on the Hugging Face Space (a self-contained
FastAPI service under `hf-space/`, default model Qwen2.5-0.5B-Instruct on free
CPU). The local backend stays facts-locked: it builds the FACTS SUMMARY, hands
the Space only (messages, facts_summary, card_kind, language), then re-applies
the same post-generation guards used for Ollama before returning anything.

Environment:
  EP_RAG_BACKEND   "ollama" (default) | "hf" | "templated"
                   "hf" = try the HF RAG Space first, then fall back to
                   Ollama, then to deterministic templated prose.
  HF_RAG_SPACE_URL Base URL of the Space, e.g. https://<user>-earth-pulse-rag.hf.space
                   (or a local http://localhost:7860 while testing).
  HF_TOKEN         Optional bearer token if the Space is private.
  EP_RAG_TIMEOUT   Seconds before giving up on the Space (default 90).
  EP_RAG_KB_PATH   Local copy of the KB for /health stats only
                   (default <repo>/data/rag/kb.json). Retrieval happens remotely.
  EP_RAG_TOP_K     Chunks the Space retrieves (informational; enforced Space-side).
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path

from api.services import rag_core

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
KB_PATH = Path(os.environ.get("EP_RAG_KB_PATH", str(REPO_ROOT / "data" / "rag" / "kb.json")))


def rag_backend() -> str:
    return os.environ.get("EP_RAG_BACKEND", "ollama").strip().lower()


def rag_enabled() -> bool:
    return rag_backend() == "hf"


def _space_url() -> str | None:
    url = (os.environ.get("HF_RAG_SPACE_URL") or "").strip().rstrip("/")
    return url or None


def _timeout() -> float:
    try:
        return float(os.environ.get("EP_RAG_TIMEOUT", "90"))
    except ValueError:
        return 90.0


def kb_stats() -> dict:
    """Cheap, honest stats about the local KB copy (for /health)."""
    try:
        kb = rag_core.load_kb(KB_PATH)
        return {"kb_path": str(KB_PATH), "kb_chunks": len(kb.get("chunks") or []),
                "kb_version": kb.get("version")}
    except Exception as exc:
        return {"kb_path": str(KB_PATH), "kb_chunks": 0, "kb_error": str(exc)}


def rag_status() -> dict:
    url = _space_url()
    status = {
        "backend": "hf-rag" if rag_enabled() else "off",
        "enabled": rag_enabled(),
        "space_url": url,
        "timeout_s": _timeout(),
        "top_k": int(os.environ.get("EP_RAG_TOP_K", "4") or 4),
        "note": (
            "Retrieval + generation run on the Hugging Face Space; backend re-applies fact guards."
            if rag_enabled()
            else "EP_RAG_BACKEND is not 'hf'; chat uses Ollama/templated only."
        ),
    }
    status.update(kb_stats())
    return status


def rag_chat(messages: list[dict], facts_summary: str, card_kind: str,
             language: str = "en", max_new_tokens: int = 170) -> dict | None:
    """Call the HF Space /rag/chat. Returns {text, model, sources} or None."""
    url = _space_url()
    if not url:
        return None
    safe_messages = [
        {"role": m.get("role", "user"), "content": str(m.get("content", ""))[:4000]}
        for m in list(messages or [])[-12:]
        if m.get("role") in ("user", "assistant", "system") and m.get("content")
    ]
    if not safe_messages:
        safe_messages = [{"role": "user", "content": "Summarise this place."}]
    body = json.dumps({
        "messages": safe_messages,
        "facts_summary": (facts_summary or "")[:6000],
        "card_kind": card_kind,
        "language": language or "en",
        "max_new_tokens": max(32, min(int(max_new_tokens), 300)),
    }).encode()
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    token = (os.environ.get("HF_TOKEN") or "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{url}/rag/chat", data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=_timeout()) as resp:
            data = json.loads(resp.read().decode())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None
    text = (data.get("text") or "").strip()
    if not text:
        return None
    sources = data.get("sources") if isinstance(data.get("sources"), list) else []
    return {
        "text": text,
        "model": data.get("model") or "hf-space",
        "sources": sources[:8],
    }
