// ============================================================
// Core Domain Types for FarmSim AI
// ============================================================

export interface Farm {
  id: string;
  name: string;
  location: string;
  area: number; // in acres
  latitude?: number;
  longitude?: number;
  zones: Zone[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Zone {
  id: string;
  farmId: string;
  name: string;
  area: number;
  crop: CropType;
  soilType: SoilType;
  growthStage: GrowthStage;
  irrigationMethod: IrrigationMethod;
  soilMoisture: number;
  temperature: number;
  humidity: number;
  rainfall: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  healthScore?: number;
  diseaseRisk?: number;
}

export type CropType =
  | 'Rice' | 'Wheat' | 'Maize' | 'Sorghum' | 'Pearl Millet'
  | 'Chickpea' | 'Pigeon Pea' | 'Green Gram' | 'Soybean'
  | 'Groundnut' | 'Mustard' | 'Cotton' | 'Sugarcane' | 'Potato';

export type SoilType =
  | 'Alluvial' | 'Black' | 'Red' | 'Laterite' | 'Arid' | 'Forest/Mountain';

export type GrowthStage =
  | 'Germination' | 'Seedling' | 'Vegetative' | 'Flowering'
  | 'Fruiting' | 'Maturity' | 'Harvest';

export type IrrigationMethod =
  | 'Drip' | 'Sprinkler' | 'Flood' | 'Furrow' | 'Rain-fed' | 'Center Pivot';

export interface Scenario {
  id: string;
  farmId: string;
  name: string;
  description?: string;
  duration: number; // in days
  affectedZones: string[]; // zone IDs
  changes: ScenarioChange[];
  naturalLanguageQuery?: string;
  createdAt?: string;
}

export interface ScenarioChange {
  type: ScenarioChangeType;
  parameter: string;
  value: number;
  unit: string;
}

export type ScenarioChangeType =
  | 'rainfall_decrease' | 'rainfall_increase'
  | 'temperature_increase' | 'temperature_decrease'
  | 'heatwave' | 'cold_snap'
  | 'irrigation_decrease' | 'irrigation_increase' | 'irrigation_failure'
  | 'fertilizer_increase' | 'fertilizer_decrease'
  | 'nitrogen_deficiency' | 'phosphorus_deficiency' | 'potassium_deficiency'
  | 'disease_introduced' | 'disease_spread'
  | 'pest_outbreak'
  | 'combined';

export interface SimulationRequest {
  farmId: string;
  scenarioId?: string;
  zones: Zone[];
  scenario?: Scenario;
}

export interface SimulationResult {
  id: string;
  farmId: string;
  scenarioId?: string;
  scenarioName?: string;
  timeline: TimelinePoint[];
  summary: SimulationSummary;
  aiExplanation: string;
  createdAt?: string;
}

export interface TimelinePoint {
  day: number;
  label: string;
  soilMoisture: number;
  cropHealth: number;
  diseaseRisk: number;
  waterConsumption: number;
  expectedYield: number;
  zones?: ZoneTimeline[];
}

export interface ZoneTimeline {
  zoneId: string;
  zoneName: string;
  soilMoisture: number;
  cropHealth: number;
  diseaseRisk: number;
  waterConsumption: number;
  expectedYield: number;
}

export interface SimulationSummary {
  totalWaterUsage: number;
  averageCropHealth: number;
  averageDiseaseRisk: number;
  totalExpectedYield: number;
  averageSoilMoisture: number;
}

export interface ComparisonRequest {
  simulationIds: string[];
}

export interface ComparisonResult {
  simulations: ComparisonSimulation[];
  timeline: ComparisonTimeline[];
  aiExplanation: string;
}

export interface ComparisonSimulation {
  id: string;
  scenarioName: string;
  summary: SimulationSummary;
}

export interface ComparisonTimeline {
  day: number;
  label: string;
  simulations: {
    id: string;
    name: string;
    soilMoisture: number;
    cropHealth: number;
    diseaseRisk: number;
    waterConsumption: number;
    expectedYield: number;
  }[];
}

// ============================================================
// Form / Creation Types
// ============================================================

export interface FarmCreateInput {
  name: string;
  location: string;
  area: number;
  latitude?: number;
  longitude?: number;
  numberOfZones: number;
}

export interface ZoneInput {
  name: string;
  area: number;
  crop: CropType;
  soilType: SoilType;
  growthStage: GrowthStage;
  irrigationMethod: IrrigationMethod;
  soilMoisture: number;
  temperature: number;
  humidity: number;
  rainfall: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
}

// ============================================================
// UI State Types
// ============================================================

export interface ApiError {
  message: string;
  status?: number;
  details?: string;
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// ============================================================
// Constants
// ============================================================

export const CROP_OPTIONS: CropType[] = [
  'Rice', 'Wheat', 'Maize', 'Sorghum', 'Pearl Millet',
  'Chickpea', 'Pigeon Pea', 'Green Gram', 'Soybean',
  'Groundnut', 'Mustard', 'Cotton', 'Sugarcane', 'Potato',
];

export const SOIL_OPTIONS: SoilType[] = [
  'Alluvial', 'Black', 'Red', 'Laterite', 'Arid', 'Forest/Mountain',
];

export const GROWTH_STAGES: GrowthStage[] = [
  'Germination', 'Seedling', 'Vegetative', 'Flowering',
  'Fruiting', 'Maturity', 'Harvest',
];

export const IRRIGATION_METHODS: IrrigationMethod[] = [
  'Drip', 'Sprinkler', 'Flood', 'Furrow', 'Rain-fed', 'Center Pivot',
];

export const SCENARIO_PRESETS: {
  label: string;
  type: ScenarioChangeType;
  parameter: string;
  value: number;
  unit: string;
}[] = [
  { label: 'Rainfall decreases by 30%', type: 'rainfall_decrease', parameter: 'rainfall', value: -30, unit: '%' },
  { label: 'Rainfall increases by 20%', type: 'rainfall_increase', parameter: 'rainfall', value: 20, unit: '%' },
  { label: 'Temperature increases by 3°C', type: 'temperature_increase', parameter: 'temperature', value: 3, unit: '°C' },
  { label: 'Heatwave for 7 days', type: 'heatwave', parameter: 'temperature', value: 7, unit: 'days' },
  { label: 'Irrigation decreases by 20%', type: 'irrigation_decrease', parameter: 'irrigation', value: -20, unit: '%' },
  { label: 'Irrigation increases by 20%', type: 'irrigation_increase', parameter: 'irrigation', value: 20, unit: '%' },
  { label: 'Irrigation failure', type: 'irrigation_failure', parameter: 'irrigation', value: -100, unit: '%' },
  { label: 'Fertilizer increased', type: 'fertilizer_increase', parameter: 'fertilizer', value: 25, unit: '%' },
  { label: 'Fertilizer reduced', type: 'fertilizer_decrease', parameter: 'fertilizer', value: -25, unit: '%' },
  { label: 'Nitrogen deficiency', type: 'nitrogen_deficiency', parameter: 'nitrogen', value: -50, unit: '%' },
  { label: 'Disease introduced', type: 'disease_introduced', parameter: 'disease', value: 1, unit: 'event' },
  { label: 'Disease spread', type: 'disease_spread', parameter: 'disease', value: 2, unit: 'event' },
  { label: 'Pest outbreak', type: 'pest_outbreak', parameter: 'pest', value: 1, unit: 'event' },
];

export const CROP_COLORS: Record<CropType, string> = {
  Rice: '#4CAF50',
  Wheat: '#FFB74D',
  Maize: '#FDD835',
  Sorghum: '#A1887F',
  'Pearl Millet': '#E0E0E0',
  Chickpea: '#81C784',
  'Pigeon Pea': '#66BB6A',
  'Green Gram': '#43A047',
  Soybean: '#8BC34A',
  Groundnut: '#D4A056',
  Mustard: '#FFEE58',
  Cotton: '#F5F5F5',
  Sugarcane: '#7CB342',
  Potato: '#C9A96E',
};

export const CROP_EMOJIS: Record<CropType, string> = {
  Rice: '🌾',
  Wheat: '🌾',
  Maize: '🌽',
  Sorghum: '🌿',
  'Pearl Millet': '🌿',
  Chickpea: '🫘',
  'Pigeon Pea': '🫘',
  'Green Gram': '🫛',
  Soybean: '🫘',
  Groundnut: '🥜',
  Mustard: '🌼',
  Cotton: '☁️',
  Sugarcane: '🎋',
  Potato: '🥔',
};

export const SOIL_COLORS: Record<SoilType, string> = {
  Alluvial: '#C9B896',
  Black: '#3E3E3E',
  Red: '#C0392B',
  Laterite: '#E74C3C',
  Arid: '#F0E68C',
  'Forest/Mountain': '#556B2F',
};
