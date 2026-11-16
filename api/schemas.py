"""Pydantic schemas for the unified on-click payload (see docs/api-contract.md).

SCHEMA_VERSION is the API contract version. Response models use extra="allow"
so the API can grow additively without breaking clients or the contract.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

SCHEMA_VERSION = "1.1.0"
API_VERSION = "0.4.1"


class LooseModel(BaseModel):
    model_config = ConfigDict(extra="allow")


class Location(BaseModel):
    lat: float
    lon: float
    cell_index: int
    grid_lat: float
    grid_lon: float
    name: str | None = None


class DataCoverage(LooseModel):
    synthetic_demo: bool
    parameters_used: list[str]
    sources: dict[str, str] = Field(default_factory=dict)
    time_range: list[str] = Field(default_factory=list)
    gap_notes: list[str] = Field(default_factory=list)
    notes: str = ""


class PastBlock(LooseModel):
    dates: list[str]
    timeseries: dict[str, list[float] | list[float | None]]
    imagery: list[dict] = Field(default_factory=list)
    anomalies: list[dict] = Field(default_factory=list)


class TrendRecord(LooseModel):
    slope_per_decade: float
    p_value: float
    significant: bool
    direction: str
    n: int


class ForecastBlock(LooseModel):
    horizon_months: int
    issued: str
    model: str
    dates: list[str]
    timeseries: dict[str, dict[str, list[float]]]
    backtest: dict | None = None
    band_method: str | None = None
    calibration: dict | None = None
    projected_images: list[dict] = Field(default_factory=list)
    scenarios: list[dict] = Field(default_factory=list)


class Explanation(BaseModel):
    text: str
    language: str = "en"
    generator: str = "templated"
    confidence: str = "medium"


class OppositeMeta(LooseModel):
    ndvi: dict = Field(default_factory=dict)
    precipitation: dict = Field(default_factory=dict)


class PlacePayload(LooseModel):
    schema_version: str = SCHEMA_VERSION
    location: Location
    data_coverage: DataCoverage
    past: PastBlock
    trends: dict[str, TrendRecord | dict]
    forecast: ForecastBlock
    opposite_trends: list[dict] = Field(default_factory=list)
    opposite_meta: dict | None = None
    climate_twin: dict | None = None
    explanation: Explanation


class ExplainRequest(BaseModel):
    facts: dict

    @field_validator("facts")
    @classmethod
    def _facts_size_cap(cls, v: dict) -> dict:
        import json
        if len(v) > 128:
            raise ValueError("facts dict too large (max 128 keys)")
        if len(json.dumps(v, default=str)) > 65_536:
            raise ValueError("facts payload too large (max 64 KiB serialized)")
        return v


class ExplainResponse(LooseModel):
    text: str
    generator: str
    confidence: str
    schema_version: str = SCHEMA_VERSION


class ChatTurn(BaseModel):
    role: str = Field("user", max_length=16)
    content: str = Field(..., max_length=4000)


class ChatRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-360, le=360)
    messages: list[ChatTurn] = Field(default_factory=list, max_length=12)
    horizon_months: int = Field(60, ge=3, le=240)
    region_name: str | None = Field(None, max_length=128)
    variable: str | None = Field(None, max_length=64)
    language: str = Field("en", max_length=16)


class ChatResponse(LooseModel):
    text: str
    generator: str
    model: str | None = None
    confidence: str
    card_kind: str
    llm_available: bool
    guard_reason: str | None = None
    guard_numbers: list[float] = Field(default_factory=list)
    sources: list[dict] = Field(default_factory=list)
    facts: dict = Field(default_factory=dict)


class HealthStore(LooseModel):
    path: str
    name: str
    exists: bool
    synthetic: bool
    real_data: bool
    provenance: str | None = None
    time_range: list[str] | None = None
    n_months: int | None = None


class HealthModels(LooseModel):
    artifact: str | None = None
    conformal_calibrated: bool = False
    calibration_date: str | None = None
    band_methods: list[str] = Field(default_factory=list)


class HealthResponse(LooseModel):
    status: str
    schema_version: str = SCHEMA_VERSION
    api_version: str = API_VERSION
    uptime_seconds: float = 0.0
    sample_store: bool
    store: HealthStore
    manifest_hash: str | None = None
    models: HealthModels = Field(default_factory=HealthModels)
    analysis: bool
    analysis_path: str | None = None
    llm: dict = Field(default_factory=dict)
    rag: dict = Field(default_factory=dict)


class ForecastEnvelope(LooseModel):
    schema_version: str = SCHEMA_VERSION
    cell_index: int
    grid_lat: float
    grid_lon: float
    forecast: ForecastBlock


class AnomaliesResponse(LooseModel):
    schema_version: str = SCHEMA_VERSION
    cell_index: int
    grid_lat: float
    grid_lon: float
    anomalies: list[dict] = Field(default_factory=list)
    window_months: int = 61
    threshold: float = 3.5


class TrendsCellResponse(LooseModel):
    schema_version: str = SCHEMA_VERSION
    cell_index: int
    grid_lat: float
    grid_lon: float
    trends: dict[str, TrendRecord | dict]


class OppositeResponse(LooseModel):
    schema_version: str = SCHEMA_VERSION
    cell_index: int
    grid_lat: float
    grid_lon: float
    opposite_trends: list[dict] = Field(default_factory=list)
    opposite_meta: dict | None = None


class GridTrendsResponse(LooseModel):
    schema_version: str = SCHEMA_VERSION
    variable: str
    n_cells: int
    synthetic_demo: bool
    time_range: list[str] | None = None
    cells: list[dict] = Field(default_factory=list)


class TwinResponse(LooseModel):
    schema_version: str = SCHEMA_VERSION
    cell_index: int
    grid_lat: float
    grid_lon: float
    twin: dict


class ErrorResponse(BaseModel):
    error: str
    detail: str
    partial: dict | None = None
