"""AI orchestration: NLP intent/entity parsing, rule-led scenarios, explanations.

Every public route delegates here. The local implementation is intentionally
deterministic and inspectable for the hackathon; an OpenAI-compatible model can
enrich parsing when ``AI_API_KEY`` is configured without weakening the JSON
contract returned to the simulator or frontend.
"""

from __future__ import annotations

import json
import re
from typing import Any

import httpx
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

from ..config import Settings
from ..schemas import (
    ExplanationResponse,
    FarmRiskAssessment,
    MetricImpact,
    ResultMetrics,
    ScenarioSuggestion,
    SimulationResult,
)


class AIServiceError(RuntimeError):
    pass


INTENT_EXAMPLES = {
    "RAIN_REDUCTION": ["rainfall drops by 40 percent", "reduced rain", "drought for thirty days", "less rain in zone a"],
    "RAIN_INCREASE": ["rainfall increases by 20 percent", "heavy rain", "more rain this month"],
    "HEATWAVE": ["heatwave next week", "temperature rises by 5 celsius", "extreme heat for ten days"],
    "IRRIGATION_CHANGE": ["increase irrigation by 20 percent", "irrigation failure", "reduce drip irrigation"],
    "DISEASE_EVENT": ["tomato blight spreads", "disease outbreak", "fungal disease risk"],
    "PEST_OUTBREAK": ["pest outbreak", "insects damage crops", "aphid infestation"],
    "NUTRIENT_DEFICIENCY": ["nitrogen deficiency", "low fertilizer", "phosphorus is low"],
}


class AgriculturalAIService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.intent_pipeline = self._build_intent_pipeline()

    @staticmethod
    def _build_intent_pipeline() -> Pipeline:
        texts: list[str] = []
        labels: list[str] = []
        for intent, examples in INTENT_EXAMPLES.items():
            texts.extend(examples)
            labels.extend([intent] * len(examples))
        pipeline = Pipeline(
            [
                ("tfidf", TfidfVectorizer(ngram_range=(1, 2), lowercase=True, sublinear_tf=True)),
                ("classifier", LogisticRegression(max_iter=1_000, random_state=42, class_weight="balanced")),
            ]
        )
        pipeline.fit(texts, labels)
        return pipeline

    @property
    def has_remote_model(self) -> bool:
        return bool(self.settings.ai_api_key)

    async def _chat_json(self, system: str, prompt: str) -> dict[str, Any]:
        endpoint = f"{self.settings.ai_api_base_url.rstrip('/')}/chat/completions"
        body = {
            "model": self.settings.ai_model,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            "temperature": 0.1,
        }
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(endpoint, headers={"Authorization": f"Bearer {self.settings.ai_api_key}"}, json=body)
                response.raise_for_status()
            return json.loads(response.json()["choices"][0]["message"]["content"])
        except (httpx.HTTPError, KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
            raise AIServiceError("The configured AI service could not produce a valid scenario") from exc

    @staticmethod
    def _duration(text: str) -> int:
        match = re.search(r"(?:for|next|over|during)\s+(\d{1,3})\s+days?", text, re.IGNORECASE)
        return max(1, min(365, int(match.group(1)))) if match else 30

    @staticmethod
    def _percentage_after(text: str, terms: tuple[str, ...]) -> float | None:
        expression = "|".join(re.escape(term) for term in terms)
        match = re.search(rf"(?:{expression}).{{0,42}}?(\d{{1,3}}(?:\.\d+)?)\s*%", text, re.IGNORECASE)
        return float(match.group(1)) if match else None

    @staticmethod
    def _target_zones(text: str, farm: dict[str, Any] | None) -> list[str]:
        zones = (farm or {}).get("zones", [])
        if not zones:
            return []
        normalized_text = text.casefold()
        matches = [zone["zone_id"] for zone in zones if str(zone["name"]).casefold() in normalized_text or str(zone["zone_id"]).casefold() in normalized_text]
        return matches or [zone["zone_id"] for zone in zones]

    def _local_parse(self, text: str, farm: dict[str, Any] | None) -> dict[str, Any]:
        normalized = text.casefold()
        predicted_type = str(self.intent_pipeline.predict([text])[0])
        changes: dict[str, float] = {}
        rain_percent = self._percentage_after(text, ("rainfall", "rain", "drought"))
        temperature_match = re.search(r"(?:temperature|heat).{0,36}?(?:increase|rise|drop|decrease|by)\s*(\d+(?:\.\d+)?)\s*(?:°\s*c|celsius|c)?", normalized)
        irrigation_percent = self._percentage_after(text, ("irrigation", "water"))

        if any(term in normalized for term in ("drought", "drop", "decrease", "reduced", "less rain")) and ("rain" in normalized or "drought" in normalized):
            predicted_type = "RAIN_REDUCTION"
            changes["rainfall_multiplier"] = max(0.0, 1 - (rain_percent or 30.0) / 100)
        elif any(term in normalized for term in ("heavy rain", "more rain", "rainfall increase", "rainfall rises")):
            predicted_type = "RAIN_INCREASE"
            changes["rainfall_multiplier"] = 1 + (rain_percent or 20.0) / 100
        elif "heatwave" in normalized or ("temperature" in normalized and any(term in normalized for term in ("increase", "rise", "hotter"))):
            predicted_type = "HEATWAVE"
            delta = float(temperature_match.group(1)) if temperature_match else 4.0
            changes = {"temperature_delta": delta, "heatwave_days": float(self._duration(text))}
        elif "irrigation" in normalized or "water" in normalized:
            predicted_type = "IRRIGATION_CHANGE"
            if "fail" in normalized:
                changes["irrigation_multiplier"] = 0.0
            else:
                multiplier = 1 + (irrigation_percent or 20.0) / 100
                changes["irrigation_multiplier"] = multiplier if any(term in normalized for term in ("increase", "more")) else max(0.0, 2 - multiplier)
        elif any(term in normalized for term in ("disease", "blight", "fung")):
            predicted_type = "DISEASE_EVENT"
            changes["disease_pressure"] = 20.0
        elif any(term in normalized for term in ("pest", "aphid", "insect")):
            predicted_type = "PEST_OUTBREAK"
            changes["pest_pressure"] = 15.0
        elif any(term in normalized for term in ("nitrogen", "phosphorus", "potassium", "fertilizer", "nutrient")):
            predicted_type = "NUTRIENT_DEFICIENCY"
            changes["nitrogen_multiplier"] = 0.5 if "nitrogen" in normalized else 1.0
            changes["phosphorus_multiplier"] = 0.5 if "phosphorus" in normalized else 1.0
            changes["potassium_multiplier"] = 0.5 if "potassium" in normalized else 1.0
            if changes == {"nitrogen_multiplier": 1.0, "phosphorus_multiplier": 1.0, "potassium_multiplier": 1.0}:
                changes = {"nutrient_multiplier": 0.75}
        else:
            changes = {"rainfall_multiplier": 1.0}

        titles = {
            "RAIN_REDUCTION": "Reduced rainfall", "RAIN_INCREASE": "Increased rainfall", "HEATWAVE": "Heatwave",
            "IRRIGATION_CHANGE": "Irrigation adjustment", "DISEASE_EVENT": "Disease pressure", "PEST_OUTBREAK": "Pest outbreak",
            "NUTRIENT_DEFICIENCY": "Nutrient stress",
        }
        return {
            "name": titles.get(predicted_type, "Custom scenario"),
            "scenario_type": predicted_type,
            "duration_days": self._duration(text),
            "target_zones": self._target_zones(text, farm),
            "changes": changes,
            "natural_language_query": text,
        }

    async def parse_scenario(self, text: str, farm: dict[str, Any] | None = None) -> tuple[dict[str, Any], str]:
        local = self._local_parse(text, farm)
        if not self.has_remote_model:
            return local, "local_agronomy"
        try:
            remote = await self._chat_json(
                "Return only JSON: scenario_type, name, duration_days, target_zones, changes. changes must contain numeric values only. "
                "Use one of RAIN_REDUCTION, RAIN_INCREASE, HEATWAVE, IRRIGATION_CHANGE, DISEASE_EVENT, PEST_OUTBREAK, NUTRIENT_DEFICIENCY.",
                f"Known zones: {json.dumps([{'zone_id': z['zone_id'], 'name': z['name']} for z in (farm or {}).get('zones', [])])}\nRequest: {text}",
            )
            changes = {key: float(value) for key, value in (remote.get("changes") or {}).items() if isinstance(value, (int, float))}
            if changes:
                local.update({
                    "name": str(remote.get("name") or local["name"])[:120],
                    "scenario_type": str(remote.get("scenario_type") or local["scenario_type"]).upper(),
                    "duration_days": max(1, min(365, int(remote.get("duration_days") or local["duration_days"]))),
                    "changes": changes,
                })
            return local, "ai"
        except AIServiceError:
            return local, "local_agronomy"

    @staticmethod
    def _targets(assessment: FarmRiskAssessment, key: str, level: str) -> list[str]:
        return [zone.zone_id for zone in assessment.zone_risks if getattr(zone, key).level == level]

    async def suggest_scenarios(self, assessment: FarmRiskAssessment) -> tuple[list[ScenarioSuggestion], str]:
        suggestions: list[ScenarioSuggestion] = []
        definitions = [
            ("water_stress", "HIGH", "Simulate 30-day Drought", "Test the impact of a 30% rainfall reduction in water-stressed zones.", "RAIN_REDUCTION", 30, {"rainfall_multiplier": 0.7}),
            ("water_stress", "HIGH", "Increase Irrigation", "Test targeted irrigation to protect zones with severe water stress.", "IRRIGATION_CHANGE", 30, {"irrigation_multiplier": 1.25}),
            ("heat_stress", "HIGH", "Simulate Heatwave", "Test a seven-day 4°C heatwave in heat-stressed zones.", "HEATWAVE", 7, {"temperature_delta": 4.0, "heatwave_days": 7.0}),
            ("disease_risk", "HIGH", "Simulate Disease Spread", "Test disease pressure where humidity and crop conditions create high risk.", "DISEASE_EVENT", 14, {"disease_pressure": 20.0}),
            ("nutrient_risk", "HIGH", "Test Nitrogen Deficiency", "Measure yield sensitivity to reduced nitrogen availability.", "NUTRIENT_DEFICIENCY", 30, {"nitrogen_multiplier": 0.5}),
            ("water_stress", "MEDIUM", "Test Irrigation Efficiency", "Test a 20% irrigation reduction while monitoring crop health.", "IRRIGATION_CHANGE", 30, {"irrigation_multiplier": 0.8}),
        ]
        for risk_key, risk_level, title, description, scenario_type, duration, changes in definitions:
            targets = self._targets(assessment, risk_key, risk_level)
            if targets:
                suggestions.append(ScenarioSuggestion(
                    suggestion_id=f"{scenario_type.lower()}_{len(suggestions) + 1}", title=title, description=description,
                    priority=risk_level, scenario_type=scenario_type, duration_days=duration, target_zones=targets, changes=changes,
                ))
        if not suggestions:
            suggestions.append(ScenarioSuggestion(
                suggestion_id="irrigation_efficiency_1", title="Test Irrigation Efficiency", description="Evaluate whether a 20% irrigation reduction keeps conditions stable.",
                priority="LOW", scenario_type="IRRIGATION_CHANGE", duration_days=30,
                target_zones=[zone.zone_id for zone in assessment.zone_risks], changes={"irrigation_multiplier": 0.8},
            ))
        rank = {"HIGH": 2, "MEDIUM": 1, "LOW": 0}
        return sorted(suggestions, key=lambda item: rank[item.priority], reverse=True), "local_agronomy"

    @staticmethod
    def _impact(baseline: float, projected: float) -> MetricImpact:
        absolute = projected - baseline
        percentage = (absolute / baseline * 100) if baseline else (100.0 if absolute else 0.0)
        direction = "INCREASED" if absolute > 0.001 else "DECREASED" if absolute < -0.001 else "UNCHANGED"
        magnitude = abs(percentage)
        level = "SEVERE" if magnitude >= 20 else "MODERATE" if magnitude >= 5 else "NEGLIGIBLE"
        return MetricImpact(absolute_change=round(absolute, 2), percentage_change=round(percentage, 1), direction=direction, impact_level=level)

    @staticmethod
    def metrics_from_result(result: SimulationResult, summary: Any) -> ResultMetrics:
        hectares = result.farm_area_acres / 2.47105
        return ResultMetrics(
            yield_tons_per_ha=round(summary.total_expected_yield / hectares, 3),
            water_usage_liters=summary.total_water_usage,
            soil_health_index=summary.average_crop_health,
        )

    def explain_metrics(self, baseline: ResultMetrics, projected: ResultMetrics, scenario_type: str, duration_days: int) -> ExplanationResponse:
        yield_impact = self._impact(baseline.yield_tons_per_ha, projected.yield_tons_per_ha)
        water_impact = self._impact(baseline.water_usage_liters, projected.water_usage_liters)
        soil_impact = self._impact(baseline.soil_health_index, projected.soil_health_index)
        yield_words = "will improve" if yield_impact.direction == "INCREASED" else "will drop" if yield_impact.direction == "DECREASED" else "will remain nearly unchanged"
        summary = (
            f"Under the {scenario_type.replace('_', ' ').title()} scenario over {duration_days} days, yield {yield_words} "
            f"by {abs(yield_impact.absolute_change):.2f} tons/ha ({abs(yield_impact.percentage_change):.1f}%). "
            f"Water use {water_impact.direction.lower()} by {abs(water_impact.percentage_change):.1f}% and soil health "
            f"{soil_impact.direction.lower()} by {abs(soil_impact.absolute_change):.1f} points."
        )
        trade_offs: list[str] = []
        if yield_impact.direction == "DECREASED" and water_impact.direction == "DECREASED":
            trade_offs.append("Yield decreased, but water usage also decreased.")
        if yield_impact.direction == "INCREASED" and water_impact.direction == "INCREASED":
            trade_offs.append("Yield increased, but water usage also increased.")
        if soil_impact.direction == "DECREASED" and yield_impact.direction != "DECREASED":
            trade_offs.append("Short-term yield is stable or higher, but soil health declined.")
        recommendations: list[str] = []
        if yield_impact.direction == "DECREASED":
            recommendations.append("Prioritize targeted irrigation and monitor soil moisture in affected zones.")
        if soil_impact.direction == "DECREASED":
            recommendations.append("Check NPK availability and correct nutrient stress using a locally appropriate plan.")
        if water_impact.direction == "INCREASED":
            recommendations.append("Review irrigation scheduling to avoid unnecessary water demand.")
        if not recommendations:
            recommendations.append("Continue sensor monitoring and rerun the scenario when field conditions change.")
        return ExplanationResponse(
            summary=summary, explanation=summary, yield_impact=yield_impact, water_usage_impact=water_impact,
            soil_health_impact=soil_impact, trade_offs_detected=trade_offs, recommendations=recommendations[:3], source="local_agronomy",
        )

    async def explain_result(self, result: SimulationResult) -> ExplanationResponse:
        baseline_summary = result.baseline_summary or result.summary
        return self.explain_metrics(
            self.metrics_from_result(result, baseline_summary), self.metrics_from_result(result, result.summary),
            result.scenario_type, result.duration_days,
        )
