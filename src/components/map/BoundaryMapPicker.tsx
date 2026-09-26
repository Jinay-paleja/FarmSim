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
  Navigation,
} from 'lucide-react';
import { calculatePolygonArea, calculatePerimeter } from '../../services/mapGeometry';
import { geocodeLocation, reverseGeocodeLocation, LocationDetails } from '../../services/geocoding';
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

const centerPinIcon = L.divIcon({
  className: 'farm-center-pin',
  html: `<div style="
    width: 32px; height: 32px;
    background: #dc2626;
    color: #fff;
    border: 3px solid #fff;
    border-radius: 50%;
    box-shadow: 0 3px 8px rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: bold;
    cursor: move;
  ">📍</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

export interface BoundaryMapPickerProps {
  points: [number, number][];
  onPointsChange: (points: [number, number][]) => void;
  locationQuery: string;
  enteredAreaAcres: number;
  initialCenter?: [number, number];
  onLocationFound?: (locationName: string, coords: [number, number]) => void;
  onLocationDetailsChange?: (details: LocationDetails) => void;
}

/** Handles map click events to add boundary points */
function MapClickHandler({
  onAddPoint,
  isDrawingMode,
}: {
  onAddPoint: (latlng: [number, number]) => void;
  isDrawingMode: boolean;
}) {
  useMapEvents({
    click(e) {
      if (isDrawingMode) {
        onAddPoint([e.latlng.lat, e.latlng.lng]);
      }
    },
  });
  return null;
}

/** Fly controller for centering map */
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

export default function BoundaryMapPicker({
  points,
  onPointsChange,
  locationQuery,
  enteredAreaAcres,
  initialCenter,
  onLocationFound,
  onLocationDetailsChange,
}: BoundaryMapPickerProps) {
  const [searchInput, setSearchInput] = useState(locationQuery || '');
  const [isSearching, setIsSearching] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  // Selected farm location center point
  const defaultCenter: [number, number] = initialCenter || [30.9010, 75.8573];
  const [centerPoint, setCenterPoint] = useState<[number, number]>(defaultCenter);
  const [flyTarget, setFlyTarget] = useState<[number, number] | undefined>(initialCenter);

  // Manual Coordinate Inputs
  const [latInput, setLatInput] = useState<string>(defaultCenter[0].toFixed(5));
  const [lngInput, setLngInput] = useState<string>(defaultCenter[1].toFixed(5));

  // Human readable location identifier
  const [locationDetails, setLocationDetails] = useState<LocationDetails | null>(null);

  // Drawing state
  const [isDrawingMode, setIsDrawingMode] = useState(true);

  // Sync external location query
  useEffect(() => {
    if (locationQuery && locationQuery !== searchInput) {
      setSearchInput(locationQuery);
    }
  }, [locationQuery]);

  // Initial reverse geocode on mount
  useEffect(() => {
    handlePerformReverseGeocode(centerPoint[0], centerPoint[1]);
  }, []);

  const handlePerformReverseGeocode = async (lat: number, lng: number) => {
    setIsReverseGeocoding(true);
    try {
      const details = await reverseGeocodeLocation(lat, lng);
      setLocationDetails(details);
      setLatInput(lat.toFixed(5));
      setLngInput(lng.toFixed(5));
      if (onLocationDetailsChange) {
        onLocationDetailsChange(details);
      }
      if (onLocationFound) {
        onLocationFound(details.formattedLocation, [lat, lng]);
      }
    } catch {
      // ignore
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  const handleSearchLocation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchInput.trim() || searchInput.trim().length < 2) return;

    setIsSearching(true);
    try {
      const result = await geocodeLocation(searchInput.trim());
      if (result) {
        const coords: [number, number] = [result.latitude, result.longitude];
        setCenterPoint(coords);
        setFlyTarget(coords);
        setLatInput(result.latitude.toFixed(5));
        setLngInput(result.longitude.toFixed(5));
        setLocationDetails(result);

        if (onLocationDetailsChange) {
          onLocationDetailsChange(result);
        }
        if (onLocationFound) {
          onLocationFound(result.formattedLocation, coords);
        }
        toast.success(`Found location: ${result.formattedLocation}`);
      } else {
        toast.error('Location not found. Try entering a nearby town, village, or district.');
      }
    } catch {
      toast.error('Could not search location. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Phase 10: Manual Coordinate Editing
  const handleUpdateCoordinates = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      toast.error('Latitude must be a valid number between -90 and +90 degrees.');
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      toast.error('Longitude must be a valid number between -180 and +180 degrees.');
      return;
    }

    const roundedLat = Math.round(lat * 100000) / 100000;
    const roundedLng = Math.round(lng * 100000) / 100000;
    const newCoords: [number, number] = [roundedLat, roundedLng];

    setCenterPoint(newCoords);
    setFlyTarget(newCoords);
    handlePerformReverseGeocode(roundedLat, roundedLng);
    toast.success(`Location updated to ${roundedLat}, ${roundedLng}. Reverse geocoding locality...`);
  };

  const handleCenterMarkerDrag = (e: L.LeafletEvent) => {
    const marker = e.target as L.Marker;
    const latlng = marker.getLatLng();
    const newCoords: [number, number] = [
      Math.round(latlng.lat * 100000) / 100000,
      Math.round(latlng.lng * 100000) / 100000,
    ];
    setCenterPoint(newCoords);
    setLatInput(newCoords[0].toFixed(5));
    setLngInput(newCoords[1].toFixed(5));
    handlePerformReverseGeocode(newCoords[0], newCoords[1]);
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

  // Quick 1-click standard field box centered on current center point
  const handleDropSimpleBox = () => {
    const center = centerPoint;
    const targetAcres = enteredAreaAcres > 0 ? enteredAreaAcres : 10;
    
    // Compute square box matching target acreage
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
    toast.success(`Created field box matching ~${targetAcres} acres. Drag any numbered corner to adjust!`);
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
      {/* 1. Location Search & Human Readable Identifier */}
      <div className="bg-stone-50 rounded-2xl p-3 border border-gray-200 shadow-xs space-y-2.5">
        <form onSubmit={handleSearchLocation} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search village, town, city, or district (e.g., Powai, Ludhiana)..."
              className="w-full pl-10 pr-3 py-2 text-sm rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchInput.trim()}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-gray-300 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Find Place</span>
          </button>
        </form>

        {/* Human Readable Location Identifier (Phase 7 & 8) */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">📍</span>
            <div>
              <span className="font-bold text-emerald-950">Farm Location: </span>
              <span className="font-semibold text-emerald-800">
                {isReverseGeocoding ? (
                  <span className="inline-flex items-center gap-1 text-gray-500">
                    <Loader2 className="w-3 h-3 animate-spin" /> Identifying locality...
                  </span>
                ) : (
                  locationDetails?.formattedLocation || 'Selected Point on Map'
                )}
              </span>
              {locationDetails?.state && locationDetails?.country && (
                <span className="text-emerald-700/80 ml-1.5">
                  ({locationDetails.state}, {locationDetails.country})
                </span>
              )}
            </div>
          </div>
          <div className="text-[11px] text-gray-500 font-mono">
            {centerPoint[0].toFixed(4)}°N, {centerPoint[1].toFixed(4)}°E
          </div>
        </div>

        {/* Phase 10: Location Coordinates Editor (Latitude / Longitude Manual Correction) */}
        <form onSubmit={handleUpdateCoordinates} className="pt-1 border-t border-gray-200/80 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-gray-700 flex items-center gap-1">
            <Navigation className="w-3.5 h-3.5 text-gray-500" /> Location Coordinates:
          </span>
          <div className="flex items-center gap-1.5">
            <label className="text-gray-500 font-medium">Lat:</label>
            <input
              type="text"
              value={latInput}
              onChange={(e) => setLatInput(e.target.value)}
              placeholder="e.g. 19.1176"
              className="w-24 px-2 py-1 rounded-lg border border-gray-300 bg-white font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-gray-500 font-medium">Lng:</label>
            <input
              type="text"
              value={lngInput}
              onChange={(e) => setLngInput(e.target.value)}
              placeholder="e.g. 72.9060"
              className="w-24 px-2 py-1 rounded-lg border border-gray-300 bg-white font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1 bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold rounded-lg transition-colors text-xs"
          >
            Update Location
          </button>
          <span className="text-[11px] text-gray-400 hidden md:inline ml-auto">
            (You can also drag the red pin on the map)
          </span>
        </form>
      </div>

      {/* 2. Farmer Guidance & Quick Tools */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-stone-100 p-2.5 rounded-xl border border-stone-200 text-xs text-stone-800">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-farm-green">Draw Farm Area:</span>
          <span>Click anywhere on the map to outline your field corners, or drop a quick field box.</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDropSimpleBox}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            title="Create a standard square field at the center of the map"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Quick Field Box ({enteredAreaAcres > 0 ? enteredAreaAcres : 10} ac)</span>
          </button>
          {points.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleUndo}
                className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium flex items-center gap-1 transition-colors"
                title="Remove last corner"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="px-2.5 py-1.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-lg font-medium flex items-center gap-1 transition-colors"
                title="Start over"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Redraw</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 3. Interactive Leaflet Map Container */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-stone-300 shadow-md h-[400px]">
        <MapContainer
          center={centerPoint}
          zoom={15}
          scrollWheelZoom={true}
          className="w-full h-full"
        >
          {/* High-resolution satellite tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
          {/* Subtle hybrid borders & road labels */}
          <TileLayer
            attribution='&copy; CartoDB'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
            maxZoom={19}
          />

          <MapFlyController targetCenter={flyTarget} />
          <MapClickHandler onAddPoint={handleAddPoint} isDrawingMode={isDrawingMode} />

          {/* Farm Location Center Marker (draggable) */}
          <Marker
            position={centerPoint}
            icon={centerPinIcon}
            draggable={true}
            eventHandlers={{
              dragend: handleCenterMarkerDrag,
            }}
          />

          {/* Farm Boundary Polygon */}
          {points.length >= 3 && (
            <Polygon
              positions={points}
              pathOptions={{
                color: '#16a34a',
                fillColor: '#22c55e',
                fillOpacity: 0.35,
                weight: 3.5,
                dashArray: '6, 6',
              }}
            />
          )}

          {/* Incomplete boundary polyline */}
          {points.length > 0 && points.length < 3 && (
            <Polyline
              positions={points}
              pathOptions={{
                color: '#16a34a',
                weight: 3,
                dashArray: '5, 5',
              }}
            />
          )}

          {/* Draggable boundary corner markers */}
          {points.map((p, idx) => (
            <Marker
              key={`pt-${idx}-${p[0]}-${p[1]}`}
              position={p}
              icon={createNumberedIcon(idx + 1)}
              draggable={true}
              eventHandlers={{
                dragend: (e) => handleDragEnd(idx, e.target.getLatLng()),
              }}
            />
          ))}
        </MapContainer>

        {/* Live Farm Area Badge Overlay */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-lg border border-gray-200 flex items-center gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">
              Farm Area
            </div>
            {areaCalc ? (
              <div className="text-base font-extrabold text-emerald-800 flex items-center gap-1.5">
                <span>{areaCalc.acres.toFixed(2)} acres</span>
                <span className="text-xs text-gray-500 font-normal">
                  ({areaCalc.hectares.toFixed(2)} ha)
                </span>
              </div>
            ) : (
              <div className="text-xs text-amber-700 font-medium">
                {points.length === 0
                  ? 'No boundary drawn yet'
                  : `Need ${3 - points.length} more corner${3 - points.length > 1 ? 's' : ''}`}
              </div>
            )}
          </div>
          {areaCalc && (
            <div className="pl-3 border-l border-gray-200">
              <div className="text-[10px] uppercase text-gray-400 font-bold">Perimeter</div>
              <div className="text-xs font-semibold text-gray-700">
                {Math.round(perimeterCalc?.meters || 0)} m
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
