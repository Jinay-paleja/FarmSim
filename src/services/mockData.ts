/**
 * Seed & Mock Data for FarmSim AI
 */

import type {
  Farm,
  Zone,
  SimulationResult,
  ComparisonResult,
  CropType,
  SoilType,
} from '../types';

export function isMockEnabled(): boolean {
  // Demo data must be opt-in. Returning true here made a failed API/Firestore
  // request look successful and repopulated every account with the shared
  // sample farms.
  return import.meta.env.VITE_ENABLE_MOCKS === 'true';
}

export const INITIAL_DEFAULT_FARMS: Farm[] = [
  {
    id: 'farm_green_valley',
    ownerId: 'farmer_punjab',
    name: 'Green Valley Agro Farm',
    location: 'Ludhiana, Punjab, India',
    area: 12.4,
    latitude: 30.901,
    longitude: 75.8573,
    numberOfZones: 3,
    boundary: [
      [30.903, 75.854],
      [30.903, 75.86],
      [30.899, 75.86],
      [30.899, 75.854],
    ],
    boundaryShape: 'polygon',
    boundaryAreaAcres: 12.4,
    boundaryAreaHectares: 5.02,
    boundaryPerimeterMeters: 1450,
    zones: [
      {
        id: 'zone_punjab_1',
        farmId: 'farm_green_valley',
        name: 'North Plot A (Basmati Rice)',
        area: 4.5,
        crop: 'Rice',
        soilType: 'Alluvial',
        growthStage: 'Vegetative',
        irrigationMethod: 'Flood',
        soilMoisture: 68,
        temperature: 28,
        humidity: 75,
        rainfall: 120,
        nitrogen: 65,
        phosphorus: 28,
        potassium: 35,
        healthScore: 88,
        diseaseRisk: 12,
        stressState: 'healthy',
        boundary: [
          [30.903, 75.854],
          [30.903, 75.858],
          [30.901, 75.858],
          [30.901, 75.854],
        ],
      },
      {
        id: 'zone_punjab_2',
        farmId: 'farm_green_valley',
        name: 'South Field B (Sharbati Wheat)',
        area: 5.0,
        crop: 'Wheat',
        soilType: 'Loamy',
        growthStage: 'Flowering',
        irrigationMethod: 'Sprinkler',
        soilMoisture: 52,
        temperature: 26,
        humidity: 60,
        rainfall: 80,
        nitrogen: 55,
        phosphorus: 32,
        potassium: 40,
        healthScore: 82,
        diseaseRisk: 18,
        stressState: 'healthy',
        boundary: [
          [30.901, 75.854],
          [30.901, 75.858],
          [30.899, 75.858],
          [30.899, 75.854],
        ],
      },
      {
        id: 'zone_punjab_3',
        farmId: 'farm_green_valley',
        name: 'East Field C (Mustard & Cotton)',
        area: 2.9,
        crop: 'Mustard',
        soilType: 'Alluvial',
        growthStage: 'Seedling',
        irrigationMethod: 'Drip',
        soilMoisture: 45,
        temperature: 27,
        humidity: 55,
        rainfall: 60,
        nitrogen: 40,
        phosphorus: 20,
        potassium: 30,
        healthScore: 78,
        diseaseRisk: 8,
        stressState: 'healthy',
        boundary: [
          [30.903, 75.858],
          [30.903, 75.86],
          [30.899, 75.86],
          [30.899, 75.858],
        ],
      },
    ],
    createdAt: '2024-01-15T08:00:00.000Z',
    updatedAt: '2024-05-20T10:30:00.000Z',
  },
  {
    id: 'farm_california_valley',
    ownerId: 'farmer_california',
    name: 'Fresno Precision Orchard & Vineyard',
    location: 'Fresno, California, USA',
    area: 8.7,
    latitude: 36.7468,
    longitude: -119.7726,
    numberOfZones: 2,
    boundary: [
      [36.749, -119.775],
      [36.749, -119.77],
      [36.744, -119.77],
      [36.744, -119.775],
    ],
    boundaryShape: 'polygon',
    boundaryAreaAcres: 8.7,
    boundaryAreaHectares: 3.52,
    boundaryPerimeterMeters: 1120,
    zones: [
      {
        id: 'zone_cal_1',
        farmId: 'farm_california_valley',
        name: 'Block 1 - Premium Drip Orchard',
        area: 4.7,
        crop: 'Soybean',
        soilType: 'Loamy',
        growthStage: 'Vegetative',
        irrigationMethod: 'Drip',
        soilMoisture: 42,
        temperature: 32,
        humidity: 35,
        rainfall: 15,
        nitrogen: 70,
        phosphorus: 40,
        potassium: 60,
        healthScore: 90,
        diseaseRisk: 5,
        stressState: 'healthy',
      },
      {
        id: 'zone_cal_2',
        farmId: 'farm_california_valley',
        name: 'Block 2 - Cotton & Row Crops',
        area: 4.0,
        crop: 'Cotton',
        soilType: 'Sandy',
        growthStage: 'Flowering',
        irrigationMethod: 'Center Pivot',
        soilMoisture: 38,
        temperature: 34,
        humidity: 30,
        rainfall: 10,
        nitrogen: 50,
        phosphorus: 35,
        potassium: 45,
        healthScore: 75,
        diseaseRisk: 14,
        stressState: 'moderate_stress',
      },
    ],
    createdAt: '2024-02-10T09:15:00.000Z',
    updatedAt: '2024-05-18T14:20:00.000Z',
  },
];

export function ensureDefaultFarms(): Farm[] {
  try {
    const stored = localStorage.getItem('farms');
    if (stored) {
      const parsed = JSON.parse(stored) as Farm[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }

  try {
    localStorage.setItem('farms', JSON.stringify(INITIAL_DEFAULT_FARMS));
  } catch {
    // ignore
  }
  return INITIAL_DEFAULT_FARMS;
}

export function getMockFarms(): Farm[] {
  return ensureDefaultFarms();
}

export function getMockFarmById(farmId: string): Farm | undefined {
  const farms = ensureDefaultFarms();
  return farms.find((f) => f.id === farmId);
}

export function saveMockFarm(farm: Farm): Farm {
  const farms = ensureDefaultFarms();
  const idx = farms.findIndex((f) => f.id === farm.id);
  if (idx !== -1) {
    farms[idx] = farm;
  } else {
    farms.push(farm);
  }
  try {
    localStorage.setItem('farms', JSON.stringify(farms));
  } catch {
    // ignore
  }
  return farm;
}

export function createMockFarm(input: {
  name: string;
  location: string;
  area: number;
  numberOfZones: number;
  latitude?: number;
  longitude?: number;
}): Farm {
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

  const farm: Farm = {
    id: farmId,
    name: input.name,
    location: input.location,
    area: input.area,
    latitude: input.latitude,
    longitude: input.longitude,
    numberOfZones: input.numberOfZones,
    zones,
    createdAt: new Date().toISOString(),
  };

  return saveMockFarm(farm);
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
    aiExplanation: `Based on the "${scenarioName || 'Baseline'}" scenario analysis: The simulation projects soil moisture trending ${moisture > 60 ? 'stable' : 'downward'} over the period.`,
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
    aiExplanation: `Comparing ${simulations.length} scenarios reveals key differences in expected outcomes.`,
  };
}
