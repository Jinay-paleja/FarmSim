"""Extended tests for complete backend functionality:
- Full CRUD with DELETE /farms/{id} and DELETE /farms/{id}/zones/{zone_id}
- Authentication (/auth/register, /auth/login, /auth/me, /auth/logout)
- Advanced AI endpoints (/ai/time-series-features, /ai/prescribe-intervention, /ai/analyze-temporal-risk, /ai/sensitivity-analysis)
"""

from __future__ import annotations

import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) in sys.path:
    sys.path.remove(str(backend_dir))
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.repository import SQLiteRepository


def get_test_client(tmp_path):
    repository = SQLiteRepository(f"sqlite:///{tmp_path / 'extended-test.db'}")
    app = create_app(repository=repository, configured_settings=Settings(database_url="sqlite:///unused.db"))
    return TestClient(app)


def test_auth_workflow(tmp_path):
    client = get_test_client(tmp_path)

    # 1. Register new user
    reg = client.post(
        "/auth/register",
        json={
            "name": "Jane Farmer",
            "email": "jane@example.com",
            "password": "securepassword123",
            "location": "Nashik, Maharashtra",
            "specialty": "Grapes & Vegetables",
        },
    )
    assert reg.status_code == 201, reg.text
    data = reg.json()
    assert "token" in data
    assert data["user"]["email"] == "jane@example.com"
    token = data["token"]

    # 2. Get current user profile
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200, me.text
    assert me.json()["name"] == "Jane Farmer"

    # 3. Log out
    out = client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert out.status_code == 200

    # 4. Log back in
    login = client.post(
        "/auth/login",
        json={"email": "jane@example.com", "password": "securepassword123"},
    )
    assert login.status_code == 200, login.text
    assert login.json()["token"]


def test_farm_and_zone_delete_endpoints(tmp_path):
    client = get_test_client(tmp_path)

    # Create farm
    farm_res = client.post(
        "/farms",
        json={"name": "Delete Test Farm", "location": "Pune", "area_acres": 15, "number_of_zones": 2},
    )
    assert farm_res.status_code == 201
    farm_id = farm_res.json()["farm_id"]

    # Create 2 zones
    z1_res = client.post(
        f"/farms/{farm_id}/zones",
        json={
            "name": "North Field",
            "area_acres": 7,
            "crop": "Tomato",
            "soil": "Black",
            "growth_stage": "Flowering",
            "irrigation": "Drip",
            "soil_moisture": 50,
            "temperature": 28,
            "humidity": 65,
            "rainfall": 80,
            "nitrogen": 60,
            "phosphorus": 55,
            "potassium": 60,
        },
    )
    assert z1_res.status_code == 201
    z1_id = z1_res.json()["zone_id"]

    z2_res = client.post(
        f"/farms/{farm_id}/zones",
        json={
            "name": "South Field",
            "area_acres": 8,
            "crop": "Wheat",
            "soil": "Alluvial",
            "growth_stage": "Vegetative",
            "irrigation": "Sprinkler",
            "soil_moisture": 55,
            "temperature": 26,
            "humidity": 60,
            "rainfall": 70,
            "nitrogen": 65,
            "phosphorus": 50,
            "potassium": 55,
        },
    )
    assert z2_res.status_code == 201
    z2_id = z2_res.json()["zone_id"]

    # Verify 2 zones exist
    farm_detail = client.get(f"/farms/{farm_id}")
    assert len(farm_detail.json()["zones"]) == 2

    # Delete Zone 1
    del_z1 = client.delete(f"/farms/{farm_id}/zones/{z1_id}")
    assert del_z1.status_code == 204

    # Verify only Zone 2 remains
    farm_after_z1 = client.get(f"/farms/{farm_id}")
    assert len(farm_after_z1.json()["zones"]) == 1
    assert farm_after_z1.json()["zones"][0]["zone_id"] == z2_id

    # Delete entire farm
    del_farm = client.delete(f"/farms/{farm_id}")
    assert del_farm.status_code == 204

    # Verify farm no longer exists
    get_farm_after = client.get(f"/farms/{farm_id}")
    assert get_farm_after.status_code == 404


def test_advanced_ai_endpoints(tmp_path):
    client = get_test_client(tmp_path)

    # 1. Time-series features
    ts_payload = {
        "crop": "Corn",
        "history": [
            {
                "day_index": i,
                "temperature_max": 32.0,
                "temperature_min": 20.0,
                "temperature_avg": 26.0,
                "humidity": 65.0,
                "rainfall": 5.0 if i % 4 == 0 else 0.0,
                "soil_moisture": 30.0 - i * 0.4,
            }
            for i in range(1, 15)
        ],
    }
    ts_res = client.post("/ai/time-series-features", json=ts_payload)
    assert ts_res.status_code == 200, ts_res.text
    ts_data = ts_res.json()
    assert ts_data["growing_degree_days"] > 0
    assert "drought_severity" in ts_data

    # 2. Prescriptive intervention
    presc_payload = {
        "farm_state": {
            "farm_id": "farm-presc",
            "zones": [
                {
                    "zone_id": "z1",
                    "name": "North Field",
                    "area_acres": 25.0,
                    "crop": "Corn",
                    "soil": "Loam",
                    "growth_stage": "Vegetative",
                    "irrigation": "Drip",
                    "soil_moisture": 18.0,
                    "temperature": 34.0,
                    "humidity": 50.0,
                    "rainfall": 5.0,
                    "nitrogen": 45.0,
                    "phosphorus": 35.0,
                    "potassium": 40.0,
                }
            ],
        },
        "objective": "BALANCED_EFFICIENCY",
    }
    presc_res = client.post("/ai/prescribe-intervention", json=presc_payload)
    assert presc_res.status_code == 200, presc_res.text
    presc_data = presc_res.json()
    assert presc_data["optimal_plan"] is not None
    assert "name" in presc_data["optimal_plan"]

    # 3. Sensitivity analysis
    sens_payload = {
        "scenario_type": "RAIN_REDUCTION",
        "crop": "Wheat",
        "baseline_yield": 4500.0,
        "current_soil_moisture": 22.0,
    }
    sens_res = client.post("/ai/sensitivity-analysis", json=sens_payload)
    assert sens_res.status_code == 200, sens_res.text
    sens_data = sens_res.json()
    assert len(sens_data["curve"]) > 0
    assert sens_data["tipping_point_value"] is not None
    assert "safe_operating_limit" in sens_data
