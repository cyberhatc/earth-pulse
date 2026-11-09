"""API smoke tests. Skipped automatically if fastapi is unavailable."""
from __future__ import annotations

import pytest

fastapi = pytest.importorskip("fastapi")
from fastapi.testclient import TestClient  # noqa: E402

from api.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["schema_version"] == "1.0.0"


def test_place_payload(client):
    r = client.get("/place", params={"lat": 12.97, "lon": 77.59, "horizon_months": 24})
    assert r.status_code == 200
    body = r.json()
    for key in ("schema_version", "location", "data_coverage", "past", "trends", "forecast", "explanation"):
        assert key in body
    assert body["location"]["cell_index"] >= 0
    assert len(body["forecast"]["dates"]) == 24
    assert len(body["past"]["dates"]) > 100


def test_projected_svg(client):
    r = client.get("/imagery/projected", params={"parameter": "temperature", "year": 2030})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/svg+xml")
    assert "<svg" in r.text
