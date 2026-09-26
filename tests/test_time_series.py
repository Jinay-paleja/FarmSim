"""
Unit & Integration Tests for Agronomic Time-Series Feature Engineering.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.prescriptive import (
    DailyTelemetry,
    DroughtSeverityIndex,
    TimeSeriesFeatureRequest,
)
from app.services.time_series_features import (
    calculate_vpd,
    extract_time_series_features,
    get_crop_base_temp,
)

client = TestClient(app)


def generate_sample_history(num_days: int = 14, drought: bool = False, heatwave: bool = False) -> list:
    """Helper to generate realistic sequential telemetry."""
    history = []
    moisture = 30.0
    for day in range(1, num_days + 1):
        if heatwave and day >= 8:
            t_max = 38.0
            t_min = 26.0
        else:
            t_max = 28.0
            t_min = 16.0

        if drought and day >= 4:
            rain = 0.0
            moisture = max(8.0, moisture - 1.2)
            rh = 35.0
        else:
            rain = 5.0 if day % 3 == 0 else 0.5
            rh = 60.0

        history.append(
            DailyTelemetry(
                day_index=day,
                temperature_max=t_max,
                temperature_min=t_min,
                soil_moisture=round(moisture, 1),
                rainfall=rain,
                humidity=rh,
            )
        )
    return history


def test_crop_base_temperatures():
    """Verify crop base temperatures adhere to agronomic standards."""
    assert get_crop_base_temp("Corn") == 10.0
    assert get_crop_base_temp("Wheat") == 4.4
    assert get_crop_base_temp("Cotton") == 15.6
    assert get_crop_base_temp("UnknownCrop") == 10.0


def test_vpd_calculation():
    """Verify Vapor Pressure Deficit calculation behavior."""
    # Saturated air (100% RH) has 0 VPD
    assert calculate_vpd(temperature=25.0, humidity=100.0) == 0.0

    # Hot and dry conditions yield high atmospheric demand (VPD > 2.0 kPa)
    hot_dry_vpd = calculate_vpd(temperature=38.0, humidity=25.0)
    assert hot_dry_vpd > 3.0

    # Mild conditions
    mild_vpd = calculate_vpd(temperature=22.0, humidity=60.0)
    assert 0.8 < mild_vpd < 1.5


def test_gdd_and_heatwave_accumulation():
    """Verify Growing Degree Days and heatwave streaks."""
    history = generate_sample_history(num_days=10, heatwave=True)
    req = TimeSeriesFeatureRequest(crop="Corn", history=history)
    features = extract_time_series_features(req)

    assert features.total_days_analyzed == 10
    assert features.growing_degree_days > 0.0
    assert features.consecutive_heatwave_days == 3  # days 8, 9, 10


def test_drought_severity_detection():
    """Verify severe drought detection during prolonged dry spell with moisture decline."""
    history = generate_sample_history(num_days=14, drought=True)
    req = TimeSeriesFeatureRequest(crop="Corn", history=history)
    features = extract_time_series_features(req)

    assert features.consecutive_dry_days >= 10
    assert features.soil_moisture_trend_pct_per_day < -0.5
    assert features.drought_severity in [DroughtSeverityIndex.SEVERE, DroughtSeverityIndex.EXTREME]


def test_time_series_api_endpoint():
    """Verify POST /ai/time-series-features endpoint responds with complete features."""
    history_data = [
        {
            "day_index": i,
            "temperature_max": 30.0 + (i * 0.5),
            "temperature_min": 18.0,
            "soil_moisture": 25.0 - (i * 0.8),
            "rainfall": 0.0 if i > 2 else 4.0,
            "humidity": 45.0,
        }
        for i in range(1, 8)
    ]
    payload = {
        "crop": "Soybean",
        "history": history_data,
    }
    response = client.post("/ai/time-series-features", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_days_analyzed"] == 7
    assert "growing_degree_days" in data
    assert "mean_vpd_kpa" in data
    assert "drought_severity" in data
    assert "summary" in data
