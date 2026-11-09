"""Tier B — bounded, on-demand fetches (opt-in, cached, never blocks Tier A).

All functions are network-tolerant: they return dicts with `available: bool`
and explanatory notes instead of raising. Nothing here is fabricated.
"""
from __future__ import annotations

from functools import lru_cache


@lru_cache(maxsize=256)
def power_point(lat: float, lon: float) -> dict:
    key = f"power:{lat:.3f},{lon:.3f}"

    def _produce():
        try:
            from pipeline.fetch_power import fetch_power_point
            res = fetch_power_point(lat, lon, 1981, 2026)
            if "error" in res:
                return {"available": False, "note": res["error"]}
            n = {p: len(s) for p, s in res["parameters"].items()}
            return {"available": True, "months_per_parameter": n, "source": "NASA POWER API"}
        except Exception as exc:
            return {"available": False, "note": f"power_error: {exc}"}

    from pipeline.cache import cached_json
    return cached_json(key, ttl_seconds=int(os.environ.get("EP_CACHE_TTL", "3600")), producer=_produce)


@lru_cache(maxsize=256)
def firms_area(lat: float, lon: float) -> dict:
    try:
        from pipeline.fetch_firms import fetch_firms_area
        return fetch_firms_area(lat, lon)
    except Exception as exc:
        return {"available": False, "note": f"firms_error: {exc}"}


def gibs_past(lat: float, lon: float) -> list[dict]:
    from pipeline.fetch_gibs import thumbnails_for_point
    dates = ["2000-06-01", "2010-06-01", "2020-06-01", "2025-06-01"]
    return thumbnails_for_point(lat, lon, dates, z=4)


def landsat_link(lat: float, lon: float) -> str:
    d = 0.5
    return (f"https://earthexplorer.usgs.gov/?searchType=specificPlace&lon={lon:.4f}&lat={lat:.4f}"
            f"&maxResults=20#results")


@lru_cache(maxsize=128)
def coverage(lat: float, lon: float) -> dict:
    try:
        from pipeline.discover import discover_coverage
        return discover_coverage(lat, lon, 1985, 2026)
    except Exception as exc:
        return {"method": "error", "note": str(exc)}


def tier_b_summary(lat: float, lon: float) -> dict:
    return {
        "power": power_point(round(lat, 2), round(lon, 2)),
        "firms": firms_area(round(lat, 2), round(lon, 2)),
        "gibs": gibs_past(round(lat, 2), round(lon, 2)),
        "landsat_query": landsat_link(lat, lon),
        "coverage": coverage(round(lat, 2), round(lon, 2)),
    }
