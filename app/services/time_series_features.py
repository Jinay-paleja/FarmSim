"""
Service: Agronomic Time-Series Feature Engineering
Responsibility:
- Ingest sequential historical weather and soil sensor telemetry.
- Compute agronomic indicators:
  * Growing Degree Days (GDD)
  * Consecutive heatwave and dry-spell runs
  * Rolling window aggregations (7d and 14d rainfall, 7d temperature)
  * Soil moisture depletion trend (%/day)
  * Vapor Pressure Deficit (VPD in kPa)
  * Drought Severity Categorization
"""

import math
from typing import List, Optional
import numpy as np

from app.schemas.prescriptive import (
    AgronomicTimeSeriesFeatures,
    DailyTelemetry,
    DroughtSeverityIndex,
    TimeSeriesFeatureRequest,
)

CROP_BASE_TEMPERATURES = {
    "corn": 10.0,
    "maize": 10.0,
    "wheat": 4.4,
    "soybean": 10.0,
    "rice": 10.0,
    "cotton": 15.6,
    "potato": 7.0,
    "tomato": 10.0,
}


def get_crop_base_temp(crop_name: str) -> float:
    """Retrieve agronomic base temperature for GDD calculation."""
    return CROP_BASE_TEMPERATURES.get(crop_name.lower().strip(), 10.0)


def calculate_vpd(temperature: float, humidity: float) -> float:
    """
    Compute Vapor Pressure Deficit (VPD) in kPa using Tetens saturation vapor pressure formula.
    VPD = es(T) * (1 - RH / 100)
    where es(T) = 0.61078 * exp( (17.27 * T) / (T + 237.3) )
    """
    sat_vp = 0.61078 * math.exp((17.27 * temperature) / (temperature + 237.3))
    rh_fraction = max(0.0, min(100.0, humidity)) / 100.0
    vpd = sat_vp * (1.0 - rh_fraction)
    return max(0.0, vpd)


def extract_time_series_features(request: TimeSeriesFeatureRequest) -> AgronomicTimeSeriesFeatures:
    """
    Extract cumulative and trend agronomic features from daily telemetry history.
    """
    history = request.history
    if len(history) < 2:
        raise ValueError("At least 2 days of sequential telemetry are required for time-series feature extraction.")

    base_t = request.base_temperature or get_crop_base_temp(request.crop)

    # 1. Growing Degree Days (GDD)
    gdd_total = 0.0
    daily_avg_temps = []
    daily_vpds = []

    for d in history:
        t_avg = d.temperature_avg if d.temperature_avg is not None else (d.temperature_max + d.temperature_min) / 2.0
        daily_avg_temps.append(t_avg)
        daily_gdd = max(0.0, t_avg - base_t)
        gdd_total += daily_gdd

        vpd = calculate_vpd(t_avg, d.humidity)
        daily_vpds.append(vpd)

    # 2. Consecutive heatwave days (Tmax >= 35.0 C)
    heatwave_streaks = []
    current_heat = 0
    for d in history:
        if d.temperature_max >= 35.0:
            current_heat += 1
        else:
            if current_heat > 0:
                heatwave_streaks.append(current_heat)
            current_heat = 0
    if current_heat > 0:
        heatwave_streaks.append(current_heat)
    max_heatwave_days = max(heatwave_streaks) if heatwave_streaks else 0

    # 3. Consecutive dry days (Rainfall < 1.0 mm)
    dry_streaks = []
    current_dry = 0
    for d in history:
        if d.rainfall < 1.0:
            current_dry += 1
        else:
            if current_dry > 0:
                dry_streaks.append(current_dry)
            current_dry = 0
    if current_dry > 0:
        dry_streaks.append(current_dry)
    max_dry_days = max(dry_streaks) if dry_streaks else 0

    # 4. Rolling rainfall totals
    last_7_days = history[-7:]
    last_14_days = history[-14:]
    rolling_7d_rainfall = sum(d.rainfall for d in last_7_days)
    rolling_14d_rainfall = sum(d.rainfall for d in last_14_days)

    # 5. Rolling average temperature over last 7 days
    rolling_7d_temps = daily_avg_temps[-7:]
    rolling_7d_avg_temp = sum(rolling_7d_temps) / len(rolling_7d_temps)

    # 6. Soil moisture depletion rate (%/day) via linear regression slope
    days_x = np.arange(len(history))
    moistures_y = np.array([d.soil_moisture for d in history])
    if len(days_x) >= 2:
        slope, _ = np.polyfit(days_x, moistures_y, 1)
        soil_moisture_trend = round(float(slope), 2)
    else:
        soil_moisture_trend = 0.0

    # 7. Mean VPD
    mean_vpd = round(float(sum(daily_vpds) / len(daily_vpds)), 2)

    # 8. Drought severity categorization
    latest_moisture = history[-1].soil_moisture
    if max_dry_days >= 14 and soil_moisture_trend < -0.8 and latest_moisture < 16.0:
        drought_cat = DroughtSeverityIndex.EXTREME
    elif max_dry_days >= 10 and latest_moisture < 20.0:
        drought_cat = DroughtSeverityIndex.SEVERE
    elif max_dry_days >= 7 and rolling_7d_rainfall < 5.0:
        drought_cat = DroughtSeverityIndex.MODERATE
    elif max_dry_days >= 4:
        drought_cat = DroughtSeverityIndex.MILD
    else:
        drought_cat = DroughtSeverityIndex.NORMAL

    # Formulate plain-English summary
    summary_parts = [
        f"Analyzed {len(history)} consecutive days for {request.crop} (Base Temp: {base_t}°C).",
        f"Accumulated GDD: {gdd_total:.1f} heat units.",
        f"Rainfall: {rolling_7d_rainfall:.1f}mm in last 7 days ({max_dry_days} consecutive dry days).",
        f"Soil moisture drift: {soil_moisture_trend:+.2f}%/day (Current: {latest_moisture:.1f}%).",
        f"Atmospheric demand: Mean VPD of {mean_vpd:.2f} kPa.",
    ]

    return AgronomicTimeSeriesFeatures(
        total_days_analyzed=len(history),
        growing_degree_days=round(gdd_total, 1),
        consecutive_heatwave_days=max_heatwave_days,
        consecutive_dry_days=max_dry_days,
        rolling_7d_rainfall_total=round(rolling_7d_rainfall, 1),
        rolling_14d_rainfall_total=round(rolling_14d_rainfall, 1),
        rolling_7d_avg_temp=round(rolling_7d_avg_temp, 1),
        soil_moisture_trend_pct_per_day=soil_moisture_trend,
        mean_vpd_kpa=mean_vpd,
        drought_severity=drought_cat,
        summary=" ".join(summary_parts),
    )
