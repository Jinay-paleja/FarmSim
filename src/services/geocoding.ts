/**
 * Geocoding Service for FarmSim AI
 * Provides intelligent location lookup with built-in instant agricultural dictionary
 * and OpenStreetMap Nominatim live search & reverse geocoding.
 */

export interface LocationDetails {
  latitude: number;
  longitude: number;
  displayName: string;
  areaName?: string;
  city?: string;
  state?: string;
  country?: string;
  formattedLocation: string; // e.g. "Powai, Mumbai" or "Ludhiana, Punjab"
}

export type GeocodedLocation = LocationDetails;

// Built-in high-precision dictionary of prominent agricultural hubs and major regions
const KNOWN_LOCATIONS: Record<string, { coords: [number, number]; area?: string; city?: string; state?: string; country?: string }> = {
  // India
  'powai': { coords: [19.1176, 72.9060], area: 'Powai', city: 'Mumbai', state: 'Maharashtra', country: 'India' },
  'mumbai': { coords: [19.0760, 72.8777], city: 'Mumbai', state: 'Maharashtra', country: 'India' },
  'ludhiana': { coords: [30.9010, 75.8573], city: 'Ludhiana', state: 'Punjab', country: 'India' },
  'punjab': { coords: [30.9010, 75.8573], state: 'Punjab', country: 'India' },
  'amritsar': { coords: [31.6340, 74.8723], city: 'Amritsar', state: 'Punjab', country: 'India' },
  'jalandhar': { coords: [31.3260, 75.5762], city: 'Jalandhar', state: 'Punjab', country: 'India' },
  'bathinda': { coords: [30.2110, 74.9455], city: 'Bathinda', state: 'Punjab', country: 'India' },
  'delhi': { coords: [28.6139, 77.2090], city: 'Delhi', state: 'Delhi', country: 'India' },
  'new delhi': { coords: [28.6139, 77.2090], city: 'New Delhi', state: 'Delhi', country: 'India' },
  'chandigarh': { coords: [30.7333, 76.7794], city: 'Chandigarh', state: 'Chandigarh', country: 'India' },
  'haryana': { coords: [29.0588, 76.0856], state: 'Haryana', country: 'India' },
  'karnal': { coords: [29.6857, 76.9905], city: 'Karnal', state: 'Haryana', country: 'India' },
  'uttar pradesh': { coords: [26.8467, 80.9462], state: 'Uttar Pradesh', country: 'India' },
  'lucknow': { coords: [26.8467, 80.9462], city: 'Lucknow', state: 'Uttar Pradesh', country: 'India' },
  'pune': { coords: [18.5204, 73.8567], city: 'Pune', state: 'Maharashtra', country: 'India' },
  'maharashtra': { coords: [19.7515, 75.7139], state: 'Maharashtra', country: 'India' },
  'nagpur': { coords: [21.1458, 79.0882], city: 'Nagpur', state: 'Maharashtra', country: 'India' },
  'nashik': { coords: [19.9975, 73.7898], city: 'Nashik', state: 'Maharashtra', country: 'India' },
  'bengaluru': { coords: [12.9716, 77.5946], city: 'Bengaluru', state: 'Karnataka', country: 'India' },
  'bangalore': { coords: [12.9716, 77.5946], city: 'Bengaluru', state: 'Karnataka', country: 'India' },
  'hyderabad': { coords: [17.3850, 78.4867], city: 'Hyderabad', state: 'Telangana', country: 'India' },
  'chennai': { coords: [13.0827, 80.2707], city: 'Chennai', state: 'Tamil Nadu', country: 'India' },
  'kolkata': { coords: [22.5726, 88.3639], city: 'Kolkata', state: 'West Bengal', country: 'India' },
  'ahmedabad': { coords: [23.0225, 72.5714], city: 'Ahmedabad', state: 'Gujarat', country: 'India' },
  'gujarat': { coords: [22.2587, 71.1924], state: 'Gujarat', country: 'India' },
  'surat': { coords: [21.1702, 72.8311], city: 'Surat', state: 'Gujarat', country: 'India' },
  'jaipur': { coords: [26.9124, 75.7873], city: 'Jaipur', state: 'Rajasthan', country: 'India' },
  'rajasthan': { coords: [27.0238, 74.2179], state: 'Rajasthan', country: 'India' },
  'bhopal': { coords: [23.2599, 77.4126], city: 'Bhopal', state: 'Madhya Pradesh', country: 'India' },
  'indore': { coords: [22.7196, 75.8577], city: 'Indore', state: 'Madhya Pradesh', country: 'India' },

  // United States
  'fresno': { coords: [36.7468, -119.7726], city: 'Fresno', state: 'California', country: 'USA' },
  'california': { coords: [36.7468, -119.7726], state: 'California', country: 'USA' },
  'central valley': { coords: [36.7468, -119.7726], city: 'Central Valley', state: 'California', country: 'USA' },
  'sacramento': { coords: [38.5816, -121.4944], city: 'Sacramento', state: 'California', country: 'USA' },
  'salinas': { coords: [36.6777, -121.6555], city: 'Salinas', state: 'California', country: 'USA' },
  'bakersfield': { coords: [35.3733, -119.0187], city: 'Bakersfield', state: 'California', country: 'USA' },
  'ames': { coords: [42.0308, -93.6319], city: 'Ames', state: 'Iowa', country: 'USA' },
  'iowa': { coords: [42.0308, -93.6319], state: 'Iowa', country: 'USA' },
  'des moines': { coords: [41.5868, -93.6250], city: 'Des Moines', state: 'Iowa', country: 'USA' },
  'austin': { coords: [30.2672, -97.7431], city: 'Austin', state: 'Texas', country: 'USA' },
  'texas': { coords: [31.9686, -99.9018], state: 'Texas', country: 'USA' },
  'dallas': { coords: [32.7767, -96.7970], city: 'Dallas', state: 'Texas', country: 'USA' },
  'houston': { coords: [29.7604, -95.3698], city: 'Houston', state: 'Texas', country: 'USA' },
  'omaha': { coords: [41.2565, -95.9345], city: 'Omaha', state: 'Nebraska', country: 'USA' },
  'nebraska': { coords: [41.4925, -99.9018], state: 'Nebraska', country: 'USA' },
  'kansas city': { coords: [39.0997, -94.5786], city: 'Kansas City', state: 'Kansas', country: 'USA' },
  'kansas': { coords: [39.0119, -98.4842], state: 'Kansas', country: 'USA' },
  'chicago': { coords: [41.8781, -87.6298], city: 'Chicago', state: 'Illinois', country: 'USA' },
  'illinois': { coords: [40.6331, -89.3985], state: 'Illinois', country: 'USA' },

  // Global Agricultural Capitals
  'london': { coords: [51.5074, -0.1278], city: 'London', country: 'UK' },
  'paris': { coords: [48.8566, 2.3522], city: 'Paris', country: 'France' },
  'nairobi': { coords: [-1.2921, 36.8219], city: 'Nairobi', country: 'Kenya' },
  'sydney': { coords: [-33.8688, 151.2093], city: 'Sydney', country: 'Australia' },
  'sao paulo': { coords: [-23.5505, -46.6333], city: 'São Paulo', country: 'Brazil' },
  'buenos aires': { coords: [-34.6037, -58.3816], city: 'Buenos Aires', country: 'Argentina' },
  'tokyo': { coords: [35.6762, 139.6503], city: 'Tokyo', country: 'Japan' },
};

const queryCache = new Map<string, LocationDetails>();
const reverseCache = new Map<string, LocationDetails>();

function formatLocationString(area?: string, city?: string, state?: string, country?: string, rawFallback?: string): string {
  const parts: string[] = [];
  if (area) parts.push(area);
  if (city && (!area || city.toLowerCase() !== area.toLowerCase())) parts.push(city);
  if (state && (!city || state.toLowerCase() !== city.toLowerCase()) && parts.length < 2) parts.push(state);
  
  if (parts.length > 0) {
    return parts.join(', ');
  }
  if (rawFallback) {
    const clean = rawFallback.split(',').slice(0, 2).map((s) => s.trim()).filter(Boolean);
    if (clean.length > 0) return clean.join(', ');
  }
  return country || 'Selected Location';
}

/**
 * Resolves a human-entered location string to geographic latitude & longitude and address breakdown.
 */
export async function geocodeLocation(rawQuery: string): Promise<LocationDetails | null> {
  const query = rawQuery.trim().toLowerCase();
  if (!query || query.length < 2) return null;

  if (queryCache.has(query)) {
    return queryCache.get(query)!;
  }

  // Check dictionary
  if (KNOWN_LOCATIONS[query]) {
    const match = KNOWN_LOCATIONS[query];
    const formatted = formatLocationString(match.area, match.city, match.state, match.country, rawQuery);
    const result: LocationDetails = {
      latitude: match.coords[0],
      longitude: match.coords[1],
      displayName: formatted,
      areaName: match.area,
      city: match.city,
      state: match.state,
      country: match.country,
      formattedLocation: formatted,
    };
    queryCache.set(query, result);
    return result;
  }

  for (const [key, match] of Object.entries(KNOWN_LOCATIONS)) {
    if (query === key || query.includes(key) || key.includes(query)) {
      const formatted = formatLocationString(match.area, match.city, match.state, match.country, rawQuery);
      const result: LocationDetails = {
        latitude: match.coords[0],
        longitude: match.coords[1],
        displayName: formatted,
        areaName: match.area,
        city: match.city,
        state: match.state,
        country: match.country,
        formattedLocation: formatted,
      };
      queryCache.set(query, result);
      return result;
    }
  }

  // OpenStreetMap Nominatim live search with address details
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(rawQuery)}&limit=1`;
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
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        if (!isNaN(lat) && !isNaN(lng)) {
          const addr = item.address || {};
          const areaName = addr.suburb || addr.neighbourhood || addr.residential || addr.village || addr.subdistrict || addr.hamlet || undefined;
          const city = addr.city || addr.town || addr.county || addr.district || addr.state_district || undefined;
          const state = addr.state || undefined;
          const country = addr.country || undefined;
          const formatted = formatLocationString(areaName, city, state, country, item.display_name);

          const result: LocationDetails = {
            latitude: Math.round(lat * 1000000) / 1000000,
            longitude: Math.round(lng * 1000000) / 1000000,
            displayName: item.display_name || formatted,
            areaName,
            city,
            state,
            country,
            formattedLocation: formatted,
          };
          queryCache.set(query, result);
          return result;
        }
      }
    }
  } catch {
    // Network or abort error; gracefully ignored
  }

  return null;
}

/**
 * Reverse geocodes latitude and longitude coordinates into a human-readable location identifier.
 */
export async function reverseGeocodeLocation(lat: number, lng: number): Promise<LocationDetails> {
  const roundedLat = Math.round(lat * 10000) / 10000;
  const roundedLng = Math.round(lng * 10000) / 10000;
  const cacheKey = `${roundedLat},${roundedLng}`;

  if (reverseCache.has(cacheKey)) {
    return reverseCache.get(cacheKey)!;
  }

  // Check known locations nearby (within ~0.05 degrees ~= 5km)
  for (const match of Object.values(KNOWN_LOCATIONS)) {
    const dLat = Math.abs(match.coords[0] - lat);
    const dLng = Math.abs(match.coords[1] - lng);
    if (dLat < 0.05 && dLng < 0.05) {
      const formatted = formatLocationString(match.area, match.city, match.state, match.country);
      const result: LocationDetails = {
        latitude: lat,
        longitude: lng,
        displayName: formatted,
        areaName: match.area,
        city: match.city,
        state: match.state,
        country: match.country,
        formattedLocation: formatted,
      };
      reverseCache.set(cacheKey, result);
      return result;
    }
  }

  // Query OpenStreetMap Nominatim reverse API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const areaName = addr.suburb || addr.neighbourhood || addr.residential || addr.village || addr.subdistrict || addr.hamlet || undefined;
        const city = addr.city || addr.town || addr.county || addr.district || addr.state_district || undefined;
        const state = addr.state || undefined;
        const country = addr.country || undefined;
        const formatted = formatLocationString(areaName, city, state, country, data.display_name);

        const result: LocationDetails = {
          latitude: lat,
          longitude: lng,
          displayName: data.display_name || formatted,
          areaName,
          city,
          state,
          country,
          formattedLocation: formatted,
        };
        reverseCache.set(cacheKey, result);
        return result;
      }
    }
  } catch {
    // Graceful fallback
  }

  const fallbackResult: LocationDetails = {
    latitude: lat,
    longitude: lng,
    displayName: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    formattedLocation: `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
  };
  return fallbackResult;
}
