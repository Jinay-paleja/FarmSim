import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Save, Plus, ArrowRight, Layers, Loader2, Sprout,
  Compass, Trash2, ArrowLeft, Play
} from 'lucide-react';
import toast from 'react-hot-toast';
import { farmApi } from '../services/api';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ErrorDisplay from '../components/shared/ErrorDisplay';
import VirtualFarmWorkspace from '../components/virtual/VirtualFarmWorkspace';
import { useFarmContext } from '../context/FarmContext';
import type { Farm, Zone, ZoneInput } from '../types';

export default function FarmBuilderPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { updateFarmInState, selectFarm, deleteFarm, selectedFarm, farms, loadingFarms } = useFarmContext();

  const [farm, setFarm] = useState<Farm | null>(null);
  const [zones, setZones] = useState<ZoneInput[]>([]);
  const [selectedZoneIndex, setSelectedZoneIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!farmId || farmId === 'undefined' || farmId === 'null') {
      if (selectedFarm?.id && selectedFarm.id !== 'undefined') {
        navigate(`/farms/${selectedFarm.id}/builder`, { replace: true });
        return;
      }
      if (farms.length > 0 && farms[0].id && farms[0].id !== 'undefined') {
        navigate(`/farms/${farms[0].id}/builder`, { replace: true });
        return;
      }
      if (!loadingFarms) {
        setLoading(false);
      }
      return;
    }
    loadFarm();
  }, [farmId, selectedFarm, farms, loadingFarms, navigate]);

  const loadFarm = async () => {
    if (!farmId || farmId === 'undefined' || farmId === 'null') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const farmData = await farmApi.get(farmId);
      setFarm(farmData);
      setZones(farmData.zones || []);
      if (farmData.zones && farmData.zones.length > 0) {
        setSelectedZoneIndex(0);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load farm');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!farm) return;

    // Validate crops
    const missingCrop = zones.find((z) => !z.crop);
    if (missingCrop) {
      toast.error(`Please assign a crop for ${missingCrop.name || 'all plots'}`);
      return;
    }

    // Validate area
    const zeroArea = zones.find((z) => !z.area || Number(z.area) <= 0);
    if (zeroArea) {
      toast.error(`Field ${zeroArea.name} must have an area greater than 0 acres`);
      return;
    }

    setSaving(true);
    try {
      const updatedFarm: Farm = {
        ...farm,
        zones: zones.map((z, i) => ({
          ...z,
          id: z.id || (farm.zones && farm.zones[i]?.id) || `zone_${farm.id}_${i + 1}`,
          farmId: farm.id,
          area: Number(z.area),
        })) as Zone[],
      };

      const saved = await farmApi.update(farm.id, updatedFarm);
      setFarm(saved);
      updateFarmInState(saved);
      toast.success('Farm workspace saved successfully!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save farm configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFarm = async () => {
    if (!farm) return;
    if (!window.confirm(`Are you sure you want to delete "${farm.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteFarm(farm.id);
      toast.success(`Deleted farm "${farm.name}"`);
      navigate('/dashboard');
    } catch {
      toast.error('Failed to delete farm');
    }
  };

  if (loading) return <LoadingSpinner message="Loading Virtual Farm Workspace..." fullPage />;
  if (error) return <ErrorDisplay message={error} onRetry={loadFarm} />;

  if (!farm) {
    return (
      <div className="page-container py-16 text-center">
        <div className="card max-w-md mx-auto p-8 border-dashed border-2">
          <Sprout className="w-12 h-12 text-farm-green mx-auto mb-3 opacity-60" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Farm Selected</h2>
          <p className="text-gray-500 text-sm mb-6">
            Please create a digital farm to access the Virtual Farm Workspace.
          </p>
          <Link to="/farms/create" className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create Farm
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container py-8 space-y-6">
      {/* Top Header & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate(`/farms/${farm.id}`)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-2 cursor-pointer font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-farm-green-pale flex items-center justify-center text-farm-green">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h1 className="page-title text-2xl font-black">{farm.name}</h1>
              <p className="text-gray-500 text-xs mt-0.5">
                Virtual Farm Workspace • Total: {farm.area} acres • {zones.length} field zones
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            to={`/farms/${farm.id}/scenarios/new`}
            className="btn-secondary flex items-center gap-2 text-xs py-2 px-3.5 shadow-xs"
          >
            <Play className="w-3.5 h-3.5 text-farm-green fill-current" />
            Run Simulation
          </Link>

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-2 shadow-md cursor-pointer"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Saving...' : 'Save Farm'}
          </button>

          <button
            type="button"
            onClick={handleDeleteFarm}
            className="px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Delete this farm permanently"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Main Virtual Farm Workspace */}
      <div className="card p-6 border border-gray-200 shadow-sm">
        <VirtualFarmWorkspace
          farmName={farm.name}
          totalArea={farm.area}
          zones={zones}
          onZonesChange={setZones}
          selectedZoneIndex={selectedZoneIndex}
          onSelectZone={setSelectedZoneIndex}
        />
      </div>
    </div>
  );
}
