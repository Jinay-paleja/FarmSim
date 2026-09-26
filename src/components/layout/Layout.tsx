import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Sprout, Home, Plus, BarChart3, GitCompare, Menu, X, ChevronDown, Check, MapPin, Tractor } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useFarmContext } from '../../context/FarmContext';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [farmDropdownOpen, setFarmDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { farms, selectedFarm, selectFarm } = useFarmContext();

  // Extract farmId from URL if present
  const farmIdMatch = location.pathname.match(/\/farms\/([^/]+)/);
  const farmId = farmIdMatch?.[1];

  // Sync selected farm if URL has farmId
  useEffect(() => {
    if (farmId && farmId !== 'create' && farmId !== selectedFarm?.id) {
      const match = farms.find((f) => f.id === farmId);
      if (match) selectFarm(match.id);
    }
  }, [farmId, farms, selectFarm, selectedFarm]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFarmDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setFarmDropdownOpen(false);
  }, [location.pathname]);

  const activeFarmId = selectedFarm?.id || (farmId !== 'create' ? farmId : undefined);

  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/farms/create', icon: Plus, label: 'New Farm' },
    ...(activeFarmId
      ? [
          { to: `/farms/${activeFarmId}`, icon: BarChart3, label: 'Dashboard' },
          { to: `/farms/${activeFarmId}/scenarios/new`, icon: Sprout, label: 'Scenarios' },
          { to: `/farms/${activeFarmId}/compare`, icon: GitCompare, label: 'Compare' },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 rounded-xl bg-farm-green flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <Sprout className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl text-gray-900 hidden sm:block">
                  FarmSim <span className="text-farm-green">AI</span>
                </span>
              </Link>

              {/* PROMINENT FARM SELECTOR DROPDOWN */}
              {farms.length > 0 && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setFarmDropdownOpen(!farmDropdownOpen)}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:border-farm-green/50 bg-stone-50 hover:bg-stone-100 transition-all text-left shadow-xs cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-farm-green-pale flex items-center justify-center text-farm-green">
                      <Tractor className="w-4 h-4" />
                    </div>
                    <div className="hidden sm:block text-left">
                      <div className="text-xs font-bold text-gray-900 truncate max-w-[140px] md:max-w-[180px]">
                        {selectedFarm?.name || 'Select Farm'}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate max-w-[140px]">
                        {selectedFarm ? `${selectedFarm.area} acres • ${selectedFarm.zones.length} fields` : 'Portfolio'}
                      </div>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${farmDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {farmDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-72 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 z-[999] animate-fadeIn">
                      <div className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100">
                        Switch Active Farm
                      </div>
                      <div className="max-h-64 overflow-y-auto py-1">
                        {farms.map((f) => {
                          const isCurrent = f.id === selectedFarm?.id;
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => {
                                selectFarm(f.id);
                                setFarmDropdownOpen(false);
                                navigate(`/farms/${f.id}`);
                              }}
                              className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between transition-colors cursor-pointer ${
                                isCurrent
                                  ? 'bg-farm-green-pale/50 text-farm-green font-bold'
                                  : 'hover:bg-gray-50 text-gray-800'
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="text-xs font-bold truncate">{f.name}</div>
                                <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                                  <span>{f.area} acres</span>
                                  <span>•</span>
                                  <span>{f.zones.length} fields</span>
                                  <span>•</span>
                                  <span className="truncate">{f.location}</span>
                                </div>
                              </div>
                              {isCurrent && <Check className="w-4 h-4 text-farm-green flex-shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                      <div className="border-t border-gray-100 pt-1.5 px-2">
                        <Link
                          to="/farms/create"
                          onClick={() => setFarmDropdownOpen(false)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-farm-green hover:bg-farm-green-pale/40 rounded-xl transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add New Farm
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-farm-green-pale text-farm-green font-bold'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-gray-600 hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-farm-green-pale text-farm-green'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
