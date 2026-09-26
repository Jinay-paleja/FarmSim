import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.scenario import ParseScenarioRequest, ScenarioType
from app.services.scenario_extractor import (
    build_scenario,
    extract_duration,
    extract_scenario_parameters,
    extract_target_zones,
    normalize_text,
)
from app.services.scenario_parser import parse_scenario

client = TestClient(app)


# ---------------------------------------------------------------------------
# Section 14: Core Requirements Minimum Test Cases
# ---------------------------------------------------------------------------

def test_req_1_rainfall_reduction_extraction():
    """1. 'What if rainfall decreases by 30% for 45 days?' -> RAIN_REDUCTION, 0.70, 45 days"""
    query = "What if rainfall decreases by 30% for 45 days?"
    resp = parse_scenario(ParseScenarioRequest(query=query))

    assert resp.scenario_type == ScenarioType.RAIN_REDUCTION
    assert resp.needs_clarification is False
    assert resp.scenario is not None
    assert resp.scenario.duration_days == 45
    assert resp.scenario.changes.rainfall_multiplier == 0.70
    assert resp.scenario.target_zones == []


def test_req_2_irrigation_increase_with_zone():
    """2. 'Increase irrigation in zone 2 by 20% for 15 days.' -> IRRIGATION_INCREASE, 1.20, 15 days, zone-2"""
    query = "Increase irrigation in zone 2 by 20% for 15 days."
    resp = parse_scenario(ParseScenarioRequest(query=query))

    assert resp.scenario_type == ScenarioType.IRRIGATION_INCREASE
    assert resp.needs_clarification is False
    assert resp.scenario is not None
    assert resp.scenario.duration_days == 15
    assert resp.scenario.changes.irrigation_multiplier == 1.20
    assert resp.scenario.target_zones == ["zone-2"]


def test_req_3_temperature_increase_extraction():
    """3. 'What if temperature increases by 3°C for 7 days?' -> TEMPERATURE_INCREASE, +3, 7 days"""
    query = "What if temperature increases by 3°C for 7 days?"
    resp = parse_scenario(ParseScenarioRequest(query=query))

    assert resp.scenario_type == ScenarioType.TEMPERATURE_INCREASE
    assert resp.needs_clarification is False
    assert resp.scenario is not None
    assert resp.scenario.duration_days == 7
    assert resp.scenario.changes.temperature_delta == 3.0


def test_req_4_fertilizer_change_reduction():
    """4. 'Reduce fertilizer by 25% for 30 days.' -> FERTILIZER_CHANGE, 0.75 multiplier, 30 days"""
    query = "Reduce fertilizer by 25% for 30 days."
    resp = parse_scenario(ParseScenarioRequest(query=query))

    assert resp.scenario_type == ScenarioType.FERTILIZER_CHANGE
    assert resp.needs_clarification is False
    assert resp.scenario is not None
    assert resp.scenario.duration_days == 30
    assert resp.scenario.changes.fertilizer_multiplier == 0.75


def test_req_5_combined_multiple_changes():
    """5. 'Reduce rainfall by 30% and increase temperature by 3°C.' -> COMBINED, rainfall=0.70, temp=+3"""
    query = "Reduce rainfall by 30% and increase temperature by 3°C."
    resp = parse_scenario(ParseScenarioRequest(query=query))

    assert resp.scenario_type == ScenarioType.COMBINED
    assert resp.scenario is not None
    assert resp.scenario.changes.rainfall_multiplier == 0.70
    assert resp.scenario.changes.temperature_delta == 3.0
    # Duration was not provided in this specific sentence
    assert "duration_days" in resp.missing_parameters
    assert resp.needs_clarification is True


def test_req_6_target_zones_multi():
    """6. 'zones 1 and 3' -> ['zone-1', 'zone-3']"""
    zones = extract_target_zones("Simulate drought in zones 1 and 3")
    assert "zone-1" in zones
    assert "zone-3" in zones


def test_req_7_duration_two_weeks():
    """7. 'for 2 weeks' -> 14 days"""
    norm = normalize_text("simulate dry spell for 2 weeks")
    dur = extract_duration(norm)
    assert dur == 14

    norm_words = normalize_text("for two weeks")
    assert extract_duration(norm_words) == 14


def test_req_8_duration_one_month():
    """8. 'for one month' -> 30 days"""
    norm = normalize_text("heatwave for one month")
    dur = extract_duration(norm)
    assert dur == 30

    norm_digit = normalize_text("for 1 month")
    assert extract_duration(norm_digit) == 30


def test_req_9_no_percentage_not_hallucinated():
    """9. No percentage provided. Make sure the system does not invent one."""
    query = "Increase irrigation."
    resp = parse_scenario(ParseScenarioRequest(query=query))

    assert resp.scenario_type == ScenarioType.IRRIGATION_INCREASE
    assert resp.needs_clarification is True
    assert "increase_amount" in resp.missing_parameters
    assert resp.scenario is None


def test_req_10_unrelated_query_rejected():
    """10. Unrelated query. Make sure classification still rejects it."""
    query = "What is the stock price of Apple today?"
    resp = parse_scenario(ParseScenarioRequest(query=query))

    assert resp.scenario_type is None
    assert resp.needs_clarification is True
    assert resp.scenario is None


# ---------------------------------------------------------------------------
# Section 15: Edge Cases and Validations
# ---------------------------------------------------------------------------

def test_edge_case_zero_percent():
    """0% reduction means multiplier = 1.0 (no change)."""
    changes, _, _, _ = extract_scenario_parameters(
        "Reduce rainfall by 0% for 10 days",
        ScenarioType.RAIN_REDUCTION,
    )
    assert changes.rainfall_multiplier == 1.0


def test_edge_case_hundred_percent():
    """100% reduction means multiplier = 0.0 (total cutoff)."""
    changes, _, _, _ = extract_scenario_parameters(
        "Reduce rainfall by 100% for 30 days",
        ScenarioType.RAIN_REDUCTION,
    )
    assert changes.rainfall_multiplier == 0.0


def test_edge_case_word_numbers_twenty_percent():
    """'twenty percent' normalized to 20%."""
    changes, dur, _, _ = extract_scenario_parameters(
        "Increase irrigation by twenty percent for 10 days",
        ScenarioType.IRRIGATION_INCREASE,
    )
    assert changes.irrigation_multiplier == 1.20
    assert dur == 10


def test_edge_case_half_the_rainfall():
    """'half the rainfall' converts to multiplier = 0.50."""
    changes, _, _, _ = extract_scenario_parameters(
        "What if we get half the rainfall for 20 days?",
        ScenarioType.RAIN_REDUCTION,
    )
    assert changes.rainfall_multiplier == 0.50


def test_edge_case_double_irrigation():
    """'double irrigation' converts to multiplier = 2.0."""
    changes, _, _, _ = extract_scenario_parameters(
        "Simulate double irrigation for 15 days",
        ScenarioType.IRRIGATION_INCREASE,
    )
    assert changes.irrigation_multiplier == 2.0


def test_edge_case_negative_temperature():
    """Negative temperature delta (cooling/drop)."""
    changes, _, _, _ = extract_scenario_parameters(
        "Temperature drops by 4°C for 5 days",
        ScenarioType.TEMPERATURE_INCREASE,
    )
    assert changes.temperature_delta == -4.0


def test_edge_case_farm_wide_zones():
    """'entire farm' or 'whole farm' maps to empty target_zones list."""
    zones1 = extract_target_zones("Heatwave across the whole farm")
    assert zones1 == []

    zones2 = extract_target_zones("Drought across all zones")
    assert zones2 == []


def test_edge_case_combined_three_shocks():
    """Triple combined shock: rain reduction, temperature rise, irrigation increase."""
    query = (
        "Reduce rainfall by 30%, increase temperature by 3 degrees "
        "and increase irrigation by 15% for 45 days."
    )
    resp = parse_scenario(ParseScenarioRequest(query=query))

    assert resp.scenario_type == ScenarioType.COMBINED
    assert resp.needs_clarification is False
    assert resp.scenario is not None
    assert resp.scenario.duration_days == 45
    assert resp.scenario.changes.rainfall_multiplier == 0.70
    assert resp.scenario.changes.temperature_delta == 3.0
    assert resp.scenario.changes.irrigation_multiplier == 1.15


def test_api_post_parse_scenario_full_pipeline():
    """Test full API POST /ai/parse-scenario endpoint with parameter extraction."""
    payload = {
        "query": "What if rainfall decreases by 30% for 45 days in zone 1?"
    }
    response = client.post("/ai/parse-scenario", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["scenario_type"] == "RAIN_REDUCTION"
    assert data["confidence"] >= 0.60
    assert data["needs_clarification"] is False
    assert data["scenario"] is not None
    assert data["scenario"]["name"] == "Rainfall Reduction"
    assert data["scenario"]["duration_days"] == 45
    assert data["scenario"]["target_zones"] == ["zone-1"]
    assert data["scenario"]["changes"]["rainfall_multiplier"] == 0.70
