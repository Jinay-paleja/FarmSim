import React from 'react';
import {
  Brain, ShieldAlert, AlertTriangle, CheckCircle2, TrendingDown,
  TrendingUp, Sparkles, Scale, Lightbulb, Droplets, Zap, Heart,
  ArrowRight, ShieldCheck, ChevronRight
} from 'lucide-react';
import type { FarmerExplanation, MetricDelta, TradeOffItem } from '../../types';

interface FarmerExplanationCardProps {
  explanation: FarmerExplanation;
  scenarioName: string;
}

export default function FarmerExplanationCard({
  explanation,
  scenarioName,
}: FarmerExplanationCardProps) {
  const getSeverityBadge = (sev: 'LOW' | 'MODERATE' | 'SEVERE') => {
    switch (sev) {
      case 'SEVERE':
        return {
          label: 'SEVERE IMPACT',
          color: 'bg-red-100 text-red-900 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
        };
      case 'MODERATE':
        return {
          label: 'MODERATE IMPACT',
          color: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
        };
      default:
        return {
          label: 'MILD / STEADY IMPACT',
          color: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
        };
    }
  };

  const badge = getSeverityBadge(explanation.impactSeverity);

  return (
    <div className="card p-0 overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl space-y-0">
      {/* 1. Header Banner */}
      <div className="p-5 bg-gradient-to-r from-emerald-950 via-stone-900 to-gray-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-farm-green/20 border border-farm-green/40 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-wide text-white">
                Farmer Explanation & Impact Analysis
              </h2>
              <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border shadow-xs ${badge.color}`}>
                {badge.label}
              </span>
            </div>
            <p className="text-xs text-gray-300 mt-0.5">
              Deterministic Agronomic Synthesis for: <b className="text-white">{scenarioName}</b>
            </p>
          </div>
        </div>

        <div className="text-xs bg-white/10 px-3.5 py-2 rounded-xl border border-white/15 self-start sm:self-auto text-gray-200">
          Status: <b className="text-emerald-300">Analysis Complete</b>
        </div>
      </div>

      {/* 2. Executive Summary */}
      <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-emerald-50/20 dark:bg-emerald-950/10">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300 mb-2 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-emerald-600" />
          Executive Summary for the Farmer
        </h3>
        <p className="text-sm sm:text-base text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
          {explanation.summary}
        </p>
      </div>

      {/* 3. Detected Trade-Offs (Key requirement from Person 3 spec) */}
      {explanation.tradeOffs.length > 0 && (
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-amber-50/40 via-white to-blue-50/40 dark:from-amber-950/20 dark:via-gray-900 dark:to-blue-950/20">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 mb-3 flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber-600" />
            Detected Agricultural Trade-offs
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {explanation.tradeOffs.map((trade, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs"
              >
                <div className="flex items-center justify-between text-xs font-bold mb-2">
                  <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    ✓ {trade.positiveAspect}
                  </span>
                  <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                    ✕ {trade.negativeAspect}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {trade.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Metric-by-Metric Variance & Deltas */}
      <div className="p-6 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">
          Metric-by-Metric Impact Classification
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {explanation.metricDeltas.map((item) => {
            const isPos = item.absoluteChange > 0;
            const sign = isPos ? '+' : '';
            return (
              <div
                key={item.metric}
                className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-stone-50/60 dark:bg-gray-800/40 flex flex-col justify-between"
              >
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block font-semibold truncate">
                    {item.label}
                  </span>
                  <div className="text-lg font-black text-gray-900 dark:text-gray-100 mt-1">
                    {item.scenarioValue} {item.unit}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    Baseline: {item.baselineValue} {item.unit}
                  </div>
                </div>

                <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs">
                  <span
                    className={`font-black flex items-center gap-0.5 ${
                      item.isFavorable ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {isPos ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {sign}{item.percentageChange}%
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                      item.impactSeverity === 'SEVERE'
                        ? 'bg-red-100 text-red-800'
                        : item.impactSeverity === 'MODERATE'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {item.impactSeverity}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Actionable Agronomic Recommendations */}
      <div className="p-6 bg-stone-50/50 dark:bg-gray-800/20">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-farm-green" />
          Recommended Agronomic Interventions
        </h3>
        <div className="space-y-2.5">
          {explanation.recommendations.map((rec, i) => (
            <div
              key={i}
              className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-start gap-3 shadow-xs"
            >
              <div className="w-6 h-6 rounded-lg bg-farm-green/10 text-farm-green flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                {i + 1}
              </div>
              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                {rec}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
