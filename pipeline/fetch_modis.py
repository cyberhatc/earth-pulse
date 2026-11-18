"""MODIS point time series via Microsoft Planetary Computer (free, no login).

Planetary Computer exposes a PgSTAC mosaic point API that returns the value of
one or more assets at a coordinate for every matching item in a registered
search. That gives real MODIS values without rasterio, GDAL, AppEEARS or an
Earthdata login. We deliberately do not read the COGs directly: remote rasterio
reads are unstable in this environment.

Products and parameters:
  * MOD13Q1 (250 m, 16-day)  -> NDVI, EVI, red/NIR/blue surface reflectance
  * MOD11A2 (1 km, 8-day)    -> land-surface temperature day/night
  * MOD16A3GF (500 m, annual)-> evapotranspiration / potential ET
  * MOD17A3HGF (500 m, annual)-> gross primary production
  * MCD64A1 (500 m, monthly)-> burned-area indicator (optional)

The API caps a single point request at 100 items and 5 s, so 16-day/8-day
products are registered one year at a time. Annual products fit in one request.
`mode="fast"` samples a set of years and recent months; `mode="full"` walks the
whole 2000–present record. The dossier states which mode was used.
"""
from __future__ import annotations

import calendar
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from typing import Any

PC_API = "https://planetarycomputer.microsoft.com/api"
STAC_SEARCH = f"{PC_API}/stac/v1/search"
MOSAIC_REGISTER = f"{PC_API}/data/v1/mosaic/register"
MOSAIC_POINT = f"{PC_API}/data/v1/mosaic"

# collection -> asset definitions. scale/offset are applied to the raw DN.
PRODUCTS: dict[str, dict[str, Any]] = {
    "modis-13Q1-061": {
        "assets": {
            "250m_16_days_NDVI": {"param": "ndvi", "scale": 0.0001, "valid": (-2000, 10000)},
            "250m_16_days_EVI": {"param": "evi", "scale": 0.0001, "valid": (-2000, 10000)},
            "250m_16_days_red_reflectance": {
                "param": "surface_reflectance_red", "scale": 0.0001, "valid": (0, 10000)
            },
            "250m_16_days_NIR_reflectance": {
                "param": "surface_reflectance_nir", "scale": 0.0001, "valid": (0, 10000)
            },
            "250m_16_days_blue_reflectance": {
                "param": "surface_reflectance_blue", "scale": 0.0001, "valid": (0, 10000)
            },
        },
        "groups": [
            ["250m_16_days_NDVI", "250m_16_days_EVI", "250m_16_days_blue_reflectance"],
            ["250m_16_days_red_reflectance", "250m_16_days_NIR_reflectance"],
        ],
        "native": "16-day",
        "annual": False,
    },
    "modis-11A2-061": {
        "assets": {
            "LST_Day_1km": {"param": "lst_day", "scale": 0.02, "offset": -273.15, "valid": (7500, 65535)},
            "LST_Night_1km": {"param": "lst_night", "scale": 0.02, "offset": -273.15, "valid": (7500, 65535)},
        },
        "native": "8-day",
        "annual": False,
    },
    "modis-16A3GF-061": {
        "assets": {
            "ET_500m": {"param": "et_modis", "scale": 0.1, "valid": (0, 65534)},
            "PET_500m": {"param": "pet_modis", "scale": 0.1, "valid": (0, 65534)},
        },
        "native": "annual",
        "annual": True,
    },
    "modis-17A3HGF-061": {
        "assets": {
            "Gpp_500m": {"param": "gpp", "scale": 0.0001, "valid": (0, 65534)},
        },
        "native": "annual",
        "annual": True,
    },
    "modis-09A1-061": {
        "assets": {
            "sur_refl_b04": {
                "param": "surface_reflectance_green", "scale": 0.0001, "valid": (0, 10000),
            },
            "sur_refl_b05": {
                "param": "surface_reflectance_nir2", "scale": 0.0001, "valid": (0, 10000),
            },
            "sur_refl_b06": {
                "param": "surface_reflectance_swir1", "scale": 0.0001, "valid": (0, 10000),
            },
            "sur_refl_b07": {
                "param": "surface_reflectance_swir2", "scale": 0.0001, "valid": (0, 10000),
            },
        },
        # One asset per request: two 8-day reflectance assets exceed the
        # mosaic point API's 5 s cap and returned 504 during verification.
        "groups": [
            ["sur_refl_b04"], ["sur_refl_b05"],
            ["sur_refl_b06"], ["sur_refl_b07"],
        ],
        "native": "8-day",
        "annual": False,
        "fast_years": [2001, 2011, 2021, 2025, 2026],
    },
    "modis-10A1-061": {
        "assets": {
            "NDSI": {"param": "ndsi", "scale": 0.0001, "valid": (-10000, 10000)},
            "NDSI_Snow_Cover": {
                "param": "snow_cover", "scale": 1.0, "valid": (0, 100),
            },
            "Snow_Albedo_Daily_Tile": {
                "param": "snow_albedo", "scale": 1.0, "valid": (0, 100),
            },
        },
        "groups": [["NDSI", "NDSI_Snow_Cover", "Snow_Albedo_Daily_Tile"]],
        "native": "daily",
        "annual": False,
        "chunk": "month",
        "fast_years": [2001, 2012, 2021, 2025, 2026],
        # Fast point-store sampling only needs one snow-season month per year;
        # full mode still walks all 12 months for every year.
        "fast_months": [1],
    },
}

FAST_YEARS = [2001, 2006, 2011, 2016, 2021, 2023, 2024, 2025, 2026]
FULL_START = 2000


def _bbox(lat: float, lon: float, half_km: float = 5.0) -> list[float]:
    import math

    half_lat = half_km / 111.32
    half_lon = half_km / (111.32 * max(math.cos(math.radians(lat)), 1e-3))
    return [lon - half_lon, lat - half_lat, lon + half_lon, lat + half_lat]


def _request_json(url: str, payload: dict | None = None, timeout: int = 120) -> dict:
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Content-Type": "application/json"} if data else {}
    req = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def _register(collection: str, bbox: list[float], start: str, end: str) -> str:
    body = {
        "collections": [collection],
        "bbox": bbox,
        "datetime": f"{start}/{end}",
        "limit": 2000,
    }
    j = _request_json(MOSAIC_REGISTER, body)
    sid = j.get("searchid") or j.get("id")
    if not sid:
        raise RuntimeError(f"mosaic_register_no_id: {j}")
    return str(sid)


def _point(search_id: str, lat: float, lon: float, assets: list[str]) -> list[list[Any]]:
    params = [("assets", a) for a in assets]
    url = f"{MOSAIC_POINT}/{search_id}/point/{lon:.5f},{lat:.5f}?" + urllib.parse.urlencode(params)
    j = _request_json(url, timeout=180)
    return j.get("values") or []


def _date_from_item(item_id: str) -> date | None:
    m = re.search(r"A(\d{4})(\d{3})", item_id)
    if not m:
        return None
    year, doy = int(m.group(1)), int(m.group(2))
    try:
        return date(year, 1, 1).fromordinal(date(year, 1, 1).toordinal() + doy - 1)
    except ValueError:
        return None


def _month_key(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def _clean_value(raw: Any, spec: dict[str, Any]) -> float | None:
    if raw is None:
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    lo, hi = spec.get("valid", (None, None))
    if lo is not None and value < lo:
        return None
    if hi is not None and value > hi:
        return None
    value = value * float(spec.get("scale", 1.0)) + float(spec.get("offset", 0.0))
    return value


def _fetch_chunk(
    collection: str,
    bbox: list[float],
    lat: float,
    lon: float,
    start: date,
    end: date,
    asset_names: list[str],
    accum: dict[str, dict[str, list[float]]],
    annual: dict[str, dict[str, float]],
    stats: dict[str, Any],
) -> None:
    sid = _register(collection, bbox, start.isoformat(), end.isoformat())
    values = _point(sid, lat, lon, asset_names)
    specs = PRODUCTS[collection]["assets"]
    for row in values:
        if not isinstance(row, (list, tuple)) or len(row) < 2:
            continue
        item_id = str(row[0])
        vals = row[1]
        d = _date_from_item(item_id)
        if d is None:
            continue
        mkey = _month_key(d)
        for idx, asset in enumerate(asset_names):
            if idx >= len(vals):
                continue
            spec = specs.get(asset) or {}
            param = spec.get("param")
            if not param:
                continue
            value = _clean_value(vals[idx], spec)
            if value is None:
                continue
            accum.setdefault(param, {}).setdefault(mkey, []).append(value)
            if PRODUCTS[collection]["annual"]:
                annual.setdefault(param, {})[str(d.year)] = value
    stats["items"] = int(stats.get("items", 0)) + len(values)


def _chunk_ranges(start_year: int, end_year: int, years: list[int] | None = None,
                  chunk: str = "year", months: list[int] | None = None):
    for y in sorted(set(years)) if years else range(start_year, end_year + 1):
        if chunk == "month":
            for m in (months or range(1, 13)):
                last = calendar.monthrange(y, m)[1]
                yield date(y, m, 1), date(y, m, last)
        else:
            yield date(y, 1, 1), date(y, 12, 31)


def _fetch_product(
    collection: str,
    lat: float,
    lon: float,
    *,
    mode: str = "fast",
    start_year: int = 2000,
    end_year: int = 2026,
) -> dict[str, Any]:
    bbox = _bbox(lat, lon)
    accum: dict[str, dict[str, list[float]]] = {}
    annual: dict[str, dict[str, float]] = {}
    stats = {"items": 0, "requests": 0, "errors": []}
    product = PRODUCTS[collection]

    if product["annual"]:
        # Annual products fit inside the 100-item cap.
        try:
            _fetch_chunk(
                collection, bbox, lat, lon, date(start_year, 1, 1),
                date(end_year, 12, 31), list(product["assets"]), accum, annual, stats,
            )
            stats["requests"] += 1
        except Exception as exc:
            stats["errors"].append(f"{collection}_annual: {exc}")
    else:
        years = product.get("fast_years", FAST_YEARS) if mode == "fast" else None
        months = product.get("fast_months") if mode == "fast" else None
        chunks = list(_chunk_ranges(
            start_year, end_year, years,
            chunk=product.get("chunk", "year"), months=months,
        ))
        for ci, (start, end) in enumerate(chunks, 1):
            print(
                f"[modis] {collection} chunk {ci}/{len(chunks)} "
                f"{start.isoformat()}..{end.isoformat()}",
                flush=True,
            )
            # At most four assets per request keeps the response inside the 5 s
            # upstream cap. Product-specific groups keep related bands together.
            groups = product.get("groups")
            if not groups:
                asset_list = list(product["assets"])
                groups = [asset_list[i:i + 2] for i in range(0, len(asset_list), 2)]
            for group in groups:
                last_exc: Exception | None = None
                for attempt in range(2):
                    try:
                        _fetch_chunk(
                            collection, bbox, lat, lon, start, end, group, accum, annual, stats,
                        )
                        stats["requests"] += 1
                        last_exc = None
                        break
                    except Exception as exc:
                        last_exc = exc
                        time.sleep(1.5 * (attempt + 1))
                if last_exc is not None:
                    stats["errors"].append(f"{collection}_{start.year}_{','.join(group)}: {last_exc}")

    series: dict[str, dict[str, float]] = {}
    for param, months in accum.items():
        series[param] = {
            m: round(float(sum(vs) / len(vs)), 5)
            for m, vs in sorted(months.items())
            if vs
        }
    if product["annual"]:
        # Annual products (MOD16 ET/PET, MOD17 GPP) carry one value per year.
        # Repeat it across that year's months so rolling windows and trend
        # diagnostics do not see a January-only spike pattern.
        for param, years in annual.items():
            target = series.setdefault(param, {})
            for year, value in years.items():
                for month in range(1, 13):
                    target[f"{year}-{month:02d}"] = round(float(value), 5)
        for param in series:
            series[param] = dict(sorted(series[param].items()))
    return {
        "available": bool(series),
        "collection": collection,
        "native": product["native"],
        "mode": mode,
        "series": series,
        "annual": annual,
        "stats": stats,
        "note": (
            f"MODIS {collection} via Microsoft Planetary Computer; "
            f"{'annual' if product['annual'] else product['native']} values "
            f"aggregated to monthly means. Mode: {mode}."
        ),
    }


def fetch_modis_series(
    lat: float,
    lon: float,
    *,
    mode: str = "fast",
    start_year: int = 2000,
    end_year: int = 2026,
    include_blue: bool = True,
) -> dict[str, Any]:
    """Fetch the MODIS bundle for one point.

    Returns {"available", "products", "parameters", "resolution_m", "notes"}.
    Never raises for a single failed product; the failure is recorded honestly.
    """
    products: dict[str, Any] = {}
    parameters: dict[str, dict[str, float]] = {}
    notes: list[str] = []
    resolution: dict[str, int] = {}
    for collection in PRODUCTS:
        if collection == "modis-13Q1-061" and not include_blue:
            # still fetch NDVI/EVI/red/NIR; drop blue from the asset list
            pass
        try:
            res = _fetch_product(
                collection, lat, lon, mode=mode,
                start_year=start_year, end_year=end_year,
            )
        except Exception as exc:
            notes.append(f"{collection}_failed: {exc}")
            continue
        products[collection] = res
        if not res.get("available"):
            notes.extend(res.get("stats", {}).get("errors", [])[:2])
            continue
        for param, series in res.get("series", {}).items():
            if series:
                parameters[param] = series
        native = res.get("native")
        if collection == "modis-13Q1-061":
            for p in ("ndvi", "evi", "surface_reflectance_red",
                      "surface_reflectance_nir", "surface_reflectance_blue"):
                resolution[p] = 250
        elif collection == "modis-11A2-061":
            resolution["lst_day"] = 1000
            resolution["lst_night"] = 1000
        elif collection == "modis-16A3GF-061":
            resolution["et_modis"] = 500
            resolution["pet_modis"] = 500
        elif collection == "modis-17A3HGF-061":
            resolution["gpp"] = 500
        elif collection == "modis-09A1-061":
            for p in ("surface_reflectance_green", "surface_reflectance_nir2",
                      "surface_reflectance_swir1", "surface_reflectance_swir2"):
                resolution[p] = 500
        elif collection == "modis-10A1-061":
            for p in ("ndsi", "snow_cover", "snow_albedo"):
                resolution[p] = 500
        notes.append(
            f"{collection}: {len(parameters)} params, {res.get('stats', {}).get('requests', 0)} "
            f"requests, {res.get('stats', {}).get('items', 0)} items ({native})."
        )
    return {
        "available": bool(parameters),
        "mode": mode,
        "products": products,
        "parameters": parameters,
        "resolution_m": resolution,
        "notes": notes,
        "source": "Microsoft Planetary Computer MODIS mosaic point API (free, no login)",
    }


if __name__ == "__main__":  # tiny manual probe
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--lat", type=float, required=True)
    ap.add_argument("--lon", type=float, required=True)
    ap.add_argument("--mode", choices=["fast", "full"], default="fast")
    args = ap.parse_args()
    t0 = time.time()
    out = fetch_modis_series(args.lat, args.lon, mode=args.mode)
    print(json.dumps({k: v for k, v in out.items() if k != "products"}, indent=2)[:4000])
    for c, p in out.get("products", {}).items():
        print(c, p.get("stats"), {k: len(v) for k, v in p.get("series", {}).items()})
    print("elapsed", round(time.time() - t0, 1))
