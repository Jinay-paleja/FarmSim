import React, { useMemo } from 'react';
import {
  Brain, AlertTriangle, ShieldCheck, Droplets, Thermometer,
  CloudRain, Bug, Sparkles, ArrowRight, Play, CheckCircle2,
  Gauge, HelpCircle, Layers, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Farm, Zone, SuggestedQuickTest } from '../../types';
import { analyzeFarmRiskRF, generateScenarioSuggestions } from '../../services/aiRiskModel';

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

  // Evaluate representative zone or active zone with Random Forest ML
  const targetZone = selectedZone || (farm.zones && farm.zones.length > 0 ? farm.zones[0] : null);

  const rfAssessment = useMemo(() => {
    if (!targetZone) return null;
    return analyzeFarmRiskRF(targetZone);
  }, [targetZone]);

  const quickTests = useMemo(() => {
    if (!rfAssessment || !targetZone) return [];
    return generateScenarioSuggestions(rfAssessment, targetZone.name);
  }, [rfAssessment, targetZone]);

  if (!targetZone || !rfAssessment) return null;

  const getRiskBadge = (level: 'LOW' | 'MEDIUM' | 'HIGH') => {
    switch (level) {
      case 'HIGH':
        return {
          label: 'HIGH RISK',
          color: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800',
          dot: 'bg-red-500',
        };
      case 'MEDIUM':
        return {
          label: 'MODERATE',
          color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
          dot: 'bg-amber-500',
        };
      default:
        return {
          label: 'OPTIMAL / LOW',
          color: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
          dot: 'bg-emerald-500',
        };
    }
  };

  const handleQuickTestClick = (test: SuggestedQuickTest) => {
    if (onApplyQuickTest) {
      onApplyQuickTest(test);
    } else {
      // Navigate to scenario builder with query params
      navigate(`/farms/${farm.id}/scenarios/new?preset=${test.scenarioType}&duration=${test.durationDays}`);
    }
  };

  return (
    <div className="card p-0 overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-md">
      {/* 1. Header */}
      <div className="p-4 bg-gradient-to-r from-stone-900 via-gray-900 to-emerald-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-farm-green/20 border border-farm-green/40 flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-farm-green-light" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-sm sm:text-base tracking-wide">
                Random Forest Farm Risk Analysis
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ML Inference
              </span>
            </div>
            <p className="text-xs text-gray-300 mt-0.5">
              Evaluating: <b className="text-white">{targetZone.name}</b> ({targetZone.crop} • {targetZone.soilType} • {targetZone.growthStage})
            </p>
          </div>
        </div>

        <div className="text-xs text-gray-300 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 flex items-center gap-2 self-start sm:self-auto">
          <span>Overall Stress Index:</span>
          <span className={`font-black text-sm ${rfAssessment.overallScore > 60 ? 'text-red-400' : rfAssessment.overallScore > 35 ? 'text-amber-300' : 'text-emerald-300'}`}>
            {rfAssessment.overallScore}/100
          </span>
        </div>
      </div>

      {/* 2. Four Random Forest Risk Predictions */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-800">
        <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5" /> Random Forest 4-Risk Model Predictions
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Water Stress */}
          <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/80">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-gray-200">
                <Droplets className="w-4 h-4 text-blue-500" />
                <span>WATER STRESS</span>
              </div>
              {(() => {
                const b = getRiskBadge(rfAssessment.waterStress.level);
                return (
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${b.color}`}>
                    {b.label}
                  </span>
                );
              })()}
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>Confidence:</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {Math.round((rfAssessment.waterStress.probability.high || rfAssessment.waterStress.probability.medium || rfAssessment.waterStress.probability.low) * 100)}%
                </span>
              </div>
              <div className="text-[11px] text-gray-600 dark:text-gray-400 line-clamp-2 pt-1 border-t border-gray-200 dark:border-gray-700">
                {rfAssessment.waterStress.contributingFactors[0]?.description}
              </div>
            </div>
          </div>

          {/* Heat Stress */}
          <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/80">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-gray-200">
                <Thermometer className="w-4 h-4 text-orange-500" />
                <span>HEAT STRESS</span>
              </div>
              {(() => {
                const b = getRiskBadge(rfAssessment.heatStress.level);
                return (
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${b.color}`}>
                    {b.label}
                  </span>
                );
              })()}
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>Confidence:</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {Math.round((rfAssessment.heatStress.probability.high || rfAssessment.heatStress.probability.medium || rfAssessment.heatStress.probability.low) * 100)}%
                </span>
              </div>
              <div className="text-[11px] text-gray-600 dark:text-gray-400 line-clamp-2 pt-1 border-t border-gray-200 dark:border-gray-700">
                {rfAssessment.heatStress.contributingFactors[0]?.description}
              </div>
            </div>
          </div>

          {/* Disease Risk */}
          <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/80">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-gray-200">
                <Bug className="w-4 h-4 text-red-500" />
                <span>DISEASE RISK</span>
              </div>
              {(() => {
                const b = getRiskBadge(rfAssessment.diseaseRisk.level);
                return (
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${b.color}`}>
                    {b.label}
                  </span>
                );
              })()}
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>Confidence:</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {Math.round((rfAssessment.diseaseRisk.probability.high || rfAssessment.diseaseRisk.probability.medium || rfAssessment.diseaseRisk.probability.low) * 100)}%
                </span>
              </div>
              <div className="text-[11px] text-gray-600 dark:text-gray-400 line-clamp-2 pt-1 border-t border-gray-200 dark:border-gray-700">
                {rfAssessment.diseaseRisk.contributingFactors[0]?.description}
              </div>
            </div>
          </div>

          {/* Nutrient Risk */}
          <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/80">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-gray-200">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span>NUTRIENT RISK</span>
              </div>
              {(() => {
                const b = getRiskBadge(rfAssessment.nutrientRisk.level);
                return (
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${b.color}`}>
                    {b.label}
                  </span>
                );
              })()}
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>Confidence:</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {Math.round((rfAssessment.nutrientRisk.probability.high || rfAssessment.nutrientRisk.probability.medium || rfAssessment.nutrientRisk.probability.low) * 100)}%
                </span>
              </div>
              <div className="text-[11px] text-gray-600 dark:text-gray-400 line-clamp-2 pt-1 border-t border-gray-200 dark:border-gray-700">
                {rfAssessment.nutrientRisk.contributingFactors[0]?.description}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Scenario Suggestion Engine (Rule-based Quick Tests) */}
      <div className="p-5 bg-gradient-to-b from-white to-stone-50/50 dark:from-gray-900 dark:to-gray-900/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-farm-green" /> AI Scenario Suggestion Engine (Rule-Based)
            </h3>
            <p className="text-xs text-gray-500">
              Generated from current Random Forest risk assessment. Click any test to load its what-if simulation:
            </p>
          </div>
          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full self-start sm:self-auto border border-emerald-200 dark:border-emerald-800">
            {quickTests.length} Quick Tests Ready
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickTests.map((test) => (
            <div
              key={test.id}
              onClick={() => handleQuickTestClick(test)}
              className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-farm-green bg-white dark:bg-gray-800 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-bold text-xs text-gray-900 dark:text-gray-100 group-hover:text-farm-green transition-colors">
                    {test.title}
                  </span>
                  <span className="text-[10px] font-bold text-gray-400 bg-stone-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-md flex-shrink-0">
                    {test.durationDays}d
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
                  {test.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700/60 text-[11px]">
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1 group-hover:underline">
                  <Play className="w-3 h-3 fill-current" /> Apply Quick Test
                </span>
                <span className="text-[10px] text-gray-400">
                  Trigger: {test.triggerRisk.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
