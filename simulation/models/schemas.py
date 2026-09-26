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
    scenario_id: str
    name: str
    duration_days: int = Field(gt=0)

    changes: Dict[str, Union[float, int, bool, str]] = {}


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