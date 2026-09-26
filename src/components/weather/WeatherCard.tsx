import React, { useState } from 'react';
import {
  Cloud, Sun, CloudRain, Droplets, Wind, Gauge,
  RefreshCw, AlertTriangle, ChevronDown, ChevronUp,
  Sparkles, CheckCircle2, ShieldAlert, ArrowDown,
  Clock, Calendar, Compass, Info
} from 'lucide-react';
import type { WeatherData, WeatherAgronomicImpact } from '../../services/weather';

interface WeatherCardProps {
  weather: WeatherData | null;
  loading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdatedLabel: string;
  agronomicImpact?: WeatherAgronomicImpact | null;
  onRefresh: () => void;
  onApplyWeatherToZones?: (weather: WeatherData) => void;
  compact?: boolean;
}

export default function WeatherCard({
  weather,
  loading,
  isRefreshing,
  error,
  lastUpdatedLabel,
  agronomicImpact,
  onRefresh,
  onApplyWeatherToZones,
  compact = false,
}: WeatherCardProps) {
  const [showForecast, setShowForecast] = useState(!compact);
  const [forecastTab, setForecastTab] = useState<'hourly' | 'daily' | 'agronomic'>('hourly');

  if (loading && !weather) {
    return (
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-gray-200 flex items-center justify-center min-h-[160px]">
        <div className="flex flex-col items-center gap-2 text-xs text-gray-500">
          <RefreshCw className="w-5 h-5 text-farm-green animate-spin" />
          <span>Fetching live farm meteorology...</span>
        </div>
      </div>
    );
  }

  if (error && !weather) {
    return (
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-red-200 text-xs">
        <div className="flex items-center gap-2 text-red-600 font-bold mb-1">
          <AlertTriangle className="w-4 h-4" />
          Live weather temporarily unavailable
        </div>
        <p className="text-gray-500 mb-2">Could not reach the meteorological provider.</p>
        <button
          onClick={onRefresh}
          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (!weather) return null;

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200/90 overflow-hidden text-gray-800 transition-all">
      {/* Top Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-stone-50 via-sky-50/40 to-emerald-50/40 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                weather.isFallback ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                weather.isFallback ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
          </span>
          <span className="text-xs font-extrabold uppercase tracking-wider text-gray-800">
            Live Farm Weather
          </span>

          {weather.isFallback && (
            <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full border border-amber-200">
              Offline Cache
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 font-medium">
            {lastUpdatedLabel}
          </span>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh live weather"
            className="p-1 text-gray-400 hover:text-farm-green hover:bg-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-farm-green' : ''}`} />
          </button>
        </div>
      </div>

      {/* Current Conditions Main Section */}
      <div className="p-4 space-y-3.5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-gray-900 tracking-tight">
                {Math.round(weather.temperature)}°C
              </span>
              <span className="text-xs font-semibold text-gray-500">
                Feels like {Math.round(weather.apparentTemperature)}°C
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-sm font-bold text-gray-700">
              <span className="text-xl">{weather.weatherEmoji}</span>
              <span>{weather.weatherDescription}</span>
            </div>
          </div>

          {/* Quick sync button if callback provided */}
          {onApplyWeatherToZones && (
            <button
              onClick={() => onApplyWeatherToZones(weather)}
              className="text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5 transition-colors shadow-sm"
              title="Apply current temperature, humidity & rainfall to farm plots"
            >
              <Sparkles className="w-3.5 h-3.5 text-farm-green" />
              Sync to Fields
            </button>
          )}
        </div>

        {/* Essential Variables Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
          {/* Humidity */}
          <div className="p-2 rounded-xl bg-stone-50 border border-gray-100 flex flex-col items-center text-center">
            <Droplets className="w-3.5 h-3.5 text-blue-500 mb-1" />
            <span className="text-[10px] text-gray-400">Humidity</span>
            <span className="font-bold text-gray-800">{Math.round(weather.humidity)}%</span>
          </div>

          {/* Wind */}
          <div className="p-2 rounded-xl bg-stone-50 border border-gray-100 flex flex-col items-center text-center">
            <Wind className="w-3.5 h-3.5 text-sky-500 mb-1" />
            <span className="text-[10px] text-gray-400">Wind</span>
            <span className="font-bold text-gray-800">{Math.round(weather.windSpeed)} km/h</span>
          </div>

          {/* Rain / Precip */}
          <div className="p-2 rounded-xl bg-stone-50 border border-gray-100 flex flex-col items-center text-center">
            <CloudRain className="w-3.5 h-3.5 text-indigo-500 mb-1" />
            <span className="text-[10px] text-gray-400">Rain</span>
            <span className="font-bold text-gray-800">{weather.rain.toFixed(1)} mm</span>
          </div>

          {/* Precipitation Prob */}
          <div className="p-2 rounded-xl bg-stone-50 border border-gray-100 flex flex-col items-center text-center">
            <Cloud className="w-3.5 h-3.5 text-cyan-600 mb-1" />
            <span className="text-[10px] text-gray-400">Precip Prob</span>
            <span className="font-bold text-gray-800">{weather.hourly[0]?.precipitationProbability ?? 0}%</span>
          </div>

          {/* Cloud Cover */}
          <div className="p-2 rounded-xl bg-stone-50 border border-gray-100 flex flex-col items-center text-center">
            <Sun className="w-3.5 h-3.5 text-amber-500 mb-1" />
            <span className="text-[10px] text-gray-400">Cloud Cover</span>
            <span className="font-bold text-gray-800">{Math.round(weather.cloudCover)}%</span>
          </div>

          {/* Pressure */}
          <div className="p-2 rounded-xl bg-stone-50 border border-gray-100 flex flex-col items-center text-center">
            <Gauge className="w-3.5 h-3.5 text-purple-500 mb-1" />
            <span className="text-[10px] text-gray-400">Pressure</span>
            <span className="font-bold text-gray-800">{Math.round(weather.pressure)} hPa</span>
          </div>
        </div>

        {/* Active Agronomic Weather Alert Banner (if any) */}
        {agronomicImpact && agronomicImpact.alerts.length > 0 && (
          <div className="space-y-1.5">
            {agronomicImpact.alerts.slice(0, 2).map((alert, aIdx) => (
              <div
                key={aIdx}
                className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                  alert.severity === 'high'
                    ? 'bg-red-50 text-red-900 border-red-200'
                    : 'bg-amber-50 text-amber-900 border-amber-200'
                }`}
              >
                <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  alert.severity === 'high' ? 'text-red-600' : 'text-amber-600'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold">{alert.title}</div>
                  <p className="text-[11px] leading-tight opacity-90 mt-0.5">{alert.description}</p>
                  <p className="text-[11px] font-semibold mt-1">
                    💡 <i>Action:</i> {alert.recommendation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expandable Forecast Accordion Toggle */}
      <div className="border-t border-gray-100 px-4 py-2 bg-stone-50/50 flex items-center justify-between">
        <button
          onClick={() => setShowForecast(!showForecast)}
          className="text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1.5 transition-colors"
        >
          <span>{showForecast ? 'Hide Forecast & Agronomic Impact' : 'Show 48h Forecast & Agronomic Impact'}</span>
          {showForecast ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showForecast && (
          <div className="flex items-center gap-1 text-[11px] bg-white p-0.5 rounded-lg border border-gray-200">
            <button
              onClick={() => setForecastTab('hourly')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                forecastTab === 'hourly' ? 'bg-farm-green text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Hourly (48h)
            </button>
            <button
              onClick={() => setForecastTab('daily')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                forecastTab === 'daily' ? 'bg-farm-green text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              7-Day
            </button>
            <button
              onClick={() => setForecastTab('agronomic')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                forecastTab === 'agronomic' ? 'bg-farm-green text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Farm Impact
            </button>
          </div>
        )}
      </div>

      {/* Forecast Details Drawer */}
      {showForecast && (
        <div className="p-3 border-t border-gray-100 bg-white">
          {/* TAB 1: HOURLY FORECAST (Next 48 Hours) */}
          {forecastTab === 'hourly' && (
            <div className="overflow-x-auto pb-1 no-scrollbar">
              <div className="flex gap-2 min-w-max">
                {weather.hourly.slice(0, 24).map((pt, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col items-center justify-between p-2 rounded-xl bg-stone-50 border border-gray-100 text-center w-[68px] hover:border-blue-200 transition-colors"
                  >
                    <span className="text-[11px] font-semibold text-gray-500">{pt.hourLabel}</span>
                    <span className="text-base my-1">{pt.weatherEmoji}</span>
                    <span className="text-xs font-bold text-gray-800">{Math.round(pt.temperature)}°</span>
                    <div className="flex items-center gap-0.5 text-[10px] text-blue-600 font-medium mt-1">
                      <Droplets className="w-2.5 h-2.5" />
                      <span>{pt.precipitationProbability}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: 7-DAY OUTLOOK */}
          {forecastTab === 'daily' && (
            <div className="space-y-1.5 text-xs">
              {weather.daily.map((d, dIdx) => (
                <div
                  key={dIdx}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-stone-50 border border-transparent hover:border-gray-100 transition-all"
                >
                  <div className="w-20 font-bold text-gray-700">{d.dayLabel}</div>
                  <div className="flex items-center gap-1.5 w-36">
                    <span className="text-base">{d.weatherEmoji}</span>
                    <span className="text-gray-600 truncate">{d.weatherDescription}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{d.tempMax}°</span>
                    <span className="text-gray-400 font-medium">/ {d.tempMin}°</span>
                  </div>
                  <div className="text-blue-600 font-medium w-16 text-right">
                    {d.precipitationSum > 0 ? `${d.precipitationSum} mm` : '0 mm'}
                  </div>
                  {d.et0 && (
                    <div className="text-[11px] text-emerald-700 font-medium hidden sm:block">
                      ET₀ {d.et0} mm
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: AGRONOMIC RECOMMENDATIONS */}
          {forecastTab === 'agronomic' && (
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Meteorological Agronomic Synthesis
                </div>
                <ul className="list-disc list-inside space-y-1 text-emerald-800 text-[11px]">
                  {agronomicImpact?.recommendations.map((rec, rIdx) => (
                    <li key={rIdx}>{rec}</li>
                  ))}
                </ul>
              </div>

              {/* Stress indicators summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                <div className={`p-2 rounded-lg border text-center ${agronomicImpact?.heatStress ? 'bg-orange-50 text-orange-900 border-orange-200 font-semibold' : 'bg-stone-50 text-gray-500 border-gray-100'}`}>
                  Heat Stress: {agronomicImpact?.heatStress ? 'Elevated' : 'Normal'}
                </div>
                <div className={`p-2 rounded-lg border text-center ${agronomicImpact?.droughtStress ? 'bg-amber-50 text-amber-900 border-amber-200 font-semibold' : 'bg-stone-50 text-gray-500 border-gray-100'}`}>
                  Drought Risk: {agronomicImpact?.droughtStress ? 'Elevated' : 'Normal'}
                </div>
                <div className={`p-2 rounded-lg border text-center ${agronomicImpact?.floodRisk ? 'bg-blue-50 text-blue-900 border-blue-200 font-semibold' : 'bg-stone-50 text-gray-500 border-gray-100'}`}>
                  Waterlogging: {agronomicImpact?.floodRisk ? 'Risk' : 'Safe'}
                </div>
                <div className={`p-2 rounded-lg border text-center ${agronomicImpact?.diseaseElevated ? 'bg-purple-50 text-purple-900 border-purple-200 font-semibold' : 'bg-stone-50 text-gray-500 border-gray-100'}`}>
                  Fungal Pressure: {agronomicImpact?.diseaseElevated ? 'Elevated' : 'Low'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
