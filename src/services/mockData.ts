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

export function createMockFarm(input: { name: string; location: string; area: number; numberOfZones: number; latitude?: number; longitude?: number }): Farm {
  const farmId = `farm_${Date.now()}`;
  const zones: Zone[] = Array.from({ length: input.numberOfZones }, (_, i) => ({
    id: `zone_${farmId}_${i + 1}`,
    farmId,
    name: `Zone ${i + 1}`,
    area: Math.round((input.area / input.numberOfZones) * 10) / 10,
    crop: (['Rice', 'Wheat', 'Maize', 'Soybean', 'Cotton'] as CropType[])[i % 5],
    soilType: (['Alluvial', 'Black', 'Red'] as SoilType[])[i % 3],
    growthStage: 'Vegetative' as const,
    irrigationMethod: 'Drip' as const,
    soilMoisture: 55 + Math.random() * 20,
    temperature: 25 + Math.random() * 10,
    humidity: 60 + Math.random() * 20,
    rainfall: 50 + Math.random() * 100,
    nitrogen: 30 + Math.random() * 40,
    phosphorus: 15 + Math.random() * 25,
    potassium: 20 + Math.random() * 30,
    healthScore: 60 + Math.random() * 35,
    diseaseRisk: Math.random() * 40,
  }));

  return {
    id: farmId,
    name: input.name,
    location: input.location,
    area: input.area,
    latitude: input.latitude,
    longitude: input.longitude,
    zones,
    createdAt: new Date().toISOString(),
  };
}

export function createMockSimulation(farmId: string, scenarioName: string): SimulationResult {
  const days = [1, 7, 15, 30, 45, 60, 75, 90];
  let moisture = 65;
  let health = 85;
  let disease = 10;
  let water = 100;
  let yield_ = 90;

  const timeline = days.map((day) => {
    moisture += (Math.random() - 0.55) * 5;
    health += (Math.random() - 0.5) * 4;
    disease += (Math.random() - 0.3) * 3;
    water += (Math.random() - 0.4) * 10;
    yield_ += (Math.random() - 0.5) * 3;

    moisture = Math.max(10, Math.min(100, moisture));
    health = Math.max(0, Math.min(100, health));
    disease = Math.max(0, Math.min(100, disease));
    water = Math.max(0, water);
    yield_ = Math.max(0, Math.min(100, yield_));

    return {
      day,
      label: `Day ${day}`,
      soilMoisture: Math.round(moisture * 10) / 10,
      cropHealth: Math.round(health * 10) / 10,
      diseaseRisk: Math.round(disease * 10) / 10,
      waterConsumption: Math.round(water * 10) / 10,
      expectedYield: Math.round(yield_ * 10) / 10,
    };
  });

  return {
    id: `sim_${Date.now()}`,
    farmId,
    scenarioName: scenarioName || 'Baseline',
    timeline,
    summary: {
      totalWaterUsage: Math.round(water * days.length),
      averageCropHealth: Math.round(health * 10) / 10,
      averageDiseaseRisk: Math.round(disease * 10) / 10,
      totalExpectedYield: Math.round(yield_ * 100) / 10,
      averageSoilMoisture: Math.round(moisture * 10) / 10,
    },
    aiExplanation: `Based on the "${scenarioName || 'Baseline'}" scenario analysis: The simulation projects soil moisture trending ${moisture > 60 ? 'stable' : 'downward'} over the 90-day period. Crop health is expected to ${health > 70 ? 'remain robust' : 'face moderate stress'}, with disease risk at ${disease > 30 ? 'elevated' : 'manageable'} levels. Water consumption patterns suggest ${water > 120 ? 'above-average' : 'moderate'} irrigation needs. Expected yield projections indicate a ${yield_ > 80 ? 'strong' : yield_ > 60 ? 'moderate' : 'reduced'} harvest potential. Consider adjusting irrigation schedules and monitoring soil nutrient levels for optimal outcomes.`,
    createdAt: new Date().toISOString(),
  };
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
