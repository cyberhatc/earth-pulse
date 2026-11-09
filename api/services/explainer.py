"""Plain-English explainer.

The LLM never computes numbers — it receives a `facts` dict assembled from the
payload (trends, forecast deltas, anomaly count, opposite-trend count, coverage)
and only words them. If no LLM key is configured, a deterministic templated
narrative is returned (always works, offline).
"""
from __future__ import annotations

import json
import os
import urllib.request


def templated_explain(facts: dict) -> dict:
    t = facts.get("trends", {})
    parts = [f"Place: {facts.get('lat', 0):.2f}°, {facts.get('lon', 0):.2f}° (nearest grid cell {facts.get('grid_lat')}, {facts.get('grid_lon')})."]
    trange = facts.get("time_range", ["?", "?"])
    parts.append(f"Record: {trange[0]} → {trange[1]} ({'synthetic demo' if facts.get('synthetic') else 'NASA/partner products'}).")

    def fmt(param: str, label: str, unit: str):
        rec = t.get(param)
        if not rec:
            return None
        sig = "significant" if rec.get("significant") else "not statistically significant"
        return f"{label} {rec.get('direction', '?')} at {rec.get('slope_per_decade', 0):+.2f} {unit}/decade (Mann–Kendall {sig}, p={rec.get('p_value', 1):.3f})"

    for line in [fmt("temperature", "Temperature", "°C"),
                 fmt("precipitation", "Precipitation", "mm"),
                 fmt("ndvi", "Vegetation (NDVI)", "index"),
                 fmt("sst", "Sea surface temperature", "°C")]:
        if line:
            parts.append(line + ".")

    fb = facts.get("forecast_deltas", {})
    if fb:
        temp_delta = fb.get("temperature")
        if temp_delta is not None:
            parts.append(f"Model projects a net {temp_delta:+.2f} °C over the horizon (p10–p90 band shown; this is a probabilistic outlook, not a certain future).")

    an = facts.get("anomalies_count", 0)
    parts.append(f"Flagged {an} statistically unusual month(s) for temperature/precipitation/NDVI (|robust z| ≥ 3.5).")
    opp = facts.get("opposite_count", 0)
    if opp:
        parts.append(f"{opp} neighboring region(s) show opposite-sign vegetation/precipitation trends — classic \"climate detective\" case: local drivers (e.g., land use, irrigation, orography) can overwhelm the broader trend.")
    parts.append("Coverage is per-parameter: NDVI/SST/sea level start later than temperature (see NASA coverage in docs/data-sources.md).")
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


def explain(facts: dict) -> dict:
    hf = _hf_inference(facts)
    if hf:
        return hf
    return templated_explain(facts)
