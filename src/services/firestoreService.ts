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
import type { Farm, Zone, Scenario, SimulationResult, User } from '../types';

const FARMS_COLLECTION = 'farms';
const SIMULATIONS_COLLECTION = 'simulations';
const SCENARIOS_COLLECTION = 'scenarios';
const USERS_COLLECTION = 'users';

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
   * Save or update a farm document in Cloud Firestore
   */
  saveFarm: async (farm: Farm): Promise<Farm> => {
    if (!isFirebaseConfigured) return farm;
    try {
      const farmRef = doc(db!, FARMS_COLLECTION, farm.id);
      const cleanData = JSON.parse(JSON.stringify(farm));
      await setDoc(
        farmRef,
        {
          ...cleanData,
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
   * List all farms or farms owned by a specific user
   */
  getFarms: async (ownerId?: string): Promise<Farm[]> => {
    if (!isFirebaseConfigured) return [];
    try {
      const farmsRef = collection(db!, FARMS_COLLECTION);
      const q = ownerId
        ? query(farmsRef, where('ownerId', '==', ownerId))
        : farmsRef;

      const snapshot = await getDocs(q);
      const farms: Farm[] = [];
      snapshot.forEach((docSnap) => {
        farms.push(docSnap.data() as Farm);
      });
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
        return docSnap.data() as Farm;
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
        createdAt: new Date().toISOString(),
      });
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
        createdAt: new Date().toISOString(),
      });
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
