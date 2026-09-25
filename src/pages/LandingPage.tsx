import { Link, useNavigate } from 'react-router-dom';
import {
  Sprout, ArrowRight, Cloud, Droplets, Sun, BarChart3,
  Wheat, Leaf, LineChart, FlaskConical, Zap, ShieldCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { farmApi } from '../services/api';
import { isMockEnabled } from '../services/mockData';
import type { Farm } from '../types';

export default function LandingPage() {
  const navigate = useNavigate();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loadingFarms, setLoadingFarms] = useState(true);

  useEffect(() => {
    loadFarms();
  }, []);

  const loadFarms = async () => {
    try {
      const data = await farmApi.list();
      setFarms(data);
    } catch {
      // Check localStorage for mock farms
      if (isMockEnabled()) {
        const stored = localStorage.getItem('farms');
        if (stored) {
          try {
            setFarms(JSON.parse(stored));
          } catch { /* ignore */ }
        }
      }
    } finally {
      setLoadingFarms(false);
    }
  };

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

              {farms.length > 0 && (
                <button
                  onClick={() => navigate(`/farms/${farms[0].id}`)}
                  className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/30 text-white font-semibold py-3.5 px-8 rounded-2xl hover:bg-white/20 transition-all duration-200"
                >
                  <BarChart3 className="w-5 h-5" />
                  View Dashboard
                </button>
              )}
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

      {/* Existing Farms */}
      {!loadingFarms && farms.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Your Farms</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {farms.map((farm) => (
                <Link
                  key={farm.id}
                  to={`/farms/${farm.id}`}
                  className="card group hover:border-farm-green/30"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-farm-green-pale flex items-center justify-center">
                      <Sprout className="w-5 h-5 text-farm-green" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-farm-green transition-colors" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{farm.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{farm.location}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                    <span>{farm.area} acres</span>
                    <span>{farm.zones.length} zones</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

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
