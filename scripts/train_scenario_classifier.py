"""
Training script for the Scenario Intent Classifier.

Architecture:
- TfidfVectorizer (word-level, 1-2 ngrams, sublinear_tf)
- LogisticRegression (multinomial, balanced class weights, C=8.0)
- Serialized to app/models/scenario_classifier.joblib
- Evaluated on stratified 20% test holdout
- Metrics exported to data/scenario_classifier_metrics.json
"""

import json
import os
import sys
from pathlib import Path
import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.schemas.scenario import ScenarioType


def train_classifier(
    data_path: str = "data/scenario_training.csv",
    model_output_path: str = "app/models/scenario_classifier.joblib",
    metrics_output_path: str = "data/scenario_classifier_metrics.json",
    test_size: float = 0.20,
    random_state: int = 42,
):
    print(f"--- Step 1: Loading dataset from {data_path} ---")
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Training dataset not found at {data_path}")

    df = pd.read_csv(data_path)
    print(f"Total dataset records: {len(df)}")

    valid_labels = {e.value for e in ScenarioType}
    dataset_labels = set(df["label"].unique())
    invalid_labels = dataset_labels - valid_labels
    if invalid_labels:
        raise ValueError(f"Dataset contains invalid labels: {invalid_labels}")

    missing_labels = valid_labels - dataset_labels
    if missing_labels:
        print(f"Warning: Scenario classes missing from dataset: {missing_labels}")

    print(f"All {len(dataset_labels)} dataset classes match ScenarioType enum.")

    X = df["text"].values
    y = df["label"].values

    print(f"\n--- Step 2: Stratified Train/Test Split ({int((1-test_size)*100)}/{int(test_size*100)}) ---")
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        stratify=y,
        random_state=random_state,
    )
    print(f"Training samples: {len(X_train)}")
    print(f"Testing samples:  {len(X_test)}")

    print("\n--- Step 3: Constructing & Training scikit-learn Pipeline ---")
    pipeline = Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    ngram_range=(1, 2),
                    sublinear_tf=True,
                    lowercase=True,
                    strip_accents="unicode",
                    max_features=8000,
                ),
            ),
            (
                "clf",
                LogisticRegression(
                    C=8.0,
                    class_weight="balanced",
                    max_iter=1000,
                    random_state=random_state,
                    solver="lbfgs",
                ),
            ),
        ]
    )

    pipeline.fit(X_train, y_train)
    print("Pipeline training completed.")

    print("\n--- Step 4: Evaluating on Unseen Test Set ---")
    y_pred = pipeline.predict(X_test)

    acc = accuracy_score(y_test, y_pred)
    prec_macro = precision_score(y_test, y_pred, average="macro", zero_division=0)
    rec_macro = recall_score(y_test, y_pred, average="macro", zero_division=0)
    f1_macro = f1_score(y_test, y_pred, average="macro", zero_division=0)
    f1_weighted = f1_score(y_test, y_pred, average="weighted", zero_division=0)

    print(f"Test Accuracy:         {acc:.4f} ({acc*100:.2f}%)")
    print(f"Macro Precision:       {prec_macro:.4f}")
    print(f"Macro Recall:          {rec_macro:.4f}")
    print(f"Macro F1 Score:        {f1_macro:.4f}")
    print(f"Weighted F1 Score:     {f1_weighted:.4f}")

    unique_classes = sorted(list(pipeline.classes_))
    clf_report_dict = classification_report(
        y_test,
        y_pred,
        labels=unique_classes,
        output_dict=True,
        zero_division=0,
    )
    clf_report_str = classification_report(
        y_test,
        y_pred,
        labels=unique_classes,
        zero_division=0,
    )
    print("\nClassification Report:")
    print(clf_report_str)

    conf_mat = confusion_matrix(y_test, y_pred, labels=unique_classes)
    print("\nConfusion Matrix:")
    print(f"Labels order: {unique_classes}")
    print(conf_mat)

    print(f"\n--- Step 5: Saving Model to {model_output_path} ---")
    os.makedirs(os.path.dirname(model_output_path), exist_ok=True)
    joblib.dump(pipeline, model_output_path)
    print("Model serialized successfully.")

    print(f"\n--- Step 6: Saving Metrics to {metrics_output_path} ---")
    os.makedirs(os.path.dirname(metrics_output_path), exist_ok=True)
    metrics_data = {
        "dataset_total": len(df),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "num_classes": len(unique_classes),
        "classes": unique_classes,
        "metrics": {
            "accuracy": float(acc),
            "macro_precision": float(prec_macro),
            "macro_recall": float(rec_macro),
            "macro_f1": float(f1_macro),
            "weighted_f1": float(f1_weighted),
        },
        "classification_report": clf_report_dict,
        "confusion_matrix": conf_mat.tolist(),
    }
    with open(metrics_output_path, "w", encoding="utf-8") as f:
        json.dump(metrics_data, f, indent=2)
    print("Metrics JSON saved successfully.")

    return pipeline, metrics_data


if __name__ == "__main__":
    train_classifier()
