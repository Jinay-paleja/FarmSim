"""
Script: Train Farm Risk Multi-Output Model
Responsibility:
- Ingest synthetic farm telemetry from data/risk_training.csv.
- Preprocess numerical and categorical features into a unified scikit-learn Pipeline.
- Train a MultiOutputClassifier wrapping a RandomForestClassifier across 4 targets:
    1. water_stress
    2. heat_stress
    3. disease_risk
    4. nutrient_risk
- Compute and print evaluation metrics (Accuracy, Macro Precision, Recall, F1, Confusion Matrices).
- Compute and save top feature importances per target to data/risk_feature_importance.json.
- Serialize the full inference pipeline to app/models/farm_risk_model.joblib.

DISCLAIMER:
This model is a hackathon prototype decision-support tool trained on synthetic domain data.
It is not a scientifically validated agricultural risk predictor.
"""

import json
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.multioutput import MultiOutputClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# Target risk categories
TARGET_COLUMNS = [
    "water_stress",
    "heat_stress",
    "disease_risk",
    "nutrient_risk",
]

# Numeric and categorical feature sets
NUMERIC_FEATURES = [
    "soil_moisture",
    "temperature",
    "humidity",
    "rainfall",
    "nitrogen",
    "phosphorus",
    "potassium",
]

CATEGORICAL_FEATURES = [
    "crop",
    "soil",
    "growth_stage",
    "irrigation",
]

ALL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES


def load_and_validate_data(csv_path: str) -> pd.DataFrame:
    """Load and validate presence of all required columns."""
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Training dataset not found at {csv_path}. Run generate_risk_dataset.py first.")

    df = pd.read_csv(csv_path)
    required_cols = set(ALL_FEATURES + TARGET_COLUMNS)
    missing = required_cols - set(df.columns)
    if missing:
        raise ValueError(f"Dataset is missing required columns: {missing}")

    print(f"Loaded dataset: {len(df)} rows, {len(df.columns)} columns.")
    return df


def build_pipeline() -> Pipeline:
    """Build a unified scikit-learn Pipeline with ColumnTransformer and MultiOutputClassifier."""
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERIC_FEATURES),
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORICAL_FEATURES,
            ),
        ],
        remainder="drop",
    )

    base_rf = RandomForestClassifier(
        n_estimators=100,
        max_depth=16,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )

    multi_rf = MultiOutputClassifier(estimator=base_rf, n_jobs=-1)

    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", multi_rf),
        ]
    )
    return pipeline


def extract_feature_importance(pipeline: Pipeline, feature_names: list) -> dict:
    """Extract and rank feature importances for each individual risk target."""
    preprocessor = pipeline.named_steps["preprocessor"]
    transformed_feature_names = preprocessor.get_feature_names_out()

    classifier = pipeline.named_steps["classifier"]
    importance_report = {}

    for idx, target in enumerate(TARGET_COLUMNS):
        estimator = classifier.estimators_[idx]
        importances = estimator.feature_importances_

        feature_scores = []
        raw_feature_agg = {feat: 0.0 for feat in ALL_FEATURES}

        for name, score in zip(transformed_feature_names, importances):
            clean_name = name.replace("num__", "").replace("cat__", "")
            feature_scores.append({"feature": clean_name, "importance": round(float(score), 4)})

            # Attribute importance to raw feature
            matched_raw = None
            if name.startswith("num__"):
                matched_raw = name.replace("num__", "")
            elif name.startswith("cat__"):
                for cat_col in CATEGORICAL_FEATURES:
                    if name.startswith(f"cat__{cat_col}_"):
                        matched_raw = cat_col
                        break
            if matched_raw:
                raw_feature_agg[matched_raw] = raw_feature_agg.get(matched_raw, 0.0) + float(score)

        # Sort descending
        feature_scores.sort(key=lambda x: x["importance"], reverse=True)

        sorted_raw = [
            {"raw_feature": k, "aggregated_importance": round(v, 4)}
            for k, v in sorted(raw_feature_agg.items(), key=lambda x: x[1], reverse=True)
        ]

        importance_report[target] = {
            "top_encoded_features": feature_scores[:10],
            "raw_feature_importance": sorted_raw,
        }

    return importance_report


def main():
    csv_path = os.path.join("data", "risk_training.csv")
    model_output_path = os.path.join("app", "models", "farm_risk_model.joblib")
    importance_output_path = os.path.join("data", "risk_feature_importance.json")

    os.makedirs(os.path.dirname(model_output_path), exist_ok=True)
    os.makedirs(os.path.dirname(importance_output_path), exist_ok=True)

    df = load_and_validate_data(csv_path)

    X = df[ALL_FEATURES]
    y = df[TARGET_COLUMNS]

    # Train / test split (80% / 20%)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42
    )
    print(f"Training split: {len(X_train)} samples; Testing split: {len(X_test)} samples.")

    pipeline = build_pipeline()

    print("\nTraining MultiOutput Random Forest Pipeline...")
    pipeline.fit(X_train, y_train)
    print("Training complete.")

    print("\nEvaluating on test set...")
    y_pred = pipeline.predict(X_test)
    # y_pred is a 2D numpy array of shape (n_test, 4)

    metrics_summary = {}

    print("\n" + "=" * 65)
    print("           FARM RISK MODEL EVALUATION REPORT")
    print("=" * 65)

    for idx, target in enumerate(TARGET_COLUMNS):
        y_true_target = y_test[target].values
        y_pred_target = y_pred[:, idx]

        acc = accuracy_score(y_true_target, y_pred_target)
        prec = precision_score(y_true_target, y_pred_target, average="macro", zero_division=0)
        rec = recall_score(y_true_target, y_pred_target, average="macro", zero_division=0)
        f1 = f1_score(y_true_target, y_pred_target, average="macro", zero_division=0)
        labels = ["LOW", "MEDIUM", "HIGH"]
        cm = confusion_matrix(y_true_target, y_pred_target, labels=labels)

        metrics_summary[target] = {
            "accuracy": round(float(acc), 4),
            "macro_precision": round(float(prec), 4),
            "macro_recall": round(float(rec), 4),
            "macro_f1": round(float(f1), 4),
            "confusion_matrix": cm.tolist(),
            "confusion_matrix_labels": labels,
        }

        print(f"\n--- TARGET: {target.upper()} ---")
        print(f"  Accuracy:        {acc * 100:.2f}%")
        print(f"  Macro Precision: {prec * 100:.2f}%")
        print(f"  Macro Recall:    {rec * 100:.2f}%")
        print(f"  Macro F1-Score:  {f1 * 100:.2f}%")
        print("\n  Classification Report:")
        print(classification_report(y_true_target, y_pred_target, labels=labels, zero_division=0))
        print("  Confusion Matrix (rows: True, cols: Pred [LOW, MEDIUM, HIGH]):")
        print(f"    LOW:    {cm[0]}")
        print(f"    MEDIUM: {cm[1]}")
        print(f"    HIGH:   {cm[2]}")

    # Extract feature importances
    print("\nExtracting feature importances per target...")
    importance_data = extract_feature_importance(pipeline, ALL_FEATURES)

    with open(importance_output_path, "w", encoding="utf-8") as f:
        json.dump(importance_data, f, indent=2)
    print(f"Saved feature importances to {importance_output_path}")

    # Print top raw features per target
    print("\nTop 3 Driving Features per Risk Target:")
    for target in TARGET_COLUMNS:
        top3 = importance_data[target]["raw_feature_importance"][:3]
        desc = ", ".join([f"{item['raw_feature']} ({item['aggregated_importance']:.2f})" for item in top3])
        print(f"  {target.upper():<15}: {desc}")

    # Save model pipeline
    print(f"\nSaving model pipeline to {model_output_path}...")
    joblib.dump(pipeline, model_output_path)
    print("Model artifact successfully saved.")


if __name__ == "__main__":
    main()
