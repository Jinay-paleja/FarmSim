from typing import Dict, List, Union

from pydantic import BaseModel, Field


class Zone(BaseModel):
    zone_id: str
    crop: str
    area_acres: float = Field(gt=0)

    soil: str
    growth_stage: str

    irrigation: float = Field(ge=0)

    soil_moisture: float = Field(ge=0, le=100)

    temperature: float
    humidity: float = Field(ge=0, le=100)
    rainfall: float = Field(ge=0)

    nitrogen: float = Field(ge=0, le=100)
    phosphorus: float = Field(ge=0, le=100)
    potassium: float = Field(ge=0, le=100)


class Farm(BaseModel):
    farm_id: str
    area_acres: float = Field(gt=0)
    zones: List[Zone]


class Scenario(BaseModel):
    """
    Unified scenario contract shared by the AI/Decision Engine
    and the Farm Simulation Engine.

    A scenario can be created through:
    - Manual simulation controls
    - AI scenario suggestions
    - Natural-language scenario parsing

    All paths produce this same structure.
    """

    # Optional compatibility fields.
    # AI-generated scenarios can omit these.
    scenario_id: str = "SCN001"
    name: str = "Custom Scenario"

    # Unified AI scenario type.
    scenario_type: str = "CUSTOM"

    duration_days: int = Field(gt=0)

    # Empty list means the scenario applies to all zones.
    # Otherwise, only the listed zone IDs are affected.
    target_zones: List[str] = Field(
        default_factory=list
    )

    # Supported values include numeric modifiers,
    # booleans such as spread=True, and custom string values.
    changes: Dict[
        str,
        Union[float, int, bool, str],
    ] = Field(
        default_factory=dict
    )


class ZoneSimulationResult(BaseModel):
    zone_id: str
    soil_moisture: float
    crop_health: float
    disease_risk: float
    water_usage: float
    expected_yield: float


class FarmSummary(BaseModel):
    average_crop_health: float
    average_disease_risk: float
    total_water_usage: float
    expected_yield: float


class TimelinePoint(BaseModel):
    day: int
    zones: List[ZoneSimulationResult]
    farm_summary: FarmSummary


class SimulationResult(BaseModel):
    farm_id: str
    scenario_id: str
    timeline: List[TimelinePoint]
