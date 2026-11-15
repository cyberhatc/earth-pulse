"""Plain-English explainer.

The LLM never computes numbers — it receives a `facts` dict assembled from the
payload (trends, forecast deltas, anomaly count, opposite-trend count, coverage)
and only re-words them. `/chat` prefers a Hugging Face RAG backend when
EP_RAG_BACKEND=hf-router (local BM25 retrieval over the bundled knowledge base +
HF serverless inference) or EP_RAG_BACKEND=hf (a Space that does retrieval +
generation), then the local Ollama model; deterministic templated prose is used
when no LLM is available. Every LLM answer passes post-generation guards
(certainty claims, p-value/band misuse, false significance claims, unverified
numbers) before it is returned.
"""
from __future__ import annotations

import json
import os
import re
import time
import urllib.request

from api.services import rag

# Local LLM (Ollama) — the default narration backend.
# The model only re-words FACTS; it never computes or changes a number.
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:1.5b")
LLM_TIMEOUT = float(os.environ.get("EP_LLM_TIMEOUT", "90"))

_llm_probe_cache: tuple[float, dict] | None = None
_LLM_PROBE_TTL = 20.0


def _llm_backend() -> str:
    """EP_LLM_BACKEND read live (tests flip it via monkeypatch)."""
    return os.environ.get("EP_LLM_BACKEND", "ollama").strip().lower()


def llm_enabled() -> bool:
    return _llm_backend() not in ("off", "templated", "none", "false", "0")


def _ollama_tags() -> dict | None:
    try:
        with urllib.request.urlopen(f"{OLLAMA_BASE_URL}/api/tags", timeout=1.5) as resp:
            return json.loads(resp.read().decode())
    except Exception:
        return None


def llm_status(force: bool = False) -> dict:
    """Cheap, cached probe used by /health and the UI status badge."""
    global _llm_probe_cache
    if not llm_enabled():
        return {"backend": "templated", "available": False, "model": None,
                "base_url": None, "note": "EP_LLM_BACKEND disables the LLM"}
    now = time.time()
    if not force and _llm_probe_cache and now - _llm_probe_cache[0] < _LLM_PROBE_TTL:
        return _llm_probe_cache[1]
    tags = _ollama_tags()
    names = [m.get("name") for m in (tags or {}).get("models", []) if m.get("name")]
    model = _pick_model(names, OLLAMA_MODEL)
    status = {
        "backend": "ollama" if tags is not None else "templated",
        "available": tags is not None and model is not None,
        "model": model,
        "base_url": OLLAMA_BASE_URL,
        "installed_models": names,
    }
    _llm_probe_cache = (now, status)
    return status


def _pick_model(names: list[str], preferred: str) -> str | None:
    if not names:
        return None
    if preferred in names:
        return preferred
    family = preferred.split(":")[0]
    for name in names:
        if name.split(":")[0] == family:
            return name
    return names[0]


def _ollama_chat(messages: list[dict], temperature: float = 0.2,
                 num_predict: int = 260) -> tuple[str | None, str | None]:
    """Call Ollama /api/chat. Returns (text, model) or (None, None)."""
    if not llm_enabled():
        return None, None
    tags = _ollama_tags()
    if tags is None:
        return None, None
    names = [m.get("name") for m in tags.get("models", []) if m.get("name")]
    model = _pick_model(names, OLLAMA_MODEL)
    if not model:
        return None, None
    body = json.dumps({
        "model": model,
        "stream": False,
        "messages": messages,
        "options": {"temperature": temperature, "num_predict": num_predict},
    }).encode()
    req = urllib.request.Request(
        f"{OLLAMA_BASE_URL}/api/chat",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=LLM_TIMEOUT) as resp:
            data = json.loads(resp.read().decode())
        text = (data.get("message") or {}).get("content", "").strip()
        if text:
            return text, data.get("model", model)
    except Exception:
        return None, None
    return None, None


def templated_explain(facts: dict) -> dict:
    t = facts.get("trends", {}) or {}
    place = facts.get("region_name")
    if place:
        parts = [f"Place: {place}."]
    else:
        parts = [
            f"Place: {facts.get('lat', 0):.2f}°, {facts.get('lon', 0):.2f}° "
            f"(nearest grid cell {facts.get('grid_lat')}, {facts.get('grid_lon')})."
        ]
    trange = facts.get("time_range", ["?", "?"])
    parts.append(
        f"Record: {trange[0]} -> {trange[1]} "
        f"({'synthetic demo' if facts.get('synthetic') else 'NASA/partner products'})."
    )

    labels = [
        ("temperature", "Temperature", "°C"),
        ("precipitation", "Precipitation", "mm/month"),
        ("ndvi", "Vegetation (NDVI)", "index"),
        ("sst", "Sea surface temperature", "°C"),
        ("sea_level", "Sea level", "mm"),
        ("solar_radiation", "Solar radiation", "MJ/m²/day"),
        ("humidity", "Humidity", "%"),
        ("wind", "Wind", "m/s"),
    ]

    def fmt(param: str, label: str, unit: str):
        rec = t.get(param)
        if not rec or int(rec.get("n", 0) or 0) < 12:
            return None
        sig = "significant" if rec.get("significant") else "not statistically significant"
        slope = rec.get("slope_per_decade", 0)
        p = rec.get("p_value", 1)
        direction = rec.get("direction", "no trend")
        if direction == "no trend":
            return (f"{label}: no statistically significant trend "
                    f"(Theil–Sen {slope:+.3f} {unit}/decade, p={p:.3f})")
        return (f"{label} {direction} at {slope:+.3f} {unit}/decade "
                f"(Mann–Kendall {sig}, p={p:.3f})")

    for param, label, unit in labels:
        line = fmt(param, label, unit)
        if line:
            parts.append(line + ".")

    missing = facts.get("parameters_unavailable") or []
    if missing:
        parts.append(
            f"Unavailable at this cell: {', '.join(missing)} — reported as missing, "
            "not filled with zeroes."
        )

    fb = facts.get("forecast_deltas", {}) or {}
    model = facts.get("forecast_model") or "The forecast model"
    horizon = facts.get("horizon_months")
    bits = []
    for param in ("temperature", "precipitation"):
        delta = fb.get(param)
        if delta is not None:
            bits.append(f"{param} {delta:+.3f} {_PARAM_UNITS.get(param, 'units')}")
    if bits:
        window = facts.get("forecast_window") or []
        span = f" over the next {horizon} months" if horizon else ""
        if window:
            span += f" ({window[0]} to {window[1]})"
        parts.append(
            f"{model} projects a net change{span}: " + ", ".join(bits) +
            ". These are probabilistic p10–p90 bands, not a certain future."
        )

    an = facts.get("anomalies_count", 0)
    samples = facts.get("anomaly_samples") or []
    an_params = sorted({a.get("parameter") for a in samples if a.get("parameter")})
    where = f" for {', '.join(an_params)}" if an_params else " across available parameters"
    if an:
        parts.append(
            f"Flagged {an} statistically unusual month(s){where} (|robust z| ≥ 3.5); "
            "these are temporary departures, not a permanent trend shift."
        )
    else:
        parts.append("No statistically unusual months were flagged at this cell.")

    opp = facts.get("opposite_count", 0)
    if opp:
        opp_params = facts.get("opposite_parameters") or []
        if opp_params:
            scope = f" opposite {', '.join(opp_params)} trends"
        else:
            scope = " opposite-direction trends"
        parts.append(
            f"{opp} neighboring cell pair(s) show{scope} — "
            "inspect local drivers (e.g., land use, irrigation, orography) before "
            "attributing a regional cause."
        )
    parts.append("Coverage and unavailable parameters are reported per cell; see the evidence card for source-level detail.")
    text = " ".join(parts)
    conf = "high" if t.get("temperature", {}).get("significant") else "medium"
    return {"text": text, "generator": "templated", "confidence": conf}


def _hf_inference(facts: dict) -> dict | None:
    token = os.environ.get("HF_TOKEN")
    if not token:
        return None
    prompt = (
        "You are a climate data interpreter. Using ONLY these facts (do not add numbers), write a concise "
        "3-sentence plain-English summary for a general audience. Always mention uncertainty and that the record may be synthetic demo data.\n\n"
        + json.dumps(facts)[:3000]
    )
    body = json.dumps({"inputs": prompt, "parameters": {"max_new_tokens": 180, "temperature": 0.4}}).encode()
    req = urllib.request.Request(
        "https://api-inference.huggingface.co/models/katanemo/Arch-Router-1.5B",
        data=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode())
        if isinstance(data, list) and data and isinstance(data[0], dict):
            out = data[0].get("generated_text", "").strip()
            if out:
                return {"text": out, "generator": "hf_inference", "confidence": "high"}
    except Exception:
        return None
    return None


CARD_KEYWORDS: list[tuple[str, str]] = [
    ("fingerprint", r"fingerprint|all four|variables together|coupled|combine"),
    ("anomaly", r"unusual|anomal|spike|outlier|depart|weird"),
    ("forecast", r"forecast|future|next (few )?years|predict|projection|horizon|what will happen"),
    ("opposite", r"opposite|dipole|diverg|neighbou?r"),
    ("earth-twins", r"twin|similar|other region|compare|continent"),
    ("story", r"story|hindi|kannada|translate|local|student|journalist"),
    ("evidence", r"evidence|provenance|audit|missing data|resolution|dataset|source"),
    ("slope-map", r"where|map|distribution|spatial|hotspot"),
    ("caveat", r"significan|caveat|trust|confiden|p-value|p value|reliable|how sure"),
    ("variable", r"what is|explain|define|meaning|what does.*mean"),
    ("trend-chart", r"show|chart|graph|series|over time|plot|data"),
    ("finding", r"trend|changing|change|warmer|cooler|increas|decreas|warming|cooling"),
]


def classify_card(question: str) -> str:
    q = (question or "").lower()
    for kind, pattern in CARD_KEYWORDS:
        if re.search(pattern, q):
            return kind
    return "finding"


def _confidence(facts: dict, card_kind: str = "finding") -> str:
    # A projection is never "high confidence" — its own p10–p90 band is wide.
    # A caveat is about uncertainty, so it is capped at medium too.
    if card_kind in ("forecast", "caveat"):
        return "medium"
    trends = facts.get("trends", {}) or {}
    significant = sum(1 for r in trends.values() if r.get("significant"))
    if significant >= 2:
        return "high"
    if significant == 1:
        return "medium"
    return "low"


def _trend_line(facts: dict, parameter: str, label: str, unit: str) -> str | None:
    rec = (facts.get("trends", {}) or {}).get(parameter)
    if not rec or int(rec.get("n", 0) or 0) < 12:
        return None
    if rec.get("significant"):
        verdict = "statistically significant"
    else:
        verdict = "not statistically significant"
    return (f"{label} changes {rec.get('slope_per_decade', 0):+.3f} {unit}/decade "
            f"({verdict}, p={rec.get('p_value', 1):.3f})")


def templated_chat(messages: list[dict], facts: dict, card_kind: str) -> dict:
    """Deterministic, fact-locked fallback when the local LLM is unavailable."""
    question = next((m.get("content", "") for m in reversed(messages)
                     if m.get("role") == "user"), "")
    place = facts.get("region_name") or (
        f"{facts.get('lat', 0):.2f}°, {facts.get('lon', 0):.2f}°")
    trange = facts.get("time_range", ["?", "?"])
    lines: list[str] = []

    if card_kind == "forecast":
        deltas = facts.get("forecast_deltas", {}) or {}
        model = facts.get("forecast_model", "ridge rollout")
        horizon = facts.get("horizon_months", 60)
        focus = _focus_parameter(facts.get("variable"))
        missing = facts.get("parameters_unavailable") or []
        if focus and focus in missing:
            lines.append(
                f"{focus.replace('_', ' ').title()} is unavailable at {place}, "
                "so no forecast is made for it."
            )
        ordered = [p for p in (focus,) if p and p in deltas]
        ordered += [p for p in ("temperature", "precipitation")
                    if p in deltas and p not in ordered]
        for param in ordered[:2]:
            label = param.replace("_", " ").title()
            unit = _PARAM_UNITS.get(param, "units")
            lines.append(
                f"The {model} model projects a net {deltas[param]:+.3f} {unit} "
                f"change for {label.lower()} over the next {horizon} months at {place}."
            )
        if not ordered:
            lines.append(f"No parameter has a usable forecast at {place}.")
        window = facts.get("forecast_window") or []
        if window:
            lines.append(f"The forecast window is {window[0]} to {window[1]}.")
        lines.append("These are probabilistic p10–p90 bands, not a certain future; verify the backtest skill before acting.")
    elif card_kind == "anomaly":
        count = facts.get("anomalies_count", 0)
        samples = facts.get("anomaly_samples", []) or []
        detail = ", ".join(f"{a.get('parameter')} {a.get('date')} (z={a.get('z')})" for a in samples[:3])
        lines.append(f"I flagged {count} statistically unusual month(s) at {place} using a rolling robust-z test.")
        if detail:
            lines.append(f"Largest departures: {detail}.")
        lines.append("An anomaly is a temporary departure from the seasonal cycle, not automatically a disaster or a permanent trend.")
    elif card_kind == "opposite":
        count = facts.get("opposite_count", 0)
        lines.append(f"{count} neighbouring cell pair(s) around {place} trend in opposite directions.")
        pairs = facts.get("opposite_pairs", []) or []
        if pairs:
            p = pairs[0]
            lines.append(f"Example: {p.get('parameter')} at {p.get('cell_a', {}).get('lat')}°, "
                         f"{p.get('cell_a', {}).get('lon')}° is {p.get('cell_a', {}).get('slope_per_decade', 0):+.2f}/decade, "
                         f"while the neighbouring cell is {p.get('cell_b', {}).get('slope_per_decade', 0):+.2f}/decade.")
        lines.append("Inspect local drivers such as land use, irrigation, orography, or microclimate before attributing a continental cause.")
    elif card_kind == "earth-twins":
        twin = facts.get("climate_twin") or {}
        lines.append(f"Using the K-Means climate-twin model (k={twin.get('k', '?')}), {place} belongs to cluster {twin.get('cluster_id', '?')}.")
        lines.append(f"The clustering features are: {', '.join(twin.get('features', []) or [])}.")
        lines.append("Treat cross-continental twins as hypotheses: compare dataset resolution and coverage before making claims.")
    elif card_kind == "evidence":
        used = ", ".join(facts.get("parameters_used", []) or []) or "none"
        missing = ", ".join(facts.get("parameters_unavailable", []) or []) or "none"
        lines.append(f"Source coverage at {place} ({trange[0]}→{trange[1]}): available {used}; unavailable {missing}.")
        gaps = facts.get("gap_notes", []) or []
        if gaps:
            lines.append("Limitations: " + " ".join(gaps[:2]))
        lines.append(f"Data is {'synthetic demo data' if facts.get('synthetic') else 'real NASA POWER observations/model output'}.")
    elif card_kind == "fingerprint":
        labels = [("temperature", "Temperature", "°C"),
                  ("precipitation", "Precipitation", "mm"),
                  ("ndvi", "NDVI", "index"),
                  ("sst", "Sea-surface temperature", "°C")]
        for param, label, unit in labels:
            line = _trend_line(facts, param, label, unit)
            if line:
                lines.append(line + ".")
        lines.append(f"That gives {sum(1 for r in (facts.get('trends') or {}).values() if r.get('significant'))} "
                     "statistically significant indicators out of the parameters with usable data.")
    elif card_kind == "story":
        lines.append(f"Local story for {place}: the record runs {trange[0]} to {trange[1]}.")
        line = _trend_line(facts, "temperature", "Temperature", "°C")
        if line:
            lines.append(line + ".")
        line = _trend_line(facts, "precipitation", "Precipitation", "mm/month")
        if line:
            lines.append(line + ".")
        lines.append("Explain trends as observations of the past — never as certain predictions for the future.")
    elif card_kind == "slope-map":
        line = _trend_line(facts, "temperature", "Temperature", "°C")
        lines.append(f"Spatial context for {place}: the backend serves trends per nearest grid cell, not a single regional average.")
        if line:
            lines.append(line + ".")
        lines.append("Open the map to inspect a specific point; the local value can differ sharply from the regional mean.")
    elif card_kind == "caveat":
        lines.append(f"Significance at {place} is reported as a Mann–Kendall p-value on the monthly record.")
        focus = _focus_parameter(question) or _focus_parameter(facts.get("variable"))
        labels = {
            "temperature": ("Temperature", "°C"),
            "precipitation": ("Precipitation", "mm/month"),
            "ndvi": ("NDVI", "index"),
            "sst": ("Sea-surface temperature", "°C"),
            "sea_level": ("Sea level", "mm"),
            "solar_radiation": ("Solar radiation", "MJ/m²/day"),
            "humidity": ("Humidity", "%"),
            "wind": ("Wind", "m/s"),
        }
        if focus in labels:
            label, unit = labels[focus]
            line = _trend_line(facts, focus, label, unit)
            if line:
                lines.append(line + ".")
            elif focus in (facts.get("parameters_unavailable") or []):
                lines.append(f"{label} is unavailable at this cell, so no trend can be estimated.")
            else:
                lines.append(f"{label} has insufficient data at this cell to estimate a trend.")
        else:
            for param in ("temperature", "precipitation"):
                line = _trend_line(facts, param, *labels[param])
                if line:
                    lines.append(line + ".")
        lines.append("A non-significant result means the data cannot confirm a trend at the 0.05 threshold; it does not prove there is no change.")
        lines.append("Correlation is not causation, and a short or noisy record can hide a real trend.")
    elif card_kind == "variable":
        lines.append(f"This case studies {facts.get('variable', 'the primary variable')} at {place}.")
        lines.append("The backend exposes temperature, precipitation, humidity, wind, and solar radiation from NASA POWER; NDVI, SST, and sea level are only available where the underlying products exist.")
    elif card_kind == "trend-chart":
        line = _trend_line(facts, "temperature", "Temperature", "°C")
        if line:
            lines.append(line + ".")
        line = _trend_line(facts, "precipitation", "Precipitation", "mm/month")
        if line:
            lines.append(line + ".")
        lines.append(f"The chart shows every monthly value from {trange[0]} to {trange[1]}; the fitted line uses the Theil–Sen/Mann–Kendall trend from the backend.")
    else:
        trend_lines = [line for line in (
            _trend_line(facts, "temperature", "Temperature", "°C"),
            _trend_line(facts, "precipitation", "Precipitation", "mm/month"),
            _trend_line(facts, "ndvi", "NDVI", "index"),
        ) if line]
        if trend_lines:
            lines.extend(line + "." for line in trend_lines)
        else:
            lines.append(templated_explain(facts)["text"])
        if not facts.get("synthetic"):
            lines.append("Data comes from the backend's real NASA POWER record; unavailable parameters are reported honestly rather than filled in.")

    text = " ".join(lines) or templated_explain(facts)["text"]
    return {"text": text, "generator": "templated", "confidence": _confidence(facts, card_kind)}


_PARAM_UNITS = {
    "temperature": "°C",
    "precipitation": "mm/month",
    "ndvi": "index",
    "sst": "°C",
    "sea_level": "mm",
    "humidity": "%",
    "wind": "m/s",
    "solar_radiation": "MJ/m²/day",
}


_VARIABLE_TO_PARAM = {
    "land surface temperature": "temperature",
    "temperature": "temperature",
    "precipitation": "precipitation",
    "rainfall": "precipitation",
    "vegetation index": "ndvi",
    "ndvi": "ndvi",
    "sea surface": "sst",
    "surface water": "sea_level",
    "water extent": "sea_level",
}


def _focus_parameter(label: str | None) -> str | None:
    text = (label or "").lower()
    for needle, param in _VARIABLE_TO_PARAM.items():
        if needle in text:
            return param
    return None


_PARAM_SYNONYMS: dict[str, tuple[str, ...]] = {
    "temperature": ("temperature", "temp", "warming", "cooling", "lst"),
    "precipitation": ("precipitation", "rainfall", "rain"),
    "ndvi": ("ndvi", "vegetation"),
    "sst": ("sst", "sea surface", "sea-surface"),
    "sea_level": ("sea level", "sea-level", "water extent"),
    "solar_radiation": ("solar radiation", "solar", "radiation"),
    "humidity": ("humidity", "relative humidity"),
    "wind": ("wind", "winds"),
}
_SIG_CLAIM_RE = re.compile(
    r"statistically significant|significant\s+(?:trend|increase|decrease|warming|cooling|change)",
    re.I,
)
_NEGATION_RE = re.compile(
    r"\b(?:not|no|never|cannot|can't|insufficient|fails? to|failed to|without)\b", re.I
)
_PVALUE_RE = re.compile(r"\bp[-\s]?value\b|\bp\s*[=<>]", re.I)
_PVALUE_MISUSE_RE = re.compile(
    r"\b(?:chance|probability|probable|likelihood|likely|confidence|confident)\b", re.I
)
_BAND_PAIR = (
    r"(?:\b10\s*(?:%|percent\b)[^.]{0,40}\b90\s*(?:%|percent\b)"
    r"|\bp10[^.]{0,20}\bp90\b)"
)
_BAND_MISUSE_RE = re.compile(
    rf"{_BAND_PAIR}[^.]{{0,80}}"
    r"\b(?:chance|probability|probable|likelihood|likely|confidence)\b"
    r"|\b(?:chance|probability|probable|likelihood|likely|confidence)\b"
    rf"[^.]{{0,80}}{_BAND_PAIR}",
    re.I,
)


def _stat_guard_reason(text: str, facts: dict, card_kind: str) -> str | None:
    """Catch classic statistical misreadings the tiny local model still makes.

    - Calling a non-significant trend "statistically significant".
    - Turning a p-value into a probability/confidence statement.
    - Describing a p10–p90 interval as a "10% to 90% chance".
    """
    trends = facts.get("trends") or {}
    focus = _focus_parameter(facts.get("variable"))
    for sentence in re.split(r"(?<=[.!?])\s+", text or ""):
        if _BAND_MISUSE_RE.search(sentence):
            return "band_misuse"
        if _PVALUE_RE.search(sentence) and _PVALUE_MISUSE_RE.search(sentence):
            return "p_value_misuse"
        if _SIG_CLAIM_RE.search(sentence) and not _NEGATION_RE.search(sentence):
            matched = [
                param
                for param, words in _PARAM_SYNONYMS.items()
                if param in trends
                and any(re.search(rf"\b{re.escape(word)}\b", sentence, re.I) for word in words)
            ]
            if not matched and focus in trends:
                matched = [focus]
            if any(not bool((trends.get(param) or {}).get("significant")) for param in matched):
                return "significance_misread"
    return None


def _facts_summary(facts: dict, card_kind: str = "finding") -> str:
    """Compact, unambiguous text for a small local model.

    Nested JSON invites the model to grab a number and attach the wrong unit or
    time basis (e.g. calling a 5-year net change "per decade"). Numbered prose
    with explicit labels keeps the narration anchored.
    """
    place = facts.get("region_name") or (
        f"{facts.get('lat', 0):.2f}°, {facts.get('lon', 0):.2f}°"
    )
    trange = facts.get("time_range", ["?", "?"])
    lines = [
        f"Place: {place} (backend grid cell {facts.get('cell_index', '?')} at "
        f"{facts.get('grid_lat', '?')}°, {facts.get('grid_lon', '?')}°).",
        f"Record period: {trange[0]} to {trange[1]}.",
        "Data type: SYNTHETIC DEMO DATA (not observations)."
        if facts.get("synthetic")
        else "Data type: real NASA POWER monthly observations/model output.",
    ]
    focus = facts.get("variable")
    if focus:
        lines.append(f"User's case-file variable: {focus}.")

    usable = facts.get("parameters_used") or []
    missing = facts.get("parameters_unavailable") or []
    if usable:
        lines.append("Available parameters: " + ", ".join(usable) + ".")
    if missing:
        lines.append("UNAVAILABLE at this cell (never invent values): " + ", ".join(missing) + ".")

    trends = facts.get("trends") or {}
    focus_param = _focus_parameter(focus)
    trend_params = list(trends)
    if card_kind == "forecast":
        # Keep the prompt focused: the requested variable plus temperature.
        trend_params = [p for p in (focus_param, "temperature") if p in trends]
        trend_params = list(dict.fromkeys(trend_params))
    lines.append("Trends (Theil–Sen slope per decade; p-value = trend significance only):")
    trend_count = 0
    for param in trend_params:
        rec = trends.get(param) or {}
        if int(rec.get("n", 0) or 0) < 12:
            continue
        trend_count += 1
        verdict = (
            "statistically significant"
            if rec.get("significant")
            else "NOT statistically significant"
        )
        lines.append(
            f"- {param}: {rec.get('slope_per_decade', 0):+.3f} "
            f"{_PARAM_UNITS.get(param, 'units')}/decade, p={rec.get('p_value', 1):.3f}, "
            f"{verdict}, direction={rec.get('direction', 'unknown')}."
        )
    if trend_count == 0:
        lines.append("- No parameter has enough data for a trend at this cell.")

    deltas = facts.get("forecast_deltas") or {}
    if deltas:
        horizon = facts.get("horizon_months", 60)
        window = facts.get("forecast_window") or []
        if window:
            lines.append(f"Forecast window: {window[0]} to {window[1]}.")
        lines.append(
            f"Forecast ({facts.get('forecast_model', 'ridge rollout')}, next {horizon} months). "
            "Each value is the TOTAL NET CHANGE from the first to the last forecast month "
            "across the whole horizon — it is NOT a per-decade rate:"
        )
        for param, delta in deltas.items():
            if delta is None:
                continue
            lines.append(
                f"- {param}: {delta:+.3f} {_PARAM_UNITS.get(param, 'units')} "
                f"net change over {horizon} months."
            )
        lines.append(
            "The forecast has probabilistic p10–p90 bands; do not describe it as certain."
        )

    if card_kind != "forecast":
        count = facts.get("anomalies_count", 0)
        samples = facts.get("anomaly_samples") or []
        if count:
            detail = ", ".join(
                f"{a.get('parameter')} {a.get('date')} (z={a.get('z')})"
                for a in samples[:3]
            )
            lines.append(f"Anomalies: {count} unusual months flagged" + (f"; largest: {detail}." if detail else "."))
        else:
            lines.append("Anomalies: none flagged at this cell.")

        if facts.get("opposite_count"):
            pairs = facts.get("opposite_pairs") or []
            extra = ""
            if pairs:
                p = pairs[0]
                a, b = p.get("cell_a", {}), p.get("cell_b", {})
                extra = (
                    f" Example: {p.get('parameter')} at {a.get('lat')}°, {a.get('lon')}° "
                    f"is {a.get('slope_per_decade', 0):+.2f}/decade while the neighbour is "
                    f"{b.get('slope_per_decade', 0):+.2f}/decade."
                )
            lines.append(f"Opposite trends: {facts['opposite_count']} neighbouring pair(s).{extra}")

        twin = facts.get("climate_twin") or {}
        if twin.get("cluster_id") is not None:
            lines.append(
                f"Climate twin: K-Means cluster {twin.get('cluster_id')} (k={twin.get('k')})."
            )

    lines.append(
        "Reminder: p-values are NOT a confidence percentage or certainty level. "
        "Never say '100% certainty'. A non-significant trend means the data cannot "
        "confirm a trend at the 0.05 threshold, not that no change occurred."
    )
    return "\n".join(lines)


_CITATION_RE = re.compile(r"\[S\d{1,2}\]")
_NUMBER_RE = re.compile(r"-?\d[\d,]*(?:\.\d+)?")


def _number_set(text: str) -> set[float]:
    out: set[float] = set()
    # [S1]-style citation markers reference retrieval sources, not claims —
    # strip them so the numeric guard does not flag them as invented numbers.
    normalised = _CITATION_RE.sub(" ", text or "").replace("\u2212", "-")
    for match in _NUMBER_RE.findall(normalised):
        try:
            out.add(round(float(match.replace(",", "")), 6))
        except ValueError:
            continue
    return out


def _allowed_numbers(facts: dict, card_kind: str) -> set[float]:
    """Every number the model is allowed to write, plus harmless derived ones.

    The set is built from the same compact summary the model sees and the raw
    facts JSON. Derived calendar values (e.g. 5 years for a 60-month horizon)
    and the p10/p90 percentages are allowed; computed totals are not, because
    the model must not do arithmetic.
    """
    allowed = _number_set(_facts_summary(facts, card_kind))
    allowed |= _number_set(json.dumps(facts, default=str))
    horizon = int(facts.get("horizon_months", 60) or 60)
    if horizon > 0 and horizon % 12 == 0:
        allowed.add(float(horizon // 12))
    allowed.update({10.0, 90.0, 80.0, 95.0, 0.05})
    # Permit consistent 3-decimal rounding of any fact number (e.g. a p-value
    # 0.0385 written as 0.038) without permitting invented magnitudes.
    allowed |= {round(value, 3) for value in allowed}
    return allowed


def _unverified_numbers(text: str, facts: dict, card_kind: str) -> list[float]:
    return sorted(_number_set(text) - _allowed_numbers(facts, card_kind))


def _guard_fallback(
    safe_messages: list[dict],
    facts: dict,
    card_kind: str,
    reason: str,
    numbers: list[float] | None = None,
) -> dict:
    """Deterministic prose used when the LLM answer failed a fact check."""
    fallback = templated_chat(safe_messages, facts, card_kind)
    fallback.update({
        "model": None,
        "card_kind": card_kind,
        "llm_available": True,
        "generator": "templated-guard",
        "guard_reason": reason,
        "sources": [],
    })
    if numbers:
        fallback["guard_numbers"] = numbers
    return fallback


def _guarded_llm_reply(text: str, model: str | None, generator: str,
                       safe_messages: list[dict], facts: dict,
                       card_kind: str, sources: list[dict] | None = None) -> dict:
    """Apply the post-generation fact guards to any LLM draft (Ollama or HF RAG)."""
    if re.search(r"\bcertainty\b|\b100\s*%|\bone hundred percent\b", text, re.I):
        # A small model can still misread a p-value as confidence.
        # Fall back to deterministic prose rather than publish a false claim.
        return _guard_fallback(safe_messages, facts, card_kind, "certainty_claim")
    stat_reason = _stat_guard_reason(text, facts, card_kind)
    if stat_reason:
        return _guard_fallback(safe_messages, facts, card_kind, stat_reason)
    unverified = _unverified_numbers(text, facts, card_kind)
    if unverified:
        # The model must only re-word facts, never do arithmetic. Any novel
        # number (e.g. a hand-computed horizon total) is unverified.
        return _guard_fallback(
            safe_messages, facts, card_kind, "unverified_numbers", unverified
        )
    return {"text": text, "generator": generator, "model": model,
            "confidence": _confidence(facts, card_kind), "card_kind": card_kind,
            "llm_available": True, "sources": sources or []}


def chat(messages: list[dict], facts: dict, language: str = "en") -> dict:
    """Conversational facts-locked explainer.

    Order of attempts: HF RAG backend (EP_RAG_BACKEND=hf-router or hf) -> local
    Ollama -> deterministic templated prose. Every model draft passes the same
    fact guards, whichever backend produced it.
    """
    safe_messages = [
        {"role": m.get("role", "user"), "content": str(m.get("content", ""))[:4000]}
        for m in messages[-12:]
        if m.get("role") in ("user", "assistant", "system") and m.get("content")
    ]
    if not safe_messages:
        safe_messages = [{"role": "user", "content": "Summarise this place."}]
    card_kind = classify_card(safe_messages[-1].get("content", ""))

    facts_summary = _facts_summary(facts, card_kind)

    if rag.rag_enabled():
        if rag.router_enabled():
            result = rag.router_chat(safe_messages, facts_summary, card_kind,
                                     language, max_new_tokens=170)
            generator = "hf-router"
        else:
            result = rag.rag_chat(safe_messages, facts_summary, card_kind,
                                  language, max_new_tokens=170)
            generator = "hf-rag"
        if result and result.get("text"):
            return _guarded_llm_reply(result["text"], result.get("model"),
                                      generator, safe_messages, facts,
                                      card_kind, result.get("sources"))
        # RAG backend unreachable/failed: fall through to Ollama, then templated.

    system = (
        "You are Earth Pulse, a careful climate-data interpreter embedded in a NASA satellite trend explorer. "
        "The FACTS SUMMARY below is the only source of numbers.\n"
        "STRICT RULES:\n"
        "1. Use ONLY numbers that appear in FACTS SUMMARY. Never invent, round inconsistently, or alter a number.\n"
        "2. Forecast values are TOTAL NET CHANGE over the whole horizon, NOT per decade. Never call them per-decade rates.\n"
        "3. A p-value measures trend significance only. NEVER turn it into a confidence percentage, a certainty level, or '100%'. Forecasts have p10–p90 uncertainty and are not certain futures.\n"
        "4. If significant=false, say no statistically significant trend can be confirmed. Never call it warming/cooling certainty.\n"
        "5. If a parameter is unavailable, say so; never fill gaps with numbers.\n"
        "6. If data is synthetic, say it is synthetic demo data.\n"
        "7. Answer in at most 3 short sentences of plain language (no bullet lists, no parameter-by-parameter dump). "
        "Focus on the user's case-file variable and at most one other parameter."
        + (" Use the same language as the user's question." if language == "auto" else "")
        + "\n8. Call forecast numbers 'forecast net change', never 'trend'. Prefer the user's case-file variable when it is relevant, but do not ignore a direct question about another parameter.\n"
        "FACTS SUMMARY:\n" + facts_summary
    )
    text, model = _ollama_chat(
        [{"role": "system", "content": system}, *safe_messages],
        num_predict=170,
    )
    if text:
        return _guarded_llm_reply(text, model, "ollama", safe_messages,
                                  facts, card_kind, [])
    fallback = templated_chat(safe_messages, facts, card_kind)
    fallback.update({"model": None, "card_kind": card_kind,
                     "llm_available": False, "sources": []})
    return fallback


def explain(facts: dict) -> dict:
    # /place keeps the deterministic templated narration by default so map
    # clicks stay fast. Set EP_EXPLAIN_LLM=1 to narrate the payload with Ollama.
    if os.environ.get("EP_EXPLAIN_LLM", "0").lower() in ("1", "true", "yes", "on"):
        prompt = ("Using ONLY these facts, write 3 sentences of plain English. "
                  "Mention uncertainty and never invent a number.\n"
                  + json.dumps(facts, default=str)[:3000])
        text, model = _ollama_chat([
            {"role": "system", "content": "You are a careful climate-data interpreter. Facts only."},
            {"role": "user", "content": prompt},
        ], temperature=0.3, num_predict=220)
        if text:
            return {"text": text, "generator": "ollama", "model": model,
                    "confidence": _confidence(facts)}
    hf = _hf_inference(facts)
    if hf:
        return hf
    return templated_explain(facts)
