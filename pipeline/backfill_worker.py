"""Process-isolated MODIS point-store backfill worker.

The mosaic point client uses urllib, which is not thread-safe in this sandbox
(a threaded backfill crashed the API process with ``free(): invalid pointer``).
Running the backfill in its own process keeps the web server alive while the
bounded MODIS requests complete. The worker is intentionally tiny: the API
already wrote the real POWER/ERA5/AQ core store before launching it.
"""
from __future__ import annotations

import argparse
import sys
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from pipeline.fetch_highres_point import augment_point_store_satellite  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description="Backfill MODIS series into a point store")
    ap.add_argument("--lat", type=float, required=True)
    ap.add_argument("--lon", type=float, required=True)
    ap.add_argument("--mode", default="fast", choices=["fast", "full"])
    args = ap.parse_args()
    try:
        path = augment_point_store_satellite(
            args.lat, args.lon, mode=args.mode
        )
        print(f"[backfill] done {args.lat},{args.lon} mode={args.mode} -> {path}", flush=True)
        return 0
    except Exception:
        print(f"[backfill] FAILED {args.lat},{args.lon}", flush=True)
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
