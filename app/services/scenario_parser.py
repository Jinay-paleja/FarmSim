"""
Service: Scenario Parser (Intent Classifier + Parameter Extractor)
Responsibility:
- Orchestrate end-to-end scenario understanding pipeline:
  1. Clean & normalize farmer text
  2. Classify scenario intent via TF-IDF + Logistic Regression
  3. Extract numerical multipliers, temperature deltas, duration, and target zones
  4. Construct & validate Scenario Pydantic model
  5. Apply confidence thresholding and missing parameter detection
"""

import os
from pathlib import Path
from typing import List, Optional
import joblib

from app.schemas.scenario import (
    ParseScenarioRequest,
    ParseScenarioResponse,
    ScenarioType,
    TopPrediction,
)
from app.services.scenario_extractor import build_scenario

# Global cached model pipeline instance
_CLASSIFIER_PIPELINE = None

# Default model location relative to project root
DEFAULT_MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "scenario_classifier.joblib"


def get_classifier_model(model_path: Optional[str] = None):
    """
    Load or retrieve the cached scikit-learn intent classifier pipeline.
    """
    global _CLASSIFIER_PIPELINE
    if _CLASSIFIER_PIPELINE is not None:
        return _CLASSIFIER_PIPELINE

    target_path = Path(model_path or os.getenv("SCENARIO_CLASSIFIER_MODEL_PATH", str(DEFAULT_MODEL_PATH)))

    if not target_path.exists():
        raise FileNotFoundError(
            f"Scenario classifier model not found at {target_path}. "
            "Please run 'python scripts/train_scenario_classifier.py' to train and serialize the model."
        )

    _CLASSIFIER_PIPELINE = joblib.load(target_path)
    return _CLASSIFIER_PIPELINE


def parse_scenario(request: ParseScenarioRequest) -> ParseScenarioResponse:
    """
    Classify a farmer's natural-language inquiry into a ScenarioType and extract all parameters.

    Args:
        request: ParseScenarioRequest with the query text.

    Returns:
        ParseScenarioResponse: Predicted scenario_type, confidence score,
        needs_clarification flag, missing_parameters, constructed Scenario object,
        and ranked top candidate predictions.
    """
    threshold = float(os.getenv("SCENARIO_CLASSIFIER_THRESHOLD", "0.60"))
    raw_query = request.query.strip() if request.query else ""

    # Guard against empty or blank queries
    if not raw_query:
        return ParseScenarioResponse(
            scenario_type=None,
            confidence=0.0,
            needs_clarification=True,
            missing_parameters=[],
            scenario=None,
            top_predictions=[],
        )

    model = get_classifier_model()
    classes = model.classes_
    probabilities = model.predict_proba([raw_query])[0]

    # Rank classes by descending probability
    sorted_indices = probabilities.argsort()[::-1]
    top_indices = sorted_indices[:3]

    top_predictions: List[TopPrediction] = [
        TopPrediction(
            scenario_type=ScenarioType(classes[idx]),
            confidence=round(float(probabilities[idx]), 4),
        )
        for idx in top_indices
    ]

    best_idx = sorted_indices[0]
    best_class = classes[best_idx]
    best_confidence = round(float(probabilities[best_idx]), 4)

    from app.services.scenario_extractor import detect_multiple_perturbations, normalize_text

    norm_query = normalize_text(raw_query)

    # If 2 or more distinct perturbations are present, this is a COMBINED scenario
    if detect_multiple_perturbations(norm_query):
        scenario_type = ScenarioType.COMBINED
        confidence = max(best_confidence, 0.88)
    else:
        # Check against classifier confidence threshold
        if best_confidence < threshold:
            return ParseScenarioResponse(
                scenario_type=None,
                confidence=best_confidence,
                needs_clarification=True,
                missing_parameters=None,
                scenario=None,
                top_predictions=top_predictions,
            )
        scenario_type = ScenarioType(best_class)
        confidence = best_confidence

    # 2. Extract parameters and construct Scenario
    scenario, missing_params = build_scenario(raw_query, scenario_type)

    needs_clarification = len(missing_params) > 0

    return ParseScenarioResponse(
        scenario_type=scenario_type,
        confidence=best_confidence,
        needs_clarification=needs_clarification,
        missing_parameters=missing_params if missing_params else [],
        scenario=scenario,
        top_predictions=top_predictions,
    )
