import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Droplets, Thermometer, Heart, Bug, Zap, Wheat, MapPin,
  Plus, Play, Loader2, TrendingUp, Sprout, BarChart3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { farmApi, simulationApi } from '../services/api';
import { isMockEnabled, createMockSimulation } from '../services/mockData';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ErrorDisplay from '../components/shared/ErrorDisplay';
import MetricCard from '../components/shared/MetricCard';
import StatusBadge from '../components/shared/StatusBadge';
import type { Farm, SimulationResult } from '../types';
import { CROP_EMOJIS, CROP_COLORS } from '../types';

export default function FarmDashboardPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFarm();
  }, [farmId]);

  const loadFarm = async () => {
    if (!farmId) return;
    setLoading(true);
    setError(null);
    try {
      let farmData: Farm;
      try {
        farmData = await farmApi.get(farmId);
      } catch {
        if (isMockEnabled()) {
          const stored = JSON.parse(localStorage.getItem('farms') || '[]') as Farm[];
          const found = stored.find((f) => f.id === farmId);
          if (!found) throw new Error('Farm not found');
          farmData = found;
        } else {
          throw new Error('Failed to load farm');
        }
      }
      setFarm(farmData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load farm');
    } finally {
      setLoading(false);
    }
  };

  const runBaselineSimulation = async () => {
    if (!farm) return;
    setSimulating(true);
    try {
      let result: SimulationResult;
      try {
        result = await simulationApi.run({
          farmId: farm.id,
          zones: farm.zones,
        });
      } catch {
        if (isMockEnabled()) {
          result = createMockSimulation(farm.id, 'Baseline');
          const sims = JSON.parse(localStorage.getItem('simulations') || '[]');
          sims.push(result);
          localStorage.setItem('simulations', JSON.stringify(sims));
        } else {
          throw new Error('Simulation failed');
        }
      }
      toast.success('Simulation complete!');
      navigate(`/farms/${farm.id}/simulations/${result.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading farm dashboard..." fullPage />;
  if (error) return <ErrorDisplay message={error} onRetry={loadFarm} />;
  if (!farm) return <ErrorDisplay message="Farm not found" />;

  const avgMoisture = farm.zones.length
    ? farm.zones.reduce((s, z) => s + z.soilMoisture, 0) / farm.zones.length
    : 0;
  const avgHealth = farm.zones.length
    ? farm.zones.reduce((s, z) => s + (z.healthScore ?? 75), 0) / farm.zones.length
    : 0;
  const avgDisease = farm.zones.length
    ? farm.zones.reduce((s, z) => s + (z.diseaseRisk ?? 15), 0) / farm.zones.length
    : 0;
  const totalWater = farm.zones.reduce((s, z) => s + z.rainfall * z.area * 0.1, 0);
  const cropDistribution = farm.zones.reduce((acc, z) => {
    acc[z.crop] = (acc[z.crop] || 0) + z.area;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Sprout className="w-7 h-7 text-farm-green" />
            {farm.name}
          </h1>
          <p className="text-gray-500 flex items-center gap-1.5 mt-1">
            <MapPin className="w-4 h-4" />
            {farm.location} • {farm.area} acres • {farm.zones.length} zones
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={`/farms/${farm.id}/builder`}
            className="btn-secondary flex items-center gap-2"
          >
            Edit Zones
          </Link>
          <Link
            to={`/farms/${farm.id}/scenarios/new`}
            className="btn-secondary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Scenario
          </Link>
          <button
            onClick={runBaselineSimulation}
            disabled={simulating}
            className="btn-primary flex items-center gap-2"
          >
            {simulating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {simulating ? 'Running...' : 'Simulate'}
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <MetricCard icon={Droplets} label="Soil Moisture" value={avgMoisture} unit="%" color="blue" />
        <MetricCard icon={Heart} label="Crop Health" value={avgHealth} unit="%" color="green" />
        <MetricCard icon={Bug} label="Disease Risk" value={avgDisease} unit="%" color="red" />
        <MetricCard icon={Zap} label="Water Usage" value={totalWater} unit="L" color="blue" />
        <MetricCard icon={TrendingUp} label="Zones" value={farm.zones.length} color="purple" />
      </div>

      {/* Crop Distribution */}
      <div className="card mb-8">
        <h2 className="section-title mb-4">Crop Distribution</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(cropDistribution).map(([crop, area]) => (
            <div
              key={crop}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-100"
              style={{ backgroundColor: (CROP_COLORS as any)[crop] + '15' }}
            >
              <span className="text-lg">{(CROP_EMOJIS as any)[crop]}</span>
              <div>
                <p className="text-sm font-medium text-gray-800">{crop}</p>
                <p className="text-xs text-gray-500">{area.toFixed(1)} acres</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Zones Grid */}
      <h2 className="section-title mb-4">Farm Zones</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {farm.zones.map((zone) => (
          <div
            key={zone.id}
            className="zone-card"
            style={{
              borderColor: (CROP_COLORS as any)[zone.crop] + '60',
              backgroundColor: (CROP_COLORS as any)[zone.crop] + '08',
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{(CROP_EMOJIS as any)[zone.crop]}</span>
                <div>
                  <h3 className="font-semibold text-gray-900">{zone.name}</h3>
                  <p className="text-xs text-gray-500">{zone.crop} • {zone.area} acres</p>
                </div>
              </div>
              <StatusBadge value={zone.healthScore ?? 75} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-blue-500" />
                  Moisture
                </span>
                <span className="font-medium">{zone.soilMoisture.toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5 text-orange-500" />
                  Temperature
                </span>
                <span className="font-medium">{zone.temperature.toFixed(1)}°C</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <Bug className="w-3.5 h-3.5 text-red-500" />
                  Disease Risk
                </span>
                <span className="font-medium">{(zone.diseaseRisk ?? 15).toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <Wheat className="w-3.5 h-3.5 text-amber-600" />
                  Soil
                </span>
                <span className="font-medium">{zone.soilType}</span>
              </div>
            </div>

            {/* NPK mini bar */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1.5">NPK Levels</p>
              <div className="flex gap-1">
                <div className="flex-1">
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, zone.nitrogen)}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">N: {zone.nitrogen}</p>
                </div>
                <div className="flex-1">
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.min(100, zone.phosphorus * 2)}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">P: {zone.phosphorus}</p>
                </div>
                <div className="flex-1">
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, zone.potassium * 2)}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">K: {zone.potassium}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
