"""Canonical JSON contracts shared by the frontend, AI, and simulation layers.

The public API emits snake_case field names. Input models accept the legacy
camelCase names used by the existing React app while the frontend integration
adapter converts responses back to its view-model shape.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator


class ContractModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class FarmCreate(ContractModel):
    name: str = Field(min_length=1, max_length=120)
    location: str = Field(min_length=1, max_length=160)
    area_acres: float = Field(gt=0, le=100_000, validation_alias=AliasChoices("area_acres", "area"))
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    number_of_zones: int = Field(
        default=1, ge=1, le=50, validation_alias=AliasChoices("number_of_zones", "numberOfZones")
    )
    owner_id: str | None = Field(default=None, validation_alias=AliasChoices("owner_id", "ownerId"))

    @field_validator("name", "location")
    @classmethod
    def non_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


class FarmUpdate(ContractModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    location: str | None = Field(default=None, min_length=1, max_length=160)
    area_acres: float | None = Field(
        default=None, gt=0, le=100_000, validation_alias=AliasChoices("area_acres", "area")
    )
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    owner_id: str | None = Field(default=None, validation_alias=AliasChoices("owner_id", "ownerId"))


class UserCreate(ContractModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=6, max_length=120)
    location: str | None = Field(default=None, max_length=160)
    specialty: str | None = Field(default=None, max_length=160)


class UserLogin(ContractModel):
    email: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=6, max_length=120)


class User(ContractModel):
    user_id: str = Field(validation_alias=AliasChoices("user_id", "id"))
    name: str
    email: str
    password_hash: str | None = None
    location: str | None = "Custom Farm Region"
    specialty: str | None = "General Agriculture"
    joined_at: str | None = None
    acres_managed: float = 0.0


class UserProfile(ContractModel):
    """Safe user representation returned to the browser."""

    user_id: str = Field(validation_alias=AliasChoices("user_id", "id"))
    name: str
    email: str
    location: str | None = "Custom Farm Region"
    specialty: str | None = "General Agriculture"
    joined_at: str | None = None
    acres_managed: float = 0.0
    # Returned only after a successful registration or sign-in. It is never
    # persisted in the Firestore user document.
    session_token: str | None = None
    # Firebase custom token allowing the browser to sign in with Firebase Auth
    # so it can read/write Firestore directly with per-user security rules.
    firebase_token: str | None = None


class ZoneInput(ContractModel):
    name: str = Field(min_length=1, max_length=120)
    area_acres: float = Field(gt=0, le=100_000, validation_alias=AliasChoices("area_acres", "area"))
    crop: str = Field(min_length=1, max_length=80)
    soil: str = Field(min_length=1, max_length=80, validation_alias=AliasChoices("soil", "soilType"))
    growth_stage: str = Field(
        min_length=1, max_length=80, validation_alias=AliasChoices("growth_stage", "growthStage")
    )
    irrigation: str = Field(
        min_length=1, max_length=80, validation_alias=AliasChoices("irrigation", "irrigationMethod")
    )
    soil_moisture: float = Field(ge=0, le=100, validation_alias=AliasChoices("soil_moisture", "soilMoisture"))
    temperature: float = Field(ge=-40, le=70)
    humidity: float = Field(ge=0, le=100)
    rainfall: float = Field(ge=0, le=10_000)
    nitrogen: float = Field(ge=0, le=100, validation_alias=AliasChoices("nitrogen", "nitrogen"))
    phosphorus: float = Field(ge=0, le=100)
    potassium: float = Field(ge=0, le=100)

    @field_validator("name", "crop", "soil", "growth_stage", "irrigation")
    @classmethod
    def zone_text_is_non_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


class ZoneUpdate(ContractModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    area_acres: float | None = Field(
        default=None, gt=0, le=100_000, validation_alias=AliasChoices("area_acres", "area")
    )
    crop: str | None = Field(default=None, min_length=1, max_length=80)
    soil: str | None = Field(default=None, min_length=1, max_length=80, validation_alias=AliasChoices("soil", "soilType"))
    growth_stage: str | None = Field(
        default=None, min_length=1, max_length=80, validation_alias=AliasChoices("growth_stage", "growthStage")
    )
    irrigation: str | None = Field(
        default=None, min_length=1, max_length=80, validation_alias=AliasChoices("irrigation", "irrigationMethod")
    )
    soil_moisture: float | None = Field(
        default=None, ge=0, le=100, validation_alias=AliasChoices("soil_moisture", "soilMoisture")
    )
    temperature: float | None = Field(default=None, ge=-40, le=70)
    humidity: float | None = Field(default=None, ge=0, le=100)
    rainfall: float | None = Field(default=None, ge=0, le=10_000)
    nitrogen: float | None = Field(default=None, ge=0, le=100)
    phosphorus: float | None = Field(default=None, ge=0, le=100)
    potassium: float | None = Field(default=None, ge=0, le=100)


class Zone(ZoneInput):
    zone_id: str
    farm_id: str
    health_score: float | None = None
    disease_risk: float | None = None


class Farm(ContractModel):
    farm_id: str
    owner_id: str | None = Field(default=None, validation_alias=AliasChoices("owner_id", "ownerId"))
    name: str
    location: str
    area_acres: float
    latitude: float | None = None
    longitude: float | None = None
    number_of_zones: int = 1
    zones: list[Zone] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ScenarioChange(ContractModel):
    type: str = Field(min_length=1, max_length=100)
    parameter: str = Field(min_length=1, max_length=100)
    value: float
    unit: str = Field(default="%", max_length=30)


class ScenarioCreate(ContractModel):
    farm_id: str = Field(min_length=1, validation_alias=AliasChoices("farm_id", "farmId"))
    name: str = Field(min_length=1, max_length=120)
    duration_days: int = Field(ge=1, le=365, validation_alias=AliasChoices("duration_days", "duration"))
    target_zones: list[str] = Field(
        default_factory=list, validation_alias=AliasChoices("target_zones", "affectedZones")
    )
    # A JSON object is canonical. A list is accepted to keep the existing UI
    # compatible while it moves through the API adapter.
    changes: dict[str, float] | list[ScenarioChange] = Field(default_factory=dict)
    scenario_type: str = Field(
        default="CUSTOM", min_length=1, max_length=80, validation_alias=AliasChoices("scenario_type", "scenarioType")
    )
    natural_language_query: str | None = Field(
        default=None, validation_alias=AliasChoices("natural_language_query", "naturalLanguageQuery")
    )
    description: str | None = Field(default=None, max_length=500)


class Scenario(ContractModel):
    scenario_id: str
    farm_id: str
    name: str
    duration_days: int
    target_zones: list[str]
    changes: dict[str, float]
    scenario_type: str = "CUSTOM"
    natural_language_query: str | None = None
    description: str | None = None
    created_at: datetime | None = None


class SimulationRequest(ContractModel):
    farm_id: str = Field(min_length=1, validation_alias=AliasChoices("farm_id", "farmId"))
    scenario_id: str | None = Field(default=None, validation_alias=AliasChoices("scenario_id", "scenarioId"))


class ZoneTimeline(ContractModel):
    zone_id: str
    zone_name: str
    soil_moisture: float
    crop_health: float
    disease_risk: float
    water_consumption: float
    expected_yield: float


class TimelinePoint(ContractModel):
    day: int
    label: str
    soil_moisture: float
    crop_health: float
    disease_risk: float
    water_consumption: float
    expected_yield: float
    zones: list[ZoneTimeline] = Field(default_factory=list)


class SimulationSummary(ContractModel):
    total_water_usage: float
    average_crop_health: float
    average_disease_risk: float
    total_expected_yield: float
    average_soil_moisture: float


class SimulationResult(ContractModel):
    simulation_id: str
    farm_id: str
    scenario_id: str | None = None
    scenario_name: str = "Baseline"
    scenario_type: str = "BASELINE"
    duration_days: int = Field(ge=1, le=365)
    farm_area_acres: float = Field(gt=0)
    timeline: list[TimelinePoint]
    summary: SimulationSummary
    baseline_timeline: list[TimelinePoint] = Field(default_factory=list)
    baseline_summary: SimulationSummary | None = None
    ai_explanation: str
    status: Literal["completed", "failed"] = "completed"
    created_at: datetime | None = None


class CompareRequest(ContractModel):
    simulation_ids: list[str] = Field(min_length=2, max_length=8, validation_alias=AliasChoices("simulation_ids", "simulationIds"))


class ComparisonSimulation(ContractModel):
    simulation_id: str
    scenario_name: str
    summary: SimulationSummary


class ComparisonTimelinePoint(ContractModel):
    day: int
    label: str
    simulations: list[dict[str, Any]]


class ComparisonResult(ContractModel):
    simulations: list[ComparisonSimulation]
    timeline: list[ComparisonTimelinePoint]
    ai_explanation: str


class ParseScenarioRequest(ContractModel):
    text: str = Field(min_length=3, max_length=2_000, validation_alias=AliasChoices("text", "query", "naturalLanguageQuery"))
    farm_id: str | None = Field(default=None, validation_alias=AliasChoices("farm_id", "farmId"))


class SuggestScenariosRequest(ContractModel):
    farm_id: str = Field(min_length=1, validation_alias=AliasChoices("farm_id", "farmId"))
    risk_assessment: "FarmRiskAssessment | None" = Field(
        default=None, validation_alias=AliasChoices("risk_assessment", "riskAssessment")
    )


class AnalyzeRiskRequest(ContractModel):
    farm_id: str = Field(min_length=1, validation_alias=AliasChoices("farm_id", "farmId"))


RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]


class RiskPrediction(ContractModel):
    level: RiskLevel
    score: float = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=1)


class RiskFactor(ContractModel):
    field: str
    value: float | str
    contribution: float = Field(ge=0, le=100)
    message: str


class ZoneRiskAssessment(ContractModel):
    zone_id: str
    zone_name: str
    water_stress: RiskPrediction
    heat_stress: RiskPrediction
    disease_risk: RiskPrediction
    nutrient_risk: RiskPrediction
    top_contributing_factors: list[RiskFactor] = Field(min_length=1, max_length=5)


class FarmRiskAssessment(ContractModel):
    farm_id: str
    overall_risk: RiskLevel
    zone_risks: list[ZoneRiskAssessment] = Field(min_length=1)
    model_version: str
    assessed_at: datetime | None = None


class ScenarioSuggestion(ContractModel):
    suggestion_id: str
    title: str
    description: str
    priority: RiskLevel
    scenario_type: str
    duration_days: int = Field(ge=1, le=365)
    target_zones: list[str]
    changes: dict[str, float]


class ExplainResultRequest(ContractModel):
    simulation_id: str | None = Field(default=None, min_length=1, validation_alias=AliasChoices("simulation_id", "simulationId"))
    scenario_type: str | None = None
    duration_days: int | None = Field(default=None, ge=1, le=365)
    baseline_metrics: "ResultMetrics | None" = None
    projected_metrics: "ResultMetrics | None" = None

    @model_validator(mode="after")
    def source_is_present(self) -> "ExplainResultRequest":
        has_raw_metrics = self.baseline_metrics is not None and self.projected_metrics is not None
        if not self.simulation_id and not has_raw_metrics:
            raise ValueError("Provide simulation_id or both baseline_metrics and projected_metrics")
        return self


class ResultMetrics(ContractModel):
    yield_tons_per_ha: float = Field(ge=0)
    water_usage_liters: float = Field(ge=0)
    soil_health_index: float = Field(ge=0, le=100)


class MetricImpact(ContractModel):
    absolute_change: float
    percentage_change: float
    direction: Literal["INCREASED", "DECREASED", "UNCHANGED"]
    impact_level: Literal["SEVERE", "MODERATE", "NEGLIGIBLE"]


class ExplanationResponse(ContractModel):
    summary: str
    yield_impact: MetricImpact
    water_usage_impact: MetricImpact
    soil_health_impact: MetricImpact
    trade_offs_detected: list[str]
    recommendations: list[str]
    # Kept during frontend migration; it is identical to `summary`.
    explanation: str
    source: Literal["ai", "local_agronomy"]
