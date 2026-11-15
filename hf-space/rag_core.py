"""Shared retrieval core for the Earth Pulse RAG service.

This module is dependency-free (pure Python BM25) so it can be imported by the
FastAPI backend for KB stats and copied verbatim into the Hugging Face Space
(`hf-space/rag_core.py`) where retrieval actually runs. Keep the two copies in
sync — `scripts/build_rag_kb.py` does this automatically with `--sync-space`.
"""
from __future__ import annotations

import json
import math
import re
from pathlib import Path

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_K1 = 1.5
_B = 0.75


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

def tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall((text or "").lower())


def load_kb(path: str | Path) -> dict:
    kb_path = Path(path)
    data = json.loads(kb_path.read_text())
    chunks = data.get("chunks") or []
    if not chunks:
        raise ValueError(f"RAG knowledge base at {kb_path} has no chunks")
    return data


class BM25Index:
    """Small, self-contained BM25 index over the KB chunks."""

    def __init__(self, chunks: list[dict]):
        self.chunks = list(chunks)
        self.boosts = [float(c.get("boost", 1.0) or 1.0) for c in self.chunks]
        self.doc_tokens: list[list[str]] = [tokenize(c.get("text", "")) for c in self.chunks]
        self.doc_len = [len(t) for t in self.doc_tokens]
        self.avg_len = (sum(self.doc_len) / len(self.doc_len)) if self.doc_len else 0.0
        self.df: dict[str, int] = {}
        for tokens in self.doc_tokens:
            for term in set(tokens):
                self.df[term] = self.df.get(term, 0) + 1
        self.n_docs = len(self.chunks)

    def _idf(self, term: str) -> float:
        df = self.df.get(term, 0)
        # Robertson/Spärck Jones IDF, floored at a small positive value so
        # common terms do not go negative.
        return math.log(1.0 + (self.n_docs - df + 0.5) / (df + 0.5))

    def score_doc(self, query_terms: list[str], doc_index: int) -> float:
        if not query_terms:
            return 0.0
        tokens = self.doc_tokens[doc_index]
        if not tokens:
            return 0.0
        freqs: dict[str, int] = {}
        for token in tokens:
            freqs[token] = freqs.get(token, 0) + 1
        score = 0.0
        norm = _K1 * (1.0 - _B + _B * (self.doc_len[doc_index] / (self.avg_len or 1.0)))
        for term in query_terms:
            f = freqs.get(term)
            if not f:
                continue
            score += self._idf(term) * (f * (_K1 + 1.0)) / (f + norm)
        return score

    def retrieve(self, query: str, k: int = 4) -> list[dict]:
        terms = tokenize(query)
        scored = [
            (self.score_doc(terms, i) * self.boosts[i], i)
            for i in range(self.n_docs)
        ]
        scored.sort(key=lambda item: (-item[0], item[1]))
        results = []
        for score, i in scored:
            if score <= 0.0 and results:
                break
            chunk = dict(self.chunks[i])
            chunk["score"] = round(score, 4)
            results.append(chunk)
            if len(results) >= k:
                break
        return results


def build_index(kb: dict) -> BM25Index:
    return BM25Index(kb.get("chunks") or [])


NO_CONTEXT = "No relevant passages retrieved; answer from FACTS SUMMARY only."


def render_context(chunks: list[dict]) -> str:
    return format_context(chunks) if chunks else NO_CONTEXT


def build_system_prompt(facts_summary: str, context_text: str, language: str = "en") -> str:
    system = SYSTEM_PROMPT
    if language == "auto":
        system += "\nAnswer in the same language as the user's question."
    system += (
        f"\n\nFACTS SUMMARY:\n{(facts_summary or '')[:6000]}"
        f"\n\nCONTEXT:\n{context_text}"
    )
    return system


def format_context(chunks: list[dict]) -> str:
    """Numbered context block for the prompt: [S1] <title> — <text>."""
    lines = []
    for i, chunk in enumerate(chunks, start=1):
        title = chunk.get("title") or chunk.get("id") or f"Chunk {i}"
        source = chunk.get("source") or "knowledge-base"
        text = " ".join(str(chunk.get("text", "")).split())
        lines.append(f"[S{i}] {title} ({source}): {text}")
    return "\n".join(lines)


def source_refs(chunks: list[dict]) -> list[dict]:
    refs = []
    for i, chunk in enumerate(chunks, start=1):
        refs.append(
            {
                "id": f"S{i}",
                "chunk_id": chunk.get("id"),
                "title": chunk.get("title") or chunk.get("id") or f"Chunk {i}",
                "source": chunk.get("source") or "knowledge-base",
                "score": chunk.get("score"),
            }
        )
    return refs
