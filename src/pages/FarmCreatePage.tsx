import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapPin, Ruler, Grid3x3, Sprout, ArrowRight, Loader2, Sparkles, User as UserIcon, LogIn, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { farmApi } from '../services/api';
import { isMockEnabled, createMockFarm } from '../services/mockData';
import { useFarmContext } from '../context/FarmContext';
import { useAuth } from '../context/AuthContext';
import { calculatePolygonArea } from '../services/mapGeometry';
import BoundaryMapPicker from '../components/map/BoundaryMapPicker';
import type { FarmCreateInput, Farm } from '../types';

export default function FarmCreatePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { refreshFarms, selectFarm } = useFarmContext();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FarmCreateInput>({
    name: '',
    location: user?.location || '',
    area: 10,
    latitude: undefined,
    longitude: undefined,
    numberOfZones: 3,
    ownerId: user?.id,
  });

  // Boundary drawing state
  const [boundaryPoints, setBoundaryPoints] = useState<[number, number][]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        ownerId: user.id,
        location: prev.location || user.location || '',
      }));
    }
  }, [user]);

  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  // Mapped area calculation
  const mappedArea = useMemo(() => {
    if (boundaryPoints.length < 3) return null;
    return calculatePolygonArea(boundaryPoints);
  }, [boundaryPoints]);

  // Auto-sync form.area from mapped polygon calculation
  useEffect(() => {
    if (mappedArea && mappedArea.acres > 0) {
      setForm((prev) => ({ ...prev, area: mappedArea.acres }));
    }
  }, [mappedArea]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<string, string>> = {};
    if (!form.name.trim()) newErrors.name = 'Farm name is required';
    if (!form.location.trim()) newErrors.location = 'Location is required';
    if (form.area <= 0) newErrors.area = 'Area must be greater than 0';
    if (form.numberOfZones < 1) newErrors.numberOfZones = 'At least 1 zone is required';
    if (form.numberOfZones > 20) newErrors.numberOfZones = 'Maximum 20 zones allowed';
    // Boundary: 0 points is fine (optional), but 1-2 points is invalid
    if (boundaryPoints.length > 0 && boundaryPoints.length < 3) {
      newErrors.boundary = 'Please mark at least 3 points on the map to define the farm boundary.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    // Build boundary data
    const hasBoundary = boundaryPoints.length >= 3;
    const centerLat = hasBoundary
      ? boundaryPoints.reduce((s, p) => s + p[0], 0) / boundaryPoints.length
      : form.latitude;
    const centerLng = hasBoundary
      ? boundaryPoints.reduce((s, p) => s + p[1], 0) / boundaryPoints.length
      : form.longitude;

    const payload: FarmCreateInput = {
      ...form,
      ownerId: user?.id || 'farmer_punjab',
      latitude: centerLat,
      longitude: centerLng,
      boundary: hasBoundary ? boundaryPoints : undefined,
      boundary_points: hasBoundary
        ? boundaryPoints.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))
        : undefined,
      boundaryGeoJson: hasBoundary
        ? {
            type: 'Polygon' as const,
            coordinates: [
              [
                ...boundaryPoints.map(([lat, lng]) => [lng, lat] as [number, number]),
                [boundaryPoints[0][1], boundaryPoints[0][0]] as [number, number],
              ],
            ],
          }
        : undefined,
      mapped_area: hasBoundary && mappedArea ? mappedArea.acres : undefined,
      total_area: form.area,
    };

    try {
      const farm = await farmApi.create(payload);
      const createdFarmId = farm.id || farm.farmId;
      if (!createdFarmId) {
        throw new Error('Farm creation did not return a valid farm ID.');
      }
      await refreshFarms();
      selectFarm(createdFarmId);
      toast.success('Farm created successfully! Opening Farm Map...');
      navigate(`/farms/${createdFarmId}/builder`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create farm. Please verify details and try again.');
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
            After signing in, you'll be redirected back to create your farm.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-farm-green-pale flex items-center justify-center">
              <Sprout className="w-5 h-5 text-farm-green" />
            </div>
            <h1 className="page-title">Create Your Farm</h1>
          </div>
          <p className="text-gray-500 ml-[52px]">
            Set up your farm details and draw the boundary on the map. You'll configure zones and crops in the next step.
          </p>
          {user && (
            <div className="ml-[52px] mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              <UserIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>Owner account: <strong>{user.name}</strong> ({user.email})</span>
            </div>
          )}
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
                        setMapCenter([preset.lat, preset.lng]);
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

          {/* Farm Boundary — replaces the old Coordinates section */}
          <div className="card">
            <h2 className="section-title flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-farm-green" />
              Farm Boundary
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Click points on the map to define your farm's boundary. You need at least 3 points to create a valid polygon.
              Markers are draggable — adjust positions after placing.
            </p>

            <BoundaryMapPicker
              points={boundaryPoints}
              onPointsChange={(pts) => {
                setBoundaryPoints(pts);
                if (errors.boundary) {
                  setErrors((prev) => ({ ...prev, boundary: undefined }));
                }
              }}
              locationQuery={form.location}
              enteredAreaAcres={form.area}
              initialCenter={mapCenter}
              onLocationFound={(placeName, coords) => {
                updateField('location', placeName);
                updateField('latitude', coords[0]);
                updateField('longitude', coords[1]);
                setMapCenter(coords);
              }}
              onLocationDetailsChange={(details) => {
                updateField('location', details.formattedLocation);
                updateField('latitude', details.latitude);
                updateField('longitude', details.longitude);
                setMapCenter([details.latitude, details.longitude]);
              }}
            />

            {errors.boundary && (
              <p className="text-sm text-red-500 mt-2">{errors.boundary}</p>
            )}
          </div>

          {/* Preview Summary */}
          <div className="bg-farm-green-pale/50 rounded-2xl p-5 border border-farm-green/10">
            <h3 className="text-sm font-semibold text-farm-green mb-3">Farm Summary</h3>
            <div className={`grid ${boundaryPoints.length >= 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-4 text-center`}>
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
              {boundaryPoints.length >= 3 && mappedArea && (
                <div>
                  <p className="text-2xl font-bold text-farm-green">{mappedArea.acres}</p>
                  <p className="text-xs text-farm-green/70">mapped acres</p>
                </div>
              )}
            </div>
            {boundaryPoints.length >= 3 && (
              <div className="mt-3 pt-3 border-t border-farm-green/10 text-xs text-farm-green/70 text-center">
                Boundary: {boundaryPoints.length} points defined on map
              </div>
            )}
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
