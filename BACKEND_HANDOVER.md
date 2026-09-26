# FarmSim AI — Backend Developer Handover & Integration Guide

This guide is designed for the backend developer building or extending the REST API for **FarmSim AI**. It covers the complete domain model, API contracts, AI engine architecture, weather integration, and authentication specifications.

---

## 1. System Architecture Overview

```
                                  ┌─────────────────────────────────────────┐
                                  │           React Frontend (Vite)         │
                                  │      Leaflet + Tailwind + Lucide        │
                                  └──────────────┬──────────────────────────┘
                                                 │
                                                 │ HTTP / REST (Axios)
                                                 │ Base URL: http://localhost:8000/api
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   Backend FastAPI / Node                               │
│                                                                                        │
│  ┌───────────────────────┐  ┌──────────────────────┐  ┌─────────────────────────────┐  │
│  │   Auth & User Router  │  │   Farm & Zone Router │  │ Simulation & Weather Router │  │
│  │   JWT Bearer Auth     │  │   Multi-tenant GIS   │  │ Random Forest + Daily Math  │  │
│  └───────────────────────┘  └──────────────────────┘  └─────────────────────────────┘  │
│                                           │                                            │
│                                           ▼                                            │
│                               ┌──────────────────────┐                                 │
│                               │   PostgreSQL / PostGIS│                                 │
│                               │   or SQLite / MongoDB│                                 │
│                               └──────────────────────┘                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

The frontend includes a seamless **mock fallback**: if the backend (`localhost:8000`) is offline or returns an error, the frontend safely falls back to local storage and browser-side engines without crashing. Once backend routes are up, the frontend will automatically communicate with them.

---

## 2. Authentication & Farmer Multi-Tenancy

### Data Isolation Rule
Each farm belongs to a farmer (`ownerId`). Farmers must only see, edit, and simulate farms that belong to them.

### User Entity
```typescript
interface User {
  id: string;               // e.g. "farmer_punjab" or UUID
  name: string;             // "Harpreet Singh"
  email: string;            // "harpreet.singh@farm.ai"
  location?: string;        // "Ludhiana, Punjab, India"
  phone?: string;
  avatar?: string;
  joinedAt?: string;        // ISO 8601
}
```

### Pre-Configured Demo Accounts (Ready for testing)
1. **Harpreet Singh** (`farmer_punjab` / `harpreet.singh@farm.ai`) — Punjab, India (12.4 acres, Wheat/Rice/Cotton)
2. **Carlos Rodriguez** (`farmer_california` / `carlos.rodriguez@valleylogic.org`) — Fresno, CA, USA (8.7 acres, Precision Drip/Vineyard)
3. **John Miller** (`farmer_iowa` / `john.miller@midwestgrains.com`) — Ames, Iowa, USA (21.2 acres, Corn/Soybean Rotation)

### Expected Auth Headers
Axios automatically attaches:
`Authorization: Bearer <auth_token>`
(Stored in browser `localStorage.getItem('auth_token')`).

---

## 3. Core Domain Entities & Database Schema

### 1. Farm
```typescript
interface Farm {
  id: string;                          // Primary Key (e.g. "farm_green_valley" or UUID)
  ownerId?: string;                    // Foreign Key -> User.id
  name: string;                        // "Green Valley Farm"
  location: string;                    // "Ludhiana, Punjab"
  area: number;                        // Total acres (e.g. 12.4)
  latitude?: number;                   // Center lat (e.g. 30.9010)
  longitude?: number;                  // Center lng (e.g. 75.8573)
  boundary?: [number, number][];       // Polygon coordinates [[lat, lng], [lat, lng], ...]
  boundaryAreaAcres?: number;          // Geodesic computed area in acres
  boundaryAreaHectares?: number;       // Computed area in hectares
  boundaryPerimeterMeters?: number;    // Perimeter in meters
  boundaryShape?: 'polygon' | 'rectangle' | 'circle';
  zones: Zone[];                       // Sub-plots / agricultural zones
  createdAt?: string;
  updatedAt?: string;
}
```

### 2. Zone (Field / Plot)
```typescript
interface Zone {
  id: string;                          // Primary Key (e.g. "zone_123")
  farmId: string;                      // Foreign Key -> Farm.id
  name: string;                        // "Field A1"
  area: number;                        // Field acres (e.g. 2.5)
  crop: CropType;                      // 'Rice' | 'Wheat' | 'Maize' | 'Cotton' | etc.
  soilType: SoilType;                  // 'Alluvial' | 'Black' | 'Red' | 'Loamy' | 'Clay' | etc.
  growthStage: GrowthStage;            // 'Vegetative' | 'Flowering' | 'Maturity' | etc.
  irrigationMethod: IrrigationMethod;  // 'Drip' | 'Sprinkler' | 'Flood' | 'Rain-fed' | etc.
  soilMoisture: number;                // 0 - 100 percentage
  temperature: number;                 // °C
  humidity: number;                    // 0 - 100 percentage
  rainfall: number;                    // mm / season or recent
  nitrogen: number;                    // kg/ha or ppm
  phosphorus: number;                  // kg/ha or ppm
  potassium: number;                   // kg/ha or ppm
  healthScore?: number;                // 0 - 100
  diseaseRisk?: number;                // 0 - 100 percentage
  pestRisk?: number;                   // 0 - 100 percentage
  boundary?: [number, number][];       // Polygon [[lat, lng], ...]
  boundaryShape?: 'polygon' | 'rectangle' | 'circle';
  stressState?: FieldStressState;      // 'healthy' | 'moderate_stress' | 'high_stress' | 'flooded' | 'drought' | 'heat_stress'
}
```

---

## 4. API Endpoints Contract (Expected by Frontend)

### Base URL: `http://localhost:8000/api`

| Method | Endpoint | Description | Request Body | Response Body |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/farms` | List farms for authenticated user | *None* | `Farm[]` |
| `POST` | `/farms` | Create new farm | `FarmCreateInput` | `Farm` |
| `GET` | `/farms/{farmId}` | Get farm details + zones | *None* | `Farm` |
| `PUT` | `/farms/{farmId}` | Update farm boundary / info | `Partial<Farm>` | `Farm` |
| `DELETE`| `/farms/{farmId}` | Delete farm | *None* | `{ success: true }` |
| `POST` | `/farms/{farmId}/zones` | Add zone to farm | `ZoneInput` | `Zone` |
| `PUT` | `/farms/{farmId}/zones/{zoneId}` | Update zone properties / polygon | `Partial<ZoneInput>` | `Zone` |
| `DELETE`| `/farms/{farmId}/zones/{zoneId}` | Delete zone | *None* | `{ success: true }` |
| `POST` | `/simulate` | Run agricultural simulation | `SimulationRequest` | `SimulationResult` |
| `GET` | `/simulation/{simId}` | Retrieve previous simulation | *None* | `SimulationResult` |
| `GET` | `/farms/{farmId}/simulations` | List simulations for farm | *None* | `SimulationResult[]` |
| `POST` | `/scenarios` | Save scenario preset | `Partial<Scenario>` | `Scenario` |
| `GET` | `/farms/{farmId}/scenarios` | List saved scenarios | *None* | `Scenario[]` |
| `POST` | `/compare` | Compare multiple simulation runs | `ComparisonRequest` | `ComparisonResult` |

---

## 5. Simulation Engine & AI Model Architecture

The frontend already implements a complete client-side reference implementation of Person 3's AI specification in TypeScript (`src/services/aiRiskModel.ts`, `simulationEngine.ts`, `nlpScenarioParser.ts`, `aiResultAnalysis.ts`). The backend can replicate or wrap these in Python:

### 1. Unified Simulation Request (`SimulationRequest`)
Both manual sliders and natural language prompt eventually compile into a unified payload:
```json
{
  "farmId": "farm_green_valley",
  "mode": "what_if",
  "durationDays": 14,
  "zones": [ ... ],
  "weatherModifiers": {
    "preset": "heatwave",
    "tempDelta": 5.0,
    "rainMultiplier": 0.3,
    "irrigationFailure": false
  },
  "structuredScenario": {
    "scenario_type": "Heatwave",
    "duration_days": 14,
    "temperature_change": 5.0,
    "rainfall_multiplier": 0.3,
    "irrigation_change": 0.0,
    "nitrogen_change": 0.0,
    "phosphorus_change": 0.0,
    "potassium_change": 0.0,
    "pest_pressure": "medium"
  }
}
```

### 2. Random Forest 4-Risk Model
Predicts 4 categorical risk levels (`LOW`, `MEDIUM`, `HIGH`) with probabilities:
- **`water_stress`**: Driven by soil moisture, temperature, ET0, rain deficit.
- **`heat_stress`**: Driven by temperature exceeding crop-specific thresholds (e.g. Cotton > 38°C, Wheat > 30°C).
- **`disease_risk`**: Driven by high humidity (>80%), high moisture, warm temp (Fungal / Blight).
- **`nutrient_risk`**: Driven by NPK deficits relative to crop requirement.

### 3. Simulation Result Output (`SimulationResult`)
```typescript
interface SimulationResult {
  id: string;
  farmId: string;
  scenarioName: string;
  mode: 'real_weather' | 'what_if';
  weatherModifiers?: WeatherModifiers;
  timeline: {
    day: number;
    label: string;
    temperature: number;
    rainfall: number;
    soilMoisture: number;
    cropHealth: number;
    waterConsumption: number;
    diseaseRisk: number;
    heatStress?: number;
    waterStress?: number;
    expectedYield?: number;
  }[];
  summary: {
    totalWaterUsage: number;
    averageCropHealth: number;
    averageDiseaseRisk: number;
    totalExpectedYield: number;
    averageSoilMoisture: number;
    averageWaterStress: number;
    averageHeatStress: number;
  };
  comparisonDiff?: {
    cropHealthDiff: number;
    soilMoistureDiff: number;
    yieldDiff: number;
    waterUsageDiff: number;
  };
  aiExplanation: string;
  decisionSupportNote: string;
}
```

---

## 6. Live Weather Data Integration (Open-Meteo)

The frontend pulls hyper-local meteorology from **Open-Meteo**:
- **Endpoint**: `https://api.open-meteo.com/v1/forecast`
- **Parameters**:
  - `latitude`, `longitude` (from farm coordinates)
  - `hourly`: `temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,soil_temperature_0cm,soil_moisture_0_to_1cm`
  - `daily`: `weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,et0_fao_evapotranspiration`
  - `forecast_days`: 7
- **ET0 Evapotranspiration**: Used to model daily crop water demand against rainfall and irrigation.

---

## 7. Interactive Map System Specifications
- **Map Library**: Leaflet + React-Leaflet
- **Tile Providers**:
  - Esri World Imagery (Satellite)
  - OpenStreetMap (Cartographic)
  - OpenTopoMap (Topographic)
- **Geometry & Calculations**:
  - Boundary coordinates stored as `[lat, lng]` polygon arrays.
  - Geodesic area computed via spherical polygon formula ($1 \text{ sq m} = 0.000247105 \text{ acres}$).
- **Dynamic Weather Overlays**:
  - CSS/SVG animated rain particles responding to live rain mm/h.
  - Heat shimmer overlay responding to severe temperature deltas.
  - Flood puddles & dry soil textures responding to simulated soil moisture.

---

## 8. Git Repository Information
- **Repository URL**: `https://github.com/Jinay-paleja/FarmSim.git`
- **Active Branch**: `main`
- **Frontend Dev Server**: Vite running on `http://localhost:3000`
- **API Proxy Target**: `http://localhost:8000` (configurable via `VITE_API_URL` in `.env`)
