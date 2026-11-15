"""Build the RAG knowledge base (`data/rag/kb.json`).

Corpus = repo docs (how Earth Pulse works, data sources, limitations) +
curated domain notes (`docs/rag-corpus/`) + chunks derived from the active
data store / precomputed analysis (coverage, provenance, grid, twins,
opposite pairs). No raw time series are embedded — only summaries.

Pure stdlib; safe to run offline. Invoked by `scripts/build_rag_kb.py`.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

MD_SOURCES: list[str] = [
    "README.md",
    "docs/api-contract.md",
    "docs/architecture.md",
    "docs/data-sources.md",
    "docs/deploy.md",
    "docs/highres-belgaum.md",
    "docs/limitations.md",
    "docs/ml.md",
    "docs/power-real-store.md",
    "docs/real-data-ingestion.md",
    "docs/VERIFICATION.md",
    "docs/colab-scenario.md",
    "docs/scenario-images.md",
    "docs/rag-corpus/nasa-power-primer.md",
    "docs/rag-corpus/earth-pulse-method.md",
]

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
_SENT_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")
MAX_CHUNK_CHARS = 900
MIN_CHUNK_CHARS = 80


def _slug(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "chunk"


def _split_sentences(paragraph: str) -> list[str]:
    return [s for s in _SENT_SPLIT_RE.split(paragraph.strip()) if s]


def _emit_paragraph_chunks(buf: list[str], size: int) -> list[str]:
    """Split an over-long paragraph into <=MAX_CHUNK_CHARS sentence groups."""
    pieces: list[str] = []
    current = ""
    for sentence in _split_sentences("\n\n".join(buf)):
        if len(current) + len(sentence) + 1 <= MAX_CHUNK_CHARS:
            current = f"{current} {sentence}".strip()
        else:
            if current:
                pieces.append(current)
            current = sentence
    if current:
        pieces.append(current)
    return [p for p in pieces if p]


def chunk_markdown(text: str, source: str) -> list[dict]:
    """Heading-aware chunking: heading -> title; paragraphs accumulate to ~900 chars."""
    chunks: list[dict] = []
    current_heading = source
    paragraphs: list[str] = []
    buf: list[str] = []
    buf_len = 0

    def flush() -> None:
        nonlocal buf, buf_len, paragraphs
        if not buf:
            return
        body = "\n".join(p.strip() for p in buf if p.strip()).strip()
        buf, buf_len = [], 0
        if len(body) < MIN_CHUNK_CHARS and paragraphs:
            # Tiny tail of a section: merge into the previous chunk.
            if chunks and chunks[-1]["source"] == source:
                merged = (chunks[-1]["text"] + "\n" + body).strip()
                chunks[-1]["text"] = merged
                return
        chunks.append({"source": source, "heading": current_heading, "text": body})
        paragraphs.append(body)

    pending_sections: list[str] = []

    for line in text.splitlines():
        heading = _HEADING_RE.match(line)
        if heading:
            flush()
            current_heading = heading.group(2).strip()
            pending_sections.append(current_heading)
            continue
        if line.strip() == "":
            if buf:
                flush()
            continue
        if len(line.strip()) + buf_len > MAX_CHUNK_CHARS and buf:
            flush()
        buf.append(line)
        buf_len += len(line) + 1
    flush()

    out: list[dict] = []
    counters: dict[str, int] = {}
    for chunk in chunks:
        pieces = (
            [chunk["text"]]
            if len(chunk["text"]) <= MAX_CHUNK_CHARS
            else _emit_paragraph_chunks([chunk["text"]], MAX_CHUNK_CHARS)
        )
        for piece in pieces:
            base = f"{_slug(Path(source).with_suffix('').as_posix())}-{_slug(chunk['heading'])[:48]}"
            counters[base] = counters.get(base, 0) + 1
            idx = counters[base]
            chunk_id = base if idx == 1 else f"{base}-{idx}"
            heading = chunk["heading"]
            text = piece if piece.lower().startswith(heading.lower()[:24]) else f"{heading}\n{piece}"
            out.append(
                {
                    "id": chunk_id,
                    "title": heading,
                    "source": source,
                    "topic": _slug(Path(source).with_suffix("").as_posix()),
                    "text": text,
                }
            )
    return out


def _store_info() -> dict:
    """Best-effort store metadata for the derived chunks (never fatal)."""
    try:
        from api.deps import store_info
        return store_info()
    except Exception:
        return {}


def _analysis_chunks() -> list[dict]:
    chunks: list[dict] = []
    meta = _store_info()
    analysis_path = REPO_ROOT / "data" / "processed" / "analysis_power_real.json"
    if not analysis_path.exists():
        analysis_path = REPO_ROOT / "data" / "processed" / "analysis.json"
    if not analysis_path.exists():
        return chunks
    try:
        analysis = json.loads(analysis_path.read_text())
    except json.JSONDecodeError:
        return chunks

    synthetic = bool(analysis.get("synthetic_demo"))
    trange = analysis.get("time_range", ["?", "?"])
    grid = analysis.get("grid", {})
    lats = grid.get("lats", [])
    lons = grid.get("lons", [])
    provenance = (meta.get("provenance") if meta else None) or analysis.get("source") \
        or (analysis.get("store") if isinstance(analysis.get("store"), str) else None) \
        or "unknown"
    n_months = analysis.get("n_months") or meta.get("n_months")
    data_kind = (
        "Real NASA POWER satellite+model agroclimatology (community=RE, metric). "
        "Temperature, precipitation, solar radiation, humidity and wind are real "
        "1981-present values. NDVI, SST and sea level are NOT available from POWER "
        "and are intentionally reported as unavailable — never faked."
        if not synthetic
        else "Deterministic synthetic demo store — trends are baked in for "
        "illustration; it is NOT measured climate data."
    )
    chunks.append(
        {
            "id": "store-analysis-overview",
            "title": "Earth Pulse active data store",
            "source": "analysis:processed/analysis_power_real.json",
            "topic": "data-store",
            "boost": 1.25,
            "text": (
                f"Earth Pulse active data store: provenance={provenance}. "
                f"synthetic_demo={synthetic}. Coverage {trange[0]} to {trange[1]} "
                f"({n_months} months). Grid: {len(lats)} latitudes x {len(lons)} "
                f"longitudes = {grid.get('n_cells', len(lats) * len(lons))} cells "
                "(illustrative 15-degree coarse grid; click points snap to the "
                "nearest cell). " + data_kind
            ),
        }
    )

    trends = analysis.get("trends") or {}
    summaries = []
    for param, cells in sorted(trends.items()):
        usable = sum(1 for rec in cells.values() if int(rec.get("n", 0) or 0) >= 12)
        significant = sum(1 for rec in cells.values() if rec.get("significant"))
        slopes = [float(rec.get("slope_per_decade", 0.0)) for rec in cells.values()
                  if int(rec.get("n", 0) or 0) >= 12]
        if slopes:
            up = sum(1 for s in slopes if s > 0)
            down = sum(1 for s in slopes if s < 0)
            direction = f"{up} cells rising, {down} falling (of those usable)"
        else:
            direction = "no usable cells"
        summaries.append(
            f"{param}: usable in {usable}/{len(cells)} cells, {significant} cells with a "
            f"statistically significant Mann–Kendall trend, {direction}."
        )
    if summaries:
        chunks.append(
            {
                "id": "store-trend-coverage",
                "title": "Per-parameter trend coverage across the grid",
                "source": "analysis:processed/analysis_power_real.json",
                "topic": "data-store",
                "boost": 1.25,
                "text": "Precomputed Theil–Sen/Mann–Kendall coverage per parameter: "
                + " ".join(summaries),
            }
        )

    twins = analysis.get("climate_twins") or {}
    if twins:
        chunks.append(
            {
                "id": "store-climate-twins",
                "title": "Climate twin clustering",
                "source": "analysis:processed/analysis_power_real.json",
                "topic": "data-store",
                "boost": 1.25,
                "text": (
                    f"Earth Pulse clusters grid cells with K-Means (k={twins.get('k')}) over "
                    f"z-scored features: {', '.join(twins.get('features', []))}. "
                    "Clusters are a didactic similarity view, not a recognized climate "
                    "classification. Treat twins as hypotheses; check per-cell coverage first."
                ),
            }
        )

    opposite = analysis.get("opposite_trends") or {}
    if opposite:
        counts = {p: len(v) for p, v in opposite.items()}
        chunks.append(
            {
                "id": "store-opposite-trends",
                "title": "Opposite-trend pairs detected",
                "source": "analysis:processed/analysis_power_real.json",
                "topic": "data-store",
                "boost": 1.25,
                "text": (
                    "Neighbouring cell pairs with opposite-sign slopes (precomputed): "
                    + ", ".join(f"{p}: {n} pairs" for p, n in sorted(counts.items()))
                    + ". Opposite trends are statistical dipoles, not causal evidence; "
                    "inspect land use, irrigation, orography and microclimate locally."
                ),
            }
        )
    return chunks


def build_kb() -> dict:
    chunks: list[dict] = []
    sources: list[str] = []
    for rel in MD_SOURCES:
        path = REPO_ROOT / rel
        if not path.exists():
            continue
        text = path.read_text(errors="ignore")
        added = chunk_markdown(text, rel)
        chunks.extend(added)
        if added:
            sources.append(rel)
    derived = _analysis_chunks()
    chunks.extend(derived)
    sources.extend(sorted({c["source"] for c in derived}))

    seen: set[str] = set()
    unique: list[dict] = []
    for chunk in chunks:
        if chunk["id"] in seen:
            continue
        seen.add(chunk["id"])
        unique.append(chunk)

    return {
        "version": "1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "generator": "scripts/build_rag_kb.py",
        "sources": sources,
        "chunks": unique,
    }
