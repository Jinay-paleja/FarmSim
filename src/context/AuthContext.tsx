import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from '../types';
import { authService, LoginCredentials, RegisterData, DEMO_DEV_ACCOUNTS } from '../services/auth';

export interface FarmerProfile extends User {
  region: string;
  specialty: string;
  avatarEmoji: string;
  acresManaged: number;
}

export const DEMO_FARMERS = DEMO_DEV_ACCOUNTS;

interface AuthContextType {
  user: User | null;
  farmerProfile: FarmerProfile | null;
  authToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (credentialsOrEmail: string | LoginCredentials, password?: string) => Promise<boolean>;
  signup: (input: RegisterData) => Promise<User>;
  demoLogin: (farmerId: string) => Promise<boolean>;
  logout: () => void;
  availableDemoFarmers: typeof DEMO_DEV_ACCOUNTS;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [user, setUser] = useState<User | null>(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;
    try {
      const stored = localStorage.getItem('farmsim_current_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Restore session on application startup
  useEffect(() => {
    let isMounted = true;
    const initializeAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const currentUser = await authService.getCurrentUser();
          if (isMounted) {
            if (currentUser) {
              setUser(currentUser);
              setAuthToken(token);
            } else {
              // Token invalid or user not found
              setUser(null);
              setAuthToken(null);
              localStorage.removeItem('auth_token');
              localStorage.removeItem('farmsim_current_user');
            }
          }
        } catch {
          if (isMounted) {
            setUser(null);
            setAuthToken(null);
          }
        }
      } else {
        if (isMounted) {
          setUser(null);
          setAuthToken(null);
        }
      }
      if (isMounted) {
        setLoading(false);
      }
    };

    initializeAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const farmerProfile = useMemo<FarmerProfile | null>(() => {
    if (!user) return null;
    const demoMatch = DEMO_DEV_ACCOUNTS.find((f) => f.id === user.id);
    if (demoMatch) {
      return {
        ...user,
        region: user.location || demoMatch.location || 'Farming Territory',
        specialty: demoMatch.specialty || 'Crop & Soil Agriculture',
        avatarEmoji: demoMatch.avatarEmoji || '🧑‍🌾',
        acresManaged: 0,
      };
    }

    return {
      ...user,
      region: user.location || 'Farming Territory',
      specialty: 'Precision Crop Management',
      avatarEmoji: '🧑‍🌾',
      acresManaged: 0,
    };
  }, [user]);

  const login = useCallback(
    async (credentialsOrEmail: string | LoginCredentials, password?: string): Promise<boolean> => {
      let credentials: LoginCredentials;
      if (typeof credentialsOrEmail === 'string') {
        credentials = { email: credentialsOrEmail, password };
      } else {
        credentials = credentialsOrEmail;
      }

      try {
        const response = await authService.login(credentials);
        setUser(response.user);
        setAuthToken(response.token);
        return true;
      } catch (err) {
        console.error('Login failed:', err);
        return false;
      }
    },
    []
  );

  const signup = useCallback(async (data: RegisterData): Promise<User> => {
    const response = await authService.register(data);
    setUser(response.user);
    setAuthToken(response.token);
    return response.user;
  }, []);

  const demoLogin = useCallback(async (farmerId: string): Promise<boolean> => {
    try {
      const response = await authService.demoLogin(farmerId);
      setUser(response.user);
      setAuthToken(response.token);
      return true;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setAuthToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        farmerProfile,
        authToken,
        isAuthenticated: !!user && !!authToken,
        loading,
        login,
        signup,
        demoLogin,
        logout,
        availableDemoFarmers: DEMO_DEV_ACCOUNTS,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
