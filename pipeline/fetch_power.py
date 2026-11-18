"""NASA POWER point time-series fetcher (no API key required).

Docs: https://power.larc.nasa.gov/docs/services/api/temporal/monthly/point/
Monthly endpoint expects start/end as 4-digit years.

The API rejects requests with more than 25 ``parameters`` (an opaque
"power_unreachable: " error). Longer catalogues are split into bounded chunks
and merged here so callers can ask for as many variables as they need.
"""
from __future__ import annotations

import json
import urllib.request
import urllib.error

BASE = "https://power.larc.nasa.gov/api/temporal/monthly/point"
DEFAULT_PARAMS = ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "RH2M", "WS2M", "PS", "ALLSKY_SFC_SW_DWN"]
MAX_PARAMS_PER_REQUEST = 25


def _fetch_chunk(lat: float, lon: float, start: int, end: int,
                 params: list[str], timeout: int) -> tuple[dict, str]:
    query = (
        f"parameters={','.join(params)}&community=RE&latitude={lat}&longitude={lon}"
        f"&start={start}&end={end}&format=JSON&units=metric"
    )
    url = f"{BASE}?{query}"
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    raw = payload.get("properties", {}).get("parameter", {})
    out: dict[str, dict[str, float]] = {}
    for p, series in raw.items():
        out[p] = {}
        for yyyymm, value in series.items():
            if value is None:
                continue
            try:
                year, month = int(str(yyyymm)[:4]), int(str(yyyymm)[4:6])
            except (ValueError, TypeError):
                continue
            if month < 1 or month > 12:
                continue  # POWER encodes the ANNUAL aggregate as month 13 — not a month
            try:
                out[p][f"{year:04d}-{month:02d}"] = float(value)
            except (ValueError, TypeError):
                continue
    return out, url


def fetch_power_point(lat: float, lon: float, start: int = 1981, end: int = 2026,
                      parameters: list[str] | None = None, timeout: int = 30) -> dict:
    """Fetch monthly POWER data for one point, chunking long parameter lists.

    Returns {"lat", "lon", "parameters": {param: {"YYYY-MM": value}}} or {"error": ...}.
    """
    params = list(dict.fromkeys(parameters or DEFAULT_PARAMS))
    urls: list[str] = []
    merged: dict[str, dict[str, float]] = {}
    try:
        for i in range(0, len(params), MAX_PARAMS_PER_REQUEST):
            chunk = params[i:i + MAX_PARAMS_PER_REQUEST]
            out, url = _fetch_chunk(lat, lon, start, end, chunk, timeout)
            urls.append(url)
            merged.update(out)
        return {
            "lat": lat,
            "lon": lon,
            "parameters": merged,
            "source": urls[0] if len(urls) == 1 else urls,
        }
    except urllib.error.URLError as exc:
        return {
            "error": f"power_unreachable: {exc.reason if hasattr(exc, 'reason') else exc}",
            "url": urls[-1] if urls else BASE,
        }
    except Exception as exc:  # incl. JSON decode
        return {
            "error": f"power_parse_failed: {exc}",
            "url": urls[-1] if urls else BASE,
        }
