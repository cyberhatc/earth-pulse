"""One module per data source, each exposing a ``fetch(...)`` returning an
xarray.Dataset with units + attrs (source, product, version, url, retrieved_at).

All fetches cache raw downloads under ``data/cache/realstore/`` (TTL
``EP_CACHE_TTL``, seconds) so re-runs are offline-friendly. Sources that need a
free login report ``available=False`` with the reason — never fake values.
"""
