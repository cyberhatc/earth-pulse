"""High-resolution, point-level real-data store.

The store is a single npz with one value per month and parameter, aligned to the
NASA POWER monthly record (1981+). Sources:

  * NASA POWER monthly point archive (0.5° × 0.625° source, interpolated to the
    coordinate by POWER) — meteorology, radiation, water balance, AOD.
  * Open-Meteo ERA5 archive (0.25°) — independent reanalysis plus variables that
    POWER does not expose (apparent temperature, gusts, VPD, soil layers).
  * Open-Meteo Air Quality / CAMS — PM, NO₂, SO₂, O₃, CO, dust, UV (2023+).
  * MODIS via Microsoft Planetary Computer — NDVI/EVI/reflectance, LST day/night,
    annual ET/PET and GPP (2000+). Values are read through the free mosaic point
    API; no Earthdata login and no rasterio/GDAL.

Honesty: the nominal 10 × 10 km box is not resolved by the 40-year records.
POWER is ~55 × 62 km, ERA5 ~28 km, MODIS 250 m–1 km. The dossier reports those
effective resolutions and never upsamples a coarse source to pretend otherwise.
"""
from __future__ import annotations

import argparse
import calendar
import json
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from pipeline.fetch_power import fetch_power_point, DEFAULT_PARAMS
from pipeline.fetch_openmeteo import fetch_openmeteo_monthly
from pipeline.fetch_air_quality import fetch_air_quality_monthly
from pipeline.fetch_modis import fetch_modis_series
from models.parameter_registry import (
    PARAMETERS,
    PARAM_ORDER,
    SATELLITE_PARAMS,
    parameter_meta,
)


def _safe_float(v) -> float:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return float("nan")
    # POWER signals missing months with -999; treat it as missing, not data.
    if not np.isfinite(f) or f <= -998.0:
        return float("nan")
    return f


# parameter -> (POWER variable, conversion)
POWER_MAP: dict[str, tuple[str, str]] = {
    "temperature": ("T2M", "identity"),
    "temperature_max": ("T2M_MAX", "identity"),
    "temperature_min": ("T2M_MIN", "identity"),
    "temperature_range": ("T2M_RANGE", "identity"),
    "dew_point": ("T2MDEW", "identity"),
    "skin_temperature": ("TS", "identity"),
    "humidity": ("RH2M", "identity"),
    "specific_humidity": ("QV2M", "identity"),
    "surface_pressure": ("PS", "identity"),
    "wind": ("WS2M", "identity"),
    "wind_10m": ("WS10M", "identity"),
    "wind_direction": ("WD2M", "identity"),
    "solar_radiation": ("ALLSKY_SFC_SW_DWN", "mj_to_kwh"),
    "clear_sky_solar_radiation": ("CLRSKY_SFC_SW_DWN", "mj_to_kwh"),
    "longwave_radiation": ("ALLSKY_SFC_LW_DWN", "identity"),
    "par": ("ALLSKY_SFC_PAR_TOT", "identity"),
    "precipitation": ("PRECTOTCORR", "monthly_mm"),
    "evapotranspiration": ("EVPTRNS", "monthly_mm_from_daily"),
    "evaporation": ("EVLAND", "monthly_mm_from_daily"),
    "soil_moisture_surface": ("GWETTOP", "identity"),
    "soil_moisture_rootzone": ("GWETROOT", "identity"),
    "soil_moisture_profile": ("GWETPROF", "identity"),
    "frost_days": ("FROST_DAYS", "identity"),
    "aerosol_optical_depth": ("AOD_55", "identity"),
}

# Open-Meteo fields that are kept even when POWER has a similarly named field.
# For temperature/precipitation/wind/solar we keep POWER as the primary series
# and use Open-Meteo only as the independent cross-check in the dossier.
OM_KEEP = {
    "apparent_temperature",
    "pressure_msl",
    "cloud_cover",
    "wind_gusts",
    "vapour_pressure_deficit",
    "sunshine_duration",
    "rainfall",
    "snowfall",
    "et_reference",
    "soil_moisture_0_7cm",
    "soil_moisture_7_28cm",
    "soil_moisture_28_100cm",
    "soil_temperature_0_7cm",
    "soil_temperature_7_28cm",
}

# Extra POWER components used only to derive net radiation. They are not
# exposed as separate registry parameters.
DERIVED_POWER_SOURCES = ["ALLSKY_SFC_SW_UP", "ALLSKY_SFC_LW_UP"]

AIR_QUALITY_PARAMS = {
    "pm2_5", "pm10", "nitrogen_dioxide", "sulphur_dioxide", "ozone",
    "carbon_monoxide", "dust", "uv_index",
}


def _convert(value: float, kind: str, year: int, month: int) -> float:
    if not np.isfinite(value):
        return float("nan")
    if kind == "monthly_mm":
        return value * calendar.monthrange(year, month)[1]
    if kind == "monthly_mm_from_daily":
        return value * calendar.monthrange(year, month)[1]
    if kind == "mj_to_kwh":
        return value / 3.6
    return value


def fetch_power_series(lat: float, lon: float, start: int = 1981, end: int = 2026) -> dict:
    """NASA POWER monthly point series for the full registry."""
    source_params = sorted({src for src, _ in POWER_MAP.values()} | set(DERIVED_POWER_SOURCES))
    res = fetch_power_point(lat, lon, start, end, parameters=source_params, timeout=120)
    if "error" in res:
        return {"available": False, "note": res["error"], "parameters": {}}
    params = res.get("parameters", {})
    out: dict[str, dict[str, float]] = {}
    for param, (src, kind) in POWER_MAP.items():
        series = params.get(src, {})
        converted: dict[str, float] = {}
        for key, raw in series.items():
            try:
                year, month = int(key[:4]), int(key[5:7])
            except (ValueError, TypeError):
                continue
            value = _safe_float(raw)
            converted[key] = _convert(value, kind, year, month)
        out[param] = converted
    # Net radiation = downwelling shortwave + longwave minus the upward terms.
    # POWER reports these in MJ/m²/day, so no unit conversion is required.
    sw_dn = params.get("ALLSKY_SFC_SW_DWN", {})
    sw_up = params.get("ALLSKY_SFC_SW_UP", {})
    lw_dn = params.get("ALLSKY_SFC_LW_DWN", {})
    lw_up = params.get("ALLSKY_SFC_LW_UP", {})
    net: dict[str, float] = {}
    for key in sorted(sw_dn):
        parts = [series.get(key) for series in (sw_dn, sw_up, lw_dn, lw_up)]
        if all(part is not None and np.isfinite(float(part)) for part in parts):
            net[key] = float(parts[0]) - float(parts[1]) + float(parts[2]) - float(parts[3])
    if net:
        out["net_radiation"] = net
    return {
        "available": bool(out.get("temperature")),
        "parameters": out,
        "source": "NASA POWER monthly point (1981+)",
    }


def _get_earthdata_token() -> str | None:
    """Return an Earthdata Login bearer token, or None.

    Kept as an optional path for AppEEARS fallback. The default MODIS route is
    Microsoft Planetary Computer and needs no login.
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
    """Optional AppEEARS fallback; requires an Earthdata token."""
    import urllib.request, json as _json
    token = _get_earthdata_token()
    if not token:
        return {"available": False, "note": "No Earthdata token (set EARTHDATA_USERNAME/PASSWORD or EARTHDATA_TOKEN)."}
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
            return {"available": False, "note": "no csv in bundle"}
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
            monthly.setdefault(str(d)[:7], []).append(ndvi)
        series = {k: float(np.max(v)) for k, v in monthly.items()}
        if not series:
            return {"available": False, "note": "no ndvi values parsed from bundle"}
        return {"available": True, "series": series, "source": "MODIS MOD13Q1 250m via AppEEARS",
                "resolution_m": 250}
    except Exception as exc:
        return {"available": False, "note": f"appeears_fetch_failed: {exc}"}


def fetch_satellite_imagery_links(lat: float, lon: float, before: str = "2024-01-01",
                                  after: str = "2026-11-01") -> dict:
    import urllib.request, json as _json
    d = 0.005
    bbox = [lon - d, lat - d, lon + d, lat + d]
    results = {}
    for collection in ("sentinel-2-l2a", "landsat-c2-l2"):
        try:
            body = {"collections": [collection], "bbox": bbox,
                    "datetime": f"{before}/{after}", "limit": 5,
                    "sortby": [{"field": "datetime", "direction": "desc"}]}
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


def _merge_series(
    values: dict[str, np.ndarray],
    meta: dict[str, Any],
    source_params: dict[str, dict[str, float]],
    source_label: str,
    allowed: set[str] | None = None,
) -> None:
    """Merge a {param: {YYYY-MM: value}} mapping into aligned arrays."""
    dates = list(values["dates"])
    for param, series in source_params.items():
        if allowed is not None and param not in allowed:
            continue
        if param not in PARAMETERS or not series:
            continue
        vec = values.get(param)
        if vec is None:
            vec = np.full(len(dates), np.nan)
        vec = np.asarray(vec, dtype=float).copy()
        for i, key in enumerate(dates):
            raw = series.get(str(key))
            if raw is not None and np.isfinite(raw):
                vec[i] = float(raw)
        values[param] = vec
        meta.setdefault("sources", {})[param] = source_label
        rec = parameter_meta(param)
        rec["n"] = int(np.isfinite(vec).sum())
        rec["first"] = str(dates[int(np.where(np.isfinite(vec))[0][0])]) if np.isfinite(vec).any() else None
        rec["last"] = str(dates[int(np.where(np.isfinite(vec))[0][-1])]) if np.isfinite(vec).any() else None
        meta.setdefault("parameter_meta", {})[param] = rec


def _base_values(lat: float, lon: float) -> tuple[dict[str, Any], dict[str, Any]]:
    power = fetch_power_series(lat, lon)
    if not power["available"]:
        raise RuntimeError(f"POWER fetch failed: {power.get('note')}")
    dates = sorted(power["parameters"]["temperature"].keys())
    if not dates:
        raise RuntimeError("POWER returned no monthly temperature values")

    values: dict[str, Any] = {
        "dates": np.array(dates),
        "lat": np.array(lat),
        "lon": np.array(lon),
    }
    meta: dict[str, Any] = {
        "provenance": "highres_point_real",
        "synthetic": False,
        "lat": lat,
        "lon": lon,
        "sources": {},
        "parameter_meta": {},
        "resolution_m": {},
    }
    for p in PARAM_ORDER:
        values[p] = np.full(len(dates), np.nan)
    _merge_series(values, meta, power["parameters"], "NASA POWER monthly point")
    for p in ("temperature", "precipitation", "humidity", "wind", "solar_radiation"):
        if p in values:
            meta["resolution_m"][p] = PARAMETERS[p].get("resolution_m")

    # Open-Meteo: independent reanalysis, and fields POWER does not expose.
    try:
        om = fetch_openmeteo_monthly(lat, lon, force=False)
    except Exception as exc:
        om = {"available": False, "note": str(exc)}
    if om.get("available"):
        _merge_series(
            values, meta, om.get("parameters", {}),
            "Open-Meteo ERA5 archive (independent reanalysis)",
            allowed=OM_KEEP,
        )
        for p in OM_KEEP:
            if p in values and np.isfinite(values[p]).any():
                meta["resolution_m"][p] = 28000
    else:
        meta["openmeteo_note"] = om.get("note", "unavailable")

    # CAMS air quality (short record, 2023+).
    try:
        aq = fetch_air_quality_monthly(lat, lon, force=False)
    except Exception as exc:
        aq = {"available": False, "note": str(exc)}
    if aq.get("available"):
        _merge_series(
            values, meta, aq.get("parameters", {}),
            "Open-Meteo Air Quality (CAMS), short record 2023+",
            allowed=AIR_QUALITY_PARAMS,
        )
        for p in AIR_QUALITY_PARAMS:
            if p in values and np.isfinite(values[p]).any():
                meta["resolution_m"][p] = 11000
        meta["air_quality_period"] = aq.get("period")
    else:
        meta["air_quality_note"] = aq.get("note", "unavailable")

    meta["time_range"] = [dates[0], dates[-1]]
    meta["n_months"] = len(dates)
    meta["generate_command"] = f"python3 pipeline/fetch_highres_point.py --lat {lat} --lon {lon}"
    return values, meta


def _merge_modis(values: dict[str, Any], meta: dict[str, Any], mode: str = "fast") -> dict:
    try:
        modis = fetch_modis_series(
            float(values["lat"]), float(values["lon"]), mode=mode,
        )
    except Exception as exc:
        meta["satellite_note"] = f"modis_failed: {exc}"
        meta["satellite_mode"] = "unavailable"
        return {"available": False, "note": str(exc)}
    if not modis.get("available"):
        meta["satellite_note"] = "; ".join(modis.get("notes", [])[:3]) or "no modis values"
        meta["satellite_mode"] = "unavailable"
        return modis
    _merge_series(
        values, meta, modis.get("parameters", {}),
        "MODIS via Microsoft Planetary Computer",
        allowed=SATELLITE_PARAMS,
    )
    for p, res in (modis.get("resolution_m") or {}).items():
        meta["resolution_m"][p] = res
    meta["satellite_mode"] = modis.get("mode", mode)
    meta["satellite_products"] = {
        k: {
            "native": v.get("native"),
            "requests": v.get("stats", {}).get("requests", 0),
            "items": v.get("stats", {}).get("items", 0),
            "errors": v.get("stats", {}).get("errors", []),
        }
        for k, v in (modis.get("products") or {}).items()
    }
    meta["satellite_note"] = "; ".join(modis.get("notes", []))
    meta["satellite_note"] += (
        " MODIS samples native 16-day/8-day values, aggregated to monthly means; "
        "annual ET/PET/GPP are repeated over their year for trend continuity."
    )
    return modis


def build_point_store(
    lat: float,
    lon: float,
    out_path: Path | None = None,
    *,
    satellite_mode: str = "fast",
    force: bool = False,
) -> Path:
    if out_path is None:
        out_path = ROOT / "data" / "processed" / "points" / f"point_{lat:.4f}_{lon:.4f}.npz".replace("-", "m")
    out_path.parent.mkdir(parents=True, exist_ok=True)

    values, meta = _base_values(lat, lon)
    if satellite_mode != "none":
        _merge_modis(values, meta, satellite_mode)
    else:
        meta["satellite_mode"] = "none"
        meta["satellite_note"] = "MODIS point series not requested for this build."
    meta["imagery_scenes"] = fetch_satellite_imagery_links(lat, lon).get("scenes", {})


    # Ocean/land is a coarse diagnostic only. Never wipe real MODIS values based
    # on the 15-degree demo mask; satellite no-data is already encoded as NaN.
    try:
        from pipeline.land_ocean import DEMO_MASK
        lats = np.arange(-60.0, 76.0, 15.0)
        lons = np.arange(-180.0, 180.0, 15.0)
        li = int(np.argmin(np.abs(lats - lat)))
        oi = int(np.argmin(np.abs(lons - lon)))
        meta["ocean_cell"] = bool(DEMO_MASK[li, oi] == 1)
    except Exception:
        meta["ocean_cell"] = None

    values["meta_json"] = np.array(json.dumps(meta))
    for p in ("sst", "sea_level"):
        if p not in values:
            values[p] = np.full(len(values["dates"]), np.nan)
    np.savez(out_path, **values)
    available = sum(1 for p in PARAM_ORDER if p in values and np.isfinite(values[p]).any())
    print(f"[highres] wrote {out_path}  T={len(values['dates'])}  params={available}  satellite={meta.get('satellite_mode')}")
    return out_path


def augment_point_store_satellite(
    lat: float, lon: float, out_path: Path | None = None, mode: str = "fast",
) -> Path:
    """Add MODIS series to an existing store without refetching POWER/ERA5."""
    if out_path is None:
        out_path = ROOT / "data" / "processed" / "points" / f"point_{lat:.4f}_{lon:.4f}.npz".replace("-", "m")
    with np.load(out_path, allow_pickle=False) as z:
        values = {k: z[k] for k in z.files}
    raw_meta = values.pop("meta_json", None)
    meta_text = str(raw_meta.item()) if isinstance(raw_meta, np.ndarray) and raw_meta.size == 1 else str(raw_meta or "{}")
    meta = json.loads(meta_text or "{}")
    _merge_modis(values, meta, mode)
    values["meta_json"] = np.array(json.dumps(meta))
    np.savez(out_path, **values)
    return out_path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lat", type=float, required=True)
    ap.add_argument("--lon", type=float, required=True)
    ap.add_argument("--out", default=None)
    ap.add_argument("--satellite", choices=["none", "fast", "full"], default="fast")
    ap.add_argument("--probe", action="store_true", help="fetch only, print summary, no write")
    args = ap.parse_args()

    power = fetch_power_series(args.lat, args.lon)
    print("POWER available:", power["available"])
    if power["available"]:
        for p in ("temperature", "precipitation", "evapotranspiration", "aerosol_optical_depth"):
            s = power["parameters"].get(p) or {}
            if s:
                vals = [v for v in s.values() if np.isfinite(v)]
                print(f"  {p}: n={len(vals)} range={min(vals):.3f}..{max(vals):.3f}")
    if args.probe:
        return 0
    out = Path(args.out) if args.out else None
    build_point_store(args.lat, args.lon, out, satellite_mode=args.satellite)
    return 0


if __name__ == "__main__":
    sys.exit(main())
