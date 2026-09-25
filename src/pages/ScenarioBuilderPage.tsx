import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Sparkles, Play, Plus, Trash2, CheckSquare, Square,
  CloudRain, Thermometer, Droplets, Bug, FlaskConical,
  Loader2, Zap, MessageSquare, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { farmApi, scenarioApi, simulationApi } from '../services/api';
import { isMockEnabled, createMockSimulation } from '../services/mockData';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ErrorDisplay from '../components/shared/ErrorDisplay';
import type {
  Farm, Scenario, ScenarioChange, ScenarioChangeType, SimulationResult,
} from '../types';
import { SCENARIO_PRESETS, CROP_EMOJIS } from '../types';

const CHANGE_ICONS: Record<string, any> = {
  rainfall: CloudRain,
  temperature: Thermometer,
  irrigation: Droplets,
  fertilizer: FlaskConical,
  disease: Bug,
  pest: Bug,
  nitrogen: FlaskConical,
};

export default function ScenarioBuilderPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scenario form state
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(30);
  const [affectedZones, setAffectedZones] = useState<string[]>([]);
  const [changes, setChanges] = useState<ScenarioChange[]>([]);
  const [nlQuery, setNlQuery] = useState('');
  const [useNl, setUseNl] = useState(false);

  useEffect(() => {
    loadFarm();
  }, [farmId]);

  const loadFarm = async () => {
    if (!farmId) return;
    setLoading(true);
    setError(null);
    try {
      let farmData: Farm;
      try {
        farmData = await farmApi.get(farmId);
      } catch {
        if (isMockEnabled()) {
          const stored = JSON.parse(localStorage.getItem('farms') || '[]') as Farm[];
          const found = stored.find((f) => f.id === farmId);
          if (!found) throw new Error('Farm not found');
          farmData = found;
        } else {
          throw new Error('Failed to load farm');
        }
      }
      setFarm(farmData);
      setAffectedZones(farmData.zones.map((z) => z.id));
    } catch (err: any) {
      setError(err?.message || 'Failed to load farm');
    } finally {
      setLoading(false);
    }
  };

  const toggleZone = (zoneId: string) => {
    setAffectedZones((prev) =>
      prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId]
    );
  };

  const addPreset = (preset: typeof SCENARIO_PRESETS[0]) => {
    const change: ScenarioChange = {
      type: preset.type,
      parameter: preset.parameter,
      value: preset.value,
      unit: preset.unit,
    };
    setChanges((prev) => [...prev, change]);
    if (!name) setName(preset.label);
  };

  const removeChange = (index: number) => {
    setChanges((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRun = async () => {
    if (!farm) return;
    if (!useNl && changes.length === 0) {
      toast.error('Add at least one scenario change');
      return;
    }
    if (useNl && !nlQuery.trim()) {
      toast.error('Enter a scenario description');
      return;
    }

    setRunning(true);
    try {
      const scenario: Partial<Scenario> = {
        farmId: farm.id,
        name: name || 'Custom Scenario',
        duration,
        affectedZones,
        changes,
        naturalLanguageQuery: useNl ? nlQuery : undefined,
      };

      let result: SimulationResult;
      try {
        // Create scenario and run simulation
        const createdScenario = await scenarioApi.create(scenario);
        result = await simulationApi.run({
          farmId: farm.id,
          scenarioId: createdScenario.id,
          zones: farm.zones.filter((z) => affectedZones.includes(z.id)),
          scenario: createdScenario,
        });
      } catch {
        if (isMockEnabled()) {
          result = createMockSimulation(farm.id, name || 'Custom Scenario');
          const sims = JSON.parse(localStorage.getItem('simulations') || '[]');
          sims.push(result);
          localStorage.setItem('simulations', JSON.stringify(sims));
        } else {
          throw new Error('Simulation failed');
        }
      }
      toast.success('Simulation complete!');
      navigate(`/farms/${farm.id}/simulations/${result.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to run simulation');
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading scenario builder..." fullPage />;
  if (error) return <ErrorDisplay message={error} onRetry={loadFarm} />;
  if (!farm) return <ErrorDisplay message="Farm not found" />;

  return (
    <div className="page-container">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="page-title flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-farm-green" />
            What-If Scenario
          </h1>
          <p className="text-gray-500 mt-1">
            Create a scenario to simulate on {farm.name}
          </p>
        </div>

        <div className="space-y-6">
          {/* Scenario Name & Duration */}
          <div className="card">
            <h2 className="section-title flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-farm-green" />
              Scenario Details
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Scenario Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Drought Scenario"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="label flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  Duration (days)
                </label>
                <input
                  type="number"
                  className="input-field"
                  min="1"
                  max="365"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
                />
              </div>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-3">
            <button
              onClick={() => setUseNl(false)}
              className={`flex-1 py-3 px-4 rounded-xl border-2 font-medium text-sm transition-all ${
                !useNl
                  ? 'border-farm-green bg-farm-green-pale text-farm-green'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <Zap className="w-4 h-4 inline mr-2" />
              Choose Presets
            </button>
            <button
              onClick={() => setUseNl(true)}
              className={`flex-1 py-3 px-4 rounded-xl border-2 font-medium text-sm transition-all ${
                useNl
                  ? 'border-farm-green bg-farm-green-pale text-farm-green'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <MessageSquare className="w-4 h-4 inline mr-2" />
              Describe in Words
            </button>
          </div>

          {/* Natural Language Input */}
          {useNl && (
            <div className="card">
              <h2 className="section-title flex items-center gap-2 mb-4">
                <MessageSquare className="w-4 h-4 text-farm-green" />
                Describe Your Scenario
              </h2>
              <textarea
                className="input-field min-h-[120px] resize-y"
                placeholder="e.g., What happens if rainfall decreases by 30% for the next 30 days while temperature increases by 3°C?"
                value={nlQuery}
                onChange={(e) => setNlQuery(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-2">
                The AI will interpret your scenario and run the simulation accordingly.
              </p>
            </div>
          )}

          {/* Preset Scenarios */}
          {!useNl && (
            <div className="card">
              <h2 className="section-title flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-farm-green" />
                Quick Scenarios
              </h2>
              <div className="grid sm:grid-cols-2 gap-2">
                {SCENARIO_PRESETS.map((preset, i) => {
                  const Icon = CHANGE_ICONS[preset.parameter] || Zap;
                  return (
                    <button
                      key={i}
                      onClick={() => addPreset(preset)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-farm-green/30 hover:bg-farm-green-pale/30 transition-all text-left group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-farm-green-pale flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-gray-500 group-hover:text-farm-green" />
                      </div>
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected Changes */}
          {!useNl && changes.length > 0 && (
            <div className="card">
              <h2 className="section-title mb-4">Selected Changes</h2>
              <div className="space-y-2">
                {changes.map((change, i) => {
                  const Icon = CHANGE_ICONS[change.parameter] || Zap;
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {change.parameter}: {change.value > 0 ? '+' : ''}{change.value}{change.unit}
                          </p>
                          <p className="text-xs text-gray-400">{change.type}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeChange(i)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Affected Zones */}
          <div className="card">
            <h2 className="section-title mb-4">Affected Zones</h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {farm.zones.map((zone) => {
                const selected = affectedZones.includes(zone.id);
                return (
                  <button
                    key={zone.id}
                    onClick={() => toggleZone(zone.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                      selected
                        ? 'border-farm-green/30 bg-farm-green-pale/30'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    {selected ? (
                      <CheckSquare className="w-4 h-4 text-farm-green flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    )}
                    <span className="text-lg">{(CROP_EMOJIS as any)[zone.crop]}</span>
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-800">{zone.name}</p>
                      <p className="text-xs text-gray-500">{zone.crop} • {zone.area} acres</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() =>
                setAffectedZones(
                  affectedZones.length === farm.zones.length
                    ? []
                    : farm.zones.map((z) => z.id)
                )
              }
              className="text-sm text-farm-green font-medium mt-3 hover:underline"
            >
              {affectedZones.length === farm.zones.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {/* Run Button */}
          <button
            onClick={handleRun}
            disabled={running}
            className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-lg"
          >
            {running ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Running Simulation...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Run Simulation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
