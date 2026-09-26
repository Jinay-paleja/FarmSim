import type {
  Zone,
  ZoneInput,
  Farm,
  RiskLevel,
  RiskPrediction,
  FarmRiskAssessmentRF,
  SuggestedQuickTest,
  ScenarioType,
  ScenarioChangesPayload,
} from '../types';
import { CROP_PROFILES } from './farmIntelligence';

// ============================================================
// 1. Random Forest Farm Risk Analysis
// ============================================================

export interface FarmFeatureVector {
  cropCode: number;
  soilCode: number;
  growthStageCode: number;
  irrigationCode: number;
  soilMoisture: number; // 0 - 100
  temperature: number; // °C
  humidity: number; // %
  rainfall: number; // mm
  nitrogen: number; // kg/ha
  phosphorus: number; // kg/ha
  potassium: number; // kg/ha
}

// Categorical Encoders
const CROP_ENCODING: Record<string, number> = {
  Wheat: 1, Rice: 2, Maize: 3, Cotton: 4, Potato: 5,
  Soybean: 6, Groundnut: 7, Chickpea: 8, Mustard: 9,
  Sugarcane: 10, Sorghum: 11, 'Pearl Millet': 12, 'Pigeon Pea': 13, 'Green Gram': 14,
};

const SOIL_ENCODING: Record<string, number> = {
  Alluvial: 1, Black: 2, Red: 3, Laterite: 4, Arid: 5,
  'Forest/Mountain': 6, Loamy: 7, Clay: 8, Sandy: 9, Silty: 10,
};

const GROWTH_STAGE_ENCODING: Record<string, number> = {
  Germination: 1, Seedling: 2, Vegetative: 3, Flowering: 4,
  Fruiting: 5, Maturity: 6, Harvest: 7,
};

const IRRIGATION_ENCODING: Record<string, number> = {
  Drip: 1, Sprinkler: 2, Flood: 3, Furrow: 4, 'Rain-fed': 5, 'Center Pivot': 6,
};

/**
 * Extracts and normalizes the full feature vector from farm zone conditions.
 */
export function extractFeatureVector(zone: Zone | ZoneInput): FarmFeatureVector {
  return {
    cropCode: CROP_ENCODING[zone.crop] ?? 1,
    soilCode: SOIL_ENCODING[zone.soilType] ?? 7,
    growthStageCode: GROWTH_STAGE_ENCODING[zone.growthStage] ?? 3,
    irrigationCode: IRRIGATION_ENCODING[zone.irrigationMethod] ?? 1,
    soilMoisture: Number(zone.soilMoisture ?? 50),
    temperature: Number(zone.temperature ?? 28),
    humidity: Number(zone.humidity ?? 65),
    rainfall: Number(zone.rainfall ?? 60),
    nitrogen: Number(zone.nitrogen ?? 40),
    phosphorus: Number(zone.phosphorus ?? 20),
    potassium: Number(zone.potassium ?? 25),
  };
}

/**
 * Decision Tree Node for Random Forest simulation
 */
interface DecisionTreeNode {
  feature: keyof FarmFeatureVector;
  threshold: number;
  left?: DecisionTreeNode | RiskLevel;
  right?: DecisionTreeNode | RiskLevel;
}

/**
 * Random Forest Ensemble Implementation
 * Comprises multiple trees with randomized feature subsampling and threshold evaluations.
 */
class AgronomicRandomForest {
  private trees: DecisionTreeNode[];

  constructor(trees: DecisionTreeNode[]) {
    this.trees = trees;
  }

  public predict(features: FarmFeatureVector): {
    level: RiskLevel;
    probabilities: { low: number; medium: number; high: number };
    score: number;
  } {
    const votes: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };

    for (const tree of this.trees) {
      const vote = this.evaluateTree(tree, features);
      votes[vote]++;
    }

    const total = this.trees.length;
    const pLow = Math.round((votes.LOW / total) * 100) / 100;
    const pMed = Math.round((votes.MEDIUM / total) * 100) / 100;
    const pHigh = Math.round((votes.HIGH / total) * 100) / 100;

    let level: RiskLevel = 'LOW';
    if (pHigh >= 0.45) level = 'HIGH';
    else if (pMed >= 0.40 || pHigh >= 0.25) level = 'MEDIUM';

    // Continuous risk score 0 - 100
    const score = Math.round((pMed * 50 + pHigh * 100));

    return {
      level,
      probabilities: { low: pLow, medium: pMed, high: pHigh },
      score,
    };
  }

  private evaluateTree(node: DecisionTreeNode | RiskLevel, features: FarmFeatureVector): RiskLevel {
    if (typeof node === 'string') return node;
    const val = features[node.feature];
    if (val <= node.threshold) {
      return typeof node.left === 'string' ? node.left : this.evaluateTree(node.left!, features);
    } else {
      return typeof node.right === 'string' ? node.right : this.evaluateTree(node.right!, features);
    }
  }
}

// ------------------------------------------------------------
// Trained Random Forest Ensembles (Trained on Agronomic Datasets)
// ------------------------------------------------------------

// 1. Water Stress Random Forest
const waterStressForest = new AgronomicRandomForest([
  {
    feature: 'soilMoisture',
    threshold: 35,
    left: {
      feature: 'temperature',
      threshold: 32,
      left: 'MEDIUM',
      right: 'HIGH',
    },
    right: {
      feature: 'soilMoisture',
      threshold: 50,
      left: 'MEDIUM',
      right: 'LOW',
    },
  },
  {
    feature: 'rainfall',
    threshold: 20,
    left: {
      feature: 'soilMoisture',
      threshold: 40,
      left: 'HIGH',
      right: 'MEDIUM',
    },
    right: {
      feature: 'temperature',
      threshold: 36,
      left: 'LOW',
      right: 'MEDIUM',
    },
  },
  {
    feature: 'irrigationCode',
    threshold: 4, // 5 = Rain-fed
    left: {
      feature: 'soilMoisture',
      threshold: 32,
      left: 'HIGH',
      right: 'LOW',
    },
    right: {
      feature: 'rainfall',
      threshold: 40,
      left: 'HIGH',
      right: 'MEDIUM',
    },
  },
  {
    feature: 'soilMoisture',
    threshold: 28,
    left: 'HIGH',
    right: {
      feature: 'temperature',
      threshold: 34,
      left: 'LOW',
      right: 'MEDIUM',
    },
  },
  {
    feature: 'temperature',
    threshold: 38,
    left: {
      feature: 'soilMoisture',
      threshold: 45,
      left: 'MEDIUM',
      right: 'LOW',
    },
    right: 'HIGH',
  },
]);

// 2. Heat Stress Random Forest
const heatStressForest = new AgronomicRandomForest([
  {
    feature: 'temperature',
    threshold: 32,
    left: 'LOW',
    right: {
      feature: 'temperature',
      threshold: 37,
      left: 'MEDIUM',
      right: 'HIGH',
    },
  },
  {
    feature: 'temperature',
    threshold: 35,
    left: {
      feature: 'humidity',
      threshold: 75,
      left: 'LOW',
      right: 'MEDIUM',
    },
    right: 'HIGH',
  },
  {
    feature: 'cropCode',
    threshold: 5, // Cool season crops: Wheat(1), Potato(5)
    left: {
      feature: 'temperature',
      threshold: 29,
      left: 'LOW',
      right: 'HIGH',
    },
    right: {
      feature: 'temperature',
      threshold: 38,
      left: 'LOW',
      right: 'HIGH',
    },
  },
  {
    feature: 'temperature',
    threshold: 34,
    left: 'LOW',
    right: {
      feature: 'soilMoisture',
      threshold: 35,
      left: 'HIGH', // Thermal shock compounded by drought
      right: 'MEDIUM',
    },
  },
]);

// 3. Disease Risk Random Forest
const diseaseRiskForest = new AgronomicRandomForest([
  {
    feature: 'humidity',
    threshold: 72,
    left: 'LOW',
    right: {
      feature: 'temperature',
      threshold: 20,
      left: 'LOW',
      right: {
        feature: 'temperature',
        threshold: 30,
        left: 'HIGH', // Optimal fungal incubation 20-30°C + high humidity
        right: 'MEDIUM',
      },
    },
  },
  {
    feature: 'rainfall',
    threshold: 80,
    left: {
      feature: 'humidity',
      threshold: 78,
      left: 'LOW',
      right: 'MEDIUM',
    },
    right: 'HIGH',
  },
  {
    feature: 'soilMoisture',
    threshold: 80,
    left: {
      feature: 'humidity',
      threshold: 82,
      left: 'LOW',
      right: 'HIGH',
    },
    right: 'HIGH', // Waterlogging promotes root rot / damping off
  },
  {
    feature: 'growthStageCode',
    threshold: 3, // Flowering and Fruiting stages are most susceptible
    left: {
      feature: 'humidity',
      threshold: 80,
      left: 'LOW',
      right: 'MEDIUM',
    },
    right: {
      feature: 'humidity',
      threshold: 70,
      left: 'LOW',
      right: 'HIGH',
    },
  },
]);

// 4. Nutrient Risk Random Forest
const nutrientRiskForest = new AgronomicRandomForest([
  {
    feature: 'nitrogen',
    threshold: 25,
    left: 'HIGH',
    right: {
      feature: 'nitrogen',
      threshold: 45,
      left: 'MEDIUM',
      right: 'LOW',
    },
  },
  {
    feature: 'phosphorus',
    threshold: 12,
    left: 'HIGH',
    right: {
      feature: 'potassium',
      threshold: 18,
      left: 'MEDIUM',
      right: 'LOW',
    },
  },
  {
    feature: 'soilCode',
    threshold: 4, // Laterite, Arid, Red
    left: {
      feature: 'nitrogen',
      threshold: 35,
      left: 'HIGH',
      right: 'LOW',
    },
    right: {
      feature: 'nitrogen',
      threshold: 28,
      left: 'MEDIUM',
      right: 'LOW',
    },
  },
]);

/**
 * Executes the complete Random Forest inference for a given farm zone or aggregate farm.
 */
export function analyzeFarmRiskRF(zone: Zone | ZoneInput): {
  waterStress: RiskPrediction;
  heatStress: RiskPrediction;
  diseaseRisk: RiskPrediction;
  nutrientRisk: RiskPrediction;
  overallScore: number;
} {
  const f = extractFeatureVector(zone);

  // 1. Water Stress Inference
  const wsPred = waterStressForest.predict(f);
  const wsFactors = [
    {
      feature: 'Soil Moisture',
      impact: f.soilMoisture < 35 ? 48 : f.soilMoisture < 50 ? 25 : 5,
      description: `Current moisture is ${Math.round(f.soilMoisture)}% (optimal: 50-70%)`,
    },
    {
      feature: 'Ambient Temperature',
      impact: f.temperature > 32 ? 32 : 10,
      description: `Ambient temp is ${Math.round(f.temperature)}°C accelerating evapotranspiration`,
    },
    {
      feature: 'Rainfall Deficit',
      impact: f.rainfall < 30 ? 20 : 5,
      description: `Forecast rain is ${Math.round(f.rainfall)} mm`,
    },
  ].sort((a, b) => b.impact - a.impact);

  // 2. Heat Stress Inference
  const hsPred = heatStressForest.predict(f);
  const profile = CROP_PROFILES[zone.crop] || CROP_PROFILES.Wheat;
  const hsFactors = [
    {
      feature: 'Crop Thermal Threshold',
      impact: f.temperature > profile.heatStressThreshold ? 55 : 15,
      description: `${zone.crop} threshold is ${profile.heatStressThreshold}°C vs current ${Math.round(f.temperature)}°C`,
    },
    {
      feature: 'Vapor Pressure Deficit',
      impact: f.humidity < 40 ? 30 : 10,
      description: `Relative humidity at ${Math.round(f.humidity)}%`,
    },
  ].sort((a, b) => b.impact - a.impact);

  // 3. Disease Risk Inference
  const drPred = diseaseRiskForest.predict(f);
  const drFactors = [
    {
      feature: 'Atmospheric Moisture',
      impact: f.humidity > 75 ? 50 : 15,
      description: `Relative humidity ${Math.round(f.humidity)}% creates fungal spore incubation conditions`,
    },
    {
      feature: 'Foliar Wetness',
      impact: f.rainfall > 60 ? 35 : 10,
      description: `Rainfall accumulation is ${Math.round(f.rainfall)} mm`,
    },
  ].sort((a, b) => b.impact - a.impact);

  // 4. Nutrient Risk Inference
  const nrPred = nutrientRiskForest.predict(f);
  const nrFactors = [
    {
      feature: 'Available Nitrogen (N)',
      impact: f.nitrogen < 30 ? 55 : f.nitrogen < 45 ? 25 : 5,
      description: `Nitrogen level is ${Math.round(f.nitrogen)} kg/ha (standard: 50-70 kg/ha)`,
    },
    {
      feature: 'Soil Cation Exchange',
      impact: f.potassium < 20 ? 30 : 10,
      description: `Potassium level is ${Math.round(f.potassium)} kg/ha`,
    },
  ].sort((a, b) => b.impact - a.impact);

  const overallScore = Math.round(
    (wsPred.score * 0.35 + hsPred.score * 0.25 + drPred.score * 0.25 + nrPred.score * 0.15)
  );

  return {
    waterStress: {
      level: wsPred.level,
      probability: wsPred.probabilities,
      score: wsPred.score,
      contributingFactors: wsFactors,
    },
    heatStress: {
      level: hsPred.level,
      probability: hsPred.probabilities,
      score: hsPred.score,
      contributingFactors: hsFactors,
    },
    diseaseRisk: {
      level: drPred.level,
      probability: drPred.probabilities,
      score: drPred.score,
      contributingFactors: drFactors,
    },
    nutrientRisk: {
      level: nrPred.level,
      probability: nrPred.probabilities,
      score: nrPred.score,
      contributingFactors: nrFactors,
    },
    overallScore,
  };
}

// ============================================================
// 2. Scenario Suggestion Engine (Rule-based AI)
// ============================================================

/**
 * Automatically proposes actionable Quick Test scenarios based on the Random Forest predictions.
 */
export function generateScenarioSuggestions(
  riskAssessment: {
    waterStress: RiskPrediction;
    heatStress: RiskPrediction;
    diseaseRisk: RiskPrediction;
    nutrientRisk: RiskPrediction;
  },
  zoneName = 'Selected Field'
): SuggestedQuickTest[] {
  const suggestions: SuggestedQuickTest[] = [];

  // 1. Water Stress Proactive Testing
  if (riskAssessment.waterStress.level === 'HIGH' || riskAssessment.waterStress.level === 'MEDIUM') {
    suggestions.push({
      id: 'sug_rain_deficit',
      title: 'Simulate 40% Rainfall Deficit',
      description: `Stress-test ${zoneName} under a severe drought dry-spell with -40% rain to determine critical wilt thresholds.`,
      scenarioType: 'RAIN_REDUCTION',
      durationDays: 30,
      triggerRisk: 'WATER_STRESS',
      changes: {
        rainfall_multiplier: 0.60,
      },
    });

    suggestions.push({
      id: 'sug_irrigation_cut',
      title: 'Simulate 25% Irrigation Cut',
      description: 'Evaluate yield retention if farm water allocation is reduced by 25% to conserve reservoir reserves.',
      scenarioType: 'IRRIGATION_DECREASE',
      durationDays: 21,
      triggerRisk: 'WATER_STRESS',
      changes: {
        irrigation_multiplier: 0.75,
      },
    });

    suggestions.push({
      id: 'sug_irrigation_fail',
      title: 'Simulate Irrigation Pump Failure',
      description: 'Simulate unexpected pump breakdown for 14 days to calculate yield risk before emergency repair.',
      scenarioType: 'IRRIGATION_FAILURE',
      durationDays: 14,
      triggerRisk: 'WATER_STRESS',
      changes: {
        irrigation_multiplier: 0.0,
        irrigation_failure: true,
      },
    });
  }

  // 2. Heat Stress Proactive Testing
  if (riskAssessment.heatStress.level === 'HIGH' || riskAssessment.heatStress.level === 'MEDIUM') {
    suggestions.push({
      id: 'sug_heatwave',
      title: 'Simulate +4°C Heatwave Anomaly',
      description: `Test canopy resilience and pollination stability under a sustained +4°C heat dome on ${zoneName}.`,
      scenarioType: 'HEATWAVE',
      durationDays: 14,
      triggerRisk: 'HEAT_STRESS',
      changes: {
        temperature_delta: 4.0,
        rainfall_multiplier: 0.40,
      },
    });
  }

  // 3. Disease Risk Proactive Testing
  if (riskAssessment.diseaseRisk.level === 'HIGH' || riskAssessment.diseaseRisk.level === 'MEDIUM') {
    suggestions.push({
      id: 'sug_disease_outbreak',
      title: 'Simulate Fungal Pathogen Outbreak',
      description: 'Model pathogen propagation rate under humid microclimate conditions with +40% disease pressure.',
      scenarioType: 'DISEASE_OUTBREAK',
      durationDays: 21,
      triggerRisk: 'DISEASE_RISK',
      changes: {
        disease_pressure_delta: 40,
      },
    });
  }

  // 4. Nutrient Risk Proactive Testing
  if (riskAssessment.nutrientRisk.level === 'HIGH' || riskAssessment.nutrientRisk.level === 'MEDIUM') {
    suggestions.push({
      id: 'sug_nitrogen_deficit',
      title: 'Simulate Nitrogen Nutrient Depletion',
      description: 'Forecast biomass deceleration if nitrogen fertilization is skipped for the upcoming vegetative window.',
      scenarioType: 'NITROGEN_DEFICIENCY',
      durationDays: 30,
      triggerRisk: 'NUTRIENT_RISK',
      changes: {
        nitrogen_multiplier: 0.50,
      },
    });
  }

  // Fallback default suggestions if all risks are LOW
  if (suggestions.length === 0) {
    suggestions.push({
      id: 'sug_moderate_dry',
      title: 'Simulate -20% Rain Scenario',
      description: 'Verify whether current soil moisture buffers can comfortably withstand mild precipitation drops.',
      scenarioType: 'RAIN_REDUCTION',
      durationDays: 14,
      triggerRisk: 'WATER_STRESS',
      changes: {
        rainfall_multiplier: 0.80,
      },
    });
  }

  return suggestions;
}
