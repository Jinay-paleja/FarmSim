"""
Schemas for Temporal Risk Fusion and Agronomic Sensitivity Analysis.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.farm import FarmState
from app.schemas.prescriptive import AgronomicTimeSeriesFeatures, DailyTelemetry
from app.schemas.result import RiskLevel, RiskResult, ZoneRisk
from app.schemas.scenario import ScenarioType


class TemporalRiskAdjustment(BaseModel):
    """Detailed record of a risk elevation or modulation caused by time-series history."""
    zone_id: str
    target: str = Field(..., description="Target dimension: 'water_stress', 'heat_stress', etc.")
    original_level: RiskLevel
    fused_level: RiskLevel
    driving_factors: List[str] = Field(..., description="Cumulative factors causing the escalation")


class FusedZoneRisk(ZoneRisk):
    """Zone risk augmented with temporal context and time-series indicators."""
    temporal_escalated: bool = Field(default=False, description="Whether risk was elevated due to time-series history")
    temporal_notes: List[str] = Field(default_factory=list)


class TemporalRiskRequest(BaseModel):
    """Payload for POST /ai/analyze-temporal-risk."""
    farm_state: FarmState = Field(..., description="Current farm snapshot telemetry")
    history: List[DailyTelemetry] = Field(..., min_length=2, description="Sequential historical daily telemetry")
    crop: str = Field(default="Corn", description="Target crop for GDD and sensitivity indexing")
    model_type: Optional[str] = Field(default="xgboost", description="Base ML engine: 'xgboost' or 'rf'")


class TemporalRiskResponse(BaseModel):
    """Response containing fused snapshot ML and cumulative temporal risk assessment."""
    farm_id: str
    overall_risk_level: RiskLevel
    base_ml_risk_level: RiskLevel
    time_series_features: AgronomicTimeSeriesFeatures
    fused_zone_risks: List[FusedZoneRisk]
    adjustments_applied: List[TemporalRiskAdjustment]
    critical_factors: List[str]
    suggested_mitigations: List[str]
    fusion_summary: str


# --- Sensitivity Analysis Schemas ---

class SensitivityPoint(BaseModel):
    """A single evaluation point along the parameter shock curve."""
    perturbation_value: float = Field(..., description="The value of the perturbation (e.g. -30% or +4°C)")
    multiplier_or_delta: float = Field(..., description="Computed internal multiplier or delta")
    projected_yield: float = Field(..., description="Estimated absolute yield (e.g. kg/ha)")
    yield_loss_pct: float = Field(..., description="Estimated percentage drop in yield relative to baseline")
    stress_tier: RiskLevel = Field(..., description="Severity tier: LOW, MEDIUM, or HIGH")
    marginal_decay_rate: float = Field(..., description="Slope / marginal yield loss per unit perturbation")


class SensitivityAnalysisRequest(BaseModel):
    """Request payload for POST /ai/sensitivity-analysis."""
    scenario_type: ScenarioType = Field(
        default=ScenarioType.RAIN_REDUCTION,
        description="Shock type to sweep: RAIN_REDUCTION, TEMPERATURE_INCREASE, or IRRIGATION_DECREASE",
    )
    crop: str = Field(default="Corn", description="Target crop type")
    baseline_yield: float = Field(default=4500.0, ge=100.0, description="Baseline expected yield in kg/ha or tons/ha")
    current_soil_moisture: float = Field(default=22.0, ge=5.0, le=60.0, description="Current soil moisture percentage")
    steps: Optional[List[float]] = Field(
        default=None,
        description="Optional explicit sweep values (e.g. [10, 20, 30, 40, 50, 60] for % cuts)",
    )


class SensitivityAnalysisResponse(BaseModel):
    """Response containing the parameter response curve and tipping point analysis."""
    scenario_type: ScenarioType
    crop: str
    baseline_yield: float
    current_soil_moisture: float
    curve: List[SensitivityPoint]
    tipping_point_value: float = Field(..., description="Critical perturbation threshold where yield collapse accelerates")
    tipping_point_insight: str = Field(..., description="Agronomic explanation of the physiological breakdown point")
    safe_operating_limit: float = Field(..., description="Maximum perturbation the crop can withstand with negligible yield loss")
    actionable_takeaway: str = Field(..., description="Executive guidance for farmer risk management")
