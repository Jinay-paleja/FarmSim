import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import FarmCreatePage from './pages/FarmCreatePage';
import FarmBuilderPage from './pages/FarmBuilderPage';
import FarmDashboardPage from './pages/FarmDashboardPage';
import ScenarioBuilderPage from './pages/ScenarioBuilderPage';
import SimulationResultsPage from './pages/SimulationResultsPage';
import ScenarioComparisonPage from './pages/ScenarioComparisonPage';
import { FarmProvider } from './context/FarmContext';
import { AuthProvider } from './context/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <FarmProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
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
      </FarmProvider>
    </AuthProvider>
  );
}
