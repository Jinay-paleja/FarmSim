"""
Service: Result Analyzer
Responsibility:
- Deterministically compare baseline vs simulated scenario metrics emitted by Person 2's biophysical engine.
- Calculate absolute and percentage deltas, ensuring safe handling of zero baselines.
- Detect agronomic trade-offs between conflicting indicators (e.g. yield gain vs water footprint).
- Assess overall impact severity (HIGH, MEDIUM, LOW) using transparent biophysical thresholds.
- Provide multi-scenario comparison support.

DISCLAIMER:
All analyses interpret mathematical simulation outputs. They are not claims of real-world certainty.
"""

from typing import Any, Dict, List, Optional, Tuple
from app.schemas.result import (
    MetricComparison,
    MetricDirection,
    RiskLevel,
    ScenarioComparisonItem,
    SimulationAnalysis,
    SimulationMetrics,
    SimulationResult,
    CompareSimulationsResponse,
)


class ResultAnalyzer:
    """
    Deterministic result analyzer for agricultural simulation outputs.
    """

    METRIC_LABELS = {
        "final_soil_moisture": "Soil Moisture (% v/v)",
        "final_crop_health": "Crop Health Index (0-100)",
        "final_disease_risk": "Disease Risk Index (0-100)",
        "water_usage": "Water Consumption (mm / m³)",
        "expected_yield": "Expected Harvest Yield (kg/ha)",
        "canopy_cover": "Canopy Ground Cover (%)",
        "biomass_kg_ha": "Above-Ground Biomass (kg/ha)",
        "root_depth_cm": "Effective Root Depth (cm)",
    }

    def analyze(self, result: SimulationResult) -> SimulationAnalysis:
        """
        Compare baseline vs scenario metrics and synthesize comprehensive impact analysis.
        """
        baseline_dict = self._extract_metrics_dict(result.baseline)
        scenario_dict = self._extract_metrics_dict(result.scenario)

        # 1. Compute metric comparisons
        metric_comparisons: List[MetricComparison] = []
        all_metric_keys = list(dict.fromkeys(list(baseline_dict.keys()) + list(scenario_dict.keys())))

        for key in all_metric_keys:
            if key in baseline_dict and key in scenario_dict:
                base_val = baseline_dict[key]
                scen_val = scenario_dict[key]
                if base_val is not None and scen_val is not None:
                    comp = self._compare_single_metric(key, float(base_val), float(scen_val))
                    metric_comparisons.append(comp)

        # 2. Key changes, positive impacts, and negative impacts
        positive_impacts, negative_impacts, key_changes = self._categorize_impacts(metric_comparisons)

        # 3. Detect agronomic trade-offs
        tradeoffs = self._detect_tradeoffs(metric_comparisons, result)

        # 4. Assess overall impact level
        impact_level = self._assess_impact_level(metric_comparisons, tradeoffs)

        # 5. Formulate executive summary
        summary = self._formulate_summary(result, impact_level, metric_comparisons, negative_impacts, positive_impacts)

        # 6. Formulate detailed narrative explanation
        explanation = self._formulate_explanation(result, metric_comparisons, tradeoffs, summary)

        # 7. Formulate suggested next action
        suggested_next_action = self._formulate_next_action(result, metric_comparisons, tradeoffs)

        return SimulationAnalysis(
            scenario_id=result.scenario_id,
            farm_id=result.farm_id,
            impact_level=impact_level,
            summary=summary,
            key_changes=key_changes,
            positive_impacts=positive_impacts,
            negative_impacts=negative_impacts,
            tradeoffs=tradeoffs,
            explanation=explanation,
            suggested_next_action=suggested_next_action,
            metrics=metric_comparisons,
        )

    def compare(self, simulations: List[SimulationResult]) -> CompareSimulationsResponse:
        """
        Compare two or more simulation runs side-by-side against baseline.
        """
        comparisons: List[ScenarioComparisonItem] = []
        narrative_parts = [
            f"Comparative analysis across {len(simulations)} simulated scenarios against baseline conditions:"
        ]

        for sim in simulations:
            analysis = self.analyze(sim)
            item = ScenarioComparisonItem(
                scenario_id=sim.scenario_id,
                scenario_name=sim.scenario_name or sim.scenario_type or sim.scenario_id,
                impact_level=analysis.impact_level,
                key_changes=analysis.key_changes,
                tradeoffs=analysis.tradeoffs,
                metrics=analysis.metrics,
            )
            comparisons.append(item)

            name = item.scenario_name
            changes_str = "; ".join(item.key_changes[:2]) if item.key_changes else "stable parameters"
            impact_str = item.impact_level.value if hasattr(item.impact_level, "value") else str(item.impact_level)
            narrative_parts.append(
                f"- Scenario '{name}' (ID: {sim.scenario_id}) showed an overall impact tier of {impact_str}. "
                f"Key observations: {changes_str}."
            )
            if item.tradeoffs and "No significant" not in item.tradeoffs[0]:
                narrative_parts.append(f"  Trade-off noted: {item.tradeoffs[0]}")

        narrative_parts.append(
            "Evaluation note: Each scenario reflects distinct operational trade-offs rather than an absolute optimum."
        )

        return CompareSimulationsResponse(
            comparisons=comparisons,
            explanation="\n".join(narrative_parts),
        )

    # ------------------------------------------------------------------
    # HELPER METHODS
    # ------------------------------------------------------------------

    def _extract_metrics_dict(self, metrics: SimulationMetrics) -> Dict[str, Any]:
        """Convert metrics model to dictionary, filtering out None values."""
        data = metrics.model_dump()
        return {k: v for k, v in data.items() if v is not None}

    def _compare_single_metric(self, metric: str, base_val: float, scen_val: float) -> MetricComparison:
        """Compute delta, percentage change safely, direction, and interpretation."""
        abs_change = round(scen_val - base_val, 2)

        # Handle zero baseline safely (never divide by zero)
        pct_change: Optional[float] = None
        if abs(base_val) > 1e-6:
            pct_change = round((abs_change / abs(base_val)) * 100.0, 2)

        # Determine direction
        if abs_change > 0.001:
            direction = MetricDirection.INCREASED
        elif abs_change < -0.001:
            direction = MetricDirection.DECREASED
        else:
            direction = MetricDirection.UNCHANGED

        interpretation = self._interpret_metric_change(metric, base_val, scen_val, abs_change, pct_change, direction)

        return MetricComparison(
            metric=metric,
            baseline=round(base_val, 2),
            scenario=round(scen_val, 2),
            absolute_change=abs_change,
            percentage_change=pct_change,
            direction=direction,
            interpretation=interpretation,
        )

    def _interpret_metric_change(
        self,
        metric: str,
        base_val: float,
        scen_val: float,
        abs_change: float,
        pct_change: Optional[float],
        direction: MetricDirection,
    ) -> str:
        """Formulate plain-language interpretation for a metric shift."""
        label = self.METRIC_LABELS.get(metric, metric.replace("_", " ").title())
        pct_str = f" ({pct_change:+.1f}%)" if pct_change is not None else ""

        if direction == MetricDirection.UNCHANGED:
            return f"{label} remained steady at baseline level ({base_val:.1f})."

        if "soil_moisture" in metric:
            if direction == MetricDirection.DECREASED:
                return f"Soil moisture availability decreased by {abs(abs_change):.1f} points{pct_str}, reducing root-zone reserves."
            return f"Soil moisture increased by {abs_change:.1f} points{pct_str}, enhancing root-zone water availability."

        if "crop_health" in metric:
            if direction == MetricDirection.DECREASED:
                return f"Simulated crop condition deteriorated by {abs(abs_change):.1f} points{pct_str} under scenario stress."
            return f"Simulated crop condition improved by {abs_change:.1f} points{pct_str}."

        if "disease_risk" in metric:
            if direction == MetricDirection.INCREASED:
                return f"Simulated disease pressure intensified by {abs_change:.1f} points{pct_str}."
            return f"Simulated disease pressure decreased by {abs(abs_change):.1f} points{pct_str}."

        if "water_usage" in metric:
            if direction == MetricDirection.INCREASED:
                return f"Water consumption increased by {abs_change:.1f} units{pct_str}, raising irrigation demand."
            return f"Water consumption was conserved by {abs(abs_change):.1f} units{pct_str}."

        if "yield" in metric:
            if direction == MetricDirection.DECREASED:
                return f"Simulated harvest yield estimate decreased by {abs(abs_change):.1f} units{pct_str} compared to baseline."
            return f"Simulated harvest yield estimate increased by {abs_change:.1f} units{pct_str}."

        # Generic fallback
        verb = "increased" if direction == MetricDirection.INCREASED else "decreased"
        return f"{label} {verb} by {abs(abs_change):.1f} units{pct_str} relative to baseline."

    def _categorize_impacts(
        self, comparisons: List[MetricComparison]
    ) -> Tuple[List[str], List[str], List[str]]:
        """Identify positive outcomes, negative outcomes, and key summary shifts."""
        positives = []
        negatives = []
        key_changes = []

        for comp in comparisons:
            if comp.direction == MetricDirection.UNCHANGED:
                continue

            pct_str = f" ({comp.percentage_change:+.1f}%)" if comp.percentage_change is not None else ""
            change_desc = f"{comp.interpretation}"
            key_changes.append(change_desc)

            m = comp.metric
            d = comp.direction

            # Yield
            if "yield" in m:
                if d == MetricDirection.INCREASED:
                    positives.append(f"Simulated harvest yield improved by {comp.absolute_change:.1f} units{pct_str}.")
                else:
                    negatives.append(f"Simulated harvest yield declined by {abs(comp.absolute_change):.1f} units{pct_str}.")

            # Crop Health
            elif "crop_health" in m:
                if d == MetricDirection.INCREASED:
                    positives.append(f"Crop health vigor index improved by {comp.absolute_change:.1f} points.")
                else:
                    negatives.append(f"Crop health index dropped by {abs(comp.absolute_change):.1f} points.")

            # Disease Risk
            elif "disease_risk" in m:
                if d == MetricDirection.DECREASED:
                    positives.append(f"Disease pressure subsided by {abs(comp.absolute_change):.1f} points.")
                else:
                    negatives.append(f"Disease pressure escalated by {comp.absolute_change:.1f} points.")

            # Soil Moisture
            elif "soil_moisture" in m:
                if d == MetricDirection.INCREASED:
                    positives.append(f"Soil moisture reserves increased by {comp.absolute_change:.1f} points.")
                else:
                    negatives.append(f"Soil moisture reserves declined by {abs(comp.absolute_change):.1f} points.")

            # Water Usage
            elif "water_usage" in m:
                if d == MetricDirection.DECREASED:
                    positives.append(f"Water consumption conserved by {abs(comp.absolute_change):.1f} units.")
                else:
                    negatives.append(f"Water consumption increased by {comp.absolute_change:.1f} units.")

        if not key_changes:
            key_changes.append("All simulated metrics matched baseline levels with no measurable shift.")

        return positives, negatives, key_changes

    def _detect_tradeoffs(
        self, comparisons: List[MetricComparison], result: SimulationResult
    ) -> List[str]:
        """Detect opposing agronomic shifts across productivity, moisture, and consumption."""
        comp_map = {c.metric: c for c in comparisons}
        tradeoffs = []

        c_health = comp_map.get("final_crop_health")
        c_yield = comp_map.get("expected_yield")
        c_water = comp_map.get("water_usage")
        c_moist = comp_map.get("final_soil_moisture")
        c_disease = comp_map.get("final_disease_risk")

        # Trade-off 1: Crop health / yield improved, but water usage increased
        improved_performance = (
            (c_health and c_health.direction == MetricDirection.INCREASED)
            or (c_yield and c_yield.direction == MetricDirection.INCREASED)
        )
        water_increased = c_water and c_water.direction == MetricDirection.INCREASED

        if improved_performance and water_increased:
            tradeoffs.append(
                f"Crop performance improved in the simulation, but water consumption also increased by "
                f"{c_water.absolute_change:.1f} units."
            )

        # Trade-off 2: Water usage decreased (conserved), but yield or health decreased
        water_conserved = c_water and c_water.direction == MetricDirection.DECREASED
        reduced_performance = (
            (c_health and c_health.direction == MetricDirection.DECREASED)
            or (c_yield and c_yield.direction == MetricDirection.DECREASED)
        )

        if water_conserved and reduced_performance:
            loss_detail = ""
            if c_yield and c_yield.percentage_change is not None:
                loss_detail = f"a simulated yield decline of {abs(c_yield.percentage_change):.1f}%"
            elif c_health:
                loss_detail = f"a crop health decrease of {abs(c_health.absolute_change):.1f} points"
            else:
                loss_detail = "reduced crop performance"
            tradeoffs.append(
                f"The scenario reduced water consumption, but resulted in lower soil moisture availability "
                f"and {loss_detail}."
            )

        # Trade-off 3: Moisture / Irrigation increased, but Disease Risk escalated
        moist_up = c_moist and c_moist.direction == MetricDirection.INCREASED
        disease_up = c_disease and c_disease.direction == MetricDirection.INCREASED

        if moist_up and disease_up:
            tradeoffs.append(
                f"Higher soil moisture and canopy wetness improved water availability, but also elevated "
                f"simulated disease pressure by {c_disease.absolute_change:.1f} points."
            )

        # Trade-off 4: Rainfall or irrigation cuts
        if (
            (c_moist and c_moist.direction == MetricDirection.DECREASED)
            and reduced_performance
            and not water_conserved
        ):
            tradeoffs.append(
                "The scenario reduced water availability, resulting in declining root-zone moisture "
                "and lower simulated crop productivity."
            )

        if not tradeoffs:
            tradeoffs.append("No conflicting agronomic trade-offs detected; simulated indicators were aligned.")

        return tradeoffs

    def _assess_impact_level(
        self, comparisons: List[MetricComparison], tradeoffs: List[str]
    ) -> RiskLevel:
        """
        Assess overall severity of the simulated scenario impact:
        - HIGH: Yield drop >= 15%, crop health drop >= 15 pts, disease jump >= 15 pts, or 2+ major negatives.
        - MEDIUM: Moderate drops (5-15%) or meaningful trade-offs.
        - LOW: Minor changes (< 5%).
        """
        severe_drops = 0
        moderate_drops = 0

        for comp in comparisons:
            m = comp.metric
            d = comp.direction
            abs_ch = abs(comp.absolute_change)
            pct_ch = abs(comp.percentage_change) if comp.percentage_change is not None else 0.0

            if "yield" in m and d == MetricDirection.DECREASED:
                if pct_ch >= 15.0 or abs_ch >= 500.0:
                    severe_drops += 2  # Yield loss is heavily weighted
                elif pct_ch >= 5.0 or abs_ch >= 200.0:
                    moderate_drops += 1

            elif "crop_health" in m and d == MetricDirection.DECREASED:
                if abs_ch >= 15.0:
                    severe_drops += 1
                elif abs_ch >= 5.0:
                    moderate_drops += 1

            elif "disease_risk" in m and d == MetricDirection.INCREASED:
                if abs_ch >= 15.0:
                    severe_drops += 1
                elif abs_ch >= 6.0:
                    moderate_drops += 1

            elif "soil_moisture" in m and d == MetricDirection.DECREASED:
                if abs_ch >= 15.0:
                    severe_drops += 1
                elif abs_ch >= 6.0:
                    moderate_drops += 1

            elif "water_usage" in m and d == MetricDirection.INCREASED:
                if pct_ch >= 20.0:
                    moderate_drops += 1

        if severe_drops >= 2:
            return RiskLevel.HIGH
        if severe_drops == 1 or moderate_drops >= 1:
            return RiskLevel.MEDIUM
        return RiskLevel.LOW

    def _formulate_summary(
        self,
        result: SimulationResult,
        impact_level: RiskLevel,
        comparisons: List[MetricComparison],
        negatives: List[str],
        positives: List[str],
    ) -> str:
        """Generate high-level executive summary sentence."""
        name = result.scenario_name or result.scenario_type or result.scenario_id
        days = result.duration_days or 30

        if impact_level == RiskLevel.HIGH:
            lead = f"Simulating '{name}' for {days} days showed substantial agronomic stress across key indicators."
        elif impact_level == RiskLevel.MEDIUM:
            lead = f"Simulating '{name}' for {days} days revealed moderate biophysical shifts compared to baseline."
        else:
            lead = f"Simulating '{name}' for {days} days showed minor overall deviation from baseline conditions."

        if negatives:
            lead += f" Primary concern: {negatives[0]}"
        elif positives:
            lead += f" Key benefit: {positives[0]}"

        return lead

    def _formulate_explanation(
        self,
        result: SimulationResult,
        comparisons: List[MetricComparison],
        tradeoffs: List[str],
        summary: str,
    ) -> str:
        """Synthesize multi-paragraph farmer-friendly explanation."""
        name = result.scenario_name or result.scenario_type or result.scenario_id
        days = result.duration_days or 30

        paragraphs = [
            f"Scenario: {name} (Duration: {days} days).",
            f"The simulation shows that compared with the baseline, {summary.lower()}",
        ]

        # Key changes
        active_changes = [c.interpretation for c in comparisons if c.direction != MetricDirection.UNCHANGED]
        if active_changes:
            paragraphs.append("Main impacts observed in the simulation:\n" + "\n".join(f"- {c}" for c in active_changes))

        # Tradeoffs
        meaningful_tradeoffs = [t for t in tradeoffs if "No conflicting" not in t]
        if meaningful_tradeoffs:
            paragraphs.append(f"Trade-off analysis:\n{meaningful_tradeoffs[0]}")
        else:
            paragraphs.append("Trade-off analysis:\nNo conflicting negative trade-offs were observed.")

        return "\n\n".join(paragraphs)

    def _formulate_next_action(
        self,
        result: SimulationResult,
        comparisons: List[MetricComparison],
        tradeoffs: List[str],
    ) -> str:
        """Formulate constructive next simulation or operational suggestion."""
        comp_map = {c.metric: c for c in comparisons}
        c_moist = comp_map.get("final_soil_moisture")
        c_disease = comp_map.get("final_disease_risk")
        c_yield = comp_map.get("expected_yield")

        if c_moist and c_moist.direction == MetricDirection.DECREASED:
            return (
                "You can next compare this scenario with a 20% irrigation increase to evaluate "
                "whether supplementary watering offsets the projected moisture decline."
            )
        if c_disease and c_disease.direction == MetricDirection.INCREASED:
            return (
                "You can next simulate early preventive fungicide application or reduced canopy wetness "
                "to evaluate disease containment options."
            )
        if c_yield and c_yield.direction == MetricDirection.DECREASED:
            return (
                "You can next test split fertilizer scheduling or adjusted planting density to see if "
                "biomass accumulation can be stabilized under this stress level."
            )
        return (
            "Current farm management parameters remain resilient under this simulated stress test. "
            "Continue standard seasonal monitoring."
        )


_analyzer_instance = ResultAnalyzer()


def analyze_simulation(result: SimulationResult) -> SimulationAnalysis:
    """Public helper function for simulation result analysis."""
    return _analyzer_instance.analyze(result)


def compare_simulations(simulations: List[SimulationResult]) -> CompareSimulationsResponse:
    """Public helper function for multi-scenario comparative analysis."""
    return _analyzer_instance.compare(simulations)
