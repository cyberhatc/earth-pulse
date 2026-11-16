"""NASA POWER monthly point time series — the grid-store interface wrapper.

POWER is a POINT API: a 2.5 deg global grid (10,368 cells) would need >10,000
calls and is intentionally NOT built from POWER. This module exposes the
existing point fetcher through the shared ``fetch(...)`` interface so point
queries (Tier B / /point) have the same shape-of-API as the gridded sources.
"""
from __future__ import annotations

from pathlib import Path

from pipeline.fetch_power import fetch_power_point  # noqa: F401  (kept for back-compat)

BASE = "https://power.larc.nasa.gov/api/temporal/monthly/point"


def fetch(points: list[tuple[float, float]] | None = None, start: int = 1981,
          end: int = 2026, parameters: list[str] | None = None) -> dict:
    """Fetch POWER monthly series for explicit (lat, lon) points.

    Returns {"available": bool, "results": {"lat,lon": {...}}, "source": url} —
    never raises on network failure; per-point errors are reported inline.
    """
    from datetime import datetime, timezone

    pts = points or [(12.97, 77.59)]
    results: dict[str, dict] = {}
    ok = 0
    for lat, lon in pts:
        res = fetch_power_point(lat, lon, start, end, parameters)
        results[f"{lat},{lon}"] = res
        ok += 1 if "error" not in res else 0
    return {
        "available": ok > 0,
        "results": results,
        "source": BASE,
        "product": "NASA POWER monthly point API",
        "version": "v1",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
    }
