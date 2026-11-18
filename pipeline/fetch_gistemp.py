"""NASA GISS GISTEMP v4 global temperature anomalies (no login required).

Downloads the land-ocean global means table and returns annual anomalies
(°C relative to the 1951–1980 base period). Used as global context for a
point's local trend — never as a local measurement.
"""
from __future__ import annotations

import json
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / "data" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
CACHE = CACHE_DIR / "gistemp_glb.json"
URL = "https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv"


def _parse(text: str) -> dict[int, float]:
    annual: dict[int, float] = {}
    for line in text.splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 14 or not parts[0].isdigit():
            continue
        year = int(parts[0])
        raw = parts[13]  # J-D (annual mean)
        try:
            annual[year] = float(raw)
        except ValueError:
            continue
    return annual


def fetch_gistemp(force: bool = False, timeout: int = 40) -> dict:
    if CACHE.exists() and not force:
        try:
            data = json.loads(CACHE.read_text())
            generated = datetime.fromisoformat(data["generated_utc"])
            if (datetime.utcnow() - generated).days <= 30:
                return data
        except Exception:
            pass
    try:
        with urllib.request.urlopen(URL, timeout=timeout) as resp:
            text = resp.read().decode("utf-8", "replace")
        annual = _parse(text)
    except Exception as exc:  # pragma: no cover - network dependent
        return {"available": False, "note": f"gistemp_unreachable: {exc}"}
    if not annual:
        return {"available": False, "note": "gistemp_parse_failed"}
    years = sorted(annual)
    result = {
        "available": True,
        "source": "NASA GISS GISTEMP v4 (land-ocean annual means)",
        "url": URL,
        "generated_utc": datetime.utcnow().isoformat(timespec="seconds"),
        "base_period": "1951-1980",
        "period": [years[0], years[-1]],
        "annual": {str(y): annual[y] for y in years},
        "note": "Global mean anomaly — context only, not a local measurement.",
    }
    try:
        CACHE.write_text(json.dumps(result))
    except Exception:
        pass
    return result
