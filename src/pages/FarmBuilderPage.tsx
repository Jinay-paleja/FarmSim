import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  MapPin, Save, Plus, ArrowRight, Layers, Eye,
  Maximize2, Crosshair, AlertTriangle, Check, Undo2,
  Trash2, Settings2, Loader2, Sprout, Wheat, Droplets,
  Edit3, Compass, CheckCircle2, ChevronRight, HelpCircle, Brain,
  Ruler, Move,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { farmApi, zoneApi } from '../services/api';
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
import AreaShapeEditorModal from '../components/map/AreaShapeEditorModal';
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
  translatePolygon,
} from '../services/mapGeometry';

function getInitialCoordinates(farm: Farm): [number, number] {
  if (farm.latitude !== undefined && farm.longitude !== undefined && farm.latitude !== 0) {
    return [farm.latitude, farm.longitude];
  }
  if (farm.boundary && farm.boundary.length >= 3) {
    const lat = farm.boundary.reduce((s, p) => s + p[0], 0) / farm.boundary.length;
    const lng = farm.boundary.reduce((s, p) => s + p[1], 0) / farm.boundary.length;
    return [lat, lng];
  }
  return [20.5937, 78.9629];
}

export default function FarmBuilderPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { updateFarmInState, selectFarm, deleteFarm, selectedFarm, farms, loadingFarms } = useFarmContext();

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
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [isResizeMode, setIsResizeMode] = useState(false);
  const [isAreaShapeModalOpen, setIsAreaShapeModalOpen] = useState(false);
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

  // Handle undefined or missing farmId by redirecting to active farm or showing clean state
  useEffect(() => {
    if (!farmId || farmId === 'undefined' || farmId === 'null') {
      if (selectedFarm?.id && selectedFarm.id !== 'undefined') {
        navigate(`/farms/${selectedFarm.id}/builder`, { replace: true });
        return;
      }
      if (farms.length > 0 && farms[0].id && farms[0].id !== 'undefined') {
        navigate(`/farms/${farms[0].id}/builder`, { replace: true });
        return;
      }
      if (!loadingFarms) {
        setLoading(false);
      }
      return;
    }
    loadFarm();
  }, [farmId, selectedFarm, farms, loadingFarms, navigate]);

  const loadFarm = async () => {
    if (!farmId || farmId === 'undefined' || farmId === 'null') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const farmData = await farmApi.get(farmId);
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

  // Handler: Move farm (deltaLat, deltaLng)
  const handleMoveFarm = (deltaLat: number, deltaLng: number, movePlots: boolean = true) => {
    if (!farmBoundary) return;
    const movedBoundary = translatePolygon(farmBoundary, deltaLat, deltaLng);
    setFarmBoundary(movedBoundary);

    if (movePlots && zones.length > 0) {
      setZones((prev) =>
        prev.map((z) => {
          if (!z.boundary || z.boundary.length === 0) return z;
          return {
            ...z,
            boundary: translatePolygon(z.boundary, deltaLat, deltaLng),
          };
        })
      );
    }
    toast.success('Farm boundary repositioned');
  };

  // Handler: Move zone (deltaLat, deltaLng)
  const handleMoveZone = (zoneIdx: number, deltaLat: number, deltaLng: number) => {
    setZones((prev) => {
      const updated = [...prev];
      if (updated[zoneIdx]?.boundary) {
        updated[zoneIdx] = {
          ...updated[zoneIdx],
          boundary: translatePolygon(updated[zoneIdx].boundary!, deltaLat, deltaLng),
        };
      }
      return updated;
    });
    toast.success(`Moved ${zones[zoneIdx]?.name}`);
  };

  // Handler: Update both farm and zones simultaneously (for proportional area scaling)
  const handleUpdateFarmAndZones = (newFarmBoundary: [number, number][], updatedZones: ZoneInput[]) => {
    setFarmBoundary(newFarmBoundary);
    setZones(updatedZones);
    const measured = calculatePolygonArea(newFarmBoundary);
    if (farm) {
      setFarm({
        ...farm,
        area: measured.acres,
        boundary: newFarmBoundary,
        boundaryAreaAcres: measured.acres,
        boundaryAreaHectares: measured.hectares,
      });
    }
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
    const targetName = zones[index]?.name || `Field ${index + 1}`;
    if (!window.confirm(`Are you sure you want to delete ${targetName}?`)) {
      return;
    }
    setZones((prev) => prev.filter((_, i) => i !== index));
    setSelectedZoneIndex(null);
    toast.success(`Deleted ${targetName}`);
  };

  // Handler: delete entire farm
  const handleDeleteFarm = async () => {
    if (!farm) return;
    if (!window.confirm(`Are you sure you want to delete "${farm.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteFarm(farm.id);
      toast.success(`Deleted farm "${farm.name}"`);
      navigate('/');
    } catch {
      toast.error('Failed to delete farm');
    }
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
          if (farm.zones && farm.zones[i]) {
            await zoneApi.update(farm.id, farm.zones[i].id, zones[i]);
          } else {
            await zoneApi.create(farm.id, zones[i]);
          }
        }
      } catch (err: any) {
        console.warn('API save warning:', err);
      }

      // Synchronize in shared application state
      updateFarmInState(updatedFarm);
      selectFarm(farm.id);

      toast.success('Farm and field map saved successfully!');
      navigate(`/farms/${farm.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save field map. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading interactive digital farm map..." fullPage />;
  if (error) return <ErrorDisplay message={error} onRetry={loadFarm} />;
  if (!farm) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] text-center px-4 bg-stone-50">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4 shadow-sm">
          <Compass className="w-8 h-8 text-emerald-700" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-2">No Farm Selected</h2>
        <p className="text-sm text-gray-600 max-w-md mb-6">
          Create your farm or select an existing farm to view its boundary, crop plots, and real-time conditions.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/farms/create')}
            className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition-colors shadow-sm"
          >
            Build New Farm
          </button>
          <button
            onClick={() => navigate('/farms')}
            className="px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold rounded-xl transition-colors shadow-sm"
          >
            Go to My Farms
          </button>
        </div>
      </div>
    );
  }

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
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  drawingTool === 'polygon' && drawingTarget === 'farm_boundary'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-amber-900 hover:bg-amber-100'
                }`}
                title="Click point-by-point to draw farm outer boundary"
              >
                🚜 Polygon
              </button>
              <button
                onClick={() => {
                  setDrawingTarget('farm_boundary');
                  setDrawingTool(drawingTool === 'freehand' && drawingTarget === 'farm_boundary' ? 'none' : 'freehand');
                  toast('Hold left click and sketch farm boundary directly with your mouse', { icon: '✏️' });
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  drawingTool === 'freehand' && drawingTarget === 'farm_boundary'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-amber-900 hover:bg-amber-100'
                }`}
                title="Hold mouse down and sketch any organic boundary"
              >
                ✏️ Sketch
              </button>
            </div>

            {/* Add Field Button with shape tools */}
            <div className="flex items-center bg-emerald-50 border border-emerald-200 rounded-xl p-0.5">
              <button
                onClick={() => {
                  setDrawingTarget('field');
                  setDrawingTool(drawingTool === 'polygon' && drawingTarget === 'field' ? 'none' : 'polygon');
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  drawingTool === 'polygon' && drawingTarget === 'field'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-emerald-900 hover:bg-emerald-100'
                }`}
                title="Click point-by-point to draw polygon field"
              >
                <Plus className="w-3.5 h-3.5" /> Polygon
              </button>
              <button
                onClick={() => {
                  setDrawingTarget('field');
                  setDrawingTool(drawingTool === 'freehand' && drawingTarget === 'field' ? 'none' : 'freehand');
                  toast('Hold left click and sketch field outline directly with your mouse', { icon: '✏️' });
                }}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  drawingTool === 'freehand' && drawingTarget === 'field'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-emerald-800 hover:bg-emerald-100'
                }`}
                title="Hold mouse down and sketch any organic field shape"
              >
                ✏️ Sketch
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
              title="Drag corner pins or drag '+' edge handles to reshape"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {isEditingVertices ? 'Finish Pins' : 'Edit Pins & Edges'}
            </button>

            {/* Direct Mouse Scale Resize Pin Toggle */}
            <button
              onClick={() => {
                const next = !isResizeMode;
                setIsResizeMode(next);
                toast(next ? 'Scale Resize Active: Drag ↔ amber pin on map outward to increase, inward to decrease size' : 'Resize mode disabled', { icon: '↔' });
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isResizeMode
                  ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
              title="Drag the amber ↔ scale handle to directly increase or decrease size with your mouse"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>{isResizeMode ? 'Resizing Active' : '↔ Mouse Resize'}</span>
            </button>

            {/* Size, Shape & Dimensions Modal Button */}
            <button
              onClick={() => setIsAreaShapeModalOpen(true)}
              className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Edit size in acres/ha, adjust rectangle width/height, sketch, or move"
            >
              <Ruler className="w-3.5 h-3.5 text-emerald-700" />
              <span>📐 Size & Dimensions</span>
            </button>

            {/* Move Area Pin Toggle */}
            <button
              onClick={() => {
                const next = !isMoveMode;
                setIsMoveMode(next);
                toast(next ? 'Move mode active: drag ✥ center pin to move area' : 'Move mode disabled', { icon: '✥' });
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isMoveMode
                  ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
              title="Drag center pin to move entire farm or selected field"
            >
              <Move className="w-3.5 h-3.5" />
              <span>{isMoveMode ? 'Moving Active' : 'Move Area'}</span>
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

            {/* Delete Farm Button */}
            <button
              type="button"
              onClick={handleDeleteFarm}
              className="px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="Delete this farm permanently"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Farm</span>
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
            isMoveMode={isMoveMode}
            isResizeMode={isResizeMode}
            liveWeather={weather}
            onSelectZone={(idx) => setSelectedZoneIndex(idx)}
            onUpdateFarmBoundary={handleUpdateFarmBoundary}
            onAddFieldWithGeometry={handleAddFieldWithGeometry}
            onUpdateZoneBoundary={handleUpdateZoneBoundary}
            onMoveFarm={(dLat, dLng) => handleMoveFarm(dLat, dLng, true)}
            onMoveZone={handleMoveZone}
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
              onOpenDimensionEditor={() => setIsAreaShapeModalOpen(true)}
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
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteZone(idx);
                            }}
                            className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title={`Delete ${z.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Area, Shape, Rectangle Dimensions & Move Modal */}
      <AreaShapeEditorModal
        isOpen={isAreaShapeModalOpen}
        onClose={() => setIsAreaShapeModalOpen(false)}
        farmName={farm.name}
        farmBoundary={farmBoundary}
        zones={zones}
        selectedZoneIndex={selectedZoneIndex}
        onSelectZone={(idx) => setSelectedZoneIndex(idx)}
        onUpdateFarmBoundary={handleUpdateFarmBoundary}
        onUpdateZoneBoundary={handleUpdateZoneBoundary}
        onUpdateFarmAndZones={handleUpdateFarmAndZones}
        onStartDrawingTool={(tool, target) => {
          setDrawingTarget(target);
          setDrawingTool(tool);
        }}
        isEditingVertices={isEditingVertices}
        onToggleVertexEditing={() => setIsEditingVertices(!isEditingVertices)}
        isMoveMode={isMoveMode}
        onToggleMoveMode={() => setIsMoveMode(!isMoveMode)}
        isResizeMode={isResizeMode}
        onToggleResizeMode={() => setIsResizeMode(!isResizeMode)}
        onDeleteZone={handleDeleteZone}
        onDeleteFarm={handleDeleteFarm}
      />
    </div>
  );
}
