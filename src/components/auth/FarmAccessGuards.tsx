import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFarmContext } from '../../context/FarmContext';

/** Redirect signed-out visitors before they can create or open a farm. */
export function RequireAuth() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

/**
 * A URL is not authority. Check that the requested ID belongs to the active
 * farmer before rendering pages that fetch or modify that farm.
 */
export function RequireOwnedFarm() {
  const { farmId } = useParams<{ farmId: string }>();
  const { farms, loadingFarms } = useFarmContext();

  if (loadingFarms) {
    return <div className="min-h-screen grid place-items-center text-sm text-gray-500">Loading your farms…</div>;
  }

  if (!farmId || !farms.some((farm) => farm.id === farmId)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
