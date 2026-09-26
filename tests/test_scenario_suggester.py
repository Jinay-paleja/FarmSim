"""
Unit and Integration Tests for Scenario Suggester Service & Endpoint.

Validates Section 10 Test Requirements:
1. Healthy farm -> no unnecessary recommendations.
2. HIGH water stress -> rainfall reduction recommendation.
3. HIGH heat stress -> heatwave recommendation.
4. HIGH disease risk -> disease outbreak recommendation.
5. HIGH nutrient risk -> fertilizer reduction recommendation.
6. Multiple HIGH risks -> multiple relevant recommendations.
7. Multiple zones -> recommendations target the correct zone.
8. Duplicate triggering conditions -> no duplicate scenarios.
9. Maximum 5 recommendations constraint.
10. MEDIUM risks -> appropriate lower-intensity scenarios.
11. Existing scenario schema validation.
12. API endpoint integration (POST /ai/suggest-scenarios).
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.farm import FarmState, Zone
from app.schemas.result import (
    RiskLevel,
    RiskResult,
    ZoneRisk,
    ScenarioRecommendation,
    SuggestScenariosResponse,
)
from app.schemas.scenario import Scenario, ScenarioType
from app.services.scenario_suggester import ScenarioSuggester, suggest_scenarios

client = TestClient(app)


def build_zone(
    zone_id: str = "zone-1",
    name: str = "Test Zone",
    crop: str = "Wheat",
    soil: str = "Loam",
    growth_stage: str = "Vegetative",
    irrigation: str = "Drip",
    soil_moisture: float = 24.0,
    temperature: float = 22.0,
    humidity: float = 55.0,
    rainfall: float = 5.0,
    nitrogen: float = 45.0,
    phosphorus: float = 22.0,
    potassium: float = 160.0,
) -> Zone:
    """Helper to build a valid Zone schema."""
    return Zone(
        zone_id=zone_id,
        name=name,
        area_acres=20.0,
        crop=crop,
        soil=soil,
        growth_stage=growth_stage,
        irrigation=irrigation,
        soil_moisture=soil_moisture,
        temperature=temperature,
        humidity=humidity,
        rainfall=rainfall,
        nitrogen=nitrogen,
        phosphorus=phosphorus,
        potassium=potassium,
    )


def build_zone_risk(
    zone_id: str = "zone-1",
    water_stress: RiskLevel = RiskLevel.LOW,
    heat_stress: RiskLevel = RiskLevel.LOW,
    disease_risk: RiskLevel = RiskLevel.LOW,
    nutrient_risk: RiskLevel = RiskLevel.LOW,
    overall: RiskLevel = RiskLevel.LOW,
) -> ZoneRisk:
    """Helper to build a controlled ZoneRisk for unit testing."""
    return ZoneRisk(
        zone_id=zone_id,
        risk_level=overall,
        water_stress=water_stress,
        heat_stress=heat_stress,
        disease_risk=disease_risk,
        nutrient_risk=nutrient_risk,
        primary_threat="Test Threat",
        score=0.5,
        contributing_factors=["Test Factor"],
    )


# ----------------------------------------------------------------------
# 1. Healthy Farm -> No Unnecessary Recommendations
# ----------------------------------------------------------------------

def test_1_healthy_farm_no_recommendations():
    """A completely healthy farm with all LOW risks should return 0 recommendations."""
    healthy_zone = build_zone(
        soil_moisture=26.0,
        temperature=22.0,
        humidity=50.0,
        rainfall=5.0,
        nitrogen=50.0,
        phosphorus=25.0,
        potassium=180.0,
    )
    farm_state = FarmState(farm_id="farm-healthy", zones=[healthy_zone])

    suggester = ScenarioSuggester()
    response = suggester.suggest(farm_state)

    assert isinstance(response, SuggestScenariosResponse)
    assert response.farm_id == "farm-healthy"
    assert len(response.recommendations) == 0


# ----------------------------------------------------------------------
# 2. HIGH Water Stress -> Rainfall Reduction Recommendation
# ----------------------------------------------------------------------

def test_2_high_water_stress_rainfall_reduction():
    """HIGH water stress should trigger severe rainfall deficit stress test."""
    dry_zone = build_zone(zone_id="z-dry", irrigation="Rainfed")
    farm_state = FarmState(farm_id="farm-dry", zones=[dry_zone])
    risk_result = RiskResult(
        farm_id="farm-dry",
        overall_risk_level=RiskLevel.HIGH,
        zone_risks=[build_zone_risk(zone_id="z-dry", water_stress=RiskLevel.HIGH, overall=RiskLevel.HIGH)],
    )

    suggester = ScenarioSuggester()
    response = suggester.suggest(farm_state, risk_result=risk_result)

    assert len(response.recommendations) >= 1
    rec = response.recommendations[0]
    assert rec.priority == RiskLevel.HIGH
    assert rec.scenario.scenario_type == ScenarioType.RAIN_REDUCTION
    assert rec.scenario.duration_days == 30
    assert rec.scenario.changes.rainfall_multiplier == 0.70
    assert "WATER_STRESS" in rec.triggered_risks
    assert "water stress" in rec.reason.lower() or "drought" in rec.reason.lower()


# ----------------------------------------------------------------------
# 3. HIGH Heat Stress -> Heatwave Recommendation
# ----------------------------------------------------------------------

def test_3_high_heat_stress_heatwave():
    """HIGH heat stress should trigger heatwave simulation."""
    hot_zone = build_zone(zone_id="z-hot", growth_stage="Flowering")
    farm_state = FarmState(farm_id="farm-hot", zones=[hot_zone])
    risk_result = RiskResult(
        farm_id="farm-hot",
        overall_risk_level=RiskLevel.HIGH,
        zone_risks=[build_zone_risk(zone_id="z-hot", heat_stress=RiskLevel.HIGH, overall=RiskLevel.HIGH)],
    )

    response = suggest_scenarios(farm_state, risk_result=risk_result)

    assert len(response.recommendations) == 1
    rec = response.recommendations[0]
    assert rec.priority == RiskLevel.HIGH
    assert rec.scenario.scenario_type == ScenarioType.HEATWAVE
    assert rec.scenario.duration_days == 7
    assert rec.scenario.changes.temperature_delta == 5.0
    assert "HEAT_STRESS" in rec.triggered_risks
    assert "pollen" in rec.reason.lower() or "thermal" in rec.reason.lower() or "heat" in rec.reason.lower()


# ----------------------------------------------------------------------
# 4. HIGH Disease Risk -> Disease Outbreak Recommendation
# ----------------------------------------------------------------------

def test_4_high_disease_risk_outbreak():
    """HIGH disease risk should trigger disease outbreak scenario."""
    wet_zone = build_zone(zone_id="z-wet")
    farm_state = FarmState(farm_id="farm-wet", zones=[wet_zone])
    risk_result = RiskResult(
        farm_id="farm-wet",
        overall_risk_level=RiskLevel.HIGH,
        zone_risks=[build_zone_risk(zone_id="z-wet", disease_risk=RiskLevel.HIGH, overall=RiskLevel.HIGH)],
    )

    response = suggest_scenarios(farm_state, risk_result=risk_result)

    assert len(response.recommendations) == 1
    rec = response.recommendations[0]
    assert rec.priority == RiskLevel.HIGH
    assert rec.scenario.scenario_type == ScenarioType.DISEASE_OUTBREAK
    assert rec.scenario.duration_days == 14
    assert rec.scenario.changes.disease_pressure == 0.80
    assert "DISEASE_RISK" in rec.triggered_risks


# ----------------------------------------------------------------------
# 5. HIGH Nutrient Risk -> Fertilizer Reduction Recommendation
# ----------------------------------------------------------------------

def test_5_high_nutrient_risk_fertilizer_reduction():
    """HIGH nutrient risk should trigger 25% fertilizer cut scenario."""
    depleted_zone = build_zone(zone_id="z-nut")
    farm_state = FarmState(farm_id="farm-nut", zones=[depleted_zone])
    risk_result = RiskResult(
        farm_id="farm-nut",
        overall_risk_level=RiskLevel.HIGH,
        zone_risks=[build_zone_risk(zone_id="z-nut", nutrient_risk=RiskLevel.HIGH, overall=RiskLevel.HIGH)],
    )

    response = suggest_scenarios(farm_state, risk_result=risk_result)

    assert len(response.recommendations) == 1
    rec = response.recommendations[0]
    assert rec.priority == RiskLevel.HIGH
    assert rec.scenario.scenario_type == ScenarioType.FERTILIZER_CHANGE
    assert rec.scenario.duration_days == 30
    assert rec.scenario.changes.fertilizer_multiplier == 0.75
    assert "NUTRIENT_RISK" in rec.triggered_risks


# ----------------------------------------------------------------------
# 6. Multiple HIGH Risks -> Multiple Relevant Recommendations
# ----------------------------------------------------------------------

def test_6_multiple_high_risks():
    """Farm with water stress, heat stress, and disease risk should get distinct stress tests."""
    multi_risk_zone = build_zone(zone_id="z-multi", irrigation="Drip")
    farm_state = FarmState(farm_id="farm-multi", zones=[multi_risk_zone])
    risk_result = RiskResult(
        farm_id="farm-multi",
        overall_risk_level=RiskLevel.HIGH,
        zone_risks=[
            build_zone_risk(
                zone_id="z-multi",
                water_stress=RiskLevel.HIGH,
                heat_stress=RiskLevel.HIGH,
                disease_risk=RiskLevel.HIGH,
                overall=RiskLevel.HIGH,
            )
        ],
    )

    response = suggest_scenarios(farm_state, risk_result=risk_result)

    scenario_types = [r.scenario.scenario_type for r in response.recommendations]
    assert ScenarioType.RAIN_REDUCTION in scenario_types
    assert ScenarioType.HEATWAVE in scenario_types
    assert ScenarioType.DISEASE_OUTBREAK in scenario_types
    # Since irrigation is Drip, irrigation failure should also be candidate
    assert ScenarioType.IRRIGATION_FAILURE in scenario_types
    assert len(response.recommendations) >= 3


# ----------------------------------------------------------------------
# 7. Multiple Zones -> Correct Target Zones Isolation
# ----------------------------------------------------------------------

def test_7_multiple_zones_targeted():
    """Zone 1 has HIGH water stress; Zone 2 is healthy. Recommendation should isolate Zone 1."""
    z1 = build_zone(zone_id="zone-1", name="West Acre")
    z2 = build_zone(zone_id="zone-2", name="East Orchard")
    farm_state = FarmState(farm_id="farm-2zones", zones=[z1, z2])

    risk_result = RiskResult(
        farm_id="farm-2zones",
        overall_risk_level=RiskLevel.HIGH,
        zone_risks=[
            build_zone_risk(zone_id="zone-1", water_stress=RiskLevel.HIGH, overall=RiskLevel.HIGH),
            build_zone_risk(zone_id="zone-2", water_stress=RiskLevel.LOW, overall=RiskLevel.LOW),
        ],
    )

    response = suggest_scenarios(farm_state, risk_result=risk_result)

    assert len(response.recommendations) >= 1
    water_rec = [r for r in response.recommendations if "WATER_STRESS" in r.triggered_risks][0]
    # Crucial: Must target zone-1 only, NOT the whole farm (empty list) and NOT zone-2!
    assert water_rec.target_zones == ["zone-1"]
    assert water_rec.scenario.target_zones == ["zone-1"]
    assert "West Acre" in water_rec.reason or "zone-1" in water_rec.reason


def test_7b_all_zones_high_risk_farm_wide():
    """When all zones suffer same risk, target_zones should be empty [] for farm-wide."""
    z1 = build_zone(zone_id="zone-1")
    z2 = build_zone(zone_id="zone-2")
    farm_state = FarmState(farm_id="farm-all-high", zones=[z1, z2])

    risk_result = RiskResult(
        farm_id="farm-all-high",
        overall_risk_level=RiskLevel.HIGH,
        zone_risks=[
            build_zone_risk(zone_id="zone-1", heat_stress=RiskLevel.HIGH, overall=RiskLevel.HIGH),
            build_zone_risk(zone_id="zone-2", heat_stress=RiskLevel.HIGH, overall=RiskLevel.HIGH),
        ],
    )

    response = suggest_scenarios(farm_state, risk_result=risk_result)
    heat_rec = response.recommendations[0]
    # Empty list signifies entire farm
    assert heat_rec.target_zones == []
    assert heat_rec.scenario.target_zones == []
    assert "the entire farm" in heat_rec.reason


# ----------------------------------------------------------------------
# 8. Deduplication Under Multiple Triggers
# ----------------------------------------------------------------------

def test_8_deduplication():
    """Repeated triggers should not create duplicate scenarios."""
    z1 = build_zone(zone_id="zone-1", irrigation="Drip")
    farm_state = FarmState(farm_id="farm-dedup", zones=[z1])

    risk_result = RiskResult(
        farm_id="farm-dedup",
        overall_risk_level=RiskLevel.HIGH,
        zone_risks=[
            build_zone_risk(zone_id="zone-1", water_stress=RiskLevel.HIGH, overall=RiskLevel.HIGH)
        ],
    )

    response = suggest_scenarios(farm_state, risk_result=risk_result)

    # Ensure no two recommendations have identical (type, duration, changes)
    signatures = [
        (r.scenario.scenario_type, r.scenario.duration_days, r.scenario.changes.rainfall_multiplier)
        for r in response.recommendations
    ]
    assert len(signatures) == len(set(signatures))


# ----------------------------------------------------------------------
# 9. Maximum 5 Recommendations Constraint
# ----------------------------------------------------------------------

def test_9_maximum_5_recommendations():
    """Even with overwhelming multi-stress triggers, output should be capped at max_suggestions (<= 5)."""
    z1 = build_zone(zone_id="zone-1", irrigation="Drip")
    farm_state = FarmState(farm_id="farm-max", zones=[z1])

    risk_result = RiskResult(
        farm_id="farm-max",
        overall_risk_level=RiskLevel.HIGH,
        zone_risks=[
            build_zone_risk(
                zone_id="zone-1",
                water_stress=RiskLevel.HIGH,
                heat_stress=RiskLevel.HIGH,
                disease_risk=RiskLevel.HIGH,
                nutrient_risk=RiskLevel.HIGH,
                overall=RiskLevel.HIGH,
            )
        ],
    )

    response = suggest_scenarios(farm_state, risk_result=risk_result, max_suggestions=3)
    assert len(response.recommendations) <= 3

    response_default = suggest_scenarios(farm_state, risk_result=risk_result)
    assert len(response_default.recommendations) <= 5


# ----------------------------------------------------------------------
# 10. MEDIUM Risks -> Lower-Intensity Scenarios
# ----------------------------------------------------------------------

def test_10_medium_risk_scenarios():
    """MEDIUM risks should trigger moderate perturbations with MEDIUM priority."""
    z_med = build_zone(zone_id="z-med")
    farm_state = FarmState(farm_id="farm-med", zones=[z_med])

    risk_result = RiskResult(
        farm_id="farm-med",
        overall_risk_level=RiskLevel.MEDIUM,
        zone_risks=[
            build_zone_risk(
                zone_id="z-med",
                water_stress=RiskLevel.MEDIUM,
                heat_stress=RiskLevel.MEDIUM,
                disease_risk=RiskLevel.MEDIUM,
                nutrient_risk=RiskLevel.MEDIUM,
                overall=RiskLevel.MEDIUM,
            )
        ],
    )

    response = suggest_scenarios(farm_state, risk_result=risk_result)

    assert len(response.recommendations) > 0
    for rec in response.recommendations:
        assert rec.priority == RiskLevel.MEDIUM

    # Check moderate parameters:
    types_map = {r.scenario.scenario_type: r for r in response.recommendations}
    if ScenarioType.RAIN_REDUCTION in types_map:
        # Moderate rain reduction: 15% (0.85 multiplier) for 14 days
        assert types_map[ScenarioType.RAIN_REDUCTION].scenario.changes.rainfall_multiplier == 0.85
        assert types_map[ScenarioType.RAIN_REDUCTION].scenario.duration_days == 14
    if ScenarioType.TEMPERATURE_INCREASE in types_map:
        # Moderate temp increase: +3°C for 7 days
        assert types_map[ScenarioType.TEMPERATURE_INCREASE].scenario.changes.temperature_delta == 3.0
    if ScenarioType.FERTILIZER_CHANGE in types_map:
        # Moderate fertilizer cut: 15% (0.85 multiplier) for 21 days
        assert types_map[ScenarioType.FERTILIZER_CHANGE].scenario.changes.fertilizer_multiplier == 0.85


# ----------------------------------------------------------------------
# 11. Existing Scenario Schema Validation
# ----------------------------------------------------------------------

def test_11_scenario_schema_conformance():
    """All recommended scenarios must strictly validate against the canonical Scenario contract."""
    z = build_zone(zone_id="z1", irrigation="Drip")
    farm_state = FarmState(farm_id="f1", zones=[z])
    risk_result = RiskResult(
        farm_id="f1",
        overall_risk_level=RiskLevel.HIGH,
        zone_risks=[build_zone_risk(zone_id="z1", water_stress=RiskLevel.HIGH, overall=RiskLevel.HIGH)],
    )

    response = suggest_scenarios(farm_state, risk_result=risk_result)
    for rec in response.recommendations:
        # Pydantic validation roundtrip
        scenario_dict = rec.scenario.model_dump()
        reconstructed = Scenario(**scenario_dict)
        assert reconstructed.scenario_type in [t.value for t in ScenarioType]
        assert reconstructed.duration_days is not None
        assert reconstructed.duration_days >= 1


# ----------------------------------------------------------------------
# 12. API Endpoint Integration (POST /ai/suggest-scenarios)
# ----------------------------------------------------------------------

def test_12_api_endpoint_integration():
    """End-to-end HTTP test with live risk model execution."""
    # A drought farm state sent directly to the API
    payload = {
        "farm_state": {
            "farm_id": "api-farm-test",
            "zones": [
                {
                    "zone_id": "z-arid",
                    "name": "Arid Plot",
                    "area_acres": 30.0,
                    "crop": "Rice",
                    "soil": "Sandy Loam",
                    "growth_stage": "Flowering",
                    "irrigation": "Rainfed",
                    "soil_moisture": 7.0,
                    "temperature": 37.0,
                    "humidity": 30.0,
                    "rainfall": 0.0,
                    "nitrogen": 25.0,
                    "phosphorus": 10.0,
                    "potassium": 90.0,
                }
            ],
        },
        "max_suggestions": 3,
    }

    resp = client.post("/ai/suggest-scenarios", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["farm_id"] == "api-farm-test"
    assert "recommendations" in data
    assert len(data["recommendations"]) >= 1
    assert len(data["recommendations"]) <= 3

    first = data["recommendations"][0]
    assert "recommendation_id" in first
    assert "scenario" in first
    assert "priority" in first
    assert "reason" in first
    assert "triggered_risks" in first
    assert "target_zones" in first
    assert first["scenario"]["duration_days"] >= 1
