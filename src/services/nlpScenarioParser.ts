import type {
  ScenarioType,
  StructuredScenarioJSON,
  ScenarioChangesPayload,
  Zone,
  ZoneInput,
} from '../types';

// ============================================================
// Natural-Language Scenario Understanding Pipeline
// ============================================================
// Pipeline:
// Farmer Text -> TF-IDF -> Logistic Regression -> Scenario Type -> Regex/Rule Extraction -> Parameters -> Schema Validation -> Scenario JSON

// ------------------------------------------------------------
// Step 1: TF-IDF Vocabulary & Trained Logistic Regression Weights
// ------------------------------------------------------------

export interface IntentClassificationResult {
  intent: ScenarioType;
  confidence: number;
  classProbabilities: Record<ScenarioType, number>;
}

// Key agricultural vocabulary terms
const VOCABULARY = [
  'rain', 'rainfall', 'precipitation', 'drop', 'drops', 'cut', 'cuts', 'reduce', 'reduced',
  'decrease', 'decreased', 'deficit', 'drought', 'dry', 'shortage', 'down',
  'increase', 'increased', 'rise', 'rises', 'heavy', 'flood', 'monsoon', 'storm', 'more',
  'heat', 'heatwave', 'temperature', 'hot', 'hotter', 'warm', 'degree', 'degrees', 'celsius', 'thermal',
  'irrigation', 'water', 'watering', 'pump', 'failure', 'broken', 'stop', 'stopped', 'shut',
  'fertilizer', 'nitrogen', 'nutrient', 'npk', 'urea', 'deficiency', 'skip',
  'disease', 'fungus', 'fungal', 'blight', 'rust', 'rot', 'outbreak', 'infection', 'pathogen',
  'pest', 'pests', 'insect', 'insects', 'worm', 'locust', 'infestation', 'bug', 'bugs',
  'combine', 'combined', 'both', 'plus', 'simultaneous',
];

const IDF_WEIGHTS: Record<string, number> = {
  rain: 1.2, rainfall: 1.3, precipitation: 1.8, drop: 1.4, drops: 1.4, cut: 1.5, cuts: 1.5,
  reduce: 1.4, reduced: 1.4, decrease: 1.4, decreased: 1.4, deficit: 1.9, drought: 2.1, dry: 1.6, shortage: 1.8, down: 1.1,
  increase: 1.3, increased: 1.3, rise: 1.4, rises: 1.4, heavy: 1.6, flood: 2.3, monsoon: 2.2, storm: 2.0, more: 1.1,
  heat: 1.6, heatwave: 2.4, temperature: 1.4, hot: 1.5, hotter: 1.6, warm: 1.4, degree: 1.3, degrees: 1.3, celsius: 1.7, thermal: 2.0,
  irrigation: 1.5, water: 1.1, watering: 1.4, pump: 2.2, failure: 2.3, broken: 2.3, stop: 1.8, stopped: 1.8, shut: 1.9,
  fertilizer: 1.7, nitrogen: 2.0, nutrient: 1.9, npk: 2.4, urea: 2.4, deficiency: 2.2, skip: 1.9,
  disease: 1.8, fungus: 2.2, fungal: 2.2, blight: 2.5, rust: 2.4, rot: 2.3, outbreak: 2.1, infection: 2.1, pathogen: 2.3,
  pest: 1.9, pests: 1.9, insect: 2.2, insects: 2.2, worm: 2.4, locust: 2.6, infestation: 2.4, bug: 1.8, bugs: 1.8,
  combine: 1.9, combined: 1.9, both: 1.5, plus: 1.4, simultaneous: 2.2,
};

// Logistic Regression weights for agricultural intent classes
const LOGISTIC_WEIGHTS: Record<ScenarioType, Record<string, number>> = {
  RAIN_REDUCTION: {
    rain: 2.4, rainfall: 2.8, drop: 2.5, drops: 2.5, cut: 2.2, cuts: 2.2, reduce: 2.4,
    decrease: 2.5, deficit: 3.0, drought: 3.5, dry: 2.2, shortage: 2.6, down: 1.8,
  },
  RAIN_INCREASE: {
    rain: 2.0, rainfall: 2.5, increase: 2.8, increased: 2.8, heavy: 3.0, flood: 3.8,
    monsoon: 3.2, storm: 2.8, more: 1.5,
  },
  TEMPERATURE_INCREASE: {
    temperature: 3.2, degree: 2.2, degrees: 2.2, celsius: 2.4, rise: 2.5, rises: 2.5,
    increase: 2.2, warm: 2.4,
  },
  HEATWAVE: {
    heatwave: 4.2, heat: 3.5, hot: 3.0, hotter: 3.2, thermal: 3.2, extreme: 3.0,
  },
  IRRIGATION_DECREASE: {
    irrigation: 3.2, water: 1.8, cut: 2.2, reduce: 2.4, decrease: 2.4, shortage: 2.2,
  },
  IRRIGATION_INCREASE: {
    irrigation: 3.2, water: 2.2, increase: 2.8, more: 2.0, double: 2.2,
  },
  IRRIGATION_FAILURE: {
    pump: 4.2, failure: 4.2, broken: 4.0, stop: 3.2, stopped: 3.2, shut: 3.2,
  },
  FERTILIZER_CHANGES: {
    fertilizer: 3.8, nutrient: 3.0, npk: 3.5, urea: 3.2,
  },
  NITROGEN_DEFICIENCY: {
    nitrogen: 4.2, deficiency: 3.8, skip: 3.2, zero: 2.8,
  },
  DISEASE_OUTBREAK: {
    disease: 3.8, fungus: 3.8, fungal: 3.8, blight: 4.2, rust: 4.0, rot: 3.8, outbreak: 3.2, pathogen: 3.8,
  },
  PEST_OUTBREAK: {
    pest: 4.0, pests: 4.0, insect: 3.8, insects: 3.8, worm: 4.0, locust: 4.2, infestation: 3.8, bug: 3.2, bugs: 3.2,
  },
  COMBINED: {
    combine: 3.5, combined: 3.5, both: 2.8, plus: 2.5, simultaneous: 3.2, and: 1.2,
  },
};

/**
 * Computes TF-IDF vector from input text
 */
function computeTfIdf(text: string): Record<string, number> {
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const termCounts: Record<string, number> = {};
  for (const t of tokens) {
    termCounts[t] = (termCounts[t] || 0) + 1;
  }

  const totalTokens = tokens.length || 1;
  const tfIdfVector: Record<string, number> = {};

  for (const term of VOCABULARY) {
    if (termCounts[term]) {
      const tf = termCounts[term] / totalTokens;
      const idf = IDF_WEIGHTS[term] ?? 1.5;
      tfIdfVector[term] = tf * idf;
    }
  }

  return tfIdfVector;
}

/**
 * Step 1: Multi-class Logistic Regression with Softmax
 */
export function classifyScenarioIntent(text: string): IntentClassificationResult {
  const vector = computeTfIdf(text);
  const logits: Record<ScenarioType, number> = {} as any;
  const classes = Object.keys(LOGISTIC_WEIGHTS) as ScenarioType[];

  // Calculate logits
  for (const cls of classes) {
    let score = -0.5; // Bias
    const weights = LOGISTIC_WEIGHTS[cls];
    for (const [term, val] of Object.entries(vector)) {
      if (weights[term]) {
        score += val * weights[term];
      }
    }
    logits[cls] = score;
  }

  // Softmax normalization
  const maxLogit = Math.max(...Object.values(logits));
  const expScores: Record<string, number> = {};
  let sumExp = 0;

  for (const cls of classes) {
    const exp = Math.exp(logits[cls] - maxLogit);
    expScores[cls] = exp;
    sumExp += exp;
  }

  const probabilities: Record<ScenarioType, number> = {} as any;
  let bestIntent: ScenarioType = 'RAIN_REDUCTION';
  let bestProb = -1;

  for (const cls of classes) {
    const prob = sumExp > 0 ? expScores[cls] / sumExp : 0;
    probabilities[cls] = Math.round(prob * 100) / 100;
    if (prob > bestProb) {
      bestProb = prob;
      bestIntent = cls;
    }
  }

  // Check if multiple strong modifiers suggest a COMBINED scenario
  const highScoring = classes.filter((c) => c !== 'COMBINED' && (probabilities[c] >= 0.25 || logits[c] > 1.2));
  if (highScoring.length >= 2) {
    bestIntent = 'COMBINED';
    bestProb = Math.max(bestProb, 0.75);
  }

  return {
    intent: bestIntent,
    confidence: Math.round(bestProb * 100) / 100,
    classProbabilities: probabilities,
  };
}

// ------------------------------------------------------------
// Step 2: Deterministic Rule & Regex Parameter Extractor
// ------------------------------------------------------------

export interface ExtractedParameters {
  scenarioType: ScenarioType;
  durationDays: number;
  targetZones: string[];
  rainfallMultiplier?: number;
  rainfallDeltaMm?: number;
  temperatureDelta?: number;
  irrigationMultiplier?: number;
  irrigationFailure?: boolean;
  nitrogenMultiplier?: number;
  diseasePressureDelta?: number;
  pestPressureDelta?: number;
  rawMatches: Record<string, string>;
}

/**
 * Extracts specific numerical values and target fields using deterministic rules.
 */
export function extractScenarioParameters(
  text: string,
  availableZones: (Zone | ZoneInput)[] = []
): ExtractedParameters {
  const clean = text.toLowerCase();
  const rawMatches: Record<string, string> = {};

  // 1. Intent Classification
  const classification = classifyScenarioIntent(text);
  let scenarioType = classification.intent;

  // 2. Extract Duration in Days
  let durationDays = 14; // Standard default duration
  const dayMatch = clean.match(/(?:for|next|over|during)\s*(\d+)\s*(?:days?|d\b)/i) || clean.match(/(\d+)\s*(?:days?|d\b)/i);
  const weekMatch = clean.match(/(?:for|next|over|during)\s*(\d+)\s*(?:weeks?|w\b)/i);
  const monthMatch = clean.match(/(?:for|next|over|during)\s*(\d+)\s*(?:months?|m\b)/i);

  if (dayMatch) {
    durationDays = parseInt(dayMatch[1], 10);
    rawMatches.duration = `${dayMatch[1]} days`;
  } else if (weekMatch) {
    durationDays = parseInt(weekMatch[1], 10) * 7;
    rawMatches.duration = `${weekMatch[1]} weeks (${durationDays} days)`;
  } else if (monthMatch) {
    durationDays = parseInt(monthMatch[1], 10) * 30;
    rawMatches.duration = `${monthMatch[1]} months (${durationDays} days)`;
  }

  // 3. Extract Target Zones / Fields
  const targetZones: string[] = [];
  const zoneAllMatch = /(?:all|every|whole)\s*(?:zones?|fields?|plots?|farm)/i.test(clean);

  if (zoneAllMatch || availableZones.length === 0) {
    // Target all fields
    targetZones.push(...availableZones.map((z) => z.id || z.name));
    rawMatches.target = 'All Farm Fields';
  } else {
    // Match specific field names (e.g., "Zone A", "Field 1", "Field A1", "Wheat field")
    for (const z of availableZones) {
      const nameL = z.name.toLowerCase();
      const idL = (z.id || '').toLowerCase();
      // Test direct name, e.g. "field a1" or "zone a" or letter "a"
      const letterCode = z.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const cropName = z.crop.toLowerCase();

      const regexes = [
        new RegExp(`\\b${nameL}\\b`, 'i'),
        new RegExp(`\\b${idL}\\b`, 'i'),
        new RegExp(`\\bzone\\s*${letterCode.replace('field', '')}\\b`, 'i'),
        new RegExp(`\\b${cropName}\\s*(?:field|plot|zone)?\\b`, 'i'),
      ];

      if (regexes.some((r) => r.test(clean))) {
        targetZones.push(z.id || z.name);
      }
    }

    // Generic "zone a", "zone b", "field 1" fallback matching
    const genericMatch = clean.match(/\b(?:zone|field|plot)\s*([a-z0-9]+)\b/i);
    if (genericMatch && targetZones.length === 0) {
      const code = genericMatch[1].toLowerCase();
      const matched = availableZones.find(
        (z) => z.name.toLowerCase().includes(code) || (z.id && z.id.toLowerCase().includes(code))
      );
      if (matched) {
        targetZones.push(matched.id || matched.name);
      }
    }

    if (targetZones.length > 0) {
      rawMatches.target = targetZones.join(', ');
    } else {
      // Default to all zones if not specified
      targetZones.push(...availableZones.map((z) => z.id || z.name));
      rawMatches.target = 'All Farm Fields (unspecified)';
    }
  }

  // 4. Extract Rainfall Changes
  let rainfallMultiplier: number | undefined = undefined;
  let rainfallDeltaMm: number | undefined = undefined;

  // Percentage drop: "drops by 40%", "rainfall -40%", "40% less rain", "decreased by 30%"
  const rainDropPct =
    clean.match(/(?:rain|rainfall|precipitation)[^%.\n]*(?:drops?|falls?|cuts?|reduces?|decreases?|down)\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*%/i) ||
    clean.match(/(?:drops?|falls?|cuts?|reduces?|decreases?)\s*(?:rain|rainfall|precipitation)?\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*%/i) ||
    clean.match(/(\d+(?:\.\d+)?)\s*%\s*(?:less|reduction in|drop in|cut in)\s*(?:rain|rainfall|precipitation)/i);

  // Percentage increase: "rainfall increases by 50%", "30% more rain"
  const rainRisePct =
    clean.match(/(?:rain|rainfall|precipitation)[^%.\n]*(?:increases?|rises?|jumps?|up)\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*%/i) ||
    clean.match(/(\d+(?:\.\d+)?)\s*%\s*(?:more|increase in)\s*(?:rain|rainfall|precipitation)/i);

  if (rainDropPct) {
    const pct = parseFloat(rainDropPct[1]);
    rainfallMultiplier = Math.max(0, Math.round((1 - pct / 100) * 100) / 100);
    rawMatches.rainfall = `-${pct}% (multiplier: ${rainfallMultiplier})`;
    if (scenarioType !== 'COMBINED') scenarioType = 'RAIN_REDUCTION';
  } else if (rainRisePct) {
    const pct = parseFloat(rainRisePct[1]);
    rainfallMultiplier = Math.round((1 + pct / 100) * 100) / 100;
    rawMatches.rainfall = `+${pct}% (multiplier: ${rainfallMultiplier})`;
    if (scenarioType !== 'COMBINED') scenarioType = 'RAIN_INCREASE';
  } else if (clean.includes('drought') || clean.includes('dry spell')) {
    rainfallMultiplier = 0.20; // Default drought -80%
    rawMatches.rainfall = `Drought Preset (multiplier: 0.20)`;
  } else if (clean.includes('flood') || clean.includes('heavy rain')) {
    rainfallMultiplier = 2.50;
    rainfallDeltaMm = 35;
    rawMatches.rainfall = `Flood Preset (+35 mm, multiplier: 2.50)`;
  }

  // 5. Extract Temperature Changes
  let temperatureDelta: number | undefined = undefined;

  // e.g., "temperature rises by 3°C", "+4 degrees", "temperature up by 2c", "heatwave of +5"
  const tempRise =
    clean.match(/(?:temp|temperature)[^°.\n]*(?:rises?|increases?|warms?|up)\s*(?:by\s*)?(\+?\d+(?:\.\d+)?)\s*(?:°c|c|deg|degrees)?/i) ||
    clean.match(/(?:heatwave|hotter)[^\d]*(\+?\d+(?:\.\d+)?)\s*(?:°c|c|deg|degrees)?/i) ||
    clean.match(/(\+?\d+(?:\.\d+)?)\s*(?:°c|degrees?\s*(?:celsius)?)\s*(?:rise|increase|warmer|hotter|heatwave)/i);

  const tempDrop =
    clean.match(/(?:temp|temperature)[^°.\n]*(?:drops?|falls?|cools?|down)\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*(?:°c|c|deg|degrees)?/i) ||
    clean.match(/(?:cold\s*snap|frost)[^\d]*(\d+(?:\.\d+)?)\s*(?:°c|c|deg|degrees)?/i);

  if (tempRise) {
    const delta = parseFloat(tempRise[1]);
    temperatureDelta = Math.abs(delta);
    rawMatches.temperature = `+${temperatureDelta}°C`;
    if (scenarioType !== 'COMBINED' && scenarioType !== 'RAIN_REDUCTION') {
      scenarioType = temperatureDelta >= 4 ? 'HEATWAVE' : 'TEMPERATURE_INCREASE';
    }
  } else if (tempDrop) {
    const delta = parseFloat(tempDrop[1]);
    temperatureDelta = -Math.abs(delta);
    rawMatches.temperature = `-${Math.abs(delta)}°C`;
  } else if (clean.includes('heatwave')) {
    temperatureDelta = 5.0;
    rawMatches.temperature = `Heatwave Preset (+5.0°C)`;
  }

  // 6. Extract Irrigation Changes
  let irrigationMultiplier: number | undefined = undefined;
  let irrigationFailure: boolean | undefined = undefined;

  if (clean.includes('pump failure') || clean.includes('irrigation failure') || clean.includes('stop irrigation') || clean.includes('no irrigation')) {
    irrigationMultiplier = 0.0;
    irrigationFailure = true;
    rawMatches.irrigation = 'Complete Pump Failure (0%)';
    if (scenarioType !== 'COMBINED') scenarioType = 'IRRIGATION_FAILURE';
  } else {
    const irrDrop = clean.match(/(?:irrigation|watering)[^%.\n]*(?:cut|drop|reduce|decrease|less)\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*%/i);
    const irrRise = clean.match(/(?:irrigation|watering)[^%.\n]*(?:increase|more)\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*%/i);
    if (irrDrop) {
      const pct = parseFloat(irrDrop[1]);
      irrigationMultiplier = Math.max(0, Math.round((1 - pct / 100) * 100) / 100);
      rawMatches.irrigation = `-${pct}% (multiplier: ${irrigationMultiplier})`;
      if (scenarioType !== 'COMBINED') scenarioType = 'IRRIGATION_DECREASE';
    } else if (irrRise) {
      const pct = parseFloat(irrRise[1]);
      irrigationMultiplier = Math.round((1 + pct / 100) * 100) / 100;
      rawMatches.irrigation = `+${pct}% (multiplier: ${irrigationMultiplier})`;
      if (scenarioType !== 'COMBINED') scenarioType = 'IRRIGATION_INCREASE';
    }
  }

  // 7. Extract Fertilizer / Nitrogen Changes
  let nitrogenMultiplier: number | undefined = undefined;
  if (clean.includes('nitrogen deficiency') || clean.includes('no nitrogen') || clean.includes('skip fertilizer')) {
    nitrogenMultiplier = 0.50;
    rawMatches.fertilizer = 'Nitrogen Deficit (-50%)';
    if (scenarioType !== 'COMBINED') scenarioType = 'NITROGEN_DEFICIENCY';
  }

  // 8. Extract Disease and Pest Outbreak
  let diseasePressureDelta: number | undefined = undefined;
  let pestPressureDelta: number | undefined = undefined;

  if (clean.includes('disease') || clean.includes('blight') || clean.includes('fungus')) {
    diseasePressureDelta = 40;
    rawMatches.disease = 'Fungal Outbreak (+40% pressure)';
    if (scenarioType !== 'COMBINED') scenarioType = 'DISEASE_OUTBREAK';
  }
  if (clean.includes('pest') || clean.includes('locust') || clean.includes('worm')) {
    pestPressureDelta = 45;
    rawMatches.pest = 'Pest Infestation (+45% pressure)';
    if (scenarioType !== 'COMBINED') scenarioType = 'PEST_OUTBREAK';
  }

  // If multiple parameters are active, mark as COMBINED
  const activeParamsCount = [
    rainfallMultiplier !== undefined,
    temperatureDelta !== undefined,
    irrigationMultiplier !== undefined,
    nitrogenMultiplier !== undefined,
    diseasePressureDelta !== undefined,
    pestPressureDelta !== undefined,
  ].filter(Boolean).length;

  if (activeParamsCount >= 2) {
    scenarioType = 'COMBINED';
  }

  return {
    scenarioType,
    durationDays,
    targetZones,
    rainfallMultiplier,
    rainfallDeltaMm,
    temperatureDelta,
    irrigationMultiplier,
    irrigationFailure,
    nitrogenMultiplier,
    diseasePressureDelta,
    pestPressureDelta,
    rawMatches,
  };
}

// ------------------------------------------------------------
// Step 3: Pydantic/Schema Validation & Structured Scenario JSON
// ------------------------------------------------------------

/**
 * Converts extracted parameters into the official structured Scenario JSON contract.
 */
export function buildStructuredScenario(params: ExtractedParameters): StructuredScenarioJSON {
  const changes: ScenarioChangesPayload = {};

  if (params.rainfallMultiplier !== undefined) {
    changes.rainfall_multiplier = params.rainfallMultiplier;
  }
  if (params.rainfallDeltaMm !== undefined) {
    changes.rainfall_delta_mm = params.rainfallDeltaMm;
  }
  if (params.temperatureDelta !== undefined) {
    changes.temperature_delta = params.temperatureDelta;
  }
  if (params.irrigationMultiplier !== undefined) {
    changes.irrigation_multiplier = params.irrigationMultiplier;
  }
  if (params.irrigationFailure !== undefined) {
    changes.irrigation_failure = params.irrigationFailure;
  }
  if (params.nitrogenMultiplier !== undefined) {
    changes.nitrogen_multiplier = params.nitrogenMultiplier;
  }
  if (params.diseasePressureDelta !== undefined) {
    changes.disease_pressure_delta = params.diseasePressureDelta;
  }
  if (params.pestPressureDelta !== undefined) {
    changes.pest_pressure_delta = params.pestPressureDelta;
  }

  // Schema validation: ensure at least one change modifier is set
  if (Object.keys(changes).length === 0) {
    // Default fallback modifier if query was ambiguous
    changes.rainfall_multiplier = 0.60;
  }

  return {
    scenario_type: params.scenarioType,
    duration_days: Math.max(1, Math.min(180, params.durationDays)),
    target_zones: params.targetZones.length > 0 ? params.targetZones : ['all'],
    changes,
  };
}

/**
 * End-to-End NLP Interface: text -> StructuredScenarioJSON
 */
export function parseNaturalLanguageScenario(
  query: string,
  availableZones: (Zone | ZoneInput)[] = []
): {
  scenarioJson: StructuredScenarioJSON;
  classification: IntentClassificationResult;
  extractedParams: ExtractedParameters;
} {
  const classification = classifyScenarioIntent(query);
  const extractedParams = extractScenarioParameters(query, availableZones);
  const scenarioJson = buildStructuredScenario(extractedParams);

  return {
    scenarioJson,
    classification,
    extractedParams,
  };
}
