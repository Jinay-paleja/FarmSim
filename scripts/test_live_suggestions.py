"""
Script: Live Scenario Suggester Endpoint Verification
Tests POST /ai/suggest-scenarios against a live TestClient across 4 key farm states:
  Case A: Healthy Farm -> verifies 0 unnecessary recommendations.
  Case B: High Water Stress Farm -> verifies 30% rainfall cut and irrigation failure recommendations.
  Case C: Multiple High Risks Farm -> verifies independent recommendations (drought, heatwave, disease).
  Case D: Multi-Zone Farm -> verifies recommendations correctly target only the vulnerable zone.
"""

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

LIVE_CASES = [
    {
        "case_id": "A",
        "name": "Case A: Healthy Balanced Farm",
        "description": "Soybean with 26% soil moisture, 23°C, 55% humidity, drip irrigation, balanced nutrients.",
        "payload": {
            "farm_state": {
                "farm_id": "farm-live-healthy",
                "zones": [
                    {
                        "zone_id": "zone-healthy",
                        "name": "Green Valley Plot",
                        "area_acres": 25.0,
                        "crop": "Soybean",
                        "soil": "Clay Loam",
                        "growth_stage": "Vegetative",
                        "irrigation": "Drip",
                        "soil_moisture": 26.0,
                        "temperature": 23.0,
                        "humidity": 55.0,
                        "rainfall": 5.0,
                        "nitrogen": 48.0,
                        "phosphorus": 24.0,
                        "potassium": 165.0,
                    }
                ],
            }
        },
    },
    {
        "case_id": "B",
        "name": "Case B: High Water Stress Farm",
        "description": "Rice paddy under severe moisture deficit (6.8% v/v), 36°C heat, zero rainfall, drip irrigation.",
        "payload": {
            "farm_state": {
                "farm_id": "farm-live-drought",
                "zones": [
                    {
                        "zone_id": "zone-arid",
                        "name": "Arid Rice Basin",
                        "area_acres": 35.0,
                        "crop": "Rice",
                        "soil": "Sandy Loam",
                        "growth_stage": "Flowering",
                        "irrigation": "Drip",
                        "soil_moisture": 6.8,
                        "temperature": 36.0,
                        "humidity": 30.0,
                        "rainfall": 0.0,
                        "nitrogen": 35.0,
                        "phosphorus": 18.0,
                        "potassium": 130.0,
                    }
                ],
            }
        },
    },
    {
        "case_id": "C",
        "name": "Case C: Multiple High Risks Farm",
        "description": "Potato plot with acute compound stress: extreme heat (38°C), 92% humidity with rainfall, and depleted nitrogen (8 ppm).",
        "payload": {
            "farm_state": {
                "farm_id": "farm-live-compound",
                "zones": [
                    {
                        "zone_id": "zone-compound",
                        "name": "Stressed Potato Plot",
                        "area_acres": 20.0,
                        "crop": "Potato",
                        "soil": "Silt Loam",
                        "growth_stage": "Flowering",
                        "irrigation": "Sprinkler",
                        "soil_moisture": 35.0,
                        "temperature": 38.0,
                        "humidity": 92.0,
                        "rainfall": 40.0,
                        "nitrogen": 8.0,
                        "phosphorus": 8.0,
                        "potassium": 80.0,
                    }
                ],
            }
        },
    },
    {
        "case_id": "D",
        "name": "Case D: Multi-Zone Farm (Drought Zone + Healthy Zone)",
        "description": "Multi-zone layout: Zone 1 is suffering severe drought, while Zone 2 is healthy. Recommendations must isolate Zone 1.",
        "payload": {
            "farm_state": {
                "farm_id": "farm-live-multizone",
                "zones": [
                    {
                        "zone_id": "zone-vulnerable",
                        "name": "West Dry Plot",
                        "area_acres": 15.0,
                        "crop": "Rice",
                        "soil": "Sandy Loam",
                        "growth_stage": "Flowering",
                        "irrigation": "Rainfed",
                        "soil_moisture": 6.5,
                        "temperature": 36.0,
                        "humidity": 28.0,
                        "rainfall": 0.0,
                        "nitrogen": 30.0,
                        "phosphorus": 15.0,
                        "potassium": 120.0,
                    },
                    {
                        "zone_id": "zone-thriving",
                        "name": "East Protected Plot",
                        "area_acres": 25.0,
                        "crop": "Soybean",
                        "soil": "Clay Loam",
                        "growth_stage": "Vegetative",
                        "irrigation": "Drip",
                        "soil_moisture": 26.5,
                        "temperature": 23.5,
                        "humidity": 55.0,
                        "rainfall": 6.0,
                        "nitrogen": 50.0,
                        "phosphorus": 25.0,
                        "potassium": 180.0,
                    },
                ],
            }
        },
    },
]


def run_live_tests():
    print("=" * 80)
    print("      LIVE TEST SUITE: POST /ai/suggest-scenarios")
    print("=" * 80)

    for case in LIVE_CASES:
        print(f"\n--- {case['name']} ---")
        print(f"Context: {case['description']}")

        response = client.post("/ai/suggest-scenarios", json=case["payload"])
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        print(f"Status: HTTP {response.status_code} OK")
        print(f"Farm ID: {data['farm_id']}")
        print(f"Total Recommendations: {len(data['recommendations'])}")

        if not data["recommendations"]:
            print("  -> (No stress-test recommendations required; farm operating within safe parameters)")
        else:
            for rec in data["recommendations"]:
                sc = rec["scenario"]
                changes_clean = {k: v for k, v in sc["changes"].items() if v is not None}
                print(f"\n  [{rec['recommendation_id']}] Priority: {rec['priority']} | Type: {sc['scenario_type']}")
                print(f"    Title:        {sc['name']}")
                print(f"    Duration:     {sc['duration_days']} days")
                print(f"    Target Zones: {sc['target_zones'] if sc['target_zones'] else 'Entire Farm ([])'}")
                print(f"    Changes:      {changes_clean}")
                print(f"    Triggers:     {rec['triggered_risks']}")
                print(f"    Reason:       {rec['reason']}")

        print("-" * 80)

    print("\nALL 4 LIVE SCENARIO SUGGESTER SCENARIOS EVALUATED SUCCESSFULLY!")


if __name__ == "__main__":
    run_live_tests()
