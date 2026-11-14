"""Build the high-resolution real-data store + analysis for Belgaum (Belagavi), Karnataka.

Belgaum coordinates: 15.8497 N, 74.4977 E. This script produces:
  data/processed/point_15.8497_74.4977.npz   (real NASA point series)
  data/processed/point_15.8497_74.4977.json    (analysis + 5-year forecast)

Usage:
  python3 scripts/build_belgaum.py            # full build (network)
  python3 scripts/build_belgaum.py --probe    # fetch only, print summary

For high-res NDVI (250 m) set EARTHDATA_USERNAME/PASSWORD to use AppEEARS.
Without login, temperature/precipitation/etc. still come from NASA POWER (point).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from pipeline.fetch_highres_point import build_point_store, fetch_power_series, fetch_modis_ndvi_appEEARS, fetch_satellite_imagery_links
from models.point_forecast import analyse_point

LAT, LON = 15.8497, 74.4977


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--probe", action="store_true")
    args = ap.parse_args()

    print(f"[belgaum] target: {LAT}, {LON}")
    p = fetch_power_series(LAT, LON)
    print("POWER:", p["available"], (list(p["parameters"]["temperature"].items())[:1] if p["available"] else p.get("note")))
    ndvi = fetch_modis_ndvi_appEEARS(LAT, LON)
    print("NDVI:", ndvi.get("available"), ndvi.get("note", ""), (len(ndvi.get("series", {})) if ndvi.get("available") else 0))
    img = fetch_satellite_imagery_links(LAT, LON)
    for col, scenes in img["scenes"].items():
        n = len(scenes) if isinstance(scenes, list) else 0
        print(f"IMAGERY {col}: {n} scenes")

    if args.probe:
        return 0

    out_npz = ROOT / "data" / "processed" / "points" / "point_15.8497_74.4977.npz".replace("-", "m")
    build_point_store(LAT, LON, out_npz)
    payload = analyse_point(out_npz)
    out_json = out_npz.with_suffix(".json")
    out_json.write_text(json.dumps(payload, indent=2, default=str))
    print(f"[belgaum] wrote {out_json}")
    print("[belgaum] next_move:", payload.get("next_move"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
