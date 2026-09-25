import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import LandingPage from './pages/LandingPage';
import FarmCreatePage from './pages/FarmCreatePage';
import FarmBuilderPage from './pages/FarmBuilderPage';
import FarmDashboardPage from './pages/FarmDashboardPage';
import ScenarioBuilderPage from './pages/ScenarioBuilderPage';
import SimulationResultsPage from './pages/SimulationResultsPage';
import ScenarioComparisonPage from './pages/ScenarioComparisonPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<Layout />}>
        <Route path="/farms/create" element={<FarmCreatePage />} />
        <Route path="/farms/:farmId/builder" element={<FarmBuilderPage />} />
        <Route path="/farms/:farmId" element={<FarmDashboardPage />} />
        <Route path="/farms/:farmId/scenarios/new" element={<ScenarioBuilderPage />} />
        <Route path="/farms/:farmId/simulations/:simId" element={<SimulationResultsPage />} />
        <Route path="/farms/:farmId/compare" element={<ScenarioComparisonPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
