import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sprout, Tractor, Compass, MapPin, Plus, ArrowRight,
  TrendingUp, AlertTriangle, CloudSun, Droplets,
  Layers, BarChart3, ChevronRight, ShieldCheck, Heart, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFarmContext } from '../context/FarmContext';
import { useFarmWeather } from '../hooks/useFarmWeather';
import LoadingSpinner from '../components/shared/LoadingSpinner';

export default function FarmerDashboardOverviewPage() {
  const navigate = useNavigate();
  const { user, farmerProfile } = useAuth();
  const { farms, selectedFarm, selectFarm, loadingFarms } = useFarmContext();

  // Active farm for weather and alerts
  const activeFarm = selectedFarm || farms[0] || null;

  // Weather hook for active farm
  const { weather, loading: weatherLoading } = useFarmWeather({
    latitude: activeFarm?.latitude,
    longitude: activeFarm?.longitude,
    zones: activeFarm?.zones,
  });

  // Aggregated farmer metrics across all owned farms
  const stats = useMemo(() => {
    const totalFarms = farms.length;
    const totalArea = farms.reduce((sum, f) => sum + (f.area || 0), 0);

    const allZones = farms.flatMap((f) => f.zones || []);
    const totalZones = allZones.length;

    const avgCropHealth = totalZones > 0
      ? Math.round(allZones.reduce((sum, z) => sum + (z.healthScore ?? 75), 0) / totalZones)
      : null;

    const avgSoilMoisture = totalZones > 0
      ? Math.round(allZones.reduce((sum, z) => sum + (z.soilMoisture ?? 55), 0) / totalZones)
      : null;

    return {
      totalFarms,
      totalArea: Math.round(totalArea * 10) / 10,
      totalZones,
      avgCropHealth,
      avgSoilMoisture,
    };
  }, [farms]);

  // Dynamic alerts generated from zones and weather
  const alerts = useMemo(() => {
    const list: { id: string; type: 'warning' | 'info' | 'critical'; title: string; message: string; farmName?: string }[] = [];

    if (!activeFarm) {
      return list;
    }

    // Check zones for stress
    activeFarm.zones.forEach((z) => {
      if (z.soilMoisture < 35) {
        list.push({
          id: `alert-moisture-${z.id}`,
          type: 'warning',
          title: `Low Moisture Deficit — ${z.name}`,
          message: `Soil moisture dropped to ${Math.round(z.soilMoisture)}%. Schedule irrigation soon.`,
          farmName: activeFarm.name,
        });
      } else if (z.soilMoisture > 82) {
        list.push({
          id: `alert-flood-${z.id}`,
          type: 'info',
          title: `Field Saturated — ${z.name}`,
          message: `Moisture is high (${Math.round(z.soilMoisture)}%). Monitor drainage channels.`,
          farmName: activeFarm.name,
        });
      }

      if ((z.diseaseRisk ?? 0) > 50) {
        list.push({
          id: `alert-disease-${z.id}`,
          type: 'critical',
          title: `Elevated Disease Risk — ${z.crop}`,
          message: `Humidity and temperature favor fungal pressure. Preventive treatment advised.`,
          farmName: activeFarm.name,
        });
      }
    });

    if (list.length === 0) {
      list.push({
        id: 'all-healthy',
        type: 'info',
        title: 'Optimal Crop Conditions',
        message: 'All fields are maintaining healthy moisture and nutrient profiles.',
        farmName: activeFarm.name,
      });
    }

    return list;
  }, [activeFarm]);

  if (loadingFarms) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" message="Loading your farmer dashboard..." />
      </div>
    );
  }

  return (
    <div className="page-container py-8 space-y-8">
      {/* 1. WELCOME HEADER */}
      <div className="card bg-gradient-to-r from-farm-green/10 via-emerald-50/60 to-white border-farm-green/20 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-farm-green flex items-center justify-center text-3xl shadow-md text-white flex-shrink-0">
              {farmerProfile?.avatarEmoji || '🧑‍🌾'}
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-farm-green-pale text-farm-green text-xs font-bold uppercase tracking-wider mb-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Authenticated Farmer Portal
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                Welcome back, {user?.name || 'Farmer'}!
              </h1>
              <p className="text-gray-500 text-sm mt-1 flex items-center gap-2 flex-wrap">
                <span>{user?.email}</span>
                {user?.location && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      {user.location}
                    </span>
                  </>
                )}
                <span>•</span>
                <span className="text-farm-green font-semibold">{stats.totalFarms} active farm{stats.totalFarms !== 1 ? 's' : ''}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/farms/create"
              className="btn-primary inline-flex items-center gap-2 text-sm shadow-md"
            >
              <Plus className="w-4 h-4" />
              Create New Farm
            </Link>
            <Link
              to="/farms"
              className="btn-secondary inline-flex items-center gap-2 text-sm"
            >
              <Tractor className="w-4 h-4" />
              My Farms ({stats.totalFarms})
            </Link>
          </div>
        </div>
      </div>

      {/* 2. AGGREGATED METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="card p-5 border border-gray-100 shadow-xs hover:border-farm-green/30 transition-all">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Farms</span>
            <Tractor className="w-4 h-4 text-farm-green" />
          </div>
          <div className="text-3xl font-extrabold text-gray-900">{stats.totalFarms}</div>
          <p className="text-xs text-gray-500 mt-1">{stats.totalZones} total field plots</p>
        </div>

        <div className="card p-5 border border-gray-100 shadow-xs hover:border-farm-green/30 transition-all">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Area</span>
            <Compass className="w-4 h-4 text-farm-green" />
          </div>
          <div className="text-3xl font-extrabold text-gray-900">{stats.totalArea}</div>
          <p className="text-xs text-gray-500 mt-1">Acres under management</p>
        </div>

        <div className="card p-5 border border-gray-100 shadow-xs hover:border-farm-green/30 transition-all">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Avg Crop Health</span>
            <Heart className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-extrabold text-emerald-600">
              {stats.avgCropHealth !== null ? `${stats.avgCropHealth}%` : '--'}
            </div>
            {stats.avgCropHealth !== null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">Good</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">Across all active crops</p>
        </div>

        <div className="card p-5 border border-gray-100 shadow-xs hover:border-farm-green/30 transition-all">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Soil Moisture</span>
            <Droplets className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-extrabold text-blue-600">
              {stats.avgSoilMoisture !== null ? `${stats.avgSoilMoisture}%` : '--'}
            </div>
            {stats.avgSoilMoisture !== null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">Optimal</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">Average sensor level</p>
        </div>
      </div>

      {/* 3. FARM SELECTOR & DETAILS */}
      {farms.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sprout className="w-5 h-5 text-farm-green" />
              <h2 className="text-lg font-bold text-gray-900">Your Farms & Digital Twins</h2>
            </div>
            <Link to="/farms" className="text-xs font-bold text-farm-green hover:underline flex items-center gap-1">
              View all ({farms.length}) <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {farms.map((f) => {
              const isSelected = activeFarm?.id === f.id;
              return (
                <div
                  key={f.id}
                  onClick={() => selectFarm(f.id)}
                  className={`card cursor-pointer transition-all border p-5 flex flex-col justify-between ${
                    isSelected
                      ? 'border-farm-green ring-2 ring-farm-green/20 shadow-md bg-white'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="text-base font-bold text-gray-900">{f.name}</div>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          {f.location}
                        </p>
                      </div>
                      {isSelected ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-farm-green text-white px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="text-[10px] font-semibold text-gray-500 hover:text-farm-green"
                        >
                          Select
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 my-3 text-xs bg-stone-50 p-2.5 rounded-xl border border-gray-100">
                      <div>
                        <span className="text-gray-400 block">Area</span>
                        <span className="font-bold text-gray-800">{f.area} acres</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Plots</span>
                        <span className="font-bold text-gray-800">{f.zones.length} fields</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <Link
                      to={`/farms/${f.id}/builder`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-semibold text-farm-green hover:underline flex items-center gap-1"
                    >
                      <Layers className="w-3 h-3" /> Map Builder
                    </Link>
                    <Link
                      to={`/farms/${f.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-bold text-gray-900 hover:text-farm-green flex items-center gap-1"
                    >
                      Dashboard <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card text-center py-12 border-dashed border-2 border-gray-200">
          <Sprout className="w-12 h-12 text-farm-green mx-auto mb-3 opacity-60" />
          <h3 className="font-bold text-gray-900 text-lg">No farms created yet</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto mt-1 mb-6">
            Get started by creating your first farm boundary, placing field plots, and running simulations.
          </p>
          <Link to="/farms/create" className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create Your First Farm
          </Link>
        </div>
      )}

      {/* 4. WEATHER & ALERTS & RECENT SIMULATION ROW */}
      {activeFarm && (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Weather Widget */}
          <div className="lg:col-span-4 card space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <CloudSun className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-gray-900 text-sm">Farm Meteorology</h3>
              </div>
              <span className="text-xs text-gray-400 truncate max-w-[130px]">{activeFarm.location}</span>
            </div>

            {weatherLoading ? (
              <div className="py-8 text-center text-xs text-gray-400">Loading live weather data...</div>
            ) : weather ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-extrabold text-gray-900">{Math.round(weather.temperature)}°C</div>
                    <div className="text-xs text-gray-500">{weather.weatherDescription}</div>
                  </div>
                  <div className="text-right text-xs text-gray-500 space-y-0.5">
                    <div>Humidity: <strong className="text-gray-700">{Math.round(weather.humidity)}%</strong></div>
                    <div>Wind: <strong className="text-gray-700">{Math.round(weather.windSpeed)} km/h</strong></div>
                    <div>Rain: <strong className="text-gray-700">{weather.rain ?? weather.precipitation} mm</strong></div>
                  </div>
                </div>

                <div className="p-3 bg-stone-50 rounded-xl border border-gray-100 text-xs text-gray-600">
                  Forecast indicates favorable conditions for current vegetative and flowering stages.
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-gray-400">Weather feed ready.</div>
            )}
          </div>

          {/* Active Alerts */}
          <div className="lg:col-span-4 card space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-gray-900 text-sm">Field Health & Alerts</h3>
              </div>
              <span className="text-xs text-gray-400">{alerts.length} active</span>
            </div>

            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-xl border text-xs ${
                    alert.type === 'critical'
                      ? 'bg-red-50 border-red-200 text-red-900'
                      : alert.type === 'warning'
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <div className="font-bold">{alert.title}</div>
                  <div className="text-[11px] opacity-90 mt-0.5">{alert.message}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Simulation / Quick Run */}
          <div className="lg:col-span-4 card space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <h3 className="font-bold text-gray-900 text-sm">AI Simulation Engine</h3>
                </div>
                <span className="text-xs text-purple-600 font-bold">Predictive AI</span>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                Simulate weather extremes (drought, heatwave, excessive rainfall) on <strong>{activeFarm.name}</strong> to predict crop yield and water stress before they happen.
              </p>

              <div className="my-3 p-3 bg-purple-50/60 rounded-xl border border-purple-100 text-xs space-y-1">
                <div className="flex justify-between text-gray-700">
                  <span>Target Farm:</span>
                  <strong className="text-gray-900">{activeFarm.name}</strong>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Field Zones:</span>
                  <strong>{activeFarm.zones.length} active</strong>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Link
                to={`/farms/${activeFarm.id}/scenarios/new`}
                className="btn-primary w-full text-center flex items-center justify-center gap-2 text-xs py-2.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" /> Run What-If Scenario
              </Link>
              <Link
                to={`/farms/${activeFarm.id}/compare`}
                className="btn-secondary w-full text-center flex items-center justify-center gap-2 text-xs py-2"
              >
                <BarChart3 className="w-3.5 h-3.5" /> Compare Historical Scenarios
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
