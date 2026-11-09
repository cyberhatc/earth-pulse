"""Earth Pulse pipeline entry point.

Usage:
  python3 pipeline/run_pipeline.py --sample                 # generate offline demo store
  python3 pipeline/run_pipeline.py --power LAT LON [--start 1981 --end 2026]
  python3 pipeline/run_pipeline.py --imagery LAT LON [--z 4]
  python3 pipeline/run_pipeline.py --firms LAT LON
  python3 pipeline/run_pipeline.py --discover LAT LON [--start 1985 --end 2026]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.export_store import generate_sample, DEFAULT_SAMPLE_PATH


def cmd_sample(args) -> None:
    out = generate_sample(args.output)
    print(f"[pipeline] sample store written → {out}")


def cmd_power(args) -> None:
    from pipeline.fetch_power import fetch_power_point
    result = fetch_power_point(args.lat, args.lon, args.start, args.end)
    if "error" in result:
        print(json.dumps(result, indent=2))
        return
    for p, series in result["parameters"].items():
        print(f"  {p}: {len(series)} months, first={next(iter(series))}, last={next(reversed(series))}")


def cmd_imagery(args) -> None:
    from pipeline.fetch_gibs import thumbnails_for_point
    dates = ["2000-06-01", "2010-06-01", "2020-06-01", "2025-06-01"]
    for t in thumbnails_for_point(args.lat, args.lon, dates, z=args.z):
        print(f"  {t['date']} {t['layer']:12s} {t['url']}")


def cmd_firms(args) -> None:
    from pipeline.fetch_firms import fetch_firms_area
    print(json.dumps(fetch_firms_area(args.lat, args.lon), indent=2))


def cmd_discover(args) -> None:
    from pipeline.discover import discover_coverage
    result = discover_coverage(args.lat, args.lon, args.start, args.end)
    print(json.dumps(result, indent=2))


def main() -> None:
    p = argparse.ArgumentParser(description="Earth Pulse data pipeline",
                                epilog="Example: python3 pipeline/run_pipeline.py --sample")
    p.add_argument("--sample", nargs="?", const=str(DEFAULT_SAMPLE_PATH), metavar="OUTPUT",
                   help="generate the offline synthetic demo store (default output: data/samples/earth_pulse_sample.npz)")
    p.add_argument("--power", nargs=2, type=float, metavar=("LAT", "LON"), help="NASA POWER point time series")
    p.add_argument("--imagery", nargs=2, type=float, metavar=("LAT", "LON"), help="GIBS tile URLs for a point (past imagery)")
    p.add_argument("--firms", nargs=2, type=float, metavar=("LAT", "LON"), help="FIRMS active fire hotspots near a point")
    p.add_argument("--discover", nargs=2, type=float, metavar=("LAT", "LON"), help="Tier B: which NASA products cover this point?")
    p.add_argument("--start", type=int, default=None)
    p.add_argument("--end", type=int, default=None)
    p.add_argument("--z", type=int, default=4)

    args = p.parse_args()
    ran = False
    if args.sample is not None:
        generate_sample(args.sample)
        print(f"[pipeline] sample store written → {args.sample}")
        ran = True
    if args.power:
        cmd_power(argparse.Namespace(lat=args.power[0], lon=args.power[1],
                                     start=args.start or 1981, end=args.end or 2026))
        ran = True
    if args.imagery:
        cmd_imagery(argparse.Namespace(lat=args.imagery[0], lon=args.imagery[1], z=args.z))
        ran = True
    if args.firms:
        cmd_firms(argparse.Namespace(lat=args.firms[0], lon=args.firms[1]))
        ran = True
    if args.discover:
        cmd_discover(argparse.Namespace(lat=args.discover[0], lon=args.discover[1],
                                        start=args.start or 1985, end=args.end or 2026))
        ran = True
    if not ran:
        p.print_help()


if __name__ == "__main__":
    main()
