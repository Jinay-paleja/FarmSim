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
import { Undo2, X, Trash2, Pencil, Check, MapPin } from 'lucide-react';
import { calculatePolygonArea, calculatePerimeter } from '../../services/mapGeometry';
import { geocodeLocation } from '../../services/geocoding';

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
      background: #16a34a;
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
}

/** Sub-component: handles map click events to add points */
function MapClickHandler({ onAdd }: { onAdd: (latlng: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      onAdd([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

/** Sub-component: handles geocoding + flyTo when location query changes */
function MapGeocoder({ locationQuery }: { locationQuery: string }) {
  const map = useMap();
  const lastQuery = useRef('');

  useEffect(() => {
    if (!locationQuery || locationQuery.trim().length < 2) return;
    const trimmed = locationQuery.trim().toLowerCase();
    if (trimmed === lastQuery.current) return;

    const timer = setTimeout(async () => {
      lastQuery.current = trimmed;
      const result = await geocodeLocation(locationQuery);
      if (result) {
        map.flyTo([result.lat, result.lng], 14, { duration: 1.5 });
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [locationQuery, map]);

  return null;
}

/** Sub-component: fits map bounds to points */
function MapAutoFit({ points }: { points: [number, number][] }) {
  const map = useMap();
  const prevLen = useRef(0);

  useEffect(() => {
    if (points.length >= 2 && points.length !== prevLen.current) {
      const bounds = L.latLngBounds(points.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
    }
    prevLen.current = points.length;
  }, [points, map]);

  return null;
}

/** Sub-component: flies to initialCenter when it changes */
function MapCenterUpdater({ center }: { center?: [number, number] }) {
  const map = useMap();
  const lastCenter = useRef<string>('');

  useEffect(() => {
    if (!center) return;
    const key = `${center[0]},${center[1]}`;
    if (key === lastCenter.current) return;
    lastCenter.current = key;
    map.flyTo(center, 14, { duration: 1.2 });
  }, [center, map]);

  return null;
}

export default function BoundaryMapPicker({
  points,
  onPointsChange,
  locationQuery,
  enteredAreaAcres,
  initialCenter,
}: BoundaryMapPickerProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');

  const defaultCenter: [number, number] = initialCenter || [20.5937, 78.9629];

  const handleAddPoint = useCallback((latlng: [number, number]) => {
    onPointsChange([...points, [
      Math.round(latlng[0] * 1000000) / 1000000,
      Math.round(latlng[1] * 1000000) / 1000000,
    ]]);
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

  const handleDeletePoint = useCallback((index: number) => {
    onPointsChange(points.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  }, [points, onPointsChange, editingIndex]);

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditLat(points[index][0].toFixed(6));
    setEditLng(points[index][1].toFixed(6));
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const lat = parseFloat(editLat);
    const lng = parseFloat(editLng);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
    const updated = [...points];
    updated[editingIndex] = [
      Math.round(lat * 1000000) / 1000000,
      Math.round(lng * 1000000) / 1000000,
    ];
    onPointsChange(updated);
    setEditingIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
  };

  // Area calculation
  const areaCalc = useMemo(() => {
    if (points.length < 3) return null;
    return calculatePolygonArea(points);
  }, [points]);

  const perimeterCalc = useMemo(() => {
    if (points.length < 3) return null;
    return calculatePerimeter(points);
  }, [points]);

  const areaDiffPercent = useMemo(() => {
    if (!areaCalc || enteredAreaAcres <= 0) return 0;
    return Math.abs(((areaCalc.acres - enteredAreaAcres) / enteredAreaAcres) * 100);
  }, [areaCalc, enteredAreaAcres]);

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-farm-green-pale text-farm-green text-xs font-bold">
          <MapPin className="w-3.5 h-3.5" />
          {points.length} point{points.length !== 1 ? 's' : ''}
        </div>
        <button
          type="button"
          onClick={handleUndo}
          disabled={points.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Undo2 className="w-3.5 h-3.5" />
          Undo Last
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={points.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Clear All
        </button>
        {points.length > 0 && points.length < 3 && (
          <span className="text-xs text-amber-600 font-medium ml-auto">
            Need {3 - points.length} more point{3 - points.length > 1 ? 's' : ''} for polygon
          </span>
        )}
        {points.length >= 3 && areaCalc && (
          <span className="text-xs text-farm-green font-bold ml-auto">
            Mapped: {areaCalc.acres} acres
          </span>
        )}
      </div>

      {/* Map */}
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm" style={{ position: 'relative' }}>
        <MapContainer
          center={defaultCenter}
          zoom={13}
          scrollWheelZoom={true}
          style={{ height: '500px', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapClickHandler onAdd={handleAddPoint} />
          <MapGeocoder locationQuery={locationQuery} />
          <MapAutoFit points={points} />
          <MapCenterUpdater center={initialCenter} />

          {/* Markers */}
          {points.map((point, idx) => (
            <Marker
              key={`marker-${idx}`}
              position={point}
              icon={createNumberedIcon(idx + 1)}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  handleDragEnd(idx, e.target.getLatLng());
                },
              }}
            />
          ))}

          {/* Polyline for 2 points */}
          {points.length === 2 && (
            <Polyline
              positions={points}
              pathOptions={{ color: '#16a34a', weight: 3, dashArray: '8 4' }}
            />
          )}

          {/* Polygon for 3+ points */}
          {points.length >= 3 && (
            <Polygon
              positions={points}
              pathOptions={{
                color: '#15803d',
                weight: 3,
                fillColor: '#16a34a',
                fillOpacity: 0.25,
              }}
            />
          )}
        </MapContainer>

        {/* Map overlay instruction */}
        {points.length === 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[400] bg-white/90 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg border border-gray-200 text-sm text-gray-600 font-medium pointer-events-none">
            👆 Click on the map to add boundary points
          </div>
        )}
      </div>

      {/* Coordinate List */}
      {points.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-stone-50 border-b border-gray-100">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Boundary Points ({points.length})
            </h4>
          </div>
          <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
            {points.map((point, idx) => (
              <div
                key={`coord-${idx}`}
                className="flex items-center gap-3 px-4 py-2 text-xs hover:bg-stone-50 transition-colors"
              >
                <span className="w-7 h-7 rounded-full bg-farm-green text-white flex items-center justify-center font-bold text-[11px] flex-shrink-0">
                  {idx + 1}
                </span>

                {editingIndex === idx ? (
                  <>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-gray-400 font-medium">Lat:</span>
                      <input
                        type="number"
                        step="0.000001"
                        value={editLat}
                        onChange={(e) => setEditLat(e.target.value)}
                        className="w-28 px-2 py-1 rounded border border-gray-300 text-xs focus:outline-none focus:border-farm-green"
                      />
                      <span className="text-gray-400 font-medium ml-1">Lng:</span>
                      <input
                        type="number"
                        step="0.000001"
                        value={editLng}
                        onChange={(e) => setEditLng(e.target.value)}
                        className="w-28 px-2 py-1 rounded border border-gray-300 text-xs focus:outline-none focus:border-farm-green"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="p-1 rounded text-farm-green hover:bg-farm-green-pale transition-colors"
                      title="Save"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="p-1 rounded text-gray-400 hover:bg-gray-100 transition-colors"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3 flex-1 min-w-0 text-gray-600">
                      <span>
                        <span className="text-gray-400">Lat:</span>{' '}
                        <span className="font-mono font-medium text-gray-800">{point[0].toFixed(6)}</span>
                      </span>
                      <span>
                        <span className="text-gray-400">Lng:</span>{' '}
                        <span className="font-mono font-medium text-gray-800">{point[1].toFixed(6)}</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(idx)}
                      className="p-1 rounded text-gray-400 hover:text-farm-green hover:bg-farm-green-pale transition-colors"
                      title="Edit coordinates"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePoint(idx)}
                      className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete point"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Area Comparison */}
      {areaCalc && (
        <div className="bg-stone-50 rounded-xl p-4 border border-gray-100 space-y-2">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <div>
              <span className="text-gray-500">Entered Area:</span>{' '}
              <span className="font-bold text-gray-800">{enteredAreaAcres} acres</span>
            </div>
            <div>
              <span className="text-gray-500">Mapped Area:</span>{' '}
              <span className="font-bold text-farm-green">{areaCalc.acres} acres</span>
            </div>
            <div className="text-xs text-gray-400">
              {areaCalc.hectares} ha &nbsp;•&nbsp; {areaCalc.squareMeters.toLocaleString()} m²
            </div>
          </div>
          {perimeterCalc && (
            <div className="text-xs text-gray-400">
              Perimeter: {perimeterCalc.meters.toLocaleString()} m ({perimeterCalc.kilometers} km)
            </div>
          )}
          {areaDiffPercent > 10 && (
            <div className="flex items-start gap-2 mt-1 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <span className="text-amber-500 mt-0.5">⚠️</span>
              <span>
                Mapped area differs from the entered farm area by <strong>{areaDiffPercent.toFixed(0)}%</strong>.
                You can adjust either value or keep both — the boundary polygon will be saved alongside your entered area.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
