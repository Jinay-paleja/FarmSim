import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  Marker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Undo2,
  X,
  MapPin,
  Search,
  CheckCircle2,
  Square,
  RotateCcw,
  Sparkles,
  HelpCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { calculatePolygonArea, calculatePerimeter } from '../../services/mapGeometry';
import { geocodeLocation } from '../../services/geocoding';
import toast from 'react-hot-toast';

// Leaflet default marker icon fix for Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function createNumberedIcon(num: number) {
  return L.divIcon({
    className: 'boundary-marker-icon',
    html: `<div style="
      width: 28px; height: 28px;
      background: #15803d;
      color: #fff;
      border: 2.5px solid #fff;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700;
      cursor: grab;
    ">${num}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export interface BoundaryMapPickerProps {
  points: [number, number][];
  onPointsChange: (points: [number, number][]) => void;
  locationQuery: string;
  enteredAreaAcres: number;
  initialCenter?: [number, number];
  onLocationFound?: (locationName: string, coords: [number, number]) => void;
}

/** Handles map click events to add points */
function MapClickHandler({ onAdd }: { onAdd: (latlng: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      onAdd([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

/** Exposes map controller to parent */
function MapFlyController({
  targetCenter,
  zoom = 15,
}: {
  targetCenter?: [number, number];
  zoom?: number;
}) {
  const map = useMap();
  const prevCenter = useRef<string>('');

  useEffect(() => {
    if (!targetCenter) return;
    const key = `${targetCenter[0]},${targetCenter[1]}`;
    if (key === prevCenter.current) return;
    prevCenter.current = key;
    map.flyTo(targetCenter, zoom, { duration: 1.2 });
  }, [targetCenter, zoom, map]);

  return null;
}

/** Automatically fits map bounds when points change */
function MapAutoFit({ points }: { points: [number, number][] }) {
  const map = useMap();
  const prevLen = useRef(0);

  useEffect(() => {
    if (points.length >= 3 && Math.abs(points.length - prevLen.current) > 1) {
      const bounds = L.latLngBounds(points.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
    }
    prevLen.current = points.length;
  }, [points, map]);

  return null;
}

export default function BoundaryMapPicker({
  points,
  onPointsChange,
  locationQuery,
  enteredAreaAcres,
  initialCenter,
  onLocationFound,
}: BoundaryMapPickerProps) {
  const [searchInput, setSearchInput] = useState(locationQuery || '');
  const [isSearching, setIsSearching] = useState(false);
  const [flyTarget, setFlyTarget] = useState<[number, number] | undefined>(initialCenter);
  const [foundPlaceName, setFoundPlaceName] = useState<string | null>(null);

  const defaultCenter: [number, number] = initialCenter || [30.9010, 75.8573];

  // Sync external location query
  useEffect(() => {
    if (locationQuery && locationQuery !== searchInput) {
      setSearchInput(locationQuery);
    }
  }, [locationQuery]);

  const handleSearchLocation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchInput.trim() || searchInput.trim().length < 2) return;

    setIsSearching(true);
    try {
      const result = await geocodeLocation(searchInput.trim());
      if (result) {
        setFlyTarget([result.lat, result.lng]);
        setFoundPlaceName(result.displayName);
        if (onLocationFound) {
          onLocationFound(result.displayName, [result.lat, result.lng]);
        }
        toast.success(`Found: ${result.displayName.slice(0, 40)}...`);
      } else {
        toast.error('Location not found. Try entering a nearby town or district.');
      }
    } catch {
      toast.error('Could not search location. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddPoint = useCallback((latlng: [number, number]) => {
    onPointsChange([
      ...points,
      [
        Math.round(latlng[0] * 1000000) / 1000000,
        Math.round(latlng[1] * 1000000) / 1000000,
      ],
    ]);
  }, [points, onPointsChange]);

  const handleDragEnd = useCallback((index: number, latlng: L.LatLng) => {
    const updated = [...points];
    updated[index] = [
      Math.round(latlng.lat * 1000000) / 1000000,
      Math.round(latlng.lng * 1000000) / 1000000,
    ];
    onPointsChange(updated);
  }, [points, onPointsChange]);

  const handleUndo = useCallback(() => {
    if (points.length > 0) {
      onPointsChange(points.slice(0, -1));
    }
  }, [points, onPointsChange]);

  const handleClear = useCallback(() => {
    onPointsChange([]);
  }, [onPointsChange]);

  // Quick 1-click standard field box centered on current view
  const handleDropSimpleBox = () => {
    const center = flyTarget || (points.length > 0 ? points[0] : defaultCenter);
    const targetAcres = enteredAreaAcres > 0 ? enteredAreaAcres : 10;
    
    // Compute square box matching the target acreage
    const sideM = Math.sqrt(targetAcres * 4046.86) / 2;
    const dLat = sideM / 111320;
    const dLng = sideM / (111320 * Math.cos((center[0] * Math.PI) / 180));

    const box: [number, number][] = [
      [center[0] + dLat, center[1] - dLng],
      [center[0] + dLat, center[1] + dLng],
      [center[0] - dLat, center[1] + dLng],
      [center[0] - dLat, center[1] - dLng],
    ];

    onPointsChange(box);
    toast.success(`Created simple field box matching ~${targetAcres} acres. Drag any corner to adjust!`);
  };

  // Real-time Area & Perimeter Calculations
  const areaCalc = useMemo(() => {
    if (points.length < 3) return null;
    return calculatePolygonArea(points);
  }, [points]);

  const perimeterCalc = useMemo(() => {
    if (points.length < 3) return null;
    return calculatePerimeter(points);
  }, [points]);

  return (
    <div className="space-y-3">
      {/* 1. Location Search Bar */}
      <form
        onSubmit={handleSearchLocation}
        className="flex flex-col sm:flex-row gap-2 bg-stone-50 dark:bg-gray-800 p-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs"
      >
        <div className="relative flex-1">
          <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search village, city, district, or pin code..."
            className="w-full pl-10 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <button
          type="submit"
          disabled={isSearching || !searchInput.trim()}
          className="btn-primary py-2 px-5 text-sm flex items-center justify-center gap-2 whitespace-nowrap"
        >
          {isSearching ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Find Location
            </>
          )}
        </button>
      </form>

      {/* 2. Farmer Guidance & Drawing Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDropSimpleBox}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-colors"
          >
            <Square className="w-3.5 h-3.5" />
            Quick Field Box
          </button>
          <button
            type="button"
            onClick={handleUndo}
            disabled={points.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo Corner
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={points.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-900/60 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Redraw
          </button>
        </div>

        {/* Live Area Indicator */}
        <div>
          {points.length >= 3 && areaCalc ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-black shadow-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>Farm Area: {areaCalc.acres} acres ({areaCalc.hectares} ha)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>
                {points.length === 0
                  ? 'Click points on the map to outline your farm boundary'
                  : `Click ${3 - points.length} more corner${3 - points.length > 1 ? 's' : ''} to enclose field`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Interactive Leaflet Map */}
      <div className="rounded-2xl border-2 border-emerald-600/30 overflow-hidden shadow-md relative">
        <MapContainer
          center={defaultCenter}
          zoom={14}
          scrollWheelZoom={true}
          style={{ height: '480px', width: '100%' }}
          className="z-0"
        >
          {/* Satellite Map with Labels */}
          <TileLayer
            attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={18}
          />

          <MapClickHandler onAdd={handleAddPoint} />
          <MapFlyController targetCenter={flyTarget} zoom={15} />
          <MapAutoFit points={points} />

          {/* Numbered Draggable Corner Markers */}
          {points.map((point, idx) => (
            <Marker
              key={`corner-${idx}-${point[0]}-${point[1]}`}
              position={point}
              icon={createNumberedIcon(idx + 1)}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  handleDragEnd(idx, e.target.getLatLng());
                },
              }}
            />
          ))}

          {/* Connected Lines for 2 points */}
          {points.length === 2 && (
            <Polyline
              positions={points}
              pathOptions={{ color: '#22c55e', weight: 3, dashArray: '6 6' }}
            />
          )}

          {/* Enclosed Polygon for 3+ points */}
          {points.length >= 3 && (
            <Polygon
              positions={points}
              pathOptions={{
                color: '#15803d',
                weight: 3.5,
                fillColor: '#22c55e',
                fillOpacity: 0.35,
              }}
            />
          )}
        </MapContainer>

        {/* Helpful Farmer Guidance Overlays */}
        {points.length === 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl px-5 py-2.5 shadow-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-800 dark:text-gray-200 font-semibold flex items-center gap-2 pointer-events-none">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span>Click anywhere around your field to place boundary corners</span>
          </div>
        )}

        {points.length >= 3 && (
          <div className="absolute bottom-4 left-4 z-[400] bg-stone-900/90 text-white backdrop-blur-md rounded-xl px-3 py-1.5 text-[11px] font-medium border border-white/10 shadow-lg pointer-events-none">
            💡 Tip: Click and drag any numbered corner to fine-tune your field boundary.
          </div>
        )}
      </div>

      {/* 4. Bottom Confirmation Bar */}
      {points.length >= 3 && areaCalc && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-300 font-medium">Selected Field Boundary:</span>
            <b className="text-emerald-700 dark:text-emerald-400 font-black text-sm">{areaCalc.acres} Acres</b>
            <span className="text-gray-400">({areaCalc.hectares} Hectares • {points.length} Corners)</span>
          </div>
          <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Ready to Save
          </span>
        </div>
      )}
    </div>
  );
}
