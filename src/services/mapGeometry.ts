import type { Zone, ZoneInput, FieldStressState, CropType } from '../types';
import { CROP_COLORS } from '../types';

export interface AreaMeasurement {
  squareMeters: number;
  acres: number;
  hectares: number;
}

export interface PerimeterMeasurement {
  meters: number;
  kilometers: number;
  feet: number;
}

/**
 * Calculates accurate geodesic area of a polygon on Earth's surface (WGS84).
 */
export function calculatePolygonArea(coords: [number, number][]): AreaMeasurement {
  if (!coords || coords.length < 3) {
    return { squareMeters: 0, acres: 0, hectares: 0 };
  }

  const radius = 6378137; // Earth's mean radius in meters
  let total = 0;
  const len = coords.length;

  for (let i = 0; i < len; i++) {
    const [lat1, lng1] = coords[i];
    const [lat2, lng2] = coords[(i + 1) % len];

    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

    total += deltaLambda * (2 + Math.sin(phi1) + Math.sin(phi2));
  }

  let sqMeters = Math.abs((total * radius * radius) / 2.0);

  // High precision planar fallback if geodesic is near zero or precision loss
  if (isNaN(sqMeters) || sqMeters < 0.05) {
    const latMid = (coords.reduce((s, p) => s + p[0], 0) / len) * (Math.PI / 180);
    const mPerDegLat = 111132.92 - 559.82 * Math.cos(2 * latMid) + 1.175 * Math.cos(4 * latMid);
    const mPerDegLng = 111412.84 * Math.cos(latMid) - 93.5 * Math.cos(3 * latMid);

    let planar = 0;
    for (let i = 0; i < len; i++) {
      const p1 = coords[i];
      const p2 = coords[(i + 1) % len];
      const x1 = p1[1] * mPerDegLng;
      const y1 = p1[0] * mPerDegLat;
      const x2 = p2[1] * mPerDegLng;
      const y2 = p2[0] * mPerDegLat;
      planar += x1 * y2 - x2 * y1;
    }
    sqMeters = Math.abs(planar / 2);
  }

  const acres = sqMeters / 4046.8564224;
  const hectares = sqMeters / 10000;

  return {
    squareMeters: Math.round(sqMeters * 10) / 10,
    acres: Math.round(acres * 100) / 100,
    hectares: Math.round(hectares * 100) / 100,
  };
}

/**
 * Calculates geodesic perimeter of a closed polygon in meters.
 */
export function calculatePerimeter(coords: [number, number][]): PerimeterMeasurement {
  if (!coords || coords.length < 2) {
    return { meters: 0, kilometers: 0, feet: 0 };
  }

  let totalMeters = 0;
  const len = coords.length;

  for (let i = 0; i < len; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % len];
    totalMeters += haversineDistance(p1, p2);
  }

  return {
    meters: Math.round(totalMeters),
    kilometers: Math.round((totalMeters / 1000) * 100) / 100,
    feet: Math.round(totalMeters * 3.28084),
  };
}

/**
 * Distance between two lat/lng coordinates in meters using Haversine formula.
 */
export function haversineDistance(p1: [number, number], p2: [number, number]): number {
  const R = 6378137;
  const dLat = ((p2[0] - p1[0]) * Math.PI) / 180;
  const dLng = ((p2[1] - p1[1]) * Math.PI) / 180;
  const lat1 = (p1[0] * Math.PI) / 180;
  const lat2 = (p2[0] * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Ray-casting algorithm to test if a point is inside a polygon.
 */
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  if (!polygon || polygon.length < 3) return false;
  const [lat, lng] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect =
      yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Validates if child polygon is contained within parent polygon.
 */
export function isPolygonInsidePolygon(
  child: [number, number][],
  parent: [number, number][]
): { inside: boolean; outsideCount: number } {
  if (!parent || parent.length < 3 || !child || child.length === 0) {
    return { inside: true, outsideCount: 0 };
  }

  let outsideCount = 0;
  for (const pt of child) {
    if (!isPointInPolygon(pt, parent)) {
      outsideCount++;
    }
  }

  // Also check edge intersections between child and parent
  const edgesCross = doPolygonEdgesIntersect(child, parent);

  return {
    inside: outsideCount === 0 && !edgesCross,
    outsideCount,
  };
}

/**
 * Checks if line segments of two polygons cross each other.
 */
function doPolygonEdgesIntersect(polyA: [number, number][], polyB: [number, number][]): boolean {
  for (let i = 0; i < polyA.length; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % polyA.length];
    for (let j = 0; j < polyB.length; j++) {
      const b1 = polyB[j];
      const b2 = polyB[(j + 1) % polyB.length];
      if (segmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }
  return false;
}

function segmentsIntersect(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  p4: [number, number]
): boolean {
  const ccw = (a: [number, number], b: [number, number], c: [number, number]) => {
    return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
  };
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

/**
 * Checks if two polygons overlap.
 */
export function doPolygonsOverlap(polyA: [number, number][], polyB: [number, number][]): boolean {
  if (!polyA || polyA.length < 3 || !polyB || polyB.length < 3) return false;

  // Check edge crossings
  if (doPolygonEdgesIntersect(polyA, polyB)) return true;

  // Check if A is completely inside B
  if (polyA.some((pt) => isPointInPolygon(pt, polyB))) return true;

  // Check if B is completely inside A
  if (polyB.some((pt) => isPointInPolygon(pt, polyA))) return true;

  return false;
}

/**
 * Generates an axis-aligned bounding box polygon from two opposite corner points.
 */
export function generateRectanglePolygon(
  corner1: [number, number],
  corner2: [number, number]
): [number, number][] {
  const latMin = Math.min(corner1[0], corner2[0]);
  const latMax = Math.max(corner1[0], corner2[0]);
  const lngMin = Math.min(corner1[1], corner2[1]);
  const lngMax = Math.max(corner1[1], corner2[1]);

  return [
    [latMax, lngMin],
    [latMax, lngMax],
    [latMin, lngMax],
    [latMin, lngMin],
  ];
}

/**
 * Generates a regular polygon approximating a circle around center.
 */
export function generateCirclePolygon(
  center: [number, number],
  radiusMeters: number,
  points: number = 32
): [number, number][] {
  const [cLat, cLng] = center;
  const coords: [number, number][] = [];
  const dLat = (radiusMeters / 111320);
  const dLng = (radiusMeters / (111320 * Math.cos((cLat * Math.PI) / 180)));

  for (let i = 0; i < points; i++) {
    const theta = (i * 2 * Math.PI) / points;
    const lat = cLat + dLat * Math.sin(theta);
    const lng = cLng + dLng * Math.cos(theta);
    coords.push([lat, lng]);
  }

  return coords;
}

/**
 * Computes centroid / bounding center of coordinates.
 */
export function getPolygonCenter(coords: [number, number][]): [number, number] {
  if (!coords || coords.length === 0) return [0, 0];
  let sumLat = 0;
  let sumLng = 0;
  for (const pt of coords) {
    sumLat += pt[0];
    sumLng += pt[1];
  }
  return [sumLat / coords.length, sumLng / coords.length];
}

/**
 * Computes bounding box for Leaflet fitBounds.
 */
export function getPolygonBounds(coords: [number, number][]): [[number, number], [number, number]] {
  if (!coords || coords.length === 0) {
    return [[0, 0], [0, 0]];
  }
  let minLat = coords[0][0];
  let maxLat = coords[0][0];
  let minLng = coords[0][1];
  let maxLng = coords[0][1];

  for (const [lat, lng] of coords) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

/**
 * Dynamically determines field stress state based on moisture, health, temperature, and disease.
 */
export function getFieldStressState(zone: Zone | ZoneInput): FieldStressState {
  if (zone.stressState) return zone.stressState;

  if (zone.soilMoisture > 88) return 'flooded';
  if (zone.soilMoisture < 28) return 'drought';
  if (zone.temperature > 37) return 'heat_stress';
  if ((zone.diseaseRisk ?? 15) > 55) return 'disease';

  const health = zone.healthScore ?? 75;
  if (health < 40) return 'severe_stress';
  if (health < 65) return 'high_stress';
  if (health < 80) return 'moderate_stress';

  return 'healthy';
}

export interface FieldVisualStyles {
  strokeColor: string;
  fillColor: string;
  fillOpacity: number;
  weight: number;
  dashArray?: string;
  label: string;
}

/**
 * Produces dynamic SVG styling for fields on the map.
 */
export function getFieldVisualStyles(
  zone: Zone | ZoneInput,
  isSelected: boolean,
  isDimmed: boolean,
  viewMode: 'crops' | 'health' | 'moisture' = 'health'
): FieldVisualStyles {
  const stress = getFieldStressState(zone);

  let fillColor = '#16a34a'; // Healthy green default
  let strokeColor = '#15803d';
  let dashArray: string | undefined = undefined;
  let label = 'Healthy';

  if (viewMode === 'crops') {
    fillColor = CROP_COLORS[zone.crop] || '#4CAF50';
    strokeColor = fillColor;
    label = zone.crop;
  } else if (viewMode === 'moisture') {
    if (zone.soilMoisture < 35) {
      fillColor = '#b45309'; // Dry brown
      strokeColor = '#78350f';
      label = `Dry (${Math.round(zone.soilMoisture)}%)`;
    } else if (zone.soilMoisture > 80) {
      fillColor = '#0284c7'; // Water saturated
      strokeColor = '#0369a1';
      dashArray = '4 4';
      label = `Saturated (${Math.round(zone.soilMoisture)}%)`;
    } else {
      fillColor = '#059669'; // Optimal
      strokeColor = '#047857';
      label = `Optimal (${Math.round(zone.soilMoisture)}%)`;
    }
  } else {
    // Health & Stress view mode
    switch (stress) {
      case 'healthy':
        fillColor = '#22c55e'; // Green
        strokeColor = '#16a34a';
        label = 'Healthy';
        break;
      case 'moderate_stress':
        fillColor = '#a3e635'; // Yellow-green
        strokeColor = '#65a30d';
        label = 'Moderate Stress';
        break;
      case 'high_stress':
        fillColor = '#f97316'; // Orange
        strokeColor = '#c2410c';
        label = 'High Stress';
        break;
      case 'severe_stress':
        fillColor = '#ef4444'; // Red/Brown
        strokeColor = '#991b1b';
        label = 'Severe Stress';
        break;
      case 'flooded':
        fillColor = '#0ea5e9'; // Blue water overlay
        strokeColor = '#0284c7';
        dashArray = '5 5';
        label = 'Flooded';
        break;
      case 'drought':
        fillColor = '#a16207'; // Dry brown soil
        strokeColor = '#713f12';
        dashArray = '6 3';
        label = 'Drought Stress';
        break;
      case 'heat_stress':
        fillColor = '#ea580c'; // Warm orange
        strokeColor = '#9a3412';
        label = 'Heat Stress';
        break;
      case 'disease':
        fillColor = '#9333ea'; // Patchy violet/caution
        strokeColor = '#6b21a8';
        dashArray = '4 2 2 2';
        label = 'Disease Risk';
        break;
    }
  }

  let fillOpacity = 0.55;
  let weight = 2;

  if (isSelected) {
    weight = 4;
    strokeColor = '#2563eb'; // Vibrant electric blue outline
    fillOpacity = 0.75;
  } else if (isDimmed) {
    fillOpacity = 0.18;
    weight = 1;
    strokeColor = '#9ca3af';
  }

  return {
    fillColor,
    strokeColor,
    fillOpacity,
    weight,
    dashArray,
    label,
  };
}

/**
 * Creates default rectangular farm boundary centered around lat/lng.
 */
export function generateDefaultFarmBoundary(
  center: [number, number],
  areaAcres: number
): [number, number][] {
  const [cLat, cLng] = center;
  // 1 acre ~ 4046.86 m2. Side length of square for area in meters:
  const sideMeters = Math.sqrt(areaAcres * 4046.86);
  const halfSideM = sideMeters / 2;

  const dLat = halfSideM / 111320;
  const dLng = halfSideM / (111320 * Math.cos((cLat * Math.PI) / 180));

  return [
    [cLat + dLat, cLng - dLng],
    [cLat + dLat, cLng + dLng],
    [cLat - dLat, cLng + dLng],
    [cLat - dLat, cLng - dLng],
  ];
}

/**
 * Generates initial field plots inside a boundary for existing farms that didn't have coordinates.
 */
export function generateDefaultPlotBoundaries(
  boundary: [number, number][],
  zoneCount: number
): [number, number][][] {
  if (!boundary || boundary.length < 3 || zoneCount <= 0) return [];
  const bounds = getPolygonBounds(boundary);
  const minLat = bounds[0][0];
  const maxLat = bounds[1][0];
  const minLng = bounds[0][1];
  const maxLng = bounds[1][1];

  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;

  // Small internal margin (5% padding from outer boundary)
  const marginLat = latSpan * 0.05;
  const marginLng = lngSpan * 0.05;

  const innerMinLat = minLat + marginLat;
  const innerMaxLat = maxLat - marginLat;
  const innerMinLng = minLng + marginLng;
  const innerMaxLng = maxLng - marginLng;

  const plots: [number, number][][] = [];
  const cols = Math.ceil(Math.sqrt(zoneCount));
  const rows = Math.ceil(zoneCount / cols);

  const colWidth = (innerMaxLng - innerMinLng) / cols;
  const rowHeight = (innerMaxLat - innerMinLat) / rows;

  let created = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (created >= zoneCount) break;

      const pMinLat = innerMaxLat - (r + 1) * rowHeight + rowHeight * 0.04;
      const pMaxLat = innerMaxLat - r * rowHeight - rowHeight * 0.04;
      const pMinLng = innerMinLng + c * colWidth + colWidth * 0.04;
      const pMaxLng = innerMinLng + (c + 1) * colWidth - colWidth * 0.04;

      plots.push([
        [pMaxLat, pMinLng],
        [pMaxLat, pMaxLng],
        [pMinLat, pMaxLng],
        [pMinLat, pMinLng],
      ]);
      created++;
    }
  }

  return plots;
}
