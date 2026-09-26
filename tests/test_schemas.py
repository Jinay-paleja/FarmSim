import pytest
from pydantic import ValidationError
from app.schemas.scenario import Scenario, ScenarioType, ScenarioChanges
from app.schemas.farm import Farm, Zone, FarmState
from app.schemas.result import (
    RiskLevel,
    ZoneRisk,
    RiskResult,
    ScenarioSuggestion,
    SimulationExplanation,
)


def test_scenario_valid_data():
    """Verify Scenario schema validates with proper fields and changes."""
    data = {
        "scenario_type": "HEATWAVE",
        "name": "July Heatwave Simulation",
        "duration_days": 10,
        "target_zones": ["zone_1", "zone_2"],
        "changes": {
            "temperature_delta": 4.5,
            "rainfall_multiplier": 0.3,
            "soil_moisture_delta": -10.0,
            "custom_wind_factor": 1.2,  # flexible custom parameter
        },
    }
    scenario = Scenario(**data)
    assert scenario.scenario_type == ScenarioType.HEATWAVE
    assert scenario.name == "July Heatwave Simulation"
    assert scenario.duration_days == 10
    assert scenario.target_zones == ["zone_1", "zone_2"]
    assert scenario.changes.temperature_delta == 4.5
    assert scenario.changes.rainfall_multiplier == 0.3
    # Extra field allowed
    assert getattr(scenario.changes, "custom_wind_factor") == 1.2


def test_all_scenario_types_supported():
    """Verify that all 13 required scenario types are valid."""
    expected_types = [
        "RAIN_REDUCTION",
        "RAIN_INCREASE",
        "TEMPERATURE_INCREASE",
        "HEATWAVE",
        "IRRIGATION_INCREASE",
        "IRRIGATION_DECREASE",
        "IRRIGATION_FAILURE",
        "FERTILIZER_CHANGE",
        "NUTRIENT_DEFICIENCY",
        "DISEASE_OUTBREAK",
        "PEST_OUTBREAK",
        "SOIL_MOISTURE_CHANGE",
        "COMBINED",
    ]
    for stype in expected_types:
        scenario = Scenario(
            scenario_type=stype,
            name=f"Test {stype}",
            duration_days=5,
            changes=ScenarioChanges(),
        )
        assert scenario.scenario_type == stype


def test_scenario_invalid_type_rejected():
    """Verify that an unsupported scenario type raises a ValidationError."""
    with pytest.raises(ValidationError):
        Scenario(
            scenario_type="ALIEN_INVASION",
            name="Invalid Scenario",
            duration_days=5,
            changes=ScenarioChanges(),
        )


def test_scenario_invalid_duration_rejected():
    """Verify that duration_days < 1 is rejected."""
    with pytest.raises(ValidationError):
        Scenario(
            scenario_type=ScenarioType.RAIN_REDUCTION,
            name="Zero Duration",
            duration_days=0,
            changes=ScenarioChanges(),
        )


def test_zone_and_farm_state_valid():
    """Verify Zone and FarmState schemas accept complete valid data."""
    zone = Zone(
        zone_id="zone-east-1",
        name="East Orchard",
        area_acres=15.0,
        crop="Apple",
        soil="Sandy Loam",
        growth_stage="Fruit Development",
        irrigation="Drip",
        soil_moisture=22.5,
        temperature=28.0,
        humidity=55.0,
        rainfall=0.0,
        nitrogen=35.0,
        phosphorus=18.0,
        potassium=140.0,
    )
    assert zone.zone_id == "zone-east-1"
    assert zone.area_acres == 15.0

    farm_state = FarmState(
        farm_id="farm-101",
        zones=[zone],
    )
    assert farm_state.farm_id == "farm-101"
    assert len(farm_state.zones) == 1

    farm = Farm(
        farm_id="farm-101",
        name="Sunny Valley Farm",
        location="County A",
        total_acres=15.0,
        zones=[zone],
    )
    assert farm.name == "Sunny Valley Farm"


def test_zone_invalid_area_rejected():
    """Verify that zone area <= 0 is rejected."""
    with pytest.raises(ValidationError):
        Zone(
            zone_id="z1",
            name="Invalid Zone",
            area_acres=-5.0,  # Invalid
            crop="Corn",
            soil="Clay",
            growth_stage="Vegetative",
            irrigation="Rainfed",
            soil_moisture=20.0,
            temperature=25.0,
            humidity=50.0,
            rainfall=0.0,
            nitrogen=20.0,
            phosphorus=10.0,
            potassium=100.0,
        )


def test_result_schemas():
    """Verify RiskResult, ScenarioSuggestion, and SimulationExplanation schemas."""
    # 1. RiskResult
    risk = RiskResult(
        farm_id="farm-101",
        overall_risk_level=RiskLevel.HIGH,
        zone_risks=[
            ZoneRisk(
                zone_id="zone-1",
                risk_level=RiskLevel.HIGH,
                primary_threat="Soil Moisture Deficit",
                score=0.85,
                contributing_factors=["No rainfall in 14 days", "High heat"],
            )
        ],
        critical_factors=["Severe drought risk"],
        suggested_mitigations=["Initiate supplementary drip irrigation"],
    )
    assert risk.overall_risk_level == RiskLevel.HIGH

    # 2. ScenarioSuggestion
    scenario = Scenario(
        scenario_type=ScenarioType.IRRIGATION_FAILURE,
        name="Pump Breakdown Stress Test",
        duration_days=5,
        changes=ScenarioChanges(irrigation_multiplier=0.0),
    )
    suggestion = ScenarioSuggestion(
        suggestion_id="sug-001",
        title="Test irrigation pump failure resilience",
        rationale="Flowering stage is highly sensitive to water interruptions",
        urgency=RiskLevel.HIGH,
        scenario=scenario,
    )
    assert suggestion.suggestion_id == "sug-001"
    assert suggestion.scenario.scenario_type == "IRRIGATION_FAILURE"

    # 3. SimulationExplanation
    explanation = SimulationExplanation(
        simulation_id="sim-999",
        summary="A 5-day heatwave caused a 15% estimated reduction in biomass.",
        projected_yield_impact="-15% yield loss",
        key_observations=["Canopy temperature exceeded threshold for 4 consecutive days."],
        farmer_recommendations=["Schedule night irrigation to lower canopy heat stress."],
    )
    assert explanation.simulation_id == "sim-999"
