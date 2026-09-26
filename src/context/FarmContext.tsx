import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Farm, Zone } from '../types';
import { farmApi } from '../services/api';
import { firestoreService } from '../services/firestoreService';
import { isMockEnabled, ensureDefaultFarms } from '../services/mockData';
import { useAuth } from './AuthContext';

interface FarmContextType {
  allFarms: Farm[];
  farms: Farm[];
  selectedFarmId: string | null;
  selectedFarm: Farm | null;
  selectedZoneIndex: number | null;
  selectedZone: Zone | null;
  loadingFarms: boolean;
  selectFarm: (farmId: string) => void;
  selectZoneIndex: (index: number | null) => void;
  refreshFarms: () => Promise<void>;
  updateFarmInState: (updated: Farm) => void;
}

const FarmContext = createContext<FarmContextType | undefined>(undefined);

export function FarmProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [allFarms, setAllFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [selectedZoneIndex, setSelectedZoneIndex] = useState<number | null>(null);
  const [loadingFarms, setLoadingFarms] = useState<boolean>(true);

  const loadFarms = useCallback(async () => {
    // Never request or retain a shared portfolio for a signed-out visitor.
    if (!userId) {
      setAllFarms([]);
      setLoadingFarms(false);
      return;
    }

    setLoadingFarms(true);
    try {
      let list: Farm[] = [];
      let gotData = false;

      // 1. Try Firestore first (direct browser access after Firebase Auth sign-in).
      //    always scoped to the current ownerId — no unfiltered reads.
      try {
        list = await firestoreService.getFarms(userId);
        gotData = true;
      } catch {
        // Firestore read failed, fall through to backend API.
      }

      // 2. Fall back to the backend API (which uses the Admin SDK or SQLite).
      if (!gotData || list.length === 0) {
        try {
          list = await farmApi.list(userId);
          gotData = true;
        } catch {
          // Backend API failed, fall through to mocks.
        }
      }

      // 3. Fall back to mock data (demo mode) — still filtered by owner.
      if (!gotData || list.length === 0) {
        if (isMockEnabled()) {
          list = ensureDefaultFarms().filter((farm) => farm.ownerId === userId);
        } else {
          list = [];
        }
      }

      setAllFarms(list);
    } catch {
      if (isMockEnabled()) {
        const seeded = ensureDefaultFarms().filter((farm) => farm.ownerId === userId);
        setAllFarms(seeded);
      } else {
        setAllFarms([]);
      }
    } finally {
      setLoadingFarms(false);
    }
  }, [userId]);

  useEffect(() => {
    loadFarms();
  }, [loadFarms]);

  // Filter farms by current logged in user
  const userFarms = useMemo(() => {
    if (!userId) return [];
    // Farms with no owner are not shown as a fallback; that fallback was the
    // reason a farmer could see another farmer's portfolio.
    return allFarms.filter((farm) => farm.ownerId === userId);
  }, [allFarms, userId]);

  // Automatically sync selected farm to user's farms
  useEffect(() => {
    if (userFarms.length > 0) {
      if (!selectedFarmId || !userFarms.some((f) => f.id === selectedFarmId)) {
        setSelectedFarmId(userFarms[0].id);
        setSelectedZoneIndex(null);
      }
    } else {
      setSelectedFarmId(null);
      setSelectedZoneIndex(null);
    }
  }, [userFarms, selectedFarmId]);

  const selectFarm = useCallback((farmId: string) => {
    setSelectedFarmId(farmId);
    setSelectedZoneIndex(null); // Reset field selection when switching farms
  }, []);

  const selectZoneIndex = useCallback((index: number | null) => {
    setSelectedZoneIndex(index);
  }, []);

  const selectedFarm = useMemo(() => {
    if (!selectedFarmId) return userFarms[0] || null;
    return userFarms.find((f) => f.id === selectedFarmId) || userFarms[0] || null;
  }, [userFarms, selectedFarmId]);

  const selectedZone = useMemo(() => {
    if (selectedZoneIndex === null || !selectedFarm || !selectedFarm.zones) return null;
    return selectedFarm.zones[selectedZoneIndex] || null;
  }, [selectedFarm, selectedZoneIndex]);

  const updateFarmInState = useCallback((updated: Farm) => {
    const farmWithOwner: Farm = {
      ...updated,
      ownerId: updated.ownerId || user?.id || 'farmer_punjab',
    };

    setAllFarms((prev) => {
      const idx = prev.findIndex((f) => f.id === farmWithOwner.id);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = farmWithOwner;
        return copy;
      }
      return [...prev, farmWithOwner];
    });

    // Persist to Firestore so the browser and backend share the same store.
    firestoreService.saveFarm(farmWithOwner);

    if (isMockEnabled()) {
      try {
        const stored = JSON.parse(localStorage.getItem('farms') || '[]') as Farm[];
        const idx = stored.findIndex((f) => f.id === farmWithOwner.id);
        if (idx !== -1) {
          stored[idx] = farmWithOwner;
        } else {
          stored.push(farmWithOwner);
        }
        localStorage.setItem('farms', JSON.stringify(stored));
      } catch {
        // ignore
      }
    }
  }, [user]);

  return (
    <FarmContext.Provider
      value={{
        allFarms,
        farms: userFarms,
        selectedFarmId,
        selectedFarm,
        selectedZoneIndex,
        selectedZone,
        loadingFarms,
        selectFarm,
        selectZoneIndex,
        refreshFarms: loadFarms,
        updateFarmInState,
      }}
    >
      {children}
    </FarmContext.Provider>
  );
}

export function useFarmContext(): FarmContextType {
  const context = useContext(FarmContext);
  if (!context) {
    throw new Error('useFarmContext must be used within a FarmProvider');
  }
  return context;
}
