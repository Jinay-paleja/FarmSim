import type { CropType, SoilType, Zone, ZoneInput, Farm } from '../types';
import type { WeatherData } from './weather';

// ============================================================
// Scientific Agronomic Crop Thresholds
// ============================================================

export interface CropAgronomicProfile {
  optimalTempMin: number; // °C
  optimalTempMax: number; // °C
  heatStressThreshold: number; // °C
  frostThreshold: number; // °C
  optimalMoistureMin: number; // %
  optimalMoistureMax: number; // %
  criticalWiltingMoisture: number; // %
  waterloggedMoisture: number; // %
  dailyWaterNeedMm: number; // mm/day
  humidityDiseaseThreshold: number; // %
  susceptibleDiseases: string[];
}

export const CROP_PROFILES: Record<CropType, CropAgronomicProfile> = {
  Wheat: {
    optimalTempMin: 15,
    optimalTempMax: 24,
    heatStressThreshold: 30,
    frostThreshold: 0,
    optimalMoistureMin: 45,
    optimalMoistureMax: 70,
    criticalWiltingMoisture: 32,
    waterloggedMoisture: 82,
    dailyWaterNeedMm: 4.5,
    humidityDiseaseThreshold: 75,
    susceptibleDiseases: ['Yellow Rust', 'Powdery Mildew', 'Karnal Bunt'],
  },
  Tomato: {
    optimalTempMin: 18,
    optimalTempMax: 27,
    heatStressThreshold: 32,
    frostThreshold: 5,
    optimalMoistureMin: 50,
    optimalMoistureMax: 75,
    criticalWiltingMoisture: 35,
    waterloggedMoisture: 85,
    dailyWaterNeedMm: 5.0,
    humidityDiseaseThreshold: 75,
    susceptibleDiseases: ['Early Blight', 'Late Blight', 'Bacterial Wilt'],
  },
  Rice: {
    optimalTempMin: 22,
    optimalTempMax: 32,
    heatStressThreshold: 35,
    frostThreshold: 8,
    optimalMoistureMin: 65,
    optimalMoistureMax: 95,
    criticalWiltingMoisture: 45,
    waterloggedMoisture: 98,
    dailyWaterNeedMm: 7.0,
    humidityDiseaseThreshold: 80,
    susceptibleDiseases: ['Rice Blast', 'Sheath Blight', 'Bacterial Leaf Blight'],
  },
  Maize: {
    optimalTempMin: 18,
    optimalTempMax: 30,
    heatStressThreshold: 35,
    frostThreshold: 2,
    optimalMoistureMin: 50,
    optimalMoistureMax: 75,
    criticalWiltingMoisture: 35,
    waterloggedMoisture: 85,
    dailyWaterNeedMm: 5.5,
    humidityDiseaseThreshold: 78,
    susceptibleDiseases: ['Common Rust', 'Turcicum Leaf Blight', 'Stalk Rot'],
  },
  Cotton: {
    optimalTempMin: 22,
    optimalTempMax: 32,
    heatStressThreshold: 36,
    frostThreshold: 5,
    optimalMoistureMin: 45,
    optimalMoistureMax: 70,
    criticalWiltingMoisture: 30,
    waterloggedMoisture: 80,
    dailyWaterNeedMm: 6.0,
    humidityDiseaseThreshold: 75,
    susceptibleDiseases: ['Cotton Leaf Curl', 'Bacterial Blight', 'Grey Mildew'],
  },
  Potato: {
    optimalTempMin: 15,
    optimalTempMax: 22,
    heatStressThreshold: 28,
    frostThreshold: 0,
    optimalMoistureMin: 60,
    optimalMoistureMax: 80,
    criticalWiltingMoisture: 40,
    waterloggedMoisture: 85,
    dailyWaterNeedMm: 4.0,
    humidityDiseaseThreshold: 78,
    susceptibleDiseases: ['Late Blight', 'Early Blight', 'Black Scurf'],
  },
  Soybean: {
    optimalTempMin: 20,
    optimalTempMax: 30,
    heatStressThreshold: 35,
    frostThreshold: 2,
    optimalMoistureMin: 50,
    optimalMoistureMax: 75,
    criticalWiltingMoisture: 34,
    waterloggedMoisture: 84,
    dailyWaterNeedMm: 5.0,
    humidityDiseaseThreshold: 78,
    susceptibleDiseases: ['Soybean Rust', 'Frogeye Leaf Spot', 'Pod Blight'],
  },
  Groundnut: {
    optimalTempMin: 22,
    optimalTempMax: 32,
    heatStressThreshold: 36,
    frostThreshold: 4,
    optimalMoistureMin: 45,
    optimalMoistureMax: 70,
    criticalWiltingMoisture: 32,
    waterloggedMoisture: 80,
    dailyWaterNeedMm: 5.0,
    humidityDiseaseThreshold: 75,
    susceptibleDiseases: ['Tikka Leaf Spot', 'Rust', 'Stem Rot'],
  },
  Chickpea: {
    optimalTempMin: 15,
    optimalTempMax: 26,
    heatStressThreshold: 31,
    frostThreshold: -1,
    optimalMoistureMin: 40,
    optimalMoistureMax: 65,
    criticalWiltingMoisture: 28,
    waterloggedMoisture: 75,
    dailyWaterNeedMm: 3.5,
    humidityDiseaseThreshold: 72,
    susceptibleDiseases: ['Ascochyta Blight', 'Fusarium Wilt', 'Dry Root Rot'],
  },
  Mustard: {
    optimalTempMin: 12,
    optimalTempMax: 25,
    heatStressThreshold: 29,
    frostThreshold: -2,
    optimalMoistureMin: 40,
    optimalMoistureMax: 65,
    criticalWiltingMoisture: 28,
    waterloggedMoisture: 78,
    dailyWaterNeedMm: 3.8,
    humidityDiseaseThreshold: 75,
    susceptibleDiseases: ['White Rust', 'Alternaria Blight', 'Downy Mildew'],
  },
  Sugarcane: {
    optimalTempMin: 24,
    optimalTempMax: 36,
    heatStressThreshold: 39,
    frostThreshold: 5,
    optimalMoistureMin: 60,
    optimalMoistureMax: 85,
    criticalWiltingMoisture: 38,
    waterloggedMoisture: 92,
    dailyWaterNeedMm: 8.0,
    humidityDiseaseThreshold: 82,
    susceptibleDiseases: ['Red Rot', 'Smut', 'Wilt'],
  },
  Sorghum: {
    optimalTempMin: 24,
    optimalTempMax: 34,
    heatStressThreshold: 40,
    frostThreshold: 3,
    optimalMoistureMin: 35,
    optimalMoistureMax: 65,
    criticalWiltingMoisture: 24,
    waterloggedMoisture: 82,
    dailyWaterNeedMm: 4.0,
    humidityDiseaseThreshold: 80,
    susceptibleDiseases: ['Grain Mold', 'Anthracnose', 'Leaf Blight'],
  },
  'Pearl Millet': {
    optimalTempMin: 25,
    optimalTempMax: 36,
    heatStressThreshold: 42,
    frostThreshold: 4,
    optimalMoistureMin: 30,
    optimalMoistureMax: 60,
    criticalWiltingMoisture: 20,
    waterloggedMoisture: 80,
    dailyWaterNeedMm: 3.5,
    humidityDiseaseThreshold: 80,
    susceptibleDiseases: ['Downy Mildew', 'Ergot', 'Smut'],
  },
  'Pigeon Pea': {
    optimalTempMin: 20,
    optimalTempMax: 32,
    heatStressThreshold: 36,
    frostThreshold: 2,
    optimalMoistureMin: 40,
    optimalMoistureMax: 70,
    criticalWiltingMoisture: 28,
    waterloggedMoisture: 78,
    dailyWaterNeedMm: 4.5,
    humidityDiseaseThreshold: 76,
    susceptibleDiseases: ['Sterility Mosaic', 'Fusarium Wilt', 'Phytophthora Blight'],
  },
  'Green Gram': {
    optimalTempMin: 22,
    optimalTempMax: 33,
    heatStressThreshold: 37,
    frostThreshold: 4,
    optimalMoistureMin: 45,
    optimalMoistureMax: 70,
    criticalWiltingMoisture: 30,
    waterloggedMoisture: 80,
    dailyWaterNeedMm: 4.2,
    humidityDiseaseThreshold: 78,
    susceptibleDiseases: ['Yellow Mosaic', 'Powdery Mildew', 'Cercospora Leaf Spot'],
  },
};

// Soil Moisture capacity modifiers
export const SOIL_CHARACTERISTICS: Record<SoilType, { waterRetention: 'high' | 'medium' | 'low'; drainage: 'fast' | 'moderate' | 'slow'; description: string }> = {
  Alluvial: { waterRetention: 'medium', drainage: 'moderate', description: 'Deep, fertile with balanced water-holding capacity.' },
  Black: { waterRetention: 'high', drainage: 'slow', description: 'Rich in clay, retains moisture long but prone to waterlogging.' },
  Red: { waterRetention: 'low', drainage: 'fast', description: 'Porous, drains rapidly, requires frequent light irrigation.' },
  Laterite: { waterRetention: 'low', drainage: 'fast', description: 'Leached, acidic, low moisture retention.' },
  Arid: { waterRetention: 'low', drainage: 'fast', description: 'Coarse sand, very low moisture holding.' },
  'Forest/Mountain': { waterRetention: 'high', drainage: 'moderate', description: 'High organic humus, good moisture buffering.' },
  Loamy: { waterRetention: 'high', drainage: 'moderate', description: 'Ideal balance of sand, silt, and clay. Optimal root aeration.' },
  Clay: { waterRetention: 'high', drainage: 'slow', description: 'High water retention, slow infiltration.' },
  Sandy: { waterRetention: 'low', drainage: 'fast', description: 'Fast draining, high drought susceptibility.' },
  Silty: { waterRetention: 'medium', drainage: 'moderate', description: 'Good water retention and capillary action.' },
};

// ============================================================
// Output Models for Explainable Farm Intelligence
// ============================================================

export interface FieldRiskAssessment {
  fieldId: string;
  fieldName: string;
  crop: CropType;
  soilType: SoilType;
  areaAcres: number;

  // Specific risk modules
  waterStress: {
    level: 'low' | 'moderate' | 'high' | 'critical';
    score: number; // 0 - 100
    currentMoisture: number; // %
    threshold: number; // %
    explanation: string;
  };
  heatStress: {
    level: 'none' | 'moderate' | 'high' | 'extreme';
    score: number; // 0 - 100
    currentTemp: number; // °C
    cropThreshold: number; // °C
    explanation: string;
  };
  diseaseRisk: {
    level: 'low' | 'moderate' | 'high';
    score: number; // 0 - 100
    potentialPathogens: string[];
    explanation: string;
  };
  floodWaterlogRisk: {
    level: 'safe' | 'caution' | 'high_risk';
    expectedRainMm: number;
    explanation: string;
  };

  // Irrigation decision support
  irrigationAdvice: {
    action: 'irrigate_now' | 'irrigate_soon' | 'delay_rain_expected' | 'adequate_moisture' | 'suspend_waterlogged';
    headline: string;
    detail: string;
    whyFactors: {
      soilMoisture: number;
      ambientTemp: number;
      rainForecastNext48hMm: number;
      precipitationProbability: number;
      cropNeedMmDay: number;
      soilRetention: string;
    };
  };
}

export interface FarmIntelligenceReport {
  farmName: string;
  evaluatedAt: string;
  weatherSummary: {
    temperature: number;
    apparentTemp: number;
    humidity: number;
    windSpeed: number;
    rainTodayMm: number;
    rainForecastNext48hMm: number;
    conditionText: string;
    conditionEmoji: string;
  };
  overallThreatLevel: 'low' | 'moderate' | 'elevated' | 'critical';
  headlineAlerts: {
    id: string;
    type: 'water_stress' | 'heat_stress' | 'heavy_rain' | 'disease_risk' | 'frost' | 'wind';
    severity: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
    targetFields: string[];
    why: string;
  }[];
  fieldAssessments: FieldRiskAssessment[];
  prioritizedActions: {
    priority: 'urgent' | 'high' | 'routine';
    title: string;
    description: string;
    why: {
      temperature: string;
      soilMoisture: string;
      rainForecast: string;
      cropRule?: string;
    };
  }[];
}

// ============================================================
// Core Agronomic Intelligence Reasoner
// ============================================================

export function analyzeFarmIntelligence(
  farm: Farm | null,
  zones: (Zone | ZoneInput)[],
  weather: WeatherData
): FarmIntelligenceReport {
  const farmName = farm?.name || 'My Farm';
  const now = new Date().toISOString();

  // Sum next 48h rainfall forecast from weather data
  const next48hRainSum = weather.hourly
    .slice(0, 48)
    .reduce((sum, h) => sum + (h.rain || 0), 0);
  const next48hMaxProb = Math.max(
    ...weather.hourly.slice(0, 48).map((h) => h.precipitationProbability || 0),
    0
  );

  const headlineAlerts: FarmIntelligenceReport['headlineAlerts'] = [];
  const fieldAssessments: FieldRiskAssessment[] = [];
  const prioritizedActions: FarmIntelligenceReport['prioritizedActions'] = [];

  // 1. Heavy Rain Evaluation (Farm-Wide)
  if (next48hRainSum >= 20 || weather.daily[0]?.precipitationSum >= 20) {
    const rainExpected = Math.max(next48hRainSum, weather.daily[0]?.precipitationSum || 0);
    headlineAlerts.push({
      id: 'heavy_rain_expected',
      type: 'heavy_rain',
      severity: rainExpected > 35 ? 'critical' : 'warning',
      title: '🌧️ Heavy Rain Expected',
      message: `Expected rainfall: ${rainExpected.toFixed(1)} mm across the next 24–48 hours. Potential effects: increased soil moisture, waterlogging, nutrient leaching, disease risk, and flood risk in low-lying fields.`,
      targetFields: zones.map((z) => z.name),
      why: `Forecast Rain: ${rainExpected.toFixed(1)} mm (Rain Probability: ${next48hMaxProb}%). Soil drainage capacity will be tested.`,
    });

    prioritizedActions.push({
      priority: 'high',
      title: 'Clear Drainage Furrows & Delay Scheduled Irrigation',
      description: 'Ensure field drainage ditches and runoff furrows are clear to prevent localized pooling. Pause automated irrigation schedules immediately.',
      why: {
        temperature: `${weather.temperature}°C`,
        soilMoisture: 'Will surge upon precipitation',
        rainForecast: `${rainExpected.toFixed(1)} mm incoming`,
        cropRule: 'Irrigating prior to heavy rain causes root hypoxia and nutrient run-off.',
      },
    });
  }

  // 2. Field-by-Field Agronomic Assessment
  for (const zone of zones) {
    const cropProfile = CROP_PROFILES[zone.crop] || CROP_PROFILES.Wheat;
    const soilProfile = SOIL_CHARACTERISTICS[zone.soilType] || SOIL_CHARACTERISTICS.Loamy;

    const moisture = zone.soilMoisture;
    const temp = weather.temperature;
    const humidity = weather.humidity;

    // --- WATER STRESS EVALUATION ---
    let waterStressLevel: FieldRiskAssessment['waterStress']['level'] = 'low';
    let waterScore = 15;
    let waterExplanation = 'Soil moisture is in the optimal root-zone range for this crop.';

    if (moisture < cropProfile.criticalWiltingMoisture) {
      waterStressLevel = 'critical';
      waterScore = 90;
      waterExplanation = `Soil moisture (${moisture.toFixed(0)}%) is below critical wilting threshold (${cropProfile.criticalWiltingMoisture}%). Root extraction pressure is severe.`;
    } else if (moisture < cropProfile.optimalMoistureMin) {
      if (temp > 30 && next48hRainSum < 5) {
        waterStressLevel = 'high';
        waterScore = 75;
        waterExplanation = `Moisture (${moisture.toFixed(0)}%) is low under high ambient temperature (${temp}°C) and dry forecast (${next48hRainSum.toFixed(1)} mm).`;
      } else {
        waterStressLevel = 'moderate';
        waterScore = 50;
        waterExplanation = `Moisture (${moisture.toFixed(0)}%) is slightly below optimal range (${cropProfile.optimalMoistureMin}–${cropProfile.optimalMoistureMax}%).`;
      }
    }

    if (waterStressLevel === 'high' || waterStressLevel === 'critical') {
      headlineAlerts.push({
        id: `water_stress_${zone.id || zone.name}`,
        type: 'water_stress',
        severity: waterStressLevel === 'critical' ? 'critical' : 'warning',
        title: `⚠️ Water Stress Risk in ${zone.name}`,
        message: `${zone.name} (${zone.crop}) is showing increasing water stress. Current soil moisture: ${moisture.toFixed(0)}%, Temperature: ${temp}°C, Rain forecast: ${next48hMaxProb}%.`,
        targetFields: [zone.name],
        why: `Temperature: ${temp}°C | Soil Moisture: ${moisture.toFixed(0)}% (Threshold: ${cropProfile.optimalMoistureMin}%) | Rain Forecast: ${next48hRainSum.toFixed(1)} mm.`,
      });
    }

    // --- HEAT STRESS EVALUATION ---
    let heatStressLevel: FieldRiskAssessment['heatStress']['level'] = 'none';
    let heatScore = 10;
    let heatExplanation = `Temperature is within ${zone.crop}'s preferred agronomic range (${cropProfile.optimalTempMin}–${cropProfile.optimalTempMax}°C).`;

    if (temp >= cropProfile.heatStressThreshold + 3) {
      heatStressLevel = 'extreme';
      heatScore = 95;
      heatExplanation = `Current temperature (${temp}°C) exceeds the crop heat tolerance threshold (${cropProfile.heatStressThreshold}°C) by over 3°C! Risk of pollen abortion and foliage scorch.`;
    } else if (temp >= cropProfile.heatStressThreshold) {
      heatStressLevel = 'high';
      heatScore = 75;
      heatExplanation = `Temperature (${temp}°C) exceeds the preferred maximum threshold (${cropProfile.heatStressThreshold}°C) for ${zone.crop}.`;
    } else if (temp > cropProfile.optimalTempMax) {
      heatStressLevel = 'moderate';
      heatScore = 45;
      heatExplanation = `Temperature (${temp}°C) is above optimal comfort range (${cropProfile.optimalTempMax}°C) for ${zone.crop}.`;
    }

    if (heatStressLevel === 'high' || heatStressLevel === 'extreme') {
      headlineAlerts.push({
        id: `heat_stress_${zone.id || zone.name}`,
        type: 'heat_stress',
        severity: heatStressLevel === 'extreme' ? 'critical' : 'warning',
        title: `🌡️ Heat Stress in ${zone.name}`,
        message: `${zone.crop} ${zone.name}: Current temperature ${temp}°C exceeds preferred crop threshold of ${cropProfile.heatStressThreshold}°C.`,
        targetFields: [zone.name],
        why: `Current: ${temp}°C | Crop threshold: ${cropProfile.heatStressThreshold}°C | Risk: High`,
      });
    }

    // --- DISEASE RISK EVALUATION ---
    // High humidity + warm temperature + recent/forecast wetness
    let diseaseLevel: FieldRiskAssessment['diseaseRisk']['level'] = 'low';
    let diseaseScore = 15;
    let diseaseExplanation = 'Fungal and bacterial pathogen sporulation pressure is currently suppressed.';

    const isHumid = humidity >= cropProfile.humidityDiseaseThreshold;
    const isWarm = temp >= 20 && temp <= 32;
    const isWet = weather.rain > 1 || next48hRainSum > 5;

    if (isHumid && isWarm && isWet) {
      diseaseLevel = 'high';
      diseaseScore = 85;
      diseaseExplanation = `Elevated Disease Risk: Combination of high relative humidity (${humidity}%), warm temperatures (${temp}°C), and moisture creates peak infection conditions for ${cropProfile.susceptibleDiseases.join(', ')}.`;
    } else if (isHumid && isWarm) {
      diseaseLevel = 'moderate';
      diseaseScore = 55;
      diseaseExplanation = `Moderate Disease Risk: Persistent relative humidity (${humidity}%) exceeds threshold (${cropProfile.humidityDiseaseThreshold}%). Monitor canopy undergrowth.`;
    }

    if (diseaseLevel === 'high') {
      headlineAlerts.push({
        id: `disease_${zone.id || zone.name}`,
        type: 'disease_risk',
        severity: 'warning',
        title: `🍄 Elevated Disease Risk in ${zone.name}`,
        message: `High humidity (${humidity}%) and warm temperature (${temp}°C) increase disease risk for ${zone.crop}.`,
        targetFields: [zone.name],
        why: `Humidity: ${humidity}% (Threshold: ${cropProfile.humidityDiseaseThreshold}%) | Temperature: ${temp}°C | Pathogens: ${cropProfile.susceptibleDiseases.slice(0, 2).join(', ')}.`,
      });
    }

    // --- FLOOD & WATERLOGGING EVALUATION ---
    let floodLevel: FieldRiskAssessment['floodWaterlogRisk']['level'] = 'safe';
    let floodExplanation = 'Adequate soil air-to-water ratio; zero waterlogging observed.';
    if (moisture > cropProfile.waterloggedMoisture || (moisture > 75 && next48hRainSum > 20)) {
      floodLevel = 'high_risk';
      floodExplanation = `Soil moisture is at ${moisture.toFixed(0)}% with ${next48hRainSum.toFixed(1)} mm incoming rain on ${soilProfile.drainage} draining ${zone.soilType} soil. Severe risk of root suffocation.`;
    } else if (moisture > 75) {
      floodLevel = 'caution';
      floodExplanation = `Soil is near saturation (${moisture.toFixed(0)}%).`;
    }

    // --- IRRIGATION DECISION SUPPORT WITH "WHY?" EXPLAINABILITY ---
    let irrigationAction: FieldRiskAssessment['irrigationAdvice']['action'] = 'adequate_moisture';
    let irrigationHeadline = 'Maintain Current Regimen';
    let irrigationDetail = `Soil moisture (${moisture.toFixed(0)}%) is well within the target range (${cropProfile.optimalMoistureMin}–${cropProfile.optimalMoistureMax}%).`;

    if (moisture > cropProfile.waterloggedMoisture || floodLevel === 'high_risk') {
      irrigationAction = 'suspend_waterlogged';
      irrigationHeadline = '⛔ Suspend Irrigation Immediately';
      irrigationDetail = 'Field is saturated. Prevent root rot by suspending all water applications and ensuring drains are open.';
    } else if (moisture < cropProfile.optimalMoistureMin) {
      // LOW MOISTURE SCENARIO: check upcoming rain!
      if (next48hRainSum >= 12 && next48hMaxProb >= 50) {
        irrigationAction = 'delay_rain_expected';
        irrigationHeadline = '⏳ Delay Irrigation — Substantial Rain Expected Soon';
        irrigationDetail = `Soil moisture is low (${moisture.toFixed(0)}%), BUT ${next48hRainSum.toFixed(1)} mm rainfall is forecasted within 24–48 hours (${next48hMaxProb}% probability). Delay irrigation if agronomically appropriate and reassess closer to the forecast period.`;
      } else {
        irrigationAction = 'irrigate_now';
        irrigationHeadline = '💧 Consider Irrigation Within Next Window';
        irrigationDetail = `Soil moisture (${moisture.toFixed(0)}%) is below optimal (${cropProfile.optimalMoistureMin}%) and no substantial rain is forecasted (${next48hRainSum.toFixed(1)} mm). Apply irrigation to restore root zone moisture.`;
      }
    } else if (moisture < cropProfile.optimalMoistureMin + 8 && next48hRainSum < 2 && temp > 32) {
      irrigationAction = 'irrigate_soon';
      irrigationHeadline = 'Prepare Irrigation Cycle';
      irrigationDetail = `High daytime temperatures (${temp}°C) and zero rainfall will draw down moisture rapidly over the next 48 hours.`;
    }

    fieldAssessments.push({
      fieldId: zone.id || zone.name,
      fieldName: zone.name,
      crop: zone.crop,
      soilType: zone.soilType,
      areaAcres: zone.area,
      waterStress: {
        level: waterStressLevel,
        score: waterScore,
        currentMoisture: moisture,
        threshold: cropProfile.optimalMoistureMin,
        explanation: waterExplanation,
      },
      heatStress: {
        level: heatStressLevel,
        score: heatScore,
        currentTemp: temp,
        cropThreshold: cropProfile.heatStressThreshold,
        explanation: heatExplanation,
      },
      diseaseRisk: {
        level: diseaseLevel,
        score: diseaseScore,
        potentialPathogens: cropProfile.susceptibleDiseases,
        explanation: diseaseExplanation,
      },
      floodWaterlogRisk: {
        level: floodLevel,
        expectedRainMm: next48hRainSum,
        explanation: floodExplanation,
      },
      irrigationAdvice: {
        action: irrigationAction,
        headline: irrigationHeadline,
        detail: irrigationDetail,
        whyFactors: {
          soilMoisture: Math.round(moisture),
          ambientTemp: Math.round(temp * 10) / 10,
          rainForecastNext48hMm: Math.round(next48hRainSum * 10) / 10,
          precipitationProbability: next48hMaxProb,
          cropNeedMmDay: cropProfile.dailyWaterNeedMm,
          soilRetention: soilProfile.waterRetention,
        },
      },
    });
  }

  // Generate prioritized actionable recommendations
  for (const fa of fieldAssessments) {
    if (fa.irrigationAdvice.action === 'delay_rain_expected') {
      prioritizedActions.push({
        priority: 'high',
        title: `Hold Irrigation on ${fa.fieldName} (${fa.crop})`,
        description: `Delay irrigation: ${fa.irrigationAdvice.whyFactors.rainForecastNext48hMm} mm rain is forecasted with ${fa.irrigationAdvice.whyFactors.precipitationProbability}% confidence.`,
        why: {
          temperature: `${fa.irrigationAdvice.whyFactors.ambientTemp}°C`,
          soilMoisture: `${fa.irrigationAdvice.whyFactors.soilMoisture}% (Threshold: ${CROP_PROFILES[fa.crop]?.optimalMoistureMin}%)`,
          rainForecast: `${fa.irrigationAdvice.whyFactors.rainForecastNext48hMm} mm next 48h`,
          cropRule: 'Rain will replenish soil profile naturally, avoiding pumping costs and nutrient leaching.',
        },
      });
    } else if (fa.irrigationAdvice.action === 'irrigate_now') {
      prioritizedActions.push({
        priority: 'urgent',
        title: `Irrigate ${fa.fieldName} (${fa.crop})`,
        description: `Apply irrigation: Soil moisture is ${fa.irrigationAdvice.whyFactors.soilMoisture}% and no rain is expected (${fa.irrigationAdvice.whyFactors.rainForecastNext48hMm} mm).`,
        why: {
          temperature: `${fa.irrigationAdvice.whyFactors.ambientTemp}°C`,
          soilMoisture: `${fa.irrigationAdvice.whyFactors.soilMoisture}% (Below critical ${CROP_PROFILES[fa.crop]?.optimalMoistureMin}%)`,
          rainForecast: `${fa.irrigationAdvice.whyFactors.rainForecastNext48hMm} mm`,
          cropRule: `Daily evapotranspiration consumption is ${CROP_PROFILES[fa.crop]?.dailyWaterNeedMm} mm/day.`,
        },
      });
    }

    if (fa.heatStress.level === 'high' || fa.heatStress.level === 'extreme') {
      prioritizedActions.push({
        priority: 'urgent',
        title: `Alleviate Heat Stress in ${fa.fieldName} (${fa.crop})`,
        description: `Temperature (${fa.heatStress.currentTemp}°C) exceeds ${fa.crop} thermal threshold of ${fa.heatStress.cropThreshold}°C.`,
        why: {
          temperature: `${fa.heatStress.currentTemp}°C (Exceeds ${fa.heatStress.cropThreshold}°C)`,
          soilMoisture: `${fa.waterStress.currentMoisture.toFixed(0)}%`,
          rainForecast: `${next48hRainSum.toFixed(1)} mm`,
          cropRule: 'Morning micro-sprinkling or drip pulse lowers canopy temp by 3–4°C.',
        },
      });
    }

    if (fa.diseaseRisk.level === 'high') {
      prioritizedActions.push({
        priority: 'high',
        title: `Disease Scouting for ${fa.crop} in ${fa.fieldName}`,
        description: `High humidity (${weather.humidity}%) and warm weather favor pathogen sporulation. Inspect foliage for early symptoms.`,
        why: {
          temperature: `${weather.temperature}°C`,
          soilMoisture: `${fa.waterStress.currentMoisture.toFixed(0)}%`,
          rainForecast: `${next48hRainSum.toFixed(1)} mm`,
          cropRule: `Target pathogens: ${fa.diseaseRisk.potentialPathogens.slice(0, 2).join(', ')}.`,
        },
      });
    }
  }

  // Deduplicate and rank actions
  const uniqueActions = prioritizedActions.slice(0, 6);

  // Overall threat level
  let overallThreatLevel: FarmIntelligenceReport['overallThreatLevel'] = 'low';
  if (headlineAlerts.some((a) => a.severity === 'critical')) {
    overallThreatLevel = 'critical';
  } else if (headlineAlerts.some((a) => a.severity === 'warning')) {
    overallThreatLevel = 'elevated';
  } else if (uniqueActions.some((a) => a.priority === 'urgent')) {
    overallThreatLevel = 'moderate';
  }

  return {
    farmName,
    evaluatedAt: now,
    weatherSummary: {
      temperature: weather.temperature,
      apparentTemp: weather.apparentTemperature,
      humidity: weather.humidity,
      windSpeed: weather.windSpeed,
      rainTodayMm: weather.rain,
      rainForecastNext48hMm: Math.round(next48hRainSum * 10) / 10,
      conditionText: weather.weatherDescription,
      conditionEmoji: weather.weatherEmoji,
    },
    overallThreatLevel,
    headlineAlerts,
    fieldAssessments,
    prioritizedActions: uniqueActions,
  };
}
