import axios, { AxiosError, AxiosInstance } from 'axios';
import type {
  ComparisonRequest,
  ComparisonResult,
  Farm,
  FarmCreateInput,
  FarmRiskAssessment,
  Scenario,
  ScenarioChange,
  ScenarioSuggestion,
  SimulationRequest,
  SimulationResult,
  User,
  Zone,
  ZoneInput,
} from '../types';
import { runComprehensiveSimulation } from './simulationEngine';
import { analyzeFarmRiskRF } from './aiRiskModel';
import { parseNaturalLanguageScenario } from './nlpScenarioParser';
import { analyzeSimulationResults } from './aiResultAnalysis';
import { ensureDefaultFarms, getMockFarmById, isMockEnabled, saveMockFarm } from './mockData';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor adding Auth Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor formatting API errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; detail?: string }>) =>
    Promise.reject({
      message:
        error.response?.data?.message ||
        error.response?.data?.detail ||
        error.message ||
        'An unexpected error occurred',
      status: error.response?.status,
      details: JSON.stringify(error.response?.data),
    })
);

type ApiRecord = Record<string, any>;

// Mapper helpers
const zoneFromApi = (zone: ApiRecord): Zone => ({
  id: zone.zone_id || zone.id,
  farmId: zone.farm_id || zone.farmId,
  name: zone.name,
  area: zone.area_acres || zone.area || 0,
  crop: zone.crop || 'Wheat',
  soilType: zone.soil || zone.soilType || 'Loamy',
  growthStage: zone.growth_stage || zone.growthStage || 'Vegetative',
  irrigationMethod: zone.irrigation || zone.irrigationMethod || 'Drip',
  soilMoisture: zone.soil_moisture ?? zone.soilMoisture ?? 50,
  temperature: zone.temperature ?? 25,
  humidity: zone.humidity ?? 60,
  rainfall: zone.rainfall ?? 100,
  nitrogen: zone.nitrogen ?? 50,
  phosphorus: zone.phosphorus ?? 30,
  potassium: zone.potassium ?? 40,
  healthScore: zone.health_score ?? zone.healthScore ?? 85,
  diseaseRisk: zone.disease_risk ?? zone.diseaseRisk ?? 10,
  boundary: zone.boundary,
  boundaryShape: zone.boundary_shape || zone.boundaryShape,
  stressState: zone.stress_state || zone.stressState,
});

const farmFromApi = (farm: ApiRecord): Farm => ({
  id: farm.farm_id || farm.id,
  ownerId: farm.owner_id || farm.ownerId,
  name: farm.name,
  location: farm.location,
  area: farm.area_acres || farm.area || 0,
  latitude: farm.latitude,
  longitude: farm.longitude,
  numberOfZones: farm.number_of_zones || farm.numberOfZones || (farm.zones ? farm.zones.length : 0),
  boundary: farm.boundary,
  boundaryAreaAcres: farm.boundary_area_acres || farm.boundaryAreaAcres,
  boundaryAreaHectares: farm.boundary_area_hectares || farm.boundaryAreaHectares,
  boundaryPerimeterMeters: farm.boundary_perimeter_meters || farm.boundaryPerimeterMeters,
  boundaryShape: farm.boundary_shape || farm.boundaryShape,
  zones: (farm.zones || []).map(zoneFromApi),
  createdAt: farm.created_at || farm.createdAt,
  updatedAt: farm.updated_at || farm.updatedAt,
});

const changesFromApi = (changes: ApiRecord): ScenarioChange[] => {
  if (Array.isArray(changes)) return changes;
  return Object.entries(changes || {}).map(([parameter, value]) => {
    const numericValue = Number(value);
    if (parameter === 'rainfall_multiplier') {
      return {
        type: numericValue < 1 ? 'rainfall_decrease' : 'rainfall_increase',
        parameter: 'rainfall',
        value: (numericValue - 1) * 100,
        unit: '%',
      } as ScenarioChange;
    }
    if (parameter === 'temperature_delta') {
      return {
        type: numericValue < 0 ? 'temperature_decrease' : 'temperature_increase',
        parameter: 'temperature',
        value: numericValue,
        unit: '°C',
      } as ScenarioChange;
    }
    if (parameter === 'irrigation_multiplier') {
      return {
        type: numericValue < 1 ? 'irrigation_decrease' : 'irrigation_increase',
        parameter: 'irrigation',
        value: (numericValue - 1) * 100,
        unit: '%',
      } as ScenarioChange;
    }
    return { type: 'combined', parameter, value: numericValue, unit: 'value' } as ScenarioChange;
  });
};

const scenarioFromApi = (scenario: ApiRecord): Scenario => ({
  id: scenario.scenario_id || scenario.id,
  farmId: scenario.farm_id || scenario.farmId,
  name: scenario.name,
  description: scenario.description,
  duration: scenario.duration_days || scenario.duration || 30,
  affectedZones: scenario.target_zones || scenario.affectedZones || [],
  changes: changesFromApi(scenario.changes),
  scenarioType: scenario.scenario_type || scenario.scenarioType,
  naturalLanguageQuery: scenario.natural_language_query || scenario.naturalLanguageQuery,
  createdAt: scenario.created_at || scenario.createdAt,
});

const simulationFromApi = (simulation: ApiRecord): SimulationResult => ({
  id: simulation.simulation_id || simulation.id,
  farmId: simulation.farm_id || simulation.farmId,
  scenarioId: simulation.scenario_id || simulation.scenarioId,
  scenarioName: simulation.scenario_name || simulation.scenarioName || 'Simulation Run',
  timeline: (simulation.timeline || []).map((point: ApiRecord) => ({
    day: point.day,
    label: point.label || `Day ${point.day}`,
    soilMoisture: point.soil_moisture ?? point.soilMoisture ?? 50,
    cropHealth: point.crop_health ?? point.cropHealth ?? 80,
    diseaseRisk: point.disease_risk ?? point.diseaseRisk ?? 10,
    waterConsumption: point.water_consumption ?? point.waterConsumption ?? 12,
    expectedYield: point.expected_yield ?? point.expectedYield ?? 3.5,
    waterStress: point.water_stress ?? point.waterStress,
    heatStress: point.heat_stress ?? point.heatStress,
    zones: (point.zones || []).map((zone: ApiRecord) => ({
      zoneId: zone.zone_id || zone.zoneId,
      zoneName: zone.zone_name || zone.zoneName,
      soilMoisture: zone.soil_moisture ?? zone.soilMoisture ?? 50,
      cropHealth: zone.crop_health ?? zone.cropHealth ?? 80,
      diseaseRisk: zone.disease_risk ?? zone.diseaseRisk ?? 10,
      waterConsumption: zone.water_consumption ?? zone.waterConsumption ?? 12,
      expectedYield: zone.expected_yield ?? zone.expectedYield ?? 3.5,
    })),
  })),
  summary: {
    totalWaterUsage: simulation.summary?.total_water_usage ?? simulation.summary?.totalWaterUsage ?? 150,
    averageCropHealth: simulation.summary?.average_crop_health ?? simulation.summary?.averageCropHealth ?? 85,
    averageDiseaseRisk: simulation.summary?.average_disease_risk ?? simulation.summary?.averageDiseaseRisk ?? 12,
    totalExpectedYield: simulation.summary?.total_expected_yield ?? simulation.summary?.totalExpectedYield ?? 45,
    averageSoilMoisture: simulation.summary?.average_soil_moisture ?? simulation.summary?.averageSoilMoisture ?? 55,
  },
  aiExplanation: simulation.ai_explanation || simulation.aiExplanation || 'Simulation complete.',
  createdAt: simulation.created_at || simulation.createdAt,
});

const zoneToApi = (zone: Partial<ZoneInput>): ApiRecord => ({
  ...(zone.name !== undefined && { name: zone.name }),
  ...(zone.area !== undefined && { area_acres: zone.area }),
  ...(zone.crop !== undefined && { crop: zone.crop }),
  ...(zone.soilType !== undefined && { soil: zone.soilType }),
  ...(zone.growthStage !== undefined && { growth_stage: zone.growthStage }),
  ...(zone.irrigationMethod !== undefined && { irrigation: zone.irrigationMethod }),
  ...(zone.soilMoisture !== undefined && { soil_moisture: zone.soilMoisture }),
  ...(zone.temperature !== undefined && { temperature: zone.temperature }),
  ...(zone.humidity !== undefined && { humidity: zone.humidity }),
  ...(zone.rainfall !== undefined && { rainfall: zone.rainfall }),
  ...(zone.nitrogen !== undefined && { nitrogen: zone.nitrogen }),
  ...(zone.phosphorus !== undefined && { phosphorus: zone.phosphorus }),
  ...(zone.potassium !== undefined && { potassium: zone.potassium }),
});

const changesToApi = (changes: ScenarioChange[] | undefined): ApiRecord => {
  const output: ApiRecord = {};
  (changes || []).forEach((change) => {
    switch (change.type) {
      case 'rainfall_decrease':
      case 'rainfall_increase':
        output.rainfall_multiplier = 1 + change.value / 100;
        break;
      case 'temperature_increase':
        output.temperature_delta = change.value;
        break;
      case 'temperature_decrease':
        output.temperature_delta = -Math.abs(change.value);
        break;
      case 'heatwave':
        output.temperature_delta = 5;
        output.heatwave_days = change.value;
        break;
      case 'irrigation_decrease':
      case 'irrigation_increase':
        output.irrigation_multiplier = Math.max(0, 1 + change.value / 100);
        break;
      case 'irrigation_failure':
        output.irrigation_multiplier = 0;
        break;
      case 'fertilizer_increase':
      case 'fertilizer_decrease':
        output.nutrient_multiplier = Math.max(0, 1 + change.value / 100);
        break;
      case 'nitrogen_deficiency':
        output.nitrogen_multiplier = Math.max(0, 1 + change.value / 100);
        break;
      case 'phosphorus_deficiency':
        output.phosphorus_multiplier = Math.max(0, 1 + change.value / 100);
        break;
      case 'potassium_deficiency':
        output.potassium_multiplier = Math.max(0, 1 + change.value / 100);
        break;
      case 'disease_introduced':
      case 'disease_spread':
        output.disease_pressure = (output.disease_pressure || 0) + change.value * 18;
        break;
      case 'pest_outbreak':
        output.pest_pressure = (output.pest_pressure || 0) + change.value * 14;
        break;
      default:
        output[change.parameter] = change.value;
    }
  });
  return output;
};

// ============================================================
// Farm API (FastAPI Backend + Firestore Sync)
// ============================================================
export const farmApi = {
  create: async (data: FarmCreateInput): Promise<Farm> => {
    let farm: Farm;
    try {
      const res = await apiClient.post('/farms', {
        name: data.name,
        location: data.location,
        area_acres: data.area,
        latitude: data.latitude,
        longitude: data.longitude,
        number_of_zones: data.numberOfZones,
        owner_id: data.ownerId,
      });
      farm = farmFromApi(res.data);
    } catch (error) {
      if (!isMockEnabled()) throw error;
      // Fallback local farm object
      farm = {
        id: `farm_${Date.now()}`,
        ownerId: data.ownerId,
        name: data.name,
        location: data.location,
        area: data.area,
        latitude: data.latitude || 30.901,
        longitude: data.longitude || 75.857,
        numberOfZones: data.numberOfZones,
        zones: Array.from({ length: data.numberOfZones || 1 }, (_, i) => ({
          id: `zone_${Date.now()}_${i + 1}`,
          farmId: `farm_${Date.now()}`,
          name: `Field ${String.fromCharCode(65 + i)}`,
          area: Number((data.area / (data.numberOfZones || 1)).toFixed(1)),
          crop: 'Wheat',
          soilType: 'Loamy',
          growthStage: 'Vegetative',
          irrigationMethod: 'Drip',
          soilMoisture: 55,
          temperature: 24,
          humidity: 60,
          rainfall: 100,
          nitrogen: 60,
          phosphorus: 30,
          potassium: 40,
        })),
        createdAt: new Date().toISOString(),
      };
      saveMockFarm(farm);
    }

    // The API is the single Firestore writer. Writing the same document from
    // the browser used a different camelCase schema and hid permission errors.
    return farm;
  },

  get: async (farmId: string): Promise<Farm> => {
    try {
      const res = await apiClient.get(`/farms/${farmId}`);
      return farmFromApi(res.data);
    } catch (error) {
      if (isMockEnabled()) {
        const mockFarm = getMockFarmById(farmId);
        if (mockFarm) return mockFarm;
      }
      throw error;
    }
  },

  list: async (ownerId: string): Promise<Farm[]> => {
    try {
      const res = await apiClient.get('/farms', { params: { owner_id: ownerId } });
      return res.data.map(farmFromApi);
    } catch (error) {
      if (isMockEnabled()) {
        return ensureDefaultFarms().filter((farm) => farm.ownerId === ownerId);
      }
      throw error;
    }
  },

  update: async (farmId: string, data: Partial<Farm>): Promise<Farm> => {
    let updated: Farm;
    try {
      const res = await apiClient.put(`/farms/${farmId}`, {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.area !== undefined && { area_acres: data.area }),
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
      });
      updated = farmFromApi(res.data);
    } catch (error) {
      if (!isMockEnabled()) throw error;
      const current = await farmApi.get(farmId);
      updated = { ...current, ...data };
      saveMockFarm(updated);
    }
    return updated;
  },

  delete: async (farmId: string): Promise<void> => {
    try {
      await apiClient.delete(`/farms/${farmId}`);
    } catch (error) {
      if (!isMockEnabled()) throw error;
    }
  },
};

// ============================================================
// Zone API
// ============================================================
export const zoneApi = {
  create: async (farmId: string, data: ZoneInput): Promise<Zone> => {
    try {
      const res = await apiClient.post(`/farms/${farmId}/zones`, zoneToApi(data));
      return zoneFromApi(res.data);
    } catch (error) {
      if (!isMockEnabled()) throw error;
      const newZone: Zone = {
        id: data.id || `zone_${Date.now()}`,
        farmId,
        name: data.name,
        area: data.area,
        crop: data.crop,
        soilType: data.soilType,
        growthStage: data.growthStage,
        irrigationMethod: data.irrigationMethod,
        soilMoisture: data.soilMoisture,
        temperature: data.temperature,
        humidity: data.humidity,
        rainfall: data.rainfall,
        nitrogen: data.nitrogen,
        phosphorus: data.phosphorus,
        potassium: data.potassium,
        healthScore: data.healthScore || 85,
        diseaseRisk: data.diseaseRisk || 10,
        boundary: data.boundary,
        boundaryShape: data.boundaryShape,
        stressState: data.stressState,
      };
      return newZone;
    }
  },

  update: async (farmId: string, zoneId: string, data: Partial<ZoneInput>): Promise<Zone> => {
    try {
      const res = await apiClient.put(`/farms/${farmId}/zones/${zoneId}`, zoneToApi(data));
      return zoneFromApi(res.data);
    } catch (error) {
      if (!isMockEnabled()) throw error;
      const currentFarm = await farmApi.get(farmId);
      const zone = currentFarm.zones.find((z) => z.id === zoneId);
      const updatedZone = { ...(zone || ({} as Zone)), ...data };
      return updatedZone as Zone;
    }
  },

  delete: async (farmId: string, zoneId: string): Promise<void> => {
    try {
      await apiClient.delete(`/farms/${farmId}/zones/${zoneId}`);
    } catch (error) {
      if (!isMockEnabled()) throw error;
    }
  },
};

// ============================================================
// Simulation API
// ============================================================
export const simulationApi = {
  run: async (data: SimulationRequest): Promise<SimulationResult> => {
    let result: SimulationResult;
    try {
      const res = await apiClient.post('/simulate', {
        farm_id: data.farmId,
        scenario_id: data.scenarioId,
        zones: (data.zones || []).map(zoneToApi),
        weather_modifiers: data.weatherModifiers,
      });
      result = simulationFromApi(res.data);
    } catch (error) {
      if (!isMockEnabled()) throw error;
      // Fallback: execute client-side simulation engine
      const farm = await farmApi.get(data.farmId);
      result = runComprehensiveSimulation({
        farmId: data.farmId,
        zones: data.zones && data.zones.length > 0 ? data.zones : farm.zones,
        mode: data.mode || 'what_if',
        weatherModifiers: data.weatherModifiers,
      });
    }

    return result;
  },

  get: async (simId: string): Promise<SimulationResult> => {
    try {
      const res = await apiClient.get(`/simulation/${simId}`);
      return simulationFromApi(res.data);
    } catch (error) {
      if (!isMockEnabled()) throw error;
      throw new Error('Simulation not found');
    }
  },

  list: async (farmId: string): Promise<SimulationResult[]> => {
    try {
      const res = await apiClient.get(`/farms/${farmId}/simulations`);
      return res.data.map(simulationFromApi);
    } catch (error) {
      if (!isMockEnabled()) throw error;
      return [];
    }
  },
};

// ============================================================
// Scenario API
// ============================================================
export const scenarioApi = {
  create: async (data: Partial<Scenario>): Promise<Scenario> => {
    let scenario: Scenario;
    try {
      const res = await apiClient.post('/scenarios', {
        farm_id: data.farmId,
        name: data.name || 'Custom Scenario',
        duration_days: data.duration || 30,
        target_zones: data.affectedZones || [],
        changes: changesToApi(data.changes),
        natural_language_query: data.naturalLanguageQuery,
        description: data.description,
        scenario_type: data.scenarioType,
      });
      scenario = scenarioFromApi(res.data);
    } catch (error) {
      if (!isMockEnabled()) throw error;
      scenario = {
        id: `scenario_${Date.now()}`,
        farmId: data.farmId || 'farm_default',
        name: data.name || 'Custom Scenario',
        description: data.description || '',
        duration: data.duration || 30,
        affectedZones: data.affectedZones || [],
        changes: data.changes || [],
        naturalLanguageQuery: data.naturalLanguageQuery,
        scenarioType: data.scenarioType || 'COMBINED',
        createdAt: new Date().toISOString(),
      };
    }
    return scenario;
  },

  list: async (farmId: string): Promise<Scenario[]> => {
    try {
      const res = await apiClient.get(`/farms/${farmId}/scenarios`);
      return res.data.map(scenarioFromApi);
    } catch (error) {
      if (!isMockEnabled()) throw error;
      return [];
    }
  },

  get: async (scenarioId: string): Promise<Scenario> => {
    try {
      const res = await apiClient.get(`/scenarios/${scenarioId}`);
      return scenarioFromApi(res.data);
    } catch {
      throw new Error('Scenario not found');
    }
  },

  createStructured: async (data: {
    farmId: string;
    name: string;
    duration: number;
    targetZones: string[];
    changes: Record<string, number>;
    scenarioType: string;
  }): Promise<Scenario> => {
    let scenario: Scenario;
    try {
      const res = await apiClient.post('/scenarios', {
        farm_id: data.farmId,
        name: data.name,
        duration_days: data.duration,
        target_zones: data.targetZones,
        changes: data.changes,
        scenario_type: data.scenarioType,
      });
      scenario = scenarioFromApi(res.data);
    } catch (error) {
      if (!isMockEnabled()) throw error;
      scenario = {
        id: `scenario_${Date.now()}`,
        farmId: data.farmId,
        name: data.name,
        duration: data.duration,
        affectedZones: data.targetZones,
        changes: Object.entries(data.changes).map(([k, v]) => ({
          type: 'combined',
          parameter: k,
          value: v,
          unit: '',
        })),
        scenarioType: data.scenarioType,
        createdAt: new Date().toISOString(),
      };
    }
    return scenario;
  },
};

// ============================================================
// Comparison API
// ============================================================
export const comparisonApi = {
  compare: async (data: ComparisonRequest): Promise<ComparisonResult> => {
    try {
      const response = await apiClient.post('/compare', { simulation_ids: data.simulationIds });
      return {
        simulations: response.data.simulations.map((simulation: ApiRecord) => ({
          id: simulation.simulation_id,
          scenarioName: simulation.scenario_name,
          summary: {
            totalWaterUsage: simulation.summary.total_water_usage,
            averageCropHealth: simulation.summary.average_crop_health,
            averageDiseaseRisk: simulation.summary.average_disease_risk,
            totalExpectedYield: simulation.summary.total_expected_yield,
            averageSoilMoisture: simulation.summary.average_soil_moisture,
          },
        })),
        timeline: response.data.timeline.map((point: ApiRecord) => ({
          day: point.day,
          label: point.label,
          simulations: point.simulations.map((simulation: ApiRecord) => ({
            id: simulation.simulation_id,
            name: simulation.name,
            soilMoisture: simulation.soil_moisture,
            cropHealth: simulation.crop_health,
            diseaseRisk: simulation.disease_risk,
            waterConsumption: simulation.water_consumption,
            expectedYield: simulation.expected_yield,
          })),
        })),
        aiExplanation: response.data.ai_explanation,
      };
    } catch {
      throw new Error('Comparison API error');
    }
  },
};

// ============================================================
// AI API (FastAPI Backend + Client Reference Fallback)
// ============================================================
export const aiApi = {
  parseScenario: async (text: string, farmId: string): Promise<Scenario> => {
    try {
      const res = await apiClient.post('/ai/parse-scenario', { text, farm_id: farmId });
      return scenarioFromApi(res.data);
    } catch {
      const farm = await farmApi.get(farmId);
      const parsed = parseNaturalLanguageScenario(text, farm.zones || []);
      return {
        id: `scenario_${Date.now()}`,
        farmId,
        name: parsed.classification?.intent ? `${parsed.classification.intent} Scenario` : 'Parsed Scenario',
        duration: parsed.scenarioJson?.duration_days || 30,
        affectedZones: parsed.scenarioJson?.target_zones || [],
        changes: [],
        naturalLanguageQuery: text,
        scenarioType: parsed.scenarioJson?.scenario_type || 'COMBINED',
        createdAt: new Date().toISOString(),
      };
    }
  },

  analyzeRisk: async (farmId: string): Promise<FarmRiskAssessment> => {
    try {
      const res = await apiClient.post('/ai/analyze-risk', { farm_id: farmId });
      const assessment = res.data;
      return {
        farmId: assessment.farm_id,
        overallRisk: assessment.overall_risk,
        modelVersion: assessment.model_version,
        assessedAt: assessment.assessed_at,
        zoneRisks: (assessment.zone_risks || []).map((zone: ApiRecord) => ({
          zoneId: zone.zone_id,
          zoneName: zone.zone_name,
          waterStress: zone.water_stress,
          heatStress: zone.heat_stress,
          diseaseRisk: zone.disease_risk,
          nutrientRisk: zone.nutrient_risk,
          topContributingFactors: (zone.top_contributing_factors || []).map((factor: ApiRecord) => ({
            field: factor.field,
            value: factor.value,
            contribution: factor.contribution,
            message: factor.message,
          })),
        })),
      };
    } catch {
      const farm = await farmApi.get(farmId);
      const firstZone = farm.zones && farm.zones.length > 0 ? farm.zones[0] : null;
      if (!firstZone) {
        return {
          farmId,
          overallRisk: 'LOW',
          zoneRisks: [],
          modelVersion: 'RandomForest-Client-v1.0',
          assessedAt: new Date().toISOString(),
        };
      }
      const rfResult = analyzeFarmRiskRF(firstZone);
      const overallLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
        rfResult.overallScore > 60 ? 'HIGH' : rfResult.overallScore > 35 ? 'MEDIUM' : 'LOW';

      return {
        farmId: farm.id,
        overallRisk: overallLevel,
        modelVersion: 'RandomForest-Client-v1.0',
        assessedAt: new Date().toISOString(),
        zoneRisks: (farm.zones || []).map((zone) => ({
          zoneId: zone.id,
          zoneName: zone.name,
          waterStress: rfResult.waterStress,
          heatStress: rfResult.heatStress,
          diseaseRisk: rfResult.diseaseRisk,
          nutrientRisk: rfResult.nutrientRisk,
          topContributingFactors: [
            {
              field: 'soilMoisture',
              value: zone.soilMoisture,
              contribution: 0.35,
              message: `Soil moisture at ${zone.soilMoisture}%`,
            },
          ],
        })),
      };
    }
  },

  suggestScenarios: async (
    farmId: string,
    riskAssessment?: FarmRiskAssessment
  ): Promise<{ suggestions: ScenarioSuggestion[]; source: string }> => {
    try {
      const res = await apiClient.post('/ai/suggest-scenarios', {
        farm_id: farmId,
        ...(riskAssessment && {
          risk_assessment: {
            farm_id: riskAssessment.farmId,
            overall_risk: riskAssessment.overallRisk,
            model_version: riskAssessment.modelVersion,
            assessed_at: riskAssessment.assessedAt,
            zone_risks: (riskAssessment.zoneRisks || []).map((zone) => ({
              zone_id: zone.zoneId,
              zone_name: zone.zoneName,
              water_stress: zone.waterStress,
              heat_stress: zone.heatStress,
              disease_risk: zone.diseaseRisk,
              nutrient_risk: zone.nutrientRisk,
              top_contributing_factors: (zone.topContributingFactors || []).map((factor) => ({
                field: factor.field,
                value: factor.value,
                contribution: factor.contribution,
                message: factor.message,
              })),
            })),
          },
        }),
      });
      return {
        suggestions: res.data.suggestions.map((item: ApiRecord) => ({
          id: item.suggestion_id || item.id,
          title: item.title,
          description: item.description,
          priority: item.priority,
          scenarioType: item.scenario_type,
          duration: item.duration_days,
          targetZones: item.target_zones,
          changes: item.changes,
        })),
        source: res.data.source,
      };
    } catch {
      return {
        suggestions: [
          {
            id: 'sugg_heatwave',
            title: 'Test 7-Day Heatwave Tolerance',
            description: 'Evaluate crop moisture depletion during severe 5°C temperature spike',
            priority: 'HIGH',
            scenarioType: 'HEATWAVE',
            duration: 7,
            targetZones: [],
            changes: { temperature_delta: 5, rainfall_multiplier: 0.3 },
          },
          {
            id: 'sugg_drought',
            title: 'Simulate 50% Water Reduction',
            description: 'Assess yield impact under prolonged rainfall deficit',
            priority: 'MEDIUM',
            scenarioType: 'RAIN_REDUCTION',
            duration: 14,
            targetZones: [],
            changes: { rainfall_multiplier: 0.5 },
          },
        ],
        source: 'client_ai_engine',
      };
    }
  },

  explainResult: async (simulationId: string): Promise<string> => {
    try {
      const res = await apiClient.post('/ai/explain-result', { simulation_id: simulationId });
      return res.data.explanation;
    } catch {
      return 'Simulation results analyzed by FarmSim AI engine.';
    }
  },
};

// ============================================================
// User Auth & Registration API
// ============================================================
export const userApi = {
   register: async (input: { name: string; email: string; password?: string; location?: string; specialty?: string }): Promise<User> => {
     const res = await apiClient.post('/users/register', input);
     if (res.data.session_token) {
       localStorage.setItem('auth_token', res.data.session_token);
     }
     if (res.data.firebase_token) {
       localStorage.setItem('firebase_token', res.data.firebase_token);
     }
     return {
       id: res.data.user_id || res.data.id,
       name: res.data.name,
       email: res.data.email,
       location: res.data.location || 'Local Farm Region',
       joinedAt: res.data.joined_at || new Date().toISOString().split('T')[0],
     };
   },

   login: async (email: string, password?: string): Promise<User> => {
     const res = await apiClient.post('/users/login', { email, password });
     if (res.data.session_token) {
       localStorage.setItem('auth_token', res.data.session_token);
     }
     if (res.data.firebase_token) {
       localStorage.setItem('firebase_token', res.data.firebase_token);
     }
     const user: User = {
       id: res.data.user_id || res.data.id,
       name: res.data.name,
       email: res.data.email,
       location: res.data.location || 'Local Farm Region',
       joinedAt: res.data.joined_at || new Date().toISOString().split('T')[0],
     };
     return user;
   },

   list: async (): Promise<User[]> => {
     try {
       const res = await apiClient.get('/users');
       return res.data.map((u: any) => ({
         id: u.user_id || u.id,
         name: u.name,
         email: u.email,
         location: u.location,
         joinedAt: u.joined_at || u.joinedAt,
       }));
     } catch {
       return [];
     }
   },
 };

export default apiClient;
