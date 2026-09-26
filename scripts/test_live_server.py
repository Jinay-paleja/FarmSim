import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

QUERIES = [
    # 1. Full rain reduction
    "What if rainfall decreases by 30% for 45 days?",
    # 2. Zone-specific irrigation increase
    "Increase irrigation in zone 2 by 20% for 15 days.",
    # 3. Temperature increase
    "What if temperature increases by 3°C for 7 days?",
    # 4. Heatwave simulation
    "Simulate a heatwave for 10 days.",
    # 5. Dual combined shock
    "Reduce rainfall by 25% and increase temperature by 2°C for 30 days.",
    # 6. Triple combined shock
    "Reduce rainfall by 30%, increase temperature by 3 degrees and increase irrigation by 15% for 45 days.",
    # 7. Fertilizer cut
    "Reduce fertilizer by 25% for 30 days.",
    # 8. Pump breakdown
    "What if the pump breaks down and water stops for 7 days?",
    # 9. Multiple zones
    "Increase irrigation in zones 1 and 3 by 15% for 10 days.",
    # 10. Under-specified query (no duration or amount)
    "Increase irrigation.",
    # 11. Under-specified query (amount present, no duration)
    "Reduce rainfall by 30% and increase temperature by 3°C.",
    # 12. Out-of-domain query
    "Can you write a poem about tractors?",
]

def run_verification():
    print("=== Testing /health ===")
    health = client.get("/health")
    print(f"Status: {health.status_code}, Response: {health.json()}\n")
    assert health.status_code == 200

    print("=== Testing /ai/parse-scenario across 12 farmer inquiries ===")
    for i, q in enumerate(QUERIES, start=1):
        resp = client.post("/ai/parse-scenario", json={"query": q})
        data = resp.json()
        print(f"[{i}] Query: '{q}'")
        print(f"    ScenarioType:        {data.get('scenario_type')}")
        print(f"    Confidence:          {data.get('confidence')}")
        print(f"    Needs Clarification: {data.get('needs_clarification')}")
        print(f"    Missing Parameters:  {data.get('missing_parameters')}")
        scen = data.get("scenario")
        if scen:
            print(f"    Scenario Name:       {scen.get('name')}")
            print(f"    Duration Days:       {scen.get('duration_days')}")
            print(f"    Target Zones:        {scen.get('target_zones')}")
            print(f"    Changes:             {scen.get('changes')}")
        else:
            print("    Scenario Object:     None")
        print()

if __name__ == "__main__":
    run_verification()
