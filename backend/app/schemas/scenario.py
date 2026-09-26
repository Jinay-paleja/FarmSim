from enum import Enum
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ScenarioType(str, Enum):
    """
    Standard agricultural scenario types recognized by the simulator.
    """
    RAIN_REDUCTION = "RAIN_REDUCTION"
    RAIN_INCREASE = "RAIN_INCREASE"
    TEMPERATURE_INCREASE = "TEMPERATURE_INCREASE"
    HEATWAVE = "HEATWAVE"
    IRRIGATION_INCREASE = "IRRIGATION_INCREASE"
    IRRIGATION_DECREASE = "IRRIGATION_DECREASE"
    IRRIGATION_FAILURE = "IRRIGATION_FAILURE"
    FERTILIZER_CHANGE = "FERTILIZER_CHANGE"
    NUTRIENT_DEFICIENCY = "NUTRIENT_DEFICIENCY"
    DISEASE_OUTBREAK = "DISEASE_OUTBREAK"
    PEST_OUTBREAK = "PEST_OUTBREAK"
    SOIL_MOISTURE_CHANGE = "SOIL_MOISTURE_CHANGE"
    COMBINED = "COMBINED"


class ScenarioChanges(BaseModel):
    """
    Parameter modifications to apply during a scenario.
    Provides structured attributes for common agricultural perturbations,
    while allowing arbitrary extra parameters for future extensibility.
    """
    rainfall_multiplier: Optional[float] = Field(
        default=None,
        description="Multiplier for baseline rainfall (e.g., 0.5 = 50% reduction, 1.3 = 30% increase)"
    )
    temperature_delta: Optional[float] = Field(
        default=None,
        description="Additive change in temperature in degrees Celsius (e.g., +4.0 or -2.5)"
    )
    irrigation_multiplier: Optional[float] = Field(
        default=None,
        description="Multiplier for baseline irrigation rate (e.g., 0.0 for pump failure, 1.25 for +25%)"
    )
    fertilizer_multiplier: Optional[float] = Field(
        default=None,
        description="Multiplier for baseline fertilizer input (e.g., 0.8 = 20% cut)"
    )
    disease_pressure: Optional[float] = Field(
        default=None,
        description="Disease severity/pressure rating or multiplier (e.g., 0.0 to 1.0 or delta factor)"
    )
    pest_pressure: Optional[float] = Field(
        default=None,
        description="Pest infestation severity/pressure rating or multiplier"
    )
    soil_moisture_delta: Optional[float] = Field(
        default=None,
        description="Direct change in soil moisture percentage (e.g., -15.0%)"
    )

    model_config = ConfigDict(extra="allow")


class Scenario(BaseModel):
    """
    Canonical Scenario contract consumed by the simulation engine and downstream services.
    """
    scenario_type: ScenarioType = Field(
        ...,
        description="Classification of the scenario shock or intervention"
    )
    name: str = Field(
        ...,
        min_length=1,
        description="Human-readable title or label for the scenario"
    )
    description: Optional[str] = Field(
        default=None,
        description="Optional detailed description or source query"
    )
    duration_days: Optional[int] = Field(
        default=None,
        ge=1,
        description="Duration of the scenario perturbation in days"
    )
    target_zones: List[str] = Field(
        default_factory=list,
        description="List of Zone IDs targeted by this scenario (empty list implies entire farm)"
    )
    changes: ScenarioChanges = Field(
        default_factory=ScenarioChanges,
        description="Flexible environmental and operational changes applied in this scenario"
    )

    model_config = ConfigDict(
        use_enum_values=True,
        json_schema_extra={
            "example": {
                "scenario_type": "HEATWAVE",
                "name": "Mid-season Heatwave Shock",
                "duration_days": 7,
                "target_zones": ["zone-north-1"],
                "changes": {
                    "temperature_delta": 4.5,
                    "rainfall_multiplier": 0.2,
                    "soil_moisture_delta": -12.0
                }
            }
        }
    )


class ParseScenarioRequest(BaseModel):
    """
    Request model for parsing a natural language farmer inquiry into a structured scenario intent.
    """
    query: str = Field(
        ...,
        description="Farmer's natural-language scenario description (e.g., 'What if we have 2 weeks of drought and heat?')"
    )
    farm_id: Optional[str] = Field(
        default=None,
        description="Optional farm ID to provide context for target zones and crop sensitivity"
    )
    use_llm: bool = Field(
        default=False,
        description="Whether to parse using advanced LLM reasoning (requires GEMINI_API_KEY)"
    )


class TopPrediction(BaseModel):
    """
    Candidate scenario type classification with associated probability score.
    """
    scenario_type: ScenarioType
    confidence: float = Field(..., ge=0.0, le=1.0)


class ParseScenarioResponse(BaseModel):
    """
    Response model for farmer scenario intent classification and parameter extraction.
    """
    engine: Optional[str] = Field(
        default="local_ml",
        description="Engine used for parsing: 'local_ml' (TF-IDF + LogReg + Regex) or 'gemini_llm'"
    )
    scenario_type: Optional[ScenarioType] = Field(
        default=None,
        description="Classified ScenarioType, or null if confidence is below threshold"
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score between 0.0 and 1.0"
    )
    needs_clarification: bool = Field(
        default=False,
        description="Flag indicating if the query is ambiguous, low-confidence, or requires user clarification"
    )
    missing_parameters: Optional[List[str]] = Field(
        default=None,
        description="List of required parameters that were missing from the farmer inquiry"
    )
    scenario: Optional[Scenario] = Field(
        default=None,
        description="Complete, validated Scenario object if parameters were successfully extracted"
    )
    top_predictions: Optional[List[TopPrediction]] = Field(
        default=None,
        description="Top candidate classifications and probability distribution"
    )

    model_config = ConfigDict(
        use_enum_values=True,
        json_schema_extra={
            "example": {
                "scenario_type": "RAIN_REDUCTION",
                "confidence": 0.89,
                "needs_clarification": False,
                "missing_parameters": [],
                "scenario": {
                    "scenario_type": "RAIN_REDUCTION",
                    "name": "Rainfall Reduction",
                    "duration_days": 45,
                    "target_zones": [],
                    "changes": {
                        "rainfall_multiplier": 0.70
                    }
                },
                "top_predictions": [
                    {"scenario_type": "RAIN_REDUCTION", "confidence": 0.89},
                    {"scenario_type": "COMBINED", "confidence": 0.04},
                    {"scenario_type": "HEATWAVE", "confidence": 0.02}
                ]
            }
        }
    )


