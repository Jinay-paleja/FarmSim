import { apiClient } from './api';
import type { User } from '../types';

export interface LoginCredentials {
  email: string;
  password?: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  name: string;
  email: string;
  password?: string;
  location?: string;
  specialty?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Demo farmer accounts from BACKEND_HANDOVER.md (isolated for mock/dev testing)
export const DEMO_DEV_ACCOUNTS: (User & { role?: string; specialty?: string; avatarEmoji?: string })[] = [
  {
    id: 'farmer_punjab',
    name: 'Harpreet Singh',
    email: 'harpreet.singh@farm.ai',
    location: 'Ludhiana, Punjab, India',
    specialty: 'Wheat, Basmati Rice, Mustard & Cotton',
    avatarEmoji: '🌾',
    joinedAt: '2023-04-12',
  },
  {
    id: 'farmer_california',
    name: 'Carlos Rodriguez',
    email: 'carlos.rodriguez@valleylogic.org',
    location: 'Fresno, California, USA',
    specialty: 'High-Efficiency Precision Drip & Vineyard',
    avatarEmoji: '🍇',
    joinedAt: '2023-08-19',
  },
  {
    id: 'farmer_iowa',
    name: 'John Miller',
    email: 'john.miller@midwestgrains.com',
    location: 'Ames, Story County, Iowa, USA',
    specialty: 'Regenerative Corn & Soybean Rotation',
    avatarEmoji: '🌽',
    joinedAt: '2023-11-05',
  },
];

const AUTH_TOKEN_KEY = 'auth_token';
const USER_KEY = 'farmsim_current_user';
const REGISTERED_USERS_KEY = 'farmsim_registered_users';
const REMEMBER_EMAIL_KEY = 'farmsim_remember_email';

export const authService = {
  /**
   * Logs in a user. Attempts backend API first, falls back to isolated mock auth mode.
   */
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const cleanEmail = credentials.email.trim().toLowerCase();

    try {
      // 1. Attempt backend authentication
      const response = await apiClient.post<AuthResponse>('/auth/login', {
        email: cleanEmail,
        password: credentials.password,
      });

      if (response.data && response.data.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, response.data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
        if (credentials.rememberMe) {
          localStorage.setItem(REMEMBER_EMAIL_KEY, cleanEmail);
        } else {
          localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
        return response.data;
      }
    } catch {
      // Backend not running or endpoint not yet configured — use isolated mock auth mode
    }

    // Isolated Mock Auth Fallback
    // Check registered custom users
    let matchedUser: User | undefined;
    try {
      const registered: User[] = JSON.parse(localStorage.getItem(REGISTERED_USERS_KEY) || '[]');
      matchedUser = registered.find((u) => u.email.toLowerCase() === cleanEmail);
    } catch {
      // ignore
    }

    // Check demo accounts
    if (!matchedUser) {
      matchedUser = DEMO_DEV_ACCOUNTS.find((d) => d.email.toLowerCase() === cleanEmail);
    }

    // If not found in mock database, auto-provision user account for this email
    if (!matchedUser) {
      const namePart = cleanEmail.split('@')[0].replace(/[._-]/g, ' ');
      const formattedName = namePart
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      matchedUser = {
        id: `farmer_${Date.now()}`,
        name: formattedName || 'Farmer',
        email: cleanEmail,
        location: 'Agricultural Region',
        joinedAt: new Date().toISOString().split('T')[0],
      };

      try {
        const registered: User[] = JSON.parse(localStorage.getItem(REGISTERED_USERS_KEY) || '[]');
        registered.push(matchedUser);
        localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(registered));
      } catch {
        // ignore
      }
    }

    const mockToken = `farmsim_token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(AUTH_TOKEN_KEY, mockToken);
    localStorage.setItem(USER_KEY, JSON.stringify(matchedUser));

    if (credentials.rememberMe) {
      localStorage.setItem(REMEMBER_EMAIL_KEY, cleanEmail);
    } else {
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }

    return {
      token: mockToken,
      user: matchedUser,
    };
  },

  /**
   * Registers a new farmer.
   */
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const cleanEmail = data.email.trim().toLowerCase();

    try {
      const response = await apiClient.post<AuthResponse>('/auth/register', data);
      if (response.data && response.data.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, response.data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
        return response.data;
      }
    } catch {
      // Backend not running — fallback to mock registration
    }

    const newUser: User = {
      id: `farmer_${Date.now()}`,
      name: data.name.trim(),
      email: cleanEmail,
      location: data.location?.trim() || 'Agricultural Region',
      joinedAt: new Date().toISOString().split('T')[0],
    };

    try {
      const registered: User[] = JSON.parse(localStorage.getItem(REGISTERED_USERS_KEY) || '[]');
      const filtered = registered.filter((u) => u.email.toLowerCase() !== cleanEmail);
      filtered.push(newUser);
      localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(filtered));
    } catch {
      // ignore
    }

    const mockToken = `farmsim_token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(AUTH_TOKEN_KEY, mockToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));

    return {
      token: mockToken,
      user: newUser,
    };
  },

  /**
   * Logs out the user and clears stored credentials.
   */
  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // ignore
    } finally {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  },

  /**
   * Restores currently authenticated user from backend or local storage.
   */
  getCurrentUser: async (): Promise<User | null> => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return null;

    try {
      const response = await apiClient.get<User>('/auth/me');
      if (response.data) {
        localStorage.setItem(USER_KEY, JSON.stringify(response.data));
        return response.data;
      }
    } catch {
      // Backend unavailable, restore from localStorage
    }

    try {
      const stored = localStorage.getItem(USER_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }

    return null;
  },

  /**
   * Isolated development helper for 1-click test login.
   */
  demoLogin: async (farmerId: string): Promise<AuthResponse> => {
    const account = DEMO_DEV_ACCOUNTS.find((d) => d.id === farmerId) || DEMO_DEV_ACCOUNTS[0];
    const token = `farmsim_dev_token_${account.id}`;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(account));
    return { token, user: account };
  },

  /**
   * Returns remembered email if saved.
   */
  getRememberedEmail: (): string => {
    return localStorage.getItem(REMEMBER_EMAIL_KEY) || '';
  },
};
