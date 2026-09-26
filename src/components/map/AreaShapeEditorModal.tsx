import React, { useState, useMemo } from 'react';
import {
  X, Maximize2, Move, Ruler, Square, Edit3, Compass,
  Layers, Check, Sparkles, ArrowRight, RefreshCw,
  ChevronDown, ArrowUp, ArrowDown, ArrowLeft, Trash2,
} from 'lucide-react';
import type { ZoneInput } from '../../types';
import {
  calculatePolygonArea,
  calculatePerimeter,
  getPolygonDimensions,
  createRectangleAroundCenter,
  scalePolygonToArea,
  translatePolygon,
  getPolygonCenter,
  acresToHectares,
  hectaresToAcres,
} from '../../services/mapGeometry';
import toast from 'react-hot-toast';

export type AreaUnit = 'acres' | 'hectares' | 'sqMeters';

interface AreaShapeEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmName: string;
  farmBoundary?: [number, number][];
  zones: ZoneInput[];
  selectedZoneIndex: number | null;
  onSelectZone: (index: number | null) => void;
  onUpdateFarmBoundary: (coords: [number, number][], shape: 'polygon' | 'rectangle' | 'circle') => void;
  onUpdateZoneBoundary: (zoneIndex: number, coords: [number, number][]) => void;
  onUpdateFarmAndZones: (newFarmBoundary: [number, number][], updatedZones: ZoneInput[]) => void;
  onStartDrawingTool: (tool: 'polygon' | 'freehand' | 'rectangle', target: 'farm_boundary' | 'field') => void;
  isEditingVertices: boolean;
  onToggleVertexEditing: () => void;
  isMoveMode: boolean;
  onToggleMoveMode: () => void;
  isResizeMode?: boolean;
  onToggleResizeMode?: () => void;
  onDeleteZone?: (zoneIndex: number) => void;
  onDeleteFarm?: () => void;
}

export default function AreaShapeEditorModal({
  isOpen,
  onClose,
  farmName,
  farmBoundary,
  zones,
  selectedZoneIndex,
  onSelectZone,
  onUpdateFarmBoundary,
  onUpdateZoneBoundary,
  onUpdateFarmAndZones,
  onStartDrawingTool,
  isEditingVertices,
  onToggleVertexEditing,
  isMoveMode,
  onToggleMoveMode,
  isResizeMode = false,
  onToggleResizeMode = () => {},
  onDeleteZone,
  onDeleteFarm,
}: AreaShapeEditorModalProps) {
  if (!isOpen) return null;

  // Selected target: null = entire farm, number = zone index
  const activeTargetIndex = selectedZoneIndex;
  const isFarmSelected = activeTargetIndex === null;

  // Current active polygon
  const activePolygon = useMemo<[number, number][] | undefined>(() => {
    if (isFarmSelected) {
      return farmBoundary;
    }
    return zones[activeTargetIndex]?.boundary;
  }, [isFarmSelected, farmBoundary, zones, activeTargetIndex]);

  // Current geometry measurements
  const areaMeas = useMemo(() => {
    if (!activePolygon || activePolygon.length < 3) {
      return { acres: 0, hectares: 0, squareMeters: 0 };
    }
    return calculatePolygonArea(activePolygon);
  }, [activePolygon]);

  const dims = useMemo(() => {
    if (!activePolygon || activePolygon.length < 2) {
      return { widthMeters: 100, heightMeters: 100 };
    }
    return getPolygonDimensions(activePolygon);
  }, [activePolygon]);

  const perimeterMeas = useMemo(() => {
    if (!activePolygon || activePolygon.length < 2) {
      return { meters: 0 };
    }
    return calculatePerimeter(activePolygon);
  }, [activePolygon]);

  // Tab state within modal: 'size' | 'rectangle' | 'sketch' | 'move'
  const [activeTab, setActiveTab] = useState<'size' | 'rectangle' | 'sketch' | 'move'>('size');

  // Size editing state
  const [sizeUnit, setSizeUnit] = useState<AreaUnit>('acres');
  const [inputSize, setInputSize] = useState<number>(() => {
    if (sizeUnit === 'hectares') return areaMeas.hectares || 10;
    if (sizeUnit === 'sqMeters') return areaMeas.squareMeters || 40468;
    return areaMeas.acres || 10;
  });
  const [scaleChildPlots, setScaleChildPlots] = useState<boolean>(false);

  // Rectangle dimension editing state
  const [rectWidth, setRectWidth] = useState<number>(dims.widthMeters || 200);
  const [rectHeight, setRectHeight] = useState<number>(dims.heightMeters || 200);

  // Move step (meters)
  const [moveStepMeters, setMoveStepMeters] = useState<number>(20);
  const [movePlotsWithFarm, setMovePlotsWithFarm] = useState<boolean>(true);

  // Sync inputs when active polygon or target changes
  React.useEffect(() => {
    if (sizeUnit === 'hectares') {
      setInputSize(areaMeas.hectares);
    } else if (sizeUnit === 'sqMeters') {
      setInputSize(areaMeas.squareMeters);
    } else {
      setInputSize(areaMeas.acres);
    }
    setRectWidth(dims.widthMeters || 200);
    setRectHeight(dims.heightMeters || 200);
  }, [activePolygon, sizeUnit]);

  // Handler: Apply size scaling
  const handleApplySizeScale = () => {
    if (!activePolygon || activePolygon.length < 3) {
      toast.error('No valid polygon exists to resize.');
      return;
    }

    // Convert input size to target acres
    let targetAcres = inputSize;
    if (sizeUnit === 'hectares') {
      targetAcres = hectaresToAcres(inputSize);
    } else if (sizeUnit === 'sqMeters') {
      targetAcres = inputSize / 4046.8564224;
    }

    if (targetAcres <= 0) {
      toast.error('Size must be greater than zero.');
      return;
    }

    const currentAcres = areaMeas.acres || 1;
    const scaleFactor = Math.sqrt(targetAcres / currentAcres);
    const scaledBoundary = scalePolygonToArea(activePolygon, targetAcres);

    if (isFarmSelected) {
      if (scaleChildPlots && zones.length > 0) {
        const [cLat, cLng] = getPolygonCenter(activePolygon);
        const scaledZones = zones.map((z) => {
          if (!z.boundary || z.boundary.length < 3) return z;
          const newBoundary = z.boundary.map(([lat, lng]) => [
            cLat + (lat - cLat) * scaleFactor,
            cLng + (lng - cLng) * scaleFactor,
          ]) as [number, number][];
          const newArea = calculatePolygonArea(newBoundary).acres;
          return {
            ...z,
            boundary: newBoundary,
            area: newArea,
          };
        });
        onUpdateFarmAndZones(scaledBoundary, scaledZones);
        toast.success(`Scaled farm and ${zones.length} field plots to ${targetAcres.toFixed(1)} acres!`);
      } else {
        onUpdateFarmBoundary(scaledBoundary, 'polygon');
        toast.success(`Scaled farm to ${targetAcres.toFixed(1)} acres! (Plot sizes unchanged)`);
      }
    } else {
      onUpdateZoneBoundary(activeTargetIndex, scaledBoundary);
      toast.success(`Scaled ${zones[activeTargetIndex].name} to ${targetAcres.toFixed(1)} acres!`);
    }
  };

  // Handler: Apply rectangle dimensions
  const handleApplyRectangle = () => {
    if (rectWidth < 10 || rectHeight < 10) {
      toast.error('Width and height must be at least 10 meters.');
      return;
    }

    const center = activePolygon && activePolygon.length >= 3
      ? getPolygonCenter(activePolygon)
      : [30.9010, 75.8573] as [number, number];

    const newRect = createRectangleAroundCenter(center, rectWidth, rectHeight);
    const meas = calculatePolygonArea(newRect);

    if (isFarmSelected) {
      onUpdateFarmBoundary(newRect, 'rectangle');
      toast.success(`Farm resized to ${rectWidth}m × ${rectHeight}m rectangle (${meas.acres} acres, ${meas.hectares} ha)!`);
    } else {
      onUpdateZoneBoundary(activeTargetIndex, newRect);
      toast.success(`${zones[activeTargetIndex].name} resized to ${rectWidth}m × ${rectHeight}m rectangle (${meas.acres} acres)!`);
    }
  };

  // Handler: Directional Nudge / Translation
  const handleNudge = (direction: 'N' | 'S' | 'E' | 'W') => {
    if (!activePolygon || activePolygon.length === 0) return;

    const [cLat] = getPolygonCenter(activePolygon);
    const dLatPerM = 1 / 111320;
    const dLngPerM = 1 / (111320 * Math.cos((cLat * Math.PI) / 180));

    let deltaLat = 0;
    let deltaLng = 0;

    switch (direction) {
      case 'N': deltaLat = moveStepMeters * dLatPerM; break;
      case 'S': deltaLat = -moveStepMeters * dLatPerM; break;
      case 'E': deltaLng = moveStepMeters * dLngPerM; break;
      case 'W': deltaLng = -moveStepMeters * dLngPerM; break;
    }

    const movedBoundary = translatePolygon(activePolygon, deltaLat, deltaLng);

    if (isFarmSelected) {
      if (movePlotsWithFarm && zones.length > 0) {
        const movedZones = zones.map((z) => {
          if (!z.boundary || z.boundary.length === 0) return z;
          return {
            ...z,
            boundary: translatePolygon(z.boundary, deltaLat, deltaLng),
          };
        });
        onUpdateFarmAndZones(movedBoundary, movedZones);
      } else {
        onUpdateFarmBoundary(movedBoundary, 'polygon');
      }
    } else {
      onUpdateZoneBoundary(activeTargetIndex, movedBoundary);
    }
  };

  return (
    <div className="fixed inset-0 z-[1050] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-gray-100 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-farm-green-pale flex items-center justify-center text-farm-green">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>Area, Shape & Dimension Editor</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  Interactive GIS
                </span>
              </h2>
              <p className="text-xs text-gray-500">
                Resize by acres/hectares, adjust rectangle width & height, or sketch and move plots on the map.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Switcher: Farm Boundary vs Designated Plots */}
        <div className="p-3 bg-stone-100/70 border-b border-gray-200 flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex-shrink-0 ml-1">
            Editing Target:
          </span>
          <button
            type="button"
            onClick={() => onSelectZone(null)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer ${
              isFarmSelected
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-stone-50'
            }`}
          >
            <span>🚜 Entire Farm</span>
            <span>({farmName})</span>
          </button>

          {zones.map((zone, idx) => {
            const isCurrent = activeTargetIndex === idx;
            return (
              <button
                key={zone.id || idx}
                type="button"
                onClick={() => onSelectZone(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer ${
                  isCurrent
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-stone-50'
                }`}
              >
                <span>{zone.name}</span>
                <span className="text-[10px] opacity-80">({(zone.area || 0).toFixed(1)} ac)</span>
              </button>
            );
          })}

          {/* Delete Action button for the currently selected target */}
          <div className="ml-auto flex items-center flex-shrink-0 pr-1">
            {!isFarmSelected && onDeleteZone && activeTargetIndex !== null && (
              <button
                type="button"
                onClick={() => {
                  const targetName = zones[activeTargetIndex]?.name || `Field ${activeTargetIndex + 1}`;
                  if (window.confirm(`Are you sure you want to delete ${targetName}?`)) {
                    onDeleteZone(activeTargetIndex);
                    onSelectZone(null);
                  }
                }}
                className="px-2.5 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                title="Delete this field plot"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Field</span>
              </button>
            )}

            {isFarmSelected && onDeleteFarm && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Are you sure you want to delete the entire farm "${farmName}"? This action cannot be undone.`)) {
                    onDeleteFarm();
                    onClose();
                  }
                }}
                className="px-2.5 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                title="Delete this farm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Farm</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Measurement Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 bg-emerald-50/50 border-b border-emerald-100 text-xs">
          <div className="bg-white p-2.5 rounded-xl border border-emerald-100 shadow-2xs">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">Acres</span>
            <span className="text-base font-extrabold text-gray-900">{areaMeas.acres} ac</span>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-emerald-100 shadow-2xs">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">Hectares</span>
            <span className="text-base font-extrabold text-emerald-700">{areaMeas.hectares} ha</span>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-emerald-100 shadow-2xs">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">Dimensions</span>
            <span className="text-xs font-bold text-gray-800">{dims.widthMeters}m × {dims.heightMeters}m</span>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-emerald-100 shadow-2xs">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">Perimeter</span>
            <span className="text-xs font-bold text-gray-800">{perimeterMeas.meters} meters</span>
          </div>
        </div>

        {/* Operation Tabs */}
        <div className="grid grid-cols-4 border-b border-gray-200 bg-stone-50 p-1.5 gap-1 text-xs font-bold text-center">
          <button
            type="button"
            onClick={() => setActiveTab('size')}
            className={`py-2 px-1 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'size' ? 'bg-white text-farm-green shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" /> Size by Unit
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rectangle')}
            className={`py-2 px-1 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'rectangle' ? 'bg-white text-farm-green shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Square className="w-3.5 h-3.5" /> Rectangle (W×H)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sketch')}
            className={`py-2 px-1 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'sketch' ? 'bg-white text-farm-green shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" /> Sketch & Vertices
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('move')}
            className={`py-2 px-1 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'move' ? 'bg-white text-farm-green shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Move className="w-3.5 h-3.5" /> Move & Reposition
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: EDIT SIZE BY ACRES / HECTARES */}
          {activeTab === 'size' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Scale Total Area by Precise Measurement
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Type your desired target size in acres or hectares. The boundary will proportionally scale around its center point on the map.
                </p>
              </div>

              {/* Input + Unit Selector */}
              <div className="bg-stone-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                <label className="block text-xs font-bold text-gray-700">
                  Desired Target Area
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10000"
                    value={inputSize}
                    onChange={(e) => setInputSize(parseFloat(e.target.value) || 0)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-base font-bold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-farm-green/30 focus:border-farm-green"
                  />
                  <select
                    value={sizeUnit}
                    onChange={(e) => setSizeUnit(e.target.value as AreaUnit)}
                    className="px-3 py-2.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-800 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-farm-green/30"
                  >
                    <option value="acres">Acres (ac)</option>
                    <option value="hectares">Hectares (ha)</option>
                    <option value="sqMeters">Square Meters (m²)</option>
                  </select>
                </div>

                {/* Conversion Equivalent Preview */}
                <div className="text-xs text-gray-500 flex items-center justify-between pt-1">
                  <span>Equivalents:</span>
                  <div className="font-semibold text-gray-800 flex items-center gap-2">
                    <span>
                      {sizeUnit === 'acres'
                        ? `${acresToHectares(inputSize)} ha`
                        : `${hectaresToAcres(inputSize)} ac`}
                    </span>
                    <span>•</span>
                    <span>
                      {sizeUnit === 'sqMeters'
                        ? `${inputSize.toLocaleString()} m²`
                        : `${Math.round((sizeUnit === 'hectares' ? hectaresToAcres(inputSize) : inputSize) * 4046.86).toLocaleString()} m²`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Preset Multipliers */}
              <div>
                <span className="text-xs font-bold text-gray-600 block mb-2">Quick Adjustment Multipliers:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: '-25%', mult: 0.75 },
                    { label: '-10%', mult: 0.90 },
                    { label: '+10%', mult: 1.10 },
                    { label: '+25%', mult: 1.25 },
                    { label: 'Double (2×)', mult: 2.00 },
                  ].map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setInputSize(Math.round(inputSize * p.mult * 100) / 100)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-stone-50 text-xs font-bold text-gray-700 transition-colors cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Child plot scaling checkbox (if farm selected) */}
              {isFarmSelected && zones.length > 0 && (
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scaleChildPlots}
                    onChange={(e) => setScaleChildPlots(e.target.checked)}
                    className="w-4 h-4 text-farm-green rounded focus:ring-farm-green cursor-pointer"
                  />
                  <div className="text-xs text-emerald-900 font-semibold">
                    <span>Scale all {zones.length} internal field plots proportionally with the farm boundary</span>
                  </div>
                </label>
              )}

              <button
                type="button"
                onClick={handleApplySizeScale}
                className="w-full bg-farm-green hover:bg-farm-green-dark text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <Check className="w-4 h-4" />
                Apply Size Scaling to Map
              </button>
            </div>
          )}

          {/* TAB 2: RECTANGLE (WIDTH & HEIGHT CONTROLS) */}
          {activeTab === 'rectangle' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Configure Exact Rectangle Dimensions
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Adjust the width and height of the rectangle in meters. The plot will center automatically around its current location.
                </p>
              </div>

              {/* Width Slider & Input */}
              <div className="bg-stone-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700">Width (East - West)</label>
                  <span className="text-xs font-extrabold text-blue-700">{rectWidth} meters ({Math.round(rectWidth * 3.28084)} ft)</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="20"
                    max="2000"
                    step="10"
                    value={rectWidth}
                    onChange={(e) => setRectWidth(parseInt(e.target.value) || 20)}
                    className="flex-1 accent-farm-green cursor-pointer"
                  />
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    step="10"
                    value={rectWidth}
                    onChange={(e) => setRectWidth(parseInt(e.target.value) || 20)}
                    className="w-24 px-2 py-1.5 rounded-lg border border-gray-300 text-xs font-bold text-right"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button type="button" onClick={() => setRectWidth(Math.max(20, rectWidth - 50))} className="px-2 py-0.5 rounded border bg-white hover:bg-stone-100">-50m</button>
                  <button type="button" onClick={() => setRectWidth(Math.max(20, rectWidth - 10))} className="px-2 py-0.5 rounded border bg-white hover:bg-stone-100">-10m</button>
                  <button type="button" onClick={() => setRectWidth(rectWidth + 10)} className="px-2 py-0.5 rounded border bg-white hover:bg-stone-100">+10m</button>
                  <button type="button" onClick={() => setRectWidth(rectWidth + 50)} className="px-2 py-0.5 rounded border bg-white hover:bg-stone-100">+50m</button>
                </div>
              </div>

              {/* Height Slider & Input */}
              <div className="bg-stone-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700">Height (North - South)</label>
                  <span className="text-xs font-extrabold text-blue-700">{rectHeight} meters ({Math.round(rectHeight * 3.28084)} ft)</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="20"
                    max="2000"
                    step="10"
                    value={rectHeight}
                    onChange={(e) => setRectHeight(parseInt(e.target.value) || 20)}
                    className="flex-1 accent-farm-green cursor-pointer"
                  />
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    step="10"
                    value={rectHeight}
                    onChange={(e) => setRectHeight(parseInt(e.target.value) || 20)}
                    className="w-24 px-2 py-1.5 rounded-lg border border-gray-300 text-xs font-bold text-right"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button type="button" onClick={() => setRectHeight(Math.max(20, rectHeight - 50))} className="px-2 py-0.5 rounded border bg-white hover:bg-stone-100">-50m</button>
                  <button type="button" onClick={() => setRectHeight(Math.max(20, rectHeight - 10))} className="px-2 py-0.5 rounded border bg-white hover:bg-stone-100">-10m</button>
                  <button type="button" onClick={() => setRectHeight(rectHeight + 10)} className="px-2 py-0.5 rounded border bg-white hover:bg-stone-100">+10m</button>
                  <button type="button" onClick={() => setRectHeight(rectHeight + 50)} className="px-2 py-0.5 rounded border bg-white hover:bg-stone-100">+50m</button>
                </div>
              </div>

              {/* Calculated Area Box */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between text-xs">
                <span className="text-amber-900 font-bold">Resulting Area:</span>
                <span className="text-amber-950 font-extrabold text-sm">
                  {((rectWidth * rectHeight) / 4046.86).toFixed(2)} acres ({((rectWidth * rectHeight) / 10000).toFixed(2)} ha)
                </span>
              </div>

              <button
                type="button"
                onClick={handleApplyRectangle}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <Square className="w-4 h-4" />
                Apply Rectangle to Map
              </button>
            </div>
          )}

          {/* TAB 3: SKETCH & VERTEX EDITING */}
          {activeTab === 'sketch' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Sketch Freeform Shape or Drag Vertices
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Sketch any custom shape or organic polygon using your mouse, drag corner pins, or insert new corner points along any edge.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Freehand Mouse Sketch */}
                <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-2 shadow-xs">
                      <Edit3 className="w-5 h-5" />
                    </div>
                    <div className="font-bold text-xs text-emerald-950">✏️ Freehand Mouse Sketch</div>
                    <div className="text-[11px] text-emerald-800 mt-1">
                      Hold down left mouse button and draw any organic terrain boundary (curved contours, non-rectangles).
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onStartDrawingTool('freehand', isFarmSelected ? 'farm_boundary' : 'field');
                      onClose();
                      toast('Hold left click on map and sketch the shape outline with your mouse', { icon: '✏️' });
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
                  >
                    Start Freehand Sketch
                  </button>
                </div>

                {/* 2. Point-by-Point Polygon */}
                <div className="p-4 rounded-2xl border border-gray-200 bg-stone-50 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-2">
                      <Edit3 className="w-5 h-5" />
                    </div>
                    <div className="font-bold text-xs text-gray-900">Point-by-Point Polygon</div>
                    <div className="text-[11px] text-gray-500 mt-1">
                      Click consecutive points on the satellite map to trace any custom multi-sided polygon.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onStartDrawingTool('polygon', isFarmSelected ? 'farm_boundary' : 'field');
                      onClose();
                      toast('Click on map to place polygon points. Click start to finish.', { icon: '📐' });
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    Start Point-by-Point
                  </button>
                </div>

                {/* 3. Corner Pins & Edge Midpoint Handles */}
                <div className="p-4 rounded-2xl border border-gray-200 bg-stone-50 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center mb-2">
                      <Maximize2 className="w-5 h-5" />
                    </div>
                    <div className="font-bold text-xs text-gray-900">Draggable Pins &amp; Edge Handles</div>
                    <div className="text-[11px] text-gray-500 mt-1">
                      Shows round corner pins + blue &quot;+&quot; edge handles. Drag any edge to insert new corners and reshape contours.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleVertexEditing();
                      toast.success(isEditingVertices ? 'Vertex handles hidden' : 'Vertex handles & edge pins active on map!');
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                      isEditingVertices
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-gray-300 text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    {isEditingVertices ? '✓ Vertex & Edge Pins Active' : 'Enable Vertex & Edge Pins'}
                  </button>
                </div>

                {/* 4. Direct Mouse Scale Resize Handle */}
                <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center mb-2">
                      <span className="text-base font-bold">↔</span>
                    </div>
                    <div className="font-bold text-xs text-amber-950">Direct Mouse Scale Handle</div>
                    <div className="text-[11px] text-amber-800 mt-1">
                      Shows an amber ↔ handle on map. Drag outward to expand area or inward to shrink area with your mouse.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleResizeMode?.();
                      toast.success(isResizeMode ? 'Scale handle hidden' : 'Scale handle active! Drag ↔ pin to resize.');
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                      isResizeMode
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white border border-amber-300 text-amber-900 hover:bg-amber-100'
                    }`}
                  >
                    {isResizeMode ? '✓ Scale Handle Active' : 'Enable Mouse Scale Handle'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MOVE & REPOSITION AROUND MAP */}
          {activeTab === 'move' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Move & Reposition Area
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Drag the central move handle on the satellite map, or use the directional compass buttons below to nudge the area in precise increments.
                </p>
              </div>

              {/* Move Handle Toggle */}
              <div className="p-3 bg-stone-50 rounded-xl border border-gray-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-gray-900">Map Center Move Pin</div>
                  <div className="text-[11px] text-gray-500">Shows a central ✥ icon on the map to drag and relocate</div>
                </div>
                <button
                  type="button"
                  onClick={onToggleMoveMode}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    isMoveMode
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-stone-100'
                  }`}
                >
                  {isMoveMode ? '✓ Move Pin Active' : 'Enable Move Pin'}
                </button>
              </div>

              {/* Directional Nudge D-Pad */}
              <div className="bg-stone-50 p-4 rounded-2xl border border-gray-200 text-center space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">Directional Nudge</span>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-gray-400">Step:</span>
                    {[5, 20, 50, 100].map((step) => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => setMoveStepMeters(step)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                          moveStepMeters === step
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-stone-100'
                        }`}
                      >
                        {step}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Compass Buttons */}
                <div className="flex flex-col items-center gap-1.5 pt-2">
                  <button
                    type="button"
                    onClick={() => handleNudge('N')}
                    className="w-28 py-2 px-3 rounded-xl bg-white border border-gray-200 hover:bg-stone-100 text-xs font-bold text-gray-800 flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <ArrowUp className="w-3.5 h-3.5" /> North ({moveStepMeters}m)
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleNudge('W')}
                      className="w-24 py-2 px-3 rounded-xl bg-white border border-gray-200 hover:bg-stone-100 text-xs font-bold text-gray-800 flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> West
                    </button>
                    <div className="w-10 h-10 rounded-xl bg-stone-200 flex items-center justify-center text-xs font-bold text-gray-600">
                      ✥
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNudge('E')}
                      className="w-24 py-2 px-3 rounded-xl bg-white border border-gray-200 hover:bg-stone-100 text-xs font-bold text-gray-800 flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                    >
                      East <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNudge('S')}
                    className="w-28 py-2 px-3 rounded-xl bg-white border border-gray-200 hover:bg-stone-100 text-xs font-bold text-gray-800 flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <ArrowDown className="w-3.5 h-3.5" /> South ({moveStepMeters}m)
                  </button>
                </div>

                {isFarmSelected && zones.length > 0 && (
                  <label className="flex items-center justify-center gap-2 pt-2 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={movePlotsWithFarm}
                      onChange={(e) => setMovePlotsWithFarm(e.target.checked)}
                      className="w-3.5 h-3.5 text-blue-600 rounded"
                    />
                    <span>Move all internal plots along with farm boundary</span>
                  </label>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-100 bg-stone-50 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Selected: <strong className="text-gray-900">{isFarmSelected ? `Farm Boundary (${farmName})` : zones[activeTargetIndex]?.name}</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
          >
            Done Editing
          </button>
        </div>
      </div>
    </div>
  );
}
