import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  GitCompare, Sparkles, Plus, Trash2, Play,
  Droplets, Heart, Bug, Zap, TrendingUp, Loader2,
  CheckSquare, Square, ArrowLeft,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import toast from 'react-hot-toast';
import { comparisonApi, simulationApi } from '../services/api';
import { isMockEnabled, createMockComparison, createMockSimulation } from '../services/mockData';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ErrorDisplay from '../components/shared/ErrorDisplay';
import type { SimulationResult, ComparisonResult } from '../types';

const SIM_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16',
];

const METRICS = [
  { key: 'soilMoisture', label: 'Soil Moisture (%)', icon: Droplets, color: 'blue' },
  { key: 'cropHealth', label: 'Crop Health (%)', icon: Heart, color: 'green' },
  { key: 'diseaseRisk', label: 'Disease Risk (%)', icon: Bug, color: 'red' },
  { key: 'waterConsumption', label: 'Water Usage (L)', icon: Zap, color: 'purple' },
  { key: 'expectedYield', label: 'Expected Yield (%)', icon: TrendingUp, color: 'yellow' },
];

export default function ScenarioComparisonPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const [simulations, setSimulations] = useState<SimulationResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState('soilMoisture');

  useEffect(() => {
    loadSimulations();
  }, [farmId]);

  const loadSimulations = async () => {
    if (!farmId || farmId === 'undefined' || farmId === 'null') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await simulationApi.list(farmId);
      setSimulations(data || []);
      if (data && data.length >= 2) {
        setSelectedIds([data[0].id, data[1].id]);
      } else if (data && data.length === 1) {
        setSelectedIds([data[0].id]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load simulations');
    } finally {
      setLoading(false);
    }
  };

  const toggleSimulation = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
    setComparison(null);
  };

  const runComparison = async () => {
    if (selectedIds.length < 2) {
      toast.error('Select at least 2 simulations to compare');
      return;
    }
    setComparing(true);
    try {
      const data = await comparisonApi.compare({ simulation_ids: selectedIds } as any);
      setComparison(data);
      toast.success('Comparison ready!');
    } catch (err: any) {
      toast.error(err?.message || 'Comparison failed. Please try again.');
    } finally {
      setComparing(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading simulations..." fullPage />;
  if (error) return <ErrorDisplay message={error} onRetry={loadSimulations} />;

  // Build chart data for the comparison
  const chartData = comparison?.timeline.map((t) => {
    const point: any = { day: t.label };
    t.simulations.forEach((sim) => {
      point[`${sim.name}_${activeMetric}`] = (sim as any)[activeMetric];
    });
    return point;
  });

  const selectedSims = comparison?.simulations || [];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <Link
            to={`/farms/${farmId}`}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="page-title flex items-center gap-3">
            <GitCompare className="w-7 h-7 text-farm-green" />
            Scenario Comparison
          </h1>
        </div>
        <button
          onClick={runComparison}
          disabled={comparing || selectedIds.length < 2}
          className="btn-primary flex items-center gap-2"
        >
          {comparing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {comparing ? 'Comparing...' : 'Compare Selected'}
        </button>
      </div>

      {/* Simulation Selection */}
      <div className="card mb-8">
        <h2 className="section-title mb-4">
          Select Simulations to Compare
          <span className="text-sm font-normal text-gray-400 ml-2">
            ({selectedIds.length} selected)
          </span>
        </h2>
        {simulations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No simulations found. Run a simulation first from the dashboard.</p>
            <Link
              to={`/farms/${farmId}`}
              className="text-farm-green font-medium hover:underline mt-2 inline-block"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {simulations.map((sim, i) => {
              const selected = selectedIds.includes(sim.id);
              return (
                <button
                  key={sim.id}
                  onClick={() => toggleSimulation(sim.id)}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                    selected
                      ? 'border-farm-green/40 bg-farm-green-pale/30 shadow-sm'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  {selected ? (
                    <CheckSquare className="w-5 h-5 text-farm-green flex-shrink-0" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: SIM_COLORS[i % SIM_COLORS.length] }}
                      />
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {sim.scenarioName || `Simulation ${i + 1}`}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Health: {sim.summary.averageCropHealth.toFixed(0)}% •
                      Yield: {sim.summary.totalExpectedYield.toFixed(0)}t
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Comparison Results */}
      {comparison && (
        <>
          {/* Side by Side Summary */}
          <div className="card mb-8">
            <h2 className="section-title mb-4">Summary Comparison</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Metric</th>
                    {selectedSims.map((sim, i) => (
                      <th key={sim.id} className="text-right py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: SIM_COLORS[i % SIM_COLORS.length] }}
                          />
                          <span className="font-semibold text-gray-700">
                            {sim.scenarioName}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map((metric) => (
                    <tr key={metric.key} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-700 flex items-center gap-2">
                        <metric.icon className="w-4 h-4 text-gray-400" />
                        {metric.label}
                      </td>
                      {selectedSims.map((sim) => {
                        const val = metric.key === 'waterConsumption'
                          ? sim.summary.totalWaterUsage
                          : metric.key === 'expectedYield'
                          ? sim.summary.totalExpectedYield
                          : (sim.summary as any)[`average${metric.key.charAt(0).toUpperCase() + metric.key.slice(1)}`]
                            ?? (sim.summary as any)[metric.key];
                        return (
                          <td key={sim.id} className="py-3 px-4 text-right font-medium text-gray-900">
                            {typeof val === 'number' ? val.toFixed(1) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Comparison Charts */}
          <div className="card mb-8">
            <div className="flex flex-wrap gap-2 mb-6">
              {METRICS.map((metric) => (
                <button
                  key={metric.key}
                  onClick={() => setActiveMetric(metric.key)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    activeMetric === metric.key
                      ? 'bg-farm-green text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {metric.label}
                </button>
              ))}
            </div>

            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Legend />
                  {selectedSims.map((sim, i) => (
                    <Line
                      key={sim.id}
                      type="monotone"
                      dataKey={`${sim.scenarioName}_${activeMetric}`}
                      name={sim.scenarioName}
                      stroke={SIM_COLORS[i % SIM_COLORS.length]}
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Explanation */}
          <div className="card bg-gradient-to-br from-farm-green-pale/50 to-blue-50/50 border-farm-green/10">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-farm-green/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-farm-green" />
              </div>
              <div>
                <h2 className="section-title mb-2">AI Comparison Analysis</h2>
                <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {comparison.aiExplanation}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
