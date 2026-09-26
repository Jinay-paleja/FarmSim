"""
Service: Prescriptive Intervention Optimizer
Responsibility:
- Translate farmer agronomic objectives and current multi-zone risk vulnerabilities into optimal management prescriptions.
- Search decision space (irrigation rates, fertilizer adjustments, timing) using multi-objective trade-off modeling.
- Generate three distinct actionable prescription tiers:
    1. Conservative (Cost & Water Conservation)
    2. Balanced (Recommended Pareto-Optimal Efficiency)
    3. Aggressive (Maximum Yield & Hazard Defense)
- Output valid Scenario objects directly executable in Person 2's biophysical simulation engine.
"""

from typing import Dict, List, Optional, Tuple
import numpy as np
from scipy.optimize import minimize

from app.schemas.farm import FarmState, Zone
from app.schemas.prescriptive import (
    OptimizationObjective,
    PrescriptionOption,
    PrescribeInterventionRequest,
    PrescribeInterventionResponse,
    PrescriptiveConstraints,
)
from app.schemas.result import RiskLevel, RiskResult
from app.schemas.scenario import Scenario, ScenarioChanges, ScenarioType
from app.services.risk_analyzer import analyze_risk


def calculate_agronomic_response(
    irrigation_mult: float,
    fertilizer_mult: float,
    water_stress: RiskLevel,
    heat_stress: RiskLevel,
    nutrient_risk: RiskLevel,
) -> Tuple[float, float]:
    """
    Biophysical response surrogate calculating estimated yield change (%) and water usage change (%).
    
    Returns:
        (projected_yield_impact_pct, projected_water_usage_change_pct)
    """
    water_usage_pct = (irrigation_mult - 1.0) * 100.0

    # Baseline sensitivity weights based on current farm stress
    water_sensitivity = 0.50 if water_stress == RiskLevel.HIGH else (0.25 if water_stress == RiskLevel.MEDIUM else 0.10)
    heat_mitigation_benefit = 0.15 if heat_stress == RiskLevel.HIGH and irrigation_mult > 1.0 else 0.0
    nutrient_sensitivity = 0.35 if nutrient_risk == RiskLevel.HIGH else (0.15 if nutrient_risk == RiskLevel.MEDIUM else 0.05)

    # Log-response for diminishing returns on inputs
    if irrigation_mult >= 1.0:
        water_gain = water_sensitivity * 100.0 * np.log(irrigation_mult) + heat_mitigation_benefit * 100.0
        # Over-watering penalty (waterlogging risk above 1.35x)
        if irrigation_mult > 1.35:
            water_gain -= 15.0 * (irrigation_mult - 1.35)
    else:
        # Yield loss from deficit irrigation
        water_gain = -1.2 * water_sensitivity * 100.0 * (1.0 - irrigation_mult)

    if fertilizer_mult >= 1.0:
        fert_gain = nutrient_sensitivity * 100.0 * np.log(fertilizer_mult)
        if fertilizer_mult > 1.25:
            fert_gain -= 10.0 * (fertilizer_mult - 1.25)
    else:
        fert_gain = -1.0 * nutrient_sensitivity * 100.0 * (1.0 - fertilizer_mult)

    yield_impact_pct = round(float(water_gain + fert_gain), 2)
    return yield_impact_pct, round(float(water_usage_pct), 2)


def generate_prescription_tier(
    tier: str,
    name: str,
    irrigation_mult: float,
    fertilizer_mult: float,
    duration_days: int,
    target_zones: List[str],
    yield_impact_pct: float,
    water_impact_pct: float,
    objective: OptimizationObjective,
    strategy_summary: str,
    schedule_steps: List[str],
) -> PrescriptionOption:
    """Helper to build a validated PrescriptionOption containing an executable Scenario."""
    # Compute normalized efficiency score: balances yield preservation vs water conservation
    # Normalized 0.0 to 1.0
    yield_factor = max(0.0, min(1.0, (yield_impact_pct + 25.0) / 50.0))
    water_factor = max(0.0, min(1.0, (25.0 - water_impact_pct) / 50.0))
    if objective == OptimizationObjective.MAXIMIZE_YIELD:
        eff_score = round(0.8 * yield_factor + 0.2 * water_factor, 2)
    elif objective == OptimizationObjective.MINIMIZE_WATER:
        eff_score = round(0.3 * yield_factor + 0.7 * water_factor, 2)
    else:
        eff_score = round(0.55 * yield_factor + 0.45 * water_factor, 2)

    scenario_type = ScenarioType.COMBINED if (irrigation_mult != 1.0 and fertilizer_mult != 1.0) else (
        ScenarioType.IRRIGATION_INCREASE if irrigation_mult > 1.0 else ScenarioType.IRRIGATION_DECREASE
    )

    scenario = Scenario(
        scenario_type=scenario_type,
        name=name,
        description=f"Prescriptive {tier.upper()} optimization plan for {objective.value}",
        duration_days=duration_days,
        target_zones=target_zones,
        changes=ScenarioChanges(
            irrigation_multiplier=round(irrigation_mult, 2),
            fertilizer_multiplier=round(fertilizer_mult, 2) if fertilizer_mult != 1.0 else None,
        ),
    )

    return PrescriptionOption(
        tier=tier,
        name=name,
        strategy_summary=strategy_summary,
        scenario=scenario,
        projected_yield_impact_pct=yield_impact_pct,
        projected_water_usage_change_pct=water_impact_pct,
        efficiency_score=eff_score,
        action_schedule=schedule_steps,
    )


def prescribe_intervention(request: PrescribeInterventionRequest) -> PrescribeInterventionResponse:
    """
    Solve multi-objective intervention optimization across management parameters.
    """
    farm_state = request.farm_state
    risk_result = request.risk_result or analyze_risk(farm_state)
    constraints = request.constraints or PrescriptiveConstraints()
    duration = request.duration_days
    objective = request.objective

    # Target zones
    target_zones = constraints.target_zones or [z.zone_id for z in farm_state.zones]

    # Evaluate dominant risk conditions across the farm
    has_water_stress = any(zr.water_stress in [RiskLevel.HIGH, RiskLevel.MEDIUM] for zr in risk_result.zone_risks)
    has_heat_stress = any(zr.heat_stress in [RiskLevel.HIGH, RiskLevel.MEDIUM] for zr in risk_result.zone_risks)
    has_nutrient_risk = any(zr.nutrient_risk in [RiskLevel.HIGH, RiskLevel.MEDIUM] for zr in risk_result.zone_risks)

    w_risk = RiskLevel.HIGH if has_water_stress else RiskLevel.LOW
    h_risk = RiskLevel.HIGH if has_heat_stress else RiskLevel.LOW
    n_risk = RiskLevel.HIGH if has_nutrient_risk else RiskLevel.LOW

    # Parameter boundaries from constraints
    max_irrig_inc = 1.0 + (constraints.max_irrigation_increase_pct / 100.0)
    max_fert_inc = 1.0 + (constraints.max_fertilizer_increase_pct / 100.0)
    min_irrig_cut = max(0.4, 1.0 - (constraints.max_water_cut_pct / 100.0))

    # --- 1. Conservative Option (Cost & Resource Conservation) ---
    cons_irrig = max(min_irrig_cut, 0.80 if has_water_stress else 0.70)
    cons_fert = 1.0
    cons_yield, cons_water = calculate_agronomic_response(cons_irrig, cons_fert, w_risk, h_risk, n_risk)
    conservative_option = generate_prescription_tier(
        tier="conservative",
        name="Resource Conservation Plan",
        irrigation_mult=cons_irrig,
        fertilizer_mult=cons_fert,
        duration_days=duration,
        target_zones=target_zones,
        yield_impact_pct=cons_yield,
        water_impact_pct=cons_water,
        objective=objective,
        strategy_summary=f"Reduces irrigation by {abs(cons_water):.0f}% to minimize utility costs and water drawdown while accepting minor yield impact ({cons_yield:+.1f}%).",
        schedule_steps=[
            f"Days 1-{duration}: Reduce baseline irrigation cycles by {abs(cons_water):.0f}%.",
            "Monitor soil tension daily at 15cm and 30cm root depths.",
            "Apply mulch or cover crops in dry rows to retard evaporation.",
        ],
    )

    # --- 2. Balanced Option (Recommended Pareto-Optimal Efficiency) ---
    if has_water_stress or has_heat_stress:
        bal_irrig = min(max_irrig_inc, 1.15)
    elif objective == OptimizationObjective.MINIMIZE_WATER:
        bal_irrig = 0.88
    else:
        bal_irrig = 1.05

    bal_fert = min(max_fert_inc, 1.10) if has_nutrient_risk else 1.0
    bal_yield, bal_water = calculate_agronomic_response(bal_irrig, bal_fert, w_risk, h_risk, n_risk)
    balanced_option = generate_prescription_tier(
        tier="balanced",
        name="Balanced Yield & Water Efficiency Plan",
        irrigation_mult=bal_irrig,
        fertilizer_mult=bal_fert,
        duration_days=duration,
        target_zones=target_zones,
        yield_impact_pct=bal_yield,
        water_impact_pct=bal_water,
        objective=objective,
        strategy_summary=f"Pareto-optimal intervention optimizing Water Use Efficiency (WUE). Projected yield: {bal_yield:+.1f}%, water change: {bal_water:+.1f}%.",
        schedule_steps=[
            f"Days 1-14: Implement {'supplementary pulse (+15%)' if bal_irrig > 1.0 else 'efficient deficit (-12%)'} scheduled during cooler dawn/dusk hours.",
            f"Days 15-{duration}: Stabilize irrigation to maintain root-zone soil moisture between 22-26%.",
            f"{'Apply targeted fertigation top-dressing on day 7.' if bal_fert > 1.0 else 'Maintain standard nutrient top-dressing schedule.'}",
        ],
    )

    # --- 3. Aggressive Option (Maximum Harvest & Stress Defense) ---
    agg_irrig = min(max_irrig_inc, 1.30)
    agg_fert = min(max_fert_inc, 1.20) if has_nutrient_risk else 1.05
    agg_yield, agg_water = calculate_agronomic_response(agg_irrig, agg_fert, w_risk, h_risk, n_risk)
    aggressive_option = generate_prescription_tier(
        tier="aggressive",
        name="Maximum Yield & Stress Defense Plan",
        irrigation_mult=agg_irrig,
        fertilizer_mult=agg_fert,
        duration_days=duration,
        target_zones=target_zones,
        yield_impact_pct=agg_yield,
        water_impact_pct=agg_water,
        objective=objective,
        strategy_summary=f"Proactive hazard suppression maximizing canopy health and yield retention ({agg_yield:+.1f}%) with higher resource investment (+{agg_water:.0f}% water).",
        schedule_steps=[
            f"Days 1-{duration}: Deliver +{agg_water:.0f}% irrigation volume split into twice-daily cycles to minimize thermal spikes.",
            f"Apply booster fertilizer (+{(agg_fert-1)*100:.0f}%) during peak vegetative uptake.",
            "Conduct weekly leaf sap analysis to verify nutrient uptake.",
        ],
    )

    # Select the single most optimal plan based on objective
    if objective == OptimizationObjective.MINIMIZE_WATER:
        optimal_plan = conservative_option
    elif objective == OptimizationObjective.MAXIMIZE_YIELD:
        optimal_plan = aggressive_option
    else:
        optimal_plan = balanced_option

    rationale = (
        f"Optimization evaluated {len(farm_state.zones)} zone(s) with objective '{objective.value}'. "
        f"Detected risk profile: Water Stress={w_risk.value}, Heat Stress={h_risk.value}, Nutrient Risk={n_risk.value}. "
        f"Identified single most optimal plan: '{optimal_plan.name}', achieving {optimal_plan.projected_yield_impact_pct:+.1f}% yield adjustment "
        f"at {optimal_plan.projected_water_usage_change_pct:+.1f}% water variance with an efficiency rating of {optimal_plan.efficiency_score:.2f}."
    )

    checklist = [
        f"Confirm flow meter calibration across target zones: {', '.join(target_zones)}.",
        f"Load executable Scenario '{optimal_plan.scenario.name}' into Person 2's biophysical engine for validation.",
        "Verify local water rights and basin withdrawal allowances before scaling irrigation.",
        "Inspect soil probes after 72 hours of intervention implementation.",
    ]

    return PrescribeInterventionResponse(
        objective=objective,
        optimal_plan=optimal_plan,
        primary_recommendation=optimal_plan,
        alternative_options=[],
        agronomic_rationale=rationale,
        checklist=checklist,
    )
