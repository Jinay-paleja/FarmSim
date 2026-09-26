import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Tractor, Plus, MapPin, ArrowRight, Trash2, Layers,
  Search, Sprout, BarChart3, Compass
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useFarmContext } from '../context/FarmContext';

export default function MyFarmsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { farms, selectFarm, deleteFarm, loadingFarms } = useFarmContext();
  const [search, setSearch] = useState('');

  const filteredFarms = farms.filter((f) => {
    const q = search.toLowerCase();
    return f.name.toLowerCase().includes(q) || f.location.toLowerCase().includes(q);
  });

  return (
    <div className="page-container py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-farm-green-pale text-farm-green text-xs font-bold uppercase tracking-wider mb-2">
            <Compass className="w-3.5 h-3.5" /> Farmer Portfolio
          </div>
          <h1 className="page-title">My Farms</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage your digital farm twins, inspect field zoning, and launch geospatial map builders.
          </p>
        </div>

        <Link
          to="/farms/create"
          className="btn-primary inline-flex items-center gap-2 self-start sm:self-auto shadow-md"
        >
          <Plus className="w-4 h-4" />
          Create New Farm
        </Link>
      </div>

      {/* Search Bar */}
      {farms.length > 0 && (
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search farms by name or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10 py-2.5 text-sm"
          />
        </div>
      )}

      {/* Grid of Farms */}
      {!loadingFarms && filteredFarms.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFarms.map((farm) => (
            <div
              key={farm.id}
              onClick={() => {
                selectFarm(farm.id);
                navigate(`/farms/${farm.id}`);
              }}
              className="card group hover:border-farm-green hover:shadow-xl transition-all duration-200 cursor-pointer border border-gray-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-farm-green-pale flex items-center justify-center text-xl shadow-xs group-hover:scale-105 transition-transform">
                    🌾
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Are you sure you want to delete "${farm.name}"?`)) {
                          deleteFarm(farm.id);
                          toast.success(`Deleted ${farm.name}`);
                        }
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      title={`Delete ${farm.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold text-farm-green bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1 group-hover:bg-farm-green group-hover:text-white transition-colors">
                      Open <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>

                <h3 className="font-bold text-lg text-gray-900 group-hover:text-farm-green transition-colors">
                  {farm.name}
                </h3>
                <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  {farm.location}
                </p>

                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-100 text-xs">
                  <div className="bg-stone-50 p-2.5 rounded-xl">
                    <span className="text-gray-400 block font-medium">Total Area</span>
                    <span className="font-extrabold text-gray-800 text-sm">{farm.area} acres</span>
                  </div>
                  <div className="bg-stone-50 p-2.5 rounded-xl">
                    <span className="text-gray-400 block font-medium">Fields</span>
                    <span className="font-extrabold text-gray-800 text-sm">{farm.zones.length} plots</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 flex items-center justify-between text-xs text-gray-400 border-t border-gray-50">
                <Link
                  to={`/farms/${farm.id}/builder`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 hover:text-farm-green font-semibold"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Map Builder
                </Link>
                <span className="font-semibold text-farm-green group-hover:underline">
                  Dashboard →
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : farms.length === 0 ? (
        <div className="card text-center py-16 border-dashed border-2 border-gray-200">
          <Sprout className="w-14 h-14 text-farm-green mx-auto mb-3 opacity-60" />
          <h2 className="font-bold text-gray-900 text-xl">No farms registered yet</h2>
          <p className="text-gray-500 text-sm max-w-sm mx-auto mt-2 mb-6">
            Welcome to FarmSim AI, {user?.name}! Start by drawing your farm boundary and designating field zones.
          </p>
          <Link to="/farms/create" className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create Your First Farm
          </Link>
        </div>
      ) : (
        <div className="card text-center py-12 text-gray-500 text-sm">
          No farms matched "{search}".
        </div>
      )}
    </div>
  );
}
