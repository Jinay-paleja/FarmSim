import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Ruler, Grid3x3, Sprout, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { farmApi } from '../services/api';
import { isMockEnabled, createMockFarm } from '../services/mockData';
import { useFarmContext } from '../context/FarmContext';
import type { FarmCreateInput, Farm } from '../types';

export default function FarmCreatePage() {
  const navigate = useNavigate();
  const { refreshFarms, selectFarm } = useFarmContext();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FarmCreateInput>({
    name: '',
    location: '',
    area: 10,
    latitude: undefined,
    longitude: undefined,
    numberOfZones: 3,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FarmCreateInput, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FarmCreateInput, string>> = {};
    if (!form.name.trim()) newErrors.name = 'Farm name is required';
    if (!form.location.trim()) newErrors.location = 'Location is required';
    if (form.area <= 0) newErrors.area = 'Area must be greater than 0';
    if (form.numberOfZones < 1) newErrors.numberOfZones = 'At least 1 zone is required';
    if (form.numberOfZones > 20) newErrors.numberOfZones = 'Maximum 20 zones allowed';
    if (form.latitude !== undefined && (form.latitude < -90 || form.latitude > 90)) {
      newErrors.latitude = 'Latitude must be between -90 and 90';
    }
    if (form.longitude !== undefined && (form.longitude < -180 || form.longitude > 180)) {
      newErrors.longitude = 'Longitude must be between -180 and 180';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      let farm: Farm;
      try {
        farm = await farmApi.create(form);
      } catch {
        if (isMockEnabled()) {
          farm = createMockFarm(form);
          // Store in localStorage for mock mode
          const farms = JSON.parse(localStorage.getItem('farms') || '[]');
          farms.push(farm);
          localStorage.setItem('farms', JSON.stringify(farms));
          toast.success('Farm created (offline mode)');
        } else {
          throw new Error('Failed to create farm');
        }
      }
      await refreshFarms();
      selectFarm(farm.id);
      toast.success('Farm created successfully! Opening Farm Map Builder...');
      navigate(`/farms/${farm.id}/builder`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create farm');
    } finally {
      setLoading(false);
    }
  };

  const updateField = <K extends keyof FarmCreateInput>(key: K, value: FarmCreateInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  return (
    <div className="page-container">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-farm-green-pale flex items-center justify-center">
              <Sprout className="w-5 h-5 text-farm-green" />
            </div>
            <h1 className="page-title">Create Your Farm</h1>
          </div>
          <p className="text-gray-500 ml-[52px]">
            Set up your farm details. You'll configure zones and crops in the next step.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Farm Name */}
          <div className="card">
            <h2 className="section-title flex items-center gap-2 mb-4">
              <Sprout className="w-4 h-4 text-farm-green" />
              Basic Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="label">Farm Name *</label>
                <input
                  type="text"
                  className={`input-field ${errors.name ? 'border-red-300 focus:ring-red-300/30 focus:border-red-400' : ''}`}
                  placeholder="e.g., Green Valley Farm"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                />
                {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="label">Location *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    className={`input-field pl-10 ${errors.location ? 'border-red-300 focus:ring-red-300/30 focus:border-red-400' : ''}`}
                    placeholder="e.g., Punjab, India"
                    value={form.location}
                    onChange={(e) => updateField('location', e.target.value)}
                  />
                </div>
                {errors.location && <p className="text-sm text-red-500 mt-1">{errors.location}</p>}

                {/* Location Quick Presets */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-gray-400 font-medium mr-1">Quick Select:</span>
                  {[
                    { name: 'Ludhiana, Punjab', lat: 30.9010, lng: 75.8573 },
                    { name: 'Fresno, California', lat: 36.7468, lng: -119.7726 },
                    { name: 'Ames, Iowa', lat: 42.0308, lng: -93.6319 },
                    { name: 'Austin, Texas', lat: 30.2672, lng: -97.7431 },
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        updateField('location', preset.name);
                        updateField('latitude', preset.lat);
                        updateField('longitude', preset.lng);
                      }}
                      className="text-xs px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-emerald-50 hover:text-farm-green text-gray-600 transition-colors border border-gray-200"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Area & Zones */}
          <div className="card">
            <h2 className="section-title flex items-center gap-2 mb-4">
              <Ruler className="w-4 h-4 text-farm-green" />
              Size & Layout
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Farm Area (acres) *</label>
                <input
                  type="number"
                  className={`input-field ${errors.area ? 'border-red-300 focus:ring-red-300/30 focus:border-red-400' : ''}`}
                  placeholder="10"
                  min="0.1"
                  step="0.1"
                  value={form.area}
                  onChange={(e) => updateField('area', parseFloat(e.target.value) || 0)}
                />
                {errors.area && <p className="text-sm text-red-500 mt-1">{errors.area}</p>}
              </div>

              <div>
                <label className="label flex items-center gap-2">
                  <Grid3x3 className="w-3.5 h-3.5 text-gray-400" />
                  Number of Zones *
                </label>
                <input
                  type="number"
                  className={`input-field ${errors.numberOfZones ? 'border-red-300 focus:ring-red-300/30 focus:border-red-400' : ''}`}
                  placeholder="3"
                  min="1"
                  max="20"
                  value={form.numberOfZones}
                  onChange={(e) => updateField('numberOfZones', parseInt(e.target.value) || 1)}
                />
                {errors.numberOfZones && <p className="text-sm text-red-500 mt-1">{errors.numberOfZones}</p>}
              </div>
            </div>
          </div>

          {/* Coordinates */}
          <div className="card">
            <h2 className="section-title flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-farm-green" />
              Coordinates
              <span className="text-xs font-normal text-gray-400">(Optional)</span>
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Add latitude and longitude for precise location mapping.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Latitude</label>
                <input
                  type="number"
                  className={`input-field ${errors.latitude ? 'border-red-300' : ''}`}
                  placeholder="e.g., 28.6139"
                  step="0.0001"
                  min="-90"
                  max="90"
                  value={form.latitude ?? ''}
                  onChange={(e) => updateField('latitude', e.target.value ? parseFloat(e.target.value) : undefined)}
                />
                {errors.latitude && <p className="text-sm text-red-500 mt-1">{errors.latitude}</p>}
              </div>
              <div>
                <label className="label">Longitude</label>
                <input
                  type="number"
                  className={`input-field ${errors.longitude ? 'border-red-300' : ''}`}
                  placeholder="e.g., 77.2090"
                  step="0.0001"
                  min="-180"
                  max="180"
                  value={form.longitude ?? ''}
                  onChange={(e) => updateField('longitude', e.target.value ? parseFloat(e.target.value) : undefined)}
                />
                {errors.longitude && <p className="text-sm text-red-500 mt-1">{errors.longitude}</p>}
              </div>
            </div>
          </div>

          {/* Preview Summary */}
          <div className="bg-farm-green-pale/50 rounded-2xl p-5 border border-farm-green/10">
            <h3 className="text-sm font-semibold text-farm-green mb-3">Farm Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-farm-green">{form.area || 0}</p>
                <p className="text-xs text-farm-green/70">acres</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-farm-green">{form.numberOfZones || 0}</p>
                <p className="text-xs text-farm-green/70">zones</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-farm-green">
                  {form.numberOfZones > 0 ? (form.area / form.numberOfZones).toFixed(1) : 0}
                </p>
                <p className="text-xs text-farm-green/70">acres/zone</p>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 text-lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating Farm...
              </>
            ) : (
              <>
                Create Farm & Configure Zones
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
