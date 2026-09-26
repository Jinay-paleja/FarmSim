import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  ShieldCheck,
  Droplets,
  Thermometer,
  Sparkles,
  ArrowRight,
  Loader2,
  RefreshCw,
  Bug,
  Leaf,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Farm, Zone, SuggestedQuickTest } from '../../types';
import { aiApi, BackendRiskAssessment, BackendScenarioSuggestion } from '../../services/api';

interface AIRiskSuggesterCardProps {
  farm: Farm;
  selectedZone?: Zone | null;
  onApplyQuickTest?: (test: SuggestedQuickTest) => void;
}

export default function AIRiskSuggesterCard({
  farm,
  selectedZone,
  onApplyQuickTest,
}: AIRiskSuggesterCardProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<BackendRiskAssessment | null>(null);
  const [suggestions, setSuggestions] = useState<BackendScenarioSuggestion[]>([]);

  // Fetch real AI risk assessment and scenario suggestions from backend
  const fetchRiskData = async () => {
    if (!farm || !farm.id) return;
    setLoading(true);
    setError(null);
    try {
      const [riskRes, suggRes] = await Promise.all([
        aiApi.analyzeRisk(farm.id),
        aiApi.suggestScenarios(farm.id),
      ]);
      setAssessment(riskRes);
      setSuggestions(suggRes.suggestions || []);
    } catch (err: any) {
      console.warn('Real AI risk API failed, attempting offline assessment:', err);
      setError('Risk analysis unavailable. Make sure your farm has at least one field configured.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskData();
  }, [farm.id]);

  // Find active zone or default to first zone
  const activeZoneId = selectedZone?.id || (farm.zones && farm.zones.length > 0 ? farm.zones[0].id : null);
  const activeZoneRisk = useMemo(() => {
    if (!assessment || !assessment.zone_risks) return null;
    return assessment.zone_risks.find((z) => z.zone_id === activeZoneId) || assessment.zone_risks[0] || null;
  }, [assessment, activeZoneId]);

  const targetZone = selectedZone || (farm.zones && farm.zones.length > 0 ? farm.zones[0] : null);

  const getRiskBadge = (level?: 'LOW' | 'MEDIUM' | 'HIGH') => {
    switch (level) {
      case 'HIGH':
        return {
          label: 'HIGH RISK',
          color: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-300 dark:border-red-800',
          dot: 'bg-red-500',
        };
      case 'MEDIUM':
        return {
          label: 'MODERATE',
          color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
          dot: 'bg-amber-500',
        };
      default:
        return {
          label: 'LOW / OPTIMAL',
          color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
          dot: 'bg-emerald-500',
        };
    }
  };

  const getFriendlyScenarioTitle = (scenarioType: string): string => {
    switch (scenarioType.toUpperCase()) {
      case 'RAIN_REDUCTION':
        return 'Less Rainfall Scenario';
      case 'HEATWAVE':
        return 'Heatwave Stress Scenario';
      case 'TEMPERATURE_INCREASE':
        return 'Higher Temperature Scenario';
      case 'IRRIGATION_FAILURE':
        return 'Irrigation Pump Stops';
      case 'DISEASE_OUTBREAK':
        return 'Crop Disease Spread';
      case 'PEST_OUTBREAK':
        return 'Pest Outbreak Test';
      case 'FERTILIZER_CHANGES':
      case 'NITROGEN_DEFICIENCY':
        return 'Fertilizer Deficit Scenario';
      default:
        return 'Weather Stress Test';
    }
  };

  const handleSimulateClick = (sug: BackendScenarioSuggestion) => {
    if (onApplyQuickTest) {
      onApplyQuickTest({
        id: sug.id,
        title: getFriendlyScenarioTitle(sug.scenario_type),
        description: sug.description,
        scenarioType: sug.scenario_type as any,
        durationDays: sug.duration || 30,
        triggerRisk: 'WATER_STRESS',
        changes: {
          rainfall_multiplier: sug.changes.rainfall_multiplier,
          temperature_delta: sug.changes.temperature_delta,
          irrigation_multiplier: sug.changes.irrigation_multiplier,
          irrigation_failure: Boolean(sug.changes.irrigation_failure),
        },
      });
    } else {
      navigate(
        `/farms/${farm.id}/scenarios/new?preset=${encodeURIComponent(sug.scenario_type)}&duration=${sug.duration || 30}`
      );
    }
  };

  if (loading) {
    return (
      <div className="card p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-md">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
          <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
            Checking your farm conditions with AI...
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Analyzing crop type, soil moisture, and meteorological stress factors.
          </p>
        </div>
      </div>
    );
  }

  if (error || !activeZoneRisk) {
    return (
      <div className="card p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-xs font-semibold">
              {error || 'Risk analysis currently not available. Please verify field zones are configured.'}
            </p>
          </div>
          <button
            type="button"
            onClick={fetchRiskData}
            className="text-xs px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1.5 font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const waterLevel = activeZoneRisk.water_stress?.level || 'LOW';
  const heatLevel = activeZoneRisk.heat_stress?.level || 'LOW';
  const diseaseLevel = activeZoneRisk.disease_risk?.level || 'LOW';
  const nutrientLevel = activeZoneRisk.nutrient_risk?.level || 'LOW';

  const waterBadge = getRiskBadge(waterLevel);
  const heatBadge = getRiskBadge(heatLevel);
  const diseaseBadge = getRiskBadge(diseaseLevel);
  const nutrientBadge = getRiskBadge(nutrientLevel);

  return (
    <div className="card p-0 overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-md">
      {/* 1. Header Banner */}
      <div className="p-4 bg-gradient-to-r from-emerald-950 via-stone-900 to-gray-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-farm-green/20 border border-farm-green/40 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-sm sm:text-base tracking-wide text-white">
                Farm Risk & Health Assessment
              </h2>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getRiskBadge(assessment?.overall_risk).color}`}>
                {assessment?.overall_risk || 'OPTIMAL'} RISK
              </span>
            </div>
            <p className="text-xs text-gray-300 mt-0.5">
              Evaluating: <b className="text-white">{targetZone?.name || activeZoneRisk.zone_name}</b> {targetZone ? `(${targetZone.crop} • ${targetZone.soilType})` : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchRiskData}
          className="text-xs text-gray-300 hover:text-white bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 flex items-center gap-1.5 self-start sm:self-auto transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Re-check Conditions
        </button>
      </div>

      {/* 2. Four Farmer-Friendly Risk Cards */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-stone-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
        {/* Water */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-gray-200">
                <Droplets className="w-4 h-4 text-blue-500" />
                <span>Water Condition</span>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${waterBadge.color}`}>
                {waterLevel}
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {waterLevel === 'HIGH'
                ? 'Soil moisture is very low. Crops may suffer moisture stress.'
                : waterLevel === 'MEDIUM'
                ? 'Moisture is adequate but declining. Keep an eye on watering.'
                : 'Soil moisture is healthy for this crop type.'}
            </p>
          </div>
        </div>

        {/* Heat */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-gray-200">
                <Thermometer className="w-4 h-4 text-amber-500" />
                <span>Temperature & Heat</span>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${heatBadge.color}`}>
                {heatLevel}
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {heatLevel === 'HIGH'
                ? 'High heat is stressing vegetative growth.'
                : heatLevel === 'MEDIUM'
                ? 'Warm conditions; monitor midday canopy transpiration.'
                : 'Temperatures are inside the crop comfort range.'}
            </p>
          </div>
        </div>

        {/* Disease */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-gray-200">
                <Bug className="w-4 h-4 text-rose-500" />
                <span>Disease & Pest Risk</span>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${diseaseBadge.color}`}>
                {diseaseLevel}
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {diseaseLevel === 'HIGH'
                ? 'Elevated humidity increases fungal or blight vulnerability.'
                : diseaseLevel === 'MEDIUM'
                ? 'Moderate disease conditions; ensure proper field drainage.'
                : 'No major disease or pest threats detected.'}
            </p>
          </div>
        </div>

        {/* Nutrients */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-gray-200">
                <Leaf className="w-4 h-4 text-emerald-600" />
                <span>Nutrients (NPK)</span>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${nutrientBadge.color}`}>
                {nutrientLevel}
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {nutrientLevel === 'HIGH'
                ? 'Nutrient deficit detected. Fertilizer application recommended.'
                : nutrientLevel === 'MEDIUM'
                ? 'Nutrient balance is moderate. Monitor nitrogen uptake.'
                : 'Soil nitrogen, phosphorus, and potassium are optimal.'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Recommended What-If Scenarios to Test */}
      {suggestions.length > 0 && (
        <div className="p-4 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Suggested What-If Tests for Your Farm
            </h3>
            <span className="text-[11px] text-gray-500">
              Based on your farm's current conditions
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suggestions.slice(0, 2).map((sug) => (
              <div
                key={sug.id}
                className="p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 flex flex-col justify-between gap-3 hover:border-emerald-400 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-300">
                      {getFriendlyScenarioTitle(sug.scenario_type)}
                    </h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold">
                      {sug.duration || 30} days
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    {sug.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleSimulateClick(sug)}
                  className="btn-primary py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 self-start shadow-xs"
                >
                  <span>Test This Scenario</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
