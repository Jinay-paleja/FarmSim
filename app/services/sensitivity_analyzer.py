"""
Service: Agronomic Sensitivity & Tipping-Point Analyzer
Responsibility:
- Sweep environmental shocks (rainfall cut, thermal delta, irrigation cut) across a perturbation spectrum.
- Model non-linear yield decline using biophysical crop water/thermal production functions (FAO-33).
- Detect the critical inflection threshold ("Tipping Point") where crop resilience breaks and yield collapse accelerates.
- Provide safe operating limits and actionable risk management guidance.
"""

from typing import List, Optional, Tuple
import numpy as np

from app.schemas.advanced_analytics import (
    SensitivityAnalysisRequest,
    SensitivityAnalysisResponse,
    SensitivityPoint,
)
from app.schemas.result import RiskLevel
from app.schemas.scenario import ScenarioType


def compute_point_response(
    scenario_type: ScenarioType,
    val: float,
    baseline_yield: float,
    current_soil_moisture: float,
    crop: str,
) -> Tuple[float, float, RiskLevel]:
    """
    Compute estimated absolute yield, loss percentage, and stress tier for a single perturbation level.
    Uses FAO-33 water-yield response and thermal denaturation thresholds.
    """
    c_lower = crop.lower()
    # Crop yield response factor Ky
    ky = 1.25 if "corn" in c_lower or "maize" in c_lower else (1.15 if "wheat" in c_lower else 1.10)

    if scenario_type in [ScenarioType.RAIN_REDUCTION, ScenarioType.IRRIGATION_DECREASE]:
        cut_fraction = val / 100.0  # e.g. 30% -> 0.30
        multiplier = round(1.0 - cut_fraction, 2)

        # Soil moisture buffer: higher initial moisture delays onset of severe stress
        moisture_buffer = max(0.0, (current_soil_moisture - 15.0) / 25.0)  # 0.0 to 1.0

        # Sub-threshold: soil buffer cushions shock
        # Super-threshold: water drops below root tension limit, quadratic decline
        threshold = 25.0 + (moisture_buffer * 15.0)  # e.g. 32% to 40% cut is tipping point

        if val <= threshold:
            loss_pct = val * (ky * 0.45)
        else:
            base_loss = threshold * (ky * 0.45)
            excess = val - threshold
            # Accelerated collapse
            loss_pct = base_loss + (excess * (ky * 0.95)) + (0.015 * (excess ** 1.8))

        loss_pct = min(85.0, round(float(loss_pct), 2))
        projected = round(max(0.0, baseline_yield * (1.0 - loss_pct / 100.0)), 1)

    elif scenario_type in [ScenarioType.TEMPERATURE_INCREASE, ScenarioType.HEATWAVE]:
        temp_delta = val  # e.g. +3.0 C
        multiplier = temp_delta
        # Tipping point typically at +3.5C to +4.5C where pollen sterility and enzyme denaturation occur
        thermal_threshold = 3.5

        if temp_delta <= thermal_threshold:
            loss_pct = temp_delta * 3.5
        else:
            base_loss = thermal_threshold * 3.5
            excess = temp_delta - thermal_threshold
            loss_pct = base_loss + (excess * 8.5) + (0.8 * (excess ** 2.0))

        loss_pct = min(90.0, round(float(loss_pct), 2))
        projected = round(max(0.0, baseline_yield * (1.0 - loss_pct / 100.0)), 1)

    else:
        # Default proportional perturbation
        loss_pct = min(80.0, val * 0.6)
        multiplier = val
        projected = round(baseline_yield * (1.0 - loss_pct / 100.0), 1)

    # Classify stress tier
    if loss_pct >= 25.0:
        tier = RiskLevel.HIGH
    elif loss_pct >= 10.0:
        tier = RiskLevel.MEDIUM
    else:
        tier = RiskLevel.LOW

    return projected, loss_pct, tier


def analyze_sensitivity(request: SensitivityAnalysisRequest) -> SensitivityAnalysisResponse:
    """
    Execute sensitivity sweep, detect tipping point, and provide management guidance.
    """
    stype = request.scenario_type
    base_yield = request.baseline_yield
    moisture = request.current_soil_moisture
    crop = request.crop

    # Default sweep ranges if not specified
    if request.steps and len(request.steps) >= 3:
        steps = sorted(request.steps)
    else:
        if stype in [ScenarioType.TEMPERATURE_INCREASE, ScenarioType.HEATWAVE]:
            steps = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0]
        else:
            steps = [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0]

    curve: List[SensitivityPoint] = []
    prev_loss = 0.0
    prev_val = 0.0

    for idx, val in enumerate(steps):
        proj_yield, loss_pct, tier = compute_point_response(stype, val, base_yield, moisture, crop)

        if idx == 0:
            marginal_decay = round(loss_pct / max(0.1, val), 2)
        else:
            delta_val = val - prev_val
            delta_loss = loss_pct - prev_loss
            marginal_decay = round(delta_loss / max(0.1, delta_val), 2)

        curve.append(
            SensitivityPoint(
                perturbation_value=val,
                multiplier_or_delta=round(1.0 - val / 100.0, 2) if stype != ScenarioType.TEMPERATURE_INCREASE else val,
                projected_yield=proj_yield,
                yield_loss_pct=loss_pct,
                stress_tier=tier,
                marginal_decay_rate=marginal_decay,
            )
        )
        prev_loss = loss_pct
        prev_val = val

    # Detect Tipping Point: the step with maximum increase in marginal decay rate
    max_accel = -1.0
    tipping_idx = 2  # default fallback
    for i in range(1, len(curve)):
        accel = curve[i].marginal_decay_rate - curve[i - 1].marginal_decay_rate
        if accel > max_accel:
            max_accel = accel
            tipping_idx = i

    tipping_point = curve[tipping_idx].perturbation_value
    tipping_loss = curve[tipping_idx].yield_loss_pct

    # Determine safe operating limit (perturbation where loss remains <= 7.0%)
    safe_limit = steps[0]
    for pt in curve:
        if pt.yield_loss_pct <= 8.0:
            safe_limit = pt.perturbation_value
        else:
            break

    # Formulate insights
    if stype in [ScenarioType.TEMPERATURE_INCREASE, ScenarioType.HEATWAVE]:
        unit = "°C"
        insight = (
            f"Thermal tipping point identified at +{tipping_point:.1f}{unit}. Below +{tipping_point:.1f}{unit}, "
            f"canopy cooling mechanisms remain partially effective (yield loss: {tipping_loss:.1f}%). "
            f"Beyond this threshold, pollen viability declines rapidly and thermal respiration exceeds photosynthesis."
        )
        takeaway = (
            f"Safe operating limit is +{safe_limit:.1f}{unit}. Maintain misting or nocturnal irrigation if forecasts predict "
            f"ambient temperatures exceeding +{tipping_point:.1f}{unit} above seasonal averages."
        )
    else:
        unit = "%"
        insight = (
            f"Hydrological tipping point identified at -{tipping_point:.0f}{unit} reduction (current soil moisture: {moisture:.1f}%). "
            f"At this deficit, soil water tension crosses the permanent wilting boundary, causing yield loss to accelerate "
            f"from {curve[max(0, tipping_idx-1)].marginal_decay_rate:.2f}% per point to {curve[tipping_idx].marginal_decay_rate:.2f}% per point."
        )
        takeaway = (
            f"Crop buffer can safely tolerate up to -{safe_limit:.0f}{unit} reduction with minimal impact. "
            f"If precipitation deficits exceed -{tipping_point:.0f}{unit}, trigger emergency supplemental irrigation immediately."
        )

    return SensitivityAnalysisResponse(
        scenario_type=stype,
        crop=crop,
        baseline_yield=base_yield,
        current_soil_moisture=moisture,
        curve=curve,
        tipping_point_value=tipping_point,
        tipping_point_insight=insight,
        safe_operating_limit=safe_limit,
        actionable_takeaway=takeaway,
    )
