"""GET /dossier — detailed per-location analysis dossier.

Aggregates, for one clicked coordinate:
  * a nominal 10 × 10 km area-of-interest box with an honest resolution ladder;
  * real point-level NASA POWER series (1981+) analysed with Theil–Sen /
    Mann–Kendall trends and rolling robust-z anomalies;
  * an independent ERA5 cross-check fetched from Open-Meteo (40 years, no key)
    and a global NASA GISTEMP context series;
  * a ridge-rollout ML forecast trained on the full record, with a rolling-origin
    backtest (MAE / RMSE / pinball / p10–p90 coverage / skill vs persistence)
    and p10–p90 projection bands (models/point_ml.py);
  * satellite imagery references: NASA GIBS frames + STAC Sentinel-2 / Landsat
    scene thumbnails for the point;
  * the configured data-source catalogue with per-source status for this
    dossier;
  * a deterministic, facts-locked explanation.

GET /dossier/report renders the same payload as a printable, self-contained
HTML report (inline SVG charts, no JavaScript needed).

Honesty: the payload always states which mode was used, the time range and the
source of every parameter. Sources that need a NASA Earthdata login or an API
key are marked `restricted`; nothing is fabricated to fill the catalogue.
"""
from __future__ import annotations

import math
import os
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from engine.trends import analyse_series  # noqa: E402
from models.point_forecast import (  # noqa: E402
    analyse_point,
    load_point_store,
    next_move_summary,
    point_forecast,
)
from models.point_ml import ml_forecast  # noqa: E402
from pipeline.fetch_gibs import thumbnails_for_point  # noqa: E402
from pipeline.fetch_gistemp import fetch_gistemp  # noqa: E402
from pipeline.fetch_highres_point import (  # noqa: E402
    build_point_store,
    fetch_satellite_imagery_links,
)
from pipeline.fetch_openmeteo import fetch_openmeteo_monthly  # noqa: E402
from pipeline.fetch_gibs import layer_groups  # noqa: E402
from models.parameter_registry import (  # noqa: E402
    PARAMETERS,
    PARAM_ORDER,
    REQUESTED_UNAVAILABLE,
    groups_payload,
    param_label,
    param_unit,
    parameter_meta,
)
from api.services.visual_report import render_dossier_html  # noqa: E402

router = APIRouter()

POINT_DIR = ROOT / "data" / "processed" / "points"

PARAM_LABELS = {
    **{p: (param_label(p), param_unit(p)) for p in PARAM_ORDER},
    "sst": ("Sea-surface temperature", "°C"),
    "sea_level": ("Sea level", "mm"),
}

GIBS_LABELS = {
    "true_color": "True colour",
    "false_color": "False colour (7-2-1)",
    "ndvi": "NDVI (monthly)",
    "evi": "EVI (monthly)",
    "lst_day": "Land-surface temperature — day",
    "lst_night": "Land-surface temperature — night",
    "snow": "Snow extent",
    "aerosol": "Aerosol optical depth",
    "no2": "Nitrogen dioxide column",
    "so2": "Sulphur dioxide column",
    "co": "Carbon monoxide",
    "precipitation": "IMERG precipitation",
    "soil_moisture": "GLDAS soil moisture",
    "viirs_true_color": "VIIRS true colour",
    "viirs_false_color": "VIIRS false colour (M11-I2-I1)",
    "viirs_lst_day": "VIIRS land-surface temperature — day",
    "ndsi": "MODIS NDSI snow cover",
    "viirs_ndsi": "VIIRS NDSI snow cover",
    "snow_pct": "Monthly snow-cover fraction",
    "snow_mass": "SMAP snow mass",
    "snow_water_equivalent": "AMSR2 snow water equivalent",
    "gldas_air_temperature": "GLDAS near-surface air temperature",
    "gldas_precipitation": "GLDAS total precipitation rate",
}

# New points get their fast core store immediately and MODIS backfills in the
# background. Precomputed region stores are built with --satellite fast/full.
POINT_SATELLITE_MODE = os.environ.get("EP_POINT_SATELLITE_MODE", "fast")
_BACKFILLING: set[tuple[float, float]] = set()
_BACKFILL_LOCK = threading.Lock()

# Catalogue mirrors the sources listed in the project README. `status` is
# refined per request: "used" means data flows into this dossier.
SOURCE_CATALOGUE = [
    ("NASA Earthdata", "https://www.earthdata.nasa.gov", "Main hub for NASA Earth data"),
    ("Earthdata Search", "https://search.earthdata.nasa.gov", "Search and download restricted products"),
    ("NASA Giovanni", "https://giovanni.gsfc.nasa.gov", "Quick online time-series analysis"),
    ("NASA Worldview & GIBS", "https://worldview.earthdata.nasa.gov", "Global satellite imagery layers"),
    ("LP DAAC", "https://lpdaac.usgs.gov", "Land surface and vegetation (MODIS NDVI)"),
    ("GES DISC", "https://disc.gsfc.nasa.gov", "Precipitation (GPM IMERG) and reanalysis"),
    ("PO.DAAC", "https://podaac.jpl.nasa.gov", "Sea level and ocean physics"),
    ("NSIDC", "https://nsidc.org", "Ice sheets, snow and sea ice"),
    ("NASA POWER", "https://power.larc.nasa.gov", "Point meteorology and solar archive (1981+)"),
    ("NASA GISS GISTEMP", "https://data.giss.nasa.gov/gistemp", "Global temperature anomalies"),
    ("NASA FIRMS", "https://firms.modaps.eosdis.nasa.gov", "Active fire hotspots"),
    ("NASA Space Apps 2026", "https://www.spaceappschallenge.org/2026/challenges/", "Challenge page"),
    ("Space Data Atlas", "https://spacedata.swapniltamse.com", "Suggested datasets and starter code"),
    ("Copernicus Climate Data Store", "https://cds.climate.copernicus.eu", "Historical weather since 1940 (ERA5)"),
    ("NOAA NCEI", "https://www.ncei.noaa.gov", "Global weather and climate records"),
    ("Open-Meteo", "https://open-meteo.com", "Free weather API, no key needed"),
    ("Global Forest Watch", "https://www.globalforestwatch.org", "Forest loss and gain"),
    ("JRC Global Surface Water", "https://global-surface-water.appspot.com", "Surface water change"),
    ("USGS EarthExplorer", "https://earthexplorer.usgs.gov", "Satellite archive (Landsat)"),
    ("OpenAQ", "https://openaq.org", "Air quality"),
    ("India Meteorological Department", "https://mausam.imd.gov.in", "Climate data for India"),
    ("data.gov.in", "https://data.gov.in", "Open government data for India"),
    ("World Bank Open Data", "https://data.worldbank.org", "Country indicators"),
    ("Google Dataset Search", "https://datasetsearch.research.google.com", "Dataset search"),
    ("Hugging Face", "https://huggingface.co/datasets", "Datasets and models"),
    (
        "Microsoft Planetary Computer",
        "https://planetarycomputer.microsoft.com",
        "Sentinel-2 / Landsat scene imagery (free, no login)",
    ),
]

# statuses that depend on what actually ran this request
_RESTRICTED = {
    "Earthdata Search",
    "LP DAAC",
    "GES DISC",
    "PO.DAAC",
    "NSIDC",
    "NASA FIRMS",
}


def _store_path(lat: float, lon: float) -> Path:
    POINT_DIR.mkdir(parents=True, exist_ok=True)
    return POINT_DIR / f"point_{lat:.4f}_{lon:.4f}.npz".replace("-", "m")


def _start_satellite_backfill(lat: float, lon: float, path: Path) -> None:
    """Launch MODIS backfill in a separate process.

    urllib in a thread crashed this sandbox's API process, so the networked
    work lives in `pipeline.backfill_worker`. Only a local `proc.wait()` monitor
    runs in a thread here; the dedupe key is released when the child exits.
    """
    key = (round(lat, 4), round(lon, 4))
    with _BACKFILL_LOCK:
        if key in _BACKFILLING:
            return
        _BACKFILLING.add(key)

    coordinate_tag = f"{lat:.3f}_{lon:.3f}".replace("-", "m")
    log_path = Path("/tmp") / f"ep-backfill-{coordinate_tag}.log"
    cmd = [
        sys.executable, "-m", "pipeline.backfill_worker",
        "--lat", str(lat), "--lon", str(lon), "--mode", POINT_SATELLITE_MODE,
    ]
    try:
        with log_path.open("a", encoding="utf-8") as log_file:
            proc = subprocess.Popen(
                cmd, cwd=str(ROOT), stdin=subprocess.DEVNULL,
                stdout=log_file, stderr=subprocess.STDOUT,
                start_new_session=True,
            )
    except Exception:
        with _BACKFILL_LOCK:
            _BACKFILLING.discard(key)
        return

    def monitor() -> None:
        proc.wait()
        with _BACKFILL_LOCK:
            _BACKFILLING.discard(key)

    threading.Thread(
        target=monitor, name=f"modis-wait-{lat:.3f}-{lon:.3f}", daemon=True
    ).start()


def _point_payload(lat: float, lon: float, horizon_months: int,
                   rebuild: bool) -> tuple[dict, bool]:
    path = _store_path(lat, lon)
    built_now = False
    if rebuild or not path.exists():
        # A new point must respond immediately with the real POWER/ERA5/AQ core.
        # MODIS is added by the background backfill below, with
        # `satellite_pending: true` until it lands — never invented, never a
        # multi-minute synchronous wait on the mosaic point API.
        build_point_store(lat, lon, path, satellite_mode="none")
        built_now = True
    payload = analyse_point(path)
    store = load_point_store(path)
    meta = store.get("meta") or {}
    satellite_ready = bool(
        np.isfinite(np.asarray(store.get("ndvi", []), dtype=float)).any()
    )
    payload["satellite_pending"] = not satellite_ready
    if not satellite_ready:
        _start_satellite_backfill(lat, lon, path)
    try:
        fc = ml_forecast(store, horizon_months)
        payload["forecast"]["horizon_months"] = horizon_months
        payload["forecast"]["model"] = fc["model"]
        payload["forecast"]["dates"] = fc["dates"]
        payload["forecast"]["timeseries"] = fc["timeseries"]
        payload["forecast"]["next_move"] = next_move_summary(store, fc)
        payload["next_move"] = payload["forecast"]["next_move"]
        payload["ml"] = {
            "model": fc["model"],
            "seq_len": fc.get("seq_len"),
            "n_rows": fc.get("n_rows"),
            "n_features": fc.get("n_features"),
            "backtest": fc.get("backtest"),
            "blend": fc.get("blend"),
            "short_record_params": fc.get("short_record_params", []),
            "short_record_note": fc.get("short_record_note"),
            "models_by_parameter": fc.get("models_by_parameter", {}),
            "joint_params": fc.get("joint_params", []),
            "single_series_params": fc.get("single_series_params", []),
            "note": (
                "Closed-form ridge regression on 24-month lag windows of every "
                "available parameter plus month-of-year features, rolled forward "
                "autoregressively and blended with a Theil–Sen trend + monthly-"
                "climatology baseline at longer horizons. Bands combine both "
                "one-step residual spreads, scaled by sqrt(horizon)."
            ),
        }
    except Exception as exc:  # pragma: no cover - defensive fallback
        fc = point_forecast(store, horizon_months)
        payload["forecast"]["horizon_months"] = horizon_months
        payload["forecast"]["dates"] = fc["dates"]
        payload["forecast"]["timeseries"] = fc["timeseries"]
        payload["forecast"]["next_move"] = next_move_summary(store, fc)
        payload["next_move"] = payload["forecast"]["next_move"]
        payload["ml"] = {
            "model": fc.get("model", "linear_trend_seasonal_point"),
            "backtest": {"available": False, "note": f"ml_failed: {exc}"},
        }
    return payload, built_now


def _grid_payload(lat: float, lon: float, horizon_months: int) -> dict:
    from api.routers.place import place as place_endpoint

    return place_endpoint(lat=lat, lon=lon, horizon_months=horizon_months)


def _imagery(lat: float, lon: float, warnings: list[str]) -> dict:
    out: dict = {"gibs": [], "gibs_groups": [], "satellite_scenes": {}, "links": {}}
    try:
        out["gibs"] = thumbnails_for_point(lat, lon)
        out["gibs_groups"] = layer_groups()
        out["gibs_labels"] = GIBS_LABELS
    except Exception as exc:  # pragma: no cover - defensive
        warnings.append(f"gibs_unavailable: {exc}")
    try:
        out["satellite_scenes"] = fetch_satellite_imagery_links(
            lat, lon, "2025-01-01", "2026-11-01"
        )
    except Exception as exc:  # pragma: no cover - defensive
        warnings.append(f"stac_imagery_unavailable: {exc}")
    out["links"] = {
        "worldview": (
            "https://worldview.earthdata.nasa.gov/?v="
            f"{lon - 1.5:.2f},{lat - 1.5:.2f},{lon + 1.5:.2f},{lat + 1.5:.2f}"
            "&t=2024-01-01"
        ),
        "earthdata_search": (
            "https://search.earthdata.nasa.gov/search?"
            f"q={lat:.4f}%2C{lon:.4f}"
        ),
        "giovanni": "https://giovanni.gsfc.nasa.gov/giovanni/",
        "firms": "https://firms.modaps.eosdis.nasa.gov/map/",
        "power_api": (
            "https://power.larc.nasa.gov/api/temporal/monthly/point?"
            f"parameters=T2M,PRECTOTCORR&community=RE&latitude={lat:.4f}"
            f"&longitude={lon:.4f}&start=1981&end=2026&format=JSON&units=metric"
        ),
    }
    return out


def _area_of_interest(lat: float, lon: float) -> dict:
    """A nominal 10 × 10 km box centred on the clicked point."""
    half_lat = 5.0 / 111.32
    coslat = math.cos(math.radians(lat))
    half_lon = 5.0 / (111.32 * max(coslat, 1e-3))
    return {
        "bbox": [
            round(lat - half_lat, 4),
            round(lon - half_lon, 4),
            round(lat + half_lat, 4),
            round(lon + half_lon, 4),
        ],
        "width_km": 10.0,
        "height_km": 10.0,
        "approx_km2": 100.0,
        "resolution_note": (
            "Nominal 10 × 10 km area of interest. NASA POWER is gridded at "
            "0.5° × 0.625° (≈55 × 62 km), Open-Meteo/ERA5 at 0.25° (≈28 km), "
            "CAMS air quality at ≈11 km, MODIS NDVI at 250 m, LST at 1 km, "
            "and annual ET/GPP at 500 m. Sentinel-2 (10 m) and Landsat (30 m) "
            "resolve the box as imagery, but the 40-year records cannot. "
            "No source is upsampled to pretend it is 10 m."
        ),
    }


def _series_trend(series: dict[str, float], periods_per_decade: float = 120.0) -> dict | None:
    keys = sorted(series)
    if len(keys) < 24:
        return None
    values = np.array([series[k] for k in keys], dtype=float)
    finite = np.isfinite(values)
    if int(finite.sum()) < 24:
        return None
    res = analyse_series(values, periods_per_decade)
    res["n"] = int(finite.sum())
    res["period"] = [keys[0], keys[-1]]
    return res


def _cross_check(lat: float, lon: float, warnings: list[str],
                 force: bool = False) -> dict:
    """Independent, no-login sources compared with the NASA POWER record."""
    out: dict = {"sources": {}, "gistemp": {"available": False}}

    try:
        # Interactive dossier requests must not block on a slow ERA5 fetch.
        # Reuse even an older cached copy, labeled by the fetcher as stale.
        om = fetch_openmeteo_monthly(
            lat, lon, force=force, timeout=8, stale_ok=True
        )
    except Exception as exc:  # pragma: no cover - defensive
        warnings.append(f"openmeteo_unavailable: {exc}")
        om = {"available": False}
    if om.get("available"):
        params = om.get("parameters", {})
        trends = {}
        for key, values in params.items():
            trend = _series_trend(values)
            if trend:
                trends[key] = trend
        series = {}
        for key in (
            "temperature", "precipitation", "wind", "solar_radiation",
            "apparent_temperature", "vapour_pressure_deficit",
            "soil_moisture_0_7cm", "et_reference",
        ):
            values = params.get(key, {})
            keys = sorted(values)
            if keys:
                series[key] = {
                    "dates": keys,
                    "values": [round(float(values[k]), 3) for k in keys],
                }
        out["sources"]["Open-Meteo (ERA5)"] = {
            "available": True,
            "period": om.get("period"),
            "n_months": om.get("n_months"),
            "trends": trends,
            "series": series,
            "note": om.get("note"),
            "url": om.get("url"),
        }
    else:
        warnings.append("openmeteo_no_data")

    try:
        g = fetch_gistemp(force=force)
    except Exception as exc:  # pragma: no cover - defensive
        warnings.append(f"gistemp_unavailable: {exc}")
        g = {"available": False}
    if g.get("available"):
        annual = {int(k): float(v) for k, v in (g.get("annual") or {}).items()}
        years = sorted(annual)
        values = np.array([annual[y] for y in years], dtype=float)
        res = analyse_series(values, periods_per_decade=10.0)
        out["gistemp"] = {
            "available": True,
            "source": g.get("source"),
            "period": [years[0], years[-1]],
            "slope_per_decade": round(float(res["slope_per_decade"]), 4),
            "p_value": res["p_value"],
            "significant": res["significant"],
            "latest_year": years[-1],
            "latest_anomaly": round(annual[years[-1]], 3),
            "base_period": g.get("base_period"),
            "annual": {str(y): annual[y] for y in years},
            "note": "Global context only — not a local measurement.",
        }
    else:
        warnings.append("gistemp_no_data")

    return out


def _source_statuses(mode: str, imagery: dict, coverage: dict,
                     cross_check: dict) -> list[dict]:
    used = {"NASA POWER"} if mode == "point_real" else set()
    if imagery.get("gibs"):
        used.add("NASA Worldview & GIBS")
    if imagery.get("satellite_scenes", {}).get("scenes"):
        used.add("Microsoft Planetary Computer")
    pmeta = coverage.get("parameter_meta") or {}
    if any(p in pmeta for p in ("ndvi", "lst_day", "et_modis", "gpp")):
        used.add("Microsoft Planetary Computer")
        used.add("LP DAAC")
    if any(p in pmeta for p in ("pm2_5", "nitrogen_dioxide", "ozone")):
        used.add("Open-Meteo")
    if cross_check.get("sources"):
        used.add("Open-Meteo")
    if cross_check.get("gistemp", {}).get("available"):
        used.add("NASA GISS GISTEMP")

    rows = []
    for name, url, role in SOURCE_CATALOGUE:
        if name == "NASA GISS GISTEMP" and name in used:
            status, note = (
                "context",
                "Global annual anomalies fetched live; used as context, not as a local measurement.",
            )
        elif name in used:
            status, note = "used", "Fetched and analysed for this dossier."
        elif name in _RESTRICTED:
            status, note = "restricted", "Requires a free NASA Earthdata login / product terms; not ingested yet."
        elif name == "NASA Earthdata":
            status, note = "used", "Serves the NASA POWER point archive used here (no login needed)."
        elif name in {"NASA Giovanni", "Copernicus Climate Data Store", "NOAA NCEI"}:
            status, note = "link", "Reference source — linked for cross-checking, not part of this payload."
        else:
            status, note = "link", "Reference / future integration."
        rows.append({"name": name, "url": url, "role": role, "status": status, "note": note})
    return rows


def _explain(normalised: dict, lat: float, lon: float, horizon: int) -> str:
    trends = normalised["trends"]
    coverage = normalised["coverage"]
    start, end = (coverage.get("time_range") or ["?", "?"])[:2]
    parts: list[str] = []

    significant = [
        (p, t)
        for p, t in trends.items()
        if t.get("significant") and abs(float(t.get("slope_per_decade", 0))) > 0
    ]
    significant.sort(key=lambda kv: abs(float(kv[1]["slope_per_decade"])), reverse=True)

    if significant:
        p, t = significant[0]
        label, unit = PARAM_LABELS.get(p, (p, ""))
        direction = "rising" if float(t["slope_per_decade"]) > 0 else "falling"
        parts.append(
            f"Between {start} and {end}, {label.lower()} at {lat:.3f}°, {lon:.3f}° is "
            f"{direction} by {abs(float(t['slope_per_decade'])):.3g} {unit}/decade "
            f"(Theil–Sen, Mann–Kendall p={float(t['p_value']):.3g}, significant)."
        )
        others = [kv for kv in significant[1:3]]
        for p2, t2 in others:
            label2, unit2 = PARAM_LABELS.get(p2, (p2, ""))
            sign = "+" if float(t2["slope_per_decade"]) > 0 else "−"
            parts.append(
                f"{label2} changes {sign}{abs(float(t2['slope_per_decade'])):.3g} {unit2}/decade "
                f"(p={float(t2['p_value']):.3g})."
            )
    else:
        parts.append(
            f"Between {start} and {end}, no parameter at {lat:.3f}°, {lon:.3f}° shows a "
            "statistically significant monotonic trend at α = 0.05."
        )

    cc = normalised.get("cross_check") or {}
    om = (cc.get("sources") or {}).get("Open-Meteo (ERA5)") or {}
    local_temp = trends.get("temperature") or {}
    om_temp = (om.get("trends") or {}).get("temperature") or {}
    if local_temp and om_temp:
        lt = float(local_temp.get("slope_per_decade", 0) or 0)
        ot = float(om_temp.get("slope_per_decade", 0) or 0)
        agree = "agree" if (lt >= 0) == (ot >= 0) else "disagree"
        period = om.get("period") or ["?", "?"]
        parts.append(
            f"An independent ERA5 record (Open-Meteo, {period[0]}–{period[1]}) gives a "
            f"temperature trend of {ot:+.3g} °C/decade; the two sources {agree} in sign."
        )
    gis = cc.get("gistemp") or {}
    if gis.get("available"):
        period = gis.get("period") or ["?", "?"]
        parts.append(
            f"For global context, NASA GISTEMP shows "
            f"{float(gis.get('slope_per_decade', 0)):+.3g} °C/decade across "
            f"{period[0]}–{period[1]} "
            f"({float(gis.get('latest_anomaly', 0)):+.2f} °C in "
            f"{gis.get('latest_year')} relative to 1951–1980)."
        )

    moves = normalised.get("next_move") or {}
    described = []
    for p, mv in list(moves.items())[:3]:
        label, unit = PARAM_LABELS.get(p, (p, ""))
        described.append(
            f"{label.lower()} {mv.get('direction', 'stable')} "
            f"({mv.get('delta_over_horizon', 0):+.3g} {unit} over {horizon} months)"
        )
    if described:
        parts.append("The model projects: " + "; ".join(described) + ".")

    parts.append(
        "Forecasts are statistical extrapolations with p10–p90 bands, not climate-model "
        "projections; skill decays with horizon."
    )
    if normalised["mode"] == "grid_demo":
        parts.append(
            "This dossier fell back to the coarse gridded demo store because the real "
            "point-level NASA POWER store could not be built for this coordinate."
        )
    return " ".join(parts)


_CACHE: dict[tuple[float, float, int], tuple[float, dict]] = {}
_CACHE_TTL = 600.0


def _dossier(lat: float, lon: float, horizon_months: int, region_slug: str | None,
             rebuild: bool) -> dict:
    warnings: list[str] = []
    mode = "grid_demo"
    built_now = False
    payload: dict
    try:
        payload, built_now = _point_payload(lat, lon, horizon_months, rebuild)
        mode = "point_real"
    except Exception as exc:
        warnings.append(f"point_store_unavailable: {exc}")
        try:
            payload = _grid_payload(lat, lon, horizon_months)
        except Exception as exc2:
            raise HTTPException(503, detail=f"analysis_unavailable: {exc2}") from exc2
        warnings.append("Fell back to the gridded demo analysis for this coordinate.")

    past = payload.get("past", {})
    forecast = payload.get("forecast", {})
    coverage = payload.get("data_coverage", {})
    area = _area_of_interest(lat, lon)
    imagery = _imagery(lat, lon, warnings)
    cross_check = _cross_check(lat, lon, warnings, force=rebuild)

    normalised = {
        "mode": mode,
        "coverage": coverage,
        "parameter_meta": coverage.get("parameter_meta") or {},
        "satellite": {
            "mode": coverage.get("satellite_mode"),
            "note": coverage.get("satellite_note"),
            "products": coverage.get("satellite_products"),
            "pending": bool(payload.get("satellite_pending")),
        },
        "area": area,
        "history": {
            "dates": [str(d) for d in past.get("dates", [])],
            "series": past.get("timeseries", {}),
        },
        "trends": payload.get("trends", {}),
        "forecast": {
            "horizon_months": forecast.get("horizon_months", horizon_months),
            "issued": forecast.get("issued"),
            "model": forecast.get("model"),
            "dates": forecast.get("dates", []),
            "timeseries": forecast.get("timeseries", {}),
            # Also exposed here for API-contract readers; the UI uses the
            # top-level `next_move` field above.
            "next_move": forecast.get("next_move", {}),
        },
        "anomalies": past.get("anomalies", []),
        "next_move": payload.get("next_move") or forecast.get("next_move") or {},
        "opposite_trends": payload.get("opposite_trends", []),
        "climate_twin": payload.get("climate_twin"),
        "cross_check": cross_check,
        "ml": payload.get("ml") or {"model": forecast.get("model")},
    }

    explanation = _explain(normalised, lat, lon, horizon_months)
    sources = _source_statuses(mode, imagery, coverage, cross_check)

    return {
        "schema_version": "1.3.0",
        "requested": {
            "lat": round(lat, 4),
            "lon": round(lon, 4),
            "region_slug": region_slug,
            "horizon_months": horizon_months,
        },
        "location": {
            "lat": round(lat, 4),
            "lon": round(lon, 4),
            "name": (f"{lat:.3f}°, {lon:.3f}°"),
            "region_slug": region_slug,
            "resolution_m": coverage.get("resolution_m"),
        },
        "mode": mode,
        # Explicit flags so callers never have to infer real-vs-demo from `mode`.
        "synthetic": mode != "point_real",
        "data_basis": "point" if mode == "point_real" else "grid",
        "provenance": {
            "built_now": built_now,
            "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "point_store": str(_store_path(lat, lon)) if mode == "point_real" else None,
            "note": (
                "Real NASA POWER monthly point series analysed locally; ERA5 "
                "(Open-Meteo) and GISTEMP fetched live as independent cross-checks."
                if mode == "point_real"
                else "Gridded demo store (synthetic) analysed locally."
            ),
        },
        **normalised,
        "imagery": imagery,
        "parameters": {
            p: {
                "label": PARAM_LABELS[p][0],
                "unit": PARAM_LABELS[p][1],
                "group": (PARAMETERS.get(p) or {}).get("group", "Other"),
            }
            for p in PARAM_LABELS
        },
        "parameter_groups": groups_payload(),
        "requested_unavailable": REQUESTED_UNAVAILABLE,
        "explanation": {"text": explanation, "generator": "templated_facts_locked"},
        "sources": sources,
        "warnings": warnings,
    }


@router.get("/dossier")
def dossier(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    horizon_months: int = Query(60, ge=3, le=240),
    region_slug: str | None = Query(None),
    rebuild: bool = Query(False),
):
    """Detailed analysed dossier for one coordinate (see module docstring)."""
    key = (round(lat, 4), round(lon, 4), horizon_months)
    now = time.time()
    if not rebuild:
        hit = _CACHE.get(key)
        if hit and now - hit[0] < _CACHE_TTL:
            return hit[1]

    t0 = time.time()
    try:
        result = _dossier(lat, lon, horizon_months, region_slug, rebuild)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(503, detail=f"dossier_failed: {exc}") from exc
    result["timing_ms"] = int((time.time() - t0) * 1000)
    if not rebuild:
        _CACHE[key] = (now, result)
    return result


@router.get("/dossier/report", response_class=HTMLResponse)
def dossier_report(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    horizon_months: int = Query(60, ge=3, le=240),
    region_slug: str | None = Query(None),
    rebuild: bool = Query(False),
):
    """Printable, self-contained HTML report built from the dossier payload."""
    data = dossier(
        lat=lat,
        lon=lon,
        horizon_months=horizon_months,
        region_slug=region_slug,
        rebuild=rebuild,
    )
    return HTMLResponse(content=render_dossier_html(data))
