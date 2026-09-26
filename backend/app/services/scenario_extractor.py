"""
Service: Scenario Parameter & Entity Extractor
Responsibility:
- Deterministically normalize farmer natural language.
- Extract numerical magnitudes, multipliers, temperature deltas, durations, and target zones.
- Support COMBINED scenarios with multiple simultaneous perturbations.
- Return structured extraction results for Pydantic validation.
"""

import re
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.scenario import Scenario, ScenarioChanges, ScenarioType

# Mapping word-based numbers to integers
WORD_TO_NUMBER = {
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
    "twenty": 20,
    "twenty-five": 25,
    "twenty five": 25,
    "thirty": 30,
    "thirty-five": 35,
    "thirty five": 35,
    "forty": 40,
    "forty-five": 45,
    "forty five": 45,
    "fifty": 50,
    "sixty": 60,
    "seventy": 70,
    "seventy-five": 75,
    "seventy five": 75,
    "eighty": 80,
    "ninety": 90,
    "hundred": 100,
    "one hundred": 100,
}

SCENARIO_NAME_MAP = {
    ScenarioType.RAIN_REDUCTION: "Rainfall Reduction",
    ScenarioType.RAIN_INCREASE: "Rainfall Increase",
    ScenarioType.TEMPERATURE_INCREASE: "Temperature Increase",
    ScenarioType.HEATWAVE: "Heatwave Simulation",
    ScenarioType.IRRIGATION_INCREASE: "Irrigation Increase",
    ScenarioType.IRRIGATION_DECREASE: "Irrigation Decrease",
    ScenarioType.IRRIGATION_FAILURE: "Irrigation Failure",
    ScenarioType.FERTILIZER_CHANGE: "Fertilizer Adjustment",
    ScenarioType.NUTRIENT_DEFICIENCY: "Nutrient Deficiency",
    ScenarioType.DISEASE_OUTBREAK: "Disease Outbreak",
    ScenarioType.PEST_OUTBREAK: "Pest Outbreak",
    ScenarioType.SOIL_MOISTURE_CHANGE: "Soil Moisture Alteration",
    ScenarioType.COMBINED: "Combined Agricultural Scenario",
}


def normalize_text(text: str) -> str:
    """
    Lightweight, deterministic text normalizer for farmer queries.
    Standardizes percentages, temperature notations, durations, and contractions.
    """
    if not text:
        return ""

    t = text.lower().strip()

    # Expand contractions
    contractions = {
        r"\bwhat's\b": "what is",
        r"\bcan't\b": "cannot",
        r"\bwon't\b": "will not",
        r"\bit's\b": "it is",
        r"\bthere's\b": "there is",
        r"\bdon't\b": "do not",
        r"\bdoesn't\b": "does not",
        r"\bdidn't\b": "did not",
        r"\bwe're\b": "we are",
        r"\bi'm\b": "i am",
        r"\blet's\b": "let us",
    }
    for pattern, repl in contractions.items():
        t = re.sub(pattern, repl, t)

    # Normalize percentage tokens
    t = re.sub(r"\bpercentage\b", "%", t)
    t = re.sub(r"\bpercent\b", "%", t)
    t = re.sub(r"\bpct\b", "%", t)

    # Normalize word numbers followed by % (e.g. "twenty %" -> "20%")
    for word, num in sorted(WORD_TO_NUMBER.items(), key=lambda x: -len(x[0])):
        t = re.sub(rf"\b{word}\s*%", f"{num}%", t)

    # Normalize temperature tokens
    t = re.sub(r"\bdegrees?\s+celsius\b", "°c", t)
    t = re.sub(r"\bdegree\s+celsius\b", "°c", t)
    t = re.sub(r"\bdegrees?\s+c\b", "°c", t)
    t = re.sub(r"\bdegree\s+c\b", "°c", t)
    t = re.sub(r"\bcelsius\b", "°c", t)
    t = re.sub(r"\bdegrees?\b", "°c", t)

    # Normalize word numbers followed by °c (e.g. "three °c" -> "3°c")
    for word, num in sorted(WORD_TO_NUMBER.items(), key=lambda x: -len(x[0])):
        t = re.sub(rf"\b{word}\s*°c\b", f"{num}°c", t)

    # Normalize colloquial duration expressions
    t = re.sub(r"\ba\s+week\b", "7 days", t)
    t = re.sub(r"\bone\s+week\b", "7 days", t)
    t = re.sub(r"\btwo\s+weeks\b", "14 days", t)
    t = re.sub(r"\b2\s+weeks\b", "14 days", t)
    t = re.sub(r"\bthree\s+weeks\b", "21 days", t)
    t = re.sub(r"\b3\s+weeks\b", "21 days", t)
    t = re.sub(r"\bfour\s+weeks\b", "28 days", t)
    t = re.sub(r"\b4\s+weeks\b", "28 days", t)
    t = re.sub(r"\ba\s+month\b", "30 days", t)
    t = re.sub(r"\bone\s+month\b", "30 days", t)
    t = re.sub(r"\b1\s+month\b", "30 days", t)
    t = re.sub(r"\btwo\s+months\b", "60 days", t)
    t = re.sub(r"\b2\s+months\b", "60 days", t)

    # Collapse multiple whitespaces
    t = re.sub(r"\s+", " ", t)
    return t.strip()


def detect_multiple_perturbations(norm_text: str) -> bool:
    """
    Detect whether text specifies 2 or more distinct agricultural perturbation types
    (e.g. rainfall reduction + temperature rise, or drought + heatwave).
    """
    count = 0
    # Rainfall
    if re.search(r"\b(?:rain|rainfall|precipitation|drought|dry\s+spell)\b", norm_text):
        count += 1
    # Temperature / Heatwave
    if re.search(r"\b(?:temperature|temp|heatwave|heat\s+wave|degrees?|°c|hotter|warming)\b", norm_text):
        count += 1
    # Irrigation / Pump
    if re.search(r"\b(?:irrigation|watering|irrigate|pump|borewell|tube\s+well)\b", norm_text):
        count += 1
    # Fertilizer
    if re.search(r"\b(?:fertilizer|urea|npk|dap)\b", norm_text):
        count += 1
    # Pest
    if re.search(r"\b(?:pest|locust|armyworm|aphid|borer|insects?)\b", norm_text):
        count += 1
    # Disease
    if re.search(r"\b(?:disease|blight|rust|powdery\s+mildew|pathogen)\b", norm_text):
        count += 1
    # Soil moisture
    if re.search(r"\b(?:soil\s+moisture|ground\s+moisture)\b", norm_text):
        count += 1

    return count >= 2


def extract_duration(normalized_text: str) -> Optional[int]:
    """
    Extract duration in days from normalized text.
    """
    # 1. "for/over/next X days"
    m = re.search(r"\b(?:for|over|next|lasting|duration\s+of)\s+(\d+)\s*days?\b", normalized_text)
    if m:
        val = int(m.group(1))
        return val if val > 0 else None

    # 2. "X-day heatwave/drought/spell"
    m = re.search(r"\b(\d+)\s*-?\s*days?\s+(?:heatwave|heat\s+wave|dry\s+spell|drought|scenario|simulation|shock|event)\b", normalized_text)
    if m:
        val = int(m.group(1))
        return val if val > 0 else None

    # 3. Any explicit "X days"
    m = re.search(r"\b(\d+)\s*days?\b", normalized_text)
    if m:
        val = int(m.group(1))
        return val if val > 0 else None

    return None


def extract_target_zones(text: str) -> List[str]:
    """
    Extract target zone identifiers from text (e.g. ['zone-2'] or ['zone-1', 'zone-3']).
    Returns empty list if whole-farm or no zone specified.
    """
    t = text.lower()

    # Farm-wide expressions imply all zones -> return empty list as per schema
    if re.search(r"\b(?:all\s+zones|whole\s+farm|entire\s+farm|across\s+all\s+fields|farm-wide)\b", t):
        return []

    zones = []

    # Match numeric zone combinations: "zones 1 and 3", "zone 1 & 2"
    m_multi = re.findall(r"\bzones?\s+(\d+)(?:\s*(?:and|&|,)\s*(\d+))*\b", t)
    if m_multi:
        for match in m_multi:
            for num in match:
                if num and f"zone-{num}" not in zones:
                    zones.append(f"zone-{num}")

    # Match individual "zone X" or "plot X"
    if not zones:
        for m in re.finditer(r"\b(?:zone|plot)\s+(\d+)\b", t):
            z = f"zone-{m.group(1)}"
            if z not in zones:
                zones.append(z)

    # Match named zones: "north zone", "north field", "south plot", "east orchard"
    m_named = re.findall(r"\b(north|south|east|west)\s+(zone|field|plot|orchard)\b", t)
    for direction, entity in m_named:
        named_z = f"{direction}-{entity}"
        if named_z not in zones:
            zones.append(named_z)

    return zones


def _parse_percentage_value(val_str: str) -> float:
    """Safely parse percentage numeric string into float."""
    try:
        return float(val_str)
    except ValueError:
        return 0.0


def extract_scenario_parameters(
    raw_text: str,
    scenario_type: ScenarioType,
) -> Tuple[ScenarioChanges, Optional[int], List[str], List[str]]:
    """
    Extract numerical parameters, duration, and target zones for a given ScenarioType.

    Returns:
        (changes, duration_days, target_zones, missing_parameters)
    """
    norm_text = normalize_text(raw_text)
    duration_days = extract_duration(norm_text)
    target_zones = extract_target_zones(raw_text)

    changes_dict: Dict[str, Any] = {}
    missing_parameters: List[str] = []

    # Check for duration requirement
    if duration_days is None:
        missing_parameters.append("duration_days")

    # Helper extractors
    def find_rainfall_multiplier() -> Optional[float]:
        # Handle "half the rainfall" / "cut in half"
        if re.search(r"\b(?:half\s+(?:the\s+)?(?:rain|rainfall)|cut\s+(?:rain|rainfall)\s+in\s+half|precipitation\s+drops\s+by\s+half)\b", norm_text):
            return 0.50

        # Pattern: reduction
        m_red = re.search(
            r"(?:reduce|decrease|drop|cut|less|lower|deficit|reduction)\s+(?:of\s+)?(?:seasonal\s+|annual\s+)?(?:rain|rainfall|precipitation)\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*%",
            norm_text
        )
        if not m_red:
            m_red = re.search(r"(?:rain|rainfall|precipitation)\s+(?:decreases?|drops?|falls?|is cut|down|reduced?)\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*%", norm_text)
        if not m_red:
            m_red = re.search(r"(\d+(?:\.\d+)?)\s*%\s*(?:less|reduction in|drop in|cut in|decrease in)\s+(?:seasonal\s+)?(?:rain|rainfall|precipitation)", norm_text)

        if m_red:
            pct = _parse_percentage_value(m_red.group(1))
            return max(0.0, round(1.0 - (pct / 100.0), 4))

        # Pattern: increase
        m_inc = re.search(
            r"(?:increase|surge|boost|more|excess|surplus)\s+(?:in\s+)?(?:rain|rainfall|precipitation)\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*%",
            norm_text
        )
        if not m_inc:
            m_inc = re.search(r"(?:rain|rainfall|precipitation)\s+(?:increases?|surges?|up|rises?)\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*%", norm_text)
        if not m_inc:
            m_inc = re.search(r"(\d+(?:\.\d+)?)\s*%\s*(?:more|increase in|surge in|excess)\s+(?:rain|rainfall|precipitation)", norm_text)

        if m_inc:
            pct = _parse_percentage_value(m_inc.group(1))
            return round(1.0 + (pct / 100.0), 4)

        return None

    def find_temperature_delta() -> Optional[float]:
        # Positive delta
        m_pos = re.search(r"(?:temperature|temp)\s+(?:increases?|rises?|climbs?|goes up|up)\s+(?:by\s+)?\+?(\d+(?:\.\d+)?)\s*°c", norm_text)
        if not m_pos:
            m_pos = re.search(r"(?:increase|rise|warming|elevation)\s+(?:in\s+)?temperature\s+(?:by\s+)?\+?(\d+(?:\.\d+)?)\s*°c", norm_text)
        if not m_pos:
            m_pos = re.search(r"\+?(\d+(?:\.\d+)?)\s*°c\s*(?:warming|temperature increase|rise|hotter|increase)", norm_text)
        if not m_pos:
            m_pos = re.search(r"(?:weather\s+gets\s+)(\d+(?:\.\d+)?)\s*°c\s*hotter", norm_text)
        if m_pos:
            return round(float(m_pos.group(1)), 2)

        # Negative delta
        m_neg = re.search(r"(?:temperature|temp)\s+(?:decreases?|drops?|falls?|cools?)\s+(?:by\s+)?-?(\d+(?:\.\d+)?)\s*°c", norm_text)
        if not m_neg:
            m_neg = re.search(r"(?:decrease|drop|cooling)\s+(?:in\s+)?temperature\s+(?:by\s+)?-?(\d+(?:\.\d+)?)\s*°c", norm_text)
        if m_neg:
            return round(-float(m_neg.group(1)), 2)

        return None

    def find_irrigation_multiplier() -> Optional[float]:
        if re.search(r"\b(?:double\s+(?:the\s+)?irrigation|doubling\s+irrigation|double\s+watering)\b", norm_text):
            return 2.0
        if re.search(r"\b(?:half\s+(?:the\s+)?irrigation|cut\s+irrigation\s+(?:in\s+)?half)\b", norm_text):
            return 0.50

        # Increase
        m_inc = re.search(r"(?:increase|boost|more|raise|additional|extra)\s+(?:drip\s+|sprinkler\s+)?(?:irrigation|watering)\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*%", norm_text)
        if not m_inc:
            m_inc = re.search(r"(?:irrigation|watering)\s+(?:increased?|boosted?|up|raised?)\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*%", norm_text)
        if not m_inc:
            m_inc = re.search(r"(\d+(?:\.\d+)?)\s*%\s*(?:more|extra|additional|increase in)\s+(?:irrigation|watering)", norm_text)
        if m_inc:
            pct = _parse_percentage_value(m_inc.group(1))
            return round(1.0 + (pct / 100.0), 4)

        # Decrease
        m_dec = re.search(r"(?:reduce|decrease|cut|lower|curtail|less)\s+(?:drip\s+|sprinkler\s+)?(?:irrigation|watering)\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*%", norm_text)
        if not m_dec:
            m_dec = re.search(r"(?:irrigation|watering)\s+(?:decreased?|reduced?|cut|down|lowered?)\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*%", norm_text)
        if not m_dec:
            m_dec = re.search(r"(\d+(?:\.\d+)?)\s*%\s*(?:less|reduction in|cut in|decrease in)\s+(?:irrigation|watering)", norm_text)
        if m_dec:
            pct = _parse_percentage_value(m_dec.group(1))
            return max(0.0, round(1.0 - (pct / 100.0), 4))

        return None

    def find_fertilizer_multiplier() -> Optional[float]:
        # Decrease
        m_dec = re.search(r"(?:reduce|cut|decrease|lower|less)\s+(?:chemical\s+|npk\s+|urea\s+)?fertilizer\s+(?:application\s+|dose\s+|usage\s+)?(?:by\s+)?(\d+(?:\.\d+)?)\s*%", norm_text)
        if not m_dec:
            m_dec = re.search(r"fertilizer\s+(?:application\s+|dose\s+)?(?:reduced?|decreased?|cut)\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*%", norm_text)
        if not m_dec:
            m_dec = re.search(r"(\d+(?:\.\d+)?)\s*%\s*(?:less|cut in|reduction in)\s+fertilizer", norm_text)
        if m_dec:
            pct = _parse_percentage_value(m_dec.group(1))
            return max(0.0, round(1.0 - (pct / 100.0), 4))

        # Increase
        m_inc = re.search(r"(?:increase|boost|more|raise)\s+(?:chemical\s+|npk\s+|urea\s+)?fertilizer\s+(?:application\s+|dose\s+)?(?:by\s+)?(\d+(?:\.\d+)?)\s*%", norm_text)
        if not m_inc:
            m_inc = re.search(r"(\d+(?:\.\d+)?)\s*%\s*(?:more|increase in)\s+fertilizer", norm_text)
        if m_inc:
            pct = _parse_percentage_value(m_inc.group(1))
            return round(1.0 + (pct / 100.0), 4)

        return None

    def find_soil_moisture_delta() -> Optional[float]:
        m_dec = re.search(r"(?:reduce|decrease|drop)\s+soil\s+moisture\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*%", norm_text)
        if not m_dec:
            m_dec = re.search(r"soil\s+moisture\s+(?:drops?|decreases?|falls?|reduction)\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*%", norm_text)
        if not m_dec:
            m_dec = re.search(r"soil\s+moisture\s+(?:delta\s+of\s+)?(?:negative|minus|-)\s*(\d+(?:\.\d+)?)\s*%", norm_text)
        if m_dec:
            return -float(m_dec.group(1))

        m_inc = re.search(r"(?:increase|raise)\s+soil\s+moisture\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*%", norm_text)
        if not m_inc:
            m_inc = re.search(r"soil\s+moisture\s+(?:delta\s+of\s+)?(?:positive|plus|\+)\s*(\d+(?:\.\d+)?)\s*%", norm_text)
        if m_inc:
            return float(m_inc.group(1))

        return None

    # Handle each scenario type
    if scenario_type == ScenarioType.RAIN_REDUCTION:
        mult = find_rainfall_multiplier()
        if mult is None:
            # Fallback: any standalone percentage in a rain reduction query
            m_generic = re.search(r"\b(\d+(?:\.\d+)?)\s*%", norm_text)
            if m_generic:
                pct = _parse_percentage_value(m_generic.group(1))
                mult = max(0.0, round(1.0 - (pct / 100.0), 4))
        if mult is not None:
            changes_dict["rainfall_multiplier"] = mult
        else:
            missing_parameters.append("rainfall_reduction_amount")

    elif scenario_type == ScenarioType.RAIN_INCREASE:
        mult = find_rainfall_multiplier()
        if mult is None:
            m_generic = re.search(r"\b(\d+(?:\.\d+)?)\s*%", norm_text)
            if m_generic:
                pct = _parse_percentage_value(m_generic.group(1))
                mult = round(1.0 + (pct / 100.0), 4)
        if mult is not None:
            changes_dict["rainfall_multiplier"] = mult
        else:
            missing_parameters.append("rainfall_increase_amount")

    elif scenario_type == ScenarioType.TEMPERATURE_INCREASE:
        delta = find_temperature_delta()
        if delta is None:
            # Standalone degree number in temperature increase
            m_generic = re.search(r"\b\+?(\d+(?:\.\d+)?)\s*°c\b", norm_text)
            if m_generic:
                delta = float(m_generic.group(1))
        if delta is not None:
            changes_dict["temperature_delta"] = delta
        else:
            missing_parameters.append("temperature_delta")

    elif scenario_type == ScenarioType.HEATWAVE:
        delta = find_temperature_delta()
        if delta is not None:
            changes_dict["temperature_delta"] = delta

    elif scenario_type == ScenarioType.IRRIGATION_INCREASE:
        mult = find_irrigation_multiplier()
        if mult is None:
            m_generic = re.search(r"\b(\d+(?:\.\d+)?)\s*%", norm_text)
            if m_generic:
                pct = _parse_percentage_value(m_generic.group(1))
                mult = round(1.0 + (pct / 100.0), 4)
        if mult is not None:
            changes_dict["irrigation_multiplier"] = mult
        else:
            missing_parameters.append("increase_amount")

    elif scenario_type == ScenarioType.IRRIGATION_DECREASE:
        mult = find_irrigation_multiplier()
        if mult is None:
            m_generic = re.search(r"\b(\d+(?:\.\d+)?)\s*%", norm_text)
            if m_generic:
                pct = _parse_percentage_value(m_generic.group(1))
                mult = max(0.0, round(1.0 - (pct / 100.0), 4))
        if mult is not None:
            changes_dict["irrigation_multiplier"] = mult
        else:
            missing_parameters.append("decrease_amount")

    elif scenario_type == ScenarioType.IRRIGATION_FAILURE:
        changes_dict["irrigation_multiplier"] = 0.0

    elif scenario_type == ScenarioType.FERTILIZER_CHANGE:
        mult = find_fertilizer_multiplier()
        if mult is None:
            m_generic = re.search(r"\b(\d+(?:\.\d+)?)\s*%", norm_text)
            if m_generic:
                pct = _parse_percentage_value(m_generic.group(1))
                # Default to reduction if reduction words present, else increase
                if re.search(r"\b(?:reduce|cut|decrease|lower|less)\b", norm_text):
                    mult = max(0.0, round(1.0 - (pct / 100.0), 4))
                else:
                    mult = round(1.0 + (pct / 100.0), 4)
        if mult is not None:
            changes_dict["fertilizer_multiplier"] = mult
        else:
            missing_parameters.append("fertilizer_change_amount")

    elif scenario_type == ScenarioType.DISEASE_OUTBREAK:
        # Default disease pressure index
        m_pct = re.search(r"\b(\d+(?:\.\d+)?)\s*%", norm_text)
        if m_pct:
            changes_dict["disease_pressure"] = round(_parse_percentage_value(m_pct.group(1)) / 100.0, 2)
        else:
            changes_dict["disease_pressure"] = 1.0

    elif scenario_type == ScenarioType.PEST_OUTBREAK:
        # Default pest pressure index
        m_pct = re.search(r"\b(\d+(?:\.\d+)?)\s*%", norm_text)
        if m_pct:
            changes_dict["pest_pressure"] = round(_parse_percentage_value(m_pct.group(1)) / 100.0, 2)
        else:
            changes_dict["pest_pressure"] = 1.0

    elif scenario_type == ScenarioType.SOIL_MOISTURE_CHANGE:
        delta = find_soil_moisture_delta()
        if delta is None:
            m_pct = re.search(r"\b(\d+(?:\.\d+)?)\s*%", norm_text)
            if m_pct:
                val = float(m_pct.group(1))
                delta = -val if re.search(r"\b(?:reduce|decrease|drop|down)\b", norm_text) else val
        if delta is not None:
            changes_dict["soil_moisture_delta"] = delta
        else:
            missing_parameters.append("soil_moisture_delta")

    elif scenario_type == ScenarioType.COMBINED:
        # Scan for all potential simultaneous changes
        rain_mult = find_rainfall_multiplier()
        if rain_mult is not None:
            changes_dict["rainfall_multiplier"] = rain_mult

        temp_delta = find_temperature_delta()
        if temp_delta is not None:
            changes_dict["temperature_delta"] = temp_delta

        irrig_mult = find_irrigation_multiplier()
        if irrig_mult is not None:
            changes_dict["irrigation_multiplier"] = irrig_mult

        fert_mult = find_fertilizer_multiplier()
        if fert_mult is not None:
            changes_dict["fertilizer_multiplier"] = fert_mult

        if re.search(r"\b(?:disease|blight|rust|infection|pathogen)\b", norm_text):
            changes_dict["disease_pressure"] = 1.0

        if re.search(r"\b(?:pest|locust|armyworm|aphid|insects?)\b", norm_text):
            changes_dict["pest_pressure"] = 1.0

        soil_delta = find_soil_moisture_delta()
        if soil_delta is not None:
            changes_dict["soil_moisture_delta"] = soil_delta

        if not changes_dict:
            missing_parameters.append("combined_shock_parameters")

    changes = ScenarioChanges(**changes_dict)
    return changes, duration_days, target_zones, missing_parameters


def build_scenario(
    raw_text: str,
    scenario_type: ScenarioType,
) -> Tuple[Optional[Scenario], List[str]]:
    """
    Construct a validated Scenario model from natural language text and predicted ScenarioType.
    If required magnitude changes are missing, returns None for scenario.
    If duration is missing but changes are present, returns Scenario with duration_days=None.

    Returns:
        (scenario, missing_parameters)
    """
    changes, duration_days, target_zones, missing_params = extract_scenario_parameters(
        raw_text,
        scenario_type,
    )

    name = SCENARIO_NAME_MAP.get(scenario_type, "Agricultural Scenario")

    # If critical change magnitude is missing for types that require a specific value
    requires_magnitude = {
        ScenarioType.RAIN_REDUCTION,
        ScenarioType.RAIN_INCREASE,
        ScenarioType.TEMPERATURE_INCREASE,
        ScenarioType.IRRIGATION_INCREASE,
        ScenarioType.IRRIGATION_DECREASE,
        ScenarioType.FERTILIZER_CHANGE,
        ScenarioType.SOIL_MOISTURE_CHANGE,
    }
    has_magnitude_missing = scenario_type in requires_magnitude and any(p != "duration_days" for p in missing_params)
    has_combined_empty = scenario_type == ScenarioType.COMBINED and not changes.model_dump(exclude_none=True)

    if has_magnitude_missing or has_combined_empty:
        return None, missing_params

    scenario = Scenario(
        scenario_type=scenario_type,
        name=name,
        description=raw_text.strip(),
        duration_days=duration_days,
        target_zones=target_zones,
        changes=changes,
    )
    return scenario, missing_params
