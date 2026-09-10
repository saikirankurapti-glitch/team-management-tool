import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Plus,
  Copy,
  Check,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  X,
  Play,
} from 'lucide-react';
import { fetchApi } from '../../services/api';
import { EstimateScenario } from '../../types';

interface ScenarioModelingViewProps {
  projectId: string;
}

export const ScenarioModelingView: React.FC<ScenarioModelingViewProps> = ({ projectId }) => {
  const [scenarios, setScenarios] = useState<EstimateScenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [simulatedDurationWeeks, setSimulatedDurationWeeks] = useState(12);
  const [simulatedEffortHours, setSimulatedEffortHours] = useState(1200);
  const [simulatedResourceCount, setSimulatedResourceCount] = useState(6);
  const [simulatedCost, setSimulatedCost] = useState(1500000);
  const [simulatedPrice, setSimulatedPrice] = useState(2100000);
  const [simulatedMarginPercent, setSimulatedMarginPercent] = useState(28.5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadScenarios = () => {
    setIsLoading(true);
    fetchApi<EstimateScenario[]>(`/projects/${projectId}/scenarios`)
      .then((data) => setScenarios(data))
      .catch((err) => console.error('Failed to load scenarios:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (projectId) loadScenarios();
  }, [projectId]);

  const handleCreateScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const scenarioData = {
        durationWeeks: Number(simulatedDurationWeeks),
        effortHours: Number(simulatedEffortHours),
        resourceCount: Number(simulatedResourceCount),
        cost: Number(simulatedCost),
        price: Number(simulatedPrice),
        marginPercent: Number(simulatedMarginPercent),
        capacityRisk: Number(simulatedEffortHours) > 1500 ? 'HIGH' : 'LOW',
      };

      await fetchApi(`/projects/${projectId}/scenarios`, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description?.trim() || null,
          scenarioData,
        }),
      });

      setIsModalOpen(false);
      setName('');
      setDescription('');
      loadScenarios();
    } catch (err: any) {
      alert(err.message || 'Failed to create scenario');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyScenario = async (scenarioId: string) => {
    if (!confirm('Are you sure you want to apply this scenario to the active project baseline?')) return;
    try {
      await fetchApi(`/scenarios/${scenarioId}/apply`, { method: 'POST' });
      alert('Scenario applied successfully to project baseline!');
      loadScenarios();
    } catch (err: any) {
      alert(err.message || 'Failed to apply scenario');
    }
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">What-If Scenario Modeling</h2>
            <p className="text-[11px] text-slate-400">
              Simulate staffing, scope trade-offs, timelines, and commercial margins before committing
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium flex items-center space-x-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Scenario</span>
        </button>
      </div>

      {/* Scenarios Comparison Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/40 text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                <th className="p-3">Scenario Name</th>
                <th className="p-3 text-right">Duration</th>
                <th className="p-3 text-right">Total Effort</th>
                <th className="p-3 text-right">Headcount</th>
                <th className="p-3 text-right">Internal Cost</th>
                <th className="p-3 text-right">Price</th>
                <th className="p-3 text-right">Margin %</th>
                <th className="p-3">Capacity Risk</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    Loading scenarios...
                  </td>
                </tr>
              ) : scenarios.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500 italic">
                    No scenarios modeled yet. Click "New Scenario" to test staffing and delivery variations.
                  </td>
                </tr>
              ) : (
                scenarios.map((sc) => {
                  let parsed: any = {};
                  try {
                    parsed = JSON.parse(sc.scenarioData);
                  } catch {}

                  return (
                    <tr key={sc.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-200 flex items-center space-x-2">
                          <span>{sc.name}</span>
                          {sc.isApplied && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              ACTIVE APPLIED
                            </span>
                          )}
                        </div>
                        {sc.description && (
                          <div className="text-[10px] text-slate-500">{sc.description}</div>
                        )}
                      </td>

                      <td className="p-3 text-right font-mono font-semibold text-slate-300">
                        {parsed.durationWeeks || '—'} wks
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-blue-400">
                        {parsed.effortHours || '—'}h
                      </td>

                      <td className="p-3 text-right font-mono text-slate-300">
                        {parsed.resourceCount || '—'} FTE
                      </td>

                      <td className="p-3 text-right font-mono text-amber-400">
                        ₹{(parsed.cost || 0).toLocaleString()}
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-emerald-400">
                        ₹{(parsed.price || 0).toLocaleString()}
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-slate-200">
                        {parsed.marginPercent || 0}%
                      </td>

                      <td className="p-3">
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold ${
                            parsed.capacityRisk === 'HIGH'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {parsed.capacityRisk || 'LOW'}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleApplyScenario(sc.id)}
                          disabled={sc.isApplied}
                          className="px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600/30 disabled:opacity-40 text-purple-300 border border-purple-500/30 rounded text-[10px] font-semibold transition-colors flex items-center space-x-1 mx-auto"
                        >
                          <Play className="w-3 h-3" />
                          <span>Apply</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Scenario Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden text-xs">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
              <h3 className="text-sm font-bold text-slate-100">Create What-If Scenario</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateScenario} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Scenario Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Scenario A: +1 Lead Data Engineer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Description / Hypothesis
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Adding a senior engineer accelerates timeline by 3 weeks with 4% margin reduction"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Duration (wks)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={simulatedDurationWeeks}
                    onChange={(e) => setSimulatedDurationWeeks(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Total Effort (h)
                  </label>
                  <input
                    type="number"
                    min="10"
                    value={simulatedEffortHours}
                    onChange={(e) => setSimulatedEffortHours(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Resources (FTE)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={simulatedResourceCount}
                    onChange={(e) => setSimulatedResourceCount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Simulated Cost (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={simulatedCost}
                    onChange={(e) => setSimulatedCost(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Simulated Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={simulatedPrice}
                    onChange={(e) => setSimulatedPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Margin (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={simulatedMarginPercent}
                    onChange={(e) => setSimulatedMarginPercent(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors"
                >
                  {isSubmitting ? 'Creating...' : 'Create Scenario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
