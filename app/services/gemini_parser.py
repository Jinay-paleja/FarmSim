"""
Service: Gemini LLM Scenario Parser
Responsibility:
- Ingest farmer natural language inquiry (including complex multi-variable sentences, slang, or temporal references).
- Use Google Gemini API with Pydantic Structured Outputs (response_schema=Scenario).
- Validate and return ParseScenarioResponse with engine="gemini_llm".
- Graceful error handling and optional fallback to local TF-IDF + Logistic Regression pipeline.
"""

import os
from typing import Optional
from dotenv import load_dotenv

from app.schemas.scenario import (
    ParseScenarioRequest,
    ParseScenarioResponse,
    Scenario,
    ScenarioType,
    TopPrediction,
)

load_dotenv()


def parse_scenario_with_gemini(
    request: ParseScenarioRequest,
    api_key: Optional[str] = None,
    fallback_to_local: bool = True,
) -> ParseScenarioResponse:
    """
    Parse a farmer query using Google Gemini API with Structured Output.

    Args:
        request: The parsing request containing the query text.
        api_key: Optional API key override; defaults to GEMINI_API_KEY env var.
        fallback_to_local: If True and GEMINI_API_KEY is missing or call fails,
                           fall back to the local TF-IDF + LogReg parser.

    Returns:
        ParseScenarioResponse: Structured scenario and metadata.
    """
    effective_api_key = api_key or os.getenv("GEMINI_API_KEY")
    query = request.query.strip() if request.query else ""

    if not effective_api_key:
        if fallback_to_local:
            from app.services.scenario_parser import parse_scenario

            res = parse_scenario(request)
            res.engine = "local_ml (llm_api_key_missing_fallback)"
            return res
        raise ValueError(
            "GEMINI_API_KEY is not configured. Please set the GEMINI_API_KEY in your .env or environment."
        )

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=effective_api_key)

        prompt = (
            "You are an agronomic scenario understanding system. "
            "Convert the farmer's natural-language inquiry into the structured Scenario schema.\n\n"
            f"Farmer Inquiry: \"{query}\"\n\n"
            "Rules:\n"
            "1. scenario_type MUST be one of: RAIN_REDUCTION, RAIN_INCREASE, TEMPERATURE_INCREASE, HEATWAVE, "
            "IRRIGATION_INCREASE, IRRIGATION_DECREASE, IRRIGATION_FAILURE, FERTILIZER_CHANGE, NUTRIENT_DEFICIENCY, "
            "DISEASE_OUTBREAK, PEST_OUTBREAK, SOIL_MOISTURE_CHANGE, COMBINED.\n"
            "2. Extract duration in days (e.g. '3 weeks' -> 21 days).\n"
            "3. Extract target_zones (e.g. 'Zone A', 'North Field').\n"
            "4. Convert percentages to multipliers in changes (e.g. 'rainfall drops 30%' -> rainfall_multiplier=0.70; "
            "'irrigation up 25%' -> irrigation_multiplier=1.25; '+4 degrees' -> temperature_delta=4.0).\n"
            "5. If multiple distinct perturbations occur, use scenario_type='COMBINED'.\n"
        )

        model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=Scenario,
                temperature=0.1,
            ),
        )

        scenario: Scenario = response.parsed

        return ParseScenarioResponse(
            engine="gemini_llm",
            scenario_type=scenario.scenario_type,
            confidence=0.98,
            needs_clarification=False,
            missing_parameters=[],
            scenario=scenario,
            top_predictions=[
                TopPrediction(
                    scenario_type=scenario.scenario_type,
                    confidence=0.98,
                )
            ],
        )
    except Exception as exc:
        if fallback_to_local:
            from app.services.scenario_parser import parse_scenario

            res = parse_scenario(request)
            res.engine = f"local_ml (fallback_due_to: {type(exc).__name__})"
            return res
        raise exc
