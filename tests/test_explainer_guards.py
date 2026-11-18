"""Unit tests for the fact-locked chat guards (no LLM or network needed)."""
from __future__ import annotations

import pytest

from api.services import explainer

FACTS = {
    "region_name": "Test Basin",
    "lat": 15.8497,
    "lon": 74.4977,
    "variable": "Precipitation",
    "time_range": ["1981-01", "2026-11"],
    "synthetic": False,
    "parameters_used": ["temperature", "precipitation", "solar_radiation"],
    "parameters_unavailable": ["ndvi", "sst", "sea_level"],
    "trends": {
        "temperature": {
            "slope_per_decade": 0.085,
            "p_value": 0.1255,
            "significant": False,
            "direction": "no trend",
            "n": 549,
        },
        "precipitation": {
            "slope_per_decade": 0.862,
            "p_value": 0.0888,
            "significant": False,
            "direction": "no trend",
            "n": 549,
        },
        "solar_radiation": {
            "slope_per_decade": -0.12,
            "p_value": 0.0,
            "significant": True,
            "direction": "decreasing",
            "n": 511,
        },
    },
    "forecast_deltas": {"temperature": 0.165, "precipitation": 66.84},
    "forecast_model": "ridge_rollout",
    "forecast_window": ["2026-12", "2031-11"],
    "horizon_months": 60,
    "anomalies_count": 0,
}


def test_allowed_numbers_pass():
    text = (
        "The forecast covers 2026-12 to 2031-11: precipitation +66.840 mm/month "
        "and temperature +0.165 °C over 60 months, with a p10–p90 band."
    )
    assert explainer._unverified_numbers(text, FACTS, "forecast") == []


def test_invented_total_is_rejected():
    text = "Precipitation gains +334.200 mm across the whole horizon."
    assert explainer._unverified_numbers(text, FACTS, "forecast") == [334.2]


def test_three_decimal_rounding_of_facts_is_allowed():
    text = "Humidity rises with p=0.038, and wind falls with p=0.045."
    facts = {
        **FACTS,
        "trends": {
            **FACTS["trends"],
            "humidity": {"slope_per_decade": 0.744, "p_value": 0.0385,
                          "significant": True, "direction": "increasing", "n": 549},
            "wind": {"slope_per_decade": -0.02, "p_value": 0.0447,
                     "significant": True, "direction": "decreasing", "n": 549},
        },
    }
    assert explainer._unverified_numbers(text, facts, "finding") == []


def test_significance_misread_is_rejected():
    text = "The precipitation trend is statistically significant with a p-value of 0.089."
    assert explainer._stat_guard_reason(text, FACTS, "caveat") == "significance_misread"


def test_p_value_as_probability_is_rejected():
    text = "The p-value of 0.089 indicates a 10% chance that the increase is random."
    assert explainer._stat_guard_reason(text, FACTS, "caveat") == "p_value_misuse"


def test_p10_p90_band_as_chance_is_rejected():
    text = "The forecast is probabilistic with a p10–p90 band, indicating a 10% to 90% chance of occurring."
    assert explainer._stat_guard_reason(text, FACTS, "forecast") == "band_misuse"


def test_correct_non_significant_caveat_passes():
    text = (
        "The precipitation trend is not statistically significant (p=0.089), "
        "so no trend can be confirmed at the 0.05 threshold."
    )
    assert explainer._stat_guard_reason(text, FACTS, "caveat") is None


def test_correct_significant_parameter_passes():
    text = (
        "Solar radiation shows a statistically significant decreasing trend "
        "(p=0.000), while precipitation is not statistically significant."
    )
    assert explainer._stat_guard_reason(text, FACTS, "caveat") is None


def test_facts_summary_distinguishes_net_change_from_rate():
    summary = explainer._facts_summary(FACTS, "forecast")
    assert "seasonal-cycle safe" in summary
    assert "NOT a per-decade rate" in summary
    assert "Forecast window: 2026-12 to 2031-11" in summary


def test_templated_explain_marks_unavailable_without_fake_zero():
    text = explainer.templated_explain(FACTS)["text"]
    assert "Unavailable at this location: ndvi, sst, sea_level" in text
    assert "not filled with zeroes" in text
    assert "NDVI at +0.00" not in text
    assert "mm/month/decade" in text
    assert "precipitation +66.840 mm/month" in text


def test_forecast_confidence_is_never_high():
    assert explainer._confidence(FACTS, "forecast") == "medium"
    assert explainer._confidence(FACTS, "caveat") == "medium"


def _chat_with(monkeypatch, reply: str, question: str) -> dict:
    monkeypatch.setattr(explainer, "_ollama_chat", lambda *a, **k: (reply, "fake-model"))
    return explainer.chat([{"role": "user", "content": question}], FACTS)


def test_chat_guard_falls_back_on_invented_number(monkeypatch):
    result = _chat_with(
        monkeypatch,
        "Precipitation gains +334.200 mm across the horizon.",
        "What does the forecast say?",
    )
    assert result["generator"] == "templated-guard"
    assert result["guard_reason"] == "unverified_numbers"
    assert result["guard_numbers"] == [334.2]
    assert "334" not in result["text"]


def test_chat_guard_falls_back_on_significance_misread(monkeypatch):
    result = _chat_with(
        monkeypatch,
        "The precipitation trend is statistically significant with a p-value of 0.089.",
        "Is the rainfall trend significant?",
    )
    assert result["generator"] == "templated-guard"
    assert result["guard_reason"] == "significance_misread"


def test_chat_passes_clean_fact_reuse(monkeypatch):
    result = _chat_with(
        monkeypatch,
        "Precipitation has a forecast net change of +66.840 mm/month over 60 months; "
        "the historical trend is not statistically significant.",
        "What does the forecast say?",
    )
    assert result["generator"] == "ollama"
    assert result["model"] == "fake-model"
