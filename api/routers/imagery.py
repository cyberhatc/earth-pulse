"""Imagery endpoints: past GIBS/Landsat references and model-projected SVG maps."""
from __future__ import annotations

from functools import lru_cache

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import Response

from api.deps import get_store, get_analysis, normalise_lon
from api.services import ondemand
from models.project_maps import projected_field, svg_heatmap

router = APIRouter()

_ALLOWED = {"temperature", "precipitation", "ndvi", "sst", "sea_level", "solar_radiation", "humidity", "wind"}


@router.get("/imagery/past")
def imagery_past(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-360, le=360)):
    lon = normalise_lon(lon)
    return {
        "point": {"lat": lat, "lon": lon},
        "gibs": ondemand.gibs_past(lat, lon),
        "landsat_query": ondemand.landsat_link(lat, lon),
        "note": "GIBS tiles render current layer defaults; historical layer dates vary by product. Landsat gives true scenes via EarthExplorer.",
    }


@lru_cache(maxsize=64)
def _projected_svg(parameter: str, year: int) -> str:
    store = get_store()
    analysis = get_analysis()
    # slope per month from Theil–Sen slope per decade
    trends = analysis.get("trends", {}).get(parameter, {})
    slopes = {int(k): v["slope_per_decade"] / 120.0 for k, v in trends.items()}
    last_date = list(store["dates"])[-1]
    field = projected_field(store, parameter, slopes, last_date, year)
    n_lats, n_lons = len(store["lats"]), len(store["lons"])
    grid = field.reshape(n_lats, n_lons)[::-1]  # north on top
    lats_n = store["lats"][::-1]
    title = f"{parameter.replace('_', ' ').title()} — projected {year}"
    subtitle = "Model-projected (Theil–Sen extrapolation of the trend) · not an observation · synthetic demo store"
    return svg_heatmap(lats_n, store["lons"], grid.ravel(), title, subtitle)


@router.get("/imagery/timelapse")
def imagery_timelapse(lat: float = Query(..., ge=-90, le=90),
                      lon: float = Query(..., ge=-360, le=360),
                      start_year: int = Query(2000, ge=2000, le=2025),
                      end_year: int = Query(2025, ge=2000, le=2035)):
    lon = normalise_lon(lon)
    """Time-lapse frames: observed GIBS true-colour tiles (past) + projected maps (future)."""
    from pipeline.fetch_gibs import thumbnails_for_point, tile_url, lon_lat_to_tile
    frames = []
    # observed (GIBS MODIS true colour, mid-year)
    for y in range(start_year, min(end_year, 2025) + 1):
        date = f"{y}-07-15"
        x, yy = lon_lat_to_tile(lon, lat, 4)
        url = tile_url("true_color", date, 4, x, yy)
        frames.append({"year": y, "date": date, "kind": "observed", "url": url,
                       "label": f"MODIS true colour {y}"})
    # future projected (model extrapolation) for years beyond last observed
    last_obs = min(end_year, 2025)
    for y in range(max(last_obs + 1, 2026), end_year + 1):
        frames.append({"year": y, "date": str(y), "kind": "projected",
                       "url": f"/imagery/projected?parameter=temperature&year={y}",
                       "label": f"Model-projected temperature {y} (not an observation)"})
    return {"point": {"lat": lat, "lon": lon}, "frames": frames,
            "note": "Observed frames are MODIS true-colour tiles (GIBS). Future frames are model-projected SVG heatmaps, not observations."}


@router.get("/imagery/timelapse.gif")
def imagery_timelapse_gif(lat: float = Query(..., ge=-90, le=90),
                          lon: float = Query(..., ge=-360, le=360),
                          start_year: int = Query(2000, ge=2000, le=2025),
                          end_year: int = Query(2025, ge=2000, le=2025)):
    lon = normalise_lon(lon)
    """Animated GIF time-lapse of MODIS true-colour tiles for a point (video form)."""
    from io import BytesIO
    import urllib.request
    from PIL import Image, ImageDraw, ImageFont
    from pipeline.fetch_gibs import lon_lat_to_tile, tile_url

    # z=6 -> ~1 km per pixel. Mosaic 4x4 tiles (~1024x1024 = ~1000 km) to cover
    # a large region (e.g. south India) around the clicked point.
    z = 6
    cx, cy = lon_lat_to_tile(lon, lat, z)
    n = 2  # radius in tiles -> 2*n+1 = 5x5 mosaic (~1280 km)
    grid = 2 * n + 1
    tile_px = 256
    mosaic_px = grid * tile_px
    frames = []
    for yr in range(start_year, end_year + 1):
        date = f"{yr}-07-15"
        mosaic = Image.new("RGB", (mosaic_px, mosaic_px), (0, 0, 0))
        ok = False
        for dy in range(-n, n + 1):
            for dx in range(-n, n + 1):
                url = tile_url("true_color", date, z, cx + dx, cy + dy)
                try:
                    with urllib.request.urlopen(url, timeout=20) as resp:
                        raw = resp.read()
                    tile = Image.open(BytesIO(raw)).convert("RGB").resize((tile_px, tile_px))
                    mosaic.paste(tile, ((dx + n) * tile_px, (dy + n) * tile_px))
                    ok = True
                except Exception:
                    # leave black tile for missing
                    pass
        if not ok:
            continue
        # mark the clicked point
        px = (cx - (cx - n))  # not needed
        # draw a crosshair at the center tile center
        draw = ImageDraw.Draw(mosaic)
        mx, my = (n * tile_px + tile_px // 2, n * tile_px + tile_px // 2)
        draw.ellipse([(mx - 8, my - 8), (mx + 8, my + 8)], outline=(255, 0, 0), width=3)
        try:
            font = ImageFont.truetype("arial.ttf", 28)
        except Exception:
            font = ImageFont.load_default()
        draw.rectangle([(0, 0), (160, 36)], fill=(0, 0, 0, 180))
        draw.text((10, 6), str(yr), fill=(255, 255, 255), font=font)
        # downscale for gif size
        mosaic = mosaic.resize((512, 512))
        frames.append(mosaic)

    if not frames:
        raise HTTPException(503, detail="no frames available")

    buf = BytesIO()
    frames[0].save(buf, format="GIF", save_all=True, append_images=frames[1:],
                   duration=600, loop=0, optimize=True)
    buf.seek(0)
    return Response(content=buf.read(), media_type="image/gif",
                    headers={"Cache-Control": "public, max-age=86400"})


@router.get("/imagery/projected")
def imagery_projected(parameter: str = Query("temperature"),
                      year: int = Query(2030, ge=2026, le=2080)):
    if parameter not in _ALLOWED:
        raise HTTPException(400, detail=f"parameter must be one of {sorted(_ALLOWED)}")
    try:
        svg = _projected_svg(parameter, year)
    except Exception as exc:
        raise HTTPException(503, detail=str(exc))
    return Response(content=svg, media_type="image/svg+xml",
                    headers={"Cache-Control": "public, max-age=3600"})
