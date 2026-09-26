import React, { useState } from 'react';
import {
  X, Trash2, Crosshair, Droplets, Thermometer, CloudRain,
  Sprout, Heart, Bug, FlaskConical, Wheat, Info, AlertTriangle,
  Layers, CheckCircle2, ShieldAlert, Ruler
} from 'lucide-react';
import type { ZoneInput, CropType, SoilType, GrowthStage, IrrigationMethod } from '../../types';
import {
  CROP_OPTIONS, SOIL_OPTIONS, GROWTH_STAGES, IRRIGATION_METHODS,
  CROP_EMOJIS, CROP_COLORS, SOIL_COLORS
} from '../../types';
import { calculatePolygonArea, calculatePerimeter, getFieldStressState } from '../../services/mapGeometry';

interface FieldDetailsPanelProps {
  zone: ZoneInput;
  zoneIndex: number;
  totalFarmArea: number;
  onUpdate: (index: number, key: keyof ZoneInput, value: any) => void;
  onDelete: (index: number) => void;
  onClose: () => void;
  onCenterField: () => void;
  onOpenDimensionEditor?: () => void;
}

export default function FieldDetailsPanel({
  zone,
  zoneIndex,
  totalFarmArea,
  onUpdate,
  onDelete,
  onClose,
  onCenterField,
  onOpenDimensionEditor,
}: FieldDetailsPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'crop' | 'soil' | 'microclimate' | 'fertilizer' | 'health'>('overview');

  // Compute live geometric measurements if boundary coordinates are present
  const areaMeas = zone.boundary && zone.boundary.length >= 3
    ? calculatePolygonArea(zone.boundary)
    : { acres: zone.area, hectares: Math.round((zone.area / 2.47105) * 100) / 100, squareMeters: Math.round(zone.area * 4046.86) };

  const perimeterMeas = zone.boundary && zone.boundary.length >= 2
    ? calculatePerimeter(zone.boundary)
    : { meters: 0, kilometers: 0, feet: 0 };

  const stressState = getFieldStressState(zone);

  // Risk badges
  const getRiskLabel = (val: number) => {
    if (val < 25) return { label: 'Low', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    if (val < 55) return { label: 'Medium', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { label: 'High', color: 'text-red-700 bg-red-50 border-red-200' };
  };

  const diseaseRiskVal = zone.diseaseRisk ?? 15;
  const pestRiskVal = zone.pestRisk ?? 15;
  const diseaseBadge = getRiskLabel(diseaseRiskVal);
  const pestBadge = getRiskLabel(pestRiskVal);

  const getStressBadge = (stress: string) => {
    switch (stress) {
      case 'healthy':
        return { label: 'Healthy', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'moderate_stress':
        return { label: 'Moderate Stress', color: 'bg-lime-100 text-lime-800 border-lime-300' };
      case 'high_stress':
        return { label: 'High Stress', color: 'bg-orange-100 text-orange-800 border-orange-300' };
      case 'severe_stress':
        return { label: 'Severe Stress', color: 'bg-red-100 text-red-800 border-red-300' };
      case 'flooded':
        return { label: 'Flooded', color: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'drought':
        return { label: 'Drought Stress', color: 'bg-amber-100 text-amber-900 border-amber-300' };
      case 'heat_stress':
        return { label: 'Heat Stress', color: 'bg-rose-100 text-rose-800 border-rose-300' };
      case 'disease':
        return { label: 'Disease Outbreak', color: 'bg-purple-100 text-purple-800 border-purple-300' };
      default:
        return { label: 'Normal', color: 'bg-gray-100 text-gray-800 border-gray-300' };
    }
  };

  const stressBadge = getStressBadge(stressState);

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Top Header */}
      <div className="p-4 border-b border-gray-100 bg-stone-50/70">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-2xl flex-shrink-0">{CROP_EMOJIS[zone.crop] || '🌱'}</span>
            <input
              type="text"
              value={zone.name}
              onChange={(e) => onUpdate(zoneIndex, 'name', e.target.value)}
              className="font-bold text-gray-900 text-base bg-transparent border-b border-transparent hover:border-gray-300 focus:border-farm-green focus:outline-none px-1 py-0.5 rounded transition-all truncate"
              placeholder="Field Name"
            />
          </div>
          <div className="flex items-center gap-1">
            {onOpenDimensionEditor && (
              <button
                type="button"
                onClick={onOpenDimensionEditor}
                title="Edit size in acres/ha, width/height dimensions & move plot"
                className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
              >
                <Ruler className="w-4 h-4 text-emerald-600" />
              </button>
            )}
            <button
              onClick={onCenterField}
              title="Focus map on this field"
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Crosshair className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(zoneIndex)}
              title="Delete field"
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              title="Close panel"
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Badges row */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-gray-700 bg-white px-2.5 py-1 rounded-md border border-gray-200 shadow-sm">
            {areaMeas.acres} acres ({areaMeas.hectares} ha)
          </span>
          <span className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold ${stressBadge.color}`}>
            {stressBadge.label}
          </span>
          <span className="text-gray-500">
            ID: <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">{zone.id || `zone_${zoneIndex + 1}`}</code>
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50/50 px-2 overflow-x-auto no-scrollbar text-xs font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-2 px-3 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'overview' ? 'border-farm-green text-farm-green font-bold bg-white' : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('crop')}
          className={`py-2 px-3 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'crop' ? 'border-farm-green text-farm-green font-bold bg-white' : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Crop & Soil
        </button>
        <button
          onClick={() => setActiveTab('microclimate')}
          className={`py-2 px-3 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'microclimate' ? 'border-farm-green text-farm-green font-bold bg-white' : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Weather & Water
        </button>
        <button
          onClick={() => setActiveTab('fertilizer')}
          className={`py-2 px-3 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'fertilizer' ? 'border-farm-green text-farm-green font-bold bg-white' : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Fertilizer (NPK)
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={`py-2 px-3 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'health' ? 'border-farm-green text-farm-green font-bold bg-white' : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Health & Risks
        </button>
      </div>

      {/* Scrollable Tab Content */}
      <div className="p-4 overflow-y-auto flex-1 space-y-4 text-sm">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Area & Geometry summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-stone-50 border border-gray-200">
                <p className="text-xs text-gray-500 font-medium">Calculated Area</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{areaMeas.acres} <span className="text-xs font-normal text-gray-500">ac</span></p>
                <p className="text-[11px] text-gray-400">{areaMeas.hectares} ha • {areaMeas.squareMeters.toLocaleString()} m²</p>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 border border-gray-200">
                <p className="text-xs text-gray-500 font-medium">Field Perimeter</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{perimeterMeas.meters.toLocaleString()} <span className="text-xs font-normal text-gray-500">m</span></p>
                <p className="text-[11px] text-gray-400">{perimeterMeas.kilometers} km ({perimeterMeas.feet.toLocaleString()} ft)</p>
              </div>
            </div>

            {/* Farm share */}
            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs">
              <div className="flex justify-between items-center mb-1">
                <span className="text-emerald-800 font-medium">Farm Acreage Share</span>
                <span className="font-bold text-emerald-900">{totalFarmArea > 0 ? ((areaMeas.acres / totalFarmArea) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="h-2 bg-emerald-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all"
                  style={{ width: `${Math.min(100, totalFarmArea > 0 ? (areaMeas.acres / totalFarmArea) * 100 : 0)}%` }}
                />
              </div>
            </div>

            {/* Quick status recap */}
            <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 bg-white">
              <div className="p-2.5 flex items-center justify-between text-xs">
                <span className="text-gray-500 flex items-center gap-1.5"><Sprout className="w-3.5 h-3.5 text-farm-green" /> Crop</span>
                <span className="font-semibold text-gray-800">{CROP_EMOJIS[zone.crop]} {zone.crop} ({zone.growthStage})</span>
              </div>
              <div className="p-2.5 flex items-center justify-between text-xs">
                <span className="text-gray-500 flex items-center gap-1.5"><Wheat className="w-3.5 h-3.5 text-amber-600" /> Soil</span>
                <span className="font-semibold text-gray-800">{zone.soilType}</span>
              </div>
              <div className="p-2.5 flex items-center justify-between text-xs">
                <span className="text-gray-500 flex items-center gap-1.5"><Droplets className="w-3.5 h-3.5 text-blue-500" /> Moisture</span>
                <span className="font-semibold text-blue-700">{Math.round(zone.soilMoisture)}%</span>
              </div>
              <div className="p-2.5 flex items-center justify-between text-xs">
                <span className="text-gray-500 flex items-center gap-1.5"><Thermometer className="w-3.5 h-3.5 text-orange-500" /> Temperature</span>
                <span className="font-semibold text-orange-700">{zone.temperature.toFixed(1)}°C</span>
              </div>
              <div className="p-2.5 flex items-center justify-between text-xs">
                <span className="text-gray-500 flex items-center gap-1.5"><Heart className="w-3.5 h-3.5 text-emerald-500" /> Crop Health</span>
                <span className="font-semibold text-emerald-700">{Math.round(zone.healthScore ?? 75)}%</span>
              </div>
              <div className="p-2.5 flex items-center justify-between text-xs">
                <span className="text-gray-500 flex items-center gap-1.5"><Bug className="w-3.5 h-3.5 text-red-500" /> Disease Risk</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${diseaseBadge.color}`}>{diseaseBadge.label} ({Math.round(diseaseRiskVal)}%)</span>
              </div>
              <div className="p-2.5 flex items-center justify-between text-xs">
                <span className="text-gray-500 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Pest Risk</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${pestBadge.color}`}>{pestBadge.label} ({Math.round(pestRiskVal)}%)</span>
              </div>
            </div>

            {/* Polygon points info */}
            {zone.boundary && zone.boundary.length > 0 && (
              <div className="text-xs text-gray-500 flex items-center gap-1.5 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                <Layers className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>Geographical Polygon with {zone.boundary.length} coordinate vertices saved.</span>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CROP & SOIL */}
        {activeTab === 'crop' && (
          <div className="space-y-4">
            <div>
              <label className="label">Assigned Crop</label>
              <select
                className="select-field"
                value={zone.crop}
                onChange={(e) => onUpdate(zoneIndex, 'crop', e.target.value as CropType)}
              >
                {CROP_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {CROP_EMOJIS[c]} {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Growth Stage</label>
              <select
                className="select-field"
                value={zone.growthStage}
                onChange={(e) => onUpdate(zoneIndex, 'growthStage', e.target.value as GrowthStage)}
              >
                {GROWTH_STAGES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Soil Type</label>
              <select
                className="select-field"
                value={zone.soilType}
                onChange={(e) => onUpdate(zoneIndex, 'soilType', e.target.value as SoilType)}
              >
                {SOIL_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="label mb-0">Soil Moisture (%)</label>
                <span className="font-bold text-blue-600 text-xs">{Math.round(zone.soilMoisture)}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="95"
                value={zone.soilMoisture}
                onChange={(e) => onUpdate(zoneIndex, 'soilMoisture', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>Drought (&lt;25%)</span>
                <span>Optimal (45-75%)</span>
                <span>Waterlogged (&gt;85%)</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MICROCLIMATE & IRRIGATION */}
        {activeTab === 'microclimate' && (
          <div className="space-y-4">
            <div>
              <label className="label">Irrigation System</label>
              <select
                className="select-field"
                value={zone.irrigationMethod}
                onChange={(e) => onUpdate(zoneIndex, 'irrigationMethod', e.target.value as IrrigationMethod)}
              >
                {IRRIGATION_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="label mb-0">Temperature (°C)</label>
                <span className="font-bold text-orange-600 text-xs">{zone.temperature.toFixed(1)}°C</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="0.5"
                value={zone.temperature}
                onChange={(e) => onUpdate(zoneIndex, 'temperature', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="label mb-0">Relative Humidity (%)</label>
                <span className="font-bold text-sky-600 text-xs">{Math.round(zone.humidity)}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={zone.humidity}
                onChange={(e) => onUpdate(zoneIndex, 'humidity', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="label mb-0">Seasonal Rainfall (mm)</label>
                <span className="font-bold text-indigo-600 text-xs">{Math.round(zone.rainfall)} mm</span>
              </div>
              <input
                type="range"
                min="0"
                max="500"
                step="5"
                value={zone.rainfall}
                onChange={(e) => onUpdate(zoneIndex, 'rainfall', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>
        )}

        {/* TAB 4: FERTILIZER (NPK) */}
        {activeTab === 'fertilizer' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Configure soil nutrient availability for this plot. Values directly feed into crop growth and yield projections.
            </p>

            {/* Nitrogen */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="label mb-0 text-blue-700">Nitrogen (N)</label>
                <span className="font-bold text-blue-700 text-xs">{Math.round(zone.nitrogen)} kg/ha</span>
              </div>
              <input
                type="range"
                min="0"
                max="120"
                value={zone.nitrogen}
                onChange={(e) => onUpdate(zoneIndex, 'nitrogen', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Phosphorus */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="label mb-0 text-amber-700">Phosphorus (P)</label>
                <span className="font-bold text-amber-700 text-xs">{Math.round(zone.phosphorus)} kg/ha</span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                value={zone.phosphorus}
                onChange={(e) => onUpdate(zoneIndex, 'phosphorus', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
              />
            </div>

            {/* Potassium */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="label mb-0 text-purple-700">Potassium (K)</label>
                <span className="font-bold text-purple-700 text-xs">{Math.round(zone.potassium)} kg/ha</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={zone.potassium}
                onChange={(e) => onUpdate(zoneIndex, 'potassium', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>

            <div className="p-3 bg-stone-50 rounded-xl border border-gray-200 text-xs text-gray-600 space-y-1">
              <span className="font-semibold text-gray-800">NPK Balance Ratio:</span>
              <p>N: {Math.round(zone.nitrogen)} | P: {Math.round(zone.phosphorus)} | K: {Math.round(zone.potassium)}</p>
            </div>
          </div>
        )}

        {/* TAB 5: HEALTH & RISKS */}
        {activeTab === 'health' && (
          <div className="space-y-4">
            {/* Crop Health */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="label mb-0">Crop Health Index (%)</label>
                <span className="font-bold text-emerald-600 text-xs">{Math.round(zone.healthScore ?? 75)}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={zone.healthScore ?? 75}
                onChange={(e) => onUpdate(zoneIndex, 'healthScore', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
            </div>

            {/* Disease Risk */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="label mb-0 flex items-center gap-1.5">
                  <Bug className="w-3.5 h-3.5 text-red-500" />
                  Disease Risk (%)
                </label>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${diseaseBadge.color}`}>
                  {diseaseBadge.label} ({Math.round(diseaseRiskVal)}%)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={diseaseRiskVal}
                onChange={(e) => onUpdate(zoneIndex, 'diseaseRisk', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-600"
              />
            </div>

            {/* Pest Risk */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="label mb-0 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                  Pest Risk (%)
                </label>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${pestBadge.color}`}>
                  {pestBadge.label} ({Math.round(pestRiskVal)}%)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={pestRiskVal}
                onChange={(e) => onUpdate(zoneIndex, 'pestRisk', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
              />
            </div>

            {/* Dynamic Stress Explanation */}
            <div className={`p-3 rounded-xl border text-xs ${stressBadge.color}`}>
              <div className="font-semibold flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-4 h-4" />
                Dynamic Stress Status: {stressBadge.label}
              </div>
              <p className="text-[11px] leading-relaxed">
                {stressState === 'healthy' && 'Environmental variables are within ideal agronomic ranges for this crop.'}
                {stressState === 'drought' && 'Low soil moisture (<28%) is imposing drought stress. Irrigation recommended.'}
                {stressState === 'flooded' && 'Excessive moisture (>88%) detected. Drainage or irrigation suspension advised.'}
                {stressState === 'heat_stress' && 'Ambient temperature exceeds 37°C. Heat mitigation advised.'}
                {stressState === 'disease' && 'Favorable microclimatic wetness and heat have elevated pathogen risk.'}
                {stressState === 'moderate_stress' && 'Sub-optimal nutrient or moisture parameters causing mild vigor reduction.'}
                {stressState === 'high_stress' || stressState === 'severe_stress' && 'Multiple stress factors detected. Urgent field intervention needed.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="p-3 border-t border-gray-100 bg-stone-50 flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Auto-saved to memory
        </span>
        <button
          onClick={onClose}
          className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
