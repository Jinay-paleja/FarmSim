"""
Unit & Integration Tests for Farm Risk Classifier and Risk Analyzer Service.

Validates:
- Target 1: Water stress detection in severe drought/dry conditions.
- Target 2: Heat stress detection under high ambient thermal excess.
- Target 3: Elevated disease risk under warm, humid, wet microclimates.
- Target 4: Nutrient risk detection under severely depleted N-P-K.
- Target 5: Low risk profile under balanced optimal growing conditions.
- Multi-zone farm assessment and aggregation rules.
- Graceful handling of unknown crops/soils (OneHotEncoder resilience).
- Model artifact and feature importance validation.
- API endpoints and request validation.
"""

import json
import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.farm import FarmState, Zone
from app.schemas.result import RiskLevel, RiskResult
from app.services.risk_analyzer import (
    analyze_risk,
    get_risk_model,
    aggregate_farm_risk_level,
    aggregate_zone_risk_level,
)

client = TestClient(app)


def create_zone(
    zone_id: str = "zone-1",
    name: str = "Test Field",
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
    """Helper to instantiate a valid Zone schema."""
    return Zone(
        zone_id=zone_id,
        name=name,
        area_acres=15.0,
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


# ----------------------------------------------------------------------
# 1. OBVIOUS RISK TESTS (Domain Validation)
# ----------------------------------------------------------------------

def test_water_stress_detection():
    """Very low soil moisture + 0 rainfall + Rainfed -> should predict HIGH water stress."""
    dry_zone = create_zone(
        crop="Rice",  # High water demand crop
        soil_moisture=6.5,  # Critically low moisture
        rainfall=0.0,
        irrigation="Rainfed",
        growth_stage="Flowering",
    )
    farm_state = FarmState(farm_id="farm-dry", zones=[dry_zone])
    result = analyze_risk(farm_state)

    assert len(result.zone_risks) == 1
    z_risk = result.zone_risks[0]
    # Water stress must be elevated
    assert z_risk.water_stress in [RiskLevel.HIGH, RiskLevel.MEDIUM]
    assert z_risk.water_stress == RiskLevel.HIGH
    assert "moisture" in z_risk.primary_threat.lower() or "water" in z_risk.primary_threat.lower()
    assert any("moisture" in factor.lower() for factor in z_risk.contributing_factors)


def test_heat_stress_detection():
    """Very high temperature above crop tolerance -> should predict HIGH heat stress."""
    hot_zone = create_zone(
        crop="Wheat",  # Sensitive cool-season crop (optimal <= 24°C)
        temperature=42.0,  # Extreme heatwave
        soil_moisture=18.0,
        growth_stage="Flowering",
    )
    farm_state = FarmState(farm_id="farm-hot", zones=[hot_zone])
    result = analyze_risk(farm_state)

    assert len(result.zone_risks) == 1
    z_risk = result.zone_risks[0]
    assert z_risk.heat_stress in [RiskLevel.HIGH, RiskLevel.MEDIUM]
    assert z_risk.heat_stress == RiskLevel.HIGH
    assert "heat" in z_risk.primary_threat.lower()
    assert any("thermal" in f.lower() or "temperature" in f.lower() for f in z_risk.contributing_factors)


def test_disease_risk_detection():
    """High humidity + warm temperature + high moisture/rainfall -> elevated disease risk."""
    wet_zone = create_zone(
        crop="Potato",
        humidity=92.0,
        temperature=24.0,  # Favorable fungal incubation temp
        rainfall=35.0,
        irrigation="Sprinkler",  # Overhead wetting
        soil_moisture=34.0,
        growth_stage="Flowering",
    )
    farm_state = FarmState(farm_id="farm-disease", zones=[wet_zone])
    result = analyze_risk(farm_state)

    assert len(result.zone_risks) == 1
    z_risk = result.zone_risks[0]
    assert z_risk.disease_risk in [RiskLevel.HIGH, RiskLevel.MEDIUM]
    assert z_risk.disease_risk == RiskLevel.HIGH
    assert any("humidity" in f.lower() or "fungal" in f.lower() or "wetness" in f.lower() for f in z_risk.contributing_factors)


def test_nutrient_risk_detection():
    """Critically depleted N/P/K -> should predict HIGH nutrient risk."""
    depleted_zone = create_zone(
        crop="Maize",  # Heavy feeder
        nitrogen=5.0,   # Critically low (nominal 45+)
        phosphorus=3.0, # Critically low (nominal 20+)
        potassium=35.0, # Critically low (nominal 150+)
        growth_stage="Vegetative",
    )
    farm_state = FarmState(farm_id="farm-nutrient", zones=[depleted_zone])
    result = analyze_risk(farm_state)

    assert len(result.zone_risks) == 1
    z_risk = result.zone_risks[0]
    assert z_risk.nutrient_risk in [RiskLevel.HIGH, RiskLevel.MEDIUM]
    assert z_risk.nutrient_risk == RiskLevel.HIGH
    assert "nutrient" in z_risk.primary_threat.lower()
    assert any("nitrogen" in f.lower() or "phosphorus" in f.lower() for f in z_risk.contributing_factors)


def test_healthy_balanced_conditions():
    """Optimal conditions -> mostly LOW risk."""
    healthy_zone = create_zone(
        crop="Soybean",
        soil_moisture=26.0,
        temperature=25.0,
        humidity=55.0,
        rainfall=5.0,
        nitrogen=45.0,
        phosphorus=22.0,
        potassium=160.0,
        irrigation="Drip",
        growth_stage="Vegetative",
    )
    farm_state = FarmState(farm_id="farm-healthy", zones=[healthy_zone])
    result = analyze_risk(farm_state)

    assert len(result.zone_risks) == 1
    z_risk = result.zone_risks[0]
    # No high risks should be present in optimal conditions
    assert z_risk.water_stress == RiskLevel.LOW
    assert z_risk.heat_stress == RiskLevel.LOW
    assert z_risk.disease_risk == RiskLevel.LOW
    assert z_risk.nutrient_risk == RiskLevel.LOW
    assert result.overall_risk_level in [RiskLevel.LOW, RiskLevel.MEDIUM]


# ----------------------------------------------------------------------
# 2. MULTI-ZONE & AGGREGATION TESTS
# ----------------------------------------------------------------------

def test_multi_zone_aggregation():
    """Farm with a drought zone, a disease zone, and a healthy zone -> farm overall risk is HIGH."""
    zone_drought = create_zone(
        zone_id="zone-drought",
        name="Drought Plot",
        crop="Rice",
        soil_moisture=7.0,
        rainfall=0.0,
        irrigation="Rainfed",
    )
    zone_healthy = create_zone(
        zone_id="zone-healthy",
        name="Optimal Plot",
        crop="Soybean",
        soil_moisture=26.0,
        temperature=25.0,
        humidity=55.0,
    )
    zone_disease = create_zone(
        zone_id="zone-disease",
        name="Fungal Plot",
        crop="Potato",
        humidity=92.0,
        temperature=24.0,
        rainfall=30.0,
    )

    farm_state = FarmState(
        farm_id="multi-zone-farm",
        zones=[zone_drought, zone_healthy, zone_disease],
    )
    result = analyze_risk(farm_state)

    assert len(result.zone_risks) == 3
    assert result.overall_risk_level == RiskLevel.HIGH
    assert len(result.suggested_mitigations) >= 2
    # Check that mitigations cover both water and disease
    mitigation_text = " ".join(result.suggested_mitigations).lower()
    assert "irrigation" in mitigation_text
    assert "fungicide" in mitigation_text or "preventive" in mitigation_text


def test_aggregation_helper_functions():
    """Verify aggregation logic for single zone and farm."""
    # Zone aggregation
    assert aggregate_zone_risk_level({"water": "HIGH", "heat": "HIGH", "disease": "LOW", "nutrient": "LOW"}) == RiskLevel.HIGH
    assert aggregate_zone_risk_level({"water": "HIGH", "heat": "LOW", "disease": "LOW", "nutrient": "LOW"}) == RiskLevel.HIGH
    assert aggregate_zone_risk_level({"water": "MEDIUM", "heat": "LOW", "disease": "LOW", "nutrient": "LOW"}) == RiskLevel.MEDIUM
    assert aggregate_zone_risk_level({"water": "LOW", "heat": "LOW", "disease": "LOW", "nutrient": "LOW"}) == RiskLevel.LOW

    # Farm aggregation
    zr_high = create_zone(zone_id="z1")
    farm_state = FarmState(farm_id="f1", zones=[zr_high])
    res = analyze_risk(farm_state)
    # Ensure aggregate_farm_risk_level returns RiskLevel
    assert isinstance(aggregate_farm_risk_level(res.zone_risks), RiskLevel)


# ----------------------------------------------------------------------
# 3. ROBUSTNESS & UNSEEN CATEGORY TESTS
# ----------------------------------------------------------------------

def test_unseen_crop_and_soil_resilience():
    """Ensure OneHotEncoder with handle_unknown='ignore' handles novel crops/soils cleanly."""
    novel_zone = create_zone(
        crop="Dragonfruit",  # Novel crop
        soil="Volcanic Ash", # Novel soil
        growth_stage="Flowering",
        irrigation="Mist",
    )
    farm_state = FarmState(farm_id="farm-novel", zones=[novel_zone])
    result = analyze_risk(farm_state)

    assert len(result.zone_risks) == 1
    assert result.zone_risks[0].zone_id == "zone-1"
    assert result.zone_risks[0].water_stress in [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH]


# ----------------------------------------------------------------------
# 4. ARTIFACT & MODEL CHECKS
# ----------------------------------------------------------------------

def test_feature_importance_file_exists():
    """Verify that data/risk_feature_importance.json exists and is structured properly."""
    path = os.path.join("data", "risk_feature_importance.json")
    assert os.path.exists(path)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    for target in ["water_stress", "heat_stress", "disease_risk", "nutrient_risk"]:
        assert target in data
        assert "top_encoded_features" in data[target]
        assert "raw_feature_importance" in data[target]
        assert len(data[target]["top_encoded_features"]) > 0


def test_model_artifact_pipeline():
    """Verify that app/models/farm_risk_model.joblib is loaded and has 4 target estimators."""
    model = get_risk_model()
    assert "preprocessor" in model.named_steps
    assert "classifier" in model.named_steps
    classifier = model.named_steps["classifier"]
    assert len(classifier.estimators_) == 4


# ----------------------------------------------------------------------
# 5. API ENDPOINT INTEGRATION TESTS
# ----------------------------------------------------------------------

def test_api_analyze_risk_payloads():
    """Verify API accepts both wrapped farm_state and flat root payloads."""
    zone_dict = {
        "zone_id": "zone-api-1",
        "name": "South Plot",
        "area_acres": 25.0,
        "crop": "Corn",
        "soil": "Clay Loam",
        "growth_stage": "Grain Filling",
        "irrigation": "Drip",
        "soil_moisture": 25.0,
        "temperature": 27.0,
        "humidity": 60.0,
        "rainfall": 2.0,
        "nitrogen": 45.0,
        "phosphorus": 20.0,
        "potassium": 150.0,
    }

    # Format 1: standard wrapped payload
    resp1 = client.post(
        "/ai/analyze-risk",
        json={"farm_state": {"farm_id": "farm-api", "zones": [zone_dict]}},
    )
    assert resp1.status_code == 200
    d1 = resp1.json()
    assert d1["farm_id"] == "farm-api"
    assert "overall_risk" in d1
    assert "zones" in d1

    # Format 2: flat payload
    resp2 = client.post(
        "/ai/analyze-risk",
        json={"farm_id": "farm-flat", "zones": [zone_dict]},
    )
    assert resp2.status_code == 200
    d2 = resp2.json()
    assert d2["farm_id"] == "farm-flat"
    assert len(d2["zones"]) == 1


def test_api_analyze_risk_validation_error():
    """Invalid payload (e.g. negative area_acres) returns 422 Unprocessable Entity."""
    bad_zone = {
        "zone_id": "bad-zone",
        "name": "Bad Zone",
        "area_acres": -10.0,  # Invalid
        "crop": "Corn",
        "soil": "Clay",
        "growth_stage": "Vegetative",
        "irrigation": "Rainfed",
        "soil_moisture": 20.0,
        "temperature": 25.0,
        "humidity": 50.0,
        "rainfall": 0.0,
        "nitrogen": 20.0,
        "phosphorus": 10.0,
        "potassium": 100.0,
    }
    resp = client.post(
        "/ai/analyze-risk",
        json={"farm_id": "farm-bad", "zones": [bad_zone]},
    )
    assert resp.status_code == 422
