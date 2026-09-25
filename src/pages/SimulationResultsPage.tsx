import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Droplets, Heart, Bug, Zap, TrendingUp, Sparkles,
  ArrowLeft, GitCompare, ChevronDown, Loader2,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import toast from 'react-hot-toast';
import { simulationApi } from '../services/api';
import { isMockEnabled } from '../services/mockData';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ErrorDisplay from '../components/shared/ErrorDisplay';
import MetricCard from '../components/shared/MetricCard';
import type { SimulationResult } from '../types';

const CHART_COLORS = {
  soilMoisture: '#3B82F6',
  cropHealth: '#10B981',
  diseaseRisk: '#EF4444',
  waterConsumption: '#6366F1',
  expectedYield: '#F59E0B',
};

export default function SimulationResultsPage() {
  const { farmId, simId } = useParams<{ farmId: string; simId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChart, setActiveChart] = useState<string>('all');

  useEffect(() => {
    loadResult();
  }, [simId]);

  const loadResult = async () => {
    if (!simId) return;
    setLoading(true);
    setError(null);
    try {
      let data: SimulationResult;
      try {
        data = await simulationApi.get(simId);
      } catch {
        if (isMockEnabled()) {
          const stored = JSON.parse(localStorage.getItem('simulations') || '[]') as SimulationResult[];
          const found = stored.find((s) => s.id === simId);
          if (!found) throw new Error('Simulation not found');
          data = found;
        } else {
          throw new Error('Failed to load simulation');
        }
      }
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load simulation');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading simulation results..." fullPage />;
  if (error) return <ErrorDisplay message={error} onRetry={loadResult} />;
  if (!result) return <ErrorDisplay message="Simulation not found" />;

  const chartTabs = [
    { key: 'all', label: 'Overview' },
    { key: 'soilMoisture', label: 'Soil Moisture', color: CHART_COLORS.soilMoisture },
    { key: 'cropHealth', label: 'Crop Health', color: CHART_COLORS.cropHealth },
    { key: 'diseaseRisk', label: 'Disease Risk', color: CHART_COLORS.diseaseRisk },
    { key: 'waterConsumption', label: 'Water Usage', color: CHART_COLORS.waterConsumption },
    { key: 'expectedYield', label: 'Expected Yield', color: CHART_COLORS.expectedYield },
  ];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <button
            onClick={() => navigate(`/farms/${farmId}`)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <h1 className="page-title flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-farm-green" />
            {result.scenarioName || 'Simulation'} Results
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={`/farms/${farmId}/scenarios/new`}
            className="btn-secondary flex items-center gap-2"
          >
            New Scenario
          </Link>
          <Link
            to={`/farms/${farmId}/compare`}
            className="btn-primary flex items-center gap-2"
          >
            <GitCompare className="w-4 h-4" />
            Compare
          </Link>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <MetricCard
          icon={Droplets}
          label="Avg Soil Moisture"
          value={result.summary.averageSoilMoisture}
          unit="%"
          color="blue"
        />
        <MetricCard
          icon={Heart}
          label="Avg Crop Health"
          value={result.summary.averageCropHealth}
          unit="%"
          color="green"
        />
        <MetricCard
          icon={Bug}
          label="Avg Disease Risk"
          value={result.summary.averageDiseaseRisk}
          unit="%"
          color="red"
        />
        <MetricCard
          icon={Zap}
          label="Total Water Usage"
          value={result.summary.totalWaterUsage}
          unit="L"
          color="purple"
        />
        <MetricCard
          icon={TrendingUp}
          label="Expected Yield"
          value={result.summary.totalExpectedYield}
          unit="t"
          color="yellow"
        />
      </div>

      {/* Chart Section */}
      <div className="card mb-8">
        {/* Chart Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {chartTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveChart(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeChart === tab.key
                  ? 'bg-farm-green text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            {activeChart === 'all' ? (
              <LineChart data={result.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="soilMoisture"
                  name="Soil Moisture %"
                  stroke={CHART_COLORS.soilMoisture}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="cropHealth"
                  name="Crop Health %"
                  stroke={CHART_COLORS.cropHealth}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="diseaseRisk"
                  name="Disease Risk %"
                  stroke={CHART_COLORS.diseaseRisk}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="expectedYield"
                  name="Expected Yield %"
                  stroke={CHART_COLORS.expectedYield}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            ) : (
              <AreaChart data={result.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={activeChart}
                  name={chartTabs.find((t) => t.key === activeChart)?.label}
                  stroke={(chartTabs.find((t) => t.key === activeChart) as any)?.color}
                  fill={(chartTabs.find((t) => t.key === activeChart) as any)?.color + '30'}
                  strokeWidth={2}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Timeline Table */}
      <div className="card mb-8">
        <h2 className="section-title mb-4">Timeline Data</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 font-semibold text-gray-600">Day</th>
                <th className="text-right py-3 px-4 font-semibold text-blue-600">Moisture %</th>
                <th className="text-right py-3 px-4 font-semibold text-emerald-600">Health %</th>
                <th className="text-right py-3 px-4 font-semibold text-red-600">Disease %</th>
                <th className="text-right py-3 px-4 font-semibold text-indigo-600">Water (L)</th>
                <th className="text-right py-3 px-4 font-semibold text-amber-600">Yield %</th>
              </tr>
            </thead>
            <tbody>
              {result.timeline.map((point) => (
                <tr key={point.day} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{point.label}</td>
                  <td className="py-3 px-4 text-right text-blue-700">{point.soilMoisture.toFixed(1)}</td>
                  <td className="py-3 px-4 text-right text-emerald-700">{point.cropHealth.toFixed(1)}</td>
                  <td className="py-3 px-4 text-right text-red-700">{point.diseaseRisk.toFixed(1)}</td>
                  <td className="py-3 px-4 text-right text-indigo-700">{point.waterConsumption.toFixed(1)}</td>
                  <td className="py-3 px-4 text-right text-amber-700">{point.expectedYield.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Explanation */}
      <div className="card bg-gradient-to-br from-farm-green-pale/50 to-blue-50/50 border-farm-green/10">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-farm-green/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-farm-green" />
          </div>
          <div>
            <h2 className="section-title mb-2">AI Analysis</h2>
            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
              {result.aiExplanation}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
