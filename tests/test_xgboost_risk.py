"""
Unit & Integration Tests for XGBoost Farm Risk Classifier Pipeline.
"""

import json
import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.farm import FarmState, Zone
from app.schemas.result import RiskLevel, RiskResult
from app.services.risk_analyzer import analyze_risk, get_risk_model

client = TestClient(app)


def test_xgboost_model_artifact_loaded():
    """Verify that the XGBoost model pipeline loads cleanly."""
    model = get_risk_model(model_type="xgboost")
    assert model is not None
    assert "preprocessor" in model.named_steps
    assert "classifier" in model.named_steps
    assert len(model.named_steps["classifier"].estimators_) == 4


def test_xgboost_feature_importance_file_valid():
    """Verify that XGBoost feature importance file is saved and well-structured."""
    filepath = os.path.join("data", "risk_xgboost_feature_importance.json")
    assert os.path.exists(filepath), f"File {filepath} should exist."
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    for target in ["water_stress", "heat_stress", "disease_risk", "nutrient_risk"]:
        assert target in data
        assert "raw_feature_importance" in data[target]
        assert len(data[target]["raw_feature_importance"]) > 0


def test_xgboost_water_stress_prediction():
    """Verify XGBoost predicts high water stress during severe moisture deficit."""
    zone = Zone(
        zone_id="zone-drought",
        name="Drought Zone",
        area_acres=12.5,
        crop="Wheat",
        soil="Sandy",
        growth_stage="Vegetative",
        irrigation="Rainfed",
        soil_moisture=8.0,
        temperature=36.0,
        humidity=30.0,
        rainfall=0.0,
        nitrogen=35.0,
        phosphorus=20.0,
        potassium=150.0,
    )
    farm_state = FarmState(farm_id="farm-xgb-1", zones=[zone])
    result = analyze_risk(farm_state, model_type="xgboost")

    assert result.overall_risk_level in [RiskLevel.HIGH, RiskLevel.MEDIUM]
    z_risk = result.zone_risks[0]
    assert z_risk.water_stress == RiskLevel.HIGH


def test_xgboost_api_endpoint():
    """Verify /ai/analyze-risk with model_type='xgboost'."""
    payload = {
        "farm_state": {
            "farm_id": "farm-xgb-api",
            "zones": [
                {
                    "zone_id": "zone-1",
                    "name": "Zone 1",
                    "area_acres": 15.0,
                    "crop": "Corn",
                    "soil": "Clay",
                    "growth_stage": "Flowering",
                    "irrigation": "Drip",
                    "soil_moisture": 25.0,
                    "temperature": 24.0,
                    "humidity": 50.0,
                    "rainfall": 5.0,
                    "nitrogen": 60.0,
                    "phosphorus": 30.0,
                    "potassium": 200.0,
                }
            ],
        },
        "model_type": "xgboost",
    }
    response = client.post("/ai/analyze-risk", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["farm_id"] == "farm-xgb-api"
    assert len(data["zone_risks"]) == 1
