"""
Service: Scenario Suggester
Responsibility:
- Ingest farm state and agronomic risk assessment (RiskResult).
- Deterministically formulate prioritized, rule-based 'what-if' stress-test scenarios
  for Person 2's biophysical simulation engine.
- Target recommendations specifically to vulnerable zones (or farm-wide if multiple/all zones affected).
- Deduplicate candidate scenarios and cap at max_suggestions (default 5).

DISCLAIMER:
All generated scenario suggestions are hypothetical stress tests designed to assess
crop and farm resilience. They do not claim or predict that such adverse events will occur.
"""

from typing import Dict, List, Optional, Set, Tuple
from app.schemas.farm import FarmState, Zone
from app.schemas.result import (
    RiskLevel,
    RiskResult,
    ScenarioRecommendation,
    SuggestScenariosResponse,
)
from app.schemas.scenario import Scenario, ScenarioChanges, ScenarioType
from app.services.risk_analyzer import analyze_risk


class ScenarioSuggester:
    """
    Deterministic rule-based scenario suggestion engine.
    Translates detected farm risks into actionable simulation stress tests.
    """

    def suggest(
        self,
        farm_state: FarmState,
        risk_result: Optional[RiskResult] = None,
        max_suggestions: int = 5,
    ) -> SuggestScenariosResponse:
        """
        Generate prioritized what-if simulation suggestions based on farm vulnerability.

        Args:
            farm_state: Snapshot of farm zones and current telemetry.
            risk_result: Optional pre-computed risk result. If None, analyze_risk is run.
            max_suggestions: Maximum number of suggestions to return (capped at 5 by default).

        Returns:
            SuggestScenariosResponse: Farm ID and list of prioritized ScenarioRecommendation objects.
        """
        if not farm_state.zones:
            return SuggestScenariosResponse(farm_id=farm_state.farm_id, recommendations=[])

        # 1. Resolve risk result
        if risk_result is None:
            risk_result = analyze_risk(farm_state)

        # 2. Build quick lookup of zone_id -> Zone object and zone_id -> ZoneRisk
        zones_map: Dict[str, Zone] = {z.zone_id: z for z in farm_state.zones}
        zone_risks_map = {zr.zone_id: zr for zr in risk_result.zone_risks}
        all_zone_ids = list(zones_map.keys())

        # 3. Check for entirely healthy farm (Rule: no unnecessary suggestions if all nominal)
        all_low = True
        for zr in risk_result.zone_risks:
            if any(
                lvl != RiskLevel.LOW
                for lvl in [zr.water_stress, zr.heat_stress, zr.disease_risk, zr.nutrient_risk]
            ):
                all_low = False
                break

        if all_low and risk_result.overall_risk_level == RiskLevel.LOW:
            return SuggestScenariosResponse(
                farm_id=farm_state.farm_id,
                recommendations=[],
            )

        candidates: List[ScenarioRecommendation] = []
        seen_signatures: Set[Tuple] = set()

        def add_candidate(rec: ScenarioRecommendation):
            """Deduplicate by scenario type, target zones, and core perturbation changes."""
            changes = rec.scenario.changes
            sig = (
                rec.scenario.scenario_type,
                tuple(sorted(rec.scenario.target_zones)),
                changes.rainfall_multiplier,
                changes.temperature_delta,
                changes.irrigation_multiplier,
                changes.fertilizer_multiplier,
                changes.disease_pressure,
            )
            if sig not in seen_signatures:
                seen_signatures.add(sig)
                candidates.append(rec)

        def resolve_targets(target_ids: List[str]) -> Tuple[List[str], str]:
            """
            Format target zones and human-readable names.
            If all farm zones are affected, returns ([], 'the entire farm') per contract convention.
            """
            if len(target_ids) == len(all_zone_ids):
                return [], "the entire farm"
            names = [zones_map[zid].name or zid for zid in target_ids if zid in zones_map]
            names_str = ", ".join(names) if names else ", ".join(target_ids)
            return target_ids, names_str

        # --------------------------------------------------------------
        # RULE SET 1: WATER STRESS & IRRIGATION RISKS
        # --------------------------------------------------------------
        high_water = [zr.zone_id for zr in risk_result.zone_risks if zr.water_stress == RiskLevel.HIGH]
        med_water = [zr.zone_id for zr in risk_result.zone_risks if zr.water_stress == RiskLevel.MEDIUM]

        if high_water:
            targets, names_str = resolve_targets(high_water)
            add_candidate(
                ScenarioRecommendation(
                    recommendation_id="REC-TEMP",
                    priority=RiskLevel.HIGH,
                    scenario=Scenario(
                        scenario_type=ScenarioType.RAIN_REDUCTION,
                        name="Severe Rainfall Deficit Stress Test",
                        description=f"30% rainfall reduction for 30 days targeting {names_str}.",
                        duration_days=30,
                        target_zones=targets,
                        changes=ScenarioChanges(rainfall_multiplier=0.70),
                    ),
                    reason=(
                        f"Zone(s) {names_str} currently exhibit HIGH water stress. "
                        f"Simulating a 30% rainfall reduction for 30 days can show how vulnerable crops "
                        f"are to a prolonged dry spell."
                    ),
                    triggered_risks=["WATER_STRESS"],
                    target_zones=targets,
                )
            )

            # Irrigation equipment failure test for irrigated plots
            irrigated_high = [
                zid for zid in high_water
                if zones_map[zid].irrigation in ["Drip", "Center Pivot", "Sprinkler", "Furrow"]
            ]
            if irrigated_high:
                irr_targets, irr_names_str = resolve_targets(irrigated_high)
                add_candidate(
                    ScenarioRecommendation(
                        recommendation_id="REC-TEMP",
                        priority=RiskLevel.HIGH,
                        scenario=Scenario(
                            scenario_type=ScenarioType.IRRIGATION_FAILURE,
                            name="Irrigation Equipment Breakdown Stress Test",
                            description=f"Complete irrigation cutoff for 7 days targeting {irr_names_str}.",
                            duration_days=7,
                            target_zones=irr_targets,
                            changes=ScenarioChanges(irrigation_multiplier=0.0),
                        ),
                        reason=(
                            f"Zone(s) {irr_names_str} rely on irrigation under severe moisture deficit. "
                            f"Simulating a complete 7-day irrigation shutoff tests resilience against pump or power failure."
                        ),
                        triggered_risks=["WATER_STRESS", "IRRIGATION"],
                        target_zones=irr_targets,
                    )
                )

        elif med_water:
            targets, names_str = resolve_targets(med_water)
            add_candidate(
                ScenarioRecommendation(
                    recommendation_id="REC-TEMP",
                    priority=RiskLevel.MEDIUM,
                    scenario=Scenario(
                        scenario_type=ScenarioType.RAIN_REDUCTION,
                        name="Moderate Rainfall Reduction Stress Test",
                        description=f"15% rainfall reduction for 14 days targeting {names_str}.",
                        duration_days=14,
                        target_zones=targets,
                        changes=ScenarioChanges(rainfall_multiplier=0.85),
                    ),
                    reason=(
                        f"Zone(s) {names_str} exhibit moderate moisture stress. "
                        f"Simulating a 15% rainfall reduction for 14 days tests whether current soil reserves "
                        f"can sustain crop development."
                    ),
                    triggered_risks=["WATER_STRESS"],
                    target_zones=targets,
                )
            )

            # Moderate irrigation reduction if irrigated
            irrigated_med = [
                zid for zid in med_water
                if zones_map[zid].irrigation in ["Drip", "Center Pivot", "Sprinkler", "Furrow"]
            ]
            if irrigated_med:
                irr_targets, irr_names_str = resolve_targets(irrigated_med)
                add_candidate(
                    ScenarioRecommendation(
                        recommendation_id="REC-TEMP",
                        priority=RiskLevel.MEDIUM,
                        scenario=Scenario(
                            scenario_type=ScenarioType.IRRIGATION_DECREASE,
                            name="30% Irrigation Cut Stress Test",
                            description=f"30% irrigation reduction for 14 days targeting {irr_names_str}.",
                            duration_days=14,
                            target_zones=irr_targets,
                            changes=ScenarioChanges(irrigation_multiplier=0.70),
                        ),
                        reason=(
                            f"Zone(s) {irr_names_str} rely on irrigation under moderate water stress. "
                            f"Simulating a 30% reduction in irrigation water for 14 days tests water-rationing scenarios."
                        ),
                        triggered_risks=["IRRIGATION", "WATER_STRESS"],
                        target_zones=irr_targets,
                    )
                )

        # --------------------------------------------------------------
        # RULE SET 2: HEAT STRESS
        # --------------------------------------------------------------
        high_heat = [zr.zone_id for zr in risk_result.zone_risks if zr.heat_stress == RiskLevel.HIGH]
        med_heat = [zr.zone_id for zr in risk_result.zone_risks if zr.heat_stress == RiskLevel.MEDIUM]

        if high_heat:
            targets, names_str = resolve_targets(high_heat)
            stages = ", ".join(sorted(set(zones_map[zid].growth_stage for zid in high_heat if zid in zones_map)))
            add_candidate(
                ScenarioRecommendation(
                    recommendation_id="REC-TEMP",
                    priority=RiskLevel.HIGH,
                    scenario=Scenario(
                        scenario_type=ScenarioType.HEATWAVE,
                        name="Extreme Heatwave Shock Test",
                        description=f"+5°C temperature spike for 7 days targeting {names_str}.",
                        duration_days=7,
                        target_zones=targets,
                        changes=ScenarioChanges(temperature_delta=5.0),
                    ),
                    reason=(
                        f"Zone(s) {names_str} currently face critical thermal levels during {stages}. "
                        f"Simulating a +5°C temperature spike for 7 days can show the potential impact "
                        f"of an acute heatwave on canopy health and pollen viability."
                    ),
                    triggered_risks=["HEAT_STRESS"],
                    target_zones=targets,
                )
            )
        elif med_heat:
            targets, names_str = resolve_targets(med_heat)
            add_candidate(
                ScenarioRecommendation(
                    recommendation_id="REC-TEMP",
                    priority=RiskLevel.MEDIUM,
                    scenario=Scenario(
                        scenario_type=ScenarioType.TEMPERATURE_INCREASE,
                        name="Moderate Temperature Increase Stress Test",
                        description=f"+3°C temperature increase for 7 days targeting {names_str}.",
                        duration_days=7,
                        target_zones=targets,
                        changes=ScenarioChanges(temperature_delta=3.0),
                    ),
                    reason=(
                        f"Zone(s) {names_str} are nearing upper thermal comfort limits. "
                        f"Simulating a +3°C temperature increase for 7 days tests crop resilience before "
                        f"severe heat damage occurs."
                    ),
                    triggered_risks=["HEAT_STRESS"],
                    target_zones=targets,
                )
            )

        # --------------------------------------------------------------
        # RULE SET 3: DISEASE RISK
        # --------------------------------------------------------------
        high_disease = [zr.zone_id for zr in risk_result.zone_risks if zr.disease_risk == RiskLevel.HIGH]
        med_disease = [zr.zone_id for zr in risk_result.zone_risks if zr.disease_risk == RiskLevel.MEDIUM]

        if high_disease:
            targets, names_str = resolve_targets(high_disease)
            add_candidate(
                ScenarioRecommendation(
                    recommendation_id="REC-TEMP",
                    priority=RiskLevel.HIGH,
                    scenario=Scenario(
                        scenario_type=ScenarioType.DISEASE_OUTBREAK,
                        name="Severe Disease Outbreak Stress Test",
                        description=f"High pathogen pressure for 14 days targeting {names_str}.",
                        duration_days=14,
                        target_zones=targets,
                        changes=ScenarioChanges(disease_pressure=0.80),
                    ),
                    reason=(
                        f"High canopy humidity and favorable incubation temperatures in zone(s) {names_str} "
                        f"create elevated fungal/bacterial disease pressure. Simulating an accelerated disease outbreak "
                        f"for 14 days tests canopy defoliation vulnerability and potential yield impact."
                    ),
                    triggered_risks=["DISEASE_RISK"],
                    target_zones=targets,
                )
            )
        elif med_disease:
            targets, names_str = resolve_targets(med_disease)
            add_candidate(
                ScenarioRecommendation(
                    recommendation_id="REC-TEMP",
                    priority=RiskLevel.MEDIUM,
                    scenario=Scenario(
                        scenario_type=ScenarioType.DISEASE_OUTBREAK,
                        name="Moderate Pathogen Spread Stress Test",
                        description=f"Moderate pathogen pressure for 10 days targeting {names_str}.",
                        duration_days=10,
                        target_zones=targets,
                        changes=ScenarioChanges(disease_pressure=0.40),
                    ),
                    reason=(
                        f"Microclimate conditions in zone(s) {names_str} are favorable for pathogen development. "
                        f"Simulating moderate disease spread for 10 days evaluates preventive containment efficacy."
                    ),
                    triggered_risks=["DISEASE_RISK"],
                    target_zones=targets,
                )
            )

        # --------------------------------------------------------------
        # RULE SET 4: NUTRIENT RISK
        # --------------------------------------------------------------
        high_nutrient = [zr.zone_id for zr in risk_result.zone_risks if zr.nutrient_risk == RiskLevel.HIGH]
        med_nutrient = [zr.zone_id for zr in risk_result.zone_risks if zr.nutrient_risk == RiskLevel.MEDIUM]

        if high_nutrient:
            targets, names_str = resolve_targets(high_nutrient)
            add_candidate(
                ScenarioRecommendation(
                    recommendation_id="REC-TEMP",
                    priority=RiskLevel.HIGH,
                    scenario=Scenario(
                        scenario_type=ScenarioType.FERTILIZER_CHANGE,
                        name="25% Fertilizer Reduction Stress Test",
                        description=f"25% fertilizer cut for 30 days targeting {names_str}.",
                        duration_days=30,
                        target_zones=targets,
                        changes=ScenarioChanges(fertilizer_multiplier=0.75),
                    ),
                    reason=(
                        f"Soil nutrient availability is severely depleted in zone(s) {names_str}. "
                        f"Simulating a 25% fertilizer reduction for 30 days can show potential crop stunting "
                        f"and yield loss under nutritional deficit."
                    ),
                    triggered_risks=["NUTRIENT_RISK"],
                    target_zones=targets,
                )
            )
        elif med_nutrient:
            targets, names_str = resolve_targets(med_nutrient)
            add_candidate(
                ScenarioRecommendation(
                    recommendation_id="REC-TEMP",
                    priority=RiskLevel.MEDIUM,
                    scenario=Scenario(
                        scenario_type=ScenarioType.FERTILIZER_CHANGE,
                        name="15% Fertilizer Reduction Stress Test",
                        description=f"15% fertilizer cut for 21 days targeting {names_str}.",
                        duration_days=21,
                        target_zones=targets,
                        changes=ScenarioChanges(fertilizer_multiplier=0.85),
                    ),
                    reason=(
                        f"Zone(s) {names_str} have suboptimal soil nutrient reserves. "
                        f"Simulating a 15% fertilizer reduction for 21 days helps determine minimal nutritional "
                        f"requirements to avoid deficiency."
                    ),
                    triggered_risks=["NUTRIENT_RISK"],
                    target_zones=targets,
                )
            )

        # --------------------------------------------------------------
        # 4. PRIORITIZATION, SORTING & CAPPING
        # --------------------------------------------------------------
        priority_weights = {RiskLevel.HIGH: 3, RiskLevel.MEDIUM: 2, RiskLevel.LOW: 1}

        # Sort: Highest priority first, then broader risk triggers, then more zones
        candidates.sort(
            key=lambda c: (
                priority_weights.get(c.priority, 1),
                len(c.triggered_risks),
                len(c.target_zones) if c.target_zones else 999,  # Farm-wide (empty) gets high breadth
            ),
            reverse=True,
        )

        limit = min(max_suggestions, 5)
        top_candidates = candidates[:limit]

        # Assign sequential recommendation IDs
        for idx, rec in enumerate(top_candidates, 1):
            rec.recommendation_id = f"SUGGESTED-{idx:03d}"

        return SuggestScenariosResponse(
            farm_id=farm_state.farm_id,
            recommendations=top_candidates,
        )


_suggester_instance = ScenarioSuggester()


def suggest_scenarios(
    farm_state: FarmState,
    risk_result: Optional[RiskResult] = None,
    max_suggestions: int = 5,
) -> SuggestScenariosResponse:
    """
    Public API helper function for generating scenario recommendations.
    """
    return _suggester_instance.suggest(
        farm_state=farm_state,
        risk_result=risk_result,
        max_suggestions=max_suggestions,
    )
