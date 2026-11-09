"""Feature engineering shared by the engine and models."""
from __future__ import annotations

import math

import numpy as np


def time_features(dates: list[str]) -> dict[str, np.ndarray]:
    month = np.array([int(d.split("-")[1]) for d in dates], dtype=np.float64)
    year = np.array([int(d.split("-")[0]) for d in dates], dtype=np.float64)
    return {
        "month_sin": np.sin(2 * np.pi * month / 12.0),
        "month_cos": np.cos(2 * np.pi * month / 12.0),
        "year_index": (year - year[0]) + (month - 1) / 12.0,
        "decimal_year": year + (month - 0.5) / 12.0,
    }


def geo_features(grid_lat: np.ndarray, grid_lon: np.ndarray) -> dict[str, np.ndarray]:
    """Per-cell static features (normalised)."""
    return {
        "lat": grid_lat / 90.0,
        "lon_sin": np.sin(np.radians(grid_lon)),
        "lon_cos": np.cos(np.radians(grid_lon)),
        "abs_lat": np.abs(grid_lat) / 90.0,
    }


def overlap_indices(coverage: dict[str, tuple[int, int]], variables: list[str]):
    """Given {var: (start_year, end_year)}, return the common overlap (start, end)."""
    start = max(coverage[v][0] for v in variables)
    end = min(coverage[v][1] for v in variables)
    return start, end


def prepare_cell_matrix(store: dict[str, np.ndarray], cell: int,
                        variables: list[str] | None = None) -> tuple[list[str], np.ndarray]:
    """Return (dates, X) with X shape (T, n_vars), NaN-filled per variable."""
    from pipeline.clean import fill_missing_linear
    variables = variables or ["temperature", "precipitation", "ndvi", "sst", "sea_level", "solar_radiation", "humidity", "wind"]
    dates = list(store["dates"])
    cols = [fill_missing_linear(store[v][:, cell]) for v in variables]
    return dates, np.stack(cols, axis=1)
