"""Contract snapshot tests — pin the top-level shape of the public API.

These are deliberately shallow (key presence + a few types), not value
snapshots: the payload is deterministic for the bundled sample store, but we
pin *shape* so accidental key removals / renames fail CI loudly. Additive
fields are always allowed (the contract is additive-only, see
docs/api-contract.md).
"""
from __future__ import annotations

from pathlib import Path

import pytest

pytest.importorskip("fastapi", reason="fastapi not installed")
pytest.importorskip("httpx", reason="httpx not installed")

from fastapi.testclient import TestClient  # noqa: E402

from api.main import app  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
STORE = ROOT / "data" / "samples" / "earth_pulse_sample.npz"
ANALYSIS = ROOT / "data" / "processed" / "analysis.json"

pytestmark = pytest.mark.skipif(
    not STORE.exists() or not ANALYSIS.exists(),
    reason="run `make engine` first (sample store + analysis.json required)",
)


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(app) as c:
        yield c


def _assert_keys(body: dict, keys: set[str], label: str) -> None:
    missing = keys - set(body)
    assert not missing, f"{label}: missing top-level keys {sorted(missing)}"


def test_health_shape(client: TestClient):
    r = client.get("/health")
    assert r.status_code == 200, r.text
    body = r.json()
    _assert_keys(body, {
        "status", "schema_version", "api_version", "uptime_seconds",
        "sample_store", "store", "manifest_hash", "models",
        "analysis", "analysis_path", "llm", "rag",
    }, "/health")
    _assert_keys(body["store"], {"path", "name", "exists", "synthetic", "real_data"}, "/health.store")
    _assert_keys(body["models"], {"artifact", "conformal_calibrated", "band_methods"}, "/health.models")


def test_place_shape(client: TestClient):
    r = client.get("/place", params={"lat": 12.97, "lon": 77.59, "horizon_months": 24})
    assert r.status_code == 200, r.text
    body = r.json()
    _assert_keys(body, {
        "schema_version", "location", "data_coverage", "past", "trends",
        "forecast", "opposite_trends", "opposite_meta", "climate_twin", "explanation",
    }, "/place")
    _assert_keys(body["forecast"], {
        "horizon_months", "issued", "model", "dates", "timeseries",
        "backtest", "band_method",
    }, "/place.forecast")
    _assert_keys(body["explanation"], {"text", "language", "generator", "confidence"}, "/place.explanation")
    assert body["schema_version"] == "1.1.0"


def test_forecast_shape(client: TestClient):
    r = client.get("/forecast", params={"lat": 12.97, "lon": 77.59, "horizon_months": 24})
    assert r.status_code == 200, r.text
    body = r.json()
    _assert_keys(body, {
        "schema_version", "cell_index", "grid_lat", "grid_lon",
        "horizon_months", "issued", "model", "dates", "timeseries",
        "trained_artifact", "note",
    }, "/forecast")
    assert body["schema_version"] == "1.1.0"


def test_anomalies_shape(client: TestClient):
    r = client.get("/anomalies", params={"lat": 12.97, "lon": 77.59})
    assert r.status_code == 200, r.text
    body = r.json()
    _assert_keys(body, {
        "schema_version", "cell_index", "grid_lat", "grid_lon",
        "threshold_abs_z", "anomalies",
    }, "/anomalies")
    assert isinstance(body["anomalies"], list)


def test_twins_shape(client: TestClient):
    r = client.get("/twins", params={"lat": 12.97, "lon": 77.59})
    assert r.status_code == 200, r.text
    body = r.json()
    _assert_keys(body, {"schema_version", "cell_index", "grid_lat", "grid_lon", "twin"}, "/twins")
    _assert_keys(body["twin"], {"cluster_id", "k", "features"}, "/twins.twin")


def test_trends_cell_shape(client: TestClient):
    r = client.get("/trends/cell", params={"lat": 12.97, "lon": 77.59})
    assert r.status_code == 200, r.text
    body = r.json()
    _assert_keys(body, {"schema_version", "cell_index", "grid_lat", "grid_lon", "trends"}, "/trends/cell")


def test_trends_opposite_shape(client: TestClient):
    r = client.get("/trends/opposite", params={"lat": 12.97, "lon": 77.59})
    assert r.status_code == 200, r.text
    body = r.json()
    _assert_keys(body, {
        "schema_version", "cell_index", "grid_lat", "grid_lon",
        "opposite_trends", "opposite_meta",
    }, "/trends/opposite")
    assert isinstance(body["opposite_meta"], dict)
    assert "precipitation" in body["opposite_meta"]


def test_trends_grid_shape(client: TestClient):
    r = client.get("/trends/grid", params={"variable": "precipitation"})
    assert r.status_code == 200, r.text
    body = r.json()
    _assert_keys(body, {
        "schema_version", "variable", "n_cells", "synthetic_demo", "time_range", "cells",
    }, "/trends/grid")
    assert body["variable"] == "precipitation"


def test_chat_shape(client: TestClient):
    r = client.post("/chat", json={
        "lat": 12.97, "lon": 77.59,
        "messages": [{"role": "user", "content": "How is this place changing?"}],
        "horizon_months": 24,
    })
    assert r.status_code == 200, r.text
    body = r.json()
    _assert_keys(body, {
        "schema_version", "text", "generator", "model", "confidence",
        "card_kind", "llm_available", "guard_reason", "guard_numbers",
        "sources", "facts",
    }, "/chat")


def test_explain_shape(client: TestClient):
    r = client.post("/explain", json={"facts": {"summary": "contract snapshot"}})
    assert r.status_code == 200, r.text
    body = r.json()
    _assert_keys(body, {"schema_version", "text", "generator", "confidence"}, "/explain")


def test_lon_wraps_normalise(client: TestClient):
    """lon outside [-180, 180) is normalised, not rejected (contract: additive lon range)."""
    r = client.get("/place", params={"lat": 12.97, "lon": 192.59, "horizon_months": 12})
    assert r.status_code == 200, r.text
    assert abs(r.json()["location"]["grid_lon"] - (-167.41)) < 2.5
