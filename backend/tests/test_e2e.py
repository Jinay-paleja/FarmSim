"""End-to-end API test: no frontend and no remote AI key required."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.repository import SQLiteRepository


def test_farmer_workflow_end_to_end(tmp_path):
    repository = SQLiteRepository(f"sqlite:///{tmp_path / 'farmsim-test.db'}")
    app = create_app(repository=repository, configured_settings=Settings(database_url="sqlite:///unused.db"))
    client = TestClient(app)

    farm_response = client.post(
        "/farms",
        json={"name": "Integration Farm", "location": "Mumbai", "area_acres": 10, "number_of_zones": 2},
    )
    assert farm_response.status_code == 201, farm_response.text
    farm_id = farm_response.json()["farm_id"]

    zone_template = {
        "soil": "Black",
        "growth_stage": "Flowering",
        "irrigation": "Drip",
        "soil_moisture": 55,
        "temperature": 28,
        "humidity": 70,
        "rainfall": 90,
        "nitrogen": 70,
        "phosphorus": 60,
        "potassium": 65,
    }
    tomato = client.post("/farms/%s/zones" % farm_id, json={**zone_template, "name": "North", "area_acres": 4, "crop": "Tomato"})
    wheat = client.post("/farms/%s/zones" % farm_id, json={**zone_template, "name": "South", "area_acres": 6, "crop": "Wheat"})
    assert tomato.status_code == 201, tomato.text
    assert wheat.status_code == 201, wheat.text

    complete_farm = client.get(f"/farms/{farm_id}")
    assert complete_farm.status_code == 200
    assert len(complete_farm.json()["zones"]) == 2

    risk = client.post("/ai/analyze-risk", json={"farm_id": farm_id})
    assert risk.status_code == 200, risk.text
    assert risk.json()["model_version"] == "bootstrap-rf-v1"
    assert len(risk.json()["zone_risks"]) == 2

    suggestions = client.post("/ai/suggest-scenarios", json={"farm_id": farm_id, "risk_assessment": risk.json()})
    assert suggestions.status_code == 200, suggestions.text
    assert suggestions.json()["suggestions"]

    parsed = client.post(
        "/ai/parse-scenario",
        json={"farm_id": farm_id, "text": "What if rainfall decreases by 30% over the next 30 days?"},
    )
    assert parsed.status_code == 200, parsed.text
    assert parsed.json()["scenario_type"] == "RAIN_REDUCTION"
    assert parsed.json()["changes"]["rainfall_multiplier"] == 0.7

    scenario = client.post(
        "/scenarios",
        json={
            "farm_id": farm_id,
            "name": "Reduced Rainfall",
            "duration_days": 30,
            "target_zones": [tomato.json()["zone_id"], wheat.json()["zone_id"]],
            "changes": {"rainfall_multiplier": 0.7},
        },
    )
    assert scenario.status_code == 201, scenario.text
    scenario_id = scenario.json()["scenario_id"]

    baseline = client.post("/simulate", json={"farm_id": farm_id})
    simulated = client.post("/simulate", json={"farm_id": farm_id, "scenario_id": scenario_id})
    assert baseline.status_code == 201, baseline.text
    assert simulated.status_code == 201, simulated.text
    simulation_id = simulated.json()["simulation_id"]
    assert len(simulated.json()["timeline"]) == 30
    assert len(simulated.json()["baseline_timeline"]) == 30
    assert simulated.json()["baseline_summary"]

    stored = client.get(f"/simulation/{simulation_id}")
    assert stored.status_code == 200
    assert stored.json()["summary"]["total_expected_yield"] > 0

    explanation = client.post("/ai/explain-result", json={"simulation_id": simulation_id})
    assert explanation.status_code == 200
    assert explanation.json()["summary"]
    assert explanation.json()["yield_impact"]["direction"] in {"INCREASED", "DECREASED", "UNCHANGED"}

    raw_explanation = client.post(
        "/ai/explain-result",
        json={
            "scenario_type": "RAIN_REDUCTION",
            "duration_days": 45,
            "baseline_metrics": {"yield_tons_per_ha": 10.5, "water_usage_liters": 50000, "soil_health_index": 85},
            "projected_metrics": {"yield_tons_per_ha": 8.2, "water_usage_liters": 30000, "soil_health_index": 78},
        },
    )
    assert raw_explanation.status_code == 200, raw_explanation.text
    assert raw_explanation.json()["yield_impact"]["impact_level"] == "SEVERE"

    comparison = client.post(
        "/compare",
        json={"simulation_ids": [baseline.json()["simulation_id"], simulation_id]},
    )
    assert comparison.status_code == 200, comparison.text
    assert len(comparison.json()["simulations"]) == 2
    assert len(comparison.json()["timeline"]) == 30
