import React, { useState } from 'react';
import {
  Brain, AlertTriangle, ShieldCheck, Droplets, Thermometer,
  CloudRain, Sprout, ArrowRight, CheckCircle2, HelpCircle,
  Clock, Sparkles, ChevronDown, ChevronUp, Layers, Compass,
  TrendingDown, Check, Info
} from 'lucide-react';
import type { FarmIntelligenceReport, FieldRiskAssessment } from '../../services/farmIntelligence';
import { CROP_EMOJIS } from '../../types';

interface FarmIntelligencePanelProps {
  intelligence: FarmIntelligenceReport;
  onSelectField?: (fieldName: string) => void;
  compact?: boolean;
}

export default function FarmIntelligencePanel({
  intelligence,
  onSelectField,
  compact = false,
}: FarmIntelligencePanelProps) {
  const [activeTab, setActiveTab] = useState<'alerts' | 'irrigation' | 'risks' | 'actions'>('alerts');
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);

  const threatPill = {
    low: { label: 'Optimal Conditions', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    moderate: { label: 'Moderate Watch', color: 'bg-amber-100 text-amber-800 border-amber-300' },
    elevated: { label: 'Elevated Risk', color: 'bg-orange-100 text-orange-800 border-orange-300' },
    critical: { label: 'Critical Agricultural Risk', color: 'bg-red-100 text-red-800 border-red-300 animate-pulse' },
  }[intelligence.overallThreatLevel];

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden text-gray-800 transition-all">
      {/* Top Banner Header */}
      <div className="p-4 bg-gradient-to-r from-stone-900 via-gray-900 to-emerald-950 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-farm-green/20 border border-farm-green/40 flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-farm-green-light" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-base sm:text-lg tracking-wide">
                Farm Intelligence Decision Engine
              </h2>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-sm ${threatPill.color}`}>
                {threatPill.label}
              </span>
            </div>
            <p className="text-xs text-gray-300 flex items-center gap-2 mt-0.5">
              <span>Weather-Driven Physiological Crop & Soil Modeling</span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">{intelligence.fieldAssessments.length} Fields Evaluated</span>
            </p>
          </div>
        </div>

        {/* Current Weather Snapshot Chips */}
        <div className="flex items-center gap-2 text-xs bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15">
          <span className="text-base">{intelligence.weatherSummary.conditionEmoji}</span>
          <span className="font-bold">{Math.round(intelligence.weatherSummary.temperature)}°C</span>
          <span className="text-gray-300">|</span>
          <span className="text-sky-300 font-medium">💧 {Math.round(intelligence.weatherSummary.humidity)}%</span>
          <span className="text-gray-300">|</span>
          <span className="text-blue-300 font-medium">🌧️ {intelligence.weatherSummary.rainForecastNext48hMm} mm (48h)</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-stone-50 px-4 gap-1 text-xs font-semibold overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('alerts')}
          className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-all ${
            activeTab === 'alerts'
              ? 'border-farm-green text-farm-green font-bold bg-white'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span>Active Alerts</span>
          <span className="ml-1 bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded-full">
            {intelligence.headlineAlerts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('irrigation')}
          className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-all ${
            activeTab === 'irrigation'
              ? 'border-farm-green text-farm-green font-bold bg-white'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Droplets className="w-3.5 h-3.5 text-blue-500" />
          <span>Irrigation Support</span>
        </button>

        <button
          onClick={() => setActiveTab('risks')}
          className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-all ${
            activeTab === 'risks'
              ? 'border-farm-green text-farm-green font-bold bg-white'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Thermometer className="w-3.5 h-3.5 text-orange-500" />
          <span>Field Risk Matrix</span>
        </button>

        <button
          onClick={() => setActiveTab('actions')}
          className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-all ${
            activeTab === 'actions'
              ? 'border-farm-green text-farm-green font-bold bg-white'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>Recommended Actions</span>
          <span className="ml-1 bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded-full">
            {intelligence.prioritizedActions.length}
          </span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-4 sm:p-5">
        {/* TAB 1: ACTIVE ALERTS */}
        {activeTab === 'alerts' && (
          <div className="space-y-3">
            {intelligence.headlineAlerts.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-emerald-50/60 border border-emerald-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <h3 className="font-bold text-emerald-900 text-sm">All Fields Operating Safely</h3>
                <p className="text-xs text-emerald-700 mt-1 max-w-md mx-auto">
                  Live atmospheric temperatures, forecast rainfall, and plot moisture levels are harmonized within crop tolerance bands.
                </p>
              </div>
            ) : (
              intelligence.headlineAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    alert.severity === 'critical'
                      ? 'bg-red-50/80 border-red-300 text-red-950 shadow-sm'
                      : 'bg-amber-50/80 border-amber-300 text-amber-950 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm sm:text-base">{alert.title}</span>
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                            alert.severity === 'critical' ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'
                          }`}
                        >
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-800 leading-relaxed font-medium">
                        {alert.message}
                      </p>

                      {/* Explainability WHY Box */}
                      <div className="mt-2.5 p-2.5 bg-white/90 rounded-xl border border-amber-200/80 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-gray-800 text-[11px] mb-1">
                          <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                          <span>WHY THIS ALERT WAS TRIGGERED:</span>
                        </div>
                        <p className="text-gray-700 font-mono text-[11px] leading-relaxed">
                          {alert.why}
                        </p>
                      </div>
                    </div>

                    {alert.targetFields.length > 0 && onSelectField && (
                      <button
                        onClick={() => onSelectField(alert.targetFields[0])}
                        className="btn-secondary py-1.5 px-3 text-xs whitespace-nowrap flex items-center gap-1 bg-white hover:bg-stone-50"
                      >
                        Inspect Field <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: IRRIGATION DECISION SUPPORT */}
        {activeTab === 'irrigation' && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
              <Droplets className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-bold">Weather-Aware Irrigation Scheduling</span>
                <p className="text-[11px] text-blue-800 mt-0.5">
                  The decision engine factors in upcoming precipitation within 48 hours to avoid redundant pumping, save groundwater, and prevent nutrient leaching.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {intelligence.fieldAssessments.map((fa) => {
                const adv = fa.irrigationAdvice;
                const badgeColor = {
                  delay_rain_expected: 'bg-purple-100 text-purple-900 border-purple-300',
                  irrigate_now: 'bg-blue-100 text-blue-900 border-blue-300 font-bold',
                  irrigate_soon: 'bg-amber-100 text-amber-900 border-amber-300',
                  adequate_moisture: 'bg-emerald-100 text-emerald-900 border-emerald-300',
                  suspend_waterlogged: 'bg-red-100 text-red-900 border-red-300',
                }[adv.action];

                return (
                  <div
                    key={fa.fieldId}
                    className="p-4 rounded-2xl border border-gray-200 bg-white hover:border-blue-300 shadow-sm transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{CROP_EMOJIS[fa.crop] || '🌱'}</span>
                        <div>
                          <h3 className="font-bold text-gray-900 text-sm">{fa.fieldName}</h3>
                          <p className="text-xs text-gray-500">{fa.crop} • {fa.soilType} Soil • {fa.areaAcres} ac</p>
                        </div>
                      </div>
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full border ${badgeColor}`}>
                        {adv.headline.split('—')[0]}
                      </span>
                    </div>

                    <p className="text-xs text-gray-700 leading-relaxed font-medium">
                      {adv.detail}
                    </p>

                    {/* Scientific Factors WHY Box */}
                    <div className="p-3 bg-stone-50 rounded-xl border border-gray-200 text-xs space-y-1.5">
                      <div className="font-bold text-gray-800 text-[11px] flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-blue-600" />
                        <span>WHY? (DECISION INPUTS):</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-gray-600 font-mono">
                        <div>Soil Moisture: <b className="text-gray-900">{adv.whyFactors.soilMoisture}%</b></div>
                        <div>Ambient Temp: <b className="text-gray-900">{adv.whyFactors.ambientTemp}°C</b></div>
                        <div>Rain Next 48h: <b className="text-blue-700">{adv.whyFactors.rainForecastNext48hMm} mm</b></div>
                        <div>Rain Probability: <b className="text-blue-700">{adv.whyFactors.precipitationProbability}%</b></div>
                        <div>Crop Need: <b className="text-gray-900">{adv.whyFactors.cropNeedMmDay} mm/day</b></div>
                        <div>Soil Capacity: <b className="text-gray-900">{adv.whyFactors.soilRetention}</b></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: FIELD RISK MATRIX */}
        {activeTab === 'risks' && (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 bg-stone-50">
                    <th className="py-2.5 px-3 font-semibold">Field / Crop</th>
                    <th className="py-2.5 px-3 font-semibold">Water Stress</th>
                    <th className="py-2.5 px-3 font-semibold">Heat Stress</th>
                    <th className="py-2.5 px-3 font-semibold">Disease Risk</th>
                    <th className="py-2.5 px-3 font-semibold">Waterlogging</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {intelligence.fieldAssessments.map((fa) => {
                    const wsColor = {
                      low: 'text-emerald-700 bg-emerald-50',
                      moderate: 'text-amber-700 bg-amber-50',
                      high: 'text-orange-700 bg-orange-50 font-bold',
                      critical: 'text-red-700 bg-red-100 font-bold',
                    }[fa.waterStress.level];

                    const hsColor = {
                      none: 'text-emerald-700 bg-emerald-50',
                      moderate: 'text-amber-700 bg-amber-50',
                      high: 'text-orange-700 bg-orange-50 font-bold',
                      extreme: 'text-red-700 bg-red-100 font-bold',
                    }[fa.heatStress.level];

                    const drColor = {
                      low: 'text-emerald-700 bg-emerald-50',
                      moderate: 'text-amber-700 bg-amber-50',
                      high: 'text-purple-700 bg-purple-50 font-bold',
                    }[fa.diseaseRisk.level];

                    return (
                      <tr key={fa.fieldId} className="hover:bg-stone-50/70 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-gray-900 flex items-center gap-1.5">
                            <span>{CROP_EMOJIS[fa.crop]}</span>
                            <span>{fa.fieldName}</span>
                          </div>
                          <span className="text-[10px] text-gray-500">{fa.crop} • {fa.soilType}</span>
                        </td>

                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] ${wsColor}`}>
                            {fa.waterStress.level.toUpperCase()} ({Math.round(fa.waterStress.currentMoisture)}%)
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] ${hsColor}`}>
                            {fa.heatStress.level.toUpperCase()} ({fa.heatStress.currentTemp}°C / Thr: {fa.heatStress.cropThreshold}°C)
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] ${drColor}`}>
                            {fa.diseaseRisk.level.toUpperCase()}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] ${fa.floodWaterlogRisk.level === 'high_risk' ? 'text-red-700 bg-red-100 font-bold' : 'text-gray-600 bg-gray-100'}`}>
                            {fa.floodWaterlogRisk.level.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setExpandedFieldId(expandedFieldId === fa.fieldId ? null : fa.fieldId)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {expandedFieldId === fa.fieldId ? 'Hide' : 'Explain'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Expanded Field Diagnostic */}
            {expandedFieldId && (
              (() => {
                const target = intelligence.fieldAssessments.find((f) => f.fieldId === expandedFieldId);
                if (!target) return null;
                return (
                  <div className="p-4 rounded-2xl bg-stone-50 border border-gray-200 text-xs space-y-2 animate-fadeIn">
                    <div className="font-bold text-gray-900 text-sm flex items-center justify-between">
                      <span>Detailed Agronomic Breakdown: {target.fieldName} ({target.crop})</span>
                      <button onClick={() => setExpandedFieldId(null)} className="text-gray-400 hover:text-gray-600">Close</button>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3 pt-1">
                      <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                        <span className="font-bold text-gray-800">Water Balance:</span>
                        <p className="text-gray-600 mt-0.5">{target.waterStress.explanation}</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                        <span className="font-bold text-gray-800">Thermal Comfort:</span>
                        <p className="text-gray-600 mt-0.5">{target.heatStress.explanation}</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                        <span className="font-bold text-gray-800">Pathogen Exposure:</span>
                        <p className="text-gray-600 mt-0.5">{target.diseaseRisk.explanation}</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                        <span className="font-bold text-gray-800">Drainage & Aeration:</span>
                        <p className="text-gray-600 mt-0.5">{target.floodWaterlogRisk.explanation}</p>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* TAB 4: RECOMMENDED ACTIONS (WITH EXPLAINABILITY) */}
        {activeTab === 'actions' && (
          <div className="space-y-3">
            {intelligence.prioritizedActions.map((action, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl border border-gray-200 bg-white hover:border-farm-green shadow-sm transition-all space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          action.priority === 'urgent'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {action.priority} Action
                      </span>
                      <h3 className="font-bold text-gray-900 text-sm sm:text-base">{action.title}</h3>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-700 mt-1 font-medium leading-relaxed">
                      {action.description}
                    </p>
                  </div>
                </div>

                {/* Explicit Explainability "WHY?" Block */}
                <div className="p-3 bg-stone-50 rounded-xl border border-gray-200 text-xs">
                  <div className="font-bold text-gray-800 text-[11px] flex items-center gap-1.5 mb-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-farm-green" />
                    <span>WHY? (UNDERLYING FACTORS & RULES):</span>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-2 text-[11px] text-gray-600 font-mono">
                    <div className="bg-white p-2 rounded-lg border border-gray-100">
                      <span className="text-gray-400 block text-[10px]">Temperature:</span>
                      <b className="text-gray-900">{action.why.temperature}</b>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-gray-100">
                      <span className="text-gray-400 block text-[10px]">Soil Moisture:</span>
                      <b className="text-gray-900">{action.why.soilMoisture}</b>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-gray-100">
                      <span className="text-gray-400 block text-[10px]">Rain Forecast:</span>
                      <b className="text-gray-900">{action.why.rainForecast}</b>
                    </div>
                  </div>
                  {action.why.cropRule && (
                    <p className="text-[11px] text-emerald-800 mt-2 font-medium">
                      💡 <i>Agronomic Rationale:</i> {action.why.cropRule}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
