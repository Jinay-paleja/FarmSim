"""
Module: Custom ML Estimators for Farm Risk
Provides LabelEncodedXGBClassifier to wrap XGBoost for multi-class targets ('LOW', 'MEDIUM', 'HIGH')
in scikit-learn MultiOutputClassifier pipelines.
"""

from typing import Any, Dict, List, Optional
import numpy as np
from sklearn.base import BaseEstimator, ClassifierMixin
from xgboost import XGBClassifier

CLASS_LABELS = np.array(["LOW", "MEDIUM", "HIGH"])
LABEL_TO_INT = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}
INT_TO_LABEL = {0: "LOW", 1: "MEDIUM", 2: "HIGH"}


class LabelEncodedXGBClassifier(BaseEstimator, ClassifierMixin):
    """
    Scikit-learn compatible wrapper around XGBClassifier that handles string labels
    ['LOW', 'MEDIUM', 'HIGH'] by internally mapping them to [0, 1, 2].
    """

    def __init__(
        self,
        n_estimators: int = 100,
        max_depth: int = 6,
        learning_rate: float = 0.1,
        subsample: float = 0.8,
        colsample_bytree: float = 0.8,
        random_state: int = 42,
        n_jobs: int = -1,
        eval_metric: str = "mlogloss",
        **kwargs: Any,
    ):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate
        self.subsample = subsample
        self.colsample_bytree = colsample_bytree
        self.random_state = random_state
        self.n_jobs = n_jobs
        self.eval_metric = eval_metric
        self.kwargs = kwargs

        self.model_ = XGBClassifier(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            learning_rate=self.learning_rate,
            subsample=self.subsample,
            colsample_bytree=self.colsample_bytree,
            random_state=self.random_state,
            n_jobs=self.n_jobs,
            eval_metric=self.eval_metric,
            **self.kwargs,
        )
        self.classes_ = CLASS_LABELS

    def fit(self, X: Any, y: Any) -> "LabelEncodedXGBClassifier":
        self.classes_ = CLASS_LABELS
        # Map string classes to integer labels
        y_arr = np.asarray(y)
        y_int = np.array([LABEL_TO_INT.get(str(val), 0) for val in y_arr], dtype=int)
        self.model_.fit(X, y_int)
        return self

    def predict(self, X: Any) -> np.ndarray:
        y_int = self.model_.predict(X)
        return np.array([INT_TO_LABEL.get(int(idx), "LOW") for idx in y_int])

    def predict_proba(self, X: Any) -> np.ndarray:
        return self.model_.predict_proba(X)

    @property
    def feature_importances_(self) -> np.ndarray:
        return self.model_.feature_importances_
