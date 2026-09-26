import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Farm, Zone } from '../types';
import { farmApi } from '../services/api';
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
  deleteFarm: (farmId: string) => Promise<void>;
}

const FarmContext = createContext<FarmContextType | undefined>(undefined);

export function FarmProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [allFarms, setAllFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [selectedZoneIndex, setSelectedZoneIndex] = useState<number | null>(null);
  const [loadingFarms, setLoadingFarms] = useState<boolean>(true);

  const loadFarms = useCallback(async () => {
    setLoadingFarms(true);
    try {
      let list: Farm[] = [];
      try {
        list = await farmApi.list();
      } catch {
        // Fallback to mock storage
        if (isMockEnabled()) {
          list = ensureDefaultFarms();
        }
      }

      if (list.length === 0 && isMockEnabled()) {
        list = ensureDefaultFarms();
      }

      setAllFarms(list);
    } catch {
      if (isMockEnabled()) {
        const seeded = ensureDefaultFarms();
        setAllFarms(seeded);
      }
    } finally {
      setLoadingFarms(false);
    }
  }, []);

  useEffect(() => {
    loadFarms();
  }, [loadFarms]);

  // Filter farms strictly by current logged in user (multi-tenant security)
  const userFarms = useMemo(() => {
    if (!user) return [];
    return allFarms.filter((f) => f.ownerId === user.id);
  }, [allFarms, user]);

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

  const deleteFarm = useCallback(async (farmId: string) => {
    try {
      await farmApi.delete(farmId);
    } catch {
      // Fallback
    }

    setAllFarms((prev) => prev.filter((f) => f.id !== farmId));

    if (isMockEnabled()) {
      try {
        const stored = JSON.parse(localStorage.getItem('farms') || '[]') as Farm[];
        const filtered = stored.filter((f) => f.id !== farmId);
        localStorage.setItem('farms', JSON.stringify(filtered));
        localStorage.setItem('farms_initialized', 'true');
      } catch {
        // ignore
      }
    }

    if (selectedFarmId === farmId) {
      setSelectedFarmId(null);
      setSelectedZoneIndex(null);
    }
  }, [selectedFarmId]);

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
        deleteFarm,
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
