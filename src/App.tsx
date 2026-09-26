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
import { RequireAuth, RequireOwnedFarm } from './components/auth/FarmAccessGuards';

export default function App() {
  return (
    <AuthProvider>
      <FarmProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/farms/create" element={<FarmCreatePage />} />
              <Route path="/farms/:farmId" element={<RequireOwnedFarm />}>
                <Route index element={<FarmDashboardPage />} />
                <Route path="builder" element={<FarmBuilderPage />} />
                <Route path="scenarios/new" element={<ScenarioBuilderPage />} />
                <Route path="simulations/:simId" element={<SimulationResultsPage />} />
                <Route path="compare" element={<ScenarioComparisonPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </FarmProvider>
    </AuthProvider>
  );
}
