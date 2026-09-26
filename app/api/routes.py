from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, status
from app.schemas.scenario import (
    Scenario,
    ParseScenarioRequest,
    ParseScenarioResponse,
)
from app.schemas.result import (
    RiskResult,
    ScenarioSuggestion,
    ScenarioRecommendation,
    SuggestScenariosResponse,
    SimulationExplanation,
    SimulationAnalysis,
    AnalyzeRiskRequest,
    SuggestScenariosRequest,
    AnalyzeSimulationRequest,
    CompareSimulationsRequest,
    CompareSimulationsResponse,
    ExplainResultRequest,
)
from app.services.scenario_parser import parse_scenario
from app.services.gemini_parser import parse_scenario_with_gemini
from app.services.risk_analyzer import analyze_risk
from app.services.scenario_suggester import suggest_scenarios
from app.services.result_analyzer import analyze_simulation, compare_simulations
from app.services.explanation import explain_result
from app.schemas.prescriptive import (
    AgronomicTimeSeriesFeatures,
    TimeSeriesFeatureRequest,
    PrescribeInterventionRequest,
    PrescribeInterventionResponse,
)
from app.services.time_series_features import extract_time_series_features
from app.services.prescriptive_optimizer import prescribe_intervention
from app.schemas.advanced_analytics import (
    TemporalRiskRequest,
    TemporalRiskResponse,
    SensitivityAnalysisRequest,
    SensitivityAnalysisResponse,
)
from app.services.temporal_risk_fusion import fuse_temporal_risk
from app.services.sensitivity_analyzer import analyze_sensitivity

router = APIRouter()


@router.get(
    "/health",
    tags=["System"],
    summary="Health check",
    response_model=Dict[str, str],
)
async def health_check() -> Dict[str, str]:
    """
    Returns the operational status of the AI Agriculture Simulator service.
    """
    return {
        "status": "ok",
        "service": "ai-agriculture-simulator"
    }


@router.post(
    "/ai/parse-scenario",
    tags=["AI Intelligence"],
    summary="Classify natural language farmer request into scenario intent",
    response_model=ParseScenarioResponse,
    responses={
        503: {"description": "Classifier model unavailable"}
    },
)
async def parse_scenario_endpoint(payload: ParseScenarioRequest) -> ParseScenarioResponse:
    """
    Accepts natural-language farmer text and parses it into a validated Scenario object.
    Supports either local ML (TF-IDF + Logistic Regression) or Gemini LLM reasoning (via use_llm=true).
    """
    try:
        if payload.use_llm:
            return parse_scenario_with_gemini(payload, fallback_to_local=True)
        return parse_scenario(payload)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )


@router.post(
    "/ai/parse-scenario-advanced",
    tags=["AI Intelligence"],
    summary="Advanced scenario parsing powered by Google Gemini LLM with Structured Output",
    response_model=ParseScenarioResponse,
)
async def parse_scenario_advanced_endpoint(payload: ParseScenarioRequest) -> ParseScenarioResponse:
    """
    Accepts natural-language farmer text and utilizes Google Gemini LLM with Pydantic
    Structured Outputs for multi-intent, complex, or colloquial query understanding.
    Falls back gracefully to the local ML model if GEMINI_API_KEY is not configured.
    """
    return parse_scenario_with_gemini(payload, fallback_to_local=True)


@router.post(
    "/ai/analyze-risk",
    tags=["AI Intelligence"],
    summary="Analyze farm agronomic risk based on current farm state",
    response_model=RiskResult,
    responses={
        503: {"description": "Farm risk model unavailable"},
    },
)
async def analyze_risk_endpoint(payload: AnalyzeRiskRequest) -> RiskResult:
    """
    Accepts current FarmState telemetry and calculates zone and farm risk profiles
    using the trained MultiOutput Random Forest model for water stress, heat stress,
    disease risk, and nutrient deficiency.
    """
    try:
        return analyze_risk(payload.farm_state, model_type=payload.model_type)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )


@router.post(
    "/ai/suggest-scenarios",
    tags=["AI Intelligence"],
    summary="Proactively suggest what-if scenarios based on farm vulnerability",
    response_model=SuggestScenariosResponse,
    responses={
        503: {"description": "Risk model unavailable"},
    },
)
async def suggest_scenarios_endpoint(payload: SuggestScenariosRequest) -> SuggestScenariosResponse:
    """
    Generates intelligent scenario candidates tailored to current crop stage,
    ambient weather, and multi-zone risk vulnerabilities.
    """
    try:
        return suggest_scenarios(
            farm_state=payload.farm_state,
            risk_result=payload.risk_result,
            max_suggestions=payload.max_suggestions,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )


@router.post(
    "/ai/analyze-simulation",
    tags=["AI Intelligence"],
    summary="Analyze simulation results comparing baseline and scenario metrics",
    response_model=SimulationAnalysis,
)
async def analyze_simulation_endpoint(payload: AnalyzeSimulationRequest) -> SimulationAnalysis:
    """
    Compares baseline vs scenario biophysical simulation metrics, calculates deltas,
    evaluates trade-offs, assigns an impact level, and produces structured analysis.
    """
    return analyze_simulation(payload.simulation_result)


@router.post(
    "/ai/compare-simulations",
    tags=["AI Intelligence"],
    summary="Compare multiple simulation scenarios against baseline",
    response_model=CompareSimulationsResponse,
)
async def compare_simulations_endpoint(payload: CompareSimulationsRequest) -> CompareSimulationsResponse:
    """
    Compares two or more simulation scenario runs against their baselines side-by-side,
    highlighting relative performance, yield impacts, and agronomic trade-offs.
    """
    return compare_simulations(payload.simulations)


@router.post(
    "/ai/explain-result",
    tags=["AI Intelligence"],
    summary="Generate farmer-friendly explanations for biophysical simulation results",
    response_model=SimulationExplanation,
)
async def explain_result_endpoint(payload: ExplainResultRequest) -> SimulationExplanation:
    """
    Translates raw simulation metrics from Person 2's engine into actionable farming advice.
    """
    return explain_result(
        simulation_id=payload.simulation_id,
        simulation_output=payload.simulation_output,
        simulation_result=payload.simulation_result,
        scenario=payload.scenario,
        audience=payload.audience,
    )


@router.post(
    "/ai/time-series-features",
    tags=["AI Intelligence"],
    summary="Extract agronomic time-series features (GDD, drought index, VPD, trends)",
    response_model=AgronomicTimeSeriesFeatures,
)
async def time_series_features_endpoint(payload: TimeSeriesFeatureRequest) -> AgronomicTimeSeriesFeatures:
    """
    Extracts cumulative thermal heat units (GDD), consecutive dry/heat spells,
    soil moisture depletion rates, and Vapor Pressure Deficit (VPD) from temporal telemetry.
    """
    try:
        return extract_time_series_features(payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.post(
    "/ai/prescribe-intervention",
    tags=["AI Intelligence"],
    summary="Prescriptive multi-objective optimization to generate optimal intervention plans",
    response_model=PrescribeInterventionResponse,
)
async def prescribe_intervention_endpoint(payload: PrescribeInterventionRequest) -> PrescribeInterventionResponse:
    """
    Prescribes Pareto-optimal intervention strategies (Conservative, Balanced, Aggressive)
    tailored to the farmer's objective (Yield, Water, Efficiency, Risk Defense).
    Generates ready-to-simulate Scenario contracts and step-by-step action schedules.
    """
    return prescribe_intervention(payload)


@router.post(
    "/ai/analyze-temporal-risk",
    tags=["AI Intelligence"],
    summary="Fuse snapshot ML risk predictions with 14-day temporal time-series indicators",
    response_model=TemporalRiskResponse,
)
async def analyze_temporal_risk_endpoint(payload: TemporalRiskRequest) -> TemporalRiskResponse:
    """
    Fuses point-in-time machine learning predictions (XGBoost/RF) with multi-day
    cumulative biophysical indicators (GDD, VPD, dry/heat runs, soil moisture slope)
    to detect accelerating or impending agricultural hazards.
    """
    return fuse_temporal_risk(payload)


@router.post(
    "/ai/sensitivity-analysis",
    tags=["AI Intelligence"],
    summary="Agronomic shock sensitivity sweep and critical tipping-point detection",
    response_model=SensitivityAnalysisResponse,
)
async def sensitivity_analysis_endpoint(payload: SensitivityAnalysisRequest) -> SensitivityAnalysisResponse:
    """
    Sweeps environmental or operational perturbations (e.g. rain cut from 10% to 70%)
    using crop production curves (FAO-33) to identify the critical tipping point where
    yield collapse accelerates non-linearly.
    """
    return analyze_sensitivity(payload)

