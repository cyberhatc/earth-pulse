"""Earth Pulse data pipeline package.

Modules:
- auth: NASA Earthdata login helpers (from environment)
- fetch_power / fetch_firms / fetch_gridded / fetch_gibs / discover: source-specific fetchers
- clean: alignment, missing-data handling, standardisation
- build_features: feature engineering shared by engine and models
- export_store: the sample .npz store format + optional Zarr/xarray export
- run_pipeline: command-line entry point (``--sample`` generates the offline demo store)
"""
