// ============================================================
// Core Domain Types for FarmSim AI
// ============================================================

export type FieldStressState =
  | 'healthy'
  | 'moderate_stress'
  | 'high_stress'
  | 'severe_stress'
  | 'flooded'
  | 'drought'
  | 'heat_stress'
  | 'disease';

export interface User {
  id: string;
  name: string;
  email: string;
  location?: string;
  avatar?: string;
  phone?: string;
  preferredLanguage?: string;
  joinedAt?: string;
}

export interface Farm {
  id: string;
  ownerId?: string;
  name: string;
  location: string;
  area: number; // in acres
  latitude?: number;
  longitude?: number;
  numberOfZones?: number;
  boundary?: [number, number][]; // [lat, lng] coordinates of farm boundary polygon
  boundaryAreaAcres?: number;
  boundaryAreaHectares?: number;
  boundaryPerimeterMeters?: number;
  boundaryShape?: 'polygon' | 'rectangle' | 'circle';
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
  pestRisk?: number;
  boundary?: [number, number][]; // [lat, lng] coordinates of field polygon
  boundaryShape?: 'polygon' | 'rectangle' | 'circle';
  stressState?: FieldStressState;
}

export type CropType =
  | 'Rice' | 'Wheat' | 'Maize' | 'Sorghum' | 'Pearl Millet'
  | 'Chickpea' | 'Pigeon Pea' | 'Green Gram' | 'Soybean'
  | 'Groundnut' | 'Mustard' | 'Cotton' | 'Sugarcane' | 'Potato';

export type SoilType =
  | 'Alluvial' | 'Black' | 'Red' | 'Laterite' | 'Arid' | 'Forest/Mountain'
  | 'Loamy' | 'Clay' | 'Sandy' | 'Silty';

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
  scenarioType?: string;
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

export type WeatherMode = 'real_weather' | 'what_if';

export type WhatIfWeatherPreset =
  | 'drought'
  | 'heatwave'
  | 'flood'
  | 'heavy_rain'
  | 'extreme_heat'
  | 'low_rainfall'
  | 'custom';

export interface WeatherModifiers {
  preset?: WhatIfWeatherPreset;
  tempDelta: number; // e.g. +5°C
  rainMultiplier: number; // e.g. 0.2 (80% decrease) or 2.5 (150% increase)
  rainDeltaMm?: number;
  irrigationFailure?: boolean;
  heatwaveActive?: boolean;
}

export interface SimulationRequest {
  farmId: string;
  scenarioId?: string;
  zones: Zone[];
  scenario?: Scenario;
  mode?: WeatherMode;
  weatherModifiers?: WeatherModifiers;
  durationDays?: number;
  structuredScenario?: StructuredScenarioJSON;
}

export interface SimulationResult {
  id: string;
  farmId: string;
  scenarioId?: string;
  scenarioName?: string;
  mode?: WeatherMode;
  weatherModifiers?: WeatherModifiers;
  timeline: TimelinePoint[];
  summary: SimulationSummary;
  baselineSummary?: SimulationSummary;
  comparisonDiff?: {
    cropHealthDiff: number;
    soilMoistureDiff: number;
    yieldDiff: number;
    waterUsageDiff: number;
  };
  decisionSupportNote?: string;
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
  // Weather & Agronomic variables
  temperature?: number;
  rainfall?: number;
  baselineTemperature?: number;
  baselineRainfall?: number;
  waterStress?: number; // 0-100
  heatStress?: number; // 0-100
  pestRisk?: number; // 0-100
  yieldPotential?: number; // 0-100
  weatherCondition?: 'normal' | 'drought' | 'heatwave' | 'flood' | 'rain';
  zones?: ZoneTimeline[];
}

export interface ZoneTimeline {
  zoneId: string;
  zoneName: string;
  crop?: string;
  soil?: string;
  soilMoisture: number;
  cropHealth: number;
  diseaseRisk: number;
  pestRisk?: number;
  waterConsumption: number;
  expectedYield: number;
  waterStress?: number;
  heatStress?: number;
  yieldPotential?: number;
  stressState?: FieldStressState;
}

export interface SimulationSummary {
  totalWaterUsage: number;
  averageCropHealth: number;
  averageDiseaseRisk: number;
  totalExpectedYield: number;
  averageSoilMoisture: number;
  averageWaterStress?: number;
  averageHeatStress?: number;
  averageYieldPotential?: number;
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
  ownerId?: string;
}

export interface ZoneInput {
  id?: string;
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
  pestRisk?: number;
  boundary?: [number, number][];
  boundaryShape?: 'polygon' | 'rectangle' | 'circle';
  stressState?: FieldStressState;
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
  'Loamy', 'Clay', 'Sandy', 'Silty',
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
  Loamy: '#8D6E63',
  Clay: '#BCAAA4',
  Sandy: '#FFE082',
  Silty: '#A1887F',
};

// Re-export Weather Domain Types
export type {
  WeatherData,
  HourlyForecastPoint,
  DailyForecastPoint,
  WeatherAlert,
  WeatherAgronomicImpact,
} from '../services/weather';

// ============================================================
// Person 3: Complete AI Architecture Types
// ============================================================

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskPrediction {
  level: RiskLevel;
  probability: { low: number; medium: number; high: number };
  score: number; // 0 - 100
  contributingFactors: { feature: string; impact: number; description: string }[];
}

export interface FarmRiskAssessmentRF {
  waterStress: RiskPrediction;
  heatStress: RiskPrediction;
  diseaseRisk: RiskPrediction;
  nutrientRisk: RiskPrediction;
  overallScore: number;
  timestamp: string;
}

export interface SuggestedQuickTest {
  id: string;
  title: string;
  description: string;
  scenarioType: ScenarioType;
  durationDays: number;
  triggerRisk: 'WATER_STRESS' | 'HEAT_STRESS' | 'DISEASE_RISK' | 'NUTRIENT_RISK';
  changes: ScenarioChangesPayload;
}

export type ScenarioType =
  | 'RAIN_REDUCTION'
  | 'RAIN_INCREASE'
  | 'TEMPERATURE_INCREASE'
  | 'HEATWAVE'
  | 'IRRIGATION_DECREASE'
  | 'IRRIGATION_INCREASE'
  | 'IRRIGATION_FAILURE'
  | 'FERTILIZER_CHANGES'
  | 'NITROGEN_DEFICIENCY'
  | 'DISEASE_OUTBREAK'
  | 'PEST_OUTBREAK'
  | 'COMBINED';

export interface ScenarioChangesPayload {
  rainfall_multiplier?: number;
  rainfall_delta_mm?: number;
  temperature_delta?: number;
  irrigation_multiplier?: number;
  irrigation_failure?: boolean;
  nitrogen_multiplier?: number;
  nitrogen_delta?: number;
  disease_pressure_delta?: number;
  pest_pressure_delta?: number;
}

export interface StructuredScenarioJSON {
  scenario_type: ScenarioType;
  duration_days: number;
  target_zones: string[];
  changes: ScenarioChangesPayload;
}

export interface MetricDelta {
  metric: string;
  label: string;
  unit: string;
  baselineValue: number;
  scenarioValue: number;
  absoluteChange: number;
  percentageChange: number;
  direction: 'INCREASED' | 'DECREASED' | 'UNCHANGED';
  impactSeverity: 'LOW' | 'MODERATE' | 'SEVERE';
  isFavorable: boolean;
}

export interface TradeOffItem {
  positiveAspect: string;
  negativeAspect: string;
  description: string;
}

export interface FarmerExplanation {
  summary: string;
  impactSeverity: 'LOW' | 'MODERATE' | 'SEVERE';
  importantChanges: string[];
  tradeOffs: TradeOffItem[];
  recommendations: string[];
  metricDeltas: MetricDelta[];
}

export interface RiskFactor {
  field: string;
  value: string | number;
  contribution: number;
  message: string;
}

export interface ZoneRiskAssessment {
  zoneId: string;
  zoneName: string;
  waterStress?: RiskPrediction | any;
  heatStress?: RiskPrediction | any;
  diseaseRisk?: RiskPrediction | any;
  nutrientRisk?: RiskPrediction | any;
  topContributingFactors: RiskFactor[];
}

export interface FarmRiskAssessment {
  farmId: string;
  overallRisk: RiskLevel;
  zoneRisks: ZoneRiskAssessment[];
  modelVersion: string;
  assessedAt?: string;
}

export interface ScenarioSuggestion {
  id: string;
  title: string;
  description: string;
  priority: RiskLevel;
  scenarioType: string;
  duration: number;
  targetZones: string[];
  changes: Record<string, number>;
}
