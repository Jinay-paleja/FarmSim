import { Link, useNavigate } from 'react-router-dom';
import {
  Sprout, ArrowRight, Cloud, Droplets, Sun, BarChart3,
  Wheat, Leaf, LineChart, FlaskConical, Zap, ShieldCheck,
  Compass, MapPin, Layers
} from 'lucide-react';
import { useFarmContext } from '../context/FarmContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { farms, loadingFarms, selectFarm } = useFarmContext();

  const features = [
    {
      icon: Leaf,
      title: 'Smart Zone Planning',
      description: 'Divide your farm into zones, assign crops, and configure soil conditions for each area.',
    },
    {
      icon: FlaskConical,
      title: 'What-If Scenarios',
      description: 'Simulate drought, heatwaves, pest outbreaks, and more to prepare for any situation.',
    },
    {
      icon: LineChart,
      title: 'AI-Powered Insights',
      description: 'Get intelligent predictions about yield, crop health, and water usage over time.',
    },
    {
      icon: ShieldCheck,
      title: 'Risk Assessment',
      description: 'Understand disease risk and environmental stress before they impact your harvest.',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-farm-green via-farm-green-light to-emerald-600">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 opacity-10">
            <Cloud className="w-32 h-32 text-white animate-pulse-slow" />
          </div>
          <div className="absolute top-10 right-20 opacity-10">
            <Sun className="w-24 h-24 text-yellow-200 animate-pulse-slow" />
          </div>
          <div className="absolute bottom-20 left-1/3 opacity-10">
            <Droplets className="w-20 h-20 text-blue-200 animate-pulse-slow" />
          </div>
          <div className="absolute bottom-10 right-10 opacity-10">
            <Wheat className="w-28 h-28 text-yellow-200 animate-pulse-slow" />
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-sm font-medium mb-8">
              <Zap className="w-4 h-4" />
              AI-Powered Agriculture Simulator
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight">
              Grow Smarter,{' '}
              <span className="text-yellow-200">Not Harder</span>
            </h1>

            <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto mb-10 leading-relaxed">
              Plan your farm, simulate different scenarios, and get AI-powered insights
              to maximize yield and minimize risk — all before planting a single seed.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/farms/create"
                className="inline-flex items-center gap-2 bg-white text-farm-green font-bold py-3.5 px-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-[1.02] text-lg"
              >
                <Sprout className="w-5 h-5" />
                Create Your Farm
                <ArrowRight className="w-5 h-5" />
              </Link>

              <a
                href="#my-farms"
                className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/30 text-white font-semibold py-3.5 px-8 rounded-2xl hover:bg-white/20 transition-all duration-200"
              >
                <Compass className="w-5 h-5 text-yellow-300" />
                My Farms ({farms.length})
              </a>
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M0 80L48 74.7C96 69 192 59 288 53.3C384 48 480 48 576 53.3C672 59 768 69 864 69.3C960 69 1056 59 1152 53.3C1248 48 1344 48 1392 48L1440 48V80H1392C1344 80 1248 80 1152 80C1056 80 960 80 864 80C768 80 672 80 576 80C480 80 384 80 288 80C192 80 96 80 48 80H0Z"
              fill="#F5F5F4"
            />
          </svg>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything You Need to Plan Your Farm
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              From zone planning to yield prediction, FarmSim AI gives you the tools to make data-driven decisions.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={i}
                  className="card group hover:border-farm-green/20 text-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-farm-green-pale flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-7 h-7 text-farm-green" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* MY FARMS PORTFOLIO */}
      <section id="my-farms" className="py-20 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-farm-green-pale text-farm-green text-xs font-bold uppercase tracking-wider mb-2">
                <Compass className="w-3.5 h-3.5" /> Digital Twin Farm Management
              </div>
              <h2 className="text-3xl font-extrabold text-gray-900">My Farms</h2>
              <p className="text-gray-500 text-sm mt-1">
                Select an active farm to launch its interactive digital twin, view live weather, and run predictive crop simulations.
              </p>
            </div>
            <Link
              to="/farms/create"
              className="inline-flex items-center gap-2 btn-primary shadow-md text-sm"
            >
              <Sprout className="w-4 h-4" />
              + Add New Farm
            </Link>
          </div>

          {!loadingFarms && farms.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {farms.map((farm) => (
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
                      <span className="text-xs font-bold text-farm-green bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1 group-hover:bg-farm-green group-hover:text-white transition-colors">
                        Select Farm <ArrowRight className="w-3 h-3" />
                      </span>
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
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-gray-400" />
                      {farm.boundary ? 'Boundary mapped' : 'Boundary ready'}
                    </span>
                    <span className="font-semibold text-farm-green group-hover:underline">
                      Open Dashboard & Map →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card text-center py-12">
              <Sprout className="w-12 h-12 text-farm-green mx-auto mb-3 opacity-60" />
              <h3 className="font-bold text-gray-800 text-lg">No farms created yet</h3>
              <p className="text-gray-500 text-sm max-w-sm mx-auto mt-1 mb-6">
                Create your first digital farm to map field plots, monitor meteorology, and forecast harvests.
              </p>
              <Link to="/farms/create" className="btn-primary inline-flex items-center gap-2">
                Create Farm
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sprout className="w-5 h-5 text-farm-green" />
            <span className="font-bold text-white">
              FarmSim <span className="text-farm-green">AI</span>
            </span>
          </div>
          <p className="text-sm">AI-Powered Agriculture Simulator • Built for Smart Farming</p>
        </div>
      </footer>
    </div>
  );
}
