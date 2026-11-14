"""Store helpers: nearest cell, series extraction, trend/coverage lookup."""
from __future__ import annotations

from pipeline.export_store import nearest_cell_index

TS_PARAMS = ["temperature", "precipitation", "ndvi", "sst", "sea_level", "solar_radiation", "humidity", "wind"]

def source_map(synthetic: bool) -> dict[str, str]:
    tag = "synthetic demo store (deterministic, physically motivated)" if synthetic else "real: NASA POWER monthly (1981->present)"
    unavailable = "not available from NASA POWER (intentionally NaN — never faked)"
    return {
        "temperature": f"NASA POWER T2M — {tag}",
        "precipitation": f"NASA POWER PRECTOTCORR — {tag}",
        "solar_radiation": f"NASA POWER ALLSKY_SFC_SW_DWN — {tag}",
        "humidity": f"NASA POWER RH2M — {tag}",
        "wind": f"NASA POWER WS2M — {tag}",
        "ndvi": (f"synthetic NDVI — {tag}" if synthetic else unavailable),
        "sst": (f"synthetic SST — {tag}" if synthetic else unavailable),
        "sea_level": (f"synthetic sea level — {tag}" if synthetic else unavailable),
    }


def nearest(store, lat: float, lon: float):
    cell = nearest_cell_index(store, lat, lon)
    return cell, float(store["grid_lat"][cell]), float(store["grid_lon"][cell])


def past_timeseries(store, cell: int, params: list[str] | None = None):
    dates = list(store["dates"])
    ts = {}
    for p in params or TS_PARAMS:
        ts[p] = [round(float(v), 3) for v in store[p][:, cell]]
    return dates, ts


def trend_for(analysis, parameter: str, cell: int) -> dict | None:
    return analysis.get("trends", {}).get(parameter, {}).get(str(cell))


def opposite_near(analysis, cell: int, limit: int = 4) -> list[dict]:
    """Opposite pairs for ndvi & precipitation; prefer pairs touching the clicked cell, else strongest."""
    pairs = []
    for param in ("ndvi", "precipitation"):
        for p in analysis.get("opposite_trends", {}).get(param, []):
            a, b = p["cell_a"]["index"], p["cell_b"]["index"]
            pairs.append({**p, "touches_clicked_cell": cell in (a, b)})
    pairs.sort(key=lambda p: (not p["touches_clicked_cell"], -p["magnitude"]))
    return pairs[:limit]


def twin_label(analysis, cell: int) -> dict:
    labels = analysis.get("climate_twins", {}).get("labels", [])
    return {"cluster_id": int(labels[cell]) if cell < len(labels) else None,
            "k": analysis.get("climate_twins", {}).get("k", 0),
            "features": analysis.get("climate_twins", {}).get("features", [])}
