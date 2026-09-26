import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  Marker,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Layers,
  Eye,
  Maximize2,
  Crosshair,
  AlertTriangle,
  Check,
  Undo2,
  X,
  Plus,
  HelpCircle,
  Sun,
  CloudSun,
  Flame,
  CloudRain,
  Waves,
  Sliders,
} from 'lucide-react';
import type { ZoneInput, FieldStressState } from '../../types';
import { CROP_EMOJIS } from '../../types';
import type { WeatherData } from '../../services/weather';
import {
  calculatePolygonArea,
  calculatePerimeter,
  getFieldVisualStyles,
  getFieldStressState,
  isPolygonInsidePolygon,
  doPolygonsOverlap,
  generateRectanglePolygon,
  generateCirclePolygon,
  getPolygonCenter,
  getPolygonBounds,
} from '../../services/mapGeometry';

// Leaflet default marker icon setup for Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom vertex pin icon for interactive editing
const vertexIcon = L.divIcon({
  className: 'custom-vertex-pin',
  html: `<div style="width: 14px; height: 14px; background: #ffffff; border: 3px solid #2563eb; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: grab;"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export type DrawingTool = 'none' | 'polygon' | 'rectangle' | 'circle';
export type DrawingTarget = 'farm_boundary' | 'field';
export type BaseMapLayer = 'satellite' | 'streets' | 'topo';
export type FieldViewMode = 'health' | 'crops' | 'moisture';
export type MapVisualizationMode = 'real_weather' | 'simulation' | 'standard';

export interface DigitalFarmMapProps {
  farmName: string;
  center: [number, number];
  farmBoundary?: [number, number][];
  zones: ZoneInput[];
  selectedZoneIndex: number | null;
  drawingTool?: DrawingTool;
  drawingTarget?: DrawingTarget;
  activeLayer?: BaseMapLayer;
  viewMode?: FieldViewMode;
  isEditingVertices?: boolean;
  onSelectZone?: (index: number | null) => void;
  onUpdateFarmBoundary?: (coords: [number, number][], shape: 'polygon' | 'rectangle' | 'circle') => void;
  onAddFieldWithGeometry?: (coords: [number, number][], shape: 'polygon' | 'rectangle' | 'circle') => void;
  onUpdateZoneBoundary?: (zoneIndex: number, coords: [number, number][]) => void;
  onCancelDrawing?: () => void;
  onValidationWarning?: (warning: string | null) => void;
  // Simulation specific props:
  simulatedWeatherCondition?: 'normal' | 'drought' | 'heatwave' | 'flood' | 'rain';
  simulatedTimestepLabel?: string;
  simulatedTemperature?: number;
  simulatedRainfall?: number;
  // Live Weather specific props:
  liveWeather?: WeatherData | null;
  activeVisualizationMode?: MapVisualizationMode;
  onToggleVisualizationMode?: (mode: MapVisualizationMode) => void;
}

// Inner helper component to pan/fit bounds dynamically
function MapAutoCentering({
  center,
  farmBoundary,
  focusZoneCoords,
}: {
  center: [number, number];
  farmBoundary?: [number, number][];
  focusZoneCoords?: [number, number][];
}) {
  const map = useMap();
  const prevFocusRef = useRef<string | null>(null);

  useEffect(() => {
    if (focusZoneCoords && focusZoneCoords.length >= 3) {
      const key = JSON.stringify(focusZoneCoords[0]);
      if (key !== prevFocusRef.current) {
        prevFocusRef.current = key;
        const bounds = getPolygonBounds(focusZoneCoords);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18, animate: true });
      }
    } else if (farmBoundary && farmBoundary.length >= 3 && !prevFocusRef.current) {
      const bounds = getPolygonBounds(farmBoundary);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
    } else if (center) {
      map.setView(center, map.getZoom() || 15);
    }
  }, [farmBoundary, focusZoneCoords, center, map]);

  return null;
}

// Map event listener component for drawing and mouse tracking
function MapDrawingController({
  drawingTool,
  drawingTarget,
  farmBoundary,
  zones,
  onComplete,
  onCancel,
  onValidationWarning,
}: {
  drawingTool: DrawingTool;
  drawingTarget: DrawingTarget;
  farmBoundary?: [number, number][];
  zones: ZoneInput[];
  onComplete: (coords: [number, number][], shape: 'polygon' | 'rectangle' | 'circle') => void;
  onCancel: () => void;
  onValidationWarning: (warning: string | null) => void;
}) {
  const [points, setPoints] = useState<[number, number][]>([]);
  const [cursorPos, setCursorPos] = useState<[number, number] | null>(null);
  const [circleCenter, setCircleCenter] = useState<[number, number] | null>(null);
  const [rectCorner1, setRectCorner1] = useState<[number, number] | null>(null);

  // Clear drawing state when tool changes
  useEffect(() => {
    setPoints([]);
    setCursorPos(null);
    setCircleCenter(null);
    setRectCorner1(null);
    onValidationWarning(null);
  }, [drawingTool, drawingTarget]);

  useMapEvents({
    mousemove(e) {
      if (drawingTool !== 'none') {
        setCursorPos([e.latlng.lat, e.latlng.lng]);
      }
    },
    click(e) {
      if (drawingTool === 'none') return;
      const clickedPt: [number, number] = [e.latlng.lat, e.latlng.lng];

      if (drawingTool === 'polygon') {
        // If clicking near first point (closure threshold)
        if (points.length >= 3) {
          const first = points[0];
          const dist = Math.hypot(first[0] - clickedPt[0], first[1] - clickedPt[1]);
          if (dist < 0.0003) {
            validateAndFinish(points, 'polygon');
            return;
          }
        }
        setPoints((prev) => [...prev, clickedPt]);
      } else if (drawingTool === 'rectangle') {
        if (!rectCorner1) {
          setRectCorner1(clickedPt);
        } else {
          const rectCoords = generateRectanglePolygon(rectCorner1, clickedPt);
          validateAndFinish(rectCoords, 'rectangle');
        }
      } else if (drawingTool === 'circle') {
        if (!circleCenter) {
          setCircleCenter(clickedPt);
        } else {
          const radiusM = calculatePerimeter([circleCenter, clickedPt]).meters;
          const circleCoords = generateCirclePolygon(circleCenter, radiusM);
          validateAndFinish(circleCoords, 'circle');
        }
      }
    },
  });

  const validateAndFinish = (
    coords: [number, number][],
    shape: 'polygon' | 'rectangle' | 'circle'
  ) => {
    if (coords.length < 3) {
      onValidationWarning('Area must have at least 3 points.');
      return;
    }

    // If drawing a field, validate containment inside farm boundary
    if (drawingTarget === 'field' && farmBoundary && farmBoundary.length >= 3) {
      const containment = isPolygonInsidePolygon(coords, farmBoundary);
      if (!containment.inside) {
        onValidationWarning(
          `Warning: Field extends outside the farm boundary (${containment.outsideCount} vertices outside).`
        );
      }
    }

    // Check overlap with existing fields
    if (drawingTarget === 'field') {
      for (const z of zones) {
        if (z.boundary && z.boundary.length >= 3) {
          if (doPolygonsOverlap(coords, z.boundary)) {
            onValidationWarning(`Warning: Field overlaps with existing parcel "${z.name}".`);
            break;
          }
        }
      }
    }

    onComplete(coords, shape);
    setPoints([]);
    setCursorPos(null);
    setCircleCenter(null);
    setRectCorner1(null);
  };

  // Preview coordinates calculation
  const previewCoords: [number, number][] = useMemo(() => {
    if (drawingTool === 'polygon') {
      if (points.length > 0 && cursorPos) {
        return [...points, cursorPos];
      }
      return points;
    }
    if (drawingTool === 'rectangle' && rectCorner1 && cursorPos) {
      return generateRectanglePolygon(rectCorner1, cursorPos);
    }
    if (drawingTool === 'circle' && circleCenter && cursorPos) {
      const radiusM = calculatePerimeter([circleCenter, cursorPos]).meters;
      return generateCirclePolygon(circleCenter, radiusM);
    }
    return [];
  }, [drawingTool, points, cursorPos, rectCorner1, circleCenter]);

  if (drawingTool === 'none') return null;

  return (
    <>
      {/* Dynamic line connecting existing points and cursor */}
      {previewCoords.length >= 2 && (
        <Polyline
          positions={previewCoords}
          pathOptions={{
            color: drawingTarget === 'farm_boundary' ? '#eab308' : '#22c55e',
            dashArray: '5 5',
            weight: 2,
          }}
        />
      )}

      {/* Dynamic closed polygon preview if enough vertices */}
      {previewCoords.length >= 3 && (
        <Polygon
          positions={previewCoords}
          pathOptions={{
            color: drawingTarget === 'farm_boundary' ? '#eab308' : '#22c55e',
            fillColor: drawingTarget === 'farm_boundary' ? '#fef08a' : '#bbf7d0',
            fillOpacity: 0.25,
            weight: 2,
          }}
        />
      )}

      {/* Placed vertex pins */}
      {points.map((pt, idx) => (
        <Marker
          key={idx}
          position={pt}
          icon={vertexIcon}
          eventHandlers={{
            click: (e) => {
              if (idx === 0 && points.length >= 3) {
                L.DomEvent.stopPropagation(e);
                validateAndFinish(points, 'polygon');
              }
            },
          }}
        >
          {idx === 0 && points.length >= 3 && (
            <Tooltip permanent direction="top" offset={[0, -10]}>
              <span className="text-[11px] font-bold text-emerald-800">Click to close shape</span>
            </Tooltip>
          )}
        </Marker>
      ))}

      {/* Floating Drawing Helper Pill */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[900] bg-gray-900/95 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 text-xs border border-white/20 backdrop-blur-md">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>
          {drawingTool === 'polygon' &&
            (points.length === 0
              ? 'Click to start boundary'
              : points.length < 3
              ? `Click to add point (${points.length})`
              : 'Click first point or double-click to finish')}
          {drawingTool === 'rectangle' &&
            (!rectCorner1 ? 'Click first corner' : 'Click opposite corner to finish')}
          {drawingTool === 'circle' &&
            (!circleCenter ? 'Click center point' : 'Click edge to set radius')}
        </span>
        {points.length >= 3 && (
          <button
            type="button"
            onClick={() => validateAndFinish(points, 'polygon')}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors flex items-center gap-1 shadow-sm"
          >
            <Check className="w-3.5 h-3.5" /> Finish
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors flex items-center gap-1"
          title="Cancel drawing"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
    </>
  );
}

export default function DigitalFarmMap({
  farmName,
  center,
  farmBoundary,
  zones,
  selectedZoneIndex,
  drawingTool = 'none',
  drawingTarget = 'field',
  activeLayer = 'satellite',
  viewMode = 'health',
  isEditingVertices = false,
  onSelectZone = () => {},
  onUpdateFarmBoundary = () => {},
  onAddFieldWithGeometry = () => {},
  onUpdateZoneBoundary = () => {},
  onCancelDrawing = () => {},
  onValidationWarning = () => {},
  simulatedWeatherCondition,
  simulatedTimestepLabel,
  simulatedTemperature,
  simulatedRainfall,
  liveWeather,
  activeVisualizationMode,
  onToggleVisualizationMode,
}: DigitalFarmMapProps) {
  // Visualization Mode State (Real Weather vs Simulation vs Standard)
  const [visMode, setVisMode] = useState<MapVisualizationMode>(
    activeVisualizationMode || (simulatedWeatherCondition ? 'simulation' : liveWeather ? 'real_weather' : 'standard')
  );

  useEffect(() => {
    if (activeVisualizationMode) {
      setVisMode(activeVisualizationMode);
    }
  }, [activeVisualizationMode]);

  // Legend Category State (Normal, Weather, Simulation)
  const [legendCategory, setLegendCategory] = useState<'normal' | 'weather' | 'simulation'>(
    visMode === 'simulation' ? 'simulation' : visMode === 'real_weather' ? 'weather' : 'normal'
  );

  useEffect(() => {
    if (visMode === 'simulation') setLegendCategory('simulation');
    else if (visMode === 'real_weather') setLegendCategory('weather');
    else setLegendCategory('normal');
  }, [visMode]);

  // Tile layer URL configurations
  const tileConfig = useMemo(() => {
    switch (activeLayer) {
      case 'satellite':
        return {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution: '&copy; Esri World Imagery, Maxar, USDA',
          maxZoom: 19,
        };
      case 'topo':
        return {
          url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
          attribution: '&copy; OpenTopoMap contributors',
          maxZoom: 17,
        };
      case 'streets':
      default:
        return {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        };
    }
  }, [activeLayer]);

  // Selected zone coordinates for map auto-focus
  const selectedZoneCoords = useMemo(() => {
    if (selectedZoneIndex !== null && zones[selectedZoneIndex]?.boundary) {
      return zones[selectedZoneIndex].boundary;
    }
    return undefined;
  }, [selectedZoneIndex, zones]);

  // Handle vertex dragging when in vertex edit mode
  const handleVertexDrag = (vertexIdx: number, newLatLng: L.LatLng) => {
    if (selectedZoneIndex !== null) {
      const targetZone = zones[selectedZoneIndex];
      if (targetZone?.boundary) {
        const updated = [...targetZone.boundary];
        updated[vertexIdx] = [newLatLng.lat, newLatLng.lng];
        onUpdateZoneBoundary(selectedZoneIndex, updated);
      }
    } else if (farmBoundary) {
      const updated = [...farmBoundary];
      updated[vertexIdx] = [newLatLng.lat, newLatLng.lng];
      onUpdateFarmBoundary(updated, 'polygon');
    }
  };

  // Real weather condition analysis
  const realWeatherAnalysis = useMemo(() => {
    if (!liveWeather) return null;
    const temp = liveWeather.temperature;
    const rain = liveWeather.rain ?? liveWeather.precipitation ?? 0;
    const humidity = liveWeather.humidity;
    const wind = liveWeather.windSpeed;
    const clouds = liveWeather.cloudCover;

    const isHeavyRain = rain >= 4.0 || (liveWeather.daily?.[0]?.precipitationSum ?? 0) >= 20;
    const isLightRain = rain > 0.1 && !isHeavyRain;
    const isFloodRisk = rain >= 18 || (liveWeather.daily?.[0]?.precipitationSum ?? 0) >= 30;
    const isHighTemp = temp >= 34;

    const avgZoneMoisture = zones.length > 0
      ? zones.reduce((s, z) => s + (z.soilMoisture || 60), 0) / zones.length
      : 60;
    const isDryConditions = avgZoneMoisture < 35 && rain < 0.5 && temp > 28;
    const isCloudy = clouds >= 45 && !isLightRain && !isHeavyRain;
    const isClear = !isCloudy && !isLightRain && !isHeavyRain && !isHighTemp && !isFloodRisk && !isDryConditions;

    let status = 'NORMAL';
    if (isFloodRisk) status = 'FLOOD RISK';
    else if (isHeavyRain) status = 'HEAVY RAIN';
    else if (isLightRain) status = 'LIGHT RAIN';
    else if (isHighTemp) status = 'HEAT STRESS';
    else if (isDryConditions) status = 'DRY CONDITIONS';
    else if (isCloudy) status = 'CLOUDY';
    else if (isClear) status = 'CLEAR / SUNNY';

    return {
      temp,
      rain,
      humidity,
      wind,
      clouds,
      isHeavyRain,
      isLightRain,
      isFloodRisk,
      isHighTemp,
      isDryConditions,
      isCloudy,
      isClear,
      status,
    };
  }, [liveWeather, zones]);

  const handleModeToggle = (mode: MapVisualizationMode) => {
    setVisMode(mode);
    onToggleVisualizationMode?.(mode);
  };

  return (
    <div className="relative w-full h-full min-h-[520px] rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-inner bg-stone-900">
      {/* ============================================================ */}
      {/* 1. REAL WEATHER VISUAL OVERLAYS (When Real Weather Mode Active) */}
      {/* ============================================================ */}
      {visMode === 'real_weather' && realWeatherAnalysis && (
        <>
          {/* CLEAR WEATHER: Subtle sunlight warmth wash */}
          {realWeatherAnalysis.isClear && (
            <div className="absolute inset-0 pointer-events-none z-[850] overflow-hidden">
              <div className="absolute -top-20 -right-20 w-[420px] h-[420px] rounded-full bg-amber-300/10 blur-3xl animate-sun-pulse"></div>
            </div>
          )}

          {/* CLOUDY: Slight cloud shadow overlay & reduced sunlight */}
          {realWeatherAnalysis.isCloudy && (
            <div className="absolute inset-0 pointer-events-none z-[850] bg-slate-500/12 backdrop-contrast-[0.96]"></div>
          )}

          {/* LIGHT RAIN: Delicate rain particle streaks */}
          {realWeatherAnalysis.isLightRain && (
            <div className="absolute inset-0 pointer-events-none z-[850] bg-blue-900/10 overflow-hidden animate-rainfall-light"></div>
          )}

          {/* HEAVY RAIN: Dense rain streaks & wet soil mist */}
          {realWeatherAnalysis.isHeavyRain && (
            <div className="absolute inset-0 pointer-events-none z-[850] bg-blue-950/20 overflow-hidden animate-rainfall-heavy">
              <div className="absolute inset-0 bg-blue-500/5 mix-blend-overlay"></div>
            </div>
          )}

          {/* HIGH TEMPERATURE: Subtle heat shimmer & warm overlay */}
          {realWeatherAnalysis.isHighTemp && (
            <div className="absolute inset-0 pointer-events-none z-[850] bg-gradient-to-t from-orange-500/15 via-amber-500/10 to-transparent mix-blend-color-burn animate-heat-shimmer">
              <div className="absolute top-20 right-4 bg-orange-600/95 text-white text-xs px-3 py-1.5 rounded-full font-bold shadow-md flex items-center gap-1.5 backdrop-blur-xs">
                <span>🌡️ Heat Warning: {realWeatherAnalysis.temp}°C</span>
              </div>
            </div>
          )}

          {/* FLOOD RISK: Blue water overlay, puddles, and water accumulation */}
          {realWeatherAnalysis.isFloodRisk && (
            <div className="absolute inset-0 pointer-events-none z-[850] bg-sky-800/25 mix-blend-multiply animate-water-ripple">
              <div className="absolute top-20 right-4 bg-cyan-700/95 text-white text-xs px-3 py-1.5 rounded-full font-bold shadow-md flex items-center gap-1.5 backdrop-blur-xs">
                <span>🌊 Flood Risk Warning • Water Accumulation</span>
              </div>
            </div>
          )}

          {/* DRY CONDITIONS: Dry soil & parched tint */}
          {realWeatherAnalysis.isDryConditions && (
            <div className="absolute inset-0 pointer-events-none z-[850] bg-amber-900/15 mix-blend-color-burn">
              <div className="absolute top-20 right-4 bg-amber-800/95 text-white text-xs px-3 py-1.5 rounded-full font-bold shadow-md flex items-center gap-1.5 backdrop-blur-xs">
                <span>🌵 Dry Conditions • Soil Moisture Deficit</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* 2. SIMULATION WEATHER VISUAL OVERLAYS (When Simulation Mode Active) */}
      {/* ============================================================ */}
      {visMode === 'simulation' && (
        <>
          {simulatedWeatherCondition === 'heatwave' && (
            <div className="absolute inset-0 pointer-events-none z-[850] bg-gradient-to-t from-orange-500/25 via-amber-500/15 to-transparent mix-blend-color-burn animate-pulse">
              <div className="absolute top-20 right-4 bg-orange-600/90 text-white text-xs px-3 py-1.5 rounded-full font-semibold shadow-md flex items-center gap-1.5 backdrop-blur-xs">
                <span>🔥 Heatwave Overlay Active</span>
                {simulatedTemperature !== undefined && <span>({simulatedTemperature}°C)</span>}
              </div>
            </div>
          )}

          {simulatedWeatherCondition === 'rain' && (
            <div className="absolute inset-0 pointer-events-none z-[850] bg-blue-900/15 overflow-hidden animate-rainfall-heavy">
              <div className="absolute top-20 right-4 bg-blue-600/90 text-white text-xs px-3 py-1.5 rounded-full font-semibold shadow-md flex items-center gap-1.5 backdrop-blur-xs">
                <span>🌧️ Simulated Rain Active</span>
                {simulatedRainfall !== undefined && <span>({simulatedRainfall} mm)</span>}
              </div>
            </div>
          )}

          {simulatedWeatherCondition === 'flood' && (
            <div className="absolute inset-0 pointer-events-none z-[850] bg-cyan-800/30 mix-blend-multiply animate-water-ripple">
              <div className="absolute top-20 right-4 bg-cyan-700/95 text-white text-xs px-3 py-1.5 rounded-full font-semibold shadow-md flex items-center gap-1.5 backdrop-blur-xs">
                <span>🌊 Simulated Inundation Event</span>
                {simulatedRainfall !== undefined && <span>({simulatedRainfall} mm)</span>}
              </div>
            </div>
          )}

          {simulatedWeatherCondition === 'drought' && (
            <div className="absolute inset-0 pointer-events-none z-[850] bg-amber-900/20 mix-blend-color-burn">
              <div className="absolute top-20 right-4 bg-amber-800/95 text-white text-xs px-3 py-1.5 rounded-full font-semibold shadow-md flex items-center gap-1.5 backdrop-blur-xs">
                <span>🌵 Simulated Drought • Desiccation Active</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* 3. LIVE CONDITIONS INDICATOR ON MAP (Top Left) */}
      {/* ============================================================ */}
      {liveWeather && (
        <div className="absolute top-4 left-4 z-[900] bg-gray-900/90 backdrop-blur-md text-white p-3 rounded-xl shadow-xl border border-white/20 text-xs w-48 transition-all hover:bg-gray-900/95">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/10">
            <div className="font-extrabold text-[11px] uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              LIVE CONDITIONS
            </div>
            <span className="text-base">{liveWeather.weatherEmoji}</span>
          </div>

          <div className="space-y-0.5 text-gray-200">
            <div className="text-base font-black text-white">{liveWeather.temperature}°C</div>
            <div className="text-[11px] text-gray-300">{liveWeather.humidity}% humidity</div>
            <div className="text-[11px] text-blue-300">{(liveWeather.rain || 0).toFixed(1)} mm rain</div>
            <div className="text-[11px] text-gray-300">{liveWeather.windSpeed} km/h wind</div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-white/10">
            <div className="text-[10px] text-gray-400 uppercase font-semibold">Weather status:</div>
            <div
              className={`font-bold text-xs mt-0.5 ${
                realWeatherAnalysis?.status === 'HEAT STRESS'
                  ? 'text-orange-400'
                  : realWeatherAnalysis?.status === 'FLOOD RISK'
                  ? 'text-cyan-400'
                  : realWeatherAnalysis?.status?.includes('RAIN')
                  ? 'text-blue-400'
                  : realWeatherAnalysis?.status === 'DRY CONDITIONS'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {realWeatherAnalysis?.status || 'NORMAL'}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. SEPARATE VISUALIZATION LAYERS TOGGLE (Top Right) */}
      {/* ============================================================ */}
      {(simulatedWeatherCondition !== undefined || liveWeather) && (
        <div className="absolute top-4 right-4 z-[900] bg-gray-900/90 backdrop-blur-md p-1 rounded-xl shadow-xl border border-white/20 flex items-center gap-1 text-xs">
          {liveWeather && (
            <button
              type="button"
              onClick={() => handleModeToggle('real_weather')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                visMode === 'real_weather'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Real Weather</span>
            </button>
          )}

          {simulatedWeatherCondition !== undefined && (
            <button
              type="button"
              onClick={() => handleModeToggle('simulation')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                visMode === 'simulation'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Simulated Weather</span>
              {simulatedTimestepLabel && (
                <span className="text-[10px] bg-amber-800/80 px-1 rounded ml-0.5">
                  {simulatedTimestepLabel}
                </span>
              )}
            </button>
          )}
        </div>
      )}

      <MapContainer
        center={center}
        zoom={16}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={true}
        doubleClickZoom={drawingTool === 'none'}
      >
        <TileLayer url={tileConfig.url} attribution={tileConfig.attribution} maxZoom={tileConfig.maxZoom} />

        <MapAutoCentering center={center} farmBoundary={farmBoundary} focusZoneCoords={selectedZoneCoords} />

        {/* 1. RENDER FARM BOUNDARY */}
        {farmBoundary && farmBoundary.length >= 3 && (
          <Polygon
            positions={farmBoundary}
            pathOptions={{
              color: '#f59e0b', // Amber/gold boundary
              weight: 3,
              dashArray: '6 6',
              fillColor: '#fef3c7',
              fillOpacity: 0.08,
            }}
          >
            <Tooltip permanent={false} direction="center" opacity={0.9}>
              <div className="text-xs font-semibold text-gray-800">
                🚜 {farmName} (Farm Boundary)
              </div>
            </Tooltip>
          </Polygon>
        )}

        {/* 2. RENDER FIELD PLOTS */}
        {zones.map((zone, idx) => {
          if (!zone.boundary || zone.boundary.length < 3) return null;
          const isSelected = selectedZoneIndex === idx;
          const isDimmed = selectedZoneIndex !== null && !isSelected;

          // Compute visual styles
          let styles = getFieldVisualStyles(zone, isSelected, isDimmed, viewMode);

          // Apply real weather or simulation adjustments if active
          if (visMode === 'real_weather' && realWeatherAnalysis) {
            if (realWeatherAnalysis.isFloodRisk) {
              styles = { ...styles, fillColor: '#0284c7', strokeColor: '#0369a1', dashArray: '4 4' };
            } else if (realWeatherAnalysis.isDryConditions) {
              styles = { ...styles, fillColor: '#a16207', strokeColor: '#78350f', dashArray: '5 3' };
            }
          }

          const areaCalc = calculatePolygonArea(zone.boundary);

          // Health, Disease, Pest risk labels
          const healthVal = Math.round(zone.healthScore ?? 75);
          const moistureVal = Math.round(zone.soilMoisture);
          const tempVal = (zone.temperature ?? 28).toFixed(1);
          const diseaseLabel = (zone.diseaseRisk ?? 15) < 25 ? 'Low' : (zone.diseaseRisk ?? 15) < 55 ? 'Medium' : 'High';
          const pestLabel = (zone.pestRisk ?? 15) < 25 ? 'Low' : (zone.pestRisk ?? 15) < 55 ? 'Medium' : 'High';

          return (
            <Polygon
              key={zone.id || idx}
              positions={zone.boundary}
              eventHandlers={{
                click: () => {
                  if (drawingTool === 'none') {
                    onSelectZone(isSelected ? null : idx);
                  }
                },
              }}
              pathOptions={{
                color: styles.strokeColor,
                fillColor: styles.fillColor,
                fillOpacity: styles.fillOpacity,
                weight: styles.weight,
                dashArray: styles.dashArray,
              }}
            >
              <Tooltip sticky={true} opacity={0.97} className="custom-field-tooltip">
                <div className="p-2 min-w-[170px] text-xs font-sans text-gray-800">
                  <div className="font-extrabold text-sm uppercase tracking-wide text-gray-900 border-b border-gray-100 pb-1 mb-1.5 flex items-center justify-between">
                    <span>{zone.name}</span>
                    <span>{(CROP_EMOJIS as any)[zone.crop] || '🌱'}</span>
                  </div>
                  <div className="font-semibold text-emerald-800 text-[13px] mb-1">
                    {zone.crop} • {areaCalc.acres} acres
                  </div>
                  <div className="space-y-0.5 text-gray-600 text-[11px] pt-1 border-t border-gray-100">
                    <div><span className="font-medium text-gray-700">Soil:</span> {zone.soilType}</div>
                    <div><span className="font-medium text-gray-700">Crop Health:</span> <b className="text-emerald-700">{healthVal}%</b></div>
                    <div><span className="font-medium text-gray-700">Soil Moisture:</span> <b className="text-blue-700">{moistureVal}%</b></div>
                    <div><span className="font-medium text-gray-700">Temperature:</span> {tempVal}°C</div>
                    {(zone as any).waterStress !== undefined && (
                      <div><span className="font-medium text-gray-700">Water Stress:</span> <b className={(zone as any).waterStress > 40 ? 'text-amber-600' : 'text-emerald-600'}>{(zone as any).waterStress}%</b></div>
                    )}
                    {(zone as any).yieldPotential !== undefined && (
                      <div><span className="font-medium text-gray-700">Yield Potential:</span> <b className="text-purple-700">{(zone as any).yieldPotential}%</b></div>
                    )}
                    <div><span className="font-medium text-gray-700">Disease Risk:</span> <b className={diseaseLabel === 'High' ? 'text-red-600' : diseaseLabel === 'Medium' ? 'text-amber-600' : 'text-emerald-600'}>{diseaseLabel}</b></div>
                    <div><span className="font-medium text-gray-700">Pest Risk:</span> <b className={pestLabel === 'High' ? 'text-red-600' : pestLabel === 'Medium' ? 'text-amber-600' : 'text-emerald-600'}>{pestLabel}</b></div>
                  </div>
                </div>
              </Tooltip>
            </Polygon>
          );
        })}

        {/* 3. VERTEX EDIT HANDLERS (when in vertex editing mode) */}
        {isEditingVertices && (
          <>
            {selectedZoneIndex !== null && zones[selectedZoneIndex]?.boundary && (
              zones[selectedZoneIndex].boundary!.map((pt, vIdx) => (
                <Marker
                  key={`zone-vert-${vIdx}`}
                  position={pt}
                  icon={vertexIcon}
                  draggable={true}
                  eventHandlers={{
                    dragend(e) {
                      handleVertexDrag(vIdx, e.target.getLatLng());
                    },
                  }}
                />
              ))
            )}

            {selectedZoneIndex === null && farmBoundary && (
              farmBoundary.map((pt, vIdx) => (
                <Marker
                  key={`farm-vert-${vIdx}`}
                  position={pt}
                  icon={vertexIcon}
                  draggable={true}
                  eventHandlers={{
                    dragend(e) {
                      handleVertexDrag(vIdx, e.target.getLatLng());
                    },
                  }}
                />
              ))
            )}
          </>
        )}

        {/* 4. ACTIVE DRAWING CONTROLLER */}
        <MapDrawingController
          drawingTool={drawingTool}
          drawingTarget={drawingTarget}
          farmBoundary={farmBoundary}
          zones={zones}
          onComplete={(coords, shape) => {
            if (drawingTarget === 'farm_boundary') {
              onUpdateFarmBoundary(coords, shape);
            } else {
              onAddFieldWithGeometry(coords, shape);
            }
          }}
          onCancel={onCancelDrawing}
          onValidationWarning={onValidationWarning}
        />
      </MapContainer>

      {/* ============================================================ */}
      {/* 5. ADAPTIVE MAP LEGEND (Bottom Left) */}
      {/* ============================================================ */}
      <div className="absolute bottom-4 left-4 z-[900] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 text-xs max-w-md">
        {/* Legend Header & Tab Switcher */}
        <div className="flex items-center justify-between gap-3 pb-1.5 mb-1.5 border-b border-gray-100 dark:border-gray-800">
          <div className="font-bold text-gray-800 dark:text-gray-200 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
            <span>Map Legend</span>
            <span className="text-gray-400">•</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
              {legendCategory === 'weather' ? 'Weather View' : legendCategory === 'simulation' ? 'Simulation View' : 'Normal Field View'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <button
              type="button"
              onClick={() => setLegendCategory('normal')}
              className={`px-2 py-0.5 rounded font-semibold transition-all cursor-pointer ${
                legendCategory === 'normal' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => setLegendCategory('weather')}
              className={`px-2 py-0.5 rounded font-semibold transition-all cursor-pointer ${
                legendCategory === 'weather' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Weather
            </button>
            <button
              type="button"
              onClick={() => setLegendCategory('simulation')}
              className={`px-2 py-0.5 rounded font-semibold transition-all cursor-pointer ${
                legendCategory === 'simulation' ? 'bg-amber-600 text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Simulation
            </button>
          </div>
        </div>

        {/* Normal Legend */}
        {legendCategory === 'normal' && (
          <div className="space-y-1 text-[11px]">
            <div className="flex items-center gap-2 flex-wrap text-gray-600 dark:text-gray-300">
              <span className="font-semibold text-gray-500 text-[10px]">Crop Health:</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Healthy (80%+)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-lime-400"></span> Moderate</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> Stress</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-600"></span> Severe</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-gray-600 dark:text-gray-300 pt-0.5 border-t border-gray-100 dark:border-gray-800">
              <span className="font-semibold text-gray-500 text-[10px]">Soil Moisture:</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-700"></span> Dry (&lt;35%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-600"></span> Optimal</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-sky-500"></span> Saturated (&gt;80%)</span>
            </div>
          </div>
        )}

        {/* Weather Legend */}
        {legendCategory === 'weather' && (
          <div className="space-y-1 text-[11px]">
            <div className="flex items-center gap-2 flex-wrap text-gray-600 dark:text-gray-300">
              <span className="font-semibold text-gray-500 text-[10px]">Rain:</span>
              <span className="flex items-center gap-1">🌦️ Light Rain (&lt;2.5 mm)</span>
              <span className="flex items-center gap-1">🌧️ Heavy Rain (&gt;4.0 mm)</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-gray-600 dark:text-gray-300 pt-0.5 border-t border-gray-100 dark:border-gray-800">
              <span className="font-semibold text-gray-500 text-[10px]">Temp &amp; Flood:</span>
              <span className="flex items-center gap-1 text-orange-600 font-medium">🌡️ Heat Shimmer (&gt;34°C)</span>
              <span className="flex items-center gap-1 text-sky-600 font-medium">🌊 Flood Risk</span>
              <span className="flex items-center gap-1 text-amber-700 font-medium">🌵 Dry Soil</span>
            </div>
          </div>
        )}

        {/* Simulation Legend */}
        {legendCategory === 'simulation' && (
          <div className="space-y-1 text-[11px]">
            <div className="flex items-center gap-2 flex-wrap text-gray-600 dark:text-gray-300">
              <span className="font-semibold text-gray-500 text-[10px]">Simulation Stress:</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-800"></span> 🌵 Drought</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-orange-600"></span> 🔥 Heat Stress</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-sky-500"></span> 🌊 Flooded</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-gray-600 dark:text-gray-300 pt-0.5 border-t border-gray-100 dark:border-gray-800">
              <span className="font-semibold text-gray-500 text-[10px]">Water Level:</span>
              <span className="flex items-center gap-1 text-amber-700">Depleted (&lt;25%)</span>
              <span className="flex items-center gap-1 text-blue-600">Saturated (&gt;85%)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
