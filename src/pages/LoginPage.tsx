import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link, useSearchParams } from 'react-router-dom';
import {
  Sprout, Mail, Lock, User as UserIcon, MapPin, ArrowRight,
  ShieldCheck, Loader2, Sparkles, CheckCircle2, Eye, EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { authService, DEMO_DEV_ACCOUNTS } from '../services/auth';

interface LoginPageProps {
  initialMode?: 'signin' | 'signup';
}

export default function LoginPage({ initialMode }: LoginPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, login, signup, demoLogin } = useAuth();

  const queryMode = searchParams.get('mode');
  const [mode, setMode] = useState<'signin' | 'signup'>(
    initialMode || (queryMode === 'signup' ? 'signup' : 'signin')
  );

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Form fields
  const [email, setEmail] = useState(() => authService.getRememberedEmail() || '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [farmRegion, setFarmRegion] = useState('');
  const [specialty, setSpecialty] = useState('');

  // Target redirect path after login
  const redirectPath = (location.state as any)?.from?.pathname || '/dashboard';

  // If already authenticated, redirect to /dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    if (!password.trim()) {
      toast.error('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      const success = await login({
        email,
        password,
        rememberMe,
      });

      if (success) {
        toast.success('Signed in successfully! Loading your dashboard...');
        navigate(redirectPath, { replace: true });
      } else {
        toast.error('Invalid credentials. Please verify your email and password.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    if (!password.trim()) {
      toast.error('Please enter a password');
      return;
    }

    setLoading(true);
    try {
      const newUser = await signup({
        name: name.trim(),
        email: email.trim(),
        password,
        location: farmRegion.trim() || 'Agricultural Region',
        specialty: specialty.trim() || 'Crop & Soil Management',
      });

      toast.success(`Welcome to FarmSim AI, ${newUser.name}!`);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      toast.error(err?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast('Please enter your email first to receive a password reset link', { icon: '✉️' });
    } else {
      toast.success(`Password reset simulation link sent to ${email}`);
    }
  };

  // Isolated development helper
  const handleDevQuickFill = async (farmerId: string) => {
    const demo = DEMO_DEV_ACCOUNTS.find((d) => d.id === farmerId);
    if (!demo) return;
    setLoading(true);
    try {
      await demoLogin(farmerId);
      toast.success(`Logged in as test farmer: ${demo.name}`, { icon: '🌾' });
      navigate(redirectPath, { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-6 group">
          <div className="w-12 h-12 rounded-2xl bg-farm-green flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <Sprout className="w-6 h-6 text-white" />
          </div>
          <span className="font-extrabold text-2xl text-gray-900 tracking-tight">
            FarmSim <span className="text-farm-green">AI</span>
          </span>
        </Link>

        <h2 className="text-center text-2xl font-bold text-gray-900">
          {mode === 'signin' ? 'Sign in to your farmer portal' : 'Register a new farmer account'}
        </h2>
        <p className="mt-2 text-center text-xs text-gray-500">
          {mode === 'signin' ? (
            <>
              New to FarmSim?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="font-bold text-farm-green hover:underline"
              >
                Create your account
              </button>
            </>
          ) : (
            <>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="font-bold text-farm-green hover:underline"
              >
                Sign in here
              </button>
            </>
          )}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="card shadow-lg border border-gray-200 p-6 sm:p-8">
          {mode === 'signin' ? (
            /* SIGN IN FORM */
            <form onSubmit={handleSignIn} className="space-y-5">
              <div>
                <label className="label">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="farmer@farm.ai"
                    className="input-field pl-10"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0">Password</label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-farm-green font-medium hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-gray-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-gray-300 text-farm-green focus:ring-farm-green/30"
                  />
                  <span>Remember me on this device</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-sm font-bold shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  <>
                    Sign In to FarmSim
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* SIGN UP FORM */
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="label">Full Name *</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Harpreet Singh"
                    className="input-field pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="label">Email Address *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="farmer@domain.com"
                    className="input-field pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="label">Password *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="input-field pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Farm Region / Location (Optional)</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={farmRegion}
                    onChange={(e) => setFarmRegion(e.target.value)}
                    placeholder="e.g. Ludhiana, Punjab or Fresno, CA"
                    className="input-field pl-10"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-sm font-bold shadow-md mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registering Account...
                  </>
                ) : (
                  <>
                    Create Account & Continue
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ISOLATED DEV TEST ACCOUNTS (ONLY FOR LOCAL DEVELOPMENT) */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Dev Quick-Fill Test Accounts:
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_DEV_ACCOUNTS.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => handleDevQuickFill(account.id)}
                  className="p-2 rounded-xl bg-stone-50 border border-gray-200 text-left hover:border-farm-green hover:bg-emerald-50/50 transition-all text-xs"
                >
                  <div className="text-base mb-0.5">{account.avatarEmoji}</div>
                  <div className="font-bold text-gray-800 truncate">{account.name.split(' ')[0]}</div>
                  <div className="text-[10px] text-gray-500 truncate">{account.location ? account.location.split(',')[0] : 'Region'}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
