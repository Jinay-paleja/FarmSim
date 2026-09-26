import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Droplets, Heart, Bug, Zap, TrendingUp, Sparkles,
  ArrowLeft, GitCompare, Play, Pause, SkipForward, SkipBack,
  Sun, Flame, Waves, CloudRain, Clock, AlertTriangle, ShieldCheck,
  Square, RotateCcw,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import toast from 'react-hot-toast';
import { simulationApi, farmApi } from '../services/api';
import { isMockEnabled } from '../services/mockData';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ErrorDisplay from '../components/shared/ErrorDisplay';
import MetricCard from '../components/shared/MetricCard';
import DigitalFarmMap, { MapVisualizationMode } from '../components/map/DigitalFarmMap';
import VirtualFarmWorkspace from '../components/virtual/VirtualFarmWorkspace';
import type { SimulationResult, Farm, ZoneInput } from '../types';
import { CROP_EMOJIS } from '../types';
import { useFarmWeather } from '../hooks/useFarmWeather';
import FarmerExplanationCard from '../components/intelligence/FarmerExplanationCard';
import { analyzeSimulationResults } from '../services/aiResultAnalysis';

import ErrorBoundary from '../components/shared/ErrorBoundary';

const CHART_COLORS = {
  soilMoisture: '#3B82F6',
  cropHealth: '#10B981',
  diseaseRisk: '#EF4444',
  waterConsumption: '#6366F1',
  expectedYield: '#F59E0B',
};

export default function SimulationResultsPage() {
  return (
    <ErrorBoundary
      fallbackTitle="Simulation Display Notice"
      fallbackMessage="Unable to render the full simulation visualization, but your simulation data is safe."
    >
      <SimulationResultsView />
    </ErrorBoundary>
  );
}

function SimulationResultsView() {
  const { farmId, simId } = useParams<{ farmId: string; simId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<SimulationResult | null>(() => {
    try {
      const cached = localStorage.getItem('last_simulation_result');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (!simId || parsed.id === simId || parsed.simulation_id === simId) {
          return parsed;
        }
      }
    } catch {
      // ignore parse errors
    }
    return null;
  });
  const [farm, setFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChart, setActiveChart] = useState<string>('all');

  // Timestep interactive playback state
  const [currentDayIdx, setCurrentDayIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1x or 2x

  // Weather hook for the farm
  const { weather } = useFarmWeather({
    latitude: farm?.latitude,
    longitude: farm?.longitude,
    zones: farm?.zones,
  });

  const [mapVisMode, setMapVisMode] = useState<MapVisualizationMode>('simulation');

  useEffect(() => {
    loadData();
  }, [simId, farmId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    let resolvedSim: SimulationResult | null = null;

    try {
      // 1. Try loading by simId if provided
      if (simId && simId !== 'undefined' && simId !== 'null') {
        resolvedSim = await simulationApi.get(simId);
        setResult(resolvedSim);
      } else {
        // Fallback: check cached result
        const cached = localStorage.getItem('last_simulation_result');
        if (cached) {
          resolvedSim = JSON.parse(cached);
          setResult(resolvedSim);
        } else if (farmId && farmId !== 'undefined') {
          // Fallback: check farm's recent simulations list
          const list = await simulationApi.list(farmId);
          if (list && list.length > 0) {
            resolvedSim = list[0];
            setResult(resolvedSim);
          }
        }
      }

      // 2. Load Farm for Workspace if farmId is present
      const targetFarmId = farmId || resolvedSim?.farmId || (resolvedSim as any)?.farm_id;
      if (targetFarmId && targetFarmId !== 'undefined' && targetFarmId !== 'null') {
        try {
          const farmData = await farmApi.get(targetFarmId);
          setFarm(farmData);
        } catch {
          // ignore optional farm load error
        }
      }
    } catch (err: any) {
      console.warn('Simulation load issue:', err);
      // If we already have a cached result, keep showing it without blocking error
      if (!result && !resolvedSim) {
        const cached = localStorage.getItem('last_simulation_result');
        if (cached) {
          try {
            setResult(JSON.parse(cached));
          } catch {
            setError(err?.message || 'Failed to load simulation results');
          }
        } else {
          setError(err?.message || 'Simulation result unavailable');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Playback timer effect
  useEffect(() => {
    if (!isPlaying || !result || !result.timeline || result.timeline.length === 0) return;
    const interval = setInterval(() => {
      setCurrentDayIdx((prev) => {
        if (prev >= (result.timeline?.length || 1) - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1400 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, result, playbackSpeed]);

  const timelineList = result?.timeline || [];
  const currentPoint = timelineList[currentDayIdx] || timelineList[0] || {
    day: 1,
    label: 'Day 1',
    soilMoisture: result?.summary?.averageSoilMoisture || 50,
    cropHealth: result?.summary?.averageCropHealth || 75,
    diseaseRisk: result?.summary?.averageDiseaseRisk || 10,
    waterConsumption: 0,
    expectedYield: result?.summary?.totalExpectedYield || 80,
    temperature: 25,
    rainfall: 10,
    waterStress: 0,
    heatStress: 0,
    pestRisk: 10,
    zones: [],
  };

  // Map dynamic zone telemetry for the active timestep
  const currentMapZones: ZoneInput[] = useMemo(() => {
    if (!farm && !currentPoint.zones?.length) return [];
    const baseZones = farm?.zones || [];
    if (baseZones.length === 0 && currentPoint.zones && currentPoint.zones.length > 0) {
      return currentPoint.zones.map((zSim: any, idx: number) => ({
        name: zSim.zoneName || `Zone ${idx + 1}`,
        area: 5,
        crop: (zSim.crop || 'Wheat') as any,
        soilType: (zSim.soil || 'Loamy') as any,
        growthStage: 'Vegetative' as any,
        irrigationMethod: 'Drip' as any,
        soilMoisture: zSim.soilMoisture,
        temperature: currentPoint.temperature || 25,
        humidity: 60,
        rainfall: 15,
        nitrogen: 50,
        phosphorus: 40,
        potassium: 40,
        healthScore: zSim.cropHealth,
        diseaseRisk: zSim.diseaseRisk,
      }));
    }

    return baseZones.map((baseZone) => {
      const zSim = currentPoint.zones?.find(
        (zt) => zt.zoneId === baseZone.id || zt.zoneName === baseZone.name
      );
      if (!zSim) return { ...baseZone, boundary: baseZone.boundary || [] };

      return {
        ...baseZone,
        boundary: baseZone.boundary || [],
        soilMoisture: zSim.soilMoisture,
        healthScore: zSim.cropHealth,
        diseaseRisk: zSim.diseaseRisk,
        pestRisk: zSim.pestRisk,
        temperature: currentPoint.temperature ?? baseZone.temperature,
        stressState: zSim.stressState,
        waterStress: zSim.waterStress,
        yieldPotential: zSim.yieldPotential,
      } as any;
    });
  }, [farm, currentPoint]);

  const farmerExplanation = useMemo(() => {
    if (!result) return null;
    try {
      return analyzeSimulationResults(result);
    } catch (e) {
      console.warn('AI analysis evaluation deferred:', e);
      return null;
    }
  }, [result]);

  if (loading && !result) return <LoadingSpinner message="Loading simulation results..." fullPage />;
  if (error && !result) {
    return (
      <div className="page-container py-12">
        <ErrorDisplay
          title="Simulation Result Unavailable"
          message={error || 'Unable to load simulation result. Please check the simulation ID or run a new simulation.'}
          onRetry={loadData}
        />
        <div className="mt-4 text-center">
          <Link
            to={farmId ? `/farms/${farmId}/scenarios/new` : '/dashboard'}
            className="btn-primary inline-flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Back to Simulation Setup
          </Link>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="page-container py-12">
        <ErrorDisplay
          title="Simulation Result Unavailable"
          message="No active simulation result was found."
          onRetry={loadData}
        />
        <div className="mt-4 text-center">
          <Link
            to={farmId ? `/farms/${farmId}/scenarios/new` : '/dashboard'}
            className="btn-primary inline-flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Back to Simulation Setup
          </Link>
        </div>
      </div>
    );
  }

  const chartTabs = [
    { key: 'all', label: 'Overview' },
    { key: 'soilMoisture', label: 'Soil Moisture', color: CHART_COLORS.soilMoisture },
    { key: 'cropHealth', label: 'Crop Health', color: CHART_COLORS.cropHealth },
    { key: 'diseaseRisk', label: 'Disease Risk', color: CHART_COLORS.diseaseRisk },
    { key: 'waterConsumption', label: 'Water Usage', color: CHART_COLORS.waterConsumption },
    { key: 'expectedYield', label: 'Expected Yield', color: CHART_COLORS.expectedYield },
  ];

  return (
    <div className="page-container pb-20 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => navigate(farmId ? `/farms/${farmId}` : '/dashboard')}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Farm
            </button>
            <span className="text-gray-300">•</span>
            <Link
              to={farmId ? `/farms/${farmId}/scenarios/new` : '/dashboard'}
              className="flex items-center gap-1.5 text-sm text-farm-green hover:underline cursor-pointer font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Return to Simulation Setup
            </Link>
          </div>
          <h1 className="page-title flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-farm-green" />
            {result.scenarioName || 'Simulation'} Results
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            Mode: {result.mode === 'what_if' ? 'What-If Weather Scenario' : 'Real Weather Forecast Baseline'} • {result.timeline?.length || 0} Simulated Days
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={farmId ? `/farms/${farmId}/scenarios/new` : '/dashboard'}
            className="btn-secondary flex items-center gap-2"
          >
            New Scenario
          </Link>
          <Link
            to={farmId ? `/farms/${farmId}/compare` : '/dashboard'}
            className="btn-primary flex items-center gap-2"
          >
            <GitCompare className="w-4 h-4" />
            Compare
          </Link>
        </div>
      </div>

      {/* 1. SIMULATION TIMELINE CONTROLLER & PLAYER */}
      <div className="card border-2 border-farm-green/20 bg-stone-900 text-white shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-12 h-12 rounded-xl bg-farm-green hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer"
              title={isPlaying ? 'Pause Simulation' : 'Play Timeline'}
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
            </button>

            <div>
              <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <span>Simulation Timestep</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
              <div className="text-xl font-black text-white flex items-center gap-2">
                <span>{currentPoint.label}</span>
                <span className="text-xs font-normal text-stone-400">
                  (Day {currentPoint.day} of {result.timeline.length})
                </span>
              </div>
            </div>
          </div>

          {/* Stepper buttons & Speed toggle */}
          <div className="flex items-center gap-2 self-stretch md:self-auto justify-between">
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setCurrentDayIdx(0);
              }}
              className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300"
              title="Stop Simulation & Reset to Day 1"
            >
              <Square className="w-4 h-4 fill-current text-rose-400" />
            </button>

            <button
              type="button"
              onClick={() => setCurrentDayIdx((prev) => Math.max(0, prev - 1))}
              disabled={currentDayIdx === 0}
              className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-300"
              title="Previous Day"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setCurrentDayIdx((prev) => Math.min(result.timeline.length - 1, prev + 1))}
              disabled={currentDayIdx === result.timeline.length - 1}
              className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-300"
              title="Next Day"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <div className="border-l border-stone-700 pl-2 flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setPlaybackSpeed(1)}
                className={`px-2 py-1 rounded-md font-bold ${
                  playbackSpeed === 1 ? 'bg-farm-green text-white' : 'text-stone-400 hover:text-white'
                }`}
              >
                1x
              </button>
              <button
                type="button"
                onClick={() => setPlaybackSpeed(2)}
                className={`px-2 py-1 rounded-md font-bold ${
                  playbackSpeed === 2 ? 'bg-farm-green text-white' : 'text-stone-400 hover:text-white'
                }`}
              >
                2x
              </button>
            </div>
          </div>
        </div>

        {/* Day Scrub Buttons */}
        <div className="pt-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {result.timeline.map((pt, idx) => (
            <button
              key={pt.day}
              type="button"
              onClick={() => {
                setCurrentDayIdx(idx);
                setIsPlaying(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                currentDayIdx === idx
                  ? 'bg-emerald-500 text-white shadow-md scale-105'
                  : 'bg-stone-800/80 text-stone-400 hover:bg-stone-700 hover:text-white'
              }`}
            >
              {pt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. REAL WEATHER vs SIMULATED TIMELINE UI CARD */}
      <div className="card border-2 border-emerald-500/20 bg-gradient-to-r from-emerald-50/60 via-white to-amber-50/60 dark:from-emerald-950/20 dark:via-gray-900 dark:to-amber-950/20 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* REAL WEATHER FORECAST */}
          <div className="flex-1 bg-white/95 dark:bg-gray-800/95 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1 flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-emerald-500" />
              REAL WEATHER FORECAST
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-gray-900 dark:text-white">
                {currentPoint.baselineTemperature ?? 31}°C
              </span>
              <span className="text-sm font-semibold text-blue-600">
                🌧️ {currentPoint.baselineRainfall ?? 12} mm rain
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Local atmospheric baseline for {currentPoint.label}
            </div>
          </div>

          {/* VS SEPARATOR */}
          <div className="text-center font-black text-sm text-gray-400 uppercase tracking-widest px-2">
            VS
          </div>

          {/* SIMULATED WEATHER */}
          <div className="flex-1 bg-white/95 dark:bg-gray-800/95 p-4 rounded-xl border border-amber-300 dark:border-amber-700 shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-500" />
              SIMULATED MICROCLIMATE
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-amber-800 dark:text-amber-300">
                {currentPoint.temperature ?? 36}°C
              </span>
              <span className="text-sm font-semibold text-blue-600">
                🌧️ {currentPoint.rainfall ?? 2} mm rain
              </span>
            </div>
            <div className="text-xs text-amber-700 dark:text-amber-300 mt-1 font-semibold flex items-center gap-1.5">
              <span>Status:</span>
              <span className="uppercase px-1.5 py-0.2 bg-amber-100 dark:bg-amber-900/50 rounded text-[10px]">
                {currentPoint.weatherCondition || 'NORMAL'}
              </span>
            </div>
          </div>
        </div>

        {/* Timestep Stress Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs">
          <div className="bg-white/70 dark:bg-gray-800/70 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700">
            <span className="text-gray-500 block text-[11px]">Water Stress Risk</span>
            <span className={`font-bold text-sm ${(currentPoint.waterStress ?? 0) > 50 ? 'text-red-600' : 'text-emerald-600'}`}>
              {currentPoint.waterStress ?? 0}%
            </span>
          </div>
          <div className="bg-white/70 dark:bg-gray-800/70 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700">
            <span className="text-gray-500 block text-[11px]">Heat Stress Risk</span>
            <span className={`font-bold text-sm ${(currentPoint.heatStress ?? 0) > 50 ? 'text-orange-600' : 'text-emerald-600'}`}>
              {currentPoint.heatStress ?? 0}%
            </span>
          </div>
          <div className="bg-white/70 dark:bg-gray-800/70 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700">
            <span className="text-gray-500 block text-[11px]">Disease Risk</span>
            <span className={`font-bold text-sm ${currentPoint.diseaseRisk > 50 ? 'text-purple-600' : 'text-gray-700 dark:text-gray-300'}`}>
              {Math.round(currentPoint.diseaseRisk)}%
            </span>
          </div>
          <div className="bg-white/70 dark:bg-gray-800/70 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700">
            <span className="text-gray-500 block text-[11px]">Pest Risk</span>
            <span className={`font-bold text-sm ${(currentPoint.pestRisk ?? 15) > 50 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
              {Math.round(currentPoint.pestRisk ?? 15)}%
            </span>
          </div>
        </div>
      </div>

      {/* 3. VIRTUAL FARM WORKSPACE TELEMETRY */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title flex items-center gap-2">
              <Waves className="w-5 h-5 text-farm-green" />
              Virtual Farm Simulation Canvas
            </h2>
            <p className="text-xs text-gray-500">
              Visualizing crop health, soil moisture, and microclimate at {currentPoint.label}
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-1 rounded-full">
            {currentPoint.label} • {currentPoint.temperature}°C
          </span>
        </div>

        <div className="w-full">
          <VirtualFarmWorkspace
            farmName={farm?.name || 'Digital Farm'}
            totalArea={farm?.area || result.farm_area_acres || 10}
            zones={currentMapZones}
            onZonesChange={() => {}}
            selectedZoneIndex={null}
            onSelectZone={() => {}}
            readOnly={true}
          />
        </div>
      </div>

      {/* 4. FIELD DIFFERENCES & CROP-SPECIFIC BEHAVIOR */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="section-title">Field Differences & Agronomic Behavior</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              How individual crops, soil retention profiles, and irrigation systems react at {currentPoint.label}
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full">
            {currentPoint.zones?.length || 0} Fields Analyzed
          </span>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentPoint.zones?.map((zone) => {
            const isDroughtStress = (zone.waterStress ?? 0) > 50;
            const isHeatStress = (zone.heatStress ?? 0) > 50;
            return (
              <div
                key={zone.zoneId}
                className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs hover:border-farm-green/50 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                      <span>{(CROP_EMOJIS as any)[zone.crop || ''] || '🌱'}</span>
                      <span>{zone.zoneName}</span>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {zone.crop} • {zone.soil} Soil
                    </div>
                  </div>
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      zone.stressState === 'drought'
                        ? 'bg-amber-100 text-amber-800'
                        : zone.stressState === 'heat_stress'
                        ? 'bg-orange-100 text-orange-800'
                        : zone.stressState === 'flooded'
                        ? 'bg-sky-100 text-sky-800'
                        : zone.stressState === 'severe_stress'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {zone.stressState?.replace('_', ' ') || 'healthy'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-gray-100 dark:border-gray-800 my-2">
                  <div>
                    <span className="text-gray-400 block text-[10px]">Crop Health</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">{zone.cropHealth}%</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Soil Moisture</span>
                    <span className="font-bold text-blue-700 dark:text-blue-400">{zone.soilMoisture}%</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Water Stress</span>
                    <span className={`font-semibold ${isDroughtStress ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                      {zone.waterStress ?? 0}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Yield Potential</span>
                    <span className="font-semibold text-purple-700 dark:text-purple-400">
                      {zone.yieldPotential ?? zone.expectedYield}%
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-gray-600 dark:text-gray-400 mt-2 bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
                  {zone.crop === 'Rice' && isDroughtStress && '⚠️ High water requirement crop wilting rapidly under moisture deficit.'}
                  {zone.crop === 'Pearl Millet' && '🌾 Low water requirement allows continued physiological endurance.'}
                  {zone.crop === 'Cotton' && isHeatStress && '🌡️ Heat-tolerant foliage buffers temperature, but transpiration is elevated.'}
                  {!['Rice', 'Pearl Millet', 'Cotton'].includes(zone.crop || '') && `${zone.crop} reacting according to ${zone.soil} soil retention capacity.`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. FARMER EXPLANATION & TRADE-OFF ANALYSIS ENGINE */}
      {farmerExplanation && (
        <FarmerExplanationCard
          explanation={farmerExplanation}
          scenarioName={result.scenarioName || 'Simulated Scenario'}
        />
      )}

      {/* 6. BASELINE VERSUS SCENARIO COMPARISON (At the end) */}
      {result.baselineSummary && (
        <div className="card border-2 border-indigo-500/20 bg-gradient-to-br from-indigo-50/30 via-white to-purple-50/30 dark:from-indigo-950/20 dark:via-gray-900 dark:to-purple-950/20 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="section-title flex items-center gap-2 text-indigo-900 dark:text-indigo-300">
                <GitCompare className="w-5 h-5 text-indigo-600" />
                Baseline versus Scenario Comparison
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Clear variance between Real Weather Forecast baseline and simulated scenario
              </p>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 px-3 py-1 rounded-full self-start sm:self-auto">
              Variance Matrix
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Crop Health */}
            {(() => {
              const baseHealth = result.baselineSummary.averageCropHealth;
              const scenHealth = result.summary.averageCropHealth;
              const diff = result.comparisonDiff?.cropHealthDiff ?? (Math.round((scenHealth - baseHealth) * 10) / 10);
              return (
                <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs">
                  <span className="text-xs text-gray-500 block mb-1">Crop Health</span>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-xs text-gray-400">Baseline: <b className="text-gray-700 dark:text-gray-300">{baseHealth}%</b></div>
                      <div className="text-xl font-black text-gray-900 dark:text-white mt-0.5">Scenario: {scenHealth}%</div>
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        diff >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {diff >= 0 ? `+${diff}%` : `${diff}%`}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Soil Moisture */}
            {(() => {
              const baseMoist = result.baselineSummary.averageSoilMoisture;
              const scenMoist = result.summary.averageSoilMoisture;
              const diff = result.comparisonDiff?.soilMoistureDiff ?? (Math.round((scenMoist - baseMoist) * 10) / 10);
              return (
                <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs">
                  <span className="text-xs text-gray-500 block mb-1">Soil Moisture</span>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-xs text-gray-400">Baseline: <b className="text-gray-700 dark:text-gray-300">{baseMoist}%</b></div>
                      <div className="text-xl font-black text-gray-900 dark:text-white mt-0.5">Scenario: {scenMoist}%</div>
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        diff >= 0 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {diff >= 0 ? `+${diff}%` : `${diff}%`}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Yield Potential */}
            {(() => {
              const baseYield = result.baselineSummary.totalExpectedYield;
              const scenYield = result.summary.totalExpectedYield;
              const diff = result.comparisonDiff?.yieldDiff ?? (Math.round((scenYield - baseYield) * 10) / 10);
              return (
                <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs">
                  <span className="text-xs text-gray-500 block mb-1">Yield Potential</span>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-xs text-gray-400">Baseline: <b className="text-gray-700 dark:text-gray-300">{baseYield}%</b></div>
                      <div className="text-xl font-black text-gray-900 dark:text-white mt-0.5">Scenario: {scenYield}%</div>
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        diff >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {diff >= 0 ? `+${diff}%` : `${diff}%`}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Water Usage */}
            {(() => {
              const baseWater = result.baselineSummary.totalWaterUsage;
              const scenWater = result.summary.totalWaterUsage;
              const diff = result.comparisonDiff?.waterUsageDiff ?? (scenWater - baseWater);
              return (
                <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs">
                  <span className="text-xs text-gray-500 block mb-1">Water Consumption</span>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-xs text-gray-400">Baseline: <b className="text-gray-700 dark:text-gray-300">{(baseWater / 1000).toFixed(0)}k L</b></div>
                      <div className="text-xl font-black text-gray-900 dark:text-white mt-0.5">Scenario: {(scenWater / 1000).toFixed(0)}k L</div>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                      {diff !== 0 ? `${(diff / 1000).toFixed(1)}k L` : '0 L'}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 6. DECISION SUPPORT CARD: "What is likely to happen if this condition continues?" */}
      <div className="card bg-gradient-to-br from-emerald-950 via-teal-950 to-stone-900 text-white shadow-xl border border-emerald-500/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0 text-2xl shadow-inner">
            🧠
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-emerald-300">
                Decision Support: What is likely to happen if this condition continues?
              </h2>
              <span className="text-[10px] uppercase font-extrabold tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">
                Decision-Support Tool
              </span>
            </div>
            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
              {result.decisionSupportNote || result.aiExplanation || 'Simulation completed successfully. Crop and soil moisture dynamics calculated across all zones.'}
            </p>
            <div className="text-xs text-emerald-300/80 pt-2 border-t border-white/10 flex items-center gap-1.5">
              <span>💡</span>
              <span>
                This simulation provides agricultural risk guidance and decision support to evaluate intervention strategies, not an exact prediction of real-world crop yield.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 7. SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          icon={Droplets}
          label="Avg Soil Moisture"
          value={result.summary?.averageSoilMoisture ?? 0}
          unit="%"
          color="blue"
        />
        <MetricCard
          icon={Heart}
          label="Avg Crop Health"
          value={result.summary?.averageCropHealth ?? 0}
          unit="%"
          color="green"
        />
        <MetricCard
          icon={Bug}
          label="Avg Disease Risk"
          value={result.summary?.averageDiseaseRisk ?? 0}
          unit="%"
          color="red"
        />
        <MetricCard
          icon={Zap}
          label="Total Water Usage"
          value={result.summary?.totalWaterUsage ?? 0}
          unit="L"
          color="purple"
        />
        <MetricCard
          icon={TrendingUp}
          label="Expected Yield"
          value={result.summary?.totalExpectedYield ?? 0}
          unit="%"
          color="yellow"
        />
      </div>

      {/* 8. CHART SECTION */}
      <div className="card">
        {/* Chart Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {chartTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveChart(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeChart === tab.key
                  ? 'bg-farm-green text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            {activeChart === 'all' ? (
              <LineChart data={result.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="soilMoisture"
                  name="Soil Moisture %"
                  stroke={CHART_COLORS.soilMoisture}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="cropHealth"
                  name="Crop Health %"
                  stroke={CHART_COLORS.cropHealth}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="diseaseRisk"
                  name="Disease Risk %"
                  stroke={CHART_COLORS.diseaseRisk}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="expectedYield"
                  name="Yield Potential %"
                  stroke={CHART_COLORS.expectedYield}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            ) : (
              <AreaChart data={result.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={activeChart}
                  stroke={(CHART_COLORS as any)[activeChart] || '#10B981'}
                  fill={(CHART_COLORS as any)[activeChart] || '#10B981'}
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* 9. TIMELINE DATA TABLE */}
      <div className="card">
        <h2 className="section-title mb-4">Complete Timestep Data Log</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left py-3 px-4 font-semibold text-gray-600 dark:text-gray-400">Day</th>
                <th className="text-right py-3 px-4 font-semibold text-orange-600">Temp (°C)</th>
                <th className="text-right py-3 px-4 font-semibold text-blue-600">Rain (mm)</th>
                <th className="text-right py-3 px-4 font-semibold text-blue-600">Moisture %</th>
                <th className="text-right py-3 px-4 font-semibold text-emerald-600">Health %</th>
                <th className="text-right py-3 px-4 font-semibold text-red-600">Water Stress %</th>
                <th className="text-right py-3 px-4 font-semibold text-purple-600">Yield Potential %</th>
              </tr>
            </thead>
            <tbody>
              {result.timeline.map((point) => (
                <tr
                  key={point.day}
                  onClick={() => setCurrentDayIdx(point.day - 1)}
                  className={`border-b border-gray-50 dark:border-gray-800/60 cursor-pointer transition-colors ${
                    currentPoint.day === point.day
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 font-semibold'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
                  }`}
                >
                  <td className="py-3 px-4 text-gray-900 dark:text-gray-100">{point.label}</td>
                  <td className="py-3 px-4 text-right text-orange-600">{point.temperature ?? 28}°C</td>
                  <td className="py-3 px-4 text-right text-blue-600">{point.rainfall ?? 0} mm</td>
                  <td className="py-3 px-4 text-right text-blue-700 dark:text-blue-400">{point.soilMoisture.toFixed(1)}%</td>
                  <td className="py-3 px-4 text-right text-emerald-700 dark:text-emerald-400">{point.cropHealth.toFixed(1)}%</td>
                  <td className="py-3 px-4 text-right text-red-600">{point.waterStress ?? 0}%</td>
                  <td className="py-3 px-4 text-right text-purple-700 dark:text-purple-400">{point.expectedYield.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
