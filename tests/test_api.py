"""API contract tests via FastAPI's TestClient.

Skipped automatically when fastapi/httpx are not installed. The app is exercised
against the bundled sample store + precomputed engine artifacts, so this is a
true end-to-end check of `/health` and `/place`.
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


def test_health_ok(client: TestClient):
    r = client.get("/health")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "ok"
    assert body["schema_version"] == "1.0.0"
    assert body["sample_store"] is True


def test_place_has_schema_version(client: TestClient):
    r = client.get("/place", params={"lat": 12.97, "lon": 77.59})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["schema_version"] == "1.0.0"
    assert body["location"]["cell_index"] >= 0
    assert set(body) >= {"location", "data_coverage", "past", "trends", "forecast",
                         "opposite_trends", "explanation"}


def test_place_horizon_and_band_ordering(client: TestClient):
    horizon = 24
    r = client.get("/place", params={"lat": 12.97, "lon": 77.59, "horizon_months": horizon})
    assert r.status_code == 200, r.text
    fc = r.json()["forecast"]
    assert fc["horizon_months"] == horizon
    assert len(fc["dates"]) == horizon
    for name, series in fc["timeseries"].items():
        assert len(series["mean"]) == horizon, f"{name}: horizon mismatch"
        for lo, mean, hi in zip(series["lower"], series["mean"], series["upper"]):
            assert lo <= mean <= hi, f"{name}: band ordering violated"


def test_place_labels_synthetic_data(client: TestClient):
    r = client.get("/place", params={"lat": -33.87, "lon": 151.21})
    assert r.status_code == 200, r.text
    cov = r.json()["data_coverage"]
    # The bundled demo must never masquerade as observed data.
    assert cov["synthetic_demo"] is True
    assert any("synthetic" in note.lower() for note in cov["gap_notes"])


def test_place_rejects_out_of_range(client: TestClient):
    assert client.get("/place", params={"lat": 999, "lon": 0}).status_code == 422
    assert client.get("/place", params={"lat": 0, "lon": 0, "horizon_months": 1}).status_code == 422
