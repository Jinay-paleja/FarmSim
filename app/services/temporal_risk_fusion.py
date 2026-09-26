"""
Service: Temporal Risk Fusion Engine
Responsibility:
- Ingest snapshot farm state and sequential daily telemetry.
- Execute base ML risk classifier (XGBoost or Random Forest) for point-in-time predictions.
- Compute cumulative agronomic time-series indicators (GDD, VPD, dry/heat runs, moisture slope).
- Fuse snapshot and temporal indicators using agronomic escalation rules.
- Produce explainable risk adjustments and actionable mitigation guidance.
"""

from typing import Any, List, Tuple
from app.schemas.advanced_analytics import (
    FusedZoneRisk,
    TemporalRiskAdjustment,
    TemporalRiskRequest,
    TemporalRiskResponse,
)
from app.schemas.prescriptive import (
    AgronomicTimeSeriesFeatures,
    DroughtSeverityIndex,
    TimeSeriesFeatureRequest,
)
from app.schemas.result import RiskLevel, RiskResult, ZoneRisk
from app.services.risk_analyzer import aggregate_farm_risk_level, analyze_risk
from app.services.time_series_features import extract_time_series_features


def to_risk_level(v: Any) -> RiskLevel:
    if isinstance(v, RiskLevel):
        return v
    return RiskLevel(str(v))


def level_str(v: Any) -> str:
    return v.value if hasattr(v, "value") else str(v)


def escalate_tier(current: Any) -> RiskLevel:
    """Escalate a risk tier by one level (LOW -> MEDIUM, MEDIUM -> HIGH)."""
    lvl = to_risk_level(current)
    if lvl == RiskLevel.LOW:
        return RiskLevel.MEDIUM
    return RiskLevel.HIGH


def fuse_temporal_risk(request: TemporalRiskRequest) -> TemporalRiskResponse:
    """
    Fuse snapshot ML predictions with sequential historical telemetry trends.
    """
    farm_state = request.farm_state
    model_type = request.model_type or "xgboost"

    # 1. Run base ML inference
    base_result: RiskResult = analyze_risk(farm_state, model_type=model_type)

    # 2. Extract temporal time-series features
    ts_req = TimeSeriesFeatureRequest(crop=request.crop, history=request.history)
    ts_features: AgronomicTimeSeriesFeatures = extract_time_series_features(ts_req)

    fused_zones: List[FusedZoneRisk] = []
    adjustments: List[TemporalRiskAdjustment] = []

    # Temporal indicator triggers
    is_severe_drought = ts_features.drought_severity in [
        DroughtSeverityIndex.SEVERE,
        DroughtSeverityIndex.EXTREME,
    ]
    is_rapid_drying = ts_features.soil_moisture_trend_pct_per_day < -0.7
    prolonged_dry_spell = ts_features.consecutive_dry_days >= 7
    severe_heat_accumulation = ts_features.consecutive_heatwave_days >= 3
    high_atmospheric_demand = ts_features.mean_vpd_kpa >= 2.3
    persistent_canopy_wetness = ts_features.rolling_7d_rainfall_total >= 30.0

    for zr in base_result.zone_risks:
        water_level = to_risk_level(zr.water_stress)
        heat_level = to_risk_level(zr.heat_stress)
        disease_level = to_risk_level(zr.disease_risk)
        nutrient_level = to_risk_level(zr.nutrient_risk)
        zone_notes: List[str] = []
        zone_escalated = False

        # --- Water Stress Modulation ---
        if (is_severe_drought or (prolonged_dry_spell and is_rapid_drying)) and water_level != RiskLevel.HIGH:
            new_water = escalate_tier(water_level)
            reasons = [
                f"{ts_features.consecutive_dry_days} consecutive rainless days",
                f"soil moisture depleting at {ts_features.soil_moisture_trend_pct_per_day:.2f}%/day",
                f"Drought Index: {ts_features.drought_severity.value}",
            ]
            adjustments.append(
                TemporalRiskAdjustment(
                    zone_id=zr.zone_id,
                    target="water_stress",
                    original_level=water_level,
                    fused_level=new_water,
                    driving_factors=reasons,
                )
            )
            zone_notes.append(f"Water stress escalated from {level_str(water_level)} to {level_str(new_water)} due to prolonged dry spell ({ts_features.consecutive_dry_days} days).")
            water_level = new_water
            zone_escalated = True

        # --- Heat Stress Modulation ---
        if (severe_heat_accumulation or high_atmospheric_demand) and heat_level != RiskLevel.HIGH:
            new_heat = escalate_tier(heat_level)
            reasons = [
                f"{ts_features.consecutive_heatwave_days} consecutive heatwave days (Tmax >= 35°C)",
                f"Atmospheric VPD demand of {ts_features.mean_vpd_kpa:.2f} kPa",
            ]
            adjustments.append(
                TemporalRiskAdjustment(
                    zone_id=zr.zone_id,
                    target="heat_stress",
                    original_level=heat_level,
                    fused_level=new_heat,
                    driving_factors=reasons,
                )
            )
            zone_notes.append(f"Heat stress escalated from {level_str(heat_level)} to {level_str(new_heat)} due to thermal accumulation and atmospheric VPD ({ts_features.mean_vpd_kpa:.2f} kPa).")
            heat_level = new_heat
            zone_escalated = True

        # --- Disease Risk Modulation ---
        if persistent_canopy_wetness and disease_level == RiskLevel.LOW:
            new_disease = RiskLevel.MEDIUM
            reasons = [
                f"{ts_features.rolling_7d_rainfall_total:.1f}mm rainfall over past 7 days keeping canopy damp"
            ]
            adjustments.append(
                TemporalRiskAdjustment(
                    zone_id=zr.zone_id,
                    target="disease_risk",
                    original_level=disease_level,
                    fused_level=new_disease,
                    driving_factors=reasons,
                )
            )
            zone_notes.append("Disease risk escalated from LOW to MEDIUM due to 7-day cumulative canopy wetness.")
            disease_level = new_disease
            zone_escalated = True

        # Re-evaluate zone overall tier
        zone_tiers = [water_level, heat_level, disease_level, nutrient_level]
        if any(t == RiskLevel.HIGH for t in zone_tiers):
            overall_zone_tier = RiskLevel.HIGH
        elif any(t == RiskLevel.MEDIUM for t in zone_tiers):
            overall_zone_tier = RiskLevel.MEDIUM
        else:
            overall_zone_tier = RiskLevel.LOW

        fused_zone = FusedZoneRisk(
            zone_id=zr.zone_id,
            risk_level=overall_zone_tier,
            water_stress=water_level,
            heat_stress=heat_level,
            disease_risk=disease_level,
            nutrient_risk=nutrient_level,
            primary_threat=zr.primary_threat,
            score=zr.score,
            contributing_factors=zr.contributing_factors,
            risk_probabilities=zr.risk_probabilities,
            temporal_escalated=zone_escalated,
            temporal_notes=zone_notes,
        )
        fused_zones.append(fused_zone)

    # Re-evaluate farm-wide risk level
    fused_farm_risk = aggregate_farm_risk_level([ZoneRisk(**fz.model_dump()) for fz in fused_zones])

    # Summary formulation
    if adjustments:
        summary_intro = (
            f"Temporal risk fusion analyzed {len(fused_zones)} zone(s) with base ML model '{model_type}'. "
            f"Evaluated {ts_features.total_days_analyzed} historical days ({ts_features.drought_severity.value} drought conditions). "
            f"Applied {len(adjustments)} risk escalation(s) based on cumulative dry-spell, thermal VPD, or moisture depletion trends."
        )
    else:
        summary_intro = (
            f"Temporal risk fusion verified {len(fused_zones)} zone(s). Historical trends align with snapshot ML predictions; "
            f"no temporal escalations were required."
        )

    return TemporalRiskResponse(
        farm_id=farm_state.farm_id,
        overall_risk_level=fused_farm_risk,
        base_ml_risk_level=base_result.overall_risk_level,
        time_series_features=ts_features,
        fused_zone_risks=fused_zones,
        adjustments_applied=adjustments,
        critical_factors=base_result.critical_factors,
        suggested_mitigations=base_result.suggested_mitigations,
        fusion_summary=summary_intro,
    )
