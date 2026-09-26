"""
Unit & Integration Tests for Prescriptive Intervention Optimizer Service and API Endpoint.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.farm import FarmState, Zone
from app.schemas.prescriptive import (
    OptimizationObjective,
    PrescribeInterventionRequest,
    PrescriptiveConstraints,
)
from app.schemas.result import RiskLevel, RiskResult, ZoneRisk
from app.services.prescriptive_optimizer import (
    calculate_agronomic_response,
    prescribe_intervention,
)

client = TestClient(app)


def create_sample_farm() -> FarmState:
    """Helper to instantiate a farm with moisture stress in Zone 1."""
    zone1 = Zone(
        zone_id="zone-1",
        name="Field A",
        area_acres=20.0,
        crop="Corn",
        soil="Clay",
        growth_stage="Flowering",
        irrigation="Drip",
        soil_moisture=12.0,  # Deficit
        temperature=36.0,    # Elevated
        humidity=35.0,
        rainfall=0.0,
        nitrogen=35.0,
        phosphorus=18.0,
        potassium=140.0,
    )
    return FarmState(farm_id="farm-opt-1", zones=[zone1])


def test_agronomic_response_curve():
    """Verify biophysical response surrogate behavior."""
    # Under high water stress, increasing irrigation delivers positive yield impact
    gain, water = calculate_agronomic_response(
        irrigation_mult=1.20,
        fertilizer_mult=1.0,
        water_stress=RiskLevel.HIGH,
        heat_stress=RiskLevel.HIGH,
        nutrient_risk=RiskLevel.LOW,
    )
    assert gain > 0.0
    assert water == 20.0

    # Under deficit irrigation, water decreases and yield declines
    loss, water_cut = calculate_agronomic_response(
        irrigation_mult=0.75,
        fertilizer_mult=1.0,
        water_stress=RiskLevel.HIGH,
        heat_stress=RiskLevel.LOW,
        nutrient_risk=RiskLevel.LOW,
    )
    assert loss < 0.0
    assert water_cut == -25.0


def test_prescriptive_balanced_objective():
    """Verify balanced prescriptive optimization generates 3 distinct tiers."""
    farm = create_sample_farm()
    req = PrescribeInterventionRequest(
        farm_state=farm,
        objective=OptimizationObjective.BALANCED_EFFICIENCY,
        duration_days=30,
    )
    resp = prescribe_intervention(req)

    assert resp.objective == OptimizationObjective.BALANCED_EFFICIENCY
    assert resp.optimal_plan is not None
    assert resp.optimal_plan.tier == "balanced"
    assert resp.primary_recommendation is not None
    assert len(resp.alternative_options) == 0

    # Check that executable Scenario is valid
    scenario = resp.primary_recommendation.scenario
    assert scenario.duration_days == 30
    assert scenario.changes.irrigation_multiplier is not None
    assert len(resp.checklist) > 0


def test_prescriptive_water_saving_objective():
    """Verify MINIMIZE_WATER selects conservative tier as primary recommendation."""
    farm = create_sample_farm()
    req = PrescribeInterventionRequest(
        farm_state=farm,
        objective=OptimizationObjective.MINIMIZE_WATER,
        duration_days=21,
    )
    resp = prescribe_intervention(req)

    assert resp.primary_recommendation.tier == "conservative"
    assert resp.primary_recommendation.projected_water_usage_change_pct < 0.0


def test_prescribe_api_endpoint():
    """Verify POST /ai/prescribe-intervention responds with 200 and complete schema."""
    payload = {
        "farm_state": {
            "farm_id": "farm-api-prescribe",
            "zones": [
                {
                    "zone_id": "z-east",
                    "name": "East Field",
                    "area_acres": 15.0,
                    "crop": "Wheat",
                    "soil": "Loam",
                    "growth_stage": "Vegetative",
                    "irrigation": "Sprinkler",
                    "soil_moisture": 18.0,
                    "temperature": 26.0,
                    "humidity": 50.0,
                    "rainfall": 2.0,
                    "nitrogen": 45.0,
                    "phosphorus": 22.0,
                    "potassium": 160.0,
                }
            ],
        },
        "objective": "MAXIMIZE_YIELD",
        "duration_days": 45,
    }
    response = client.post("/ai/prescribe-intervention", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["objective"] == "MAXIMIZE_YIELD"
    assert "optimal_plan" in data
    assert "primary_recommendation" in data
    assert len(data["alternative_options"]) == 0
    assert "agronomic_rationale" in data
    assert "checklist" in data
