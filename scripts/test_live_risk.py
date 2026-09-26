import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

SCENARIOS = [
    {
        "name": "Case A: Healthy Balanced Farm",
        "description": "Soybean plot with optimal soil moisture (26%), 24°C temperature, balanced N-P-K, and active drip irrigation.",
        "payload": {
            "farm_state": {
                "farm_id": "farm-healthy-01",
                "zones": [
                    {
                        "zone_id": "zone-optimal",
                        "name": "East Meadow",
                        "area_acres": 25.0,
                        "crop": "Soybean",
                        "soil": "Clay Loam",
                        "growth_stage": "Vegetative",
                        "irrigation": "Drip",
                        "soil_moisture": 26.0,
                        "temperature": 24.5,
                        "humidity": 55.0,
                        "rainfall": 6.0,
                        "nitrogen": 48.0,
                        "phosphorus": 24.0,
                        "potassium": 165.0,
                    }
                ],
            }
        },
    },
    {
        "name": "Case B: Drought & Water-Stress Farm",
        "description": "Rice paddy under severe dry spell: soil moisture 7.2% v/v, zero rainfall, no irrigation buffer, 36°C ambient heat.",
        "payload": {
            "farm_state": {
                "farm_id": "farm-drought-02",
                "zones": [
                    {
                        "zone_id": "zone-dry",
                        "name": "South Arid Plot",
                        "area_acres": 40.0,
                        "crop": "Rice",
                        "soil": "Sandy Loam",
                        "growth_stage": "Flowering",
                        "irrigation": "Rainfed",
                        "soil_moisture": 7.2,
                        "temperature": 36.5,
                        "humidity": 30.0,
                        "rainfall": 0.0,
                        "nitrogen": 30.0,
                        "phosphorus": 14.0,
                        "potassium": 110.0,
                    }
                ],
            }
        },
    },
    {
        "name": "Case C: Hot + Humid + Wet Disease-Prone Farm",
        "description": "Potato field with dense canopy, 94% relative humidity, 45mm heavy rainfall, overhead sprinkler wetting, and 26°C fungal incubation temperature.",
        "payload": {
            "farm_state": {
                "farm_id": "farm-disease-03",
                "zones": [
                    {
                        "zone_id": "zone-fungal",
                        "name": "River Basin Plot",
                        "area_acres": 18.5,
                        "crop": "Potato",
                        "soil": "Silt Loam",
                        "growth_stage": "Flowering",
                        "irrigation": "Sprinkler",
                        "soil_moisture": 35.0,
                        "temperature": 26.0,
                        "humidity": 94.0,
                        "rainfall": 45.0,
                        "nitrogen": 40.0,
                        "phosphorus": 20.0,
                        "potassium": 140.0,
                    }
                ],
            }
        },
    },
]


def run_live_tests():
    print("=" * 75)
    print("      LIVE TEST SUITE: POST /ai/analyze-risk")
    print("=" * 75)

    for i, test_case in enumerate(SCENARIOS, 1):
        print(f"\n[{i}/3] {test_case['name']}")
        print(f"Context: {test_case['description']}")

        response = client.post("/ai/analyze-risk", json=test_case["payload"])
        assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}: {response.text}"

        data = response.json()
        print(f"Status: HTTP {response.status_code} OK")
        print(f"Farm ID:             {data['farm_id']}")
        print(f"Overall Farm Risk:   {data['overall_risk']}")

        for z in data["zones"]:
            print(f"  Zone ID:           {z['zone_id']}")
            print(f"  Zone Risk Level:   {z['risk_level']}")
            print(f"  Water Stress:      {z['water_stress']} (conf: {z['risk_probabilities'].get('water_stress', 'N/A')})")
            print(f"  Heat Stress:       {z['heat_stress']} (conf: {z['risk_probabilities'].get('heat_stress', 'N/A')})")
            print(f"  Disease Risk:      {z['disease_risk']} (conf: {z['risk_probabilities'].get('disease_risk', 'N/A')})")
            print(f"  Nutrient Risk:     {z['nutrient_risk']} (conf: {z['risk_probabilities'].get('nutrient_risk', 'N/A')})")
            print(f"  Primary Threat:    {z['primary_threat']}")
            print(f"  Composite Score:   {z['score']}")
            print(f"  Factors:           {z['contributing_factors'][:2]}")

        print(f"Critical Factors:    {data['critical_factors']}")
        print(f"Suggested Action:    {data['suggested_mitigations']}")
        print("-" * 75)

    print("\nALL 3 LIVE FARM RISK SCENARIOS EVALUATED SUCCESSFULLY!")


if __name__ == "__main__":
    run_live_tests()
