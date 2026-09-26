/**
 * Mock data for development purposes.
 * This module provides fallback data when the backend is unavailable.
 * It should be removed or disabled when the backend is connected.
 */

import type {
  Farm, Zone, SimulationResult, ComparisonResult, CropType, SoilType,
} from '../types';

const MOCK_ENABLED = true; // Set to false to disable mock data

export function isMockEnabled(): boolean {
  return MOCK_ENABLED;
}

export function createMockFarm(input: { name: string; location: string; area: number; numberOfZones: number; latitude?: number; longitude?: number; ownerId?: string }): Farm {
  const farmId = `farm_${Date.now()}`;
  
  // Choose sensible center coordinates if not specified
  let lat = input.latitude;
  let lng = input.longitude;
  if (!lat || !lng) {
    const loc = (input.location || '').toLowerCase();
    if (loc.includes('punjab') || loc.includes('india')) {
      lat = 30.9010; lng = 75.8573;
    } else if (loc.includes('california') || loc.includes('fresno')) {
      lat = 36.7468; lng = -119.7726;
    } else if (loc.includes('iowa')) {
      lat = 42.0308; lng = -93.6319;
    } else {
      lat = 30.9010; lng = 75.8573;
    }
  }

  // Generate boundary polygon around center
  const center: [number, number] = [lat, lng];
  const sideM = Math.sqrt(input.area * 4046.86) / 2;
  const dLat = sideM / 111320;
  const dLng = sideM / (111320 * Math.cos((lat * Math.PI) / 180));

  const boundary: [number, number][] = [
    [lat + dLat, lng - dLng],
    [lat + dLat, lng + dLng],
    [lat - dLat, lng + dLng],
    [lat - dLat, lng - dLng],
  ];

  // Generate initial sub-plots
  const count = input.numberOfZones;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const colW = (dLng * 1.8) / cols;
  const rowH = (dLat * 1.8) / rows;
  const minLt = lat - dLat * 0.9;
  const maxLt = lat + dLat * 0.9;
  const minLg = lng - dLng * 0.9;

  const zones: Zone[] = Array.from({ length: count }, (_, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const pMaxLat = maxLt - r * rowH - rowH * 0.05;
    const pMinLat = maxLt - (r + 1) * rowH + rowH * 0.05;
    const pMinLng = minLg + c * colW + colW * 0.05;
    const pMaxLng = minLg + (c + 1) * colW - colW * 0.05;

    const plotPoly: [number, number][] = [
      [pMaxLat, pMinLng],
      [pMaxLat, pMaxLng],
      [pMinLat, pMaxLng],
      [pMinLat, pMinLng],
    ];

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

  return {
    id: farmId,
    ownerId: input.ownerId || 'farmer_punjab',
    name: input.name,
    location: input.location,
    area: input.area,
    latitude: lat,
    longitude: lng,
    boundary,
    boundaryAreaAcres: input.area,
    boundaryAreaHectares: Math.round((input.area / 2.47105) * 100) / 100,
    boundaryPerimeterMeters: Math.round(sideM * 8),
    boundaryShape: 'rectangle',
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

  const defaultSpecs = [
    {
      id: 'farm_green_valley',
      ownerId: 'farmer_punjab',
      name: 'Green Valley Farm',
      location: 'Ludhiana, Punjab',
      area: 12.4,
      numberOfZones: 5,
      latitude: 30.9010,
      longitude: 75.8573,
    },
    {
      id: 'farm_sunrise',
      ownerId: 'farmer_california',
      name: 'Sunrise Farm',
      location: 'Fresno, California',
      area: 8.7,
      numberOfZones: 3,
      latitude: 36.7468,
      longitude: -119.7726,
    },
    {
      id: 'farm_river',
      ownerId: 'farmer_iowa',
      name: 'River Farm',
      location: 'Ames, Iowa',
      area: 21.2,
      numberOfZones: 4,
      latitude: 42.0308,
      longitude: -93.6319,
    },
  ];

  // Backfill ownerId for existing stored farms if missing
  let updatedStored = false;
  const backfilled = stored.map((f) => {
    if (!f.ownerId) {
      updatedStored = true;
      if (f.id === 'farm_green_valley' || f.name.includes('Green Valley')) return { ...f, ownerId: 'farmer_punjab' };
      if (f.id === 'farm_sunrise' || f.name.includes('Sunrise')) return { ...f, ownerId: 'farmer_california' };
      if (f.id === 'farm_river' || f.name.includes('River')) return { ...f, ownerId: 'farmer_iowa' };
      return { ...f, ownerId: 'farmer_punjab' };
    }
    return f;
  });

  if (backfilled.length < 3) {
    const seededFarms = defaultSpecs.map((spec) => {
      const existing = backfilled.find((f) => f.id === spec.id || f.name === spec.name);
      if (existing) {
        return { ...existing, ownerId: existing.ownerId || spec.ownerId };
      }
      const created = createMockFarm({
        name: spec.name,
        location: spec.location,
        area: spec.area,
        numberOfZones: spec.numberOfZones,
        latitude: spec.latitude,
        longitude: spec.longitude,
        ownerId: spec.ownerId,
      });
      created.id = spec.id;
      created.ownerId = spec.ownerId;
      return created;
    });

    const merged = [
      ...seededFarms,
      ...backfilled.filter((f) => !seededFarms.some((sf) => sf.id === f.id)),
    ];
    localStorage.setItem('farms', JSON.stringify(merged));
    return merged;
  }

  if (updatedStored) {
    localStorage.setItem('farms', JSON.stringify(backfilled));
  }

  return backfilled;
}

