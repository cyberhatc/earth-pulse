"""Land/ocean mask layer.

Two modes:
1. DEMO — an embedded, deterministic coarse mask (10 lat × 24 lon, 15° grid) for the
   synthetic sample store. It is ILLUSTRATIVE (dominant class per cell), clearly
   labeled, and exists so the UI/API can honestly report per-parameter relevance.
2. REAL — derive the mask from a real SST cube: ocean where SST is finite in the
   climatological mean; everywhere else is land/ice. This is the production path and
   requires no extra downloads.

Convention: 1 = ocean, 0 = land.
"""
from __future__ import annotations

import numpy as np

# Demo mask rows in the SAME order as store["lats"] (ascending: -60 … 75),
# columns aligned to store["lons"] (ascending: -180 … 165).
# '~' = ocean, '#' = land. Approximate dominant class per 15° cell — NOT authoritative.
_DEMO_ROWS = [
    "~~~~~~~~~~~~~~~~~~~~~~~~",   # -60  Southern Ocean
    "~~~~~~~~~~~~~~~~~~~~~~~~",   # -45  Southern Ocean
    "~~~~~~~~#~~~~##~~~~~###~",   # -30  S. America bulge, S. Africa, S. Australia
    "~~~~~~~###~#####~~~~##~~",   # -15  S. America, central Africa, Madagascar, Indonesia hint
    "~~~~~~~###~#####~~~##~~~",   #   0  S. America, equatorial Africa, maritime continent
    "~~~~####~~~##########~~~",   #  15  N. America, N. Africa/Arabia, S. Asia
    "~~~######~~~##########~~",   #  30  N. America, Eurasia belt
    "~~~######~~~###########~",   #  45  N. America, Eurasia
    "~##########~############",   #  60  N. America/Greenland, Eurasia
    "~~~#########~~##~~~~~~~~",   #  75  Canadian Archipelago, Greenland, Siberian islands
]

DEMO_MASK = np.array([[1 if c == "~" else 0 for c in row] for row in _DEMO_ROWS], dtype=np.uint8)

assert DEMO_MASK.shape == (10, 24), DEMO_MASK.shape


def demo_mask_flat() -> np.ndarray:
    """1-D mask aligned with the sample store's C-order grid (lat outer, lon inner)."""
    return DEMO_MASK.reshape(-1).copy()


def derive_mask_from_sst(sst_cube: np.ndarray, min_fraction_finite: float = 0.5) -> np.ndarray:
    """Production path. sst_cube: (time, lat, lon). Ocean where SST finite most of the time.

    Returns uint8 mask, 1 = ocean, same shape as a lat×lon grid.
    """
    frac = np.isfinite(sst_cube).mean(axis=0)
    return (frac >= min_fraction_finite).astype(np.uint8)


def apply_mask_in_place(store: dict, mask_flat: np.ndarray) -> None:
    """Apply ocean/land relevance semantics to store arrays (mutates store).

    SST & sea level exist only over ocean; NDVI only over land.
    """
    ocean = mask_flat == 1
    land = ~ocean
    store["ocean_mask"] = mask_flat
    store["sst"][:, land] = np.nan
    store["sea_level"][:, land] = np.nan
    store["ndvi"][:, ocean] = np.nan
    return None
