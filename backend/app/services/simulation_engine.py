"""Deterministic agronomy simulation engine.

The API deliberately delegates here through ``simulate_farm(farm, scenario)``.
It is a standalone module so a more sophisticated crop model can replace it
without rewriting HTTP handlers or database code.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from ..schemas import SimulationSummary, TimelinePoint, ZoneTimeline


class SimulationEngineError(RuntimeError):
    pass


CROP_YIELD_TONNES_PER_ACRE = {
    "tomato": 10.0,
    "wheat": 1.3,
    "rice": 1.6,
    "soybean": 1.2,
    "maize": 2.0,
    "potato": 8.0,
    "cotton": 0.8,
    "sugarcane": 18.0,
}

IRRIGATION_LITRES_PER_ACRE_DAY = {
    "drip": 2_400.0,
    "sprinkler": 3_000.0,
    "flood": 4_300.0,
    "furrow": 3_600.0,
    "rain-fed": 0.0,
    "rainfed": 0.0,
    "center pivot": 3_200.0,
}


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _round(value: float) -> float:
    return round(value, 2)


def _scenario_effects(changes: dict[str, float]) -> dict[str, float]:
    """Normalize the canonical scenario change map into simulation inputs."""
    effects = {
        "rainfall_multiplier": 1.0,
        "temperature_delta": 0.0,
        "irrigation_multiplier": 1.0,
        "nutrient_multiplier": 1.0,
        "nitrogen_multiplier": 1.0,
        "phosphorus_multiplier": 1.0,
        "potassium_multiplier": 1.0,
        "disease_pressure": 0.0,
        "pest_pressure": 0.0,
        "heatwave_days": 0.0,
    }
    for key, raw_value in changes.items():
        value = float(raw_value)
        normalized = key.lower()
        if normalized in effects:
            effects[normalized] = value
        elif normalized == "rainfall_change_percent":
            effects["rainfall_multiplier"] = 1 + value / 100
        elif normalized == "temperature_change_c":
            effects["temperature_delta"] = value
        elif normalized == "irrigation_change_percent":
            effects["irrigation_multiplier"] = max(0.0, 1 + value / 100)
        elif normalized == "fertilizer_change_percent":
            effects["nutrient_multiplier"] = max(0.0, 1 + value / 100)
        elif normalized == "disease_event":
            effects["disease_pressure"] += value * 18
        elif normalized == "pest_event":
            effects["pest_pressure"] += value * 14
    return effects


def _weighted_average(values: Iterable[tuple[float, float]]) -> float:
    values = list(values)
    total_weight = sum(weight for _, weight in values)
    return sum(value * weight for value, weight in values) / total_weight if total_weight else 0.0


def simulate_farm(farm: dict[str, Any], scenario: dict[str, Any] | None = None) -> tuple[list[TimelinePoint], SimulationSummary]:
    """Simulate each farm zone and return a chart-ready timeline and summary.

    Changes affect water balance, temperature stress, nutrients, disease risk,
    crop health and yield potential on every simulated day. The calculation is
    deterministic: the same farm and scenario always give the same result.
    """
    zones = farm.get("zones", [])
    if not zones:
        raise SimulationEngineError("A farm needs at least one zone before it can be simulated")

    scenario = scenario or {}
    duration = int(scenario.get("duration_days", 30))
    if not 1 <= duration <= 365:
        raise SimulationEngineError("Scenario duration must be between 1 and 365 days")
    target_zones = set(scenario.get("target_zones") or [zone["zone_id"] for zone in zones])
    effects = _scenario_effects(scenario.get("changes", {}))

    states: list[dict[str, float | str | dict[str, Any]]] = []
    for zone in zones:
        area = float(zone["area_acres"])
        if area <= 0:
            raise SimulationEngineError(f"Zone {zone['zone_id']} has an invalid area")
        crop = str(zone["crop"]).lower()
        states.append(
            {
                "zone": zone,
                "area": area,
                "moisture": float(zone["soil_moisture"]),
                "health": float(zone.get("health_score") or 78.0),
                "disease": float(zone.get("disease_risk") or 12.0),
                "yield_potential": 90.0,
                "crop": crop,
                "water_total": 0.0,
            }
        )

    timeline: list[TimelinePoint] = []
    for day in range(1, duration + 1):
        day_zones: list[ZoneTimeline] = []
        for state in states:
            zone = state["zone"]  # type: ignore[assignment]
            assert isinstance(zone, dict)
            is_target = zone["zone_id"] in target_zones
            modifier = effects if is_target else _scenario_effects({})
            temperature = float(zone["temperature"]) + modifier["temperature_delta"]
            if is_target and day <= modifier["heatwave_days"]:
                temperature += 5.0
            rainfall_per_day = float(zone["rainfall"]) / 30.0 * modifier["rainfall_multiplier"]
            irrigation_method = str(zone["irrigation"]).lower()
            base_irrigation = IRRIGATION_LITRES_PER_ACRE_DAY.get(irrigation_method, 2_800.0)
            water = base_irrigation * float(state["area"]) * modifier["irrigation_multiplier"]
            state["water_total"] = float(state["water_total"]) + water

            # Soil moisture is a balance of rain/irrigation gains and
            # evapotranspiration. Humidity moderates temperature-driven loss.
            evaporation = 1.5 + max(0.0, temperature - 20.0) * 0.15 + (100 - float(zone["humidity"])) * 0.015
            moisture_gain = rainfall_per_day * 0.55 + (water / max(float(state["area"]), 0.1)) / 900.0
            state["moisture"] = _clamp(float(state["moisture"]) + moisture_gain - evaporation)

            moisture_stress = abs(float(state["moisture"]) - 65.0) / 35.0
            temperature_stress = max(0.0, abs(temperature - 26.0) - 5.0) / 16.0
            nutrient_multiplier = modifier["nutrient_multiplier"]
            nutrients = (
                float(zone["nitrogen"]) * nutrient_multiplier * modifier["nitrogen_multiplier"]
                + float(zone["phosphorus"]) * nutrient_multiplier * modifier["phosphorus_multiplier"]
                + float(zone["potassium"]) * nutrient_multiplier * modifier["potassium_multiplier"]
            ) / 3.0
            nutrient_stress = max(0.0, (55.0 - nutrients) / 55.0)
            humid_disease_factor = max(0.0, float(zone["humidity"]) - 65.0) / 35.0
            disease_growth = humid_disease_factor * 1.1 + max(0.0, temperature - 30.0) * 0.12
            disease_growth += modifier["disease_pressure"] / max(duration, 1)
            state["disease"] = _clamp(float(state["disease"]) + disease_growth - 0.18)

            total_stress = moisture_stress * 1.1 + temperature_stress + nutrient_stress * 0.7
            total_stress += float(state["disease"]) / 100.0 * 0.45 + modifier["pest_pressure"] / 100.0
            recovery = 0.16 if total_stress < 0.35 else 0.0
            state["health"] = _clamp(float(state["health"]) + recovery - total_stress * 1.35)
            state["yield_potential"] = _clamp(float(state["yield_potential"]) - total_stress * 0.26)

            day_zones.append(
                ZoneTimeline(
                    zone_id=str(zone["zone_id"]),
                    zone_name=str(zone["name"]),
                    soil_moisture=_round(float(state["moisture"])),
                    crop_health=_round(float(state["health"])),
                    disease_risk=_round(float(state["disease"])),
                    water_consumption=_round(water),
                    expected_yield=_round(float(state["yield_potential"])),
                )
            )

        timeline.append(
            TimelinePoint(
                day=day,
                label=f"Day {day}",
                soil_moisture=_round(_weighted_average((item.soil_moisture, float(state["area"])) for item, state in zip(day_zones, states))),
                crop_health=_round(_weighted_average((item.crop_health, float(state["area"])) for item, state in zip(day_zones, states))),
                disease_risk=_round(_weighted_average((item.disease_risk, float(state["area"])) for item, state in zip(day_zones, states))),
                water_consumption=_round(sum(item.water_consumption for item in day_zones)),
                expected_yield=_round(_weighted_average((item.expected_yield, float(state["area"])) for item, state in zip(day_zones, states))),
                zones=day_zones,
            )
        )

    last = timeline[-1]
    total_yield = sum(
        CROP_YIELD_TONNES_PER_ACRE.get(str(state["crop"]), 1.5)
        * float(state["area"])
        * float(state["yield_potential"])
        / 100.0
        for state in states
    )
    summary = SimulationSummary(
        total_water_usage=_round(sum(float(state["water_total"]) for state in states)),
        average_crop_health=last.crop_health,
        average_disease_risk=last.disease_risk,
        total_expected_yield=_round(total_yield),
        average_soil_moisture=last.soil_moisture,
    )
    return timeline, summary
