import React, { useState } from 'react';
import {
  Layers, Plus, Trash2, Edit3, Check, X, Sprout, AlertCircle,
  Maximize2, Grid, Droplets, ArrowRight, ShieldCheck, Sparkles
} from 'lucide-react';
import type { ZoneInput, CropType, SoilType, GrowthStage, IrrigationMethod } from '../../types';
import {
  CROP_OPTIONS,
  SOIL_OPTIONS,
  GROWTH_STAGES,
  IRRIGATION_METHODS,
  CROP_EMOJIS,
  CROP_COLORS,
} from '../../types';

export interface VirtualFarmWorkspaceProps {
  farmName: string;
  totalArea: number; // in acres
  zones: ZoneInput[];
  onZonesChange: (zones: ZoneInput[]) => void;
  selectedZoneIndex: number | null;
  onSelectZone: (index: number | null) => void;
  readOnly?: boolean;
}

export default function VirtualFarmWorkspace({
  farmName,
  totalArea,
  zones,
  onZonesChange,
  selectedZoneIndex,
  onSelectZone,
  readOnly = false,
}: VirtualFarmWorkspaceProps) {
  // Modal / Form state for adding/editing a zone
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Zone form fields
  const [zoneForm, setZoneForm] = useState<{
    name: string;
    area: number;
    crop: CropType;
    soilType: SoilType;
    growthStage: GrowthStage;
    irrigationMethod: IrrigationMethod;
    soilMoisture: number;
  }>({
    name: '',
    area: 5,
    crop: 'Wheat',
    soilType: 'Loamy',
    growthStage: 'Vegetative',
    irrigationMethod: 'Drip',
    soilMoisture: 45,
  });

  const [formError, setFormError] = useState<string | null>(null);

  // Calculations
  const allocatedArea = zones.reduce((sum, z) => sum + (Number(z.area) || 0), 0);
  const remainingArea = Math.max(0, Math.round((totalArea - allocatedArea) * 100) / 100);
  const isOverAllocated = allocatedArea > totalArea + 0.001;

  // Open modal for adding a new zone
  const handleOpenAdd = () => {
    const nextNum = zones.length + 1;
    const defaultZoneArea = remainingArea > 0 ? remainingArea : Math.max(1, Math.round((totalArea / Math.max(1, zones.length + 1)) * 10) / 10);
    setZoneForm({
      name: `Zone ${nextNum}`,
      area: defaultZoneArea,
      crop: 'Wheat',
      soilType: 'Loamy',
      growthStage: 'Vegetative',
      irrigationMethod: 'Drip',
      soilMoisture: 45,
    });
    setEditingIndex(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open modal for editing an existing zone
  const handleOpenEdit = (index: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const target = zones[index];
    if (!target) return;
    setZoneForm({
      name: target.name,
      area: target.area,
      crop: target.crop,
      soilType: target.soilType,
      growthStage: target.growthStage,
      irrigationMethod: target.irrigationMethod,
      soilMoisture: target.soilMoisture ?? 45,
    });
    setEditingIndex(index);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Save zone (create or edit)
  const handleSaveZone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneForm.name.trim()) {
      setFormError('Please enter a zone name');
      return;
    }
    const zoneArea = Number(zoneForm.area);
    if (isNaN(zoneArea) || zoneArea <= 0) {
      setFormError('Zone area must be greater than 0 acres');
      return;
    }

    // Check if new area would exceed total
    const currentZoneArea = editingIndex !== null ? (Number(zones[editingIndex]?.area) || 0) : 0;
    const projectedAllocated = allocatedArea - currentZoneArea + zoneArea;
    if (projectedAllocated > totalArea + 0.001) {
      setFormError(
        `Total zone area (${projectedAllocated.toFixed(1)} acres) exceeds total farm area (${totalArea} acres) by ${(projectedAllocated - totalArea).toFixed(1)} acres.`
      );
      return;
    }

    const updatedZone: ZoneInput = {
      name: zoneForm.name.trim(),
      area: zoneArea,
      crop: zoneForm.crop,
      soilType: zoneForm.soilType,
      growthStage: zoneForm.growthStage,
      irrigationMethod: zoneForm.irrigationMethod,
      soilMoisture: zoneForm.soilMoisture,
      temperature: 24,
      humidity: 60,
      rainfall: 15,
      nitrogen: 60,
      phosphorus: 40,
      potassium: 40,
      healthScore: 85,
      diseaseRisk: 15,
    };

    if (editingIndex !== null) {
      const copy = [...zones];
      copy[editingIndex] = { ...copy[editingIndex], ...updatedZone };
      onZonesChange(copy);
    } else {
      onZonesChange([...zones, updatedZone]);
      onSelectZone(zones.length);
    }

    setIsModalOpen(false);
  };

  // Delete zone
  const handleDeleteZone = (index: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const copy = zones.filter((_, i) => i !== index);
    onZonesChange(copy);
    if (selectedZoneIndex === index) {
      onSelectZone(null);
    } else if (selectedZoneIndex !== null && selectedZoneIndex > index) {
      onSelectZone(selectedZoneIndex - 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Farm Area Allocation Bar */}
      <div className="bg-stone-50 border border-gray-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Virtual Farm Area Budget</span>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span>{farmName || 'Digital Farm'}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                {totalArea} Total Acres
              </span>
            </h3>
          </div>

          <div className="flex items-center gap-4 text-sm font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-gray-600">Assigned:</span>
              <span className="text-gray-900 font-bold">{allocatedArea.toFixed(1)} ac</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isOverAllocated ? 'bg-red-500' : 'bg-gray-300'}`}></span>
              <span className="text-gray-600">Remaining:</span>
              <span className={`font-bold ${isOverAllocated ? 'text-red-600' : 'text-gray-800'}`}>
                {remainingArea.toFixed(1)} ac
              </span>
            </div>
          </div>
        </div>

        {/* Progress / Capacity Bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden flex">
          {zones.map((zone, idx) => {
            const zArea = Number(zone.area ?? (zone as any).area_acres ?? 0);
            const widthPct = totalArea > 0 ? Math.min(100, (zArea / totalArea) * 100) : 0;
            const color = (zone.crop && CROP_COLORS[zone.crop]) || '#16a34a';
            return (
              <div
                key={idx}
                style={{ width: `${widthPct}%`, backgroundColor: color }}
                title={`${zone.name || `Zone ${idx + 1}`} (${zone.crop || 'Crop'}): ${zArea} acres`}
                className="h-full transition-all duration-300 relative group cursor-pointer"
                onClick={() => onSelectZone(idx)}
              />
            );
          })}
        </div>

        {isOverAllocated && (
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Assigned zone areas exceed total farm capacity by {(allocatedArea - totalArea).toFixed(1)} acres. Please adjust zone sizes.</span>
          </div>
        )}
      </div>

      {/* Main Interactive Virtual Farm Canvas */}
      <div className="border border-gray-200 rounded-2xl bg-gradient-to-b from-stone-50/50 to-emerald-50/30 p-6 shadow-xs relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-farm-green-pale flex items-center justify-center text-farm-green">
              <Grid className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900">Virtual Farm Layout</h4>
              <p className="text-xs text-gray-500">Visual digital representation of your farm zones and crops</p>
            </div>
          </div>

          {!readOnly && (
            <button
              type="button"
              onClick={handleOpenAdd}
              disabled={isOverAllocated && remainingArea <= 0}
              className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Zone Area
            </button>
          )}
        </div>

        {/* Visual Zone Blocks Representation */}
        {zones.length === 0 ? (
          <div className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center bg-white/60">
            <Sprout className="w-12 h-12 text-farm-green/60 mx-auto mb-3" />
            <h5 className="font-bold text-gray-800 text-sm">No zones created yet</h5>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
              Divide your {totalArea} acre farm into zones for planting crops, configuring soil, and scheduling irrigation.
            </p>
            {!readOnly && (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="btn-secondary text-xs inline-flex items-center gap-1.5 py-2 px-4 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Click to Create Zone 1
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {zones.map((zone, idx) => {
              const isSelected = selectedZoneIndex === idx;
              const cropColor = (zone.crop && CROP_COLORS[zone.crop]) || '#16a34a';
              const emoji = (zone.crop && CROP_EMOJIS[zone.crop]) || '🌱';
              const zArea = Number(zone.area ?? (zone as any).area_acres ?? 0);
              const pctOfFarm = totalArea > 0 ? ((zArea / totalArea) * 100).toFixed(0) : '0';

              return (
                <div
                  key={idx}
                  onClick={() => onSelectZone(isSelected ? null : idx)}
                  className={`relative rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer bg-white shadow-xs ${
                    isSelected
                      ? 'border-farm-green ring-2 ring-farm-green/20 shadow-md scale-[1.01]'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-xs'
                  }`}
                >
                  {/* Top Bar inside Card */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl" role="img" aria-label={zone.crop || 'Crop'}>{emoji}</span>
                      <div>
                        <h5 className="font-bold text-sm text-gray-900 leading-tight">{zone.name || `Zone ${idx + 1}`}</h5>
                        <span className="text-[11px] font-semibold text-gray-500">{zone.crop || 'Unspecified'}</span>
                      </div>
                    </div>

                    <span
                      style={{ backgroundColor: `${cropColor}20`, color: cropColor }}
                      className="text-[11px] font-extrabold px-2 py-0.5 rounded-full border"
                    >
                      {zArea} acres ({pctOfFarm}%)
                    </span>
                  </div>

                  {/* Zone Attributes */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100 text-xs">
                    <div className="bg-stone-50 p-2 rounded-lg">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Soil</span>
                      <span className="font-semibold text-gray-800">{zone.soilType || (zone as any).soil || 'Loam'}</span>
                    </div>
                    <div className="bg-stone-50 p-2 rounded-lg">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Stage</span>
                      <span className="font-semibold text-gray-800">{zone.growthStage || (zone as any).growth_stage || 'Vegetative'}</span>
                    </div>
                    <div className="bg-stone-50 p-2 rounded-lg">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Irrigation</span>
                      <span className="font-semibold text-gray-800">{zone.irrigationMethod || (zone as any).irrigation || 'Drip'}</span>
                    </div>
                    <div className="bg-stone-50 p-2 rounded-lg">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Moisture</span>
                      <span className="font-semibold text-emerald-700">{zone.soilMoisture ?? 45}%</span>
                    </div>
                  </div>

                  {/* Actions for editing and deleting */}
                  {!readOnly && (
                    <div className="mt-3 pt-2 flex items-center justify-end gap-2 border-t border-gray-50">
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(idx, e)}
                        className="text-xs font-semibold text-gray-500 hover:text-farm-green p-1 rounded-md hover:bg-gray-100 flex items-center gap-1 cursor-pointer"
                        title="Edit Zone Details"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteZone(idx, e)}
                        className="text-xs font-semibold text-gray-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 flex items-center gap-1 cursor-pointer"
                        title="Delete Zone"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Zone Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-100 p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                <Sprout className="w-4 h-4 text-farm-green" />
                {editingIndex !== null ? 'Edit Zone' : 'Create New Zone'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveZone} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="label text-xs">Zone Name *</label>
                <input
                  type="text"
                  required
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Zone 1 - North Plot"
                  className="input-field text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Area (Acres) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max={totalArea}
                    required
                    value={zoneForm.area}
                    onChange={(e) => setZoneForm((prev) => ({ ...prev, area: parseFloat(e.target.value) || 0 }))}
                    className="input-field text-sm"
                  />
                  <span className="text-[10px] text-gray-400 mt-1 block">Max: {totalArea} acres</span>
                </div>

                <div>
                  <label className="label text-xs">Crop *</label>
                  <select
                    value={zoneForm.crop}
                    onChange={(e) => setZoneForm((prev) => ({ ...prev, crop: e.target.value as CropType }))}
                    className="input-field text-sm"
                  >
                    {CROP_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {CROP_EMOJIS[c] || '🌱'} {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Soil Type *</label>
                  <select
                    value={zoneForm.soilType}
                    onChange={(e) => setZoneForm((prev) => ({ ...prev, soilType: e.target.value as SoilType }))}
                    className="input-field text-sm"
                  >
                    {SOIL_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label text-xs">Growth Stage *</label>
                  <select
                    value={zoneForm.growthStage}
                    onChange={(e) => setZoneForm((prev) => ({ ...prev, growthStage: e.target.value as GrowthStage }))}
                    className="input-field text-sm"
                  >
                    {GROWTH_STAGES.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Irrigation Method *</label>
                  <select
                    value={zoneForm.irrigationMethod}
                    onChange={(e) => setZoneForm((prev) => ({ ...prev, irrigationMethod: e.target.value as IrrigationMethod }))}
                    className="input-field text-sm"
                  >
                    {IRRIGATION_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label text-xs">Soil Moisture (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={zoneForm.soilMoisture}
                    onChange={(e) => setZoneForm((prev) => ({ ...prev, soilMoisture: parseInt(e.target.value) || 0 }))}
                    className="input-field text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary text-xs py-2 px-3 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  {editingIndex !== null ? 'Update Zone' : 'Add Zone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
