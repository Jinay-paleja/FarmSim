/**
 * Geocoding Service for FarmSim AI
 * Provides intelligent location lookup with built-in instant agricultural dictionary
 * and OpenStreetMap Nominatim live search fallback.
 */

export interface GeocodedLocation {
  lat: number;
  lng: number;
  displayName: string;
}

// Built-in high-precision dictionary of prominent agricultural hubs and major regions
const KNOWN_LOCATIONS: Record<string, [number, number]> = {
  // India
  'mumbai': [19.0760, 72.8777],
  'ludhiana': [30.9010, 75.8573],
  'punjab': [30.9010, 75.8573],
  'amritsar': [31.6340, 74.8723],
  'jalandhar': [31.3260, 75.5762],
  'bathinda': [30.2110, 74.9455],
  'delhi': [28.6139, 77.2090],
  'new delhi': [28.6139, 77.2090],
  'chandigarh': [30.7333, 76.7794],
  'haryana': [29.0588, 76.0856],
  'karnal': [29.6857, 76.9905],
  'uttar pradesh': [26.8467, 80.9462],
  'lucknow': [26.8467, 80.9462],
  'pune': [18.5204, 73.8567],
  'maharashtra': [19.7515, 75.7139],
  'nagpur': [21.1458, 79.0882],
  'nashik': [19.9975, 73.7898],
  'bengaluru': [12.9716, 77.5946],
  'bangalore': [12.9716, 77.5946],
  'hyderabad': [17.3850, 78.4867],
  'chennai': [13.0827, 80.2707],
  'kolkata': [22.5726, 88.3639],
  'ahmedabad': [23.0225, 72.5714],
  'gujarat': [22.2587, 71.1924],
  'surat': [21.1702, 72.8311],
  'jaipur': [26.9124, 75.7873],
  'rajasthan': [27.0238, 74.2179],
  'bhopal': [23.2599, 77.4126],
  'indore': [22.7196, 75.8577],

  // United States
  'fresno': [36.7468, -119.7726],
  'california': [36.7468, -119.7726],
  'central valley': [36.7468, -119.7726],
  'sacramento': [38.5816, -121.4944],
  'salinas': [36.6777, -121.6555],
  'bakersfield': [35.3733, -119.0187],
  'ames': [42.0308, -93.6319],
  'iowa': [42.0308, -93.6319],
  'des moines': [41.5868, -93.6250],
  'austin': [30.2672, -97.7431],
  'texas': [31.9686, -99.9018],
  'dallas': [32.7767, -96.7970],
  'houston': [29.7604, -95.3698],
  'omaha': [41.2565, -95.9345],
  'nebraska': [41.4925, -99.9018],
  'kansas city': [39.0997, -94.5786],
  'kansas': [39.0119, -98.4842],
  'chicago': [41.8781, -87.6298],
  'illinois': [40.6331, -89.3985],

  // Global Agricultural Capitals
  'london': [51.5074, -0.1278],
  'paris': [48.8566, 2.3522],
  'nairobi': [-1.2921, 36.8219],
  'kenya': [0.0236, 37.9062],
  'sydney': [-33.8688, 151.2093],
  'melbourne': [-37.8136, 144.9631],
  'sao paulo': [-23.5505, -46.6333],
  'brazil': [-14.2350, -51.9253],
  'buenos aires': [-34.6037, -58.3816],
  'argentina': [-38.4161, -63.6167],
  'tokyo': [35.6762, 139.6503],
  'beijing': [39.9042, 116.4074],
};

const queryCache = new Map<string, GeocodedLocation>();

/**
 * Resolves a human-entered location string to geographic latitude & longitude.
 * 1. Checks in-memory query cache.
 * 2. Matches known agricultural regions dictionary.
 * 3. Falls back to OpenStreetMap Nominatim live search.
 */
export async function geocodeLocation(rawQuery: string): Promise<GeocodedLocation | null> {
  const query = rawQuery.trim().toLowerCase();
  if (!query || query.length < 2) return null;

  // 1. In-memory cache
  if (queryCache.has(query)) {
    return queryCache.get(query)!;
  }

  // 2. Direct dictionary match
  if (KNOWN_LOCATIONS[query]) {
    const [lat, lng] = KNOWN_LOCATIONS[query];
    const result: GeocodedLocation = {
      lat,
      lng,
      displayName: rawQuery.trim(),
    };
    queryCache.set(query, result);
    return result;
  }

  // Substring match in dictionary
  for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
    if (query.includes(key) || key.includes(query)) {
      const result: GeocodedLocation = {
        lat: coords[0],
        lng: coords[1],
        displayName: rawQuery.trim(),
      };
      queryCache.set(query, result);
      return result;
    }
  }

  // 3. Live Nominatim Search
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(rawQuery)}&limit=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (!isNaN(lat) && !isNaN(lng)) {
          const result: GeocodedLocation = {
            lat: Math.round(lat * 1000000) / 1000000,
            lng: Math.round(lng * 1000000) / 1000000,
            displayName: data[0].display_name || rawQuery,
          };
          queryCache.set(query, result);
          return result;
        }
      }
    }
  } catch (err) {
    // Network or abort error; gracefully ignored
  }

  return null;
}
