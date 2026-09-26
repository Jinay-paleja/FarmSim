"""
Service: Farm Risk Analyzer
Responsibility:
- Ingest farm state and zone telemetry.
- Run local MultiOutput RandomForest inference pipeline for 4 agronomic risk dimensions:
    1. WATER_STRESS
    2. HEAT_STRESS
    3. DISEASE_RISK
    4. NUTRIENT_RISK
- Calculate zone-level primary threats, risk scores, contributing factors, and confidence probabilities.
- Compute farm-wide risk level with transparent aggregation logic.
- Generate practical agronomic mitigations.

DISCLAIMER:
This risk analysis is a prototype decision-support tool trained on synthetic domain rules.
It does not constitute certified agricultural advice.
"""

import os
from datetime import datetime
from typing import Any, Dict, List, Optional
import joblib
import pandas as pd
from app.schemas.farm import FarmState, Zone
from app.schemas.result import RiskLevel, RiskResult, ZoneRisk
from app.services.risk_models import LabelEncodedXGBClassifier

MODELS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "models",
)
RF_MODEL_PATH = os.path.join(MODELS_DIR, "farm_risk_model.joblib")
XGB_MODEL_PATH = os.path.join(MODELS_DIR, "farm_risk_xgboost.joblib")
MODEL_PATH = RF_MODEL_PATH  # Backwards compatibility

TARGET_COLUMNS = [
    "water_stress",
    "heat_stress",
    "disease_risk",
    "nutrient_risk",
]

_cached_models: Dict[str, Any] = {}


def get_risk_model(model_type: Optional[str] = None):
    """
    Load and cache the trained MultiOutput inference pipeline.
    
    Args:
        model_type: 'rf' for Random Forest or 'xgboost'/'xgb' for Extreme Gradient Boosting.
                   Defaults to FARM_RISK_MODEL_TYPE env var or 'rf'.
    """
    selected_type = (model_type or os.getenv("FARM_RISK_MODEL_TYPE", "rf")).lower().strip()
    if selected_type in ["xgboost", "xgb"]:
        target_key = "xgboost"
        target_path = os.getenv("FARM_RISK_XGB_MODEL_PATH", XGB_MODEL_PATH)
    else:
        target_key = "rf"
        target_path = os.getenv("FARM_RISK_MODEL_PATH", RF_MODEL_PATH)

    if target_key not in _cached_models:
        if not os.path.exists(target_path):
            raise FileNotFoundError(
                f"Farm risk model ({target_key}) artifact not found at '{target_path}'. "
                f"Please run the appropriate training script to generate the model."
            )
        _cached_models[target_key] = joblib.load(target_path)
    return _cached_models[target_key]


def zone_to_feature_dict(zone: Zone) -> dict:
    """Extract model feature dictionary from a Zone schema."""
    return {
        "soil_moisture": float(zone.soil_moisture),
        "temperature": float(zone.temperature),
        "humidity": float(zone.humidity),
        "rainfall": float(zone.rainfall),
        "nitrogen": float(zone.nitrogen),
        "phosphorus": float(zone.phosphorus),
        "potassium": float(zone.potassium),
        "crop": str(zone.crop),
        "soil": str(zone.soil),
        "growth_stage": str(zone.growth_stage),
        "irrigation": str(zone.irrigation),
    }


def identify_contributing_factors(zone: Zone, risks: Dict[str, str]) -> List[str]:
    """Generate explainable, farmer-readable agronomic factors triggering risks."""
    factors = []

    # Water stress factors
    if risks.get("water_stress") in ["HIGH", "MEDIUM"]:
        if zone.soil_moisture < 16.0:
            factors.append(f"Critical soil moisture deficit ({zone.soil_moisture:.1f}% v/v)")
        elif zone.soil_moisture < 22.0:
            factors.append(f"Sub-optimal soil moisture ({zone.soil_moisture:.1f}% v/v)")
        if zone.rainfall < 2.0:
            factors.append("No significant precipitation recorded")
        if zone.irrigation == "Rainfed":
            factors.append("Rainfed cultivation without supplementary irrigation buffer")

    # Heat stress factors
    if risks.get("heat_stress") in ["HIGH", "MEDIUM"]:
        if zone.temperature >= 35.0:
            factors.append(f"High ambient thermal stress ({zone.temperature:.1f}°C)")
        elif zone.temperature >= 30.0:
            factors.append(f"Elevated temperature ({zone.temperature:.1f}°C) exceeding optimal range for {zone.crop}")
        if zone.growth_stage in ["Flowering", "Grain Filling"]:
            factors.append(f"{zone.growth_stage} stage is hypersensitive to temperature extremes")

    # Disease risk factors
    if risks.get("disease_risk") in ["HIGH", "MEDIUM"]:
        if zone.humidity >= 75.0:
            factors.append(f"High canopy humidity ({zone.humidity:.1f}%) fostering fungal spore germination")
        if zone.rainfall >= 10.0 or zone.irrigation == "Sprinkler":
            factors.append("Persistent surface canopy wetness from rain or overhead sprinkler")
        if 20.0 <= zone.temperature <= 30.0:
            factors.append("Warm temperatures within optimal fungal incubation range")

    # Nutrient risk factors
    if risks.get("nutrient_risk") in ["HIGH", "MEDIUM"]:
        if zone.nitrogen < 20.0:
            factors.append(f"Available soil Nitrogen severely depleted ({zone.nitrogen:.1f} ppm)")
        if zone.phosphorus < 12.0:
            factors.append(f"Available Phosphorus deficient ({zone.phosphorus:.1f} ppm)")
        if zone.potassium < 100.0:
            factors.append(f"Available Potassium deficient ({zone.potassium:.1f} ppm)")

    if not factors:
        factors.append("Environmental and soil parameters are within nominal agronomic thresholds")

    return factors


def determine_primary_threat(risks: Dict[str, str], probabilities: Dict[str, float]) -> str:
    """Determine the single most pressing agronomic hazard for a zone."""
    threat_titles = {
        "water_stress": "Severe Soil Moisture Deficit",
        "heat_stress": "Critical Heat Shock / Canopy Stress",
        "disease_risk": "Elevated Fungal / Pathogen Disease Pressure",
        "nutrient_risk": "Severe Soil Nutrient Depletion",
    }

    # Check for HIGH risks first, prioritizing highest model confidence
    high_risks = [k for k, v in risks.items() if v == "HIGH"]
    if high_risks:
        best_high = max(high_risks, key=lambda k: probabilities.get(k, 0.5))
        return threat_titles[best_high]

    # Check for MEDIUM risks
    med_risks = [k for k, v in risks.items() if v == "MEDIUM"]
    if med_risks:
        best_med = max(med_risks, key=lambda k: probabilities.get(k, 0.5))
        return threat_titles[best_med].replace("Severe", "Moderate").replace("Critical", "Moderate").replace("Elevated", "Moderate")

    return "Nominal Conditions / No Immediate Threat"


def calculate_zone_risk_score(risks: Dict[str, str], probabilities: Dict[str, float]) -> float:
    """Compute normalized composite risk index (0.0 to 1.0) for a zone."""
    weights = {"HIGH": 0.85, "MEDIUM": 0.45, "LOW": 0.10}
    scores = []
    for target in TARGET_COLUMNS:
        tier = risks.get(target, "LOW")
        base = weights.get(tier, 0.10)
        prob = probabilities.get(target, 0.5)
        # Modulate slightly by model confidence
        scores.append(base * (0.8 + 0.4 * prob))

    composite = sum(scores) / len(scores)
    return round(float(min(1.0, max(0.0, composite))), 3)


def aggregate_zone_risk_level(risks: Dict[str, str]) -> RiskLevel:
    """Transparent aggregation rule for a single zone."""
    high_count = sum(1 for v in risks.values() if v == "HIGH")
    med_count = sum(1 for v in risks.values() if v == "MEDIUM")

    if high_count >= 2:
        return RiskLevel.HIGH
    if high_count == 1:
        return RiskLevel.HIGH
    if med_count >= 1:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


def aggregate_farm_risk_level(zone_risks: List[ZoneRisk]) -> RiskLevel:
    """
    Transparent aggregation rule across all farm zones:
    - If ANY zone is HIGH -> Overall farm is HIGH
    - Else if ANY zone is MEDIUM -> Overall farm is MEDIUM
    - Else -> LOW
    """
    if any(zr.risk_level == RiskLevel.HIGH for zr in zone_risks):
        return RiskLevel.HIGH
    if any(zr.risk_level == RiskLevel.MEDIUM for zr in zone_risks):
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


def generate_suggested_mitigations(zone_risks: List[ZoneRisk]) -> List[str]:
    """Generate practical, actionable farm management suggestions."""
    mitigations = []

    has_water_stress = any(zr.water_stress in [RiskLevel.HIGH, RiskLevel.MEDIUM] for zr in zone_risks)
    has_heat_stress = any(zr.heat_stress in [RiskLevel.HIGH, RiskLevel.MEDIUM] for zr in zone_risks)
    has_disease_risk = any(zr.disease_risk in [RiskLevel.HIGH, RiskLevel.MEDIUM] for zr in zone_risks)
    has_nutrient_risk = any(zr.nutrient_risk in [RiskLevel.HIGH, RiskLevel.MEDIUM] for zr in zone_risks)

    if has_water_stress:
        mitigations.append("Initiate supplemental irrigation (drip or pivot) to restore root zone moisture.")
    if has_heat_stress:
        mitigations.append("Schedule night irrigation or canopy misting to alleviate daytime thermal shock.")
    if has_disease_risk:
        mitigations.append("Apply preventive fungicide spray and avoid overhead sprinkler wetting during humid spells.")
    if has_nutrient_risk:
        mitigations.append("Schedule targeted fertilizer top-dressing or fertigation to correct macronutrient deficiencies.")

    if not mitigations:
        mitigations.append("Maintain standard irrigation and nutrient schedules; current conditions are optimal.")

    return mitigations


def analyze_risk(farm_state: FarmState, model_type: Optional[str] = None) -> RiskResult:
    """
    Analyze the current farm state across all zones to identify agronomic risks.

    Args:
        farm_state: Current snapshot of the farm including zone metrics and weather.
        model_type: Optional model type ('rf' or 'xgboost'). Defaults to 'rf'.

    Returns:
        RiskResult: Complete agronomic risk analysis with zone breakdowns and mitigation advice.
    """
    model = get_risk_model(model_type=model_type)

    if not farm_state.zones:
        return RiskResult(
            farm_id=farm_state.farm_id,
            overall_risk_level=RiskLevel.LOW,
            zone_risks=[],
            critical_factors=["No zones provided for analysis."],
            suggested_mitigations=[],
        )

    # 1. Prepare feature DataFrame for all zones
    records = [zone_to_feature_dict(z) for z in farm_state.zones]
    df_features = pd.DataFrame(records)

    # 2. Run multi-output inference
    predictions_2d = model.predict(df_features)
    probabilities_list = model.predict_proba(df_features)

    classifier = model.named_steps["classifier"]
    zone_results: List[ZoneRisk] = []
    all_critical_factors: List[str] = []

    for i, zone in enumerate(farm_state.zones):
        # Extract predictions for this zone
        zone_preds = {
            TARGET_COLUMNS[j]: str(predictions_2d[i, j])
            for j in range(len(TARGET_COLUMNS))
        }

        # Extract confidence probability for the predicted class
        zone_probs = {}
        for j, target in enumerate(TARGET_COLUMNS):
            estimator_classes = list(classifier.estimators_[j].classes_)
            predicted_class = zone_preds[target]
            class_idx = estimator_classes.index(predicted_class)
            prob_val = float(probabilities_list[j][i, class_idx])
            zone_probs[target] = round(prob_val, 3)

        factors = identify_contributing_factors(zone, zone_preds)
        primary_threat = determine_primary_threat(zone_preds, zone_probs)
        zone_score = calculate_zone_risk_score(zone_preds, zone_probs)
        zone_overall_tier = aggregate_zone_risk_level(zone_preds)

        # Collect critical factors for farm summary
        for f in factors:
            if f not in all_critical_factors and "nominal" not in f.lower():
                all_critical_factors.append(f"{zone.name or zone.zone_id}: {f}")

        zone_risk_item = ZoneRisk(
            zone_id=zone.zone_id,
            risk_level=zone_overall_tier,
            water_stress=RiskLevel(zone_preds["water_stress"]),
            heat_stress=RiskLevel(zone_preds["heat_stress"]),
            disease_risk=RiskLevel(zone_preds["disease_risk"]),
            nutrient_risk=RiskLevel(zone_preds["nutrient_risk"]),
            primary_threat=primary_threat,
            score=zone_score,
            contributing_factors=factors,
            risk_probabilities=zone_probs,
        )
        zone_results.append(zone_risk_item)

    # 3. Overall farm risk aggregation
    overall_farm_risk = aggregate_farm_risk_level(zone_results)
    mitigations = generate_suggested_mitigations(zone_results)

    if not all_critical_factors:
        all_critical_factors.append("All management zones operating within safe agronomic parameters.")

    return RiskResult(
        farm_id=farm_state.farm_id,
        overall_risk_level=overall_farm_risk,
        assessed_at=datetime.utcnow(),
        zone_risks=zone_results,
        critical_factors=all_critical_factors,
        suggested_mitigations=mitigations,
    )
