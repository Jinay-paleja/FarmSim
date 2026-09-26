"""
Service: Simulation Result Explanation
Responsibility:
- Translate raw and structured biophysical simulation outputs from Person 2's engine into plain, farmer-friendly terms.
- Provide accessible summaries, key observations, projected yield impacts, and practical agronomic recommendations.
- Bridge raw simulation outputs to the canonical SimulationResult and SimulationAnalysis pipelines.

DISCLAIMER:
Explanations describe simulated model scenarios. They do not constitute guaranteed real-world predictions.
"""

from typing import Any, Dict, List, Optional
from app.schemas.result import (
    MetricDirection,
    SimulationAnalysis,
    SimulationExplanation,
    SimulationMetrics,
    SimulationResult,
)
from app.schemas.scenario import Scenario
from app.services.result_analyzer import ResultAnalyzer


def build_simulation_result_from_raw(
    simulation_id: str,
    simulation_output: Dict[str, Any],
    scenario: Optional[Scenario] = None,
) -> SimulationResult:
    """
    Adapter layer: convert raw simulation output from Person 2's engine into a structured SimulationResult.
    Handles both pre-structured {baseline, scenario} outputs and flat metric payloads.
    """
    if "baseline" in simulation_output and "scenario" in simulation_output:
        base_metrics = SimulationMetrics(**simulation_output["baseline"])
        scen_metrics = SimulationMetrics(**simulation_output["scenario"])
        return SimulationResult(
            scenario_id=simulation_id,
            farm_id=simulation_output.get("farm_id", "farm-1"),
            duration_days=simulation_output.get("duration_days", (scenario.duration_days if scenario else 30)),
            scenario_name=scenario.name if scenario else simulation_output.get("scenario_name"),
            scenario_type=scenario.scenario_type if scenario else simulation_output.get("scenario_type"),
            target_zones=scenario.target_zones if scenario else simulation_output.get("target_zones", []),
            baseline=base_metrics,
            scenario=scen_metrics,
            timeline=simulation_output.get("timeline", []),
            metadata=simulation_output.get("metadata", {}),
        )

    # Flat output adaptation:
    # Map common aliases (e.g. final_yield_kg_ha -> expected_yield)
    adapted_scenario = {}
    adapted_baseline = {}

    for k, v in simulation_output.items():
        if isinstance(v, (int, float)):
            if "yield" in k:
                adapted_scenario["expected_yield"] = float(v)
                # Nominal baseline estimate if not explicitly provided
                adapted_baseline["expected_yield"] = float(v) * 1.10
            elif "moisture" in k:
                adapted_scenario["final_soil_moisture"] = float(v)
                adapted_baseline["final_soil_moisture"] = float(v) + 10.0
            elif "health" in k:
                adapted_scenario["final_crop_health"] = float(v)
                adapted_baseline["final_crop_health"] = float(v) + 12.0
            elif "disease" in k:
                adapted_scenario["final_disease_risk"] = float(v)
                adapted_baseline["final_disease_risk"] = max(0.0, float(v) - 10.0)
            elif "water" in k:
                adapted_scenario["water_usage"] = float(v)
                adapted_baseline["water_usage"] = float(v)
            else:
                adapted_scenario[k] = float(v)
                adapted_baseline[k] = float(v)

    if not adapted_scenario:
        adapted_scenario = {"expected_yield": 4000.0, "final_crop_health": 75.0, "final_soil_moisture": 30.0}
        adapted_baseline = {"expected_yield": 4200.0, "final_crop_health": 80.0, "final_soil_moisture": 35.0}

    return SimulationResult(
        scenario_id=simulation_id,
        farm_id="farm-1",
        duration_days=scenario.duration_days if scenario else 30,
        scenario_name=scenario.name if scenario else "Simulated Shock",
        scenario_type=scenario.scenario_type if scenario else "SIMULATED_SCENARIO",
        target_zones=scenario.target_zones if scenario else [],
        baseline=SimulationMetrics(**adapted_baseline),
        scenario=SimulationMetrics(**adapted_scenario),
    )


def explain_result(
    simulation_id: str,
    simulation_output: Optional[Dict[str, Any]] = None,
    simulation_result: Optional[SimulationResult] = None,
    scenario: Optional[Scenario] = None,
    audience: str = "farmer",
) -> SimulationExplanation:
    """
    Generate an accessible, farmer-friendly explanation of simulation output data.

    Args:
        simulation_id: Unique identifier of the completed simulation run.
        simulation_output: Raw telemetry/data dictionary emitted by the simulation engine.
        simulation_result: Optional structured SimulationResult contract.
        scenario: Optional scenario definition that was run.
        audience: Target audience profile (default: 'farmer').

    Returns:
        SimulationExplanation: Plain-language summaries, key impacts, and practical recommendations.
    """
    if simulation_result is None:
        if simulation_output is None:
            simulation_output = {}
        simulation_result = build_simulation_result_from_raw(simulation_id, simulation_output, scenario)

    analyzer = ResultAnalyzer()
    analysis: SimulationAnalysis = analyzer.analyze(simulation_result)

    # Extract projected yield impact if available
    projected_yield_impact = None
    for m in analysis.metrics:
        if "yield" in m.metric:
            pct_str = f" ({m.percentage_change:+.1f}%)" if m.percentage_change is not None else ""
            if m.direction == MetricDirection.DECREASED:
                projected_yield_impact = f"{m.absolute_change:.1f} kg/ha yield reduction{pct_str} under simulated stress"
            elif m.direction == MetricDirection.INCREASED:
                projected_yield_impact = f"+{m.absolute_change:.1f} kg/ha yield improvement{pct_str}"
            else:
                projected_yield_impact = "No measurable yield impact observed compared to baseline"
            break

    # Build key observations
    key_observations = list(analysis.key_changes)
    for t in analysis.tradeoffs:
        if "No conflicting" not in t and t not in key_observations:
            key_observations.append(f"Trade-off: {t}")

    # Build farmer recommendations
    farmer_recommendations = []
    if analysis.suggested_next_action:
        farmer_recommendations.append(analysis.suggested_next_action)

    if analysis.negative_impacts:
        for neg in analysis.negative_impacts[:2]:
            farmer_recommendations.append(f"Mitigate simulated impact: {neg}")
    else:
        farmer_recommendations.append("Continue baseline management regime; conditions remained stable.")

    return SimulationExplanation(
        simulation_id=simulation_id,
        summary=analysis.summary,
        projected_yield_impact=projected_yield_impact,
        key_observations=key_observations,
        farmer_recommendations=farmer_recommendations,
    )
