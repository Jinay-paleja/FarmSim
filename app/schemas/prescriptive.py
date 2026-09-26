"""
Schemas for Time-Series Feature Engineering and Prescriptive Optimization.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.farm import FarmState
from app.schemas.result import RiskLevel, RiskResult
from app.schemas.scenario import Scenario, ScenarioChanges, ScenarioType


class DroughtSeverityIndex(str, Enum):
    NORMAL = "NORMAL"
    MILD = "MILD"
    MODERATE = "MODERATE"
    SEVERE = "SEVERE"
    EXTREME = "EXTREME"


class OptimizationObjective(str, Enum):
    MAXIMIZE_YIELD = "MAXIMIZE_YIELD"
    MINIMIZE_WATER = "MINIMIZE_WATER"
    BALANCED_EFFICIENCY = "BALANCED_EFFICIENCY"
    MITIGATE_RISK = "MITIGATE_RISK"


class DailyTelemetry(BaseModel):
    """A single day's sensor reading in a time-series history."""
    day_index: int = Field(..., description="Day index (e.g. 1 for day 1, 2 for day 2, or day count)")
    temperature_max: float = Field(..., description="Daily peak temperature (°C)")
    temperature_min: float = Field(..., description="Daily minimum temperature (°C)")
    temperature_avg: Optional[float] = Field(default=None, description="Average temperature (°C)")
    soil_moisture: float = Field(..., ge=0.0, le=100.0, description="Volumetric soil moisture percentage (%)")
    rainfall: float = Field(..., ge=0.0, description="Daily precipitation (mm)")
    humidity: float = Field(..., ge=0.0, le=100.0, description="Mean relative humidity (%)")


class AgronomicTimeSeriesFeatures(BaseModel):
    """Engineered cumulative and trend features extracted from temporal telemetry."""
    total_days_analyzed: int
    growing_degree_days: float = Field(..., description="Cumulative thermal heat units (GDD)")
    consecutive_heatwave_days: int = Field(..., description="Longest or current streak of days with Tmax >= 35°C")
    consecutive_dry_days: int = Field(..., description="Longest or current streak of days with rainfall < 1.0mm")
    rolling_7d_rainfall_total: float = Field(..., description="Total rainfall over the past 7 days (mm)")
    rolling_14d_rainfall_total: float = Field(..., description="Total rainfall over the past 14 days (mm)")
    rolling_7d_avg_temp: float = Field(..., description="Mean temperature over the past 7 days (°C)")
    soil_moisture_trend_pct_per_day: float = Field(..., description="Daily rate of soil moisture change (%/day)")
    mean_vpd_kpa: float = Field(..., description="Mean Vapor Pressure Deficit in kilopascals (kPa)")
    drought_severity: DroughtSeverityIndex = Field(..., description="Temporal drought risk categorization")
    summary: str = Field(..., description="Agronomic summary of temporal trends")


class TimeSeriesFeatureRequest(BaseModel):
    """Request payload for extracting time-series agronomic features."""
    crop: str = Field(default="Corn", description="Target crop type for base temperature selection")
    base_temperature: Optional[float] = Field(default=None, description="Custom base temperature for GDD")
    history: List[DailyTelemetry] = Field(..., min_length=2, description="At least 2 days of sequential telemetry")


class PrescriptiveConstraints(BaseModel):
    """Operational constraints for prescriptive intervention optimization."""
    max_irrigation_increase_pct: float = Field(default=40.0, ge=0.0, le=100.0)
    max_fertilizer_increase_pct: float = Field(default=25.0, ge=0.0, le=50.0)
    max_water_cut_pct: float = Field(default=40.0, ge=0.0, le=80.0)
    target_zones: List[str] = Field(default_factory=list)


class PrescriptionOption(BaseModel):
    """A distinct optimized intervention strategy along the trade-off frontier."""
    tier: str = Field(..., description="'conservative', 'balanced', or 'aggressive'")
    name: str = Field(..., description="Descriptive title of the intervention plan")
    strategy_summary: str = Field(..., description="Plain-language agronomic rationale")
    scenario: Scenario = Field(..., description="Executable Scenario contract ready for simulation engine")
    projected_yield_impact_pct: float = Field(..., description="Estimated percentage change in final yield")
    projected_water_usage_change_pct: float = Field(..., description="Estimated percentage change in water consumption")
    efficiency_score: float = Field(..., description="Normalized efficiency / ROI score (0.0 to 1.0)")
    action_schedule: List[str] = Field(..., description="Step-by-step instructions for the farmer")


class PrescribeInterventionRequest(BaseModel):
    """Request payload for prescriptive optimization."""
    farm_state: FarmState = Field(..., description="Current farm snapshot")
    risk_result: Optional[RiskResult] = Field(default=None, description="Optional pre-computed risk profile")
    objective: OptimizationObjective = Field(
        default=OptimizationObjective.BALANCED_EFFICIENCY,
        description="Farmer's primary management goal",
    )
    constraints: Optional[PrescriptiveConstraints] = Field(
        default_factory=PrescriptiveConstraints,
        description="Operational boundaries",
    )
    duration_days: int = Field(default=30, ge=7, le=90, description="Planning horizon in days")


class PrescribeInterventionResponse(BaseModel):
    """Response containing the single most optimal prescriptive intervention plan."""
    objective: OptimizationObjective
    optimal_plan: PrescriptionOption = Field(..., description="The single mathematically most optimal management plan")
    primary_recommendation: Optional[PrescriptionOption] = Field(
        default=None,
        description="Alias for optimal_plan for seamless backwards compatibility",
    )
    alternative_options: List[PrescriptionOption] = Field(
        default_factory=list,
        description="Secondary options if explicitly requested; empty by default to provide only the single optimal plan",
    )
    agronomic_rationale: str
    checklist: List[str]
