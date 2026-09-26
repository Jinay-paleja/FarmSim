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
// Farm API
// ============================================================

export const farmApi = {
  create: async (data: FarmCreateInput): Promise<Farm> => {
    const response = await apiClient.post<Farm>('/farms', data);
    return response.data;
  },

  get: async (farmId: string): Promise<Farm> => {
    const response = await apiClient.get<Farm>(`/farms/${farmId}`);
    return response.data;
  },

  list: async (): Promise<Farm[]> => {
    const response = await apiClient.get<Farm[]>('/farms');
    return response.data;
  },

  update: async (farmId: string, data: Partial<Farm>): Promise<Farm> => {
    const response = await apiClient.put<Farm>(`/farms/${farmId}`, data);
    return response.data;
  },

  delete: async (farmId: string): Promise<void> => {
    try {
      await apiClient.delete(`/farms/${farmId}`);
    } catch {
      // Fallback in mock mode
    }
    deleteMockFarm(farmId);
  },
};

// ============================================================
// Zone API
// ============================================================

export const zoneApi = {
  create: async (farmId: string, data: ZoneInput): Promise<Zone> => {
    const response = await apiClient.post<Zone>(`/farms/${farmId}/zones`, data);
    return response.data;
  },

  update: async (farmId: string, zoneId: string, data: Partial<ZoneInput>): Promise<Zone> => {
    const response = await apiClient.put<Zone>(`/farms/${farmId}/zones/${zoneId}`, data);
    return response.data;
  },

  delete: async (farmId: string, zoneId: string): Promise<void> => {
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

export default apiClient;
