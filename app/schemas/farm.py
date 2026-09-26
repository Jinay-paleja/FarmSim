from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class Zone(BaseModel):
    """
    State and physical properties of an agricultural management zone.
    """
    zone_id: str = Field(..., description="Unique identifier for the zone")
    name: str = Field(..., description="Human-readable zone name (e.g., 'North Plot A')")
    area_acres: float = Field(..., gt=0, description="Zone surface area in acres")
    crop: str = Field(..., description="Current crop planted (e.g., 'Corn', 'Soybean', 'Wheat')")
    soil: str = Field(..., description="Soil classification or texture (e.g., 'Clay Loam', 'Sandy Loam')")
    growth_stage: str = Field(..., description="Current vegetative or reproductive stage (e.g., 'Vegetative', 'Flowering', 'Maturity')")
    irrigation: str = Field(..., description="Irrigation method or status (e.g., 'Drip', 'Center Pivot', 'Rainfed', 'Furrow')")
    soil_moisture: float = Field(..., description="Current volumetric soil moisture percentage (% v/v)")
    temperature: float = Field(..., description="Ambient temperature in degrees Celsius")
    humidity: float = Field(..., description="Relative humidity percentage (0-100%)")
    rainfall: float = Field(..., ge=0, description="Recent precipitation in mm")
    nitrogen: float = Field(..., ge=0, description="Available soil Nitrogen (N) in mg/kg or ppm")
    phosphorus: float = Field(..., ge=0, description="Available soil Phosphorus (P) in mg/kg or ppm")
    potassium: float = Field(..., ge=0, description="Available soil Potassium (K) in mg/kg or ppm")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "zone_id": "zone-1",
                "name": "North Field",
                "area_acres": 25.5,
                "crop": "Corn",
                "soil": "Silt Loam",
                "growth_stage": "Vegetative (V6)",
                "irrigation": "Drip",
                "soil_moisture": 28.4,
                "temperature": 27.2,
                "humidity": 65.0,
                "rainfall": 2.1,
                "nitrogen": 45.0,
                "phosphorus": 22.0,
                "potassium": 160.0
            }
        }
    )


class FarmState(BaseModel):
    """
    Current snapshot of the entire farm received by the AI module
    for risk analysis and scenario recommendations.
    """
    farm_id: str = Field(..., description="Unique identifier for the farm")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp of the snapshot (UTC)"
    )
    zones: List[Zone] = Field(
        ...,
        min_length=1,
        description="List of active management zones and their current sensor/state readings"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Optional additional telemetry or external weather forecasts"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "farm_id": "farm-42",
                "timestamp": "2026-09-25T12:00:00Z",
                "zones": [
                    {
                        "zone_id": "zone-1",
                        "name": "North Field",
                        "area_acres": 25.5,
                        "crop": "Corn",
                        "soil": "Silt Loam",
                        "growth_stage": "Vegetative (V6)",
                        "irrigation": "Drip",
                        "soil_moisture": 28.4,
                        "temperature": 27.2,
                        "humidity": 65.0,
                        "rainfall": 2.1,
                        "nitrogen": 45.0,
                        "phosphorus": 22.0,
                        "potassium": 160.0
                    }
                ],
                "metadata": {
                    "elevation_m": 210,
                    "region": "Midwest"
                }
            }
        }
    )


class Farm(BaseModel):
    """
    Farm entity profile containing static metadata and configured zones.
    """
    farm_id: str = Field(..., description="Unique identifier for the farm")
    name: str = Field(..., description="Display name of the farm")
    location: Optional[str] = Field(default=None, description="Geographic location or postal code")
    total_acres: Optional[float] = Field(default=None, gt=0, description="Total acreage across all plots")
    zones: List[Zone] = Field(default_factory=list, description="Registered farm zones")
