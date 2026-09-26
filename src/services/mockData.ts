/**
 * Mock data for development purposes.
 * This module provides fallback data when the backend is unavailable.
 * It should be removed or disabled when the backend is connected.
 */

import type {
  Farm, Zone, SimulationResult, ComparisonResult, CropType, SoilType, FarmCreateInput,
} from '../types';
import {
  calculatePolygonArea,
  calculatePerimeter,
  getPolygonCenter,
  generateDefaultPlotBoundaries,
} from './mapGeometry';

const MOCK_ENABLED = false; // Real backend API is integrated

export function isMockEnabled(): boolean {
  return MOCK_ENABLED;
}

export function createMockFarm(input: FarmCreateInput): Farm {
  const farmId = `farm_${Date.now()}`;
  
  let boundary: [number, number][];
  let lat = input.latitude;
  let lng = input.longitude;

  if (input.boundary && input.boundary.length >= 3) {
    boundary = [...input.boundary];
    const center = getPolygonCenter(boundary);
    if (!lat || !lng) {
      lat = center[0];
      lng = center[1];
    }
  } else {
    // Choose sensible center coordinates if not specified
    if (!lat || !lng) {
      const loc = (input.location || '').toLowerCase();
      if (loc.includes('punjab') || loc.includes('india')) {
        lat = 30.9010; lng = 75.8573;
      } else if (loc.includes('mumbai') || loc.includes('maharashtra')) {
        lat = 19.0760; lng = 72.8777;
      } else if (loc.includes('california') || loc.includes('fresno')) {
        lat = 36.7468; lng = -119.7726;
      } else if (loc.includes('iowa') || loc.includes('ames')) {
        lat = 42.0308; lng = -93.6319;
      } else {
        lat = 30.9010; lng = 75.8573;
      }
    }

    // Generate boundary polygon around center
    const sideM = Math.sqrt(input.area * 4046.86) / 2;
    const dLat = sideM / 111320;
    const dLng = sideM / (111320 * Math.cos((lat * Math.PI) / 180));

    boundary = [
      [lat + dLat, lng - dLng],
      [lat + dLat, lng + dLng],
      [lat - dLat, lng + dLng],
      [lat - dLat, lng - dLng],
    ];
  }

  const measuredArea = calculatePolygonArea(boundary);
  const measuredPerimeter = calculatePerimeter(boundary);

  // Generate initial sub-plots using generateDefaultPlotBoundaries inside boundary
  const defaultPlots = generateDefaultPlotBoundaries(boundary, input.numberOfZones);

  const zones: Zone[] = Array.from({ length: input.numberOfZones }, (_, i) => {
    const plotPoly = defaultPlots[i] || boundary;
    const health = 65 + Math.random() * 30;
    const moisture = 50 + Math.random() * 25;
    const disease = Math.random() * 30;

    return {
      id: `zone_${farmId}_${i + 1}`,
      farmId,
      name: `Field ${String.fromCharCode(65 + i)}1`,
      area: Math.round((input.area / input.numberOfZones) * 10) / 10,
      crop: (['Rice', 'Wheat', 'Maize', 'Soybean', 'Cotton'] as CropType[])[i % 5],
      soilType: (['Loamy', 'Alluvial', 'Black', 'Red'] as SoilType[])[i % 4],
      growthStage: 'Vegetative' as const,
      irrigationMethod: 'Drip' as const,
      soilMoisture: moisture,
      temperature: 26 + Math.random() * 6,
      humidity: 58 + Math.random() * 20,
      rainfall: 60 + Math.random() * 60,
      nitrogen: 35 + Math.random() * 30,
      phosphorus: 18 + Math.random() * 20,
      potassium: 22 + Math.random() * 25,
      healthScore: health,
      diseaseRisk: disease,
      pestRisk: Math.random() * 25,
      boundary: plotPoly,
      boundaryShape: 'polygon',
      stressState: health > 80 ? 'healthy' : health > 60 ? 'moderate_stress' : 'high_stress',
    };
  });

  // Prepare GeoJSON representation [lng, lat]
  const geoJsonRing: [number, number][] = boundary.map(([bLat, bLng]) => [bLng, bLat]);
  if (geoJsonRing.length > 0) {
    // GeoJSON polygon ring must be closed
    geoJsonRing.push([boundary[0][1], boundary[0][0]]);
  }

  const boundaryPoints = boundary.map(([bLat, bLng]) => ({
    latitude: Math.round(bLat * 1000000) / 1000000,
    longitude: Math.round(bLng * 1000000) / 1000000,
  }));

  return {
    id: farmId,
    ownerId: input.ownerId || 'farmer_punjab',
    name: input.name,
    location: input.location,
    area: input.area,
    total_area: input.area,
    mapped_area: measuredArea.acres,
    number_of_zones: input.numberOfZones,
    latitude: lat,
    longitude: lng,
    boundary,
    boundary_points: boundaryPoints,
    boundaryGeoJson: {
      type: 'Polygon',
      coordinates: [geoJsonRing],
    },
    boundaryAreaAcres: measuredArea.acres,
    boundaryAreaHectares: measuredArea.hectares,
    boundaryPerimeterMeters: measuredPerimeter.meters,
    boundaryShape: 'polygon',
    zones,
    createdAt: new Date().toISOString(),
  };
}

import { runComprehensiveSimulation } from './simulationEngine';
import type { WeatherMode, WeatherModifiers, StructuredScenarioJSON } from '../types';

export function createMockSimulation(
  farmId: string,
  scenarioName?: string,
  weather?: any,
  zones?: Zone[],
  mode?: WeatherMode,
  weatherModifiers?: WeatherModifiers,
  durationDays?: number,
  structuredScenario?: StructuredScenarioJSON
): SimulationResult {
  return runComprehensiveSimulation({
    farmId,
    scenarioName: scenarioName || (structuredScenario ? `${structuredScenario.scenario_type} Scenario` : 'Simulation'),
    weather,
    zones: zones || [],
    mode: mode || (structuredScenario ? 'what_if' : scenarioName && /drought|heatwave|flood|rain/i.test(scenarioName) ? 'what_if' : 'real_weather'),
    weatherModifiers: weatherModifiers || (
      scenarioName && /drought/i.test(scenarioName)
        ? { preset: 'drought', tempDelta: 3.5, rainMultiplier: 0.1 }
        : scenarioName && /heatwave/i.test(scenarioName)
        ? { preset: 'heatwave', tempDelta: 6.0, rainMultiplier: 0.4 }
        : { tempDelta: 0, rainMultiplier: 1.0 }
    ),
    durationDays: durationDays || structuredScenario?.duration_days || 14,
    structuredScenario,
  });
}

export function createMockComparison(simulations: SimulationResult[]): ComparisonResult {
  const days = [1, 7, 15, 30, 45, 60, 75, 90];

  return {
    simulations: simulations.map((sim) => ({
      id: sim.id,
      scenarioName: sim.scenarioName || 'Unknown',
      summary: sim.summary,
    })),
    timeline: days.map((day) => ({
      day,
      label: `Day ${day}`,
      simulations: simulations.map((sim) => {
        const point = sim.timeline.find((t) => t.day === day) || sim.timeline[0];
        return {
          id: sim.id,
          name: sim.scenarioName || 'Unknown',
          soilMoisture: point?.soilMoisture ?? 50,
          cropHealth: point?.cropHealth ?? 70,
          diseaseRisk: point?.diseaseRisk ?? 15,
          waterConsumption: point?.waterConsumption ?? 100,
          expectedYield: point?.expectedYield ?? 80,
        };
      }),
    })),
    aiExplanation: `Comparing ${simulations.length} scenarios reveals significant differences in expected outcomes. ${simulations.length >= 2 ? `The "${simulations[0].scenarioName}" scenario shows ${simulations[0].summary.averageCropHealth > simulations[1].summary.averageCropHealth ? 'higher' : 'lower'} crop health compared to "${simulations[1].scenarioName}".` : ''} Water usage varies across scenarios, suggesting opportunities for optimization. Disease risk patterns differ based on environmental conditions, with proactive management recommended for higher-risk scenarios.`,
  };
}

/**
 * Ensures default realistic multi-farm portfolio exists in storage:
 * Farm 1: Green Valley Farm (12.4 acres, Punjab)
 * Farm 2: Sunrise Farm (8.7 acres, California)
 * Farm 3: River Farm (21.2 acres, Iowa)
 */
export function ensureDefaultFarms(): Farm[] {
  let stored: Farm[] = [];
  try {
    stored = JSON.parse(localStorage.getItem('farms') || '[]');
  } catch {
    stored = [];
  }
  return stored;
}

/**
 * Permanently deletes a farm and its associated data from storage.
 */
export function deleteMockFarm(farmId: string): void {
  try {
    const stored = JSON.parse(localStorage.getItem('farms') || '[]') as Farm[];
    const filtered = stored.filter((f) => f.id !== farmId);
    localStorage.setItem('farms', JSON.stringify(filtered));
    localStorage.setItem('farms_initialized', 'true');
  } catch {
    // ignore
  }
}


