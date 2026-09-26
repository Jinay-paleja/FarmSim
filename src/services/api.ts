import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  Farm,
  FarmCreateInput,
  Zone,
  ZoneInput,
  Scenario,
  SimulationRequest,
  SimulationResult,
  ComparisonRequest,
  ComparisonResult,
} from '../types';
import { deleteMockFarm } from './mockData';

// ============================================================
// API Client Configuration
// ============================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; detail?: string }>) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.detail ||
      error.message ||
      'An unexpected error occurred';
    return Promise.reject({
      message,
      status: error.response?.status,
      details: JSON.stringify(error.response?.data),
    });
  }
);

// ============================================================
// ============================================================
// Normalization Helpers (ensures canonical id, farmId, ownerId)
// ============================================================

export function normalizeZone(raw: any): Zone {
  if (!raw) return raw;
  const canonicalId = String(raw.zoneId || raw.zone_id || raw.id || '');
  const canonicalFarmId = String(raw.farmId || raw.farm_id || '');
  return {
    ...raw,
    id: canonicalId,
    zoneId: canonicalId,
    zone_id: canonicalId,
    farmId: canonicalFarmId,
    farm_id: canonicalFarmId,
    name: raw.name || 'Field Plot',
    area: Number(raw.area ?? raw.area_acres ?? 5),
    crop: raw.crop || 'wheat',
    soilType: raw.soilType || raw.soil_type || 'loam',
    growthStage: raw.growthStage || raw.growth_stage || 'vegetative',
    irrigationMethod: raw.irrigationMethod || raw.irrigation_method || 'drip',
    soilMoisture: Number(raw.soilMoisture ?? raw.soil_moisture ?? 45),
    temperature: Number(raw.temperature ?? 24),
    humidity: Number(raw.humidity ?? 60),
    rainfall: Number(raw.rainfall ?? 15),
    nitrogen: Number(raw.nitrogen ?? 60),
    phosphorus: Number(raw.phosphorus ?? 40),
    potassium: Number(raw.potassium ?? 40),
    healthScore: Number(raw.healthScore ?? raw.health_score ?? 80),
    diseaseRisk: Number(raw.diseaseRisk ?? raw.disease_risk ?? 15),
  };
}

export function normalizeFarm(raw: any): Farm {
  if (!raw) return raw;
  const canonicalId = String(raw.farmId || raw.farm_id || raw.id || '');
  const canonicalOwner = String(raw.ownerId || raw.owner_id || '');
  const canonicalArea = Number(raw.area ?? raw.area_acres ?? raw.total_area ?? 10);
  const canonicalLat = raw.latitude !== undefined && raw.latitude !== null ? Number(raw.latitude) : undefined;
  const canonicalLng = raw.longitude !== undefined && raw.longitude !== null ? Number(raw.longitude) : undefined;

  let boundary = raw.boundary;
  if (!boundary && raw.boundaryGeoJson?.coordinates?.[0]) {
    boundary = raw.boundaryGeoJson.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng]);
  } else if (!boundary && Array.isArray(raw.boundary_points)) {
    boundary = raw.boundary_points.map((p: any) => [p.latitude, p.longitude]);
  }

  const zones = Array.isArray(raw.zones) ? raw.zones.map(normalizeZone) : [];

  return {
    ...raw,
    id: canonicalId,
    farmId: canonicalId,
    farm_id: canonicalId,
    ownerId: canonicalOwner,
    owner_id: canonicalOwner,
    name: raw.name || 'Unnamed Farm',
    location: raw.location_name || raw.location || raw.displayName || 'Selected Location',
    area: canonicalArea,
    area_acres: canonicalArea,
    latitude: canonicalLat,
    longitude: canonicalLng,
    boundary,
    boundary_points: boundary
      ? boundary.map(([lat, lng]: [number, number]) => ({ latitude: lat, longitude: lng }))
      : raw.boundary_points,
    zones,
  };
}

// ============================================================
// Farm API
// ============================================================

export const farmApi = {
  create: async (data: FarmCreateInput): Promise<Farm> => {
    const response = await apiClient.post<any>('/farms', data);
    return normalizeFarm(response.data);
  },

  get: async (farmId: string): Promise<Farm> => {
    if (!farmId || farmId === 'undefined' || farmId === 'null') {
      throw new Error('A valid farm ID must be provided to load farm data.');
    }
    const response = await apiClient.get<any>(`/farms/${farmId}`);
    return normalizeFarm(response.data);
  },

  list: async (): Promise<Farm[]> => {
    const response = await apiClient.get<any[]>('/farms');
    return Array.isArray(response.data) ? response.data.map(normalizeFarm) : [];
  },

  update: async (farmId: string, data: Partial<Farm>): Promise<Farm> => {
    if (!farmId || farmId === 'undefined' || farmId === 'null') {
      throw new Error('Cannot update farm without a valid farm ID.');
    }
    const response = await apiClient.put<any>(`/farms/${farmId}`, data);
    return normalizeFarm(response.data);
  },

  delete: async (farmId: string): Promise<void> => {
    if (!farmId || farmId === 'undefined' || farmId === 'null') return;
    try {
      await apiClient.delete(`/farms/${farmId}`);
    } catch {
      // Graceful fallback
    }
    deleteMockFarm(farmId);
  },
};

// ============================================================
// Zone API
// ============================================================

export const zoneApi = {
  create: async (farmId: string, data: ZoneInput): Promise<Zone> => {
    if (!farmId || farmId === 'undefined' || farmId === 'null') {
      throw new Error('Cannot create zone without a valid farm ID.');
    }
    const response = await apiClient.post<any>(`/farms/${farmId}/zones`, data);
    return normalizeZone(response.data);
  },

  update: async (farmId: string, zoneId: string, data: Partial<ZoneInput>): Promise<Zone> => {
    if (!farmId || farmId === 'undefined' || farmId === 'null' || !zoneId) {
      throw new Error('Valid farm ID and zone ID are required to update field.');
    }
    const response = await apiClient.put<any>(`/farms/${farmId}/zones/${zoneId}`, data);
    return normalizeZone(response.data);
  },

  delete: async (farmId: string, zoneId: string): Promise<void> => {
    if (!farmId || farmId === 'undefined' || farmId === 'null' || !zoneId) return;
    await apiClient.delete(`/farms/${farmId}/zones/${zoneId}`);
  },
};

// ============================================================
// Simulation API
// ============================================================

export const simulationApi = {
  run: async (data: SimulationRequest): Promise<SimulationResult> => {
    const response = await apiClient.post<SimulationResult>('/simulate', data);
    return response.data;
  },

  get: async (simId: string): Promise<SimulationResult> => {
    const response = await apiClient.get<SimulationResult>(`/simulation/${simId}`);
    return response.data;
  },

  list: async (farmId: string): Promise<SimulationResult[]> => {
    const response = await apiClient.get<SimulationResult[]>(`/farms/${farmId}/simulations`);
    return response.data;
  },
};

// ============================================================
// Scenario API
// ============================================================

export const scenarioApi = {
  create: async (data: Partial<Scenario>): Promise<Scenario> => {
    const response = await apiClient.post<Scenario>('/scenarios', data);
    return response.data;
  },

  list: async (farmId: string): Promise<Scenario[]> => {
    const response = await apiClient.get<Scenario[]>(`/farms/${farmId}/scenarios`);
    return response.data;
  },

  get: async (scenarioId: string): Promise<Scenario> => {
    const response = await apiClient.get<Scenario>(`/scenarios/${scenarioId}`);
    return response.data;
  },
};

// ============================================================
// Comparison API
// ============================================================

export const comparisonApi = {
  compare: async (data: ComparisonRequest): Promise<ComparisonResult> => {
    const response = await apiClient.post<ComparisonResult>('/compare', data);
    return response.data;
  },
};

// ============================================================
// AI & Scenario Intelligence API
// ============================================================

export interface BackendRiskAssessment {
  farm_id: string;
  overall_risk: 'LOW' | 'MEDIUM' | 'HIGH';
  zone_risks: Array<{
    zone_id: string;
    zone_name: string;
    water_stress: { level: 'LOW' | 'MEDIUM' | 'HIGH'; score: number; probability: Record<string, number> };
    heat_stress: { level: 'LOW' | 'MEDIUM' | 'HIGH'; score: number; probability: Record<string, number> };
    disease_risk: { level: 'LOW' | 'MEDIUM' | 'HIGH'; score: number; probability: Record<string, number> };
    nutrient_risk: { level: 'LOW' | 'MEDIUM' | 'HIGH'; score: number; probability: Record<string, number> };
    top_contributing_factors?: Array<{ field: string; message: string; contribution: number }>;
  }>;
  model_version: string;
  assessed_at?: string;
}

export interface BackendScenarioSuggestion {
  id: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  scenario_type: string;
  duration: number;
  target_zones: string[];
  changes: Record<string, number>;
}

export const aiApi = {
  analyzeRisk: async (farmId: string): Promise<BackendRiskAssessment> => {
    const response = await apiClient.post<BackendRiskAssessment>('/ai/analyze-risk', {
      farm_id: farmId,
    });
    return response.data;
  },

  suggestScenarios: async (farmId: string): Promise<{ suggestions: BackendScenarioSuggestion[]; source: string }> => {
    const response = await apiClient.post<{ suggestions: BackendScenarioSuggestion[]; source: string }>(
      '/ai/suggest-scenarios',
      { farm_id: farmId }
    );
    return response.data;
  },

  parseScenario: async (text: string, farmId?: string): Promise<Scenario> => {
    const response = await apiClient.post<Scenario>('/ai/parse-scenario', {
      text,
      farm_id: farmId,
    });
    return response.data;
  },

  explainResult: async (simulationId: string): Promise<any> => {
    const response = await apiClient.post('/ai/explain-result', {
      simulation_id: simulationId,
    });
    return response.data;
  },

  sensitivityAnalysis: async (payload: {
    scenario_type: string;
    crop?: string;
    baseline_yield?: number;
    current_soil_moisture?: number;
  }): Promise<any> => {
    const response = await apiClient.post('/ai/sensitivity-analysis', payload);
    return response.data;
  },

  prescribeIntervention: async (farmState: any, objective?: string): Promise<any> => {
    const response = await apiClient.post('/ai/prescribe-intervention', {
      farm_state: farmState,
      objective: objective || 'BALANCED_EFFICIENCY',
    });
    return response.data;
  },
};

export default apiClient;
