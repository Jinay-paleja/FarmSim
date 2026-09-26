# FarmSim AI Agriculture Simulator

FarmSim is a working full-stack virtual-farm application. A farmer creates a farm, adds crop zones and their conditions, runs baseline or what-if scenarios, receives a simulated daily timeline, compares runs, and gets an agricultural explanation.

```
React frontend → FastAPI → AI scenario service → simulation_engine.simulate_farm()
              ← persisted results ← Firebase Cloud Firestore (or SQLite fallback)
```

The API's canonical contract is `snake_case`; the existing React client translates it once in [`src/services/api.ts`](src/services/api.ts) to keep the UI's camelCase view models stable.

## Firebase Cloud Firestore Integration (`farmsim-e8973`)

FarmSim AI uses **Firebase Cloud Firestore** (project ID: `farmsim-e8973`, region `asia-south1`) as its primary real database persistence layer.

### 1. Service Account Credential Setup
1. Generate a Firebase Admin SDK service account JSON key file in the Firebase Console:
   - Go to **Project Settings** → **Service accounts**
   - Click **Generate new private key**
2. Place the generated JSON key file inside the `backend` folder as `firebase-service-account.json`:
   ```
   c:\Users\Manik\OneDrive\Desktop\Farmsim\backend\firebase-service-account.json
   ```
   *(Note: This credential file is automatically ignored in `.gitignore` and must never be committed to Git).*

### 2. Backend `.env` Configuration
Configure `backend/.env` (copy from `backend/.env.example`):

```env
STORAGE_MODE=firebase
DATABASE_URL=firestore://
FIREBASE_PROJECT_ID=farmsim-e8973
FIREBASE_CREDENTIALS_FILE=./firebase-service-account.json

AI_API_KEY=
AI_MODEL=gpt-4.1-mini
AI_API_BASE_URL=https://api.openai.com/v1
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 3. Firestore Collections Schema
The backend stores documents in the following Cloud Firestore collections:
- **`farms/{farm_id}`**: Farm entity (`farm_id`, `name`, `location`, `area_acres`, `number_of_zones`, `latitude`, `longitude`, `created_at`, `updated_at`).
- **`zones/{zone_id}`**: Crop field entity (`zone_id`, `farm_id`, `name`, `area_acres`, `crop`, `soil`, `growth_stage`, `irrigation`, `soil_moisture`, `temperature`, `humidity`, `rainfall`, `nitrogen`, `phosphorus`, `potassium`, `health_score`, `disease_risk`).
- **`scenarios/{scenario_id}`**: What-if scenario (`scenario_id`, `farm_id`, `name`, `duration_days`, `target_zones`, `changes`, `scenario_type`, `created_at`).
- **`simulations/{simulation_id}`**: Simulation metadata and history (`simulation_id`, `farm_id`, `scenario_id`, `scenario_name`, `timeline`, `summary`, `created_at`).
- **`simulation_results/{simulation_id}`**: Full simulation result dataset with baseline and projected timelines, summaries, and AI explanations.

---

## Run locally

Prerequisites: Node.js 18+ and Python 3.11+.

### Start Backend (FastAPI + Firebase Firestore)

```bash
cd backend
python -m venv .venv
# PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python run.py
```

The FastAPI service starts at `http://localhost:8000`. Interactive OpenAPI documentation is at `http://localhost:8000/docs`.

### Verify Firebase Connection

Check health status at `http://localhost:8000/api/health`:
```json
{
  "status": "ok",
  "storage": "firebase",
  "firestore_connected": true,
  "project_id": "farmsim-e8973"
}
```

### Start Frontend (React + Vite)

In a second terminal, start the frontend:

```bash
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:3000`. `VITE_API_URL` defaults to `http://localhost:8000`.

---

## API Summary

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Verify server & Firestore connection status. |
| `POST` | `/farms` | Create a new farm in Firestore. |
| `GET` | `/farms`, `/farms/{farm_id}` | Retrieve farms and zones from Firestore. |
| `PUT` | `/farms/{farm_id}` | Update farm metadata. |
| `POST` | `/farms/{farm_id}/zones` | Add a crop zone. |
| `PUT` | `/farms/{farm_id}/zones/{zone_id}` | Update zone conditions. |
| `POST` | `/scenarios` | Store a structured what-if scenario in Firestore. |
| `GET` | `/scenarios/{scenario_id}`, `/farms/{farm_id}/scenarios` | Retrieve scenarios from Firestore. |
| `POST` | `/simulate` | Load farm & scenario from Firestore, call `simulate_farm()`, store results in Firestore. |
| `GET` | `/simulation/{simulation_id}` | Retrieve persisted timeline & summary from Firestore. |
| `GET` | `/farms/{farm_id}/simulations` | List simulation runs for a farm. |
| `POST` | `/compare` | Compare simulation runs from Firestore. |
| `POST` | `/ai/analyze-risk` | Assess water, heat, disease, and nutrient risks. |
| `POST` | `/ai/parse-scenario` | Translate natural language query to scenario payload. |
| `POST` | `/ai/suggest-scenarios` | Return risk-targeted quick-test scenarios. |
| `POST` | `/ai/explain-result` | Return structured recommendations & trade-offs. |

---

## Verification & Testing

Run backend test suite:
```bash
cd backend
.venv\Scripts\python.exe -m pytest tests/ --basetemp=temp_pytest_dir
```

Build production bundle:
```bash
npm run build
```
