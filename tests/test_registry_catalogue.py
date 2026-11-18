import json

from models.parameter_registry import (
    GROUPS,
    ML_EXCLUDE,
    PARAMETERS,
    PARAM_ORDER,
    REQUESTED_UNAVAILABLE,
    SATELLITE_PARAMS,
)
from pipeline.fetch_gibs import GROUPS as GIBS_GROUPS
from pipeline.fetch_gibs import LAYERS as GIBS_LAYERS
from pipeline.fetch_power import MAX_PARAMS_PER_REQUEST, fetch_power_point


def test_registry_covers_brief_catalogue():
    assert len(PARAM_ORDER) == len(set(PARAM_ORDER)) == 64
    assert set(PARAM_ORDER) == set(PARAMETERS)
    assert "Snow & cryosphere" in GROUPS
    for key in (
        "surface_reflectance_green",
        "surface_reflectance_swir2",
        "ndsi",
        "snow_cover",
        "net_radiation",
        "soil_moisture_rootzone",
        "aerosol_optical_depth",
        "gpp",
    ):
        assert key in PARAMETERS
    assert {"ndsi", "snow_cover", "surface_reflectance_swir2", "gpp"} <= SATELLITE_PARAMS
    assert "wind_direction" in ML_EXCLUDE


def test_requested_unavailable_are_explicit():
    assert {"runoff", "glacier_ice_thickness", "viirs_point_series"} <= set(
        REQUESTED_UNAVAILABLE
    )
    for entry in REQUESTED_UNAVAILABLE.values():
        assert entry["reason"]
        assert entry["source"]


def test_gibs_has_verified_snow_and_viirs_layers():
    names = {name for _, group in GIBS_GROUPS for name in group}
    assert {
        "viirs_true_color",
        "viirs_false_color",
        "ndsi",
        "snow_mass",
        "gldas_precipitation",
    } <= names
    assert names <= set(GIBS_LAYERS)


def test_openmeteo_cache_can_be_reused_when_stale(tmp_path, monkeypatch):
    from pipeline import fetch_openmeteo

    cache = tmp_path / "stale.json"
    cache.write_text(
        json.dumps({
            "cache_version": fetch_openmeteo.CACHE_VERSION - 1,
            "generated_utc": "2020-01-01T00:00:00",
            "available": True,
            "parameters": {"temperature": {"2024-01": 25.0}},
        })
    )
    assert fetch_openmeteo._read_cache(cache) is None
    stale = fetch_openmeteo._read_cache(cache, stale_ok=True)
    assert stale["available"] is True
    assert "cached ERA5 copy" in stale["note"]
    assert stale["stale_cache"]


def test_power_client_chunks_long_parameter_lists(monkeypatch):
    seen: list[list[str]] = []

    def fake_chunk(lat, lon, start, end, params, timeout):
        seen.append(list(params))
        return {p: {"2024-01": 1.0} for p in params}, "url"

    monkeypatch.setattr("pipeline.fetch_power._fetch_chunk", fake_chunk)
    params = [f"P{i}" for i in range(MAX_PARAMS_PER_REQUEST + 3)]
    result = fetch_power_point(1.0, 2.0, parameters=params)
    assert result.get("error") is None
    assert len(result["parameters"]) == len(params)
    assert [len(chunk) for chunk in seen] == [
        MAX_PARAMS_PER_REQUEST,
        len(params) - MAX_PARAMS_PER_REQUEST,
    ]
