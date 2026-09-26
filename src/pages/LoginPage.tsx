import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Sprout, User as UserIcon, Mail, Lock, MapPin, ArrowRight,
  ShieldCheck, CheckCircle2, Sparkles, Tractor, Compass, LogIn
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth, DEMO_FARMERS } from '../context/AuthContext';
import { useFarmContext } from '../context/FarmContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, signup, demoLogin, availableDemoFarmers } = useAuth();
  const { farms, allFarms } = useFarmContext();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [farmRegion, setFarmRegion] = useState('');
  const [specialty, setSpecialty] = useState('');

  const redirectPath = (location.state as any)?.from?.pathname || '/';

  const handleDemoSelect = (farmerId: string) => {
    demoLogin(farmerId);
    const demo = DEMO_FARMERS.find((f) => f.id === farmerId);
    toast.success(`Welcome back, ${demo?.name}!`, { icon: '🌾' });

    // Find first farm owned by this demo farmer
    const farmerFarm = allFarms.find((f) => f.ownerId === farmerId);
    if (farmerFarm) {
      navigate(`/farms/${farmerFarm.id}`);
    } else {
      navigate('/');
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      toast.success('Signed in successfully!');
      navigate(redirectPath);
    } catch (err: any) {
      toast.error(err?.message || 'Invalid email or password. Please check your credentials or register.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    if (!email.trim()) {
      toast.error('Please enter your email');
      return;
    }

    setLoading(true);
    try {
      const newUser = await signup({
        name,
        email,
        password,
        location: farmRegion || 'Custom Agricultural Region',
        specialty: specialty || 'Crop & Soil Management',
      });
      toast.success(`Account created for ${newUser.name}! Let's build your first farm.`);
      navigate('/farms/create');
    } catch (err: any) {
      toast.error(err?.message || 'Account creation failed.');
    } finally {
      setLoading(false);
    }
  };

  const hasDemoAccounts = availableDemoFarmers.length > 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-stone-50 py-10 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className={`w-full ${hasDemoAccounts ? 'max-w-4xl grid md:grid-cols-12 gap-8 items-center' : 'max-w-md mx-auto space-y-6'}`}>
        {/* Left Side: Context & Demo Accounts (when enabled) */}
        {hasDemoAccounts && (
          <div className="md:col-span-5 space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-farm-green-pale text-farm-green text-xs font-bold uppercase tracking-wider mb-3">
                <Tractor className="w-3.5 h-3.5" /> Farmer Portal
              </div>
              <h1 className="text-3xl font-extrabold text-gray-900 leading-tight">
                Manage Your Digital Twin Farms
              </h1>
              <p className="text-sm text-gray-600 mt-2">
                Every farmer has isolated access to their farm boundaries, satellite field zones, live weather intelligence, and AI scenario simulations.
              </p>
            </div>

            {/* Quick Demo Logins */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> 1-Click Demo Farmers
                </div>
                <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">Instant Access</span>
              </div>
              <p className="text-xs text-gray-500">
                Test multi-user isolation right away with pre-configured regional farms:
              </p>

              <div className="space-y-2.5 pt-1">
                {availableDemoFarmers.map((farmer) => {
                  const isSelected = user?.id === farmer.id;
                  return (
                    <button
                      key={farmer.id}
                      type="button"
                      onClick={() => handleDemoSelect(farmer.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group cursor-pointer ${
                        isSelected
                          ? 'border-farm-green bg-farm-green-pale/40 shadow-xs'
                          : 'border-gray-100 hover:border-gray-300 hover:bg-stone-50 bg-white'
                      }`}
                    >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-farm-green-pale flex items-center justify-center text-xl flex-shrink-0">
                        {farmer.avatarEmoji}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-900 group-hover:text-farm-green transition-colors flex items-center gap-1.5">
                          {farmer.name}
                          {isSelected && <span className="text-[9px] bg-farm-green text-white px-1.5 py-0.2 rounded-full font-semibold">Active</span>}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">{farmer.location}</div>
                        <div className="text-[10px] text-gray-400 truncate">{farmer.specialty}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-farm-green group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Privacy & Isolation Feature list */}
          <div className="space-y-2 text-xs text-gray-500 pt-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-farm-green flex-shrink-0" />
              <span>Independent field boundaries and acreage calculation</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-farm-green flex-shrink-0" />
              <span>Dedicated Open-Meteo microclimate forecasting</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-farm-green flex-shrink-0" />
              <span>Private Random Forest yield & stress simulations</span>
            </div>
          </div>
        </div>
        )}

        {/* Right Side / Centered: Auth Box */}
        <div className={hasDemoAccounts ? "md:col-span-7" : "w-full"}>
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden">
            {/* Header Tabs */}
            <div className="grid grid-cols-2 border-b border-gray-100 bg-stone-50/60 p-1.5 gap-1">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-white text-farm-green shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Sign In to Account
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white text-farm-green shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Create New Farmer Account
              </button>
            </div>

            <div className="p-6 sm:p-8">
              {mode === 'signin' ? (
                /* SIGN IN FORM */
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Welcome Back</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Enter your farmer email credentials to access your properties.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Farmer Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. harpreet.singh@farm.ai or your email"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green/30 focus:border-farm-green"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-gray-700">
                        Password
                      </label>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green/30 focus:border-farm-green"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-farm-green hover:bg-farm-green-dark text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    <LogIn className="w-4 h-4" />
                    {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
                  </button>

                  <div className="pt-2 text-center text-xs text-gray-500">
                    Need a new farm profile?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('signup')}
                      className="text-farm-green font-bold hover:underline cursor-pointer"
                    >
                      Register here
                    </button>
                  </div>
                </form>
              ) : (
                /* SIGN UP FORM */
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Create Farmer Account</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Register to build and simulate your own independent farm portfolio.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Farmer Full Name *
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Ramesh Patel"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green/30 focus:border-farm-green"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ramesh.patel@agri.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green/30 focus:border-farm-green"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Location / Region
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={farmRegion}
                          onChange={(e) => setFarmRegion(e.target.value)}
                          placeholder="e.g. Surat, Gujarat"
                          className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-farm-green/30 focus:border-farm-green"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Primary Crops / Specialty
                      </label>
                      <div className="relative">
                        <Sprout className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={specialty}
                          onChange={(e) => setSpecialty(e.target.value)}
                          placeholder="e.g. Cotton & Sugarcane"
                          className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-farm-green/30 focus:border-farm-green"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Password *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green/30 focus:border-farm-green"
                        minLength={6}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-farm-green hover:bg-farm-green-dark text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    <Sprout className="w-4 h-4" />
                    {loading ? 'Creating Profile...' : 'Complete Registration & Start Farm'}
                  </button>

                  <div className="pt-2 text-center text-xs text-gray-500">
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('signin')}
                      className="text-farm-green font-bold hover:underline cursor-pointer"
                    >
                      Sign in here
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Currently Active Farmer indicator */}
            {user && (
              <div className="bg-stone-50 border-t border-gray-100 p-4 px-6 flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Currently logged in: <strong className="text-gray-900">{user.name}</strong> ({farms.length} farm{farms.length !== 1 ? 's' : ''})</span>
                </div>
                <Link
                  to="/"
                  className="text-farm-green font-bold hover:underline flex items-center gap-1"
                >
                  Go to App <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
