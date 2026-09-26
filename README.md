# FarmSim AI — Smart Agriculture Simulator & AI Intelligence Suite

A virtual farm simulator that empowers farmers to create farms, configure zones, run what-if scenarios, and view AI-powered simulation results and prescriptive interventions.

![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Vite](https://img.shields.io/badge/Vite-5-purple)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-green)
![Python](https://img.shields.io/badge/Python-3.11+-blue)
![XGBoost](https://img.shields.io/badge/XGBoost-2.0+-orange)
![Gemini](https://img.shields.io/badge/Google%20Gemini-Pro-blueviolet)

---

## 🌟 Application Features

- **Farm Creation** — Create farms with name, location, area, and coordinates
- **Zone Builder** — Divide your farm into zones, assign crops, configure soil and environment
- **Farm Dashboard** — View real-time metrics: soil moisture, crop health, disease risk, water usage
- **What-If Scenarios** — Simulate drought, heatwave, pest outbreak, and more
- **Simulation Results** — Timeline charts for soil moisture, crop health, disease risk, yield
- **Scenario Comparison** — Compare multiple simulations side-by-side
- **AI Explanations & Prescriptions** — Get natural language analysis, trade-off detection, and prescriptive optimization from the backend AI

---

## 🚀 Quick Start

### 1. Frontend Setup (React + Vite)

#### Prerequisites
- Node.js 18+ and npm

#### Install & Run
```bash
npm install
npm run dev
```
The web dashboard starts at **http://localhost:3000** (or **http://localhost:5173**).

---

### 2. Backend & AI Intelligence Setup (Python + FastAPI)

#### Prerequisites
- Python 3.10+ (Python 3.11 recommended)

#### Install & Run
```bash
# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate   # Windows
# or: source .venv/bin/activate # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Run the FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
The AI API starts at **http://localhost:8000** with interactive Swagger docs at **http://localhost:8000/docs**.

#### Run Automated Test Suite
```bash
pytest -v
```
All **124 tests** pass across unit, ML, and integration suites.

---

## 📁 Project Structure

```
FarmSim/
├── src/                          # Frontend React + TypeScript application
│   ├── App.tsx                   # Router and page routes
│   ├── main.tsx                  # Entry point
│   ├── index.css                 # Tailwind + custom styles
│   ├── types/                    # TypeScript interfaces & types
│   ├── services/                 # Frontend API client & mock data
│   ├── components/               # Layout and shared UI widgets
│   └── pages/                    # Farm, Zone, Scenario, and Result pages
│
├── app/                          # Person 3 AI & Scenario Intelligence Service
│   ├── main.py                   # FastAPI server entrypoint
│   ├── api/                      # Route handlers (/ai/*)
│   ├── schemas/                  # Pydantic schemas (Scenario, Farm, Risk, Prescriptions)
│   ├── services/                 # AI & Agronomic engines:
│   │   ├── scenario_parser.py    # Intent classifier & parameter extractor
│   │   ├── gemini_parser.py      # Google Gemini LLM structured output parser
│   │   ├── risk_analyzer.py      # Dual-engine farm risk classifier (RF / XGBoost)
│   │   ├── time_series_features.py # Cumulative GDD, VPD, dry spells & depletion
│   │   ├── prescriptive_optimizer.py # Prescriptive intervention optimizer
│   │   ├── temporal_risk_fusion.py # Multi-day telemetry risk fusion
│   │   ├── sensitivity_analyzer.py # Yield collapse tipping-point matrix
│   │   ├── scenario_suggester.py # Proactive stress-test generator
│   │   ├── result_analyzer.py    # Delta math, impact tiers & trade-offs
│   │   └── explanation.py        # Farmer plain-language explainer
│   └── models/                   # Serialized ML model binaries (.joblib)
│
├── data/                         # Synthetic training datasets & metrics
├── scripts/                      # Training, benchmarking & live testing utilities
└── tests/                        # 124 comprehensive automated tests
```

---

# 🌾 AI & Scenario Intelligence (Person 3 Module)

A modular, standalone intelligence service for the AI Agriculture Simulator. This module serves as the agronomic reasoning, risk analysis, and scenario generation engine that interacts between the farmer (natural language), the central backend, and Person 2's biophysical simulation engine.

## 🌾 Module Responsibilities

1. **Natural Language Scenario Parsing**: Understand farmer conversational requests (e.g., *"What if rainfall decreases by 30% for 45 days in zone 2?"*) and transform them into structured, validated scenario contracts.
2. **Scenario Schema Validation**: Ensure perturbations (temperature deltas, precipitation cuts, irrigation failures, nutrient stress, pest/disease pressure) adhere to strict physical boundaries before sending them to the simulation engine.
3. **Farm Risk Analysis**: Evaluate multi-zone telemetry (soil moisture, growth stage, ambient conditions, N-P-K nutrient levels) to identify imminent agronomic vulnerabilities with Dual-Engine ML (Random Forest or enterprise XGBoost).
4. **Intelligent "What-If" Suggestions**: Proactively formulate counter-factual scenarios and stress-tests tailored to current crop vulnerabilities.
5. **Farmer-Friendly Explanations**: Translate biophysical simulation outcomes (yield loss, water stress index, root-zone depletion) into clear, actionable advice.
6. **Time-Series Feature Engineering**: Cumulative Growing Degree Days (GDD), Vapor Pressure Deficit (VPD), dry spell streaks, and moisture loss velocity.
7. **Prescriptive Optimizer**: Multi-objective Pareto optimization that recommends the single most optimal intervention plan for the farmer.
8. **Temporal Risk Fusion**: Bridges snapshot sensor readings with 10-14 day weather trends.
9. **Sensitivity Matrix**: Calculates non-linear yield collapse tipping points.

---

## 🤖 Machine Learning Engines

### 1. Scenario Intent Classifier
- **Architecture**: `TfidfVectorizer` (sublinear term frequency, unigram & bigram features) + `LogisticRegression` (multinomial, balanced class weights, $C=8.0$, L-BFGS solver).
- **Supported Scenario Types (13 Classes)**: `RAIN_REDUCTION`, `RAIN_INCREASE`, `TEMPERATURE_INCREASE`, `HEATWAVE`, `IRRIGATION_INCREASE`, `IRRIGATION_DECREASE`, `IRRIGATION_FAILURE`, `FERTILIZER_CHANGE`, `NUTRIENT_DEFICIENCY`, `DISEASE_OUTBREAK`, `PEST_OUTBREAK`, `SOIL_MOISTURE_CHANGE`, `COMBINED`.
- **Model Artifact**: `app/models/scenario_classifier.joblib`
- **Training Dataset**: `data/scenario_training.csv` (803 curated samples, 98.7% test accuracy).

### 2. Dual-Engine Farm Risk Classifier (Random Forest + XGBoost)
Predicts risk across 4 independent biophysical dimensions: **Water Stress**, **Heat Stress**, **Disease Risk**, and **Nutrient Deficiency**.
- **Default Estimator (Random Forest)**: 100 trees, 58.9 MB (`app/models/farm_risk_model.joblib`).
- **High-Accuracy Estimator (XGBoost)**: Gradient boosted trees, 4.1 MB (`app/models/farm_risk_xgboost.joblib`, 94-96% accuracy).

| Target Risk Dimension | Random Forest Acc | XGBoost Acc | RF Macro F1 | XGBoost Macro F1 |
|---|---|---|---|---|
| **WATER STRESS** | 91.92% | **94.38%** | 80.68% | **87.22%** |
| **HEAT STRESS** | 92.58% | **96.50%** | 74.18% | **91.25%** |
| **DISEASE RISK** | 92.50% | **94.90%** | 86.85% | **91.65%** |
| **NUTRIENT RISK** | 94.38% | **95.68%** | 82.74% | **89.40%** |

### 3. Google Gemini Structured Output Parser (Pro Mode)
- **Model**: `gemini-2.5-flash` with strict Pydantic `Scenario` schema.
- **Resilience**: Zero-downtime automatic fallback to local NLP engine when offline or if API key is omitted.

---

## ⚡ Key AI Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/ai/parse-scenario` | Natural language scenario parsing (Local TF-IDF + Regex or Gemini LLM) |
| `POST` | `/ai/analyze-risk` | Farm multi-zone risk assessment (`rf` or `xgboost` engine) |
| `POST` | `/ai/suggest-scenarios` | Proactive what-if stress-test scenario generator |
| `POST` | `/ai/analyze-simulation` | Biophysical simulation result analysis, deltas, and trade-off detection |
| `POST` | `/ai/explain-result` | Plain-language farmer-friendly explanation & recommendations |
| `POST` | `/ai/compare-simulations` | Side-by-side multi-scenario comparative ranking |
| `POST` | `/ai/time-series-features` | Cumulative GDD, VPD, rolling precipitation, drought severity index |
| `POST` | `/ai/prescribe-intervention` | Prescriptive multi-objective optimizer delivering the single optimal plan |
| `POST` | `/ai/analyze-temporal-risk` | Temporal risk fusion combining point-in-time ML with 14-day history |
| `POST` | `/ai/sensitivity-analysis` | FAO-33 break-even stress matrix and agronomic tipping points |
| `GET`  | `/health` | System health probe and model availability status |

---

## 🧪 Testing & Verification

Run the full automated test suite:
```bash
pytest -v
```

Run the end-to-end interactive demonstration:
```bash
python scripts/test_end_to_end.py
```

---

## 📄 License

Built for hackathon demonstration purposes.
