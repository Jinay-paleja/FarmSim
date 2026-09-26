"""Sensor-to-risk assessment service.

The model uses the requested scikit-learn preprocessing flow: crop/soil are
one-hot encoded, sensor values are standardized, and four risk labels are
predicted by a 100-tree multi-output random forest. It is deliberately kept at
this service boundary so a field-trained artifact can replace the bootstrap
calibration without changing routes, schemas, or the frontend contract.
"""

from __future__ import annotations

from itertools import product
from typing import Any

import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.multioutput import MultiOutputClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from ..schemas import FarmRiskAssessment, RiskFactor, RiskPrediction, ZoneRiskAssessment


RISK_LEVELS = ("LOW", "MEDIUM", "HIGH")
RISK_SCORE = {"LOW": 20.0, "MEDIUM": 55.0, "HIGH": 85.0}


def _bootstrap_label(
    moisture: float,
    temperature: float,
    humidity: float,
    rainfall: float,
    nitrogen: float,
    phosphorus: float,
    potassium: float,
) -> list[str]:
    """Conservative agronomy thresholds used to calibrate the starter model.

    This is not presented as a field-trained production dataset. Deployments
    with labelled local observations can replace the pipeline artifact while
    preserving the exact feature contract below.
    """
    nutrients = (nitrogen + phosphorus + potassium) / 3
    water = "HIGH" if moisture < 30 or (rainfall < 35 and temperature >= 32) else "MEDIUM" if moisture < 50 or rainfall < 60 else "LOW"
    heat = "HIGH" if temperature >= 35 else "MEDIUM" if temperature >= 31 else "LOW"
    disease = "HIGH" if humidity >= 82 and 20 <= temperature <= 33 else "MEDIUM" if humidity >= 70 else "LOW"
    nutrient = "HIGH" if nutrients < 30 else "MEDIUM" if nutrients < 52 else "LOW"
    return [water, heat, disease, nutrient]


class FarmRiskService:
    model_version = "bootstrap-rf-v1"

    def __init__(self) -> None:
        self.pipeline = self._build_pipeline()

    @staticmethod
    def _build_pipeline() -> Pipeline:
        crops = ("Tomato", "Wheat", "Soybean", "Rice", "Maize", "Potato")
        soils = ("Black", "Alluvial", "Red", "Laterite", "Arid")
        numerical_profiles = (
            (25, 37, 45, 20, 25, 25, 25),
            (43, 32, 62, 45, 45, 42, 45),
            (60, 27, 68, 85, 65, 60, 65),
            (78, 23, 86, 120, 75, 72, 75),
        )
        features: list[list[object]] = []
        labels: list[list[str]] = []
        for crop, soil, profile in product(crops, soils, numerical_profiles):
            features.append([crop, soil, *profile])
            labels.append(_bootstrap_label(*profile))

        preprocessor = ColumnTransformer(
            transformers=[
                ("categorical", OneHotEncoder(handle_unknown="ignore"), [0, 1]),
                ("numeric", StandardScaler(), [2, 3, 4, 5, 6, 7, 8]),
            ]
        )
        model = MultiOutputClassifier(
            RandomForestClassifier(n_estimators=100, random_state=42, class_weight="balanced", n_jobs=1)
        )
        pipeline = Pipeline([("preprocess", preprocessor), ("model", model)])
        pipeline.fit(np.asarray(features, dtype=object), np.asarray(labels, dtype=object))
        return pipeline

    @staticmethod
    def _prediction(level: str, probabilities: np.ndarray, classes: np.ndarray) -> RiskPrediction:
        confidence = float(probabilities[list(classes).index(level)]) if level in classes else 0.5
        # Blend model confidence with a UI-friendly severity score. The score
        # communicates risk magnitude, while confidence communicates certainty.
        return RiskPrediction(level=level, score=RISK_SCORE[level], confidence=round(confidence, 3))

    @staticmethod
    def _factors(zone: dict[str, Any]) -> list[RiskFactor]:
        candidates: list[RiskFactor] = []
        moisture = float(zone["soil_moisture"])
        temperature = float(zone["temperature"])
        humidity = float(zone["humidity"])
        rainfall = float(zone["rainfall"])
        nutrients = (float(zone["nitrogen"]) + float(zone["phosphorus"]) + float(zone["potassium"])) / 3
        if moisture < 50:
            candidates.append(RiskFactor(field="soil_moisture", value=moisture, contribution=round(min(100, (50 - moisture) * 2), 1), message="Soil moisture is below the preferred operating range."))
        if temperature > 30:
            candidates.append(RiskFactor(field="temperature", value=temperature, contribution=round(min(100, (temperature - 30) * 15), 1), message="Temperature is increasing heat and water demand."))
        if humidity > 70:
            candidates.append(RiskFactor(field="humidity", value=humidity, contribution=round(min(100, (humidity - 70) * 5), 1), message="High humidity can support disease development."))
        if rainfall < 60:
            candidates.append(RiskFactor(field="rainfall", value=rainfall, contribution=round(min(100, (60 - rainfall) * 1.5), 1), message="Recent rainfall is low for the current conditions."))
        if nutrients < 52:
            candidates.append(RiskFactor(field="npk_average", value=round(nutrients, 1), contribution=round(min(100, (52 - nutrients) * 2), 1), message="Average NPK availability may limit crop growth."))
        if not candidates:
            candidates.append(RiskFactor(field="conditions", value="stable", contribution=10, message="Current moisture, temperature, humidity and NPK conditions are within the starter model's preferred range."))
        return sorted(candidates, key=lambda item: item.contribution, reverse=True)[:3]

    def assess(self, farm: dict[str, Any]) -> FarmRiskAssessment:
        zones = farm.get("zones") or []
        if not zones:
            raise ValueError("A farm needs at least one zone before risk analysis")
        feature_rows = np.asarray(
            [
                [
                    zone["crop"], zone["soil"], zone["soil_moisture"], zone["temperature"], zone["humidity"],
                    zone["rainfall"], zone["nitrogen"], zone["phosphorus"], zone["potassium"],
                ]
                for zone in zones
            ],
            dtype=object,
        )
        labels = self.pipeline.predict(feature_rows)
        per_model_probabilities = self.pipeline.predict_proba(feature_rows)
        classifiers = self.pipeline.named_steps["model"].estimators_
        zone_risks: list[ZoneRiskAssessment] = []
        for row_index, zone in enumerate(zones):
            risk_predictions = [
                self._prediction(str(labels[row_index][risk_index]), per_model_probabilities[risk_index][row_index], classifiers[risk_index].classes_)
                for risk_index in range(4)
            ]
            zone_risks.append(
                ZoneRiskAssessment(
                    zone_id=zone["zone_id"],
                    zone_name=zone["name"],
                    water_stress=risk_predictions[0],
                    heat_stress=risk_predictions[1],
                    disease_risk=risk_predictions[2],
                    nutrient_risk=risk_predictions[3],
                    top_contributing_factors=self._factors(zone),
                )
            )
        highest = max(
            (prediction.level for zone in zone_risks for prediction in (zone.water_stress, zone.heat_stress, zone.disease_risk, zone.nutrient_risk)),
            key=lambda level: RISK_LEVELS.index(level),
        )
        return FarmRiskAssessment(
            farm_id=farm["farm_id"],
            overall_risk=highest,
            zone_risks=zone_risks,
            model_version=self.model_version,
        )
