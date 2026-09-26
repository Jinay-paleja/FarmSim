import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/shared/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import FarmerDashboardOverviewPage from './pages/FarmerDashboardOverviewPage';
import MyFarmsPage from './pages/MyFarmsPage';
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
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<LoginPage initialMode="signup" />} />

          {/* Protected Routes (require auth token, redirect to /login if unauthenticated) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<FarmerDashboardOverviewPage />} />
              <Route path="/farms" element={<MyFarmsPage />} />
              <Route path="/farms/create" element={<FarmCreatePage />} />
              <Route path="/farms/:farmId" element={<FarmDashboardPage />} />
              <Route path="/farms/:farmId/builder" element={<FarmBuilderPage />} />
              <Route path="/farms/:farmId/scenarios/new" element={<ScenarioBuilderPage />} />
              <Route path="/farms/:farmId/scenario" element={<ScenarioBuilderPage />} />
              <Route path="/farms/:farmId/simulations/:simId" element={<SimulationResultsPage />} />
              <Route path="/farms/:farmId/simulation" element={<SimulationResultsPage />} />
              <Route path="/farms/:farmId/results" element={<SimulationResultsPage />} />
              <Route path="/farms/:farmId/compare" element={<ScenarioComparisonPage />} />
              <Route path="/farms/:farmId/comparison" element={<ScenarioComparisonPage />} />
            </Route>
          </Route>

          {/* Fallback Catch-All */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </FarmProvider>
    </AuthProvider>
  );
}
