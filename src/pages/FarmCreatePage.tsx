import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Ruler, Sprout, ArrowRight, Loader2, Sparkles, User as UserIcon, LogIn, Shield, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { farmApi, zoneApi } from '../services/api';
import { useFarmContext } from '../context/FarmContext';
import { useAuth } from '../context/AuthContext';
import VirtualFarmWorkspace from '../components/virtual/VirtualFarmWorkspace';
import type { FarmCreateInput, ZoneInput } from '../types';

export default function FarmCreatePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { refreshFarms, selectFarm } = useFarmContext();
  const [loading, setLoading] = useState(false);

  // Form State
  const [farmName, setFarmName] = useState('');
  const [totalArea, setTotalArea] = useState<number>(10);
  const [zones, setZones] = useState<ZoneInput[]>([
    {
      name: 'Zone 1 - Main Field',
      area: 6,
      crop: 'Wheat',
      soilType: 'Loamy',
      growthStage: 'Vegetative',
      irrigationMethod: 'Drip',
      soilMoisture: 45,
      temperature: 24,
      humidity: 60,
      rainfall: 15,
      nitrogen: 60,
      phosphorus: 40,
      potassium: 40,
      healthScore: 85,
      diseaseRisk: 15,
    },
    {
      name: 'Zone 2 - Secondary Field',
      area: 4,
      crop: 'Rice',
      soilType: 'Alluvial',
      growthStage: 'Seedling',
      irrigationMethod: 'Flood',
      soilMoisture: 55,
      temperature: 24,
      humidity: 60,
      rainfall: 15,
      nitrogen: 55,
      phosphorus: 35,
      potassium: 35,
      healthScore: 80,
      diseaseRisk: 12,
    }
  ]);
  const [selectedZoneIndex, setSelectedZoneIndex] = useState<number | null>(0);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const allocatedArea = zones.reduce((sum, z) => sum + (Number(z.area) || 0), 0);
  const remainingArea = Math.max(0, Math.round((totalArea - allocatedArea) * 100) / 100);

  const validate = (): boolean => {
    const newErrors: Partial<Record<string, string>> = {};
    if (!farmName.trim()) newErrors.farmName = 'Farm name is required';
    if (totalArea <= 0) newErrors.totalArea = 'Total farm area must be greater than 0 acres';
    if (zones.length === 0) newErrors.zones = 'At least 1 zone must be added to your farm';
    if (allocatedArea > totalArea + 0.001) {
      newErrors.zones = `Allocated zone area (${allocatedArea.toFixed(1)} acres) exceeds total farm area (${totalArea} acres)`;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      if (errors.zones) toast.error(errors.zones);
      return;
    }

    setLoading(true);

    const payload: FarmCreateInput = {
      name: farmName.trim(),
      location: 'Virtual Farm Workspace',
      area: totalArea,
      total_area: totalArea,
      numberOfZones: zones.length,
      ownerId: user?.id || '',
    };

    try {
      // 1. Create the farm in Firestore
      const farm = await farmApi.create(payload);
      const createdFarmId = farm.id || farm.farmId;
      if (!createdFarmId) {
        throw new Error('Farm creation did not return a valid farm ID.');
      }

      // 2. Persist the configured virtual zones
      for (const zone of zones) {
        await zoneApi.create(createdFarmId, {
          ...zone,
          area: Number(zone.area),
        });
      }

      await refreshFarms();
      selectFarm(createdFarmId);
      toast.success('Virtual Farm created successfully! Opening Farm Dashboard...');
      navigate(`/farms/${createdFarmId}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create farm. Please verify details and try again.');
    } finally {
      setLoading(false);
    }
  };

  // ===== LOGIN GATE =====
  if (!isAuthenticated || !user) {
    return (
      <div className="page-container">
        <div className="max-w-md mx-auto text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-farm-green-pale flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-farm-green" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sign in to Create Your Farm</h1>
          <p className="text-gray-500 mb-8">
            You need to be logged in to create a new farm. Sign in with your existing account or register as a new farmer.
          </p>
          <Link
            to="/login"
            state={{ from: { pathname: '/farms/create' } }}
            className="btn-primary inline-flex items-center gap-2 px-8 py-3.5 text-lg"
          >
            <LogIn className="w-5 h-5" />
            Sign In / Register
          </Link>
          <p className="text-xs text-gray-400 mt-6">
            After signing in, you'll be redirected back to create your digital farm.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-farm-green-pale flex items-center justify-center">
              <Sprout className="w-5 h-5 text-farm-green" />
            </div>
            <h1 className="page-title">Digital Farm Creator</h1>
          </div>
          <p className="text-gray-500 ml-[52px]">
            Define your farm name, specify total acreage, and visually divide your fields into virtual zones.
          </p>
          {user && (
            <div className="ml-[52px] mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              <UserIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>Owner account: <strong>{user.name}</strong> ({user.email})</span>
            </div>
          )}
        </div>

        {/* Creation Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Farm Setup Card */}
          <div className="card">
            <h2 className="section-title flex items-center gap-2 mb-4">
              <Sprout className="w-4 h-4 text-farm-green" />
              1. Farm Specifications
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Farm Name *</label>
                <input
                  type="text"
                  required
                  className={`input-field ${errors.farmName ? 'border-red-300 focus:ring-red-300/30 focus:border-red-400' : ''}`}
                  placeholder="e.g., Sunrise Agro Valley"
                  value={farmName}
                  onChange={(e) => {
                    setFarmName(e.target.value);
                    if (errors.farmName) setErrors((prev) => ({ ...prev, farmName: undefined }));
                  }}
                />
                {errors.farmName && <p className="text-xs text-red-500 mt-1">{errors.farmName}</p>}
              </div>

              <div>
                <label className="label">Total Farm Area (Acres) *</label>
                <div className="relative">
                  <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="10000"
                    required
                    className={`input-field pl-10 ${errors.totalArea ? 'border-red-300 focus:ring-red-300/30 focus:border-red-400' : ''}`}
                    placeholder="10"
                    value={totalArea || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setTotalArea(val);
                      if (errors.totalArea) setErrors((prev) => ({ ...prev, totalArea: undefined }));
                    }}
                  />
                </div>
                {errors.totalArea && <p className="text-xs text-red-500 mt-1">{errors.totalArea}</p>}
              </div>
            </div>
          </div>

          {/* Virtual Farm Workspace Card */}
          <div className="card">
            <h2 className="section-title flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-farm-green" />
              2. Virtual Farm Canvas & Zone Sketching
            </h2>
            <p className="text-xs text-gray-500 mb-5">
              Partition your farm into zones. Assign crops, soil profiles, and irrigation systems to each zone.
            </p>

            <VirtualFarmWorkspace
              farmName={farmName}
              totalArea={totalArea}
              zones={zones}
              onZonesChange={(updatedZones) => {
                setZones(updatedZones);
                if (errors.zones) setErrors((prev) => ({ ...prev, zones: undefined }));
              }}
              selectedZoneIndex={selectedZoneIndex}
              onSelectZone={setSelectedZoneIndex}
            />

            {errors.zones && (
              <p className="text-xs text-red-500 mt-3 font-semibold">{errors.zones}</p>
            )}
          </div>

          {/* Farm Creation Summary */}
          <div className="bg-farm-green-pale/60 rounded-2xl p-5 border border-farm-green/15 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-farm-green shadow-xs">
                <CheckCircle className="w-5 h-5 text-farm-green" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900">
                  {farmName ? farmName : 'New Digital Farm'}
                </h4>
                <p className="text-xs text-gray-600">
                  {totalArea} acres total • {zones.length} configured field zones • {allocatedArea.toFixed(1)} acres planted
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || allocatedArea > totalArea + 0.001}
              className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 py-3 px-6 text-base shadow-md cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Virtual Farm...
                </>
              ) : (
                <>
                  Save Farm & Launch Dashboard
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
