"""Pydantic schemas for the unified on-click payload (see docs/api-contract.md)."""
from __future__ import annotations

from pydantic import BaseModel, Field

SCHEMA_VERSION = "1.0.0"


class Location(BaseModel):
    lat: float
    lon: float
    cell_index: int
    grid_lat: float
    grid_lon: float
    name: str | None = None


class DataCoverage(BaseModel):
    synthetic_demo: bool
    parameters_used: list[str]
    sources: dict[str, str]
    time_range: list[str]
    gap_notes: list[str] = Field(default_factory=list)
    notes: str = ""


class PastBlock(BaseModel):
    dates: list[str]
    timeseries: dict[str, list[float]]
    imagery: list[dict]
    anomalies: list[dict]


class TrendRecord(BaseModel):
    slope_per_decade: float
    p_value: float
    significant: bool
    direction: str
    n: int


class ForecastBlock(BaseModel):
    horizon_months: int
    issued: str
    model: str
    dates: list[str]
    timeseries: dict[str, dict[str, list[float]]]
    backtest: dict | None = None
    projected_images: list[dict] = Field(default_factory=list)
    scenarios: list[dict] = Field(default_factory=list)


class Explanation(BaseModel):
    text: str
    language: str = "en"
    generator: str = "templated"
    confidence: str = "medium"


class PlacePayload(BaseModel):
    schema_version: str = SCHEMA_VERSION
    location: Location
    data_coverage: DataCoverage
    past: PastBlock
    trends: dict[str, dict]
    forecast: ForecastBlock
    opposite_trends: list[dict] = Field(default_factory=list)
    climate_twin: dict | None = None
    explanation: Explanation


class ExplainRequest(BaseModel):
    facts: dict


class ExplainResponse(BaseModel):
    text: str
    generator: str
    confidence: str
