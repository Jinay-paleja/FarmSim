"""
Unit & Integration Tests for Temporal Risk Fusion Service and Endpoint.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.advanced_analytics import TemporalRiskRequest
from app.schemas.farm import FarmState, Zone
from app.schemas.prescriptive import DailyTelemetry
from app.schemas.result import RiskLevel
from app.services.temporal_risk_fusion import fuse_temporal_risk

client = TestClient(app)


def build_test_farm() -> FarmState:
    """Helper to instantiate a farm zone with moderate moisture."""
    zone = Zone(
        zone_id="zone-temporal-1",
        name="Valley Plot",
        area_acres=25.0,
        crop="Corn",
        soil="Loam",
        growth_stage="Flowering",
        irrigation="Rainfed",
        soil_moisture=22.0,  # Snapshot is moderately acceptable
        temperature=32.0,
        humidity=45.0,
        rainfall=0.0,
        nitrogen=50.0,
        phosphorus=25.0,
        potassium=180.0,
    )
    return FarmState(farm_id="farm-temp-1", zones=[zone])


def build_severe_drought_history(days: int = 12) -> list:
    """Simulate 12 rainless days with rapid soil moisture depletion."""
    history = []
    moisture = 32.0
    for day in range(1, days + 1):
        moisture -= 1.0  # -1.0% per day
        history.append(
            DailyTelemetry(
                day_index=day,
                temperature_max=36.0 if day >= 6 else 30.0,
                temperature_min=20.0,
                soil_moisture=round(moisture, 1),
                rainfall=0.0,  # 0 rain for 12 days
                humidity=35.0,
            )
        )
    return history


def test_temporal_risk_escalation():
    """Verify that severe prolonged drought escalates water stress beyond snapshot ML."""
    farm = build_test_farm()
    history = build_severe_drought_history(12)

    req = TemporalRiskRequest(
        farm_state=farm,
        history=history,
        crop="Corn",
        model_type="xgboost",
    )
    resp = fuse_temporal_risk(req)

    assert resp.overall_risk_level in [RiskLevel.HIGH, RiskLevel.MEDIUM]
    assert len(resp.adjustments_applied) > 0
    # Water stress must be escalated
    fused_z = resp.fused_zone_risks[0]
    assert fused_z.temporal_escalated is True
    assert fused_z.water_stress in [RiskLevel.HIGH, RiskLevel.MEDIUM]
    assert len(fused_z.temporal_notes) > 0


def test_temporal_risk_nominal():
    """Verify that healthy rainfall history does not trigger false escalations."""
    farm = build_test_farm()
    history = [
        DailyTelemetry(
            day_index=i,
            temperature_max=24.0,
            temperature_min=16.0,
            soil_moisture=28.0,
            rainfall=6.0 if i % 2 == 0 else 0.5,
            humidity=60.0,
        )
        for i in range(1, 8)
    ]
    req = TemporalRiskRequest(
        farm_state=farm,
        history=history,
        crop="Wheat",
        model_type="xgboost",
    )
    resp = fuse_temporal_risk(req)
    assert len(resp.adjustments_applied) == 0


def test_temporal_risk_api_endpoint():
    """Verify POST /ai/analyze-temporal-risk endpoint responds with complete fused structure."""
    payload = {
        "farm_state": {
            "farm_id": "farm-fusion-api",
            "zones": [
                {
                    "zone_id": "z-1",
                    "name": "North Field",
                    "area_acres": 10.0,
                    "crop": "Corn",
                    "soil": "Clay",
                    "growth_stage": "Flowering",
                    "irrigation": "Drip",
                    "soil_moisture": 20.0,
                    "temperature": 34.0,
                    "humidity": 40.0,
                    "rainfall": 0.0,
                    "nitrogen": 40.0,
                    "phosphorus": 20.0,
                    "potassium": 150.0,
                }
            ],
        },
        "history": [
            {
                "day_index": i,
                "temperature_max": 33.0,
                "temperature_min": 20.0,
                "soil_moisture": 26.0 - (i * 0.9),
                "rainfall": 0.0,
                "humidity": 38.0,
            }
            for i in range(1, 8)
        ],
        "crop": "Corn",
        "model_type": "xgboost",
    }
    response = client.post("/ai/analyze-temporal-risk", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "time_series_features" in data
    assert "fused_zone_risks" in data
    assert "fusion_summary" in data
