import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Sprout, Home, Plus, BarChart3, GitCompare, Menu, X, ChevronDown, Check,
  MapPin, Tractor, User as UserIcon, LogOut, LogIn, Sparkles, Compass, LineChart, Layers
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useFarmContext } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [farmDropdownOpen, setFarmDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const { user, farmerProfile, logout, isAuthenticated } = useAuth();
  const { farms, selectedFarm, selectFarm } = useFarmContext();

  // Extract farmId from URL if present
  const farmIdMatch = location.pathname.match(/\/farms\/([^/]+)/);
  const rawFarmId = farmIdMatch?.[1];
  const farmId = rawFarmId && rawFarmId !== 'create' && rawFarmId !== 'undefined' && rawFarmId !== 'null' ? rawFarmId : undefined;

  // Sync selected farm if URL has farmId
  useEffect(() => {
    if (farmId && farmId !== selectedFarm?.id) {
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
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setFarmDropdownOpen(false);
    setUserDropdownOpen(false);
  }, [location.pathname]);

  const activeFarmId = (selectedFarm?.id && selectedFarm.id !== 'undefined' && selectedFarm.id !== 'null')
    ? selectedFarm.id
    : (farmId || (farms.length > 0 && farms[0].id && farms[0].id !== 'undefined' ? farms[0].id : undefined));

  const farmMapLink = activeFarmId ? `/farms/${activeFarmId}/builder` : (farms.length > 0 ? `/farms/${farms[0].id}/builder` : '/farms/create');
  const simulationsLink = activeFarmId ? `/farms/${activeFarmId}/scenarios/new` : (farms.length > 0 ? `/farms/${farms[0].id}/scenarios/new` : '/farms/create');
  const analyticsLink = activeFarmId ? `/farms/${activeFarmId}` : '/farms';
  const compareLink = activeFarmId ? `/farms/${activeFarmId}/compare` : '/farms';

  // Authenticated Navigation Items
  const authNavItems = [
    { to: '/dashboard', icon: BarChart3, label: 'Dashboard' },
    { to: '/farms', icon: Tractor, label: 'My Farms' },
    { to: farmMapLink, icon: Layers, label: 'Farm Map' },
    { to: simulationsLink, icon: Sprout, label: 'Simulations' },
    { to: analyticsLink, icon: LineChart, label: 'Analytics' },
    { to: compareLink, icon: GitCompare, label: 'Compare' },
  ];

  // Public Navigation Items
  const publicNavItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/#features', icon: Sparkles, label: 'Features' },
    { to: '/#how-it-works', icon: Compass, label: 'How It Works' },
  ];

  const currentNavItems = isAuthenticated ? authNavItems : publicNavItems;

  const handleLogout = () => {
    logout();
    setUserDropdownOpen(false);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-4">
              <Link to={isAuthenticated ? "/dashboard" : "/"} className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 rounded-xl bg-farm-green flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <Sprout className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl text-gray-900 hidden sm:block">
                  FarmSim <span className="text-farm-green">AI</span>
                </span>
              </Link>

              {/* FARM SELECTOR DROPDOWN (ONLY AUTHENTICATED WITH FARMS) */}
              {isAuthenticated && farms.length > 0 && (
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
                        {user?.name}'s Farms ({farms.length})
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

            {/* Desktop Nav + Farmer Profile / Auth Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <nav className="flex items-center gap-1">
                {currentNavItems.map((item) => {
                  const Icon = item.icon;
                  const isItemActive = (() => {
                    const path = location.pathname;
                    if (item.label === 'Dashboard') return path === '/dashboard';
                    if (item.label === 'My Farms') return path === '/farms' || path === '/farms/create';
                    if (item.label === 'Farm Map') return path.includes('/builder');
                    if (item.label === 'Simulations') return path.includes('/scenario') || path.includes('/simulation') || path.includes('/results');
                    if (item.label === 'Analytics') return path.match(/^\/farms\/[^/]+$/) !== null;
                    if (item.label === 'Compare') return path.includes('/compare') || path.includes('/comparison');
                    return path === item.to;
                  })();
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                        isItemActive
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

              <div className="h-6 w-px bg-gray-200 mx-1" />

              {/* AUTHENTICATED: FARMER ACCOUNT DROPDOWN */}
              {isAuthenticated && user ? (
                <div className="relative" ref={userDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:border-farm-green/50 bg-stone-50 hover:bg-stone-100 transition-all text-left shadow-xs cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-farm-green-pale flex items-center justify-center text-sm font-bold text-farm-green">
                      {farmerProfile?.avatarEmoji || user.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-gray-900 truncate max-w-[110px]">
                        {user.name}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate max-w-[110px]">
                        {farms.length} farm{farms.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {userDropdownOpen && (
                    <div className="absolute top-full right-0 mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 z-[999] animate-fadeIn">
                      {/* Farmer Info */}
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-farm-green-pale flex items-center justify-center text-lg">
                            {farmerProfile?.avatarEmoji || '🧑‍🌾'}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-gray-900 truncate">{user.name}</div>
                            <div className="text-[11px] text-gray-500 truncate">{user.email}</div>
                            {user.location && (
                              <div className="text-[10px] text-gray-400 truncate flex items-center gap-1 mt-0.5">
                                <MapPin className="w-2.5 h-2.5" /> {user.location}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quick Links */}
                      <div className="py-1 px-2 space-y-0.5">
                        <Link
                          to="/dashboard"
                          onClick={() => setUserDropdownOpen(false)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-stone-50 rounded-xl transition-colors"
                        >
                          <BarChart3 className="w-3.5 h-3.5 text-gray-400" />
                          Dashboard Overview
                        </Link>
                        <Link
                          to="/farms"
                          onClick={() => setUserDropdownOpen(false)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-stone-50 rounded-xl transition-colors"
                        >
                          <Tractor className="w-3.5 h-3.5 text-gray-400" />
                          My Farms ({farms.length})
                        </Link>
                        <Link
                          to="/farms/create"
                          onClick={() => setUserDropdownOpen(false)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-farm-green hover:bg-farm-green-pale/50 rounded-xl transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Create New Farm
                        </Link>
                      </div>

                      {/* Logout Action */}
                      <div className="border-t border-gray-100 mt-1 pt-1 px-2">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Log Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* UNAUTHENTICATED: LOGIN & SIGN UP BUTTONS */
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="text-xs font-bold text-gray-700 hover:text-farm-green px-3 py-2 rounded-xl transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/login?mode=signup"
                    className="flex items-center gap-1.5 bg-farm-green hover:bg-farm-green-dark text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all"
                  >
                    <LogIn className="w-3.5 h-3.5" /> Get Started
                  </Link>
                </div>
              )}
            </div>

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
          <div className="md:hidden border-t border-gray-100 bg-white p-4 space-y-2">
            {isAuthenticated && user && (
              <div className="p-3 mb-2 rounded-xl bg-stone-50 border border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="text-xl">{farmerProfile?.avatarEmoji || '🧑‍🌾'}</div>
                  <div>
                    <div className="text-xs font-bold text-gray-900">{user.name}</div>
                    <div className="text-[10px] text-gray-500">{farms.length} farm{farms.length !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs text-red-600 font-bold hover:underline"
                >
                  Log Out
                </button>
              </div>
            )}

            <div className="space-y-1">
              {currentNavItems.map((item) => {
                const Icon = item.icon;
                const isItemActive = (() => {
                  const path = location.pathname;
                  if (item.label === 'Dashboard') return path === '/dashboard';
                  if (item.label === 'My Farms') return path === '/farms' || path === '/farms/create';
                  if (item.label === 'Farm Map') return path.includes('/builder');
                  if (item.label === 'Simulations') return path.includes('/scenario') || path.includes('/simulation') || path.includes('/results');
                  if (item.label === 'Analytics') return path.match(/^\/farms\/[^/]+$/) !== null;
                  if (item.label === 'Compare') return path.includes('/compare') || path.includes('/comparison');
                  return path === item.to;
                })();
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isItemActive
                        ? 'bg-farm-green-pale text-farm-green font-bold'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}

              {!isAuthenticated && (
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <Link
                    to="/login"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-700 bg-stone-100"
                  >
                    <LogIn className="w-4 h-4" /> Sign In
                  </Link>
                  <Link
                    to="/login?mode=signup"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-farm-green"
                  >
                    <Sparkles className="w-4 h-4" /> Get Started Free
                  </Link>
                </div>
              )}
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
