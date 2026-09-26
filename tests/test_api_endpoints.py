from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

SAMPLE_ZONE = {
    "zone_id": "zone-1",
    "name": "North Field",
    "area_acres": 20.0,
    "crop": "Corn",
    "soil": "Loam",
    "growth_stage": "Flowering",
    "irrigation": "Drip",
    "soil_moisture": 30.0,
    "temperature": 26.5,
    "humidity": 60.0,
    "rainfall": 5.0,
    "nitrogen": 40.0,
    "phosphorus": 20.0,
    "potassium": 150.0,
}

SAMPLE_FARM_STATE = {
    "farm_id": "farm-1",
    "zones": [SAMPLE_ZONE],
}


def test_parse_scenario_success():
    """Valid request to /ai/parse-scenario should return HTTP 200 with intent classification."""
    response = client.post(
        "/ai/parse-scenario",
        json={"query": "What if rainfall decreases by 30% for 45 days?"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["scenario_type"] == "RAIN_REDUCTION"
    assert data["confidence"] >= 0.60
    assert data["needs_clarification"] is False
    assert data["scenario"] is not None
    assert data["scenario"]["duration_days"] == 45
    assert data["scenario"]["changes"]["rainfall_multiplier"] == 0.70


def test_parse_scenario_missing_field_validation_error():
    """Invalid payload (missing required 'query' field) should return HTTP 422 Unprocessable Entity."""
    response = client.post(
        "/ai/parse-scenario",
        json={"farm_id": "farm-1"},  # missing 'query'
    )
    assert response.status_code == 422


def test_analyze_risk_endpoint_success():
    """Valid request to /ai/analyze-risk should return HTTP 200 with RiskResult analysis."""
    response = client.post(
        "/ai/analyze-risk",
        json={"farm_state": SAMPLE_FARM_STATE},
    )
    assert response.status_code == 200
    data = response.json()
    assert "overall_risk" in data or "overall_risk_level" in data
    assert "zones" in data or "zone_risks" in data
    assert len(data["zone_risks"]) == 1
    zone = data["zone_risks"][0]
    assert zone["zone_id"] == "zone-1"
    assert "water_stress" in zone
    assert "heat_stress" in zone
    assert "disease_risk" in zone
    assert "nutrient_risk" in zone
    assert "primary_threat" in zone


def test_analyze_risk_flexible_payload():
    """Valid flat payload without 'farm_state' wrapper should also succeed."""
    response = client.post(
        "/ai/analyze-risk",
        json={"farm_id": "farm-1", "zones": [SAMPLE_ZONE]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["farm_id"] == "farm-1"
    assert len(data["zone_risks"]) == 1


def test_suggest_scenarios_endpoint_success():
    """Valid request to /ai/suggest-scenarios should return HTTP 200 with SuggestScenariosResponse."""
    response = client.post(
        "/ai/suggest-scenarios",
        json={"farm_state": SAMPLE_FARM_STATE, "max_suggestions": 3},
    )
    assert response.status_code == 200
    data = response.json()
    assert "farm_id" in data
    assert "recommendations" in data
    assert isinstance(data["recommendations"], list)


def test_explain_result_success():
    """Valid request to /ai/explain-result should return HTTP 200 with SimulationExplanation."""
    response = client.post(
        "/ai/explain-result",
        json={
            "simulation_id": "sim-run-001",
            "simulation_output": {
                "final_yield_kg_ha": 7200,
                "water_stress_index": 0.42,
            },
            "audience": "farmer",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["simulation_id"] == "sim-run-001"
    assert "summary" in data
    assert isinstance(data["key_observations"], list)
    assert isinstance(data["farmer_recommendations"], list)


def test_analyze_simulation_endpoint_success():
    """Valid request to /ai/analyze-simulation should return HTTP 200 with SimulationAnalysis."""
    sim_result = {
        "scenario_id": "sim-test-01",
        "farm_id": "farm-1",
        "duration_days": 30,
        "baseline": {
            "expected_yield": 4500.0,
            "final_soil_moisture": 32.0,
            "final_crop_health": 85.0,
            "final_disease_risk": 15.0,
            "water_usage": 350.0,
        },
        "scenario": {
            "expected_yield": 3800.0,
            "final_soil_moisture": 22.0,
            "final_crop_health": 65.0,
            "final_disease_risk": 18.0,
            "water_usage": 250.0,
        },
    }
    response = client.post(
        "/ai/analyze-simulation",
        json={"simulation_result": sim_result},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["scenario_id"] == "sim-test-01"
    assert data["impact_level"] in ["LOW", "MEDIUM", "HIGH"]
    assert "summary" in data
    assert len(data["metrics"]) >= 5
    assert len(data["negative_impacts"]) >= 1


def test_compare_simulations_endpoint_success():
    """Valid request to /ai/compare-simulations should return HTTP 200 with CompareSimulationsResponse."""
    sim_1 = {
        "scenario_id": "sim-drought-01",
        "farm_id": "farm-1",
        "scenario_name": "Rain Reduction -30%",
        "baseline": {
            "expected_yield": 4500.0,
            "final_soil_moisture": 32.0,
            "final_crop_health": 85.0,
        },
        "scenario": {
            "expected_yield": 3800.0,
            "final_soil_moisture": 20.0,
            "final_crop_health": 68.0,
        },
    }
    sim_2 = {
        "scenario_id": "sim-irrigation-01",
        "farm_id": "farm-1",
        "scenario_name": "Irrigation +25%",
        "baseline": {
            "expected_yield": 4500.0,
            "final_soil_moisture": 32.0,
            "final_crop_health": 85.0,
        },
        "scenario": {
            "expected_yield": 4700.0,
            "final_soil_moisture": 36.0,
            "final_crop_health": 90.0,
        },
    }
    response = client.post(
        "/ai/compare-simulations",
        json={"simulations": [sim_1, sim_2]},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["comparisons"]) == 2
    assert "explanation" in data

