import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '../types';

export interface FarmerProfile extends User {
  region: string;
  specialty: string;
  avatarEmoji: string;
  acresManaged: number;
}

export const DEMO_FARMERS: FarmerProfile[] = [
  {
    id: 'farmer_punjab',
    name: 'Harpreet Singh',
    email: 'harpreet.singh@farm.ai',
    location: 'Ludhiana, Punjab, India',
    region: 'Punjab, India',
    specialty: 'Wheat, Basmati Rice, Mustard & Cotton',
    avatarEmoji: '🌾',
    acresManaged: 12.4,
    phone: '+91 98765 43210',
    joinedAt: '2023-04-12',
  },
  {
    id: 'farmer_california',
    name: 'Carlos Rodriguez',
    email: 'carlos.rodriguez@valleylogic.org',
    location: 'Fresno, California, USA',
    region: 'California, USA',
    specialty: 'High-Efficiency Precision Drip & Vineyard',
    avatarEmoji: '🍇',
    acresManaged: 8.7,
    phone: '+1 (559) 555-0192',
    joinedAt: '2023-08-19',
  },
  {
    id: 'farmer_iowa',
    name: 'John Miller',
    email: 'john.miller@midwestgrains.com',
    location: 'Ames, Story County, Iowa, USA',
    region: 'Iowa, USA',
    specialty: 'Regenerative Corn & Soybean Rotation',
    avatarEmoji: '🌽',
    acresManaged: 21.2,
    phone: '+1 (515) 555-0144',
    joinedAt: '2023-11-05',
  },
];

interface AuthContextType {
  user: User | null;
  farmerProfile: FarmerProfile | null;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  signup: (input: { name: string; email: string; password?: string; location?: string; specialty?: string }) => Promise<User>;
  demoLogin: (farmerId: string) => void;
  logout: () => void;
  availableDemoFarmers: FarmerProfile[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'farmsim_current_user';
const USERS_STORAGE_KEY = 'farmsim_registered_users';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // fallback
    }
    // Default to first demo farmer for immediate rich experience
    return DEMO_FARMERS[0];
  });

  // Save to localStorage when user changes
  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, [user]);

  const farmerProfile = React.useMemo<FarmerProfile | null>(() => {
    if (!user) return null;
    const match = DEMO_FARMERS.find((f) => f.id === user.id);
    if (match) return match;

    return {
      ...user,
      region: user.location || 'Custom Region',
      specialty: 'General Crop & Soil Agriculture',
      avatarEmoji: '🧑‍🌾',
      acresManaged: 0,
    };
  }, [user]);

  const login = useCallback(async (email: string, _password?: string): Promise<boolean> => {
    const cleanEmail = email.trim().toLowerCase();
    
    // Check demo farmers
    const demo = DEMO_FARMERS.find((f) => f.email.toLowerCase() === cleanEmail);
    if (demo) {
      setUser(demo);
      return true;
    }

    // Check custom registered users
    try {
      const registered: User[] = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '[]');
      const found = registered.find((u) => u.email.toLowerCase() === cleanEmail);
      if (found) {
        setUser(found);
        return true;
      }
    } catch {
      // fallback
    }

    // If not found, create a farmer account automatically with this email
    const nameFromEmail = cleanEmail.split('@')[0].replace(/[._]/g, ' ');
    const capitalizedName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
    const newUser: User = {
      id: `farmer_${Date.now()}`,
      name: capitalizedName || 'Independent Farmer',
      email: cleanEmail,
      location: 'Custom Farm Territory',
      joinedAt: new Date().toISOString().split('T')[0],
    };

    try {
      const registered: User[] = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '[]');
      registered.push(newUser);
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(registered));
    } catch {
      // ignore
    }

    setUser(newUser);
    return true;
  }, []);

  const signup = useCallback(async (input: { name: string; email: string; password?: string; location?: string; specialty?: string }): Promise<User> => {
    const cleanEmail = input.email.trim().toLowerCase();
    const newUser: User = {
      id: `farmer_${Date.now()}`,
      name: input.name.trim(),
      email: cleanEmail,
      location: input.location?.trim() || 'Local Farm Region',
      joinedAt: new Date().toISOString().split('T')[0],
    };

    try {
      const registered: User[] = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '[]');
      // Update if already exists or add new
      const filtered = registered.filter((u) => u.email.toLowerCase() !== cleanEmail);
      filtered.push(newUser);
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      // ignore
    }

    setUser(newUser);
    return newUser;
  }, []);

  const demoLogin = useCallback((farmerId: string) => {
    const demo = DEMO_FARMERS.find((f) => f.id === farmerId);
    if (demo) {
      setUser(demo);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        farmerProfile,
        isAuthenticated: !!user,
        login,
        signup,
        demoLogin,
        logout,
        availableDemoFarmers: DEMO_FARMERS,
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
