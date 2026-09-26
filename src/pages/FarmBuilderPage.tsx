import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  MapPin, Save, Plus, ArrowRight, Layers, Eye,
  Maximize2, Crosshair, AlertTriangle, Check, Undo2,
  Trash2, Settings2, Loader2, Sprout, Wheat, Droplets,
  Edit3, Compass, CheckCircle2, ChevronRight, HelpCircle, Brain,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { farmApi, zoneApi } from '../services/api';
import { firestoreService } from '../services/firestoreService';
import { isMockEnabled } from '../services/mockData';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ErrorDisplay from '../components/shared/ErrorDisplay';
import DigitalFarmMap, {
  DrawingTool,
  DrawingTarget,
  BaseMapLayer,
  FieldViewMode,
} from '../components/map/DigitalFarmMap';
import FieldDetailsPanel from '../components/map/FieldDetailsPanel';
import WeatherCard from '../components/weather/WeatherCard';
import FarmIntelligencePanel from '../components/intelligence/FarmIntelligencePanel';
import { useFarmWeather } from '../hooks/useFarmWeather';
import { useFarmContext } from '../context/FarmContext';
import { analyzeFarmIntelligence } from '../services/farmIntelligence';
import type { WeatherData } from '../services/weather';
import type { Farm, Zone, ZoneInput, CropType, SoilType } from '../types';
import {
  CROP_OPTIONS as cropOptions,
  SOIL_OPTIONS as soilOptions,
  CROP_EMOJIS as cropEmojis,
  CROP_COLORS as cropColors,
} from '../types';
import {
  calculatePolygonArea,
  calculatePerimeter,
  generateDefaultFarmBoundary,
  generateDefaultPlotBoundaries,
  getPolygonCenter,
  doPolygonsOverlap,
  isPolygonInsidePolygon,
} from '../services/mapGeometry';

function getInitialCoordinates(farm: Farm): [number, number] {
  if (farm.latitude !== undefined && farm.longitude !== undefined && farm.latitude !== 0) {
    return [farm.latitude, farm.longitude];
  }
  const loc = (farm.location || '').toLowerCase();
  if (loc.includes('punjab') || loc.includes('ludhiana') || loc.includes('india')) {
    return [30.9010, 75.8573];
  }
  if (loc.includes('california') || loc.includes('fresno') || loc.includes('central valley')) {
    return [36.7468, -119.7726];
  }
  if (loc.includes('iowa') || loc.includes('ames')) {
    return [42.0308, -93.6319];
  }
  if (loc.includes('texas')) {
    return [31.9686, -99.9018];
  }
  if (loc.includes('kansas')) {
    return [39.0119, -98.4842];
  }
  // Default fertile agriculture coordinates (Punjab plain)
  return [30.9010, 75.8573];
}

export default function FarmBuilderPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { updateFarmInState, selectFarm } = useFarmContext();

  const [farm, setFarm] = useState<Farm | null>(null);
  const [zones, setZones] = useState<ZoneInput[]>([]);
  const [selectedZoneIndex, setSelectedZoneIndex] = useState<number | null>(null);

  // Map controls
  const [mapCenter, setMapCenter] = useState<[number, number]>([30.9010, 75.8573]);
  const [farmBoundary, setFarmBoundary] = useState<[number, number][] | undefined>(undefined);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('none');
  const [drawingTarget, setDrawingTarget] = useState<DrawingTarget>('field');
  const [activeLayer, setActiveLayer] = useState<BaseMapLayer>('satellite');
  const [viewMode, setViewMode] = useState<FieldViewMode>('health');
  const [isEditingVertices, setIsEditingVertices] = useState(false);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'plots' | 'intelligence'>('plots');
  const [showWeatherOverlay, setShowWeatherOverlay] = useState(false);

  // Live Weather Integration from Open-Meteo
  const {
    weather,
    loading: weatherLoading,
    isRefreshing: weatherRefreshing,
    error: weatherError,
    lastUpdatedLabel: weatherUpdatedLabel,
    refresh: refreshWeather,
    agronomicImpact,
  } = useFarmWeather({
    latitude: farm?.latitude ?? mapCenter[0],
    longitude: farm?.longitude ?? mapCenter[1],
    zones,
  });

  // Real-time Farm Intelligence Engine
  const farmIntelligence = useMemo(() => {
    if (!farm || !weather) return null;
    return analyzeFarmIntelligence(farm, zones, weather);
  }, [farm, zones, weather]);

  const handleApplyWeatherToZones = (w: WeatherData) => {
    setZones((prev) =>
      prev.map((z) => ({
        ...z,
        temperature: w.temperature,
        humidity: w.humidity,
        rainfall: w.rain > 0 ? Math.round(w.rain * 15) : z.rainfall,
      }))
    );
    toast.success(`Applied live weather (${Math.round(w.temperature)}°C, ${Math.round(w.humidity)}% humidity) to all plots!`);
  };

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

      // Determine center
      const centerCoords = getInitialCoordinates(farmData);
      setMapCenter(centerCoords);

      // Determine or generate farm boundary
      let currentBoundary = farmData.boundary;
      if (!currentBoundary || currentBoundary.length < 3) {
        currentBoundary = generateDefaultFarmBoundary(centerCoords, farmData.area || 10);
      }
      setFarmBoundary(currentBoundary);

      // Prepare zones with boundaries
      let initialZones: ZoneInput[] = [];
      if (farmData.zones && farmData.zones.length > 0) {
        const defaultPlots = generateDefaultPlotBoundaries(currentBoundary, farmData.zones.length);
        initialZones = farmData.zones.map((z, idx) => ({
          id: z.id,
          name: z.name || `Field ${idx + 1}`,
          area: z.area,
          crop: z.crop,
          soilType: (z.soilType as SoilType) || 'Loamy',
          growthStage: z.growthStage,
          irrigationMethod: z.irrigationMethod,
          soilMoisture: z.soilMoisture,
          temperature: z.temperature,
          humidity: z.humidity,
          rainfall: z.rainfall,
          nitrogen: z.nitrogen,
          phosphorus: z.phosphorus,
          potassium: z.potassium,
          healthScore: z.healthScore ?? 80,
          diseaseRisk: z.diseaseRisk ?? 15,
          pestRisk: z.pestRisk ?? 15,
          boundary: z.boundary && z.boundary.length >= 3 ? z.boundary : defaultPlots[idx],
          boundaryShape: z.boundaryShape || 'polygon',
          stressState: z.stressState || 'healthy',
        }));
      } else {
        const count = 3;
        const defaultPlots = generateDefaultPlotBoundaries(currentBoundary, count);
        initialZones = Array.from({ length: count }, (_, idx) => ({
          id: `zone_${farmData.id}_${idx + 1}`,
          name: `Field ${String.fromCharCode(65 + idx)}1`,
          area: Math.round(((farmData.area || 10) / count) * 10) / 10,
          crop: cropOptions[idx % cropOptions.length],
          soilType: 'Loamy',
          growthStage: 'Vegetative',
          irrigationMethod: 'Drip',
          soilMoisture: 60,
          temperature: 28,
          humidity: 65,
          rainfall: 80,
          nitrogen: 42,
          phosphorus: 20,
          potassium: 26,
          healthScore: 82,
          diseaseRisk: 14,
          pestRisk: 12,
          boundary: defaultPlots[idx],
          boundaryShape: 'polygon',
          stressState: 'healthy',
        }));
      }
      setZones(initialZones);
      if (initialZones.length > 0) {
        setSelectedZoneIndex(0);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load farm');
    } finally {
      setLoading(false);
    }
  };

  // Immediate area & perimeter metrics for farm boundary
  const farmAreaCalc = useMemo(() => {
    if (farmBoundary && farmBoundary.length >= 3) {
      return calculatePolygonArea(farmBoundary);
    }
    return {
      acres: farm?.area || 0,
      hectares: Math.round(((farm?.area || 0) / 2.47105) * 100) / 100,
      squareMeters: Math.round((farm?.area || 0) * 4046.86),
    };
  }, [farmBoundary, farm?.area]);

  const farmPerimeterCalc = useMemo(() => {
    if (farmBoundary && farmBoundary.length >= 3) {
      return calculatePerimeter(farmBoundary);
    }
    return { meters: 0, kilometers: 0, feet: 0 };
  }, [farmBoundary]);

  // Total allocated field acreage
  const totalAllocatedAcres = useMemo(() => {
    return Math.round(zones.reduce((sum, z) => sum + (z.area || 0), 0) * 100) / 100;
  }, [zones]);

  const remainingAcres = Math.round((farmAreaCalc.acres - totalAllocatedAcres) * 100) / 100;

  // Handler: update farm boundary
  const handleUpdateFarmBoundary = (coords: [number, number][], shape: 'polygon' | 'rectangle' | 'circle') => {
    setFarmBoundary(coords);
    const measured = calculatePolygonArea(coords);
    const peri = calculatePerimeter(coords);

    if (farm) {
      setFarm({
        ...farm,
        area: measured.acres,
        boundary: coords,
        boundaryAreaAcres: measured.acres,
        boundaryAreaHectares: measured.hectares,
        boundaryPerimeterMeters: peri.meters,
        boundaryShape: shape,
      });
    }

    setDrawingTool('none');
    toast.success(`Farm boundary updated: ${measured.acres} acres (${measured.hectares} ha)`);
  };

  // Handler: add field with geometry
  const handleAddFieldWithGeometry = (
    coords: [number, number][],
    shape: 'polygon' | 'rectangle' | 'circle'
  ) => {
    const areaMeas = calculatePolygonArea(coords);
    const newIdx = zones.length;
    const letter = String.fromCharCode(65 + (newIdx % 26));
    const num = Math.floor(newIdx / 26) + 1;

    // Check for overlap with existing fields
    const overlappingZone = zones.find(
      (z) => z.boundary && z.boundary.length >= 3 && doPolygonsOverlap(coords, z.boundary)
    );
    if (overlappingZone) {
      setValidationWarning(`Field boundary overlaps with ${overlappingZone.name}`);
      toast(`Warning: Plot geometry overlaps with ${overlappingZone.name}`, { icon: '⚠️' });
    } else {
      setValidationWarning(null);
    }

    // Check containment inside farm boundary
    if (farmBoundary && farmBoundary.length >= 3) {
      const { inside } = isPolygonInsidePolygon(coords, farmBoundary);
      if (!inside) {
        setValidationWarning('Field boundary extends outside farm perimeter');
      }
    }

    const newField: ZoneInput = {
      id: `zone_${farm?.id || Date.now()}_${newIdx + 1}`,
      name: `Field ${letter}${num}`,
      area: areaMeas.acres > 0 ? areaMeas.acres : 2.5,
      crop: cropOptions[newIdx % cropOptions.length],
      soilType: 'Loamy',
      growthStage: 'Vegetative',
      irrigationMethod: 'Drip',
      soilMoisture: 62,
      temperature: 28,
      humidity: 65,
      rainfall: 80,
      nitrogen: 45,
      phosphorus: 22,
      potassium: 28,
      healthScore: 84,
      diseaseRisk: 14,
      pestRisk: 12,
      boundary: coords,
      boundaryShape: shape,
      stressState: 'healthy',
    };

    setZones((prev) => [...prev, newField]);
    setSelectedZoneIndex(newIdx);
    setDrawingTool('none');
    toast.success(`Field added: ${newField.name} (${newField.area} acres)`);
  };

  // Handler: update zone boundary (e.g. vertex drag)
  const handleUpdateZoneBoundary = (zoneIdx: number, coords: [number, number][]) => {
    const areaMeas = calculatePolygonArea(coords);

    // Overlap check
    const overlappingZone = zones.find(
      (z, idx) => idx !== zoneIdx && z.boundary && z.boundary.length >= 3 && doPolygonsOverlap(coords, z.boundary)
    );
    if (overlappingZone) {
      setValidationWarning(`Field boundary overlaps with ${overlappingZone.name}`);
    } else {
      setValidationWarning(null);
    }

    setZones((prev) => {
      const updated = [...prev];
      updated[zoneIdx] = {
        ...updated[zoneIdx],
        boundary: coords,
        area: areaMeas.acres,
      };
      return updated;
    });
  };

  // Handler: update zone attribute
  const handleUpdateZoneField = (zoneIdx: number, key: keyof ZoneInput, value: any) => {
    setZones((prev) => {
      const updated = [...prev];
      updated[zoneIdx] = { ...updated[zoneIdx], [key]: value };
      return updated;
    });
  };

  // Handler: delete field
  const handleDeleteZone = (index: number) => {
    if (zones.length <= 1) {
      toast.error('At least 1 field area is required');
      return;
    }
    const deletedName = zones[index]?.name;
    setZones((prev) => prev.filter((_, i) => i !== index));
    setSelectedZoneIndex(null);
    toast.success(`Deleted ${deletedName}`);
  };

  // Handler: Save
  const handleSave = async () => {
    if (!farm) return;

    // 1. Validate crops
    const missingCrop = zones.find((z) => !z.crop);
    if (missingCrop) {
      toast.error(`Please assign a crop for ${missingCrop.name || 'all plots'}`);
      return;
    }

    // 2. Validate area
    const zeroArea = zones.find((z) => !z.area || z.area <= 0);
    if (zeroArea) {
      toast.error(`Field ${zeroArea.name} must have an area greater than 0 acres`);
      return;
    }

    setSaving(true);
    try {
      const updatedFarm: Farm = {
        ...farm,
        area: farmAreaCalc.acres,
        boundary: farmBoundary,
        boundaryAreaAcres: farmAreaCalc.acres,
        boundaryAreaHectares: farmAreaCalc.hectares,
        boundaryPerimeterMeters: farmPerimeterCalc.meters,
        zones: zones.map((z, i) => ({
          id: z.id || farm.zones[i]?.id || `zone_${farm.id}_${i + 1}`,
          farmId: farm.id,
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
          healthScore: z.healthScore ?? 80,
          diseaseRisk: z.diseaseRisk ?? 15,
          pestRisk: z.pestRisk ?? 15,
          boundary: z.boundary,
          boundaryShape: z.boundaryShape,
          stressState: z.stressState,
        })),
        updatedAt: new Date().toISOString(),
      };

       // Try API first
       try {
         await farmApi.update(farm.id, updatedFarm);
         for (let i = 0; i < zones.length; i++) {
           if (farm.zones[i]) {
             await zoneApi.update(farm.id, farm.zones[i].id, zones[i]);
           } else {
             await zoneApi.create(farm.id, zones[i]);
           }
         }
       } catch {
         // Fallback to localStorage
         if (isMockEnabled()) {
           const farms = JSON.parse(localStorage.getItem('farms') || '[]') as Farm[];
           const idx = farms.findIndex((f) => f.id === farm.id);
           if (idx !== -1) {
             farms[idx] = updatedFarm;
           } else {
             farms.push(updatedFarm);
           }
           localStorage.setItem('farms', JSON.stringify(farms));
         } else {
           throw new Error('Failed to save farm and field map data');
         }
       }

       // Persist to Firestore so browser and backend share the same store.
       await firestoreService.saveFarm(updatedFarm);

      // Synchronize in shared application state
      updateFarmInState(updatedFarm);
      selectFarm(farm.id);

      toast.success('Digital Farm Map saved successfully!');
      navigate(`/farms/${farm.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading interactive digital farm map..." fullPage />;
  if (error) return <ErrorDisplay message={error} onRetry={loadFarm} />;
  if (!farm) return <ErrorDisplay message="Farm not found" />;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-stone-100">
      {/* 1. TOP HEADER & INTERACTIVE TOOLBAR */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex-shrink-0 z-20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Farm Title & Geodesic Area Stats */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-farm-green-pale flex items-center justify-center flex-shrink-0">
              <Compass className="w-5 h-5 text-farm-green" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-gray-900 text-lg sm:text-xl truncate">
                  {farm.name}
                </h1>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold border border-emerald-300">
                  Digital Twin Map
                </span>
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                {farm.location} • <b className="text-gray-800">{farmAreaCalc.acres} acres</b> ({farmAreaCalc.hectares} ha) • Perimeter: {farmPerimeterCalc.meters.toLocaleString()} m
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Draw Farm Boundary dropdown/buttons */}
            <div className="flex items-center bg-amber-50 border border-amber-200 rounded-xl p-0.5">
              <button
                onClick={() => {
                  setDrawingTarget('farm_boundary');
                  setDrawingTool(drawingTool === 'polygon' && drawingTarget === 'farm_boundary' ? 'none' : 'polygon');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  drawingTool === 'polygon' && drawingTarget === 'farm_boundary'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-amber-900 hover:bg-amber-100'
                }`}
                title="Draw farm outer boundary polygon"
              >
                🚜 Draw Boundary
              </button>
            </div>

            {/* Add Field Button with shape tools */}
            <div className="flex items-center bg-emerald-50 border border-emerald-200 rounded-xl p-0.5">
              <button
                onClick={() => {
                  setDrawingTarget('field');
                  setDrawingTool(drawingTool === 'polygon' && drawingTarget === 'field' ? 'none' : 'polygon');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  drawingTool === 'polygon' && drawingTarget === 'field'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-emerald-900 hover:bg-emerald-100'
                }`}
                title="Draw custom polygon field"
              >
                <Plus className="w-3.5 h-3.5" /> Add Field
              </button>
              <button
                onClick={() => {
                  setDrawingTarget('field');
                  setDrawingTool(drawingTool === 'rectangle' && drawingTarget === 'field' ? 'none' : 'rectangle');
                }}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  drawingTool === 'rectangle' && drawingTarget === 'field'
                    ? 'bg-emerald-600 text-white'
                    : 'text-emerald-800 hover:bg-emerald-100'
                }`}
                title="Draw rectangular plot"
              >
                Rect
              </button>
              <button
                onClick={() => {
                  setDrawingTarget('field');
                  setDrawingTool(drawingTool === 'circle' && drawingTarget === 'field' ? 'none' : 'circle');
                }}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  drawingTool === 'circle' && drawingTarget === 'field'
                    ? 'bg-emerald-600 text-white'
                    : 'text-emerald-800 hover:bg-emerald-100'
                }`}
                title="Draw circular plot (e.g. center pivot)"
              >
                Circle
              </button>
            </div>

            {/* Vertex edit toggle */}
            <button
              onClick={() => setIsEditingVertices(!isEditingVertices)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
                isEditingVertices
                  ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
              title="Drag and edit polygon corner points"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {isEditingVertices ? 'Finish Editing' : 'Edit Vertices'}
            </button>

            {/* Map Tile Layer Toggle */}
            <div className="flex items-center bg-gray-100 rounded-xl p-0.5 border border-gray-200 text-xs">
              <button
                onClick={() => setActiveLayer('satellite')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  activeLayer === 'satellite' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🛰️ Satellite
              </button>
              <button
                onClick={() => setActiveLayer('streets')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  activeLayer === 'streets' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🗺️ Streets
              </button>
              <button
                onClick={() => setActiveLayer('topo')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  activeLayer === 'topo' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🏔️ Topo
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 rounded-xl p-0.5 border border-gray-200 text-xs">
              <button
                onClick={() => setViewMode('health')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  viewMode === 'health' ? 'bg-white text-emerald-800 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                ❤️ Health
              </button>
              <button
                onClick={() => setViewMode('crops')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  viewMode === 'crops' ? 'bg-white text-farm-green shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🌿 Crops
              </button>
              <button
                onClick={() => setViewMode('moisture')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  viewMode === 'moisture' ? 'bg-white text-blue-800 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                💧 Moisture
              </button>
            </div>

            {/* Live Weather Button */}
            <button
              onClick={() => setShowWeatherOverlay(!showWeatherOverlay)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                showWeatherOverlay
                  ? 'bg-sky-600 text-white border-sky-700 shadow-sm'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-sky-50'
              }`}
              title="Toggle Live Farm Weather & Agronomic Forecast"
            >
              <span>{weather ? weather.weatherEmoji : '⛅'}</span>
              <span>{weather ? `${Math.round(weather.temperature)}°C` : 'Live Weather'}</span>
              {agronomicImpact && agronomicImpact.alerts.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Active Weather Alert" />
              )}
            </button>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-2 shadow-md hover:shadow-lg"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Saving...' : 'Save & Continue'}
            </button>
          </div>
        </div>

        {/* Validation Warning Alert Banner */}
        {validationWarning && (
          <div className="mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="font-semibold">{validationWarning}</span>
            </div>
            <button
              onClick={() => setValidationWarning(null)}
              className="text-amber-700 hover:text-amber-900 font-bold px-2 py-0.5 rounded hover:bg-amber-100"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* 2. MAIN WORKSPACE: MAP (HERO) + SIDE INSPECTOR */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-3 gap-3">
        {/* MAP CONTAINER (CENTRAL HERO WORKSPACE) */}
        <div className="flex-1 h-full min-h-[450px] relative rounded-2xl overflow-hidden shadow-lg border border-gray-200">
          <DigitalFarmMap
            farmName={farm.name}
            center={mapCenter}
            farmBoundary={farmBoundary}
            zones={zones}
            selectedZoneIndex={selectedZoneIndex}
            drawingTool={drawingTool}
            drawingTarget={drawingTarget}
            activeLayer={activeLayer}
            viewMode={viewMode}
            isEditingVertices={isEditingVertices}
            liveWeather={weather}
            onSelectZone={(idx) => setSelectedZoneIndex(idx)}
            onUpdateFarmBoundary={handleUpdateFarmBoundary}
            onAddFieldWithGeometry={handleAddFieldWithGeometry}
            onUpdateZoneBoundary={handleUpdateZoneBoundary}
            onCancelDrawing={() => setDrawingTool('none')}
            onValidationWarning={(w) => setValidationWarning(w)}
          />

          {/* Floating Live Weather Card overlay on map */}
          {showWeatherOverlay && (
            <div className="absolute top-4 right-4 z-[950] w-full max-w-[360px] animate-fadeIn">
              <WeatherCard
                weather={weather}
                loading={weatherLoading}
                isRefreshing={weatherRefreshing}
                error={weatherError}
                lastUpdatedLabel={weatherUpdatedLabel}
                agronomicImpact={agronomicImpact}
                onRefresh={refreshWeather}
                onApplyWeatherToZones={handleApplyWeatherToZones}
                compact={false}
              />
            </div>
          )}
        </div>

        {/* SIDE PANEL: FIELD DETAILS OR FARM SUMMARY */}
        <div className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 h-full flex flex-col overflow-hidden">
          {selectedZoneIndex !== null && zones[selectedZoneIndex] ? (
            <FieldDetailsPanel
              zone={zones[selectedZoneIndex]}
              zoneIndex={selectedZoneIndex}
              totalFarmArea={farmAreaCalc.acres}
              onUpdate={handleUpdateZoneField}
              onDelete={handleDeleteZone}
              onClose={() => setSelectedZoneIndex(null)}
              onCenterField={() => {
                if (zones[selectedZoneIndex].boundary) {
                  const center = getPolygonCenter(zones[selectedZoneIndex].boundary!);
                  setMapCenter(center);
                }
              }}
            />
          ) : (
            /* Farm Summary & Field List Hub when no field is selected */
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 flex flex-col h-full overflow-hidden p-4 space-y-3">
              {/* Segmented Switch: Plots vs Farm Intelligence */}
              <div className="flex bg-stone-100 p-1 rounded-xl border border-gray-200 text-xs font-semibold">
                <button
                  onClick={() => setSidebarTab('plots')}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    sidebarTab === 'plots' ? 'bg-white text-gray-900 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Sprout className="w-3.5 h-3.5 text-farm-green" />
                  Plots ({zones.length})
                </button>
                <button
                  onClick={() => setSidebarTab('intelligence')}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    sidebarTab === 'intelligence' ? 'bg-white text-emerald-900 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Brain className="w-3.5 h-3.5 text-blue-600" />
                  Intelligence
                  {farmIntelligence && farmIntelligence.headlineAlerts.length > 0 && (
                    <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                      {farmIntelligence.headlineAlerts.length}
                    </span>
                  )}
                </button>
              </div>

              {sidebarTab === 'plots' ? (
                <>
                  <div>
                    <h2 className="section-title text-base flex items-center justify-between mb-1">
                      <span>Farm Plots & Allocation</span>
                      <span className="text-xs font-normal text-gray-500">{zones.length} fields</span>
                    </h2>
                    <p className="text-xs text-gray-500">
                      Click on any field on the map or in the list below to view and edit its agronomic parameters.
                    </p>
                  </div>

                  {/* Area Allocation Progress Bar */}
                  <div className="p-3 bg-stone-50 rounded-xl border border-gray-200 space-y-2">
                    <div className="flex justify-between items-center text-xs font-medium">
                      <span className="text-gray-600">Total Farm Area:</span>
                      <span className="font-bold text-gray-900">{farmAreaCalc.acres} acres ({farmAreaCalc.hectares} ha)</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Field Allocation:</span>
                      <span className={`font-semibold ${remainingAcres < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {totalAllocatedAcres} / {farmAreaCalc.acres} acres ({farmAreaCalc.acres > 0 ? ((totalAllocatedAcres / farmAreaCalc.acres) * 100).toFixed(0) : 0}%)
                      </span>
                    </div>
                    <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          remainingAcres < 0 ? 'bg-red-500' : 'bg-farm-green'
                        }`}
                        style={{ width: `${Math.min(100, farmAreaCalc.acres > 0 ? (totalAllocatedAcres / farmAreaCalc.acres) * 100 : 0)}%` }}
                      />
                    </div>
                    {remainingAcres < 0 ? (
                      <p className="text-[11px] text-red-500">⚠️ Over-allocated by {Math.abs(remainingAcres)} acres.</p>
                    ) : remainingAcres > 0 ? (
                      <p className="text-[11px] text-gray-500">{remainingAcres} acres remaining unassigned.</p>
                    ) : (
                      <p className="text-[11px] text-emerald-600 font-medium">✓ 100% farm area mapped to fields.</p>
                    )}
                  </div>

                  {/* Field Cards Quick List */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {zones.map((z, idx) => (
                      <div
                        key={z.id || idx}
                        onClick={() => setSelectedZoneIndex(idx)}
                        className="p-3 rounded-xl border border-gray-200 hover:border-farm-green bg-white hover:bg-stone-50 cursor-pointer transition-all flex items-center justify-between group shadow-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl">{cropEmojis[z.crop] || '🌱'}</span>
                          <div>
                            <h3 className="font-bold text-gray-900 text-sm group-hover:text-farm-green transition-colors">
                              {z.name}
                            </h3>
                            <p className="text-xs text-gray-500">
                              {z.crop} • {z.soilType} soil • <b className="text-gray-700">{z.area} ac</b>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {Math.round(z.healthScore ?? 80)}% Health
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-farm-green transition-colors" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action buttons footer */}
                  <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setDrawingTarget('field');
                        setDrawingTool('polygon');
                      }}
                      className="flex-1 btn-secondary py-2 text-xs flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Draw New Field
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 btn-primary py-2 text-xs flex items-center justify-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" /> Save Map
                    </button>
                  </div>
                </>
              ) : (
                /* Intelligence View in Sidebar */
                <div className="flex-1 overflow-y-auto pr-1">
                  {farmIntelligence ? (
                    <FarmIntelligencePanel
                      intelligence={farmIntelligence}
                      onSelectField={(fieldName) => {
                        const idx = zones.findIndex((z) => z.name === fieldName);
                        if (idx !== -1) {
                          setSelectedZoneIndex(idx);
                        }
                      }}
                      compact={true}
                    />
                  ) : (
                    <div className="p-4 text-center text-xs text-gray-500">Loading intelligence...</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
