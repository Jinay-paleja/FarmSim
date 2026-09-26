import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles, Play, Plus, Trash2, CheckSquare, Square,
  CloudRain, Thermometer, Droplets, Bug, FlaskConical,
  Loader2, Zap, MessageSquare, Clock, Sun, CloudSun,
  Flame, Waves, Sliders, CheckCircle2, HelpCircle, Code,
  ArrowRight, Brain, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { farmApi, scenarioApi, simulationApi } from '../services/api';
import { firestoreService } from '../services/firestoreService';
import { isMockEnabled, createMockSimulation } from '../services/mockData';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ErrorDisplay from '../components/shared/ErrorDisplay';
import AIRiskSuggesterCard from '../components/intelligence/AIRiskSuggesterCard';
import { parseNaturalLanguageScenario } from '../services/nlpScenarioParser';
import type {
  Farm,
  Scenario,
  ScenarioChange,
  SimulationResult,
  WeatherMode,
  WhatIfWeatherPreset,
  WeatherModifiers,
  StructuredScenarioJSON,
  ScenarioType,
  SuggestedQuickTest,
} from '../types';
import { SCENARIO_PRESETS, CROP_EMOJIS } from '../types';
import { useFarmWeather } from '../hooks/useFarmWeather';
import { WHAT_IF_PRESETS } from '../services/simulationEngine';

export default function ScenarioBuilderPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [farm, setFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Weather Hook
  const { weather } = useFarmWeather({
    latitude: farm?.latitude,
    longitude: farm?.longitude,
    zones: farm?.zones,
  });

  // Creation Method: 'manual' (Manual Simulation Controls) vs 'nlp' (Natural-Language Input)
  const [creationMethod, setCreationMethod] = useState<'manual' | 'nlp'>('manual');

  // Manual Controls State
  const [name, setName] = useState('Heatwave Scenario');
  const [duration, setDuration] = useState(45);
  const [affectedZones, setAffectedZones] = useState<string[]>([]);

  // Manual Sliders
  // Rainfall: -100% to +100% (default: -40%)
  const [rainfallPctDelta, setRainfallPctDelta] = useState<number>(-40);
  // Temperature: -6°C to +12°C (default: +2°C)
  const [tempDelta, setTempDelta] = useState<number>(2.0);
  // Irrigation: -100% to +100% (default: -20%)
  const [irrigationPctDelta, setIrrigationPctDelta] = useState<number>(-20);
  const [irrigationFailure, setIrrigationFailure] = useState<boolean>(false);
  const [nitrogenPctDelta, setNitrogenPctDelta] = useState<number>(0);

  // Natural Language Input State
  const [nlQuery, setNlQuery] = useState(
    'What if rainfall drops by 40% for the next 45 days in Zone A?'
  );

  const [showJsonPreview, setShowJsonPreview] = useState(true);
  const [showAdvancedChanges, setShowAdvancedChanges] = useState(false);
  const [changes, setChanges] = useState<ScenarioChange[]>([]);

  // Handle URL preset params (e.g. from Quick Test button)
  useEffect(() => {
    const preset = searchParams.get('preset');
    const dur = searchParams.get('duration');
    if (preset) {
      if (preset.includes('RAIN_REDUCTION')) {
        setRainfallPctDelta(-40);
        setName('Rainfall Reduction Scenario');
      } else if (preset.includes('HEATWAVE')) {
        setTempDelta(4.0);
        setRainfallPctDelta(-30);
        setName('Heatwave Scenario');
      } else if (preset.includes('IRRIGATION_FAILURE')) {
        setIrrigationFailure(true);
        setName('Pump Breakdown Scenario');
      }
    }
    if (dur) {
      setDuration(parseInt(dur, 10));
    }
  }, [searchParams]);

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
      setAffectedZones(farmData.zones.map((z) => z.id));
    } catch (err: any) {
      setError(err?.message || 'Failed to load farm');
    } finally {
      setLoading(false);
    }
  };

  // Base weather values
  const actualTemp = weather?.temperature ?? 31;
  const actualRain = weather?.rain ?? 12;

  // ------------------------------------------------------------
  // NLP Processing Pipeline (TF-IDF + Logistic Regression)
  // ------------------------------------------------------------
  const nlpAnalysis = useMemo(() => {
    if (!farm) return null;
    return parseNaturalLanguageScenario(nlQuery, farm.zones);
  }, [nlQuery, farm]);

  // ------------------------------------------------------------
  // Unified Structured Scenario JSON (Same contract for both paths)
  // ------------------------------------------------------------
  const structuredScenarioJson: StructuredScenarioJSON = useMemo(() => {
    if (creationMethod === 'nlp' && nlpAnalysis) {
      return nlpAnalysis.scenarioJson;
    }

    // Manual Controls Path -> Converts directly into Structured Scenario JSON
    const rainMultiplier = Math.max(0, Math.round((1 + rainfallPctDelta / 100) * 100) / 100);
    const irrMultiplier = irrigationFailure
      ? 0.0
      : Math.max(0, Math.round((1 + irrigationPctDelta / 100) * 100) / 100);

    let scenarioType: ScenarioType = 'COMBINED';
    if (rainfallPctDelta < -10 && tempDelta === 0 && irrigationPctDelta === 0) {
      scenarioType = 'RAIN_REDUCTION';
    } else if (tempDelta >= 4 && rainfallPctDelta === 0) {
      scenarioType = 'HEATWAVE';
    } else if (tempDelta > 0 && rainfallPctDelta === 0) {
      scenarioType = 'TEMPERATURE_INCREASE';
    } else if (irrigationFailure) {
      scenarioType = 'IRRIGATION_FAILURE';
    } else if (irrigationPctDelta < 0 && rainfallPctDelta === 0 && tempDelta === 0) {
      scenarioType = 'IRRIGATION_DECREASE';
    }

    const targetNames = farm
      ? farm.zones.filter((z) => affectedZones.includes(z.id)).map((z) => z.name)
      : ['All Zones'];

    return {
      scenario_type: scenarioType,
      duration_days: duration,
      target_zones: targetNames.length > 0 ? targetNames : ['All Zones'],
      changes: {
        rainfall_multiplier: rainMultiplier,
        temperature_delta: tempDelta,
        irrigation_multiplier: irrMultiplier,
        irrigation_failure: irrigationFailure || undefined,
        nitrogen_multiplier: nitrogenPctDelta !== 0 ? Math.round((1 + nitrogenPctDelta / 100) * 100) / 100 : undefined,
      },
    };
  }, [
    creationMethod,
    nlpAnalysis,
    rainfallPctDelta,
    tempDelta,
    irrigationPctDelta,
    irrigationFailure,
    nitrogenPctDelta,
    duration,
    affectedZones,
    farm,
  ]);

  // Handler: When user clicks a Quick Test suggestion
  const handleApplyQuickTest = (test: SuggestedQuickTest) => {
    setCreationMethod('manual');
    setName(test.title);
    setDuration(test.durationDays);

    if (test.changes.rainfall_multiplier !== undefined) {
      const pct = Math.round((test.changes.rainfall_multiplier - 1) * 100);
      setRainfallPctDelta(pct);
    }
    if (test.changes.temperature_delta !== undefined) {
      setTempDelta(test.changes.temperature_delta);
    }
    if (test.changes.irrigation_multiplier !== undefined) {
      const pct = Math.round((test.changes.irrigation_multiplier - 1) * 100);
      setIrrigationPctDelta(pct);
    }
    if (test.changes.irrigation_failure) {
      setIrrigationFailure(true);
    } else {
      setIrrigationFailure(false);
    }

    toast.success(`Loaded Quick Test: ${test.title}`);
  };

  const toggleZone = (zoneId: string) => {
    setAffectedZones((prev) =>
      prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId]
    );
  };

  // Launch Simulation
  const handleRun = async () => {
    if (!farm) return;
    if (affectedZones.length === 0 && creationMethod === 'manual') {
      toast.error('Select at least one field to simulate');
      return;
    }

    setRunning(true);
    try {
      const scenarioPayload: Partial<Scenario> = {
        farmId: farm.id,
        name: creationMethod === 'nlp' ? `NLP: ${nlQuery.slice(0, 32)}...` : name,
        duration: structuredScenarioJson.duration_days,
        affectedZones,
        naturalLanguageQuery: creationMethod === 'nlp' ? nlQuery : undefined,
      };

      let result: SimulationResult;
      try {
        const createdScenario = await scenarioApi.create(scenarioPayload);
        // Mirror scenario + simulation to Firestore for browser-side access.
        firestoreService.saveScenario(createdScenario);
        result = await simulationApi.run({
          farmId: farm.id,
          scenarioId: createdScenario.id,
          zones: farm.zones.filter((z) => affectedZones.includes(z.id)),
          scenario: createdScenario,
          mode: 'what_if',
          durationDays: structuredScenarioJson.duration_days,
        });
        firestoreService.saveSimulation(result);
      } catch {
        if (isMockEnabled()) {
          result = createMockSimulation(
            farm.id,
            scenarioPayload.name || 'What-If Scenario'
          );
          const sims = JSON.parse(localStorage.getItem('simulations') || '[]');
          sims.push(result);
          localStorage.setItem('simulations', JSON.stringify(sims));
        } else {
          throw new Error('Simulation failed');
        }
      }

      toast.success('Simulation generated! Loading timeline and visual twin...');
      navigate(`/farms/${farm.id}/simulations/${result.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to run simulation');
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading scenario builder..." fullPage />;
  if (error) return <ErrorDisplay message={error} onRetry={loadFarm} />;
  if (!farm) return <ErrorDisplay message="Farm not found" />;

  return (
    <div className="page-container pb-20 space-y-8">
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-farm-green-pale text-farm-green text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Unified AI Scenario Pipeline
          </div>
          <h1 className="page-title flex items-center gap-3">
            What-If Agricultural Simulation
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Configure climate and farm stress scenarios manually or in natural language for <b className="text-gray-800 dark:text-gray-200">{farm.name}</b>.
          </p>
        </div>

        {weather && (
          <div className="flex items-center gap-3 px-3.5 py-2 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-xs self-start sm:self-auto shadow-xs">
            <div className="text-2xl">{weather.weatherEmoji}</div>
            <div>
              <div className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <span>{weather.temperature}°C</span>
                <span className="text-gray-400">•</span>
                <span>{weather.weatherDescription}</span>
              </div>
              <div className="text-emerald-700 dark:text-emerald-400 text-[11px] font-medium">
                Live Farm Telemetry
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. RANDOM FOREST RISK ANALYSIS & SCENARIO SUGGESTION ENGINE */}
      <AIRiskSuggesterCard
        farm={farm}
        selectedZone={farm.zones[0]}
        onApplyQuickTest={handleApplyQuickTest}
      />

      {/* 3. UNIFIED SCENARIO CREATION METHOD TABS */}
      <div className="card p-0 overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-md">
        <div className="border-b border-gray-200 dark:border-gray-800 p-4 bg-stone-50/80 dark:bg-gray-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-farm-green" /> Select Scenario Creation Method
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Both methods compile into the same structured Scenario JSON contract.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-stone-200/70 dark:bg-gray-700/60 p-1 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setCreationMethod('manual')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                creationMethod === 'manual'
                  ? 'bg-white dark:bg-gray-900 text-farm-green shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              1. Manual Controls (New)
            </button>
            <button
              type="button"
              onClick={() => setCreationMethod('nlp')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                creationMethod === 'nlp'
                  ? 'bg-white dark:bg-gray-900 text-farm-green shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              2. Natural-Language Input (AI)
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* OPTION 1: MANUAL SIMULATION CONTROLS */}
        {/* ============================================================ */}
        {creationMethod === 'manual' && (
          <div className="p-6 space-y-6">
            <div className="bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 text-xs text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-farm-green flex-shrink-0" />
              <span>
                <b>Direct Manual Controls Active:</b> Adjust parameters below directly. The system automatically converts your sliders into structured JSON. No AI intent classification is needed.
              </span>
            </div>

            {/* Sliders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Rainfall Slider */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-stone-50/50 dark:bg-gray-800/50">
                <div className="flex justify-between items-center text-xs mb-2">
                  <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <CloudRain className="w-4 h-4 text-blue-500" />
                    Rainfall Modifier
                  </span>
                  <span className="font-extrabold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md">
                    {rainfallPctDelta > 0 ? `+${rainfallPctDelta}%` : `${rainfallPctDelta}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="5"
                  value={rainfallPctDelta}
                  onChange={(e) => setRainfallPctDelta(parseInt(e.target.value, 10))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>-100% (No Rain)</span>
                  <span>Baseline: 0%</span>
                  <span>+100% (Deluge)</span>
                </div>
                <div className="text-[11px] text-gray-500 mt-2">
                  Multiplier: <b>{structuredScenarioJson.changes.rainfall_multiplier}x</b> baseline precipitation
                </div>
              </div>

              {/* Temperature Slider */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-stone-50/50 dark:bg-gray-800/50">
                <div className="flex justify-between items-center text-xs mb-2">
                  <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <Thermometer className="w-4 h-4 text-orange-500" />
                    Temperature Delta
                  </span>
                  <span className="font-extrabold text-orange-600 bg-orange-50 dark:bg-orange-950 px-2 py-0.5 rounded-md">
                    {tempDelta > 0 ? `+${tempDelta}°C` : `${tempDelta}°C`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-6"
                  max="12"
                  step="0.5"
                  value={tempDelta}
                  onChange={(e) => setTempDelta(parseFloat(e.target.value))}
                  className="w-full accent-orange-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>-6°C (Cold snap)</span>
                  <span>0°C (Normal)</span>
                  <span>+12°C (Extreme)</span>
                </div>
                <div className="text-[11px] text-gray-500 mt-2">
                  Simulated Temp: <b>{Math.round((actualTemp + tempDelta) * 10) / 10}°C</b>
                </div>
              </div>

              {/* Irrigation Slider */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-stone-50/50 dark:bg-gray-800/50">
                <div className="flex justify-between items-center text-xs mb-2">
                  <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <Droplets className="w-4 h-4 text-emerald-500" />
                    Irrigation Modifier
                  </span>
                  <span className="font-extrabold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                    {irrigationFailure ? 'FAILED (0%)' : irrigationPctDelta > 0 ? `+${irrigationPctDelta}%` : `${irrigationPctDelta}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="5"
                  disabled={irrigationFailure}
                  value={irrigationPctDelta}
                  onChange={(e) => setIrrigationPctDelta(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 cursor-pointer disabled:opacity-40"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>-100% (Shutoff)</span>
                  <span>Baseline: 0%</span>
                  <span>+100% (Flood)</span>
                </div>
                <label className="flex items-center gap-2 mt-3 text-xs text-red-600 dark:text-red-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={irrigationFailure}
                    onChange={(e) => setIrrigationFailure(e.target.checked)}
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  <span>Simulate Complete Pump Breakdown (0%)</span>
                </label>
              </div>
            </div>

            {/* Duration and Scenario Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Scenario Label</label>
                <input
                  type="text"
                  className="input-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="label flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  Duration (Days)
                </label>
                <select
                  className="input-field"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                >
                  <option value={14}>14 Days (Two-Week Window)</option>
                  <option value={30}>30 Days (Monthly Outlook)</option>
                  <option value={45}>45 Days (Extended Trajectory)</option>
                  <option value={60}>60 Days (Full Crop Stage)</option>
                </select>
              </div>
            </div>

            {/* Target Fields */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="label mb-0">Target Fields</label>
                <button
                  type="button"
                  onClick={() => {
                    if (affectedZones.length === farm.zones.length) {
                      setAffectedZones([]);
                    } else {
                      setAffectedZones(farm.zones.map((z) => z.id));
                    }
                  }}
                  className="text-xs text-farm-green font-bold hover:underline"
                >
                  {affectedZones.length === farm.zones.length ? 'Deselect All' : 'Select All Fields'}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {farm.zones.map((zone) => {
                  const isChecked = affectedZones.includes(zone.id);
                  return (
                    <button
                      key={zone.id}
                      type="button"
                      onClick={() => toggleZone(zone.id)}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                        isChecked
                          ? 'border-farm-green bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-farm-green/30'
                          : 'border-gray-200 dark:border-gray-700 opacity-60'
                      }`}
                    >
                      <span className="text-xl">{CROP_EMOJIS[zone.crop] || '🌱'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs text-gray-900 dark:text-gray-100 truncate">
                          {zone.name}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate">
                          {zone.crop} • {zone.area} ac
                        </div>
                      </div>
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-farm-green flex-shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* OPTION 2: NATURAL-LANGUAGE SCENARIO UNDERSTANDING (NLP) */}
        {/* ============================================================ */}
        {creationMethod === 'nlp' && (
          <div className="p-6 space-y-6">
            <div className="bg-blue-50/60 dark:bg-blue-950/30 p-3.5 rounded-xl border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-300 flex items-center gap-2">
              <Brain className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>
                <b>AI NLP Pipeline:</b> Type your question in natural language. The system runs <b>TF-IDF feature extraction</b> and <b>Logistic Regression</b> to classify scenario intent, followed by deterministic parameter extraction.
              </span>
            </div>

            {/* Input Box */}
            <div>
              <label className="label">Describe Your Scenario in Natural Language</label>
              <div className="relative">
                <textarea
                  rows={3}
                  className="input-field text-sm font-medium"
                  placeholder="e.g., What if rainfall drops by 40% for the next 45 days in Zone A?"
                  value={nlQuery}
                  onChange={(e) => setNlQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Example Prompt Chips */}
            <div>
              <span className="text-xs font-semibold text-gray-500 block mb-2">Example Agricultural Inquiries:</span>
              <div className="flex flex-wrap gap-2">
                {[
                  'What if rainfall drops by 40% for the next 45 days in Zone A?',
                  'Simulate a +5°C heatwave for 21 days across all fields',
                  'What happens during an irrigation pump failure for 14 days?',
                  'What if we cut irrigation by 25% for 30 days in Field 1?',
                ].map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setNlQuery(prompt)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-farm-green text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 transition-colors"
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>
            </div>

            {/* NLP Pipeline Real-Time Inspection */}
            {nlpAnalysis && (
              <div className="p-4 rounded-xl bg-stone-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-farm-green" />
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                      Step 1: TF-IDF + Logistic Regression Intent
                    </span>
                  </div>
                  <span className="text-xs font-extrabold text-farm-green bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                    {nlpAnalysis.classification.intent} (Confidence: {Math.round(nlpAnalysis.classification.confidence * 100)}%)
                  </span>
                </div>

                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200 block mb-1.5">
                    Step 2: Deterministic Extracted Parameters
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <span className="text-gray-400 block text-[10px]">Duration</span>
                      <span className="font-bold text-gray-800 dark:text-gray-200">
                        {nlpAnalysis.extractedParams.durationDays} days
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <span className="text-gray-400 block text-[10px]">Rainfall Multiplier</span>
                      <span className="font-bold text-blue-600">
                        {nlpAnalysis.extractedParams.rainfallMultiplier ?? 'Unmodified (1.0x)'}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <span className="text-gray-400 block text-[10px]">Temperature Delta</span>
                      <span className="font-bold text-orange-600">
                        {nlpAnalysis.extractedParams.temperatureDelta !== undefined
                          ? `+${nlpAnalysis.extractedParams.temperatureDelta}°C`
                          : 'Unmodified (0°C)'}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <span className="text-gray-400 block text-[10px]">Target Field(s)</span>
                      <span className="font-bold text-gray-800 dark:text-gray-200 truncate block">
                        {nlpAnalysis.extractedParams.rawMatches.target || 'All Fields'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* 4. STRUCTURED SCENARIO JSON LIVE CONTRACT PREVIEW */}
        {/* ============================================================ */}
        <div className="p-5 border-t border-gray-200 dark:border-gray-800 bg-stone-900 text-stone-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Live Structured Scenario JSON (Person 2 Contract)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowJsonPreview(!showJsonPreview)}
              className="text-xs text-stone-400 hover:text-white"
            >
              {showJsonPreview ? 'Hide JSON' : 'View JSON'}
            </button>
          </div>

          {showJsonPreview && (
            <pre className="p-3.5 rounded-xl bg-black/60 border border-stone-800 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
              {JSON.stringify(structuredScenarioJson, null, 2)}
            </pre>
          )}
        </div>

        {/* 5. PRIMARY START SIMULATION BUTTON */}
        <div className="p-6 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="btn-primary w-full py-4 text-base font-bold shadow-xl hover:shadow-2xl flex items-center justify-center gap-3 transition-all cursor-pointer"
          >
            {running ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Running Simulation Timeline & Agricultural Risk Model...</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>START SIMULATION WITH STRUCTURED SCENARIO</span>
              </>
            )}
          </button>
          <p className="text-center text-xs text-gray-500 mt-2">
            Compiles into standardized Scenario JSON and executes Person 2's day-by-day simulation engine.
          </p>
        </div>
      </div>
    </div>
  );
}
