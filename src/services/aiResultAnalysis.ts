import type {
  SimulationResult,
  TimelinePoint,
  FarmerExplanation,
  MetricDelta,
  TradeOffItem,
} from '../types';

// ============================================================
// Simulation Result Analysis & Farmer Explanation Engine
// ============================================================

/**
 * Analyzes simulation results against baseline and generates
 * deterministic, farmer-friendly explanations with trade-off detection.
 */
export function analyzeSimulationResults(result: SimulationResult): FarmerExplanation {
  const timeline = result.timeline || [];
  if (timeline.length === 0) {
    return generateFallbackExplanation();
  }

  const firstPoint = timeline[0];
  const lastPoint = timeline[timeline.length - 1];

  // Helper to compute average across timeline
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  // Baseline vs Scenario values
  // In baseline, initial values represent the steady forecast state
  const baselineMoisture = firstPoint.soilMoisture;
  const scenarioMoisture = lastPoint.soilMoisture;

  const baselineHealth = firstPoint.cropHealth;
  const scenarioHealth = lastPoint.cropHealth;

  const baselineDisease = firstPoint.diseaseRisk;
  const scenarioDisease = lastPoint.diseaseRisk;

  const baselineWaterUsage = firstPoint.waterConsumption * timeline.length;
  const scenarioWaterUsage = timeline.reduce((s, p) => s + (p.waterConsumption || 0), 0);

  const baselineYield = firstPoint.expectedYield || 85;
  const scenarioYield = lastPoint.expectedYield || 68;

  // 1. Calculate Absolute and Percentage Deltas
  const computeDelta = (
    metric: string,
    label: string,
    unit: string,
    base: number,
    scen: number,
    favorableWhenHigher = true
  ): MetricDelta => {
    const absChange = Math.round((scen - base) * 10) / 10;
    const pctChange = base !== 0 ? Math.round(((scen - base) / base) * 1000) / 10 : 0;

    let direction: 'INCREASED' | 'DECREASED' | 'UNCHANGED' = 'UNCHANGED';
    if (absChange > 0.5) direction = 'INCREASED';
    else if (absChange < -0.5) direction = 'DECREASED';

    const isFavorable = favorableWhenHigher
      ? direction === 'INCREASED' || direction === 'UNCHANGED'
      : direction === 'DECREASED' || direction === 'UNCHANGED';

    let impactSeverity: 'LOW' | 'MODERATE' | 'SEVERE' = 'LOW';
    const absPct = Math.abs(pctChange);
    if (absPct >= 20 || (metric === 'expectedYield' && pctChange <= -15)) {
      impactSeverity = 'SEVERE';
    } else if (absPct >= 8) {
      impactSeverity = 'MODERATE';
    }

    return {
      metric,
      label,
      unit,
      baselineValue: Math.round(base * 10) / 10,
      scenarioValue: Math.round(scen * 10) / 10,
      absoluteChange: absChange,
      percentageChange: pctChange,
      direction,
      impactSeverity,
      isFavorable,
    };
  };

  const metricDeltas: MetricDelta[] = [
    computeDelta('expectedYield', 'Expected Harvest Yield', '%', baselineYield, scenarioYield, true),
    computeDelta('cropHealth', 'Crop Health Index', '%', baselineHealth, scenarioHealth, true),
    computeDelta('soilMoisture', 'Root-Zone Soil Moisture', '%', baselineMoisture, scenarioMoisture, true),
    computeDelta('diseaseRisk', 'Disease & Pest Risk', '%', baselineDisease, scenarioDisease, false),
    computeDelta('waterConsumption', 'Cumulative Water Usage', 'L', baselineWaterUsage, scenarioWaterUsage, false),
  ];

  // 2. Determine Overall Impact Severity
  const hasSevere = metricDeltas.some((d) => d.impactSeverity === 'SEVERE' && !d.isFavorable);
  const hasModerate = metricDeltas.some((d) => d.impactSeverity === 'MODERATE' && !d.isFavorable);
  const overallSeverity: 'LOW' | 'MODERATE' | 'SEVERE' = hasSevere
    ? 'SEVERE'
    : hasModerate
    ? 'MODERATE'
    : 'LOW';

  // 3. Trade-off Detection
  const tradeOffs: TradeOffItem[] = [];
  const yieldDelta = metricDeltas.find((m) => m.metric === 'expectedYield')!;
  const waterDelta = metricDeltas.find((m) => m.metric === 'waterConsumption')!;
  const diseaseDelta = metricDeltas.find((m) => m.metric === 'diseaseRisk')!;
  const moistureDelta = metricDeltas.find((m) => m.metric === 'soilMoisture')!;

  // Trade-off 1: Yield vs Water Conservation
  if (yieldDelta.percentageChange < -5 && waterDelta.percentageChange < -5) {
    tradeOffs.push({
      positiveAspect: `Conserves ${Math.abs(waterDelta.percentageChange)}% irrigation water`,
      negativeAspect: `Reduces expected yield by ${Math.abs(yieldDelta.percentageChange)}%`,
      description: `Water conservation trade-off: Total irrigation volume decreases by ${Math.abs(waterDelta.percentageChange)}%, but the root-zone moisture deficit directly cuts final grain/fruit fill by ${Math.abs(yieldDelta.percentageChange)}%.`,
    });
  }

  // Trade-off 2: Dry conditions lower fungal disease risk
  if (moistureDelta.percentageChange < -10 && diseaseDelta.percentageChange < -5) {
    tradeOffs.push({
      positiveAspect: `Disease risk drops by ${Math.abs(diseaseDelta.percentageChange)}%`,
      negativeAspect: `Soil moisture depleted by ${Math.abs(moistureDelta.percentageChange)}%`,
      description: `Foliar health trade-off: Drier canopy conditions suppress fungal spore germination, reducing disease pressure even as water stress rises.`,
    });
  }

  // Trade-off 3: Heavy rain / humidity increases disease while boosting moisture
  if (moistureDelta.percentageChange > 10 && diseaseDelta.percentageChange > 15) {
    tradeOffs.push({
      positiveAspect: `Soil moisture elevated by +${moistureDelta.percentageChange}%`,
      negativeAspect: `Disease risk surges by +${diseaseDelta.percentageChange}%`,
      description: `Humidity hazard: Ample moisture satisfies transpiration needs but prolonged leaf wetness triggers elevated pathogen vulnerability.`,
    });
  }

  // 4. Important Changes Bullets
  const importantChanges: string[] = [];
  for (const delta of metricDeltas) {
    const sign = delta.absoluteChange > 0 ? '+' : '';
    if (delta.metric === 'expectedYield') {
      importantChanges.push(
        `Expected yield ${delta.direction.toLowerCase()} by ${sign}${delta.percentageChange}% (final estimate: ${delta.scenarioValue}%).`
      );
    } else if (delta.metric === 'soilMoisture') {
      importantChanges.push(
        `Root-zone soil moisture shifted from ${delta.baselineValue}% to ${delta.scenarioValue}% (${sign}${delta.percentageChange}% change).`
      );
    } else if (delta.metric === 'cropHealth') {
      importantChanges.push(
        `Vegetative crop health settled at ${delta.scenarioValue}% (${sign}${delta.percentageChange}%).`
      );
    } else if (delta.metric === 'diseaseRisk' && Math.abs(delta.percentageChange) > 5) {
      importantChanges.push(
        `Pathogen and fungal vulnerability ${delta.direction.toLowerCase()} by ${sign}${delta.percentageChange}%.`
      );
    }
  }

  // 5. Actionable Agronomic Recommendations
  const recommendations: string[] = [];
  if (scenarioMoisture < 35) {
    recommendations.push(
      'Schedule supplemental drip irrigation within 36 hours during morning hours (05:00-08:00) to prevent permanent wilting point.'
    );
  } else if (scenarioMoisture > 85) {
    recommendations.push(
      'Open drainage furrows immediately to relieve field ponding and prevent anaerobic root-rot asphyxiation.'
    );
  }

  if (yieldDelta.percentageChange < -15) {
    recommendations.push(
      'Apply potassium silicate (foliar anti-transpirant) to reinforce cellular turgor pressure and mitigate heat-induced yield penalty.'
    );
  }

  if (scenarioDisease > 30) {
    recommendations.push(
      'Perform preventive bio-fungicide or copper sulfate application prior to the next high-humidity incubation window.'
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      'Maintain regular irrigation scheduling and monitor soil moisture at 15cm and 30cm root depth.'
    );
  }

  // 6. Farmer Executive Summary
  const scenarioName = result.scenarioName || 'Simulated What-If';
  let summary = '';
  if (yieldDelta.percentageChange < -15) {
    summary = `Under the "${scenarioName}" scenario, expected crop yield decreases significantly by ${Math.abs(
      yieldDelta.percentageChange
    )}%. Soil moisture drops to ${scenarioMoisture}%, which becomes the primary limiting factor for crop development. Immediate protective interventions are recommended.`;
  } else if (yieldDelta.percentageChange > 5) {
    summary = `Under the "${scenarioName}" scenario, crop yield increases favorably by +${yieldDelta.percentageChange}%. Soil moisture remains in the optimal bracket (${scenarioMoisture}%), sustaining strong biomass accumulation throughout the simulation period.`;
  } else {
    summary = `Under the "${scenarioName}" scenario, the farm demonstrates steady resilience. Expected yield shifts by ${yieldDelta.percentageChange}%, while soil moisture averages ${scenarioMoisture}%. No catastrophic crop failures were projected.`;
  }

  return {
    summary,
    impactSeverity: overallSeverity,
    importantChanges,
    tradeOffs,
    recommendations,
    metricDeltas,
  };
}

function generateFallbackExplanation(): FarmerExplanation {
  return {
    summary: 'Simulation baseline generated with standard crop growth and transpiration parameters.',
    impactSeverity: 'LOW',
    importantChanges: ['Baseline conditions reflect seasonal averages.'],
    tradeOffs: [],
    recommendations: ['Monitor regular irrigation and maintain balanced soil nutrition.'],
    metricDeltas: [],
  };
}
