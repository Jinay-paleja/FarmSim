import { useState, useEffect, useCallback, useRef } from 'react';
import {
  WeatherData,
  WeatherAgronomicImpact,
  fetchFarmWeather,
  evaluateWeatherImpact,
} from '../services/weather';
import type { Zone, ZoneInput } from '../types';

interface UseFarmWeatherOptions {
  latitude?: number;
  longitude?: number;
  zones?: (Zone | ZoneInput)[];
  autoRefreshMinutes?: number;
}

export function useFarmWeather({
  latitude,
  longitude,
  zones,
  autoRefreshMinutes = 10,
}: UseFarmWeatherOptions) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState<string>('Updating...');

  const fetchedAtRef = useRef<number>(Date.now());
  const intervalTimerRef = useRef<any>(null);
  const labelTimerRef = useRef<any>(null);

  // Computes human-friendly relative time label
  const updateRelativeLabel = useCallback(() => {
    if (!fetchedAtRef.current) {
      setLastUpdatedLabel('Updating...');
      return;
    }
    const diffSec = Math.floor((Date.now() - fetchedAtRef.current) / 1000);
    if (diffSec < 30) {
      setLastUpdatedLabel('Updated just now');
    } else if (diffSec < 90) {
      setLastUpdatedLabel('Updated 1 min ago');
    } else {
      const mins = Math.floor(diffSec / 60);
      setLastUpdatedLabel(`Updated ${mins} min ago`);
    }
  }, []);

  const loadWeather = useCallback(
    async (force = false) => {
      // Default coordinates if undefined
      const lat = latitude ?? 30.9010;
      const lon = longitude ?? 75.8573;

      if (force) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const data = await fetchFarmWeather(lat, lon, force);
        setWeather(data);
        fetchedAtRef.current = Date.now();
        updateRelativeLabel();
      } catch (err: any) {
        setError(err?.message || 'Live weather temporarily unavailable');
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [latitude, longitude, updateRelativeLabel]
  );

  // Load when coordinates change
  useEffect(() => {
    loadWeather(false);

    // Auto-refresh interval
    if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
    intervalTimerRef.current = setInterval(() => {
      loadWeather(true);
    }, autoRefreshMinutes * 60 * 1000);

    // Relative timestamp ticker
    if (labelTimerRef.current) clearInterval(labelTimerRef.current);
    labelTimerRef.current = setInterval(updateRelativeLabel, 30000);

    return () => {
      if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
      if (labelTimerRef.current) clearInterval(labelTimerRef.current);
    };
  }, [loadWeather, autoRefreshMinutes, updateRelativeLabel]);

  // Agronomic impact evaluation
  const agronomicImpact: WeatherAgronomicImpact | null = weather
    ? evaluateWeatherImpact(weather, zones)
    : null;

  return {
    weather,
    loading,
    isRefreshing,
    error,
    lastUpdatedLabel,
    refresh: () => loadWeather(true),
    agronomicImpact,
  };
}
