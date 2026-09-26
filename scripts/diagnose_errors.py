import pandas as pd
from sklearn.model_selection import train_test_split
import joblib

df = pd.read_csv("data/scenario_training.csv")
X = df["text"].values
y = df["label"].values
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
pipe = joblib.load("app/models/scenario_classifier.joblib")
y_pred = pipe.predict(X_test)

print("--- Misclassified Test Samples ---")
for text, true_l, pred_l in zip(X_test, y_test, y_pred):
    if true_l != pred_l:
        print(f"[{true_l} -> {pred_l}]: '{text}'")
