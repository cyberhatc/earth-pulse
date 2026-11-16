"""RAG client for POST /chat.

Two backends, both re-feeding into the same fact guards in `explainer`:

- **hf-router** (default once enabled): retrieval runs LOCALLY over the bundled
  BM25 knowledge base; generation runs on HF's serverless inference router
  (router.huggingface.co/v1/chat/completions, OpenAI-compatible). Needs
  HF_TOKEN with the "Make calls to Inference Providers" permission; consumes
  the account's monthly free inference credit. No servers, $0 hosting.

- **hf**: retrieval + generation run on the Hugging Face Space in
  HF_RAG_SPACE_URL (Docker Space — requires an HF PRO subscription for free
  cpu-basic). Kept for when PRO is available.

Environment (os.environ wins; the repo `.env` is a fallback because the app
itself does not load dotenv):
  EP_RAG_BACKEND   "ollama" (default) | "hf-router" | "hf" | "templated"
  HF_TOKEN         Bearer token (hf-router required; optional for a private Space)
  HF_ROUTER_MODEL  Model served via the router (default meta-llama/Llama-3.1-8B-Instruct)
  HF_RAG_SPACE_URL Space base URL (required when backend=hf)
  EP_RAG_TIMEOUT   Seconds before giving up (default 90)
  EP_RAG_KB_PATH   KB used for local retrieval (default data/rag/kb.json)
  EP_RAG_TOP_K     Chunks retrieved (default 4)
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from functools import lru_cache
from pathlib import Path

from api.services import rag_core

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

ROUTER_URL = "https://router.huggingface.co/v1/chat/completions"


# --------------------------------------------------------------------------- env
@lru_cache(maxsize=1)
def _file_env() -> dict[str, str]:
    """Parse the repo .env once (the app never loads dotenv itself)."""
    values: dict[str, str] = {}
    try:
        for raw in (REPO_ROOT / ".env").read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip().strip('"').strip("'")
    except OSError:
        pass
    return values


def _env(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        value = _file_env().get(name)
    if value is None or value.strip() == "":
        return default
    return value.strip()


def rag_backend() -> str:
    return (_env("EP_RAG_BACKEND", "ollama") or "ollama").lower()


def rag_enabled() -> bool:
    return rag_backend() in ("hf", "hf-router")


def space_enabled() -> bool:
    return rag_backend() == "hf"


def router_enabled() -> bool:
    return rag_backend() == "hf-router"


def top_k() -> int:
    try:
        return max(1, int(_env("EP_RAG_TOP_K", "4") or 4))
    except ValueError:
        return 4


def _timeout() -> float:
    try:
        return float(_env("EP_RAG_TIMEOUT", "90") or 90)
    except ValueError:
        return 90.0


def _token() -> str | None:
    return _env("HF_TOKEN")


def _space_url() -> str | None:
    url = _env("HF_RAG_SPACE_URL")
    return url.rstrip("/") if url else None


def router_model() -> str:
    return _env("HF_ROUTER_MODEL", "meta-llama/Llama-3.1-8B-Instruct") or "meta-llama/Llama-3.1-8B-Instruct"


def kb_path() -> Path:
    return Path(_env("EP_RAG_KB_PATH", str(REPO_ROOT / "data" / "rag" / "kb.json")) or "")


# ------------------------------------------------------------------ knowledge base
@lru_cache(maxsize=4)
def _index(path_str: str, mtime_ns: int) -> rag_core.BM25Index:
    return rag_core.build_index(rag_core.load_kb(path_str))


def _retrieve(query: str, k: int | None = None) -> list[dict]:
    path = kb_path()
    try:
        mtime = path.stat().st_mtime_ns
        index = _index(str(path), mtime)
    except Exception:
        return []
    return index.retrieve(query, k or top_k())


def kb_stats() -> dict:
    """Cheap, honest stats about the local KB copy (for /health)."""
    path = kb_path()
    try:
        kb = rag_core.load_kb(path)
        return {"kb_path": str(path), "kb_chunks": len(kb.get("chunks") or []),
                "kb_version": kb.get("version")}
    except Exception as exc:
        return {"kb_path": str(path), "kb_chunks": 0, "kb_error": str(exc)}


def rag_status() -> dict:
    backend = rag_backend()
    if backend == "hf-router":
        status = {
            "backend": "hf-router",
            "enabled": True,
            "model": router_model(),
            "router_url": "router.huggingface.co",
            "timeout_s": _timeout(),
            "top_k": top_k(),
            "token_configured": bool(_token()),
            "note": (
                "Retrieval runs locally (BM25); generation via HF serverless "
                "inference (monthly free credit). Backend re-applies fact guards."
            ),
        }
        status.update(kb_stats())
        return status
    if backend == "hf":
        status = {
            "backend": "hf-rag",
            "enabled": True,
            "space_url": _space_url(),
            "timeout_s": _timeout(),
            "top_k": top_k(),
            "note": (
                "Retrieval + generation run on the Hugging Face Space; "
                "backend re-applies fact guards."
            ),
        }
        status.update(kb_stats())
        return status
    status = {
        "backend": "off",
        "enabled": False,
        "note": "EP_RAG_BACKEND is not 'hf-router'/'hf'; chat uses Ollama/templated only.",
    }
    status.update(kb_stats())
    return status


# ---------------------------------------------------------------------- helpers
def _post_json(url: str, payload: dict, headers: dict, timeout: float) -> dict:
    """POST JSON and return the decoded body. Raises on transport/HTTP errors."""
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def _safe_messages(messages: list[dict]) -> list[dict]:
    safe = [
        {"role": m.get("role", "user"), "content": str(m.get("content", ""))[:4000]}
        for m in list(messages or [])[-12:]
        if m.get("role") in ("user", "assistant", "system") and m.get("content")
    ]
    return safe or [{"role": "user", "content": "Summarise this place."}]


def _last_user_query(messages: list[dict]) -> str:
    for turn in reversed(messages):
        if turn.get("role") == "user" and str(turn.get("content", "")).strip():
            return str(turn["content"]).strip()
    return messages[-1]["content"] if messages else "Summarise this place."


# ------------------------------------------------------------------ hf-router
def router_chat(messages: list[dict], facts_summary: str, card_kind: str,
                language: str = "en", max_new_tokens: int = 170) -> dict | None:
    """Local retrieval + HF serverless generation. Returns {text, model, sources} or None."""
    token = _token()
    if not token:
        return None
    safe = _safe_messages(messages)
    query = _last_user_query(safe)
    chunks = _retrieve(query, top_k())
    context = rag_core.render_context(chunks)
    system = rag_core.build_system_prompt(facts_summary, context, language)
    model = router_model()
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system}, *safe],
        "max_tokens": max(32, min(int(max_new_tokens), 300)),
        "temperature": 0.2,
        "stream": False,
    }
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": f"Bearer {token}",
    }
    try:
        data = _post_json(ROUTER_URL, payload, headers, _timeout())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None
    choices = data.get("choices") or []
    text = ""
    if choices and isinstance(choices[0], dict):
        text = str((choices[0].get("message") or {}).get("content") or "").strip()
    if not text:
        return None
    return {"text": text, "model": model, "sources": rag_core.source_refs(chunks)}


# ------------------------------------------------------------------------ hf
def rag_chat(messages: list[dict], facts_summary: str, card_kind: str,
             language: str = "en", max_new_tokens: int = 170) -> dict | None:
    """Call the HF Space /rag/chat. Returns {text, model, sources} or None."""
    url = _space_url()
    if not url:
        return None
    safe = _safe_messages(messages)
    payload = {
        "messages": safe,
        "facts_summary": (facts_summary or "")[:6000],
        "card_kind": card_kind,
        "language": language or "en",
        "max_new_tokens": max(32, min(int(max_new_tokens), 300)),
    }
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    token = _token()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        data = _post_json(f"{url}/rag/chat", payload, headers, _timeout())
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
