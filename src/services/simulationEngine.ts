import type {
  Farm,
  Zone,
  SimulationResult,
  TimelinePoint,
  ZoneTimeline,
  SimulationSummary,
  WeatherMode,
  WhatIfWeatherPreset,
  WeatherModifiers,
  FieldStressState,
  CropType,
  SoilType,
  StructuredScenarioJSON,
} from '../types';
import type { WeatherData } from './weather';
import { CROP_PROFILES, SOIL_CHARACTERISTICS } from './farmIntelligence';

export interface SimulationRunOptions {
  farmId: string;
  scenarioName?: string;
  zones: Zone[];
  weather?: WeatherData | null;
  mode?: WeatherMode;
  weatherModifiers?: WeatherModifiers;
  durationDays?: number;
  structuredScenario?: StructuredScenarioJSON;
}

/**
 * Fallback baseline crop profile if crop is not mapped in CROP_PROFILES
 */
const DEFAULT_CROP_PROFILE = {
  optimalTempMin: 18,
  optimalTempMax: 30,
  heatStressThreshold: 34,
  frostThreshold: 2,
  optimalMoistureMin: 50,
  optimalMoistureMax: 75,
  criticalWiltingMoisture: 30,
  waterloggedMoisture: 85,
  dailyWaterNeedMm: 5.0,
  humidityDiseaseThreshold: 75,
  susceptibleDiseases: ['Leaf Spot', 'Blight'],
};

/**
 * Fallback soil profile
 */
const DEFAULT_SOIL = {
  waterRetention: 'medium' as const,
  drainage: 'moderate' as const,
  description: 'Balanced soil profile.',
};

/**
 * Standard preset modifier values for What-If scenarios
 */
export const WHAT_IF_PRESETS: Record<
  WhatIfWeatherPreset,
  { label: string; tempDelta: number; rainMultiplier: number; description: string; rainDeltaMm?: number }
> = {
  drought: {
    label: 'Drought (Extreme Dry)',
    tempDelta: 3.5,
    rainMultiplier: 0.1,
    description: 'Extended dry spell with reduced precipitation and elevated transpiration.',
  },
  heatwave: {
    label: 'Heatwave (+6°C)',
    tempDelta: 6.0,
    rainMultiplier: 0.4,
    description: 'High thermal stress exceeding physiological thresholds for cool/temperate crops.',
  },
  flood: {
    label: 'Flood & Inundation',
    tempDelta: -2.0,
    rainMultiplier: 3.5,
    rainDeltaMm: 35,
    description: 'Severe precipitation leading to soil waterlogging and aeration deficit.',
  },
  heavy_rain: {
    label: 'Heavy Rainstorm',
    tempDelta: -1.0,
    rainMultiplier: 2.8,
    rainDeltaMm: 22,
    description: 'Intense rain event increasing runoff risk and fungal disease vectors.',
  },
  extreme_heat: {
    label: 'Extreme Heat (+8°C)',
    tempDelta: 8.0,
    rainMultiplier: 0.2,
    description: 'Severe heatwave causing rapid canopy desiccation and pollen sterility.',
  },
  low_rainfall: {
    label: 'Low Rainfall (-75%)',
    tempDelta: 1.5,
    rainMultiplier: 0.25,
    description: 'Below-average seasonal rainfall depleting surface root-zone moisture.',
  },
  custom: {
    label: 'Custom What-If Modifiers',
    tempDelta: 0,
    rainMultiplier: 1.0,
    description: 'User-specified temperature deltas and precipitation multipliers.',
  },
};

/**
 * Runs a dual simulation:
 * 1. Mode 1: REAL WEATHER BASELINE (actual Open-Meteo telemetry & forecast)
 * 2. Mode 2: WHAT-IF WEATHER SCENARIO (farmer adjusted temperature & rain modifiers)
 *
 * Calculates per timestep:
 * Temperature, Rainfall, Soil Moisture, Crop Health, Water Stress, Heat Stress, Disease Risk, Pest Risk, Yield Potential
 * Evaluates individual field differences based on Crop, Soil, Area, Current Moisture, and Irrigation.
 */
export function runComprehensiveSimulation(options: SimulationRunOptions): SimulationResult {
  const {
    farmId,
    scenarioName = 'Simulation',
    zones,
    weather,
    mode = 'real_weather',
    weatherModifiers = { tempDelta: 0, rainMultiplier: 1.0 },
    durationDays = 14,
    structuredScenario,
  } = options;

  const effectiveModifiers: WeatherModifiers = {
    ...weatherModifiers,
    tempDelta: structuredScenario?.changes?.temperature_delta ?? weatherModifiers.tempDelta ?? 0,
    rainMultiplier: structuredScenario?.changes?.rainfall_multiplier ?? weatherModifiers.rainMultiplier ?? 1.0,
    irrigationFailure: structuredScenario?.changes?.irrigation_failure ?? weatherModifiers.irrigationFailure ?? false,
  };

  const effectiveDuration = structuredScenario?.duration_days ?? durationDays;
  const effectiveMode: WeatherMode = structuredScenario
    ? 'what_if'
    : mode;

  const numDays = Math.max(3, Math.min(60, effectiveDuration));

  // 1. Run Baseline (Real Weather Mode without modifiers)
  const baselineTimeline = simulateTimeline(farmId, zones, weather, 'real_weather', {
    tempDelta: 0,
    rainMultiplier: 1.0,
  }, numDays);
  const baselineSummary = calculateSummary(baselineTimeline);

  // 2. Run Active Scenario (Real Weather or What-If)
  const activeTimeline = effectiveMode === 'real_weather'
    ? baselineTimeline
    : simulateTimeline(farmId, zones, weather, 'what_if', effectiveModifiers, numDays);
  const activeSummary = calculateSummary(activeTimeline);

  // 3. Comparison deltas (Baseline vs Scenario)
  const comparisonDiff = {
    cropHealthDiff: Math.round((activeSummary.averageCropHealth - baselineSummary.averageCropHealth) * 10) / 10,
    soilMoistureDiff: Math.round((activeSummary.averageSoilMoisture - baselineSummary.averageSoilMoisture) * 10) / 10,
    yieldDiff: Math.round((activeSummary.totalExpectedYield - baselineSummary.totalExpectedYield) * 10) / 10,
    waterUsageDiff: Math.round(activeSummary.totalWaterUsage - baselineSummary.totalWaterUsage),
  };

  // 4. Generate Decision Support explanation ("What is likely to happen if this condition continues?")
  const { aiExplanation, decisionSupportNote } = generateAgronomicExplanation(
    mode,
    weatherModifiers,
    zones,
    activeSummary,
    baselineSummary,
    comparisonDiff
  );

  return {
    id: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    farmId,
    scenarioName: mode === 'what_if'
      ? `${scenarioName} (${weatherModifiers.preset ? WHAT_IF_PRESETS[weatherModifiers.preset]?.label : 'What-If'})`
      : `${scenarioName} (Real Weather Baseline)`,
    mode,
    weatherModifiers,
    timeline: activeTimeline,
    summary: activeSummary,
    baselineSummary: mode === 'what_if' ? baselineSummary : undefined,
    comparisonDiff: mode === 'what_if' ? comparisonDiff : undefined,
    decisionSupportNote,
    aiExplanation,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Simulates day-by-day progression for all zones
 */
function simulateTimeline(
  farmId: string,
  initialZones: Zone[],
  weather: WeatherData | null | undefined,
  mode: WeatherMode,
  modifiers: WeatherModifiers,
  numDays: number
): TimelinePoint[] {
  const currentTemp = weather?.temperature ?? 28;
  const currentRain = weather?.rain ?? 0;
  const dailyForecast = weather?.daily ?? [];

  // Track state for each zone across days
  const zoneStates = (initialZones && initialZones.length > 0
    ? initialZones
    : createDefaultMockZones(farmId)
  ).map((z) => ({
    zoneId: z.id,
    zoneName: z.name,
    crop: z.crop,
    soil: z.soilType,
    areaAcres: z.area || 10,
    irrigation: z.irrigationMethod || 'Drip',
    moisture: z.soilMoisture || 60,
    health: z.healthScore || 85,
    disease: z.diseaseRisk || 15,
    pest: z.pestRisk || 15,
    yieldPotential: 92,
    cumulativeWaterLiters: 0,
  }));

  const timelinePoints: TimelinePoint[] = [];

  for (let day = 1; day <= numDays; day++) {
    const dayIdx = day - 1;
    const forecastDay = dailyForecast[dayIdx % Math.max(1, dailyForecast.length)];

    // Real Weather Baseline for this day
    const baselineTemp = forecastDay
      ? forecastDay.tempMax
      : currentTemp + Math.sin(day * 0.8) * 2.5;

    const baselineRain = forecastDay
      ? forecastDay.precipitationSum
      : (day === 2 ? 8.5 : day === 5 ? 14.0 : currentRain);

    // Simulated Weather (with modifiers if in what_if mode)
    let simTemp = baselineTemp;
    let simRain = baselineRain;

    if (mode === 'what_if') {
      const presetInfo = modifiers.preset ? WHAT_IF_PRESETS[modifiers.preset] : null;
      const tDelta = modifiers.tempDelta !== undefined ? modifiers.tempDelta : (presetInfo?.tempDelta ?? 0);
      const rMult = modifiers.rainMultiplier !== undefined ? modifiers.rainMultiplier : (presetInfo?.rainMultiplier ?? 1.0);
      const rDelta = modifiers.rainDeltaMm ?? presetInfo?.rainDeltaMm ?? 0;

      simTemp = Math.round((baselineTemp + tDelta) * 10) / 10;
      simRain = Math.max(0, Math.round((baselineRain * rMult + rDelta) * 10) / 10);
    }

    // Weather condition badge
    let weatherCondition: 'normal' | 'drought' | 'heatwave' | 'flood' | 'rain' = 'normal';
    if (modifiers.preset === 'flood' || simRain >= 30) {
      weatherCondition = 'flood';
    } else if (simRain >= 12 || modifiers.preset === 'heavy_rain') {
      weatherCondition = 'rain';
    } else if (modifiers.preset === 'heatwave' || modifiers.preset === 'extreme_heat' || simTemp >= 36) {
      weatherCondition = 'heatwave';
    } else if (modifiers.preset === 'drought' || modifiers.preset === 'low_rainfall' || (simTemp > 31 && simRain < 1.0)) {
      weatherCondition = 'drought';
    }

    // Process each zone independently
    const zoneTimelines: ZoneTimeline[] = [];
    let dayTotalWaterLiters = 0;
    let dayAvgMoisture = 0;
    let dayAvgHealth = 0;
    let dayAvgDisease = 0;
    let dayAvgPest = 0;
    let dayAvgWaterStress = 0;
    let dayAvgHeatStress = 0;
    let dayAvgYield = 0;

    for (const z of zoneStates) {
      const cropProf = CROP_PROFILES[z.crop as CropType] || DEFAULT_CROP_PROFILE;
      const soilProf = SOIL_CHARACTERISTICS[z.soil as SoilType] || DEFAULT_SOIL;

      // 1. Soil Drainage and Water Infiltration
      // Clay retains moisture (slow drainage), Sand loses moisture quickly (fast drainage)
      const drainageRate = soilProf.drainage === 'fast' ? 5.5 : soilProf.drainage === 'slow' ? 1.8 : 3.2;
      const infiltrationMult = soilProf.waterRetention === 'high' ? 0.95 : soilProf.waterRetention === 'low' ? 0.6 : 0.8;

      // Effective rain reaching root zone
      const effectiveRainMm = simRain * infiltrationMult;

      // Evapotranspiration ET (increases significantly in heat)
      const tempFactor = Math.max(0.6, 1.0 + (simTemp - 22) * 0.045);
      const dailyET = cropProf.dailyWaterNeedMm * tempFactor;

      // Irrigation buffering
      let irrigationMm = 0;
      const isRainfed = z.irrigation.toLowerCase().includes('rain-fed') || z.irrigation.toLowerCase().includes('rainfed');
      const isIrrigationFailed = modifiers.irrigationFailure === true;

      if (!isRainfed && !isIrrigationFailed && z.moisture < cropProf.optimalMoistureMin) {
        // Drip irrigation provides targeted water, Sprinkler moderate
        irrigationMm = z.irrigation.toLowerCase().includes('drip') ? 4.5 : 6.0;
      }

      // Calculate new soil moisture
      const deltaMoisture = (effectiveRainMm * 1.8) + (irrigationMm * 1.5) - (dailyET * 1.2) - (drainageRate * 0.5);
      z.moisture = Math.max(8, Math.min(98, z.moisture + deltaMoisture));

      // 2. Water Stress Calculation
      let waterStress = 0;
      if (z.moisture < cropProf.optimalMoistureMin) {
        const span = Math.max(5, cropProf.optimalMoistureMin - cropProf.criticalWiltingMoisture);
        const deficit = cropProf.optimalMoistureMin - z.moisture;
        waterStress = Math.min(100, Math.round((deficit / span) * 100));
      } else if (z.moisture > cropProf.waterloggedMoisture) {
        // Anaerobic saturation stress
        const excess = z.moisture - cropProf.waterloggedMoisture;
        waterStress = Math.min(80, Math.round(excess * 6));
      }

      // 3. Heat Stress Calculation
      let heatStress = 0;
      if (simTemp > cropProf.heatStressThreshold) {
        const excessTemp = simTemp - cropProf.heatStressThreshold;
        heatStress = Math.min(100, Math.round(excessTemp * 16));
      }

      // 4. Disease Risk Calculation
      // High humidity + rain + warm temperatures promote fungal pathogens
      if (simRain > 15 || z.moisture > 82) {
        z.disease = Math.min(95, z.disease + 4.5);
      } else if (simTemp > 34 && simRain < 2) {
        z.disease = Math.max(5, z.disease - 2.5); // Fungal diseases decline in dry heat
      } else {
        z.disease = Math.max(10, Math.min(90, z.disease + (Math.random() - 0.5) * 2));
      }

      // 5. Pest Risk Calculation
      // Hot dry weather favors mites, thrips, aphids
      if (simTemp > 32 && simRain < 3) {
        z.pest = Math.min(90, z.pest + 3.8);
      } else if (simRain > 18) {
        z.pest = Math.max(8, z.pest - 4.0); // Heavy rain washes away foliage insects
      } else {
        z.pest = Math.max(10, Math.min(85, z.pest + (Math.random() - 0.5) * 2));
      }

      // 6. Crop Health Evolution
      let healthPenalty = 0;
      if (waterStress > 30) healthPenalty += (waterStress - 30) * 0.08;
      if (heatStress > 30) healthPenalty += (heatStress - 30) * 0.07;
      if (z.disease > 45) healthPenalty += (z.disease - 45) * 0.05;
      if (z.pest > 45) healthPenalty += (z.pest - 45) * 0.04;

      if (healthPenalty > 0) {
        z.health = Math.max(10, z.health - healthPenalty);
      } else {
        // Recovery when stress is low
        z.health = Math.min(98, z.health + 0.8);
      }

      // 7. Yield Potential Degradation
      if (waterStress > 60 || heatStress > 60) {
        z.yieldPotential = Math.max(20, z.yieldPotential - 1.2);
      } else if (z.health < 60) {
        z.yieldPotential = Math.max(25, z.yieldPotential - 0.5);
      }

      // 8. Water Consumption
      // 1 mm rain/irrigation on 1 acre = 4,046.86 Liters
      const dailyWaterLiters = Math.round((irrigationMm + dailyET) * z.areaAcres * 4046.86);
      z.cumulativeWaterLiters += dailyWaterLiters;

      // Field stress state for visual styling on the map
      let stressState: FieldStressState = 'healthy';
      if (z.moisture > 88 || weatherCondition === 'flood') {
        stressState = 'flooded';
      } else if (waterStress >= 55 || z.moisture < 25) {
        stressState = 'drought';
      } else if (heatStress >= 55) {
        stressState = 'heat_stress';
      } else if (z.disease >= 55) {
        stressState = 'disease';
      } else if (z.health < 45) {
        stressState = 'severe_stress';
      } else if (z.health < 70) {
        stressState = 'moderate_stress';
      }

      zoneTimelines.push({
        zoneId: z.zoneId,
        zoneName: z.zoneName,
        crop: z.crop,
        soil: z.soil,
        soilMoisture: Math.round(z.moisture * 10) / 10,
        cropHealth: Math.round(z.health * 10) / 10,
        diseaseRisk: Math.round(z.disease * 10) / 10,
        pestRisk: Math.round(z.pest * 10) / 10,
        waterConsumption: dailyWaterLiters,
        expectedYield: Math.round(z.yieldPotential * 10) / 10,
        waterStress,
        heatStress,
        yieldPotential: Math.round(z.yieldPotential * 10) / 10,
        stressState,
      });

      dayTotalWaterLiters += dailyWaterLiters;
      dayAvgMoisture += z.moisture;
      dayAvgHealth += z.health;
      dayAvgDisease += z.disease;
      dayAvgPest += z.pest;
      dayAvgWaterStress += waterStress;
      dayAvgHeatStress += heatStress;
      dayAvgYield += z.yieldPotential;
    }

    const nZones = Math.max(1, zoneStates.length);

    timelinePoints.push({
      day,
      label: `Day ${day}`,
      soilMoisture: Math.round((dayAvgMoisture / nZones) * 10) / 10,
      cropHealth: Math.round((dayAvgHealth / nZones) * 10) / 10,
      diseaseRisk: Math.round((dayAvgDisease / nZones) * 10) / 10,
      pestRisk: Math.round((dayAvgPest / nZones) * 10) / 10,
      waterConsumption: dayTotalWaterLiters,
      expectedYield: Math.round((dayAvgYield / nZones) * 10) / 10,
      yieldPotential: Math.round((dayAvgYield / nZones) * 10) / 10,
      waterStress: Math.round(dayAvgWaterStress / nZones),
      heatStress: Math.round(dayAvgHeatStress / nZones),
      temperature: Math.round(simTemp * 10) / 10,
      rainfall: Math.round(simRain * 10) / 10,
      baselineTemperature: Math.round(baselineTemp * 10) / 10,
      baselineRainfall: Math.round(baselineRain * 10) / 10,
      weatherCondition,
      zones: zoneTimelines,
    });
  }

  return timelinePoints;
}

/**
 * Calculates aggregate summary across the timeline
 */
function calculateSummary(timeline: TimelinePoint[]): SimulationSummary {
  if (!timeline || timeline.length === 0) {
    return {
      totalWaterUsage: 0,
      averageCropHealth: 80,
      averageDiseaseRisk: 15,
      totalExpectedYield: 85,
      averageSoilMoisture: 60,
    };
  }

  const len = timeline.length;
  const lastPoint = timeline[len - 1];

  let sumHealth = 0;
  let sumDisease = 0;
  let sumMoisture = 0;
  let sumWater = 0;
  let sumWaterStress = 0;
  let sumHeatStress = 0;

  for (const pt of timeline) {
    sumHealth += pt.cropHealth;
    sumDisease += pt.diseaseRisk;
    sumMoisture += pt.soilMoisture;
    sumWater += pt.waterConsumption;
    sumWaterStress += pt.waterStress ?? 0;
    sumHeatStress += pt.heatStress ?? 0;
  }

  return {
    totalWaterUsage: Math.round(sumWater),
    averageCropHealth: Math.round((sumHealth / len) * 10) / 10,
    averageDiseaseRisk: Math.round((sumDisease / len) * 10) / 10,
    totalExpectedYield: Math.round(lastPoint.expectedYield * 10) / 10,
    averageSoilMoisture: Math.round((sumMoisture / len) * 10) / 10,
    averageWaterStress: Math.round(sumWaterStress / len),
    averageHeatStress: Math.round(sumHeatStress / len),
    averageYieldPotential: Math.round(lastPoint.yieldPotential ?? lastPoint.expectedYield),
  };
}

/**
 * Creates rich, decision-support agronomic explanations
 */
function generateAgronomicExplanation(
  mode: WeatherMode,
  modifiers: WeatherModifiers,
  zones: Zone[],
  activeSummary: SimulationSummary,
  baselineSummary: SimulationSummary,
  diff: { cropHealthDiff: number; soilMoistureDiff: number; yieldDiff: number; waterUsageDiff: number }
): { aiExplanation: string; decisionSupportNote: string } {
  const cropList = Array.from(new Set(zones.map((z) => z.crop))).join(', ') || 'Crops';

  if (mode === 'real_weather') {
    const aiExplanation =
      `Simulation initialized with Real Weather forecast. Average crop health is projected at ${activeSummary.averageCropHealth}% with mean soil moisture of ${activeSummary.averageSoilMoisture}%. Total projected water demand is ${activeSummary.totalWaterUsage.toLocaleString()} Liters. ` +
      `Atmospheric evapotranspiration aligns with local WMO forecasts. Fields with higher organic retention buffer minor dry spells effectively.`;

    const decisionSupportNote =
      `What is likely to happen if this condition continues?\n` +
      `Under current forecast conditions, your ${cropList} plots will maintain steady physiological growth without critical thermal or moisture stress. Keep irrigation scheduled to match weekly forecast windows.`;

    return { aiExplanation, decisionSupportNote };
  }

  // What-If mode
  const preset = modifiers.preset || 'custom';
  let scenarioDesc = '';
  let impactNote = '';
  let recommendation = '';

  switch (preset) {
    case 'drought':
    case 'low_rainfall':
      scenarioDesc = `Drought Stress Scenario (${modifiers.tempDelta >= 0 ? `+${modifiers.tempDelta}°C` : `${modifiers.tempDelta}°C`}, ${Math.round((1 - modifiers.rainMultiplier) * 100)}% rainfall deficit)`;
      impactNote =
        `If dry conditions persist, soil moisture drops by ${Math.abs(diff.soilMoistureDiff)}% below baseline, accelerating moisture depletion below wilting points for water-intensive crops (e.g. Rice, Sugarcane). Expected yield falls by ${Math.abs(diff.yieldDiff)}% as canopy transpiration collapses.`;
      recommendation =
        `Actionable Decision: Prioritize drip irrigation for shallow-rooted crops, apply organic mulch to suppress soil evaporation, and consider deficit irrigation strategies on drought-hardy plots.`;
      break;

    case 'heatwave':
    case 'extreme_heat':
      scenarioDesc = `Heatwave Scenario (+${modifiers.tempDelta}°C ambient increase)`;
      impactNote =
        `If high temperatures persist above physiological thresholds, average crop health declines by ${Math.abs(diff.cropHealthDiff)}% due to respiratory exhaustion and pollen sterility. Water consumption jumps by ${Math.max(0, diff.waterUsageDiff).toLocaleString()} Liters to support thermal cooling.`;
      recommendation =
        `Actionable Decision: Schedule early-morning pulse irrigation, deploy micro-sprinklers for evaporative canopy cooling, and delay midday foliar spray applications.`;
      break;

    case 'flood':
    case 'heavy_rain':
      scenarioDesc = `Heavy Rainfall & Inundation Scenario (${Math.round((modifiers.rainMultiplier - 1) * 100)}% above normal precipitation)`;
      impactNote =
        `Prolonged saturation pushes soil moisture to ${activeSummary.averageSoilMoisture}%, inducing root hypoxia in slow-draining Clay soils and elevating fungal pathogen pressure by +${Math.round(activeSummary.averageDiseaseRisk - baselineSummary.averageDiseaseRisk)}%.`;
      recommendation =
        `Actionable Decision: Unblock drainage channels immediately, clear field furrows, and suspend nitrogen fertilizer applications to prevent nutrient leaching. Prepare preventative fungicide treatments once foliage dries.`;
      break;

    default:
      scenarioDesc = `Custom What-If Scenario (${modifiers.tempDelta >= 0 ? `+${modifiers.tempDelta}°C` : `${modifiers.tempDelta}°C`}, rain multiplier ×${modifiers.rainMultiplier})`;
      impactNote =
        `Crop health shifts by ${diff.cropHealthDiff > 0 ? `+${diff.cropHealthDiff}%` : `${diff.cropHealthDiff}%`} and final yield potential shifts by ${diff.yieldDiff > 0 ? `+${diff.yieldDiff}%` : `${diff.yieldDiff}%`} relative to standard forecast baseline.`;
      recommendation =
        `Actionable Decision: Continuously monitor soil tensiometers and adjust fertigation cycles according to updated weather forecasts.`;
  }

  const aiExplanation =
    `${scenarioDesc}: Compared to Real Weather Baseline, average crop health changed by ${diff.cropHealthDiff > 0 ? `+${diff.cropHealthDiff}%` : `${diff.cropHealthDiff}%`}, soil moisture shifted by ${diff.soilMoistureDiff > 0 ? `+${diff.soilMoistureDiff}%` : `${diff.soilMoistureDiff}%`}, and total water usage shifted by ${diff.waterUsageDiff > 0 ? `+${diff.waterUsageDiff.toLocaleString()} L` : `${diff.waterUsageDiff.toLocaleString()} L`}.\n\n${impactNote}`;

  const decisionSupportNote =
    `What is likely to happen if this condition continues?\n` +
    `${impactNote}\n\n${recommendation}`;

  return { aiExplanation, decisionSupportNote };
}

/**
 * Fallback zone creation if farm has no zones defined yet
 */
function createDefaultMockZones(farmId: string): Zone[] {
  return [
    {
      id: `zone_demo_1`,
      farmId,
      name: 'Plot A (North - Rice)',
      crop: 'Rice',
      soilType: 'Clay',
      soilMoisture: 75,
      area: 8.5,
      irrigationMethod: 'Flood',
      growthStage: 'Vegetative',
      humidity: 65,
      rainfall: 0,
      nitrogen: 60,
      phosphorus: 35,
      potassium: 45,
      temperature: 28,
      healthScore: 88,
      diseaseRisk: 15,
      pestRisk: 10,
    },
    {
      id: `zone_demo_2`,
      farmId,
      name: 'Plot B (South - Pearl Millet)',
      crop: 'Pearl Millet',
      soilType: 'Sandy',
      soilMoisture: 45,
      area: 12.0,
      irrigationMethod: 'Rain-fed',
      growthStage: 'Vegetative',
      humidity: 55,
      rainfall: 0,
      nitrogen: 40,
      phosphorus: 25,
      potassium: 30,
      temperature: 29,
      healthScore: 84,
      diseaseRisk: 10,
      pestRisk: 12,
    },
    {
      id: `zone_demo_3`,
      farmId,
      name: 'Plot C (East - Cotton)',
      crop: 'Cotton',
      soilType: 'Black',
      soilMoisture: 58,
      area: 6.2,
      irrigationMethod: 'Drip',
      growthStage: 'Vegetative',
      humidity: 60,
      rainfall: 0,
      nitrogen: 55,
      phosphorus: 30,
      potassium: 40,
      temperature: 28,
      healthScore: 90,
      diseaseRisk: 18,
      pestRisk: 15,
    },
  ];
}
