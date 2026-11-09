"""NASA POWER point time-series fetcher (no API key required).

Docs: https://power.larc.nasa.gov/docs/services/api/temporal/monthly/point/
Monthly endpoint expects start/end as 4-digit years.
"""
from __future__ import annotations

import json
import urllib.request
import urllib.error

BASE = "https://power.larc.nasa.gov/api/temporal/monthly/point"
DEFAULT_PARAMS = ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "RH2M", "WS2M", "PS", "ALLSKY_SFC_SW_DWN"]


def fetch_power_point(lat: float, lon: float, start: int = 1981, end: int = 2026,
                      parameters: list[str] | None = None, timeout: int = 30) -> dict:
    """Fetch monthly POWER data for one point.

    Returns {"lat", "lon", "parameters": {param: {"YYYY-MM": value}}} or {"error": ...}.
    """
    params = parameters or DEFAULT_PARAMS
    query = (
        f"parameters={','.join(params)}&community=RE&latitude={lat}&longitude={lon}"
        f"&start={start}&end={end}&format=JSON&units=metric"
    )
    url = f"{BASE}?{query}"
    try:
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
                    out[p][f"{yyyymm[:4]}-{yyyymm[4:6]}"] = float(value)
                except (ValueError, TypeError):
                    continue
        return {"lat": lat, "lon": lon, "parameters": out, "source": url}
    except urllib.error.URLError as exc:
        return {"error": f"power_unreachable: {exc.reason if hasattr(exc, 'reason') else exc}", "url": url}
    except Exception as exc:  # incl. JSON decode
        return {"error": f"power_parse_failed: {exc}", "url": url}
