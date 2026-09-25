# FarmSim AI — Smart Agriculture Simulator

A virtual farm simulator that lets farmers create farms, configure zones, run what-if scenarios, and view AI-powered simulation results.

![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Vite](https://img.shields.io/badge/Vite-5-purple)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3-blue)

## Features

- **Farm Creation** — Create farms with name, location, area, and coordinates
- **Zone Builder** — Divide your farm into zones, assign crops, configure soil and environment
- **Farm Dashboard** — View real-time metrics: soil moisture, crop health, disease risk, water usage
- **What-If Scenarios** — Simulate drought, heatwave, pest outbreak, and more
- **Simulation Results** — Timeline charts for soil moisture, crop health, disease risk, yield
- **Scenario Comparison** — Compare multiple simulations side-by-side
- **AI Explanations** — Get natural language analysis from the backend AI

## Quick Start

### Prerequisites

- Node.js 18+ and npm

### Install

```bash
npm install
```

### Configure

Copy the environment file and adjust the API URL:

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_API_URL=http://localhost:8000
VITE_APP_NAME=FarmSim AI
```

### Run (Development)

```bash
npm run dev
```

The app starts at **http://localhost:3000**

### Build (Production)

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── App.tsx                  # Router and page routes
├── main.tsx                 # Entry point
├── index.css                # Tailwind + custom styles
├── types/
│   └── index.ts             # TypeScript interfaces and constants
├── services/
│   ├── api.ts               # Centralized API client (Axios)
│   └── mockData.ts          # Mock data fallback (development only)
├── components/
│   ├── layout/
│   │   └── Layout.tsx       # App shell with navigation
│   └── shared/
│       ├── LoadingSpinner.tsx
│       ├── ErrorDisplay.tsx
│       ├── EmptyState.tsx
│       ├── MetricCard.tsx
│       └── StatusBadge.tsx
└── pages/
    ├── LandingPage.tsx           # Home / farm list
    ├── FarmCreatePage.tsx        # Farm creation form
    ├── FarmBuilderPage.tsx       # Zone builder
    ├── FarmDashboardPage.tsx     # Farm overview dashboard
    ├── ScenarioBuilderPage.tsx   # What-if scenario builder
    ├── SimulationResultsPage.tsx # Simulation charts & AI analysis
    └── ScenarioComparisonPage.tsx # Compare simulations
```

## API Integration

The frontend expects these backend endpoints:

| Method | Endpoint                          | Description          |
|--------|-----------------------------------|----------------------|
| POST   | `/api/farms`                      | Create a farm        |
| GET    | `/api/farms`                      | List all farms       |
| GET    | `/api/farms/{id}`                 | Get farm details     |
| POST   | `/api/farms/{id}/zones`           | Create a zone        |
| PUT    | `/api/farms/{id}/zones/{zone_id}` | Update a zone        |
| POST   | `/api/simulate`                   | Run simulation       |
| GET    | `/api/simulation/{id}`            | Get simulation result|
| GET    | `/api/farms/{id}/simulations`     | List simulations     |
| POST   | `/api/scenarios`                  | Create scenario      |
| POST   | `/api/compare`                    | Compare simulations  |

All API calls go through `src/services/api.ts`. The base URL is configurable via the `VITE_API_URL` environment variable.

## Mock Mode

When the backend is unavailable, the app falls back to localStorage-based mock data. This is controlled by the `MOCK_ENABLED` flag in `src/services/mockData.ts`. Set it to `false` to disable mock fallback.

## Tech Stack

- **React 18** — UI framework
- **TypeScript 5** — Type safety
- **Vite 5** — Build tool
- **Tailwind CSS 3** — Utility-first styling
- **React Router 6** — Client-side routing
- **Axios** — HTTP client
- **Recharts** — Data visualization
- **Lucide React** — Icons
- **React Hot Toast** — Notifications

## Screens

1. **Landing Page** — Hero, features, existing farms
2. **Farm Create** — Name, location, area, zones form
3. **Farm Builder** — Visual zone grid, crop/soil/environment config
4. **Farm Dashboard** — Metrics cards, crop distribution, zone cards
5. **Scenario Builder** — Presets, NL input, zone selection
6. **Simulation Results** — Timeline charts, data table, AI analysis
7. **Scenario Comparison** — Multi-simulation chart comparison

## License

Built for hackathon demonstration purposes.
