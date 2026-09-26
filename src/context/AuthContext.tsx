import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import type { User } from '../types';
import { userApi } from '../services/api';
import { firestoreService } from '../services/firestoreService';
import { auth, isFirebaseConfigured } from '../config/firebase';

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

/**
 * Global switch for demo farmer accounts.
 * Set to `false` whenever you want to disable demo accounts completely.
 */
export const ENABLE_DEMO_FARMERS = import.meta.env.VITE_ENABLE_MOCKS === 'true';

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
    return null;
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

  const login = useCallback(async (email: string, password?: string): Promise<boolean> => {
    const cleanEmail = email.trim().toLowerCase();
    
    // Check demo farmers first
    const demo = DEMO_FARMERS.find((f) => f.email.toLowerCase() === cleanEmail);
    if (ENABLE_DEMO_FARMERS && demo) {
      setUser(demo);
      return true;
    }

    // Accounts are persisted by the FastAPI service, which uses the Firebase
    // Admin SDK. The browser also signs in with a Firebase custom token so it
    // can read/write Firestore directly under per-user security rules.
    const authenticatedUser = await userApi.login(cleanEmail, password);

    const firebaseToken = localStorage.getItem('firebase_token');
    if (firebaseToken && isFirebaseConfigured && auth) {
      try {
        await signInWithCustomToken(auth, firebaseToken);
      } catch (err) {
        console.warn('Firebase Auth sign-in failed:', err);
      }
    }

    // Best-effort direct Firestore write. The backend already persists the user
    // via Admin SDK; this mirrors the document for browser-side reads.
    firestoreService.saveUser(authenticatedUser);

    setUser(authenticatedUser);
    return true;
  }, []);

  const signup = useCallback(async (input: { name: string; email: string; password?: string; location?: string; specialty?: string }): Promise<User> => {
    const cleanEmail = input.email.trim().toLowerCase();
    const newUser = await userApi.register({ ...input, email: cleanEmail });

    const firebaseToken = localStorage.getItem('firebase_token');
    if (firebaseToken && isFirebaseConfigured && auth) {
      try {
        await signInWithCustomToken(auth, firebaseToken);
      } catch (err) {
        console.warn('Firebase Auth sign-in failed:', err);
      }
    }

    // Best-effort direct Firestore write so the user document is available
    // for browser-side queries and Firestore security rules.
    firestoreService.saveUser(newUser);

    setUser(newUser);
    return newUser;
  }, []);

  const demoLogin = useCallback((farmerId: string) => {
    if (!ENABLE_DEMO_FARMERS) return;
    const demo = DEMO_FARMERS.find((f) => f.id === farmerId);
    if (demo) {
      setUser(demo);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('firebase_token');

    if (isFirebaseConfigured && auth) {
      signOut(auth).catch((err) => console.warn('Firebase Auth sign-out failed:', err));
    }
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
        availableDemoFarmers: ENABLE_DEMO_FARMERS ? DEMO_FARMERS : [],
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
