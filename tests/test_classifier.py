import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.scenario import ParseScenarioRequest, ScenarioType
from app.services.scenario_parser import parse_scenario

client = TestClient(app)

# Required specific queries from Task Specification
TEST_INTENT_CASES = [
    ("What if rainfall decreases by 30%?", ScenarioType.RAIN_REDUCTION),
    ("Give my crops more water", ScenarioType.IRRIGATION_INCREASE),
    ("What happens if the temperature rises?", ScenarioType.TEMPERATURE_INCREASE),
    ("Simulate a heatwave", ScenarioType.HEATWAVE),
    ("Reduce irrigation", ScenarioType.IRRIGATION_DECREASE),
    ("What if disease spreads through zone 1?", ScenarioType.DISEASE_OUTBREAK),
    ("What if pests attack the crop?", ScenarioType.PEST_OUTBREAK),
    ("Reduce fertilizer", ScenarioType.FERTILIZER_CHANGE),
    ("Crop has low nutrients", ScenarioType.NUTRIENT_DEFICIENCY),
    ("Increase soil moisture", ScenarioType.SOIL_MOISTURE_CHANGE),
    ("What if the pump breaks down and water stops?", ScenarioType.IRRIGATION_FAILURE),
    ("What if we have both drought and extreme heatwave?", ScenarioType.COMBINED),
]


@pytest.mark.parametrize("query,expected_type", TEST_INTENT_CASES)
def test_scenario_intent_classification(query: str, expected_type: ScenarioType):
    """Verify that service correctly classifies core farmer queries with high confidence."""
    request = ParseScenarioRequest(query=query)
    response = parse_scenario(request)

    assert response.scenario_type == expected_type
    assert response.confidence >= 0.60
    assert response.top_predictions is not None
    assert len(response.top_predictions) >= 1
    assert response.top_predictions[0].scenario_type == expected_type


@pytest.mark.parametrize("query,expected_type", TEST_INTENT_CASES)
def test_api_parse_scenario_endpoint(query: str, expected_type: ScenarioType):
    """Verify that POST /ai/parse-scenario endpoint returns 200 and matches classification."""
    response = client.post("/ai/parse-scenario", json={"query": query})
    assert response.status_code == 200
    data = response.json()

    assert data["scenario_type"] == expected_type.value
    assert data["confidence"] >= 0.60
    assert len(data["top_predictions"]) > 0


def test_empty_input():
    """Verify empty or whitespace-only query returns needs_clarification=True and confidence=0.0."""
    # Test service directly
    res_empty = parse_scenario(ParseScenarioRequest(query=""))
    assert res_empty.needs_clarification is True
    assert res_empty.scenario_type is None
    assert res_empty.confidence == 0.0

    res_whitespace = parse_scenario(ParseScenarioRequest(query="   \t\n  "))
    assert res_whitespace.needs_clarification is True
    assert res_whitespace.scenario_type is None
    assert res_whitespace.confidence == 0.0

    # Test via API endpoint
    api_res = client.post("/ai/parse-scenario", json={"query": ""})
    assert api_res.status_code == 200
    data = api_res.json()
    assert data["needs_clarification"] is True
    assert data["scenario_type"] is None
    assert data["confidence"] == 0.0


def test_unrelated_input():
    """Verify out-of-domain / unrelated queries fail the confidence threshold."""
    unrelated_queries = [
        "What is the price of Bitcoin today?",
        "Can you write a poem about the moon?",
        "Who won the world cup in 2022?",
        "Tell me a funny joke",
    ]
    for query in unrelated_queries:
        res = client.post("/ai/parse-scenario", json={"query": query})
        assert res.status_code == 200
        data = res.json()
        assert data["needs_clarification"] is True
        assert data["scenario_type"] is None
        assert data["confidence"] < 0.60


def test_ambiguous_input():
    """Verify vague / ambiguous agricultural text triggers needs_clarification."""
    ambiguous_queries = [
        "The field and the weather",
        "Hello there",
        "Thinking about tomorrow",
    ]
    for query in ambiguous_queries:
        res = client.post("/ai/parse-scenario", json={"query": query})
        assert res.status_code == 200
        data = res.json()
        assert data["needs_clarification"] is True
        assert data["scenario_type"] is None


def test_custom_threshold_override(monkeypatch):
    """Verify that SCENARIO_CLASSIFIER_THRESHOLD environment variable is respected."""
    # Set threshold to very high value (0.999), forcing clarification on any normal query
    monkeypatch.setenv("SCENARIO_CLASSIFIER_THRESHOLD", "0.999")
    res = client.post("/ai/parse-scenario", json={"query": "What if rainfall decreases by 30%?"})
    assert res.status_code == 200
    data = res.json()
    assert data["needs_clarification"] is True
    assert data["scenario_type"] is None
