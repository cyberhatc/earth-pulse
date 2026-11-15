"""RAG pipeline tests: KB build, BM25 retrieval, backend wiring, guard integration.

Runs fully offline — the HF Space is monkeypatched; no model is downloaded.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from api.services import explainer, rag, rag_core  # noqa: E402
from api.services.rag_kb import build_kb  # noqa: E402


@pytest.fixture(scope="module")
def kb() -> dict:
    built = build_kb()
    assert built["chunks"], "KB build produced no chunks"
    return built


def test_kb_builds_with_unique_ids(kb):
    ids = [c["id"] for c in kb["chunks"]]
    assert len(ids) == len(set(ids)), "duplicate chunk ids"
    assert len(kb["chunks"]) >= 100
    sources = " ".join(kb["sources"])
    for expected in ("docs/limitations.md", "docs/rag-corpus/nasa-power-primer.md",
                     "docs/rag-corpus/earth-pulse-method.md"):
        assert expected in sources


def test_retrieval_prefers_relevant_doc(kb):
    index = rag_core.build_index(kb)
    hits = index.retrieve("Mann-Kendall p-value is not a certainty level", 3)
    assert hits, "retriever returned nothing"
    assert any("earth-pulse-method" in h["source"] or "ml.md" in h["source"]
               for h in hits)


def test_retrieval_finds_data_store_chunk(kb):
    index = rag_core.build_index(kb)
    hits = index.retrieve("provenance of the active store and what is unavailable", 5)
    assert any(h["source"].startswith("analysis:") or "power-real-store" in h["source"]
               for h in hits)


def test_format_context_has_citation_markers(kb):
    index = rag_core.build_index(kb)
    hits = index.retrieve("forecast band", 2)
    ctx = rag_core.format_context(hits)
    assert "[S1]" in ctx and "[S2]" in ctx
    refs = rag_core.source_refs(hits)
    assert [r["id"] for r in refs] == ["S1", "S2"]


class FakeSpace:
    """Stand-in for the HF Space used by rag.rag_chat."""

    def __init__(self, text: str):
        self.text = text
        self.calls: list[dict] = []

    def __call__(self, messages, facts_summary, card_kind, language, max_new_tokens=170):
        self.calls.append({"facts_summary": facts_summary, "card_kind": card_kind})
        return {"text": self.text, "model": "test-space", "sources": [
            {"id": "S1", "title": "Earth Pulse methodology",
             "source": "docs/rag-corpus/earth-pulse-method.md"}]}


def _facts():
    """Minimal facts dict matching what /chat assembles for California Coast."""
    return {
        "lat": 34.0, "lon": -120.0, "region_name": "California Coast",
        "variable": "Precipitation", "grid_lat": 30.0, "grid_lon": -120.0,
        "cell_index": 0, "time_range": ["1981-01", "2026-11"],
        "trends": {
            "precipitation": {"slope_per_decade": -1.5, "p_value": 0.04,
                              "significant": True, "direction": "decreasing",
                              "n": 549},
            "temperature": {"slope_per_decade": 0.21, "p_value": 0.01,
                            "significant": True, "direction": "increasing",
                            "n": 549},
        },
        "forecast_deltas": {"precipitation": -3.2},
        "forecast_model": "ridge_rollout",
        "forecast_window": ["2026-12", "2031-11"],
        "horizon_months": 60,
        "anomalies_count": 2, "anomaly_samples": [],
        "opposite_count": 0, "opposite_pairs": [],
        "climate_twin": {"cluster_id": 3, "k": 8, "features": ["temperature"]},
        "synthetic": False, "ocean_cell": None,
        "parameters_used": ["temperature", "precipitation"],
        "parameters_unavailable": ["ndvi"],
        "sources": {"temperature": "NASA POWER"},
        "gap_notes": [],
    }


def _safe_messages():
    return [{"role": "user", "content": "Is the precipitation trend significant?"}]


def test_hf_backend_passes_guards_and_carries_sources(monkeypatch):
    monkeypatch.setenv("EP_RAG_BACKEND", "hf")
    fake = FakeSpace("Precipitation is decreasing at -1.5 mm/month per decade, "
                     "which is statistically significant (p=0.04). [S1]")
    monkeypatch.setattr(rag, "rag_chat", fake)
    out = explainer.chat(_safe_messages(), _facts())
    assert out["generator"] == "hf-rag"
    assert out["model"] == "test-space"
    assert out["sources"] and out["sources"][0]["id"] == "S1"
    assert fake.calls and "California Coast" in fake.calls[0]["facts_summary"]


def test_hf_backend_unsafe_answer_is_guard_rejected(monkeypatch):
    monkeypatch.setenv("EP_RAG_BACKEND", "hf")
    monkeypatch.setattr(rag, "rag_chat", FakeSpace(
        "We can say with 100% certainty the climate is changing here."))
    out = explainer.chat(_safe_messages(), _facts())
    assert out["generator"] == "templated-guard"
    assert out["guard_reason"] == "certainty_claim"


def test_hf_backend_unreachable_falls_back_to_ollama(monkeypatch):
    monkeypatch.setenv("EP_RAG_BACKEND", "hf")
    monkeypatch.setenv("EP_LLM_BACKEND", "templated")  # disable Ollama
    monkeypatch.setattr(rag, "rag_chat", lambda *a, **k: None)
    out = explainer.chat(_safe_messages(), _facts())
    assert out["generator"] == "templated"
    assert out["llm_available"] is False


def test_default_backend_is_untouched(monkeypatch):
    monkeypatch.delenv("EP_RAG_BACKEND", raising=False)
    monkeypatch.setenv("EP_LLM_BACKEND", "templated")
    out = explainer.chat(_safe_messages(), _facts())
    assert out["generator"] == "templated"
    assert out["sources"] == []


class FakeRouter:
    """Stand-in for the HF router POST (router.huggingface.co)."""

    def __init__(self, text: str):
        self.text = text
        self.payloads: list[dict] = []
        self.headers: list[dict] = []

    def __call__(self, url, payload, headers, timeout):
        assert url == rag.ROUTER_URL
        self.payloads.append(payload)
        self.headers.append(headers)
        return {"choices": [{"message": {"content": self.text}}]}


def test_router_backend_full_flow(monkeypatch):
    monkeypatch.setenv("EP_RAG_BACKEND", "hf-router")
    monkeypatch.setenv("HF_TOKEN", "test-token")
    fake = FakeRouter("Precipitation is decreasing at -1.5 mm/month per decade; "
                      "statistically significant (p=0.04). [S1]")
    monkeypatch.setattr(rag, "_post_json", fake)
    out = explainer.chat(_safe_messages(), _facts())
    assert out["generator"] == "hf-router"
    assert out["model"] == "meta-llama/Llama-3.1-8B-Instruct"
    assert out["sources"], "router path must carry retrieval sources"
    assert out["sources"][0]["id"] == "S1"
    assert out["sources"][0]["title"]
    system = fake.payloads[0]["messages"][0]["content"]
    assert "FACTS SUMMARY" in system and "CONTEXT" in system and "[S1]" in system
    assert fake.headers[0]["Authorization"] == "Bearer test-token"


def test_router_prompt_carries_retrieved_passages(monkeypatch):
    monkeypatch.setenv("EP_RAG_BACKEND", "hf-router")
    monkeypatch.setenv("HF_TOKEN", "test-token")
    fake = FakeRouter("Not significant. [S1]")
    monkeypatch.setattr(rag, "_post_json", fake)
    explainer.chat(
        [{"role": "user", "content": "What are the limitations of synthetic demo data?"}],
        _facts(),
    )
    system = fake.payloads[0]["messages"][0]["content"]
    assert "synthetic" in system.lower() or "limitations" in system.lower()


def test_router_unreachable_falls_back(monkeypatch):
    monkeypatch.setenv("EP_RAG_BACKEND", "hf-router")
    monkeypatch.setenv("EP_LLM_BACKEND", "templated")
    monkeypatch.setenv("HF_TOKEN", "test-token")
    def boom(*a, **k):
        raise OSError("connection refused")
    monkeypatch.setattr(rag, "_post_json", boom)
    out = explainer.chat(_safe_messages(), _facts())
    assert out["generator"] == "templated"
    assert out["llm_available"] is False


def test_router_unsafe_answer_is_guard_rejected(monkeypatch):
    monkeypatch.setenv("EP_RAG_BACKEND", "hf-router")
    monkeypatch.setenv("HF_TOKEN", "test-token")
    monkeypatch.setattr(rag, "_post_json", FakeRouter(
        "We can say with 100% certainty this is an emergency."))
    out = explainer.chat(_safe_messages(), _facts())
    assert out["generator"] == "templated-guard"
    assert out["guard_reason"] == "certainty_claim"


def test_router_requires_token(monkeypatch):
    monkeypatch.setenv("EP_RAG_BACKEND", "hf-router")
    monkeypatch.setenv("EP_LLM_BACKEND", "templated")
    monkeypatch.setattr(rag, "_file_env", lambda: {})
    monkeypatch.delenv("HF_TOKEN", raising=False)
    called = []
    monkeypatch.setattr(rag, "_post_json", lambda *a, **k: called.append(a) or {})
    out = explainer.chat(_safe_messages(), _facts())
    assert not called, "no HTTP call without a token"
    assert out["generator"] == "templated"


def test_router_status_block(monkeypatch):
    monkeypatch.setenv("EP_RAG_BACKEND", "hf-router")
    monkeypatch.setenv("HF_TOKEN", "test-token")
    monkeypatch.setenv("HF_ROUTER_MODEL", "Qwen/Qwen2.5-1.5B-Instruct")
    status = rag.rag_status()
    assert status["backend"] == "hf-router" and status["enabled"] is True
    assert status["model"] == "Qwen/Qwen2.5-1.5B-Instruct"
    assert status["kb_chunks"] >= 100 and status["token_configured"] is True


def test_health_reports_rag_block():
    os.environ["EP_RAG_BACKEND"] = "hf"  # read at call time; restore after
    os.environ["HF_RAG_SPACE_URL"] = "http://localhost:7860"
    try:
        status = rag.rag_status()
    finally:
        os.environ.pop("EP_RAG_BACKEND", None)
        os.environ.pop("HF_RAG_SPACE_URL", None)
    assert status["enabled"] is True
    assert status["backend"] == "hf-rag"
    assert status["kb_chunks"] >= 100
