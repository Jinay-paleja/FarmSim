import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import type { Farm, Zone, Scenario, SimulationResult, User, FieldStressState, CropType, SoilType, GrowthStage, IrrigationMethod } from '../types';

const FARMS_COLLECTION = 'farms';
const SIMULATIONS_COLLECTION = 'simulations';
const SIMULATION_RESULTS_COLLECTION = 'simulation_results';
const SCENARIOS_COLLECTION = 'scenarios';
const USERS_COLLECTION = 'users';

/**
 * Normalize a Firestore document (which may use snake_case from the backend
 * Admin SDK) into the camelCase field names the React app expects.
 */
function normalizeFarm(data: Record<string, unknown>): Farm {
  const zoneArray = (data.zones as unknown[] | undefined) || (data.zone_list as unknown[] | undefined) || [];
  const zones: Zone[] = zoneArray.map((zone: unknown): Zone => {
    const z = zone as Record<string, unknown>;
    return {
      id: String(z.zone_id || z.id || ''),
      farmId: String(z.farm_id || z.farmId || data.farm_id || data.farmId || ''),
      name: String(z.name || ''),
      area: Number(z.area_acres || z.area || 0),
      crop: (z.crop as CropType) || 'Wheat',
      soilType: (z.soil || z.soilType) as SoilType,
      growthStage: (z.growth_stage || z.growthStage) as GrowthStage,
      irrigationMethod: (z.irrigation || z.irrigationMethod) as IrrigationMethod,
      soilMoisture: Number(z.soil_moisture ?? z.soilMoisture ?? 50),
      temperature: Number(z.temperature ?? 25),
      humidity: Number(z.humidity ?? 60),
      rainfall: Number(z.rainfall ?? 100),
      nitrogen: Number(z.nitrogen ?? 50),
      phosphorus: Number(z.phosphorus ?? 30),
      potassium: Number(z.potassium ?? 40),
      healthScore: Number(z.health_score ?? z.healthScore ?? 85),
      diseaseRisk: Number(z.disease_risk ?? z.diseaseRisk ?? 10),
      boundary: z.boundary as [number, number][] | undefined,
      boundaryShape: (z.boundary_shape || z.boundaryShape) as 'polygon' | 'rectangle' | 'circle' | undefined,
      stressState: (z.stress_state || z.stressState) as FieldStressState | undefined,
    };
  });

  return {
    id: String(data.farm_id || data.id || ''),
    ownerId: String(data.owner_id || data.ownerId || ''),
    name: String(data.name || ''),
    location: String(data.location || ''),
    area: Number(data.area_acres || data.area || 0),
    latitude: data.latitude != null ? Number(data.latitude) : undefined,
    longitude: data.longitude != null ? Number(data.longitude) : undefined,
    numberOfZones: Number(data.number_of_zones || data.numberOfZones || zones.length),
    boundary: data.boundary as [number, number][] | undefined,
    boundaryAreaAcres: data.boundary_area_acres as number | undefined,
    boundaryAreaHectares: data.boundary_area_hectares as number | undefined,
    boundaryPerimeterMeters: data.boundary_perimeter_meters as number | undefined,
    boundaryShape: (data.boundary_shape || data.boundaryShape) as 'polygon' | 'rectangle' | 'circle' | undefined,
    zones,
    createdAt: data.created_at as string | undefined,
    updatedAt: data.updated_at as string | undefined,
  };
}

export const firestoreService = {
  /**
   * Save user document to Firestore
   */
  saveUser: async (user: User): Promise<User> => {
    if (!isFirebaseConfigured) return user;
    try {
      const userRef = doc(db!, USERS_COLLECTION, user.id);
      const cleanData = JSON.parse(JSON.stringify(user));
      await setDoc(userRef, { ...cleanData, updatedAt: new Date().toISOString() }, { merge: true });
      return user;
    } catch (error) {
      console.warn('Firestore saveUser error:', error);
      return user;
    }
  },
  /**
   * Save or update a farm document in Cloud Firestore.
   * Writes both camelCase and snake_case owner fields so that queries from
   * either the browser or the backend Admin SDK resolve correctly.
   */
  saveFarm: async (farm: Farm): Promise<Farm> => {
    if (!isFirebaseConfigured) return farm;
    try {
      const farmRef = doc(db!, FARMS_COLLECTION, farm.id);
      const cleanData = JSON.parse(JSON.stringify(farm));
      const ownerId = farm.ownerId || cleanData.owner_id;
      await setDoc(
        farmRef,
        {
          ...cleanData,
          ownerId: ownerId,
          owner_id: ownerId,
          farm_id: farm.id,
          id: farm.id,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      return farm;
    } catch (error) {
      console.warn('Firestore saveFarm error:', error);
      return farm;
    }
  },

  /**
   * List farms owned by a specific user (always scoped to ownerId).
   * Returns an empty array when ownerId is not provided to prevent
   * leaking other farmers' data.
   */
  getFarms: async (ownerId?: string): Promise<Farm[]> => {
    if (!isFirebaseConfigured || !ownerId) return [];
    try {
      const farmsRef = collection(db!, FARMS_COLLECTION);

      // Query by the camelCase field first (used when the frontend writes).
      const q1 = query(farmsRef, where('ownerId', '==', ownerId));
      const snap1 = await getDocs(q1);

      // Also query by the snake_case field (used by the backend Admin SDK).
      const q2 = query(farmsRef, where('owner_id', '==', ownerId));
      const snap2 = await getDocs(q2);

      const seen = new Set<string>();
      const farms: Farm[] = [];

      const process = (snapshot: typeof snap1) => {
        snapshot.forEach((docSnap) => {
          const id = docSnap.id;
          if (seen.has(id)) return;
          seen.add(id);
          const data = docSnap.data() as Record<string, unknown>;
          const farm = normalizeFarm({ ...data, id });
          if (farm.ownerId === ownerId) {
            farms.push(farm);
          }
        });
      };

      process(snap1);
      process(snap2);

      return farms;
    } catch (error) {
      console.warn('Firestore getFarms error:', error);
      return [];
    }
  },

  /**
   * Get a single farm by ID from Firestore
   */
  getFarm: async (farmId: string): Promise<Farm | null> => {
    if (!isFirebaseConfigured) return null;
    try {
      const farmRef = doc(db!, FARMS_COLLECTION, farmId);
      const docSnap = await getDoc(farmRef);
      if (docSnap.exists()) {
        return normalizeFarm({ ...(docSnap.data() as Record<string, unknown>), id: docSnap.id });
      }
      return null;
    } catch (error) {
      console.warn('Firestore getFarm error:', error);
      return null;
    }
  },

  /**
   * Delete a farm from Firestore
   */
  deleteFarm: async (farmId: string): Promise<void> => {
    if (!isFirebaseConfigured) return;
    try {
      await deleteDoc(doc(db!, FARMS_COLLECTION, farmId));
    } catch (error) {
      console.warn('Firestore deleteFarm error:', error);
    }
  },

  /**
   * Save a simulation result to Firestore
   */
  saveSimulation: async (result: SimulationResult): Promise<SimulationResult> => {
    if (!isFirebaseConfigured) return result;
    try {
      const simRef = doc(db!, SIMULATIONS_COLLECTION, result.id);
      const cleanData = JSON.parse(JSON.stringify(result));
      await setDoc(simRef, {
        ...cleanData,
        farmId: result.farmId,
        farm_id: result.farmId,
        createdAt: new Date().toISOString(),
      }, { merge: true });
      await setDoc(
        doc(db!, SIMULATION_RESULTS_COLLECTION, result.id),
        { ...cleanData, createdAt: new Date().toISOString() },
        { merge: true }
      );
      return result;
    } catch (error) {
      console.warn('Firestore saveSimulation error:', error);
      return result;
    }
  },

  /**
   * List simulation history for a farm from Firestore
   */
  getSimulations: async (farmId: string): Promise<SimulationResult[]> => {
    if (!isFirebaseConfigured) return [];
    try {
      const simRef = collection(db!, SIMULATIONS_COLLECTION);
      const q = query(simRef, where('farmId', '==', farmId), limit(20));
      const snapshot = await getDocs(q);
      const results: SimulationResult[] = [];
      snapshot.forEach((docSnap) => {
        results.push(docSnap.data() as SimulationResult);
      });
      return results;
    } catch (error) {
      console.warn('Firestore getSimulations error:', error);
      return [];
    }
  },

  /**
   * Save a scenario preset to Firestore
   */
  saveScenario: async (scenario: Scenario): Promise<Scenario> => {
    if (!isFirebaseConfigured) return scenario;
    try {
      const scenarioRef = doc(db!, SCENARIOS_COLLECTION, scenario.id);
      const cleanData = JSON.parse(JSON.stringify(scenario));
      await setDoc(scenarioRef, {
        ...cleanData,
        farmId: scenario.farmId,
        farm_id: scenario.farmId,
        createdAt: new Date().toISOString(),
      }, { merge: true });
      return scenario;
    } catch (error) {
      console.warn('Firestore saveScenario error:', error);
      return scenario;
    }
  },

  /**
   * Get saved scenarios for a farm from Firestore
   */
  getScenarios: async (farmId: string): Promise<Scenario[]> => {
    if (!isFirebaseConfigured) return [];
    try {
      const scenarioRef = collection(db!, SCENARIOS_COLLECTION);
      const q = query(scenarioRef, where('farmId', '==', farmId));
      const snapshot = await getDocs(q);
      const scenarios: Scenario[] = [];
      snapshot.forEach((docSnap) => {
        scenarios.push(docSnap.data() as Scenario);
      });
      return scenarios;
    } catch (error) {
      console.warn('Firestore getScenarios error:', error);
      return [];
    }
  },
};

export default firestoreService;
