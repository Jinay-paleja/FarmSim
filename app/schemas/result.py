from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator
from app.schemas.scenario import Scenario
from app.schemas.farm import FarmState, Zone


class RiskLevel(str, Enum):
    """
    Standard risk severity tiers for farm assessment.
    """
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ZoneRisk(BaseModel):
    """
    Risk assessment breakdown for an individual management zone.
    Includes predictions for 4 independent agronomic risk categories:
    WATER_STRESS, HEAT_STRESS, DISEASE_RISK, and NUTRIENT_RISK.
    """
    zone_id: str = Field(..., description="Target zone identifier")
    risk_level: RiskLevel = Field(default=RiskLevel.LOW, description="Assessed overall risk severity level for this zone")
    water_stress: RiskLevel = Field(default=RiskLevel.LOW, description="Predicted water stress risk level (LOW, MEDIUM, HIGH)")
    heat_stress: RiskLevel = Field(default=RiskLevel.LOW, description="Predicted heat stress risk level (LOW, MEDIUM, HIGH)")
    disease_risk: RiskLevel = Field(default=RiskLevel.LOW, description="Predicted disease risk level (LOW, MEDIUM, HIGH)")
    nutrient_risk: RiskLevel = Field(default=RiskLevel.LOW, description="Predicted nutrient deficiency risk level (LOW, MEDIUM, HIGH)")
    primary_threat: str = Field(default="None", description="Main hazard (e.g., 'Soil Moisture Deficit', 'Heat Shock')")
    score: float = Field(default=0.0, ge=0.0, le=1.0, description="Normalized risk index score (0.0 to 1.0)")
    contributing_factors: List[str] = Field(
        default_factory=list,
        description="Key variables triggering the risk alert"
    )
    risk_probabilities: Optional[Dict[str, float]] = Field(
        default=None,
        description="Model prediction confidence/probability for each risk category"
    )

    model_config = ConfigDict(use_enum_values=True)


class RiskResult(BaseModel):
    """
    Output contract for farm risk analysis.
    Provides overall risk evaluation and zone-level risk breakdowns.
    """
    farm_id: str = Field(..., description="Evaluated farm identifier")
    overall_risk_level: RiskLevel = Field(..., description="Highest aggregated risk tier across the farm")
    assessed_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="UTC timestamp of the assessment"
    )
    zone_risks: List[ZoneRisk] = Field(
        default_factory=list,
        description="Individual risk breakdowns per zone"
    )
    critical_factors: List[str] = Field(
        default_factory=list,
        description="Summary of critical environmental or nutritional stressors"
    )
    suggested_mitigations: List[str] = Field(
        default_factory=list,
        description="Immediate practical agronomic mitigation actions"
    )

    @computed_field
    @property
    def overall_risk(self) -> RiskLevel:
        """Alias property matching simplified frontend contract."""
        return self.overall_risk_level

    @computed_field
    @property
    def zones(self) -> List[ZoneRisk]:
        """Alias property matching simplified frontend contract."""
        return self.zone_risks

    model_config = ConfigDict(use_enum_values=True)


class ScenarioSuggestion(BaseModel):
    """
    Contract for a pro-actively generated "what-if" scenario suggestion.
    """
    suggestion_id: str = Field(..., description="Unique suggestion identifier")
    title: str = Field(..., description="Concise, farmer-readable headline")
    rationale: str = Field(..., description="Agronomic reasoning explaining why testing this scenario matters")
    urgency: RiskLevel = Field(default=RiskLevel.MEDIUM, description="Urgency priority of testing this scenario")
    scenario: Scenario = Field(..., description="Complete executable scenario ready for the simulation engine")

    model_config = ConfigDict(use_enum_values=True)


class ScenarioRecommendation(BaseModel):
    """
    Contract for a recommended "what-if" stress-test scenario tailored to detected farm risks.
    """
    recommendation_id: str = Field(..., description="Unique recommendation identifier")
    scenario: Scenario = Field(..., description="Complete executable scenario contract")
    priority: RiskLevel = Field(..., description="Recommendation priority tier (HIGH, MEDIUM, LOW)")
    reason: str = Field(..., description="Farmer-friendly explanation for why testing this scenario is recommended")
    triggered_risks: List[str] = Field(default_factory=list, description="Risk dimensions that triggered this recommendation")
    target_zones: List[str] = Field(default_factory=list, description="Targeted zone identifiers")

    # Computed fields for backward compatibility with ScenarioSuggestion
    @computed_field
    @property
    def suggestion_id(self) -> str:
        return self.recommendation_id

    @computed_field
    @property
    def title(self) -> str:
        return self.scenario.name

    @computed_field
    @property
    def rationale(self) -> str:
        return self.reason

    @computed_field
    @property
    def urgency(self) -> RiskLevel:
        return self.priority

    model_config = ConfigDict(use_enum_values=True)


class SuggestScenariosResponse(BaseModel):
    """
    Response model for POST /ai/suggest-scenarios.
    """
    farm_id: str = Field(..., description="Evaluated farm identifier")
    recommendations: List[ScenarioRecommendation] = Field(
        default_factory=list,
        description="Ranked list of recommended what-if stress-test scenarios"
    )

    @computed_field
    @property
    def suggestions(self) -> List[ScenarioRecommendation]:
        """Alias property matching legacy contract."""
        return self.recommendations

    model_config = ConfigDict(use_enum_values=True)


class MetricDirection(str, Enum):
    """
    Direction of change between baseline and simulated scenario.
    """
    INCREASED = "INCREASED"
    DECREASED = "DECREASED"
    UNCHANGED = "UNCHANGED"


class MetricComparison(BaseModel):
    """
    Comparison between baseline and scenario for a single biophysical metric.
    """
    metric: str = Field(..., description="Canonical metric identifier")
    baseline: float = Field(..., description="Baseline value without scenario perturbation")
    scenario: float = Field(..., description="Simulated value under scenario perturbation")
    absolute_change: float = Field(..., description="Scenario minus baseline (delta)")
    percentage_change: Optional[float] = Field(
        default=None,
        description="Percentage change relative to baseline (None if baseline is zero)",
    )
    direction: MetricDirection = Field(..., description="Direction of change: INCREASED, DECREASED, UNCHANGED")
    interpretation: Optional[str] = Field(default=None, description="Agronomic plain-language interpretation of the shift")

    model_config = ConfigDict(use_enum_values=True)


class SimulationMetrics(BaseModel):
    """
    Biophysical simulation indicators emitted by Person 2's engine or baseline.
    All fields are optional to support partial or varying simulation outputs.
    """
    final_soil_moisture: Optional[float] = Field(default=None, description="Soil moisture % v/v at end of simulation")
    final_crop_health: Optional[float] = Field(default=None, description="Composite crop vigor / health index (0-100)")
    final_disease_risk: Optional[float] = Field(default=None, description="Disease severity or risk index (0-100)")
    water_usage: Optional[float] = Field(default=None, description="Cumulative water consumption (mm or m3)")
    expected_yield: Optional[float] = Field(default=None, description="Simulated harvest yield estimate (e.g. kg/ha)")
    canopy_cover: Optional[float] = Field(default=None, description="Canopy ground cover percentage (0-100%)")
    biomass_kg_ha: Optional[float] = Field(default=None, description="Above-ground dry biomass in kg/ha")
    root_depth_cm: Optional[float] = Field(default=None, description="Effective root zone depth in cm")

    # Extra arbitrary fields allowed for custom biophysical engine outputs
    model_config = ConfigDict(extra="allow")


class SimulationResult(BaseModel):
    """
    Input contract representing raw or structured simulation outcomes from Person 2's engine.
    """
    scenario_id: str = Field(..., description="Unique scenario run identifier")
    farm_id: Optional[str] = Field(default="farm-1", description="Target farm identifier")
    duration_days: Optional[int] = Field(default=30, ge=1, description="Simulated duration in days")
    scenario_name: Optional[str] = Field(default=None, description="Human-readable scenario title")
    scenario_type: Optional[str] = Field(default=None, description="Type of scenario evaluated")
    target_zones: List[str] = Field(default_factory=list, description="Targeted zones")
    baseline: SimulationMetrics = Field(..., description="Baseline run without perturbations")
    scenario: SimulationMetrics = Field(..., description="Simulated run under scenario perturbations")
    timeline: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Time-series simulation telemetry")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Engine version and simulation metadata")

    model_config = ConfigDict(extra="allow")


class SimulationAnalysis(BaseModel):
    """
    Comprehensive structured output from ResultAnalyzer.
    """
    scenario_id: str = Field(..., description="Referenced scenario run identifier")
    farm_id: Optional[str] = Field(default=None, description="Target farm identifier")
    impact_level: RiskLevel = Field(..., description="Overall severity of the simulated impact (HIGH, MEDIUM, LOW)")
    summary: str = Field(..., description="Concise executive summary of what occurred in the simulation")
    key_changes: List[str] = Field(default_factory=list, description="Primary measurable biophysical shifts")
    positive_impacts: List[str] = Field(default_factory=list, description="Favorable outcomes observed in the simulation")
    negative_impacts: List[str] = Field(default_factory=list, description="Adverse outcomes or vulnerabilities observed")
    tradeoffs: List[str] = Field(default_factory=list, description="Agronomic trade-offs detected between conflicting metrics")
    explanation: str = Field(..., description="Farmer-friendly comprehensive narrative explanation")
    suggested_next_action: Optional[str] = Field(default=None, description="Suggested next simulation or management action")
    metrics: List[MetricComparison] = Field(default_factory=list, description="Detailed metric-by-metric comparison")

    model_config = ConfigDict(use_enum_values=True)


class SimulationExplanation(BaseModel):
    """
    Contract for farmer-friendly narrative explanations of simulation results.
    """
    simulation_id: str = Field(..., description="Referenced simulation run identifier")
    summary: str = Field(..., description="High-level farmer-friendly plain-language executive summary")
    projected_yield_impact: Optional[str] = Field(
        default=None,
        description="Estimated yield change (e.g., '-12% yield loss in North Plot')"
    )
    key_observations: List[str] = Field(
        default_factory=list,
        description="Core agronomic insights observed during the simulated run"
    )
    farmer_recommendations: List[str] = Field(
        default_factory=list,
        description="Actionable management suggestions (e.g. adjust irrigation schedule, split nitrogen)"
    )


# --- API Request Models ---

class AnalyzeRiskRequest(BaseModel):
    """
    Payload for POST /ai/analyze-risk.
    Accepts either an explicit farm_state object, or a flat farm/zones structure.
    Optionally allows specifying model_type ('rf' or 'xgboost').
    """
    farm_state: FarmState = Field(..., description="Current telemetry and status of farm zones")
    model_type: Optional[str] = Field(
        default=None,
        description="ML model engine to use: 'rf' (Random Forest) or 'xgboost' (XGBoost). Defaults to 'rf'."
    )

    @model_validator(mode="before")
    @classmethod
    def assemble_farm_state(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "farm_state" in data and data["farm_state"]:
                return data
            # If top-level has 'zones'
            if "zones" in data:
                farm_id = data.get("farm_id")
                if not farm_id and "farm" in data and isinstance(data["farm"], dict):
                    farm_id = data["farm"].get("farm_id")
                if not farm_id:
                    farm_id = "farm-1"
                farm_state_data = {
                    "farm_id": farm_id,
                    "zones": data["zones"],
                    "metadata": data.get("metadata", {}),
                }
                return {
                    "farm_state": farm_state_data,
                    "model_type": data.get("model_type"),
                }
        return data


class SuggestScenariosRequest(BaseModel):
    """
    Payload for POST /ai/suggest-scenarios.
    Accepts either an explicit farm_state object, or a flat farm/zones structure.
    Optionally accepts a pre-computed RiskResult.
    """
    farm_state: FarmState = Field(..., description="Current telemetry and status of farm zones")
    risk_result: Optional[RiskResult] = Field(default=None, description="Optional pre-computed risk assessment")
    max_suggestions: int = Field(default=5, ge=1, le=10, description="Maximum number of scenario ideas to return")

    @model_validator(mode="before")
    @classmethod
    def assemble_farm_state(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "farm_state" in data and data["farm_state"]:
                return data
            if "zones" in data:
                farm_id = data.get("farm_id")
                if not farm_id and "farm" in data and isinstance(data["farm"], dict):
                    farm_id = data["farm"].get("farm_id")
                if not farm_id:
                    farm_id = "farm-1"
                farm_state_data = {
                    "farm_id": farm_id,
                    "zones": data["zones"],
                    "metadata": data.get("metadata", {}),
                }
                data["farm_state"] = farm_state_data
                return data
        return data


class AnalyzeSimulationRequest(BaseModel):
    """
    Payload for POST /ai/analyze-simulation.
    Accepts either an explicit simulation_result object, or a flat dictionary with baseline and scenario.
    """
    simulation_result: SimulationResult = Field(..., description="Simulation outcome comparing baseline vs scenario")

    @model_validator(mode="before")
    @classmethod
    def assemble_simulation_result(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "simulation_result" in data and isinstance(data["simulation_result"], dict):
                return data
            if "baseline" in data and "scenario" in data:
                return {"simulation_result": data}
        return data


class ScenarioComparisonItem(BaseModel):
    """
    Summary comparison for an individual scenario in a multi-scenario comparison.
    """
    scenario_id: str = Field(..., description="Scenario run identifier")
    scenario_name: Optional[str] = Field(default=None, description="Scenario title")
    impact_level: RiskLevel = Field(..., description="Impact severity")
    key_changes: List[str] = Field(default_factory=list)
    tradeoffs: List[str] = Field(default_factory=list)
    metrics: List[MetricComparison] = Field(default_factory=list)

    model_config = ConfigDict(use_enum_values=True)


class CompareSimulationsRequest(BaseModel):
    """
    Payload for POST /ai/compare-simulations.
    """
    simulations: List[SimulationResult] = Field(
        ...,
        min_length=2,
        description="List of two or more simulation results to compare"
    )


class CompareSimulationsResponse(BaseModel):
    """
    Response model for POST /ai/compare-simulations.
    """
    comparisons: List[ScenarioComparisonItem] = Field(
        default_factory=list,
        description="Side-by-side comparison items for each scenario against baseline"
    )
    explanation: str = Field(..., description="Farmer-friendly comparative analysis narrative")

    model_config = ConfigDict(use_enum_values=True)


class ExplainResultRequest(BaseModel):
    """
    Payload for POST /ai/explain-result.
    Accepts either raw simulation_output or a structured SimulationResult.
    """
    simulation_id: str = Field(..., description="Simulation run identifier")
    scenario: Optional[Scenario] = Field(default=None, description="Scenario that was executed")
    simulation_output: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Raw output data and metrics generated by Person 2's simulation engine"
    )
    simulation_result: Optional[SimulationResult] = Field(
        default=None,
        description="Structured simulation outcome comparing baseline vs scenario"
    )
    audience: str = Field(
        default="farmer",
        description="Target tone and format (e.g., 'farmer', 'agronomist', 'executive')"
    )

    @model_validator(mode="before")
    @classmethod
    def ensure_output_presence(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # If simulation_output is missing but simulation_result is present or vice-versa
            if "simulation_output" not in data and "simulation_result" in data:
                data["simulation_output"] = data["simulation_result"]
            elif "simulation_output" in data and "simulation_result" not in data:
                # Keep as is
                pass
        return data
