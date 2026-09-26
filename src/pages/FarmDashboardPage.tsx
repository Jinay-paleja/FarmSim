import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Droplets, Thermometer, Heart, Bug, Zap, Wheat, MapPin,
  Plus, Play, Loader2, TrendingUp, Sprout, BarChart3,
  Layers, Compass, Edit3, ArrowUpRight, ShieldAlert,
  Tractor, Check, X, Sparkles, Filter, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { farmApi, simulationApi } from '../services/api';
import { isMockEnabled, createMockSimulation } from '../services/mockData';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ErrorDisplay from '../components/shared/ErrorDisplay';
import MetricCard from '../components/shared/MetricCard';
import StatusBadge from '../components/shared/StatusBadge';
import DigitalFarmMap, { BaseMapLayer, FieldViewMode } from '../components/map/DigitalFarmMap';
import WeatherCard from '../components/weather/WeatherCard';
import FarmIntelligencePanel from '../components/intelligence/FarmIntelligencePanel';
import AIRiskSuggesterCard from '../components/intelligence/AIRiskSuggesterCard';
import { useFarmWeather } from '../hooks/useFarmWeather';
import { analyzeFarmIntelligence } from '../services/farmIntelligence';
import { useFarmContext } from '../context/FarmContext';
import type { WeatherData } from '../services/weather';
import type { Farm, SimulationResult, ZoneInput, Zone } from '../types';
import { CROP_EMOJIS, CROP_COLORS } from '../types';
import {
  calculatePolygonArea,
  calculatePerimeter,
  generateDefaultFarmBoundary,
  generateDefaultPlotBoundaries,
} from '../services/mapGeometry';

function getInitialCoordinates(farm: Farm): [number, number] {
  if (farm.latitude !== undefined && farm.longitude !== undefined && farm.latitude !== 0) {
    return [farm.latitude, farm.longitude];
  }
  const loc = (farm.location || '').toLowerCase();
  if (loc.includes('punjab') || loc.includes('india')) return [30.9010, 75.8573];
  if (loc.includes('california') || loc.includes('fresno')) return [36.7468, -119.7726];
  if (loc.includes('iowa')) return [42.0308, -93.6319];
  if (loc.includes('texas')) return [31.9686, -99.9018];
  return [30.9010, 75.8573];
}

export default function FarmDashboardPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const navigate = useNavigate();

  // Shared Farm Context
  const {
    farms,
    selectFarm,
    selectedZoneIndex,
    selectZoneIndex,
    updateFarmInState,
  } = useFarmContext();

  const [farm, setFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Digital Map State
  const [activeLayer, setActiveLayer] = useState<BaseMapLayer>('satellite');
  const [viewMode, setViewMode] = useState<FieldViewMode>('health');

  // Ref for scrolling to field card
  const fieldCardsRef = useRef<Record<number, HTMLDivElement | null>>({});

  // Sync route and context
  useEffect(() => {
    if (farmId) {
      selectFarm(farmId);
      loadFarm(farmId);
    }
  }, [farmId, selectFarm]);

  const loadFarm = async (targetId: string) => {
    setLoading(true);
    setError(null);
    try {
      let farmData: Farm;
      try {
        farmData = await farmApi.get(targetId);
      } catch {
        if (isMockEnabled()) {
          const stored = JSON.parse(localStorage.getItem('farms') || '[]') as Farm[];
          const found = stored.find((f) => f.id === targetId);
          if (!found) throw new Error('Farm not found');
          farmData = found;
        } else {
          throw new Error('Failed to load farm');
        }
      }

      // Ensure boundary exists
      const centerCoords = getInitialCoordinates(farmData);
      let boundary = farmData.boundary;
      if (!boundary || boundary.length < 3) {
        boundary = generateDefaultFarmBoundary(centerCoords, farmData.area || 10);
        farmData.boundary = boundary;
      }

      // Ensure zone boundaries exist
      if (farmData.zones && farmData.zones.length > 0) {
        const defaultPlots = generateDefaultPlotBoundaries(boundary, farmData.zones.length);
        farmData.zones = farmData.zones.map((z, idx) => ({
          ...z,
          boundary: z.boundary && z.boundary.length >= 3 ? z.boundary : defaultPlots[idx],
        }));
      }

      setFarm(farmData);
      updateFarmInState(farmData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load farm');
    } finally {
      setLoading(false);
    }
  };

  // Live Weather Integration for the SELECTED Farm's coordinates
  const {
    weather,
    loading: weatherLoading,
    isRefreshing: weatherRefreshing,
    error: weatherError,
    lastUpdatedLabel: weatherUpdatedLabel,
    refresh: refreshWeather,
    agronomicImpact,
  } = useFarmWeather({
    latitude: farm?.latitude,
    longitude: farm?.longitude,
    zones: farm?.zones,
  });

  const handleApplyWeatherToZones = async (w: WeatherData) => {
    if (!farm) return;
    const updatedZones = farm.zones.map((z) => ({
      ...z,
      temperature: w.temperature,
      humidity: w.humidity,
      rainfall: w.rain > 0 ? Math.round(w.rain * 15) : z.rainfall,
    }));

    const updatedFarm = { ...farm, zones: updatedZones };
    setFarm(updatedFarm);
    updateFarmInState(updatedFarm);

    // Save
    try {
      if (isMockEnabled()) {
        const stored = JSON.parse(localStorage.getItem('farms') || '[]') as Farm[];
        const idx = stored.findIndex((f) => f.id === farm.id);
        if (idx !== -1) {
          stored[idx] = updatedFarm;
          localStorage.setItem('farms', JSON.stringify(stored));
        }
      } else {
        await farmApi.update(farm.id, updatedFarm);
      }
      toast.success(`Synchronized live ambient weather (${Math.round(w.temperature)}°C, ${Math.round(w.humidity)}% humidity) into all ${farm.zones.length} plots!`);
    } catch {
      toast.error('Failed to update plot weather telemetry');
    }
  };

  const handleFarmSwitch = (newFarmId: string) => {
    if (newFarmId === farm?.id) return;
    selectFarm(newFarmId);
    navigate(`/farms/${newFarmId}`);
  };

  const handleFieldSelect = (idx: number | null) => {
    selectZoneIndex(idx);
    if (idx !== null && fieldCardsRef.current[idx]) {
      fieldCardsRef.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

  // Agronomic Farm Intelligence Synthesis
  const farmIntelligence = useMemo(() => {
    if (!farm || !weather) return null;
    return analyzeFarmIntelligence(farm, farm.zones, weather);
  }, [farm, weather]);

  // Convert zones to ZoneInput for DigitalFarmMap
  const mapZoneInputs: ZoneInput[] = useMemo(() => {
    if (!farm?.zones) return [];
    return farm.zones.map((z) => ({
      id: z.id,
      name: z.name,
      area: z.area,
      crop: z.crop,
      soilType: z.soilType,
      growthStage: z.growthStage,
      irrigationMethod: z.irrigationMethod,
      soilMoisture: z.soilMoisture,
      temperature: z.temperature,
      humidity: z.humidity,
      rainfall: z.rainfall,
      nitrogen: z.nitrogen,
      phosphorus: z.phosphorus,
      potassium: z.potassium,
      healthScore: z.healthScore ?? 75,
      diseaseRisk: z.diseaseRisk ?? 15,
      pestRisk: z.pestRisk ?? 15,
      boundary: z.boundary,
      boundaryShape: z.boundaryShape || 'polygon',
      stressState: z.stressState || 'healthy',
    }));
  }, [farm?.zones]);

  const mapCenter = useMemo(() => {
    return farm ? getInitialCoordinates(farm) : [30.9010, 75.8573] as [number, number];
  }, [farm]);

  // Farm Area calculation
  const farmAreaCalc = useMemo(() => {
    if (farm?.boundary && farm.boundary.length >= 3) {
      return calculatePolygonArea(farm.boundary);
    }
    return {
      acres: farm?.area || 0,
      hectares: Math.round(((farm?.area || 0) / 2.47105) * 100) / 100,
      squareMeters: Math.round((farm?.area || 0) * 4046.86),
    };
  }, [farm?.boundary, farm?.area]);

  // Selected Zone object if a field is active
  const selectedZone: Zone | null = useMemo(() => {
    if (selectedZoneIndex === null || !farm?.zones) return null;
    return farm.zones[selectedZoneIndex] || null;
  }, [selectedZoneIndex, farm?.zones]);

  if (loading) return <LoadingSpinner message="Loading digital farm dashboard..." fullPage />;
  if (error) return <ErrorDisplay message={error} onRetry={() => farmId && loadFarm(farmId)} />;
  if (!farm) return <ErrorDisplay message="Farm not found" />;

  // Aggregates for whole farm
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
    <div className="page-container space-y-6 pb-20">
      {/* ============================================================ */}
      {/* 1. PROMINENT MULTI-FARM SELECTOR BAR */}
      {/* ============================================================ */}
      <div className="card p-4 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Tractor className="w-5 h-5 text-farm-green" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
              Select Active Farm
            </h2>
            <span className="text-xs text-gray-400 font-normal">
              ({farms.length} farms in portfolio)
            </span>
          </div>
          <Link
            to="/farms/create"
            className="text-xs font-bold text-farm-green hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" /> Add New Farm
          </Link>
        </div>

        {/* Horizontal Farm Selector Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {farms.map((f) => {
            const isCurrent = f.id === farm.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => handleFarmSwitch(f.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                  isCurrent
                    ? 'border-farm-green bg-farm-green-pale/40 shadow-xs ring-2 ring-farm-green/30'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 bg-stone-50/50 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-gray-900 dark:text-gray-100 truncate pr-2">
                    {f.name}
                  </div>
                  {isCurrent && (
                    <span className="text-[10px] bg-farm-green text-white font-extrabold px-1.5 py-0.5 rounded-full flex-shrink-0">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-2">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">{f.area} acres</span>
                  <span>•</span>
                  <span>{f.zones.length} fields</span>
                </div>
                <div className="text-[10px] text-gray-400 truncate mt-0.5">
                  {f.location}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. DASHBOARD HEADER & ACTIONS */}
      {/* ============================================================ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-farm-green-pale flex items-center justify-center text-2xl shadow-sm">
              🚜
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="page-title text-2xl font-black">{farm.name}</h1>
                <span className="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                  Visually Active
                </span>
              </div>
              <p className="text-gray-500 flex items-center gap-1.5 mt-0.5 text-xs sm:text-sm">
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>{farm.location}</span>
                <span>•</span>
                <b className="text-gray-800 dark:text-gray-200">{farmAreaCalc.acres} acres</b>
                <span>•</span>
                <span>{farm.zones.length} field plots</span>
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Link
            to={`/farms/${farm.id}/builder`}
            className="btn-secondary flex items-center gap-2 text-xs sm:text-sm shadow-xs hover:border-farm-green"
          >
            <Compass className="w-4 h-4 text-farm-green" />
            Open Farm Map Builder
          </Link>
          <Link
            to={`/farms/${farm.id}/scenarios/new`}
            className="btn-secondary flex items-center gap-2 text-xs sm:text-sm"
          >
            <Plus className="w-4 h-4" />
            What-If Scenario
          </Link>
          <button
            onClick={runBaselineSimulation}
            disabled={simulating}
            className="btn-primary flex items-center gap-2 text-xs sm:text-sm shadow-md"
          >
            {simulating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            {simulating ? 'Simulating...' : 'Run Simulation'}
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. LIVE WEATHER INTEGRATION CARD */}
      {/* ============================================================ */}
      <WeatherCard
        weather={weather}
        loading={weatherLoading}
        isRefreshing={weatherRefreshing}
        error={weatherError}
        lastUpdatedLabel={weatherUpdatedLabel}
        agronomicImpact={agronomicImpact}
        onRefresh={refreshWeather}
        onApplyWeatherToZones={handleApplyWeatherToZones}
      />

      {/* ============================================================ */}
      {/* 4. DIGITAL FARM MAP (Only active farm displayed) */}
      {/* ============================================================ */}
      <div className="card p-0 overflow-hidden border border-gray-200 dark:border-gray-800 shadow-md">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50/50 dark:bg-gray-800/40">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-farm-green" />
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Interactive Digital Map: {farm.name}
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Only {farm.name} is active on the map. Click any plot to inspect field-level diagnostics.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Field deselection pill if a field is active */}
            {selectedZoneIndex !== null && (
              <button
                type="button"
                onClick={() => handleFieldSelect(null)}
                className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <span>Filtered: {selectedZone?.name}</span>
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Base tile layer switcher */}
            <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg p-0.5 border border-gray-200 dark:border-gray-700 text-xs">
              <button
                onClick={() => setActiveLayer('satellite')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  activeLayer === 'satellite' ? 'bg-farm-green text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🛰️ Satellite
              </button>
              <button
                onClick={() => setActiveLayer('streets')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  activeLayer === 'streets' ? 'bg-farm-green text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🗺️ Streets
              </button>
            </div>

            {/* View mode switcher */}
            <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg p-0.5 border border-gray-200 dark:border-gray-700 text-xs">
              <button
                onClick={() => setViewMode('health')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  viewMode === 'health' ? 'bg-emerald-700 text-white shadow-xs font-semibold' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                ❤️ Health
              </button>
              <button
                onClick={() => setViewMode('crops')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  viewMode === 'crops' ? 'bg-emerald-700 text-white shadow-xs font-semibold' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🌿 Crops
              </button>
              <button
                onClick={() => setViewMode('moisture')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  viewMode === 'moisture' ? 'bg-emerald-700 text-white shadow-xs font-semibold' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                💧 Moisture
              </button>
            </div>

            <Link
              to={`/farms/${farm.id}/builder`}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 rounded hover:bg-blue-50 flex items-center gap-1 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" /> Full Map Editor
            </Link>
          </div>
        </div>

        {/* Map canvas */}
        <div className="h-[480px] w-full relative">
          <DigitalFarmMap
            farmName={farm.name}
            center={mapCenter}
            farmBoundary={farm.boundary}
            zones={mapZoneInputs}
            selectedZoneIndex={selectedZoneIndex}
            drawingTool="none"
            drawingTarget="field"
            activeLayer={activeLayer}
            viewMode={viewMode}
            isEditingVertices={false}
            liveWeather={weather}
            onSelectZone={(idx) => handleFieldSelect(idx)}
            onUpdateFarmBoundary={() => {}}
            onAddFieldWithGeometry={() => {}}
            onUpdateZoneBoundary={() => {}}
            onCancelDrawing={() => {}}
            onValidationWarning={() => {}}
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/* 5. AREA STATISTICS: FARM-WIDE vs FIELD-SPECIFIC */}
      {/* ============================================================ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="section-title">
              {selectedZone ? (
                <span className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <span>{(CROP_EMOJIS as any)[selectedZone.crop] || '🌱'}</span>
                  <span>Field Statistics: {selectedZone.name}</span>
                </span>
              ) : (
                <span>Farm-Wide Statistics ({farm.name})</span>
              )}
            </h2>
            <span className="text-xs text-gray-500 font-normal">
              {selectedZone ? `• Specific plot diagnostics` : `• Aggregates across ${farm.zones.length} fields`}
            </span>
          </div>

          {selectedZone && (
            <button
              type="button"
              onClick={() => handleFieldSelect(null)}
              className="text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>View Whole Farm Aggregates</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* DYNAMIC METRIC CARDS */}
        {selectedZone ? (
          /* FIELD-SPECIFIC METRIC CARDS */
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard
              icon={Wheat}
              label="Field Area & Crop"
              value={`${selectedZone.area} ac`}
              unit={`(${selectedZone.crop})`}
              color="yellow"
            />
            <MetricCard
              icon={Heart}
              label="Crop Health"
              value={Math.round(selectedZone.healthScore ?? 75)}
              unit="%"
              color="green"
            />
            <MetricCard
              icon={Droplets}
              label="Soil Moisture"
              value={Math.round(selectedZone.soilMoisture)}
              unit="%"
              color="blue"
            />
            <MetricCard
              icon={Thermometer}
              label="Plot Temperature"
              value={(selectedZone.temperature ?? 28).toFixed(1)}
              unit="°C"
              color="yellow"
            />
            <MetricCard
              icon={Bug}
              label="Disease Risk"
              value={Math.round(selectedZone.diseaseRisk ?? 15)}
              unit="%"
              color="red"
            />
          </div>
        ) : (
          /* FARM-WIDE METRIC CARDS */
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard
              icon={TrendingUp}
              label="Total Farm Area"
              value={farmAreaCalc.acres}
              unit="acres"
              color="purple"
            />
            <MetricCard
              icon={Heart}
              label="Avg Crop Health"
              value={Math.round(avgHealth)}
              unit="%"
              color="green"
            />
            <MetricCard
              icon={Droplets}
              label="Avg Soil Moisture"
              value={Math.round(avgMoisture)}
              unit="%"
              color="blue"
            />
            <MetricCard
              icon={Bug}
              label="Avg Disease Risk"
              value={Math.round(avgDisease)}
              unit="%"
              color="red"
            />
            <MetricCard
              icon={Zap}
              label="Total Plots"
              value={farm.zones.length}
              unit="fields"
              color="yellow"
            />
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 6. RANDOM FOREST FARM RISK ANALYSIS & SCENARIO SUGGESTER */}
      {/* ============================================================ */}
      <AIRiskSuggesterCard farm={farm} selectedZone={selectedZone} />

      {/* ============================================================ */}
      {/* 7. FARM INTELLIGENCE DECISION SUPPORT */}
      {/* ============================================================ */}
      {farmIntelligence && (
        <FarmIntelligencePanel
          intelligence={farmIntelligence}
          onSelectField={(fieldName) => {
            const idx = farm.zones.findIndex((z) => z.name === fieldName);
            if (idx !== -1) {
              handleFieldSelect(idx);
            }
          }}
        />
      )}

      {/* ============================================================ */}
      {/* 7. CROP DISTRIBUTION */}
      {/* ============================================================ */}
      <div className="card">
        <h2 className="section-title mb-4">Crop Distribution Across Fields</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(cropDistribution).map(([crop, area]) => (
            <div
              key={crop}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-100 shadow-sm"
              style={{ backgroundColor: (CROP_COLORS as any)[crop] + '15' }}
            >
              <span className="text-xl">{(CROP_EMOJIS as any)[crop]}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800">{crop}</p>
                <p className="text-xs text-gray-500">
                  {area.toFixed(1)} acres ({((area / farmAreaCalc.acres) * 100).toFixed(0)}%)
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 8. TABLE <-> MAP LINKED FIELD PLOTS */}
      {/* ============================================================ */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="section-title">Farm Field Plots (Table ↔ Map Synchronized)</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Click any field to highlight it on the map and view field-specific diagnostics.
            </p>
          </div>
          <Link
            to={`/farms/${farm.id}/builder`}
            className="text-xs font-semibold text-farm-green hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            Configure Polygons & Soil in Map Builder <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {farm.zones.map((zone, idx) => {
            const isSelected = selectedZoneIndex === idx;
            return (
              <div
                key={zone.id || idx}
                ref={(el) => (fieldCardsRef.current[idx] = el)}
                onClick={() => handleFieldSelect(isSelected ? null : idx)}
                className={`zone-card cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'ring-3 ring-blue-600 shadow-xl scale-[1.02] border-blue-600 bg-blue-50/20'
                    : 'hover:border-gray-300'
                }`}
                style={{
                  borderColor: isSelected ? '#2563eb' : (CROP_COLORS as any)[zone.crop] + '60',
                  backgroundColor: isSelected ? undefined : (CROP_COLORS as any)[zone.crop] + '08',
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{(CROP_EMOJIS as any)[zone.crop]}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-gray-900">{zone.name}</h3>
                        {isSelected && (
                          <span className="text-[10px] bg-blue-600 text-white font-extrabold px-1.5 py-0.2 rounded-full">
                            SELECTED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {zone.crop} • {zone.area} acres • {zone.irrigationMethod}
                      </p>
                    </div>
                  </div>
                  <StatusBadge value={zone.healthScore ?? 75} />
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5 text-xs">
                      <Droplets className="w-3.5 h-3.5 text-blue-500" />
                      Moisture
                    </span>
                    <span className="font-bold text-blue-700">{zone.soilMoisture.toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5 text-xs">
                      <Thermometer className="w-3.5 h-3.5 text-orange-500" />
                      Temperature
                    </span>
                    <span className="font-medium text-gray-800">{zone.temperature.toFixed(1)}°C</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5 text-xs">
                      <Bug className="w-3.5 h-3.5 text-red-500" />
                      Disease Risk
                    </span>
                    <span className="font-medium text-gray-800">{(zone.diseaseRisk ?? 15).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5 text-xs">
                      <Wheat className="w-3.5 h-3.5 text-amber-600" />
                      Soil Type
                    </span>
                    <span className="font-medium text-gray-800">{zone.soilType}</span>
                  </div>
                </div>

                {/* NPK mini bar */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-1.5">NPK Levels (kg/ha)</p>
                  <div className="flex gap-1">
                    <div className="flex-1">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(100, zone.nitrogen)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">N: {Math.round(zone.nitrogen)}</p>
                    </div>
                    <div className="flex-1">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500 rounded-full"
                          style={{ width: `${Math.min(100, zone.phosphorus * 2)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">P: {Math.round(zone.phosphorus)}</p>
                    </div>
                    <div className="flex-1">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${Math.min(100, zone.potassium * 2)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">K: {Math.round(zone.potassium)}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
