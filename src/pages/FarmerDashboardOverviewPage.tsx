import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sprout, Plus, ArrowRight, Play, Loader2,
  TrendingUp, ShieldCheck, Heart, Droplets, Flame, AlertCircle,
  Activity, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useFarmContext } from '../context/FarmContext';
import { aiApi, BackendRiskAssessment } from '../services/api';
import LoadingSpinner from '../components/shared/LoadingSpinner';

export default function FarmerDashboardOverviewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { farms, selectedFarm, selectFarm, loadingFarms } = useFarmContext();

  // Single active farm for prototype
  const activeFarm = selectedFarm || farms[0] || null;

  // AI Risk State
  const [riskAssessment, setRiskAssessment] = useState<BackendRiskAssessment | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Automatically fetch AI risk assessment when active farm is available
  useEffect(() => {
    if (!activeFarm?.id) {
      setRiskAssessment(null);
      return;
    }
    const fetchRisk = async () => {
      setLoadingAi(true);
      setAiError(null);
      try {
        const assessment = await aiApi.analyzeRisk(activeFarm.id);
        setRiskAssessment(assessment);
      } catch (err: any) {
        console.warn('AI risk analysis fetch error:', err);
        setAiError(err?.message || 'Could not fetch AI risk analysis');
      } finally {
        setLoadingAi(false);
      }
    };
    fetchRisk();
  }, [activeFarm?.id]);

  const handleRunAiAnalysis = async () => {
    if (!activeFarm?.id) return;
    setLoadingAi(true);
    setAiError(null);
    try {
      const assessment = await aiApi.analyzeRisk(activeFarm.id);
      setRiskAssessment(assessment);
      toast.success('AI farm risk analysis updated!');
    } catch (err: any) {
      toast.error('Could not run farm analysis');
      setAiError(err?.message || 'Failed to analyze farm risk');
    } finally {
      setLoadingAi(false);
    }
  };

  // Derive aggregate risk levels from AI response if available
  const aggregatedRisks = useMemo(() => {
    if (!riskAssessment || !riskAssessment.zone_risks || riskAssessment.zone_risks.length === 0) {
      return null;
    }
    const zRisks = riskAssessment.zone_risks;
    const waterLevel = zRisks.some((z) => z.water_stress?.level === 'HIGH')
      ? 'HIGH'
      : zRisks.some((z) => z.water_stress?.level === 'MEDIUM')
      ? 'MEDIUM'
      : 'LOW';

    const heatLevel = zRisks.some((z) => z.heat_stress?.level === 'HIGH')
      ? 'HIGH'
      : zRisks.some((z) => z.heat_stress?.level === 'MEDIUM')
      ? 'MEDIUM'
      : 'LOW';

    const diseaseLevel = zRisks.some((z) => z.disease_risk?.level === 'HIGH')
      ? 'HIGH'
      : zRisks.some((z) => z.disease_risk?.level === 'MEDIUM')
      ? 'MEDIUM'
      : 'LOW';

    const nutrientLevel = zRisks.some((z) => z.nutrient_risk?.level === 'HIGH')
      ? 'HIGH'
      : zRisks.some((z) => z.nutrient_risk?.level === 'MEDIUM')
      ? 'MEDIUM'
      : 'LOW';

    return {
      waterStress: waterLevel,
      heatStress: heatLevel,
      diseaseRisk: diseaseLevel,
      nutrientRisk: nutrientLevel,
      overallRisk: riskAssessment.overall_risk,
    };
  }, [riskAssessment]);

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'HIGH':
        return 'text-red-700 bg-red-100 border-red-200';
      case 'MEDIUM':
        return 'text-amber-700 bg-amber-100 border-amber-200';
      case 'LOW':
      default:
        return 'text-emerald-700 bg-emerald-100 border-emerald-200';
    }
  };

  if (loadingFarms) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" message="Loading your farm dashboard..." />
      </div>
    );
  }

  return (
    <div className="page-container py-8 space-y-8">
      {/* 1. WELCOME HEADER */}
      <div className="card bg-gradient-to-r from-farm-green/10 via-emerald-50/60 to-white border-farm-green/20 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-farm-green flex items-center justify-center text-3xl shadow-md text-white flex-shrink-0">
              🚜
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-farm-green-pale text-farm-green text-xs font-bold uppercase tracking-wider mb-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Farmer Portal
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                Welcome back, {user?.name || 'Farmer'}!
              </h1>
              <p className="text-gray-500 text-sm mt-1 flex items-center gap-2 flex-wrap">
                <span>{user?.email}</span>
                {activeFarm ? (
                  <>
                    <span>•</span>
                    <strong className="text-gray-800">{activeFarm.name}</strong>
                    <span>•</span>
                    <span>{activeFarm.area} acres</span>
                    <span>•</span>
                    <span>{activeFarm.zones.length} zones</span>
                  </>
                ) : (
                  <>
                    <span>•</span>
                    <span className="text-amber-600 font-semibold">No farm created yet</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!activeFarm ? (
              <Link
                to="/farms/create"
                className="btn-primary inline-flex items-center gap-2 text-sm shadow-md"
              >
                <Plus className="w-4 h-4" />
                Create Farm
              </Link>
            ) : (
              <>
                <Link
                  to={`/farms/${activeFarm.id}/builder`}
                  className="btn-secondary inline-flex items-center gap-2 text-sm shadow-xs"
                >
                  <Sprout className="w-4 h-4 text-farm-green" />
                  Build Farm
                </Link>
                <Link
                  to={`/farms/${activeFarm.id}/scenarios/new`}
                  className="btn-primary inline-flex items-center gap-2 text-sm shadow-md"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Run Simulation
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. ACTIVE FARM STATUS / EMPTY STATE */}
      {!activeFarm ? (
        <div className="card text-center py-16 border-dashed border-2 border-gray-200">
          <Sprout className="w-14 h-14 text-farm-green mx-auto mb-3 opacity-60" />
          <h2 className="font-bold text-gray-900 text-xl">No farm created yet</h2>
          <p className="text-gray-500 text-sm max-w-sm mx-auto mt-2 mb-6">
            Get started by entering your farm name and acreage, then sketch your virtual field zones.
          </p>
          <Link to="/farms/create" className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create Farm
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Farm Quick Overview Card */}
          <div className="card border border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">My Farm Overview</span>
                <h2 className="text-xl font-extrabold text-gray-900">{activeFarm.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {activeFarm.area} acres total • {activeFarm.zones.length} active crop zones
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleRunAiAnalysis}
                  disabled={loadingAi}
                  className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3 cursor-pointer"
                >
                  {loadingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-purple-600" />}
                  {loadingAi ? 'Analyzing...' : 'Run Farm Analysis'}
                </button>
                <Link
                  to={`/farms/${activeFarm.id}/builder`}
                  className="text-xs font-bold text-farm-green hover:underline flex items-center gap-1"
                >
                  Edit in Workspace <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Current Farm Status Metric Badges */}
            <div className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-farm-green" />
                  Current Farm Status (Real AI Assessment)
                </h3>
                {aggregatedRisks && (
                  <span className="text-xs font-bold text-gray-500">
                    Overall Risk:{' '}
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-extrabold ${getRiskBadge(aggregatedRisks.overallRisk)}`}>
                      {aggregatedRisks.overallRisk}
                    </span>
                  </span>
                )}
              </div>

              {aggregatedRisks ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Water Stress */}
                  <div className="p-4 rounded-xl bg-stone-50 border border-gray-200">
                    <div className="flex items-center justify-between text-gray-500 mb-2">
                      <span className="text-xs font-bold">Water Stress</span>
                      <Droplets className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className={`text-base font-extrabold px-2.5 py-0.5 rounded-full border ${getRiskBadge(aggregatedRisks.waterStress)}`}>
                        {aggregatedRisks.waterStress}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">Transpiration & irrigation demand</p>
                  </div>

                  {/* Heat Stress */}
                  <div className="p-4 rounded-xl bg-stone-50 border border-gray-200">
                    <div className="flex items-center justify-between text-gray-500 mb-2">
                      <span className="text-xs font-bold">Heat Stress</span>
                      <Flame className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className={`text-base font-extrabold px-2.5 py-0.5 rounded-full border ${getRiskBadge(aggregatedRisks.heatStress)}`}>
                        {aggregatedRisks.heatStress}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">Thermal limit threshold</p>
                  </div>

                  {/* Disease Risk */}
                  <div className="p-4 rounded-xl bg-stone-50 border border-gray-200">
                    <div className="flex items-center justify-between text-gray-500 mb-2">
                      <span className="text-xs font-bold">Disease Risk</span>
                      <Heart className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className={`text-base font-extrabold px-2.5 py-0.5 rounded-full border ${getRiskBadge(aggregatedRisks.diseaseRisk)}`}>
                        {aggregatedRisks.diseaseRisk}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">Pathogen pressure index</p>
                  </div>

                  {/* Nutrient Risk */}
                  <div className="p-4 rounded-xl bg-stone-50 border border-gray-200">
                    <div className="flex items-center justify-between text-gray-500 mb-2">
                      <span className="text-xs font-bold">Nutrient Risk</span>
                      <Sprout className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className={`text-base font-extrabold px-2.5 py-0.5 rounded-full border ${getRiskBadge(aggregatedRisks.nutrientRisk)}`}>
                        {aggregatedRisks.nutrientRisk}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">NPK balance & soil buffer</p>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-stone-50 rounded-xl border border-gray-200">
                  <Sparkles className="w-8 h-8 text-purple-600 mx-auto mb-2 opacity-70" />
                  <p className="text-sm font-semibold text-gray-700">No AI analysis generated yet</p>
                  <p className="text-xs text-gray-400 mb-4">Click below to assess crop stress and disease risks with real agronomic AI.</p>
                  <button
                    type="button"
                    onClick={handleRunAiAnalysis}
                    disabled={loadingAi}
                    className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {loadingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {loadingAi ? 'Analyzing...' : 'Run Farm Analysis'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick Action Hub */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card p-6 border border-gray-200 flex flex-col justify-between">
              <div>
                <h4 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <Sprout className="w-5 h-5 text-farm-green" />
                  Virtual Farm Workspace
                </h4>
                <p className="text-xs text-gray-500 mb-4">
                  Inspect your {activeFarm.zones.length} field zones, customize crops, soil types, and irrigation settings.
                </p>
              </div>
              <Link
                to={`/farms/${activeFarm.id}/builder`}
                className="btn-secondary w-full text-center flex items-center justify-center gap-2 text-xs py-2.5 shadow-xs"
              >
                Open Virtual Farm <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="card p-6 border border-gray-200 bg-gradient-to-br from-purple-50/40 to-white flex flex-col justify-between">
              <div>
                <h4 className="text-base font-bold text-purple-900 mb-1 flex items-center gap-2">
                  <Play className="w-5 h-5 text-purple-600 fill-current" />
                  What-If Simulation Engine
                </h4>
                <p className="text-xs text-gray-500 mb-4">
                  Simulate climate variations like drought, rainfall drops, or heatwaves on {activeFarm.name}.
                </p>
              </div>
              <Link
                to={`/farms/${activeFarm.id}/scenarios/new`}
                className="btn-primary w-full text-center flex items-center justify-center gap-2 text-xs py-2.5 shadow-md"
              >
                Run What-If Simulation <Play className="w-3.5 h-3.5 fill-current" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
