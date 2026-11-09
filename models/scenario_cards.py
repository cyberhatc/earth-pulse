"""CLI for scenario cards: inspect prompts offline, or generate with a GPU.

Examples:
  # offline — print conditioning JSON (prompt, deltas, tile URL), no GPU, no keys
  python3 models/scenario_cards.py --lat 12.97 --lon 77.59 --parameter ndvi

  # GPU (Colab/Kaggle) — real image-to-image generation
  EP_SCENARIO_IMAGES=1 python3 models/scenario_cards.py --generate --lat 12.97 --lon 77.59 --parameter ndvi
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.fetch_gibs import thumbnails_for_point
from models.infer import forecast_place
from pipeline.export_store import nearest_cell_index, load_store
from models.scenario_image import build_conditioning, generate_scenario_cards, LABEL


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lat", type=float, required=True)
    ap.add_argument("--lon", type=float, required=True)
    ap.add_argument("--parameter", default="ndvi")
    ap.add_argument("--horizon-months", type=int, default=60)
    ap.add_argument("--generate", action="store_true", help="actually run the diffusion pipeline (GPU + diffusers)")
    args = ap.parse_args()

    store = load_store()
    cell = nearest_cell_index(store, args.lat, args.lon)
    fc = forecast_place(store, cell, args.horizon_months)
    mean = fc["timeseries"][args.parameter]["mean"]
    last_observed = float(store[args.parameter][:, cell][-1]) if args.parameter in store else None

    tiles = thumbnails_for_point(args.lat, args.lon, ["2025-06-01"], z=4)
    src = next(t["url"] for t in tiles if t["layer"] == "ndvi") if tiles else None
    assert src, "could not build a GIBS source tile URL"

    if not args.generate:
        conditioning = build_conditioning(args.lat, args.lon, args.parameter, mean, last_observed, src)
        print(json.dumps(conditioning, indent=2))
        print(f"\n[scenario] OFFLINE mode — prompts only. Set EP_SCENARIO_IMAGES=1 and pass --generate on a GPU.")
        return 0

    result = generate_scenario_cards(
        args.lat, args.lon, args.parameter, mean, last_observed=last_observed,
        source_image_url=src, acknowledge_not_observation=True,
    )
    print(json.dumps(result, indent=2, default=str))
    return 0 if result.get("status") == "generated" else 2


if __name__ == "__main__":
    sys.exit(main())
