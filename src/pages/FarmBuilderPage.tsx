import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus, Trash2, Save, ArrowRight, ChevronDown, ChevronUp,
  Droplets, Thermometer, CloudRain, Leaf, FlaskConical,
  Sprout, Settings2, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { farmApi, zoneApi } from '../services/api';
import { isMockEnabled, createMockFarm } from '../services/mockData';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ErrorDisplay from '../components/shared/ErrorDisplay';
import type {
  Farm, Zone, ZoneInput, CropType, SoilType, GrowthStage, IrrigationMethod,
} from '../types';
import {
  CROP_OPTIONS as cropOptions,
  SOIL_OPTIONS as soilOptions,
  GROWTH_STAGES as growthStages,
  IRRIGATION_METHODS as irrigationMethods,
  CROP_EMOJIS as cropEmojis,
  CROP_COLORS as cropColors,
  SOIL_COLORS as soilColors,
} from '../types';

const defaultZoneInput = (farmArea: number, zoneCount: number, index: number): ZoneInput => ({
  name: `Zone ${index + 1}`,
  area: Math.round((farmArea / Math.max(zoneCount, 1)) * 10) / 10,
  crop: cropOptions[index % cropOptions.length],
  soilType: soilOptions[index % soilOptions.length],
  growthStage: 'Vegetative',
  irrigationMethod: 'Drip',
  soilMoisture: 60,
  temperature: 28,
  humidity: 65,
  rainfall: 80,
  nitrogen: 40,
  phosphorus: 20,
  potassium: 25,
});

export default function FarmBuilderPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [zones, setZones] = useState<ZoneInput[]>([]);
  const [expandedZone, setExpandedZone] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      if (farmData.zones && farmData.zones.length > 0) {
        setZones(farmData.zones.map((z) => ({
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
        })));
      } else {
        const zoneCount = 3;
        setZones(
          Array.from({ length: zoneCount }, (_, i) =>
            defaultZoneInput(farmData.area, zoneCount, i)
          )
        );
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load farm');
    } finally {
      setLoading(false);
    }
  };

  const updateZone = (index: number, key: keyof ZoneInput, value: any) => {
    setZones((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [key]: value };
      return updated;
    });
  };

  const addZone = () => {
    if (zones.length >= 20) {
      toast.error('Maximum 20 zones allowed');
      return;
    }
    const newZone = defaultZoneInput(farm?.area || 10, zones.length + 1, zones.length);
    setZones((prev) => [...prev, newZone]);
    setExpandedZone(zones.length);
  };

  const removeZone = (index: number) => {
    if (zones.length <= 1) {
      toast.error('At least 1 zone is required');
      return;
    }
    setZones((prev) => prev.filter((_, i) => i !== index));
    if (expandedZone >= zones.length - 1) {
      setExpandedZone(Math.max(0, zones.length - 2));
    }
  };

  const handleSave = async () => {
    if (!farm) return;
    setSaving(true);
    try {
      // Try API first
      try {
        for (let i = 0; i < zones.length; i++) {
          if (farm.zones[i]) {
            await zoneApi.update(farm.id, farm.zones[i].id, zones[i]);
          } else {
            await zoneApi.create(farm.id, zones[i]);
          }
        }
      } catch {
        if (isMockEnabled()) {
          // Save to localStorage
          const farms = JSON.parse(localStorage.getItem('farms') || '[]') as Farm[];
          const idx = farms.findIndex((f) => f.id === farm.id);
          if (idx !== -1) {
            farms[idx].zones = zones.map((z, i) => ({
              ...z,
              id: farm.zones[i]?.id || `zone_${farm.id}_${i + 1}`,
              farmId: farm.id,
              healthScore: 70 + Math.random() * 25,
              diseaseRisk: Math.random() * 30,
            }));
            localStorage.setItem('farms', JSON.stringify(farms));
            setFarm(farms[idx]);
          }
        } else {
          throw new Error('Failed to save zones');
        }
      }
      toast.success('Zones saved successfully!');
      navigate(`/farms/${farm.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save zones');
    } finally {
      setSaving(false);
    }
  };

  const totalAllocated = zones.reduce((sum, z) => sum + (z.area || 0), 0);
  const remaining = (farm?.area || 0) - totalAllocated;

  if (loading) return <LoadingSpinner message="Loading farm..." fullPage />;
  if (error) return <ErrorDisplay message={error} onRetry={loadFarm} />;
  if (!farm) return <ErrorDisplay message="Farm not found" />;

  return (
    <div className="page-container">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="page-title flex items-center gap-3">
              <Settings2 className="w-7 h-7 text-farm-green" />
              Farm Builder
            </h1>
            <p className="text-gray-500 mt-1">{farm.name} • {farm.location}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={addZone} className="btn-secondary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Zone
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save & Continue'}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Farm Visual */}
          <div className="lg:col-span-1">
            <div className="card sticky top-24">
              <h2 className="section-title mb-4">Farm Overview</h2>

              {/* Area allocation bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Area allocated</span>
                  <span className={`font-medium ${remaining < 0 ? 'text-red-500' : 'text-gray-700'}`}>
                    {totalAllocated.toFixed(1)} / {farm.area} acres
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      remaining < 0 ? 'bg-red-500' : remaining === 0 ? 'bg-farm-green' : 'bg-farm-green-light'
                    }`}
                    style={{ width: `${Math.min(100, (totalAllocated / farm.area) * 100)}%` }}
                  />
                </div>
                {remaining < 0 && (
                  <p className="text-xs text-red-500 mt-1">Over-allocated by {Math.abs(remaining).toFixed(1)} acres</p>
                )}
              </div>

              {/* Visual Farm Grid */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {zones.map((zone, i) => (
                  <button
                    key={i}
                    onClick={() => setExpandedZone(i)}
                    className={`relative rounded-xl p-3 text-left transition-all duration-200 border-2 ${
                      expandedZone === i
                        ? 'border-farm-green shadow-md scale-[1.02]'
                        : 'border-transparent hover:border-gray-200'
                    }`}
                    style={{
                      backgroundColor: cropColors[zone.crop] + '20',
                      minHeight: `${Math.max(60, (zone.area / farm.area) * 200)}px`,
                    }}
                  >
                    <span className="text-lg">{cropEmojis[zone.crop]}</span>
                    <p className="text-xs font-semibold text-gray-800 mt-1 truncate">{zone.name}</p>
                    <p className="text-[10px] text-gray-500">{zone.crop}</p>
                    <p className="text-[10px] text-gray-400">{zone.area}ac</p>
                  </button>
                ))}
              </div>

              {/* Legend */}
              <div className="space-y-1.5">
                {zones.map((zone, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: cropColors[zone.crop] }}
                    />
                    <span className="text-gray-600 truncate">{zone.name}: {zone.crop}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Zone Configuration */}
          <div className="lg:col-span-2 space-y-4">
            {zones.map((zone, i) => (
              <div
                key={i}
                className={`card border-2 transition-all duration-200 ${
                  expandedZone === i ? 'border-farm-green/30' : 'border-transparent'
                }`}
              >
                {/* Zone Header */}
                <button
                  onClick={() => setExpandedZone(expandedZone === i ? -1 : i)}
                  className="w-full flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{cropEmojis[zone.crop]}</span>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">{zone.name}</h3>
                      <p className="text-xs text-gray-500">
                        {zone.crop} • {zone.soilType} soil • {zone.area} acres
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); removeZone(i); }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {expandedZone === i ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Zone Details (expanded) */}
                {expandedZone === i && (
                  <div className="mt-5 pt-5 border-t border-gray-100 space-y-5">
                    {/* Basic Info */}
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div>
                        <label className="label">Zone Name</label>
                        <input
                          type="text"
                          className="input-field"
                          value={zone.name}
                          onChange={(e) => updateZone(i, 'name', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label">Area (acres)</label>
                        <input
                          type="number"
                          className="input-field"
                          min="0.1"
                          step="0.1"
                          value={zone.area}
                          onChange={(e) => updateZone(i, 'area', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <label className="label">Crop</label>
                        <select
                          className="select-field"
                          value={zone.crop}
                          onChange={(e) => updateZone(i, 'crop', e.target.value as CropType)}
                        >
                          {cropOptions.map((c) => (
                            <option key={c} value={c}>{cropEmojis[c]} {c}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Soil & Growth */}
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div>
                        <label className="label">Soil Type</label>
                        <select
                          className="select-field"
                          value={zone.soilType}
                          onChange={(e) => updateZone(i, 'soilType', e.target.value as SoilType)}
                        >
                          {soilOptions.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Growth Stage</label>
                        <select
                          className="select-field"
                          value={zone.growthStage}
                          onChange={(e) => updateZone(i, 'growthStage', e.target.value as GrowthStage)}
                        >
                          {growthStages.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Irrigation Method</label>
                        <select
                          className="select-field"
                          value={zone.irrigationMethod}
                          onChange={(e) => updateZone(i, 'irrigationMethod', e.target.value as IrrigationMethod)}
                        >
                          {irrigationMethods.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Environment */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                        <Thermometer className="w-4 h-4 text-orange-500" />
                        Environment
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <label className="label">Soil Moisture (%)</label>
                          <input type="number" className="input-field" min="0" max="100"
                            value={zone.soilMoisture}
                            onChange={(e) => updateZone(i, 'soilMoisture', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                          <label className="label">Temperature (°C)</label>
                          <input type="number" className="input-field" min="-10" max="60"
                            value={zone.temperature}
                            onChange={(e) => updateZone(i, 'temperature', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                          <label className="label">Humidity (%)</label>
                          <input type="number" className="input-field" min="0" max="100"
                            value={zone.humidity}
                            onChange={(e) => updateZone(i, 'humidity', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                          <label className="label">Rainfall (mm)</label>
                          <input type="number" className="input-field" min="0"
                            value={zone.rainfall}
                            onChange={(e) => updateZone(i, 'rainfall', parseFloat(e.target.value) || 0)} />
                        </div>
                      </div>
                    </div>

                    {/* Nutrients */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                        <FlaskConical className="w-4 h-4 text-purple-500" />
                        Nutrients (kg/ha)
                      </h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="label">Nitrogen (N)</label>
                          <input type="number" className="input-field" min="0"
                            value={zone.nitrogen}
                            onChange={(e) => updateZone(i, 'nitrogen', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                          <label className="label">Phosphorus (P)</label>
                          <input type="number" className="input-field" min="0"
                            value={zone.phosphorus}
                            onChange={(e) => updateZone(i, 'phosphorus', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                          <label className="label">Potassium (K)</label>
                          <input type="number" className="input-field" min="0"
                            value={zone.potassium}
                            onChange={(e) => updateZone(i, 'potassium', parseFloat(e.target.value) || 0)} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add zone button */}
            <button
              onClick={addZone}
              className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-farm-green hover:text-farm-green transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Another Zone
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
