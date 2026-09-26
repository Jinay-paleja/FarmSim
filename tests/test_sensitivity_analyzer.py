"""
Unit & Integration Tests for Sensitivity & Tipping-Point Analyzer.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.advanced_analytics import (
    SensitivityAnalysisRequest,
    SensitivityAnalysisResponse,
)
from app.schemas.result import RiskLevel
from app.schemas.scenario import ScenarioType
from app.services.sensitivity_analyzer import analyze_sensitivity

client = TestClient(app)


def test_rain_reduction_sensitivity_sweep():
    """Verify rain reduction sensitivity sweep detects tipping point and non-linear decay."""
    req = SensitivityAnalysisRequest(
        scenario_type=ScenarioType.RAIN_REDUCTION,
        crop="Corn",
        baseline_yield=5000.0,
        current_soil_moisture=20.0,
    )
    resp = analyze_sensitivity(req)

    assert resp.scenario_type == ScenarioType.RAIN_REDUCTION
    assert len(resp.curve) >= 5
    # Yield must decrease as perturbation increases
    yields = [p.projected_yield for p in resp.curve]
    assert all(yields[i] >= yields[i + 1] for i in range(len(yields) - 1))

    # Tipping point must exist within the sweep
    assert resp.tipping_point_value > 0.0
    assert resp.safe_operating_limit <= resp.tipping_point_value
    assert len(resp.tipping_point_insight) > 0


def test_temperature_increase_sensitivity_sweep():
    """Verify temperature increase sensitivity sweep reflects thermal denaturation."""
    req = SensitivityAnalysisRequest(
        scenario_type=ScenarioType.TEMPERATURE_INCREASE,
        crop="Wheat",
        baseline_yield=4000.0,
        current_soil_moisture=25.0,
    )
    resp = analyze_sensitivity(req)

    assert resp.scenario_type == ScenarioType.TEMPERATURE_INCREASE
    # Thermal tipping point should typically be around 3.5C to 5.0C
    assert 2.0 <= resp.tipping_point_value <= 6.0
    assert "thermal" in resp.tipping_point_insight.lower()


def test_sensitivity_api_endpoint():
    """Verify POST /ai/sensitivity-analysis endpoint returns 200 with complete response."""
    payload = {
        "scenario_type": "RAIN_REDUCTION",
        "crop": "Corn",
        "baseline_yield": 4600.0,
        "current_soil_moisture": 22.0,
        "steps": [10.0, 20.0, 30.0, 40.0, 50.0],
    }
    response = client.post("/ai/sensitivity-analysis", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["scenario_type"] == "RAIN_REDUCTION"
    assert len(data["curve"]) == 5
    assert "tipping_point_value" in data
    assert "safe_operating_limit" in data
    assert "actionable_takeaway" in data
