import { Link, useNavigate } from 'react-router-dom';
import {
  Sprout, ArrowRight, Cloud, Droplets, Sun, BarChart3,
  Wheat, Leaf, LineChart, FlaskConical, Zap, ShieldCheck,
  Compass, MapPin, Layers, LogIn, CheckCircle2, Play, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const features = [
    {
      icon: Leaf,
      title: 'Geospatial Field Mapping',
      description: 'Mark your farm perimeter on interactive satellite maps, divide land into zones, and assign crop varieties.',
    },
    {
      icon: FlaskConical,
      title: 'Predictive What-If Scenarios',
      description: 'Simulate severe drought, heatwaves, heavy downpours, and pest outbreaks before planting a single seed.',
    },
    {
      icon: LineChart,
      title: 'AI Crop & Yield Analytics',
      description: 'Machine learning models forecast seasonal yield, water stress curves, and harvest efficiency day-by-day.',
    },
    {
      icon: ShieldCheck,
      title: 'Real-Time Risk Mitigation',
      description: 'Detect fungal disease vulnerability and irrigation deficit alerts proactively with meteorological feeds.',
    },
  ];

  const steps = [
    {
      step: '01',
      title: 'Register & Create Your Farm',
      description: 'Sign up in seconds and sketch your farm boundary directly on the interactive satellite GIS map.',
    },
    {
      step: '02',
      title: 'Configure Crops & Soil Zones',
      description: 'Split your farm into designated plots with customized soil types (alluvial, black, loamy) and irrigation methods.',
    },
    {
      step: '03',
      title: 'Run AI Weather Simulations',
      description: 'Inject historical weather data or extreme climate stress scenarios to see how your crops respond.',
    },
    {
      step: '04',
      title: 'Harvest Intelligent Insights',
      description: 'Compare scenario outcomes side-by-side to optimize water consumption, fertilizer budgets, and total yield.',
    },
  ];

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* PUBLIC TOP NAVBAR */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-farm-green flex items-center justify-center shadow-md">
              <Sprout className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-xl text-gray-900">
              FarmSim <span className="text-farm-green">AI</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-farm-green transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-farm-green transition-colors">How It Works</a>
            <a href="#digital-twin" className="hover:text-farm-green transition-colors">Digital Twin</a>
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="btn-primary inline-flex items-center gap-2 text-sm shadow-xs"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-semibold text-gray-700 hover:text-farm-green px-3 py-2 rounded-xl transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/login?mode=signup"
                  className="btn-primary inline-flex items-center gap-1.5 text-sm shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-br from-farm-green via-farm-green-light to-emerald-600 text-white py-20 sm:py-32">
        {/* Ambient background icons */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
          <Cloud className="absolute top-16 left-10 w-32 h-32" />
          <Sun className="absolute top-12 right-24 w-28 h-28" />
          <Droplets className="absolute bottom-16 left-1/4 w-24 h-24" />
          <Wheat className="absolute bottom-12 right-12 w-32 h-32" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/95 text-xs font-semibold uppercase tracking-wider mb-8">
            <Zap className="w-3.5 h-3.5 text-yellow-300" />
            AI-Powered Agricultural Digital Twin
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-6">
            Grow Smarter, Simulate Deeper,{' '}
            <span className="text-yellow-200">Harvest Higher</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/85 max-w-2xl mx-auto mb-10 leading-relaxed">
            Plan your farmland, draw custom field boundaries, and simulate weather stress scenarios with predictive AI — all before planting a single seed.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-farm-green font-bold py-3.5 px-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-[1.02] text-lg"
              >
                <Compass className="w-5 h-5" />
                Open Farmer Dashboard
                <ArrowRight className="w-5 h-5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login?mode=signup"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-farm-green font-bold py-3.5 px-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-[1.02] text-lg"
                >
                  <Sprout className="w-5 h-5" />
                  Get Started Free
                  <ArrowRight className="w-5 h-5" />
                </Link>

                <Link
                  to="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur-md border border-white/30 text-white font-semibold py-3.5 px-8 rounded-2xl hover:bg-white/20 transition-all duration-200 text-lg"
                >
                  <LogIn className="w-5 h-5 text-yellow-300" />
                  Farmer Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="py-20 bg-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-farm-green uppercase tracking-wider bg-farm-green-pale px-3 py-1 rounded-full">
              Enterprise Farming Capabilities
            </span>
            <h2 className="text-3xl font-extrabold text-gray-900 mt-3 mb-4">
              Everything Needed to Modernize Farm Planning
            </h2>
            <p className="text-gray-500 text-sm sm:text-base leading-relaxed">
              Eliminate guesswork with multi-layer geospatial zoning, live meteorological forecasts, and scenario stress testing.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div key={i} className="card text-center hover:border-farm-green/40 hover:shadow-md transition-all duration-200">
                  <div className="w-14 h-14 rounded-2xl bg-farm-green-pale flex items-center justify-center mx-auto mb-4 text-farm-green">
                    <Icon className="w-7 h-7" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-base mb-2">{feature.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section id="how-it-works" className="py-20 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-farm-green uppercase tracking-wider bg-farm-green-pale px-3 py-1 rounded-full">
              Streamlined Workflow
            </span>
            <h2 className="text-3xl font-extrabold text-gray-900 mt-3 mb-4">
              How FarmSim AI Works
            </h2>
            <p className="text-gray-500 text-sm sm:text-base leading-relaxed">
              From map boundary creation to AI harvest yields in four easy steps.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((item, index) => (
              <div key={index} className="relative p-6 rounded-2xl bg-stone-50 border border-gray-100">
                <div className="text-3xl font-black text-farm-green/30 mb-3">{item.step}</div>
                <h3 className="font-bold text-gray-900 text-base mb-2">{item.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DIGITAL TWIN HIGHLIGHT */}
      <section id="digital-twin" className="py-20 bg-stone-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-4">
                <Sparkles className="w-3.5 h-3.5" /> Satellite GIS Technology
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-4">
                Your Entire Farm, Digitized in Real-Time
              </h2>
              <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-6">
                Define farm perimeters using GPS coordinates or sketch custom polygons directly with your mouse. Monitor soil moisture gradients, temperature heatmaps, and crop vegetative stages across all fields.
              </p>

              <div className="space-y-3 mb-8">
                {[
                  'Drag-and-drop polygon boundary manipulation with live acre calculation',
                  'Individual plot stress states: healthy, drought, flooded, and disease risk',
                  'Predictive daily water consumption models and yield curves',
                ].map((pt, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-farm-green flex-shrink-0 mt-0.5" />
                    <span>{pt}</span>
                  </div>
                ))}
              </div>

              <Link
                to={isAuthenticated ? "/dashboard" : "/login?mode=signup"}
                className="btn-primary inline-flex items-center gap-2 text-sm"
              >
                {isAuthenticated ? "Launch Your Digital Twin" : "Start Mapping Today"}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-stone-800 p-6 rounded-3xl border border-stone-700 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-stone-700 pb-3 mb-4 text-xs">
                <span className="font-bold text-gray-300 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-farm-green" /> Digital Twin Preview
                </span>
                <span className="text-emerald-400 font-semibold bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-800">
                  Simulation Ready
                </span>
              </div>
              <div className="space-y-3 text-xs">
                <div className="bg-stone-900/80 p-3.5 rounded-xl border border-stone-700 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-white">Wheat & Rice Rotation</div>
                    <div className="text-[11px] text-gray-400">12.4 Acres • 4 Active Zones</div>
                  </div>
                  <span className="text-farm-green font-bold">Optimal Yield</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-stone-900/60 p-2.5 rounded-xl border border-stone-700">
                    <div className="text-emerald-400 font-bold text-base">92%</div>
                    <div className="text-[10px] text-gray-400">Crop Health</div>
                  </div>
                  <div className="bg-stone-900/60 p-2.5 rounded-xl border border-stone-700">
                    <div className="text-blue-400 font-bold text-base">58%</div>
                    <div className="text-[10px] text-gray-400">Soil Moisture</div>
                  </div>
                  <div className="bg-stone-900/60 p-2.5 rounded-xl border border-stone-700">
                    <div className="text-amber-400 font-bold text-base">14%</div>
                    <div className="text-[10px] text-gray-400">Stress Risk</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="py-16 bg-white border-t border-gray-100 text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">
            Ready to Take Control of Your Farmland?
          </h2>
          <p className="text-gray-500 text-sm max-w-xl mx-auto mb-8">
            Create an account in less than a minute. Simulate crop scenarios, plan field irrigation, and harvest with certainty.
          </p>
          <Link
            to={isAuthenticated ? "/dashboard" : "/login?mode=signup"}
            className="btn-primary inline-flex items-center gap-2 py-3 px-8 text-base shadow-md"
          >
            {isAuthenticated ? "Go to Dashboard" : "Create Farmer Account"}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-400 py-8 mt-auto border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs space-y-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sprout className="w-5 h-5 text-farm-green" />
            <span className="font-bold text-white text-sm">
              FarmSim <span className="text-farm-green">AI</span>
            </span>
          </div>
          <p>Precision Agricultural Simulator & Digital Twin Platform</p>
          <p className="text-gray-500">© {new Date().getFullYear()} FarmSim AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
