import axios from 'axios';
import type { Zone, ZoneInput } from '../types';

export interface HourlyForecastPoint {
  time: string;
  hourLabel: string;
  temperature: number;
  apparentTemperature: number;
  precipitationProbability: number;
  precipitation: number;
  rain: number;
  weatherCode: number;
  weatherEmoji: string;
  weatherDescription: string;
  humidity: number;
}

export interface DailyForecastPoint {
  date: string;
  dayLabel: string;
  tempMax: number;
  tempMin: number;
  precipitationSum: number;
  precipitationProbabilityMax: number;
  weatherCode: number;
  weatherEmoji: string;
  weatherDescription: string;
  et0?: number; // FAO-56 Reference Evapotranspiration in mm
}

export interface WeatherData {
  latitude: number;
  longitude: number;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitation: number;
  rain: number;
  weatherCode: number;
  weatherDescription: string;
  weatherEmoji: string;
  cloudCover: number;
  windSpeed: number; // km/h
  windDirection: number; // degrees
  windGusts: number; // km/h
  pressure: number; // hPa
  timestamp: string; // ISO string
  isFallback: boolean;
  hourly: HourlyForecastPoint[];
  daily: DailyForecastPoint[];
}

export interface WeatherAlert {
  type: 'heatwave' | 'drought' | 'flood' | 'disease' | 'frost' | 'wind';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  recommendation: string;
}

export interface WeatherAgronomicImpact {
  overallStatus: 'optimal' | 'moderate_stress' | 'high_risk';
  alerts: WeatherAlert[];
  recommendations: string[];
  heatStress: boolean;
  droughtStress: boolean;
  floodRisk: boolean;
  diseaseElevated: boolean;
  frostRisk: boolean;
}

// In-memory cache to prevent excessive requests: key is `lat,lng`, value is { data, fetchedAt }
const weatherCache = new Map<string, { data: WeatherData; fetchedAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

/**
 * WMO Weather Code interpreter with agricultural descriptions and emojis.
 */
export function getWmoWeatherInfo(code: number): { description: string; emoji: string } {
  switch (code) {
    case 0:
      return { description: 'Clear sky', emoji: '☀️' };
    case 1:
      return { description: 'Mainly clear', emoji: '🌤️' };
    case 2:
      return { description: 'Partly cloudy', emoji: '⛅' };
    case 3:
      return { description: 'Overcast', emoji: '☁️' };
    case 45:
    case 48:
      return { description: 'Foggy / Deposition fog', emoji: '🌫️' };
    case 51:
      return { description: 'Light drizzle', emoji: '🌦️' };
    case 53:
      return { description: 'Moderate drizzle', emoji: '🌦️' };
    case 55:
      return { description: 'Dense drizzle', emoji: '🌧️' };
    case 56:
    case 57:
      return { description: 'Freezing drizzle', emoji: '🌧️' };
    case 61:
      return { description: 'Slight rain', emoji: '🌦️' };
    case 63:
      return { description: 'Moderate rain', emoji: '🌧️' };
    case 65:
      return { description: 'Heavy rain', emoji: '🌧️' };
    case 66:
    case 67:
      return { description: 'Freezing rain', emoji: '🧊' };
    case 71:
      return { description: 'Slight snow fall', emoji: '🌨️' };
    case 73:
      return { description: 'Moderate snow fall', emoji: '🌨️' };
    case 75:
      return { description: 'Heavy snow fall', emoji: '❄️' };
    case 77:
      return { description: 'Snow grains', emoji: '❄️' };
    case 80:
      return { description: 'Slight rain showers', emoji: '🌦️' };
    case 81:
      return { description: 'Moderate rain showers', emoji: '🌧️' };
    case 82:
      return { description: 'Violent rain showers', emoji: '⛈️' };
    case 85:
    case 86:
      return { description: 'Snow showers', emoji: '🌨️' };
    case 95:
      return { description: 'Thunderstorm', emoji: '⛈️' };
    case 96:
    case 99:
      return { description: 'Thunderstorm with heavy hail', emoji: '⛈️' };
    default:
      return { description: 'Fair weather', emoji: '🌤️' };
  }
}

function formatHourLabel(isoString: string): string {
  try {
    const d = new Date(isoString);
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    return `${h} ${ampm}`;
  } catch {
    return isoString.slice(11, 16);
  }
}

function formatDayLabel(dateStr: string, index: number): string {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  } catch {
    return dateStr;
  }
}

/**
 * Generates realistic fallback weather data when network/API is unavailable.
 */
export function generateFallbackWeatherData(lat: number, lon: number): WeatherData {
  const now = new Date();
  const hourly: HourlyForecastPoint[] = [];
  const baseTemp = 28.5;

  for (let i = 0; i < 48; i++) {
    const time = new Date(now.getTime() + i * 3600 * 1000);
    const hour = time.getHours();
    // Diurnal temperature oscillation
    const tempOffset = Math.sin(((hour - 8) / 24) * 2 * Math.PI) * 6;
    const temp = Math.round((baseTemp + tempOffset) * 10) / 10;
    const prob = Math.round(Math.max(5, Math.min(80, 20 + Math.sin(i / 6) * 30)));
    const wCode = prob > 50 ? 61 : prob > 25 ? 2 : 0;
    const info = getWmoWeatherInfo(wCode);

    hourly.push({
      time: time.toISOString(),
      hourLabel: formatHourLabel(time.toISOString()),
      temperature: temp,
      apparentTemperature: Math.round((temp + 2) * 10) / 10,
      precipitationProbability: prob,
      precipitation: prob > 50 ? 1.2 : 0,
      rain: prob > 50 ? 1.2 : 0,
      weatherCode: wCode,
      weatherEmoji: info.emoji,
      weatherDescription: info.description,
      humidity: Math.round(65 - tempOffset * 2),
    });
  }

  const daily: DailyForecastPoint[] = [];
  for (let d = 0; d < 7; d++) {
    const date = new Date(now.getTime() + d * 86400 * 1000);
    const wCode = d % 3 === 0 ? 2 : 0;
    const info = getWmoWeatherInfo(wCode);
    daily.push({
      date: date.toISOString().split('T')[0],
      dayLabel: formatDayLabel(date.toISOString(), d),
      tempMax: 32 + (d % 2),
      tempMin: 22 - (d % 2),
      precipitationSum: d === 2 ? 4.5 : 0,
      precipitationProbabilityMax: d === 2 ? 60 : 15,
      weatherCode: wCode,
      weatherEmoji: info.emoji,
      weatherDescription: info.description,
      et0: 4.8,
    });
  }

  return {
    latitude: lat,
    longitude: lon,
    temperature: 29.0,
    apparentTemperature: 31.5,
    humidity: 72,
    precipitation: 0.0,
    rain: 0.0,
    weatherCode: 2,
    weatherDescription: 'Partly cloudy',
    weatherEmoji: '⛅',
    cloudCover: 35,
    windSpeed: 14.2,
    windDirection: 280,
    windGusts: 18.5,
    pressure: 1012.0,
    timestamp: now.toISOString(),
    isFallback: true,
    hourly,
    daily,
  };
}

/**
 * Fetches real live weather data from Open-Meteo for the farm's latitude & longitude.
 * Includes client-side caching to avoid excessive polling.
 */
export async function fetchFarmWeather(
  latitude: number,
  longitude: number,
  forceRefresh = false
): Promise<WeatherData> {
  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const nowMs = Date.now();

  // Check cache
  if (!forceRefresh) {
    const cached = weatherCache.get(cacheKey);
    if (cached && nowMs - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.data;
    }
    // Also check sessionStorage
    try {
      const stored = sessionStorage.getItem(`weather_${cacheKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (nowMs - parsed.fetchedAt < CACHE_TTL_MS) {
          weatherCache.set(cacheKey, parsed);
          return parsed.data;
        }
      }
    } catch { /* ignore storage errors */ }
  }

  try {
    const url = 'https://api.open-meteo.com/v1/forecast';
    const params = {
      latitude,
      longitude,
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'precipitation',
        'rain',
        'weather_code',
        'cloud_cover',
        'surface_pressure',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
      ].join(','),
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'precipitation_probability',
        'precipitation',
        'rain',
        'weather_code',
      ].join(','),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'precipitation_probability_max',
        'et0_fao_evapotranspiration',
      ].join(','),
      timezone: 'auto',
      forecast_days: 7,
    };

    const response = await axios.get(url, { params, timeout: 12000 });
    const data = response.data;

    const current = data.current;
    const wmo = getWmoWeatherInfo(current.weather_code ?? 0);

    // Parse hourly forecast (next 48 hours)
    const hourly: HourlyForecastPoint[] = [];
    if (data.hourly && Array.isArray(data.hourly.time)) {
      const currentTimeStr = current.time || new Date().toISOString();
      const currentHourIndex = Math.max(
        0,
        data.hourly.time.findIndex((t: string) => t >= currentTimeStr)
      );
      const endIndex = Math.min(data.hourly.time.length, currentHourIndex + 48);

      for (let i = currentHourIndex; i < endIndex; i++) {
        const timeIso = data.hourly.time[i];
        const code = data.hourly.weather_code[i] ?? 0;
        const info = getWmoWeatherInfo(code);
        hourly.push({
          time: timeIso,
          hourLabel: formatHourLabel(timeIso),
          temperature: Math.round(data.hourly.temperature_2m[i] * 10) / 10,
          apparentTemperature: Math.round((data.hourly.apparent_temperature?.[i] ?? data.hourly.temperature_2m[i]) * 10) / 10,
          precipitationProbability: data.hourly.precipitation_probability[i] ?? 0,
          precipitation: data.hourly.precipitation[i] ?? 0,
          rain: data.hourly.rain[i] ?? 0,
          weatherCode: code,
          weatherEmoji: info.emoji,
          weatherDescription: info.description,
          humidity: data.hourly.relative_humidity_2m[i] ?? 60,
        });
      }
    }

    // Parse daily forecast (7 days)
    const daily: DailyForecastPoint[] = [];
    if (data.daily && Array.isArray(data.daily.time)) {
      for (let i = 0; i < data.daily.time.length; i++) {
        const code = data.daily.weather_code[i] ?? 0;
        const info = getWmoWeatherInfo(code);
        daily.push({
          date: data.daily.time[i],
          dayLabel: formatDayLabel(data.daily.time[i], i),
          tempMax: Math.round(data.daily.temperature_2m_max[i]),
          tempMin: Math.round(data.daily.temperature_2m_min[i]),
          precipitationSum: Math.round((data.daily.precipitation_sum[i] ?? 0) * 10) / 10,
          precipitationProbabilityMax: data.daily.precipitation_probability_max[i] ?? 0,
          weatherCode: code,
          weatherEmoji: info.emoji,
          weatherDescription: info.description,
          et0: data.daily.et0_fao_evapotranspiration ? Math.round(data.daily.et0_fao_evapotranspiration[i] * 10) / 10 : undefined,
        });
      }
    }

    const weatherResult: WeatherData = {
      latitude,
      longitude,
      temperature: Math.round(current.temperature_2m * 10) / 10,
      apparentTemperature: Math.round((current.apparent_temperature ?? current.temperature_2m) * 10) / 10,
      humidity: Math.round(current.relative_humidity_2m),
      precipitation: Math.round((current.precipitation ?? 0) * 10) / 10,
      rain: Math.round((current.rain ?? 0) * 10) / 10,
      weatherCode: current.weather_code ?? 0,
      weatherDescription: wmo.description,
      weatherEmoji: wmo.emoji,
      cloudCover: current.cloud_cover ?? 0,
      windSpeed: Math.round((current.wind_speed_10m ?? 0) * 10) / 10,
      windDirection: current.wind_direction_10m ?? 0,
      windGusts: Math.round((current.wind_gusts_10m ?? 0) * 10) / 10,
      pressure: Math.round(current.surface_pressure ?? 1013),
      timestamp: new Date().toISOString(),
      isFallback: false,
      hourly,
      daily,
    };

    // Save to caches
    weatherCache.set(cacheKey, { data: weatherResult, fetchedAt: nowMs });
    try {
      sessionStorage.setItem(`weather_${cacheKey}`, JSON.stringify({ data: weatherResult, fetchedAt: nowMs }));
    } catch { /* ignore quota */ }

    return weatherResult;
  } catch (error) {
    console.warn('Live weather request failed, checking previous cache...', error);
    // If cache has any previous data, use it even if expired
    const lastData = weatherCache.get(cacheKey)?.data;
    if (lastData) {
      return { ...lastData, isFallback: true };
    }
    // Fallback generator
    return generateFallbackWeatherData(latitude, longitude);
  }
}

/**
 * Evaluates live weather against farm agronomic thresholds.
 * Transforms raw weather into actionable agronomic insights and risk alerts.
 */
export function evaluateWeatherImpact(
  weather: WeatherData,
  zones?: (Zone | ZoneInput)[]
): WeatherAgronomicImpact {
  const alerts: WeatherAlert[] = [];
  const recommendations: string[] = [];

  const temp = weather.temperature;
  const humidity = weather.humidity;
  const wind = weather.windSpeed;
  const rain = weather.precipitation;

  // 1. Heat Stress
  const heatStress = temp >= 35 || weather.apparentTemperature >= 38;
  if (heatStress) {
    alerts.push({
      type: 'heatwave',
      severity: temp > 39 ? 'high' : 'medium',
      title: 'Heat Stress Alert',
      description: `Ambient temperature is ${temp}°C (feels like ${weather.apparentTemperature}°C). High transpiration rates may trigger leaf curling and pollen sterility.`,
      recommendation: 'Increase irrigation frequency by 20–30% during morning hours to reduce canopy temperature.',
    });
    recommendations.push('Run morning drip irrigation cycles to cool crop root zones.');
  }

  // 2. Drought / Water Stress
  const lowRainRecent = rain === 0;
  const highEvap = weather.daily[0]?.et0 ? weather.daily[0].et0 > 5 : temp > 30;
  const droughtStress = lowRainRecent && highEvap && humidity < 40;
  if (droughtStress) {
    alerts.push({
      type: 'drought',
      severity: humidity < 30 ? 'high' : 'medium',
      title: 'Moisture Depletion Warning',
      description: `High atmospheric vapor pressure deficit (Humidity ${humidity}%, Temp ${temp}°C) is rapidly drawing soil moisture.`,
      recommendation: 'Verify soil moisture probes and top up irrigation before critical wilting threshold.',
    });
    recommendations.push('Apply mulch or light irrigation to preserve topsoil moisture.');
  }

  // 3. Flood & Waterlogging Risk
  const heavyRainUpcoming = weather.daily.slice(0, 2).some((d) => d.precipitationSum >= 25);
  const floodRisk = rain > 15 || heavyRainUpcoming;
  if (floodRisk) {
    alerts.push({
      type: 'flood',
      severity: rain > 30 || heavyRainUpcoming ? 'high' : 'medium',
      title: 'Excessive Rainfall & Saturated Soil Alert',
      description: `Heavy precipitation (${rain} mm recorded, up to ${weather.daily[0]?.precipitationSum || 0} mm forecast) poses risk of standing water and root hypoxia.`,
      recommendation: 'Clear field drainage furrows and pause all automated irrigation systems.',
    });
    recommendations.push('Ensure field drainage channels are unobstructed to avoid waterlogging.');
  }

  // 4. Disease / Pathogen Risk (Warm + Wet/Humid promotes fungal spores)
  const diseaseElevated = (humidity > 78 && temp >= 22) || (rain > 5 && humidity > 70);
  if (diseaseElevated) {
    alerts.push({
      type: 'disease',
      severity: humidity > 85 ? 'high' : 'medium',
      title: 'Elevated Fungal Disease Pressure',
      description: `Prolonged relative humidity (${humidity}%) and warm temperature (${temp}°C) create optimal conditions for fungal blight, mildew, and rust spore germination.`,
      recommendation: 'Scout vulnerable crops (e.g. Rice, Potato, Wheat) and apply preventative bio-fungicide if necessary.',
    });
    recommendations.push('Inspect field under-canopies for early signs of fungal lesions.');
  }

  // 5. Frost Risk
  const frostRisk = temp <= 3;
  if (frostRisk) {
    alerts.push({
      type: 'frost',
      severity: temp <= 0 ? 'high' : 'medium',
      title: 'Frost Warning',
      description: `Near-freezing temperature (${temp}°C) can damage tender vegetative tissue and blossoms.`,
      recommendation: 'Deploy frost blankets or run light sprinkler irrigation before dawn to release latent heat.',
    });
    recommendations.push('Protect frost-sensitive crops with thermal covers.');
  }

  // 6. High Wind Warning
  if (wind >= 35 || weather.windGusts >= 45) {
    alerts.push({
      type: 'wind',
      severity: wind >= 50 ? 'high' : 'medium',
      title: 'High Wind Advisory',
      description: `Wind gusts up to ${weather.windGusts} km/h may cause crop lodging (stem breakage) and drift spray fertilizers.`,
      recommendation: 'Postpone aerial/foliar pesticide spraying until wind speeds decrease below 15 km/h.',
    });
    recommendations.push('Postpone chemical spraying to prevent spray drift.');
  }

  // Determine overall status
  let overallStatus: 'optimal' | 'moderate_stress' | 'high_risk' = 'optimal';
  if (alerts.some((a) => a.severity === 'high')) {
    overallStatus = 'high_risk';
  } else if (alerts.length > 0) {
    overallStatus = 'moderate_stress';
  }

  if (recommendations.length === 0) {
    recommendations.push('Atmospheric conditions are favorable for steady vegetative crop growth.');
  }

  return {
    overallStatus,
    alerts,
    recommendations,
    heatStress,
    droughtStress,
    floodRisk,
    diseaseElevated,
    frostRisk,
  };
}
