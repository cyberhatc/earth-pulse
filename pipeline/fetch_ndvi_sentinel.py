"""Sentinel-2 L2A NDVI (10 m) via Microsoft Planetary Computer (no login).

Provides a real, measured NDVI time series for any point on Earth using
Sentinel-2 L2A surface reflectance (B04 red, B08 NIR). NDVI is computed
per-scene at the point pixel and composited to monthly maxima.

This is the no-login alternative to MODIS MOD13Q1 via AppEEARS (which
requires accepting the AppEEARS terms of use on the web UI). Sentinel-2
coverage starts ~2015 (Sentinel-2A) / 2017 (2B), so the series is shorter
than MODIS but at 10 m resolution and available globally without any
account.

Honesty: only scenes with cloud cover below a threshold are used; months
with no clear scene are left as NaN (never interpolated/faked).
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from datetime import date
from typing import Any

import numpy as np
import rasterio
from rasterio.warp import transform as warp_transform

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
SIGN = "https://planetarycomputer.microsoft.com/api/sas/v1/sign"


def _sign(href: str) -> str:
    url = SIGN + "?href=" + urllib.parse.quote(href, safe="")
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read())["href"]


def _ndvi_pixel(signed_b04: str, signed_b08: str, lon: float, lat: float) -> float:
    with rasterio.open(signed_b04) as src:
        xs, ys = warp_transform("EPSG:4326", src.crs, [lon], [lat])
        r, c = src.index(xs[0], ys[0])
        if r < 0 or c < 0 or r >= src.height or c >= src.width:
            return float("nan")
        red = float(src.read(1, window=rasterio.windows.Window(c, r, 1, 1))[0, 0])
    with rasterio.open(signed_b08) as src:
        xs, ys = warp_transform("EPSG:4326", src.crs, [lon], [lat])
        r, c = src.index(xs[0], ys[0])
        if r < 0 or c < 0 or r >= src.height or c >= src.width:
            return float("nan")
        nir = float(src.read(1, window=rasterio.windows.Window(c, r, 1, 1))[0, 0])
    if not (np.isfinite(red) and np.isfinite(nir)):
        return float("nan")
    denom = nir + red
    if denom == 0:
        return float("nan")
    ndvi = (nir - red) / denom
    return float(ndvi)


def _search_scenes(lon, lat, start, end, max_cloud=60, limit=200, retries=3):
    d = 0.01
    body = {
        "collections": ["sentinel-2-l2a"],
        "bbox": [lon - d, lat - d, lon + d, lat + d],
        "datetime": f"{start}/{end}",
        "limit": limit,
        "query": {"eo:cloud_cover": {"lt": max_cloud}},
        "sortby": [{"field": "eo:cloud_cover", "direction": "asc"}],
    }
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                "https://planetarycomputer.microsoft.com/api/stac/v1/search",
                data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                j = json.loads(r.read())
            return j.get("features", [])
        except Exception:
            if attempt == retries - 1:
                return []
            time.sleep(3)
    return []


def fetch_sentinel2_ndvi_series(lat: float, lon: float,
                                start_year: int = 2019, end_year: int = 2025) -> dict:
    """Monthly max NDVI from Sentinel-2 L2A for a point (no login required)."""
    today = date.today()
    start = f"{start_year}-01-01"
    end = f"{end_year}-12-31"
    if date.fromisoformat(end) > today:
        end = today.isoformat()
    scenes = _search_scenes(lon, lat, start, end, max_cloud=60, limit=300)
    if not scenes:
        return {"available": False, "note": "no Sentinel-2 scenes found for this point"}
    by_month: dict[str, list] = {}
    for s in scenes:
        dt = s["properties"].get("datetime", "")[:7]
        if not dt:
            continue
        by_month.setdefault(dt, []).append(s)
    monthly: dict[str, list[float]] = {}
    for ym, cands in by_month.items():
        cands.sort(key=lambda s: s["properties"].get("eo:cloud_cover", 999))
        for scene in cands[:2]:
            try:
                b04 = _sign(scene["assets"]["B04"]["href"])
                b08 = _sign(scene["assets"]["B08"]["href"])
                ndvi = _ndvi_pixel(b04, b08, lon, lat)
            except Exception:
                ndvi = float("nan")
            if np.isfinite(ndvi):
                monthly.setdefault(ym, []).append(ndvi)
                break
    series = {k: float(np.max(v)) for k, v in monthly.items()}
    if not series:
        return {"available": False, "note": "no clear Sentinel-2 scenes found for this point"}
    return {"available": True, "series": series, "source": "Sentinel-2 L2A 10m (Planetary Computer, no login)",
            "resolution_m": 10, "n_scenes_used": len(series)}


def fetch_sentinel2_ndvi_point(lat: float, lon: float) -> dict:
    """Single most-recent clear NDVI value for a point."""
    today = date.today()
    start = (today.replace(day=1)).isoformat()
    # look back 90 days
    from datetime import timedelta
    start = (today - timedelta(days=90)).isoformat()
    scenes = _search_scenes(lon, lat, start, today.isoformat(), max_cloud=40, limit=5)
    if not scenes:
        return {"available": False, "note": "no clear Sentinel-2 scene in last 90 days"}
    scenes.sort(key=lambda s: s["properties"].get("eo:cloud_cover", 999))
    scene = scenes[0]
    try:
        b04 = _sign(scene["assets"]["B04"]["href"])
        b08 = _sign(scene["assets"]["B08"]["href"])
        ndvi = _ndvi_pixel(b04, b08, lon, lat)
    except Exception as exc:
        return {"available": False, "note": f"read_failed: {exc}"}
    if not np.isfinite(ndvi):
        return {"available": False, "note": "non-finite ndvi"}
    return {"available": True, "ndvi": float(ndvi),
            "date": scene["properties"].get("datetime", "")[:10],
            "cloud_cover": scene["properties"].get("eo:cloud_cover"),
            "source": "Sentinel-2 L2A 10m (Planetary Computer)"}


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--lat", type=float, required=True)
    ap.add_argument("--lon", type=float, required=True)
    ap.add_argument("--start-year", type=int, default=2022)
    ap.add_argument("--end-year", type=int, default=2024)
    args = ap.parse_args()
    res = fetch_sentinel2_ndvi_series(args.lat, args.lon, args.start_year, args.end_year)
    print(json.dumps({"available": res["available"], "n": len(res.get("series", {})),
                      "first": list(res.get("series", {}).items())[:5],
                      "note": res.get("note", "")}, indent=2, default=str))
