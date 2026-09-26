import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Farm, Zone } from '../types';
import { farmApi } from '../services/api';
import { isMockEnabled, ensureDefaultFarms } from '../services/mockData';

interface FarmContextType {
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
  const [farms, setFarms] = useState<Farm[]>([]);
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

      setFarms(list);

      // If no farm selected yet, default to first farm
      if (list.length > 0) {
        setSelectedFarmId((prev) => (prev && list.some((f) => f.id === prev) ? prev : list[0].id));
      }
    } catch {
      if (isMockEnabled()) {
        const seeded = ensureDefaultFarms();
        setFarms(seeded);
        if (seeded.length > 0) {
          setSelectedFarmId(seeded[0].id);
        }
      }
    } finally {
      setLoadingFarms(false);
    }
  }, []);

  useEffect(() => {
    loadFarms();
  }, [loadFarms]);

  const selectFarm = useCallback((farmId: string) => {
    setSelectedFarmId(farmId);
    setSelectedZoneIndex(null); // Reset field selection when switching farms
  }, []);

  const selectZoneIndex = useCallback((index: number | null) => {
    setSelectedZoneIndex(index);
  }, []);

  const selectedFarm = useMemo(() => {
    if (!selectedFarmId) return farms[0] || null;
    return farms.find((f) => f.id === selectedFarmId) || farms[0] || null;
  }, [farms, selectedFarmId]);

  const selectedZone = useMemo(() => {
    if (selectedZoneIndex === null || !selectedFarm || !selectedFarm.zones) return null;
    return selectedFarm.zones[selectedZoneIndex] || null;
  }, [selectedFarm, selectedZoneIndex]);

  const updateFarmInState = useCallback((updated: Farm) => {
    setFarms((prev) => {
      const idx = prev.findIndex((f) => f.id === updated.id);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return [...prev, updated];
    });

    if (isMockEnabled()) {
      try {
        const stored = JSON.parse(localStorage.getItem('farms') || '[]') as Farm[];
        const idx = stored.findIndex((f) => f.id === updated.id);
        if (idx !== -1) {
          stored[idx] = updated;
        } else {
          stored.push(updated);
        }
        localStorage.setItem('farms', JSON.stringify(stored));
      } catch {
        // ignore
      }
    }
  }, []);

  return (
    <FarmContext.Provider
      value={{
        farms,
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
