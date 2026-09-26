"""
Unit Tests for Gemini LLM Scenario Parser Service and API Endpoint.
"""

from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.scenario import (
    ParseScenarioRequest,
    ParseScenarioResponse,
    Scenario,
    ScenarioChanges,
    ScenarioType,
)
from app.services.gemini_parser import parse_scenario_with_gemini

client = TestClient(app)


def test_gemini_parser_fallback_without_api_key(monkeypatch):
    """Verify parser falls back cleanly to local ML when GEMINI_API_KEY is unset."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    req = ParseScenarioRequest(query="What if rainfall drops by 30% for 45 days?")
    response = parse_scenario_with_gemini(req, fallback_to_local=True)

    assert response is not None
    assert response.scenario_type == ScenarioType.RAIN_REDUCTION
    assert response.scenario is not None
    assert response.scenario.duration_days == 45
    assert response.engine.startswith("local_ml")


def test_gemini_parser_raises_without_fallback(monkeypatch):
    """Verify ValueError is raised if fallback is disabled and no key is configured."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    req = ParseScenarioRequest(query="What if rainfall drops by 30%?")
    with pytest.raises(ValueError, match="GEMINI_API_KEY is not configured"):
        parse_scenario_with_gemini(req, fallback_to_local=False)


def test_gemini_parser_with_mocked_llm():
    """Verify successful parsing with mocked Google GenAI client."""
    mock_scenario = Scenario(
        scenario_type=ScenarioType.COMBINED,
        name="Combined Heat and Drought",
        duration_days=21,
        target_zones=["Zone B"],
        changes=ScenarioChanges(
            rainfall_multiplier=0.6,
            temperature_delta=3.0,
        ),
    )

    mock_response = MagicMock()
    mock_response.parsed = mock_scenario

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch("google.genai.Client", return_value=mock_client):
        req = ParseScenarioRequest(
            query="It's getting 3 degrees hotter and 40% less rain for 3 weeks in Zone B",
            use_llm=True,
        )
        result = parse_scenario_with_gemini(req, api_key="fake-test-key")

        assert result.engine == "gemini_llm"
        assert result.scenario_type == ScenarioType.COMBINED
        assert result.confidence == 0.98
        assert result.scenario.duration_days == 21
        assert result.scenario.target_zones == ["Zone B"]
        assert result.scenario.changes.rainfall_multiplier == 0.6
        assert result.scenario.changes.temperature_delta == 3.0


def test_advanced_parse_api_endpoint(monkeypatch):
    """Verify POST /ai/parse-scenario-advanced operates and responds with 200."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    payload = {"query": "Simulate a 7-day severe heatwave"}
    response = client.post("/ai/parse-scenario-advanced", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["scenario_type"] == "HEATWAVE"
    assert "engine" in data
