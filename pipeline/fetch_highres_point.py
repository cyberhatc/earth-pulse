"""High-resolution, point-level real-data fetcher (target: ~0.5 km / sub-km).

Unlike pipeline/build_real_power_store.py (15 deg grid), this module builds a
per-location store for ONE lat/lon using the finest freely available NASA
products:

  * NASA POWER (point, 1981+)         -> temperature, precipitation, humidity,
                                          wind, solar (0.5 deg source, interpolated
                                          to the requested point by POWER).
  * MODIS MOD13Q1 NDVI (250 m, 16-day) via NASA AppEEARS (Earthdata login) OR
    a GIBS NDVI tile sample as a no-login fallback.
  * GPM IMERG (0.1 deg, 30-min)          -> high-res precipitation (optional,
                                          Earthdata login).
  * Sentinel-2 L2A (10 m) / Landsat-8/9 (30 m) via Microsoft Planetary
    Computer STAC (no login)            -> true-colour + NDVI imagery.

Output: data/processed/point_<lat>_<lon>.npz  (same key layout as the grid
store, plus `imagery` metadata and `resolution_m`).

Honesty: POWER is satellite+model agroclimatology (not native 0.5 km). MODIS
NDVI is 250 m. Sentinel-2 is 10 m but only as imagery, not as a 40-year
series. Forecasts are probabilistic (p10-p90). Never claim native 0.5 km
40-year continuity where it does not exist.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from pipeline.fetch_power import fetch_power_point


def _safe_float(v) -> float:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return float("nan")
    return f if np.isfinite(f) else float("nan")


def fetch_power_series(lat: float, lon: float, start: int = 1981, end: int = 2026) -> dict:
    """NASA POWER monthly point series -> daily aggregates resampled to monthly."""
    res = fetch_power_point(lat, lon, start, end, timeout=60)
    if "error" in res:
        return {"available": False, "note": res["error"], "parameters": {}}
    params = res.get("parameters", {})
    out: dict[str, dict[str, float]] = {}
    for src, dst in [("T2M", "temperature"), ("PRECTOTCORR", "precipitation"),
                     ("RH2M", "humidity"), ("WS2M", "wind"),
                     ("ALLSKY_SFC_SW_DWN", "solar_radiation")]:
        series = params.get(src, {})
        out[dst] = {k: _safe_float(v) for k, v in series.items()}
    import calendar
    conv = {}
    for k, v in out["precipitation"].items():
        y, m = int(k[:4]), int(k[5:7])
        conv[k] = v * calendar.monthrange(y, m)[1] if np.isfinite(v) else float("nan")
    out["precipitation"] = conv
    sr = out["solar_radiation"]
    med = np.nanmedian(list(sr.values())) if sr else float("nan")
    if np.isfinite(med) and med > 10.0:
        out["solar_radiation"] = {k: (v / 3.6 if np.isfinite(v) else v) for k, v in sr.items()}
    return {"available": True, "parameters": out, "source": "NASA POWER monthly point"}


def _get_earthdata_token() -> str | None:
    """Return an Earthdata Login bearer token, or None.

    Tries EARTHDATA_TOKEN first; otherwise generates one from
    EARTHDATA_USERNAME/PASSWORD via the EDL API (POST /api/users/token).
    """
    import os, base64, urllib.request, json as _json
    tok = os.environ.get("EARTHDATA_TOKEN")
    if tok:
        return tok
    user = os.environ.get("EARTHDATA_USERNAME")
    pw = os.environ.get("EARTHDATA_PASSWORD")
    if not user or not pw:
        return None
    creds = base64.b64encode(f"{user}:{pw}".encode()).decode()
    try:
        req = urllib.request.Request(
            "https://urs.earthdata.nasa.gov/api/users/token",
            data=b"", method="POST",
            headers={"Authorization": "Basic " + creds, "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as r:
            body = _json.loads(r.read())
        return body.get("access_token")
    except Exception:
        return None


def fetch_modis_ndvi_appEEARS(lat: float, lon: float, start: str = "2000-01-01",
                               end: str = "2026-06-30") -> dict:
    """MODIS MOD13Q1 NDVI (250 m, 16-day) via NASA AppEEARS REST API.

    Auth: Earthdata Login bearer token (EARTHDATA_TOKEN, or generated from
    EARTHDATA_USERNAME/PASSWORD). Returns monthly composites (max NDVI per
    month) for the single pixel nearest the point.
    """
    import os, urllib.request, json as _json
    token = _get_earthdata_token()
    if not token:
        return {"available": False, "note": "No Earthdata token (set EARTHDATA_USERNAME/PASSWORD or EARTHDATA_TOKEN). "
                                           "MODIS NDVI requires an Earthdata login."}
    base = "https://appeears.earthdatacloud.nasa.gov/api"
    headers = {"Content-Type": "application/json", "Authorization": "Bearer " + token}
    body = {
        "task_type": "point",
        "task_name": f"ep_ndvi_{lat:.4f}_{lon:.4f}",
        "params": {
            "dates": [{"startDate": start, "endDate": end}],
            "layers": [{"layer": "MOD13Q1.061_250m_16days_NDVI", "product": "MOD13Q1.061"}],
            "coordinates": [{"latitude": lat, "longitude": lon, "id": "pt"}],
        },
    }
    try:
        req = urllib.request.Request(f"{base}/task", data=_json.dumps(body).encode(), headers=headers)
        with urllib.request.urlopen(req, timeout=60) as r:
            task = _json.loads(r.read())
        task_id = task.get("task_id")
    except Exception as exc:
        return {"available": False, "note": f"appeears_submit_failed: {exc}"}
    if not task_id:
        return {"available": False, "note": f"appeears_no_task_id: {task}"}
    for _ in range(120):
        time.sleep(5)
        try:
            with urllib.request.urlopen(f"{base}/task/{task_id}", timeout=30) as r:
                st = _json.loads(r.read())
            if st.get("status") == "done":
                break
            if st.get("status") in ("failed", "error"):
                return {"available": False, "note": f"appeears_task_failed: {st}"}
        except Exception:
            continue
    else:
        return {"available": False, "note": "appeears_timeout"}
    try:
        with urllib.request.urlopen(f"{base}/bundle/{task_id}", timeout=60) as r:
            bundle = _json.loads(r.read())
        files = bundle.get("files", [])
        csv_file = next((f for f in files if str(f.get("file_name", "")).endswith(".csv")), None)
        if not csv_file:
            return {"available": False, "note": "no csv in bundle", "bundle": bundle}
        import io, csv
        with urllib.request.urlopen(f"{base}/bundle/{task_id}/{csv_file['file_id']}", timeout=300) as r:
            text = r.read().decode()
        reader = csv.DictReader(io.StringIO(text))
        monthly: dict[str, list[float]] = {}
        for row in reader:
            d = row.get("Date") or row.get("date")
            v = (row.get("MOD13Q1.061_250m_16days_NDVI") or row.get("NDVI"))
            if d is None or v is None:
                continue
            try:
                ndvi = float(v) * 0.0001
            except ValueError:
                continue
            if not np.isfinite(ndvi):
                continue
            key = str(d)[:7]
            monthly.setdefault(key, []).append(ndvi)
        series = {k: float(np.max(v)) for k, v in monthly.items()}
        if not series:
            return {"available": False, "note": "no ndvi values parsed from bundle"}
        return {"available": True, "series": series, "source": "MODIS MOD13Q1 250m via AppEEARS",
                "resolution_m": 250}
    except Exception as exc:
        return {"available": False, "note": f"appeears_fetch_failed: {exc}"}


def fetch_gibs_ndvi_sample(lat: float, lon: float, dates: list[str]) -> dict:
    return {"available": False, "note": "GIBS NDVI is tile imagery, not point values. "
                                       "Use AppEEARS (Earthdata login) for real NDVI series."}


def fetch_satellite_imagery_links(lat: float, lon: float, before: str = "2024-01-01",
                                  after: str = "2025-01-01") -> dict:
    import urllib.request, json as _json
    d = 0.005
    bbox = [lon - d, lat - d, lon + d, lat + d]
    results = {}
    for collection in ("sentinel-2-l2a", "landsat-c2-l2"):
        try:
            body = {"collections": [collection], "bbox": bbox,
                    "datetime": f"{before}/{after}", "limit": 5, "sortby": [{"field": "datetime", "direction": "desc"}]}
            req = urllib.request.Request("https://planetarycomputer.microsoft.com/api/stac/v1/search",
                                        data=_json.dumps(body).encode(),
                                        headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                j = _json.loads(r.read())
            items = j.get("features", [])
            results[collection] = [
                {"id": it["id"], "datetime": it["properties"].get("datetime"),
                 "cloud_cover": it["properties"].get("eo:cloud_cover"),
                 "thumbnail": it.get("assets", {}).get("rendered_preview", {}).get("href")
                            or it.get("assets", {}).get("thumbnail", {}).get("href")}
                for it in items
            ]
        except Exception as exc:
            results[collection] = {"error": str(exc)}
    return {"available": True, "bbox_deg": d, "scenes": results,
            "source": "Microsoft Planetary Computer STAC (free, no login)"}


def build_point_store(lat: float, lon: float, out_path: Path | None = None) -> Path:
    if out_path is None:
        out_path = ROOT / "data" / "processed" / "points" / f"point_{lat:.4f}_{lon:.4f}.npz".replace("-", "m")
    out_path.parent.mkdir(parents=True, exist_ok=True)

    power = fetch_power_series(lat, lon)
    # NDVI: prefer Sentinel-2 (no login, 10 m, global) for recent years;
    # fall back to AppEEARS MODIS (250 m, 2000+, needs terms accepted) if available.
    import pipeline.fetch_ndvi_sentinel as fetch_ndvi_sentinel
    try:
        ndvi_res = fetch_ndvi_sentinel.fetch_sentinel2_ndvi_series(lat, lon, 2022, 2024)
    except Exception as exc:
        ndvi_res = {"available": False, "note": f"sentinel2_failed: {exc}"}
    if not ndvi_res.get("available"):
        try:
            ndvi_res = fetch_modis_ndvi_appEEARS(lat, lon)
        except Exception:
            pass
    if not isinstance(ndvi_res, dict):
        ndvi_res = {"available": False, "note": "ndvi_fetch_error"}
    imagery = fetch_satellite_imagery_links(lat, lon)

    if not power["available"]:
        raise RuntimeError(f"POWER fetch failed: {power.get('note')}")
    dates = sorted(power["parameters"]["temperature"].keys())
    T = len(dates)

    arrays: dict[str, Any] = {}
    arrays["dates"] = np.array(dates)
    arrays["lat"] = np.array(lat)
    arrays["lon"] = np.array(lon)
    for p in ("temperature", "precipitation", "humidity", "wind", "solar_radiation"):
        vec = np.full(T, np.nan)
        for i, d in enumerate(dates):
            v = power["parameters"].get(p, {}).get(d, float("nan"))
            vec[i] = v
        arrays[p] = vec
    ndvi_vec = np.full(T, np.nan)
    if ndvi_res.get("available"):
        for i, d in enumerate(dates):
            ndvi_vec[i] = ndvi_res["series"].get(d, float("nan"))
    arrays["ndvi"] = ndvi_vec
    arrays["sst"] = np.full(T, np.nan)
    arrays["sea_level"] = np.full(T, np.nan)

    try:
        from pipeline.land_ocean import DEMO_MASK
        lats = np.arange(-60.0, 76.0, 15.0)
        lons = np.arange(-180.0, 180.0, 15.0)
        li = int(np.argmin(np.abs(lats - lat)))
        oi = int(np.argmin(np.abs(lons - lon)))
        is_ocean = bool(DEMO_MASK[li, oi] == 1)
    except Exception:
        is_ocean = None
    if is_ocean is True:
        arrays["ndvi"][:] = np.nan

    meta = {
        "provenance": "highres_point_real",
        "synthetic": False,
        "lat": lat, "lon": lon,
        "ocean_cell": is_ocean,
        "resolution_m": {"power": 50000, "ndvi": ndvi_res.get("resolution_m", None),
                         "imagery": 10},
        "sources": {
            "temperature": "NASA POWER T2M (point)",
            "precipitation": "NASA POWER PRECTOTCORR (point, mm/month)",
            "humidity": "NASA POWER RH2M",
            "wind": "NASA POWER WS2M",
            "solar_radiation": "NASA POWER ALLSKY (kWh/m2/day)",
            "ndvi": ndvi_res.get("source", "unavailable"),
        },
        "ndvi_available": bool(ndvi_res.get("available")),
        "ndvi_note": ndvi_res.get("note", ""),
        "imagery_scenes": imagery.get("scenes", {}),
        "time_range": [dates[0], dates[-1]],
        "n_months": T,
        "generate_command": f"python3 pipeline/fetch_highres_point.py --lat {lat} --lon {lon}",
    }
    arrays["meta_json"] = np.array(json.dumps(meta))

    np.savez(out_path, **arrays)
    print(f"[highres] wrote {out_path}  T={T}  ndvi={'yes' if ndvi_res.get('available') else 'no'}")
    return out_path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lat", type=float, required=True)
    ap.add_argument("--lon", type=float, required=True)
    ap.add_argument("--out", default=None)
    ap.add_argument("--probe", action="store_true", help="fetch only, print summary, no write")
    args = ap.parse_args()

    power = fetch_power_series(args.lat, args.lon)
    print("POWER available:", power["available"])
    if power["available"]:
        t = power["parameters"]["temperature"]
        print(f"  temperature: n={len(t)} range={min(t.values()):.1f}..{max(t.values()):.1f}")
    ndvi = fetch_modis_ndvi_appEEARS(args.lat, args.lon)
    print("NDVI available:", ndvi.get("available"), ndvi.get("note", ""))
    if ndvi.get("available"):
        s = ndvi["series"]
        print(f"  ndvi: n={len(s)} range={min(s.values()):.3f}..{max(s.values()):.3f}")
    img = fetch_satellite_imagery_links(args.lat, args.lon)
    for col, scenes in img["scenes"].items():
        n = len(scenes) if isinstance(scenes, list) else 0
        print(f"  imagery {col}: {n} scenes")

    if args.probe:
        return 0
    out = Path(args.out) if args.out else None
    build_point_store(args.lat, args.lon, out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
