import React, { useState, useEffect } from 'react';
import {
  Calculator,
  Clock,
  Check,
  History,
  AlertCircle,
  Sparkles,
  ArrowRight,
  TrendingUp,
  X,
  FileText,
} from 'lucide-react';
import { fetchApi } from '../../services/api';
import { WorkItem } from '../../types';

interface SoftwareEstimationViewProps {
  projectId: string;
}

export const SoftwareEstimationView: React.FC<SoftwareEstimationViewProps> = ({ projectId }) => {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [activeHistoryItem, setActiveHistoryItem] = useState<WorkItem | null>(null);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Estimation form state
  const [method, setMethod] = useState<'HOURS' | 'STORY_POINTS' | 'PERSON_DAYS' | 'THREE_POINT'>('THREE_POINT');
  const [value, setValue] = useState<number>(8);
  const [optimistic, setOptimistic] = useState<number>(6);
  const [mostLikely, setMostLikely] = useState<number>(12);
  const [pessimistic, setPessimistic] = useState<number>(24);
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadWorkItems = () => {
    setIsLoading(true);
    fetchApi<WorkItem[]>(`/work-items?projectId=${projectId}`)
      .then((data) => setWorkItems(data))
      .catch((err) => console.error('Failed to load work items for estimation:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (projectId) loadWorkItems();
  }, [projectId]);

  const handleOpenEstimateModal = (item: WorkItem) => {
    setSelectedItem(item);
    setReason('');
    setSaveSuccess(false);

    const est = item.estimatedHours || 8;
    setValue(est);
    setOptimistic(Math.round(est * 0.7));
    setMostLikely(est);
    setPessimistic(Math.round(est * 1.6));
  };

  const handleOpenHistory = (item: WorkItem) => {
    setActiveHistoryItem(item);
    setIsLoadingHistory(true);
    fetchApi<any[]>(`/work-items/${item.id}/estimate-history`)
      .then((records) => setHistoryRecords(records))
      .catch((err) => console.error('Failed to load history:', err))
      .finally(() => setIsLoadingHistory(false));
  };

  const handleSaveEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setIsSaving(true);
    try {
      await fetchApi(`/work-items/${selectedItem.id}/estimate`, {
        method: 'PATCH',
        body: JSON.stringify({
          method,
          value,
          storyPoints: method === 'STORY_POINTS' ? value : undefined,
          estimatedHours: method === 'HOURS' ? value : undefined,
          personDays: method === 'PERSON_DAYS' ? value : undefined,
          optimisticHours: method === 'THREE_POINT' ? optimistic : undefined,
          mostLikelyHours: method === 'THREE_POINT' ? mostLikely : undefined,
          pessimisticHours: method === 'THREE_POINT' ? pessimistic : undefined,
          reason,
        }),
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setSelectedItem(null);
        loadWorkItems();
      }, 800);
    } catch (err: any) {
      alert(err.message || 'Failed to save estimate');
    } finally {
      setIsSaving(false);
    }
  };

  // Live PERT calculations
  const expectedPert = Math.round(((optimistic + 4 * mostLikely + pessimistic) / 6) * 10) / 10;
  const standardDev = Math.round(((pessimistic - optimistic) / 6) * 10) / 10;
  const variance = Math.round(Math.pow(standardDev, 2) * 10) / 10;
  const ratio = expectedPert > 0 ? standardDev / expectedPert : 0;
  const confidence = ratio > 0.35 ? 'LOW' : ratio > 0.15 ? 'MEDIUM' : 'HIGH';

  return (
    <div className="space-y-4 text-xs">
      {/* Header Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
            Total Estimated Effort
          </div>
          <div className="text-xl font-bold text-slate-100">
            {workItems.reduce((sum, item) => sum + (item.estimatedHours || 0), 0)}h
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {Math.round(workItems.reduce((sum, item) => sum + (item.estimatedHours || 0), 0) / 8)} Person Days
          </div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
            Total Story Points
          </div>
          <div className="text-xl font-bold text-blue-400">
            {workItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0)} pts
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Agile backlog sizing</div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
            Actual Hours Logged
          </div>
          <div className="text-xl font-bold text-emerald-400">
            {workItems.reduce((sum, item) => sum + (item.actualHours || 0), 0)}h
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Tracked execution</div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
            Estimated Scope Items
          </div>
          <div className="text-xl font-bold text-slate-100">
            {workItems.filter((i) => (i.estimatedHours || 0) > 0 || (i.storyPoints || 0) > 0).length} / {workItems.length}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Coverage complete</div>
        </div>
      </div>

      {/* Main Work Items Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <h3 className="font-bold text-slate-200">Software Estimation Matrix</h3>
          <span className="text-[11px] text-slate-400">Click any item to calibrate estimate</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/40 text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                <th className="p-3">Work Item</th>
                <th className="p-3">Type</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Story Points</th>
                <th className="p-3 text-right">Hours</th>
                <th className="p-3 text-right">Person Days</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Loading work items...
                  </td>
                </tr>
              ) : workItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                    No work items found in this project.
                  </td>
                </tr>
              ) : (
                workItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-blue-400 font-bold">{item.humanId}</span>
                        <span className="font-medium text-slate-200">{item.title}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        {item.type}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-slate-800 text-slate-300">
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-blue-400">
                      {item.storyPoints || 0} pts
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-200">
                      {item.estimatedHours || 0}h
                    </td>
                    <td className="p-3 text-right font-mono text-slate-400">
                      {Math.round(((item.estimatedHours || 0) / 8) * 10) / 10}d
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => handleOpenEstimateModal(item)}
                          className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded text-[11px] font-semibold transition-colors flex items-center space-x-1"
                        >
                          <Calculator className="w-3 h-3" />
                          <span>Estimate</span>
                        </button>
                        <button
                          onClick={() => handleOpenHistory(item)}
                          className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors"
                          title="View Estimate Audit History"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Estimation & PERT Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden text-xs">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center space-x-2">
                <Calculator className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  Calibrate Estimate: <span className="font-mono text-blue-400">{selectedItem.humanId}</span>
                </h3>
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEstimate} className="p-5 space-y-4">
              {/* Method Selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Estimation Technique
                </label>
                <div className="grid grid-cols-4 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  {[
                    { id: 'THREE_POINT', label: 'Three-Point PERT' },
                    { id: 'HOURS', label: 'Hours' },
                    { id: 'STORY_POINTS', label: 'Story Points' },
                    { id: 'PERSON_DAYS', label: 'Person Days' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id as any)}
                      className={`py-1.5 rounded text-[10px] font-semibold transition-colors ${
                        method === m.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Three-Point PERT Form */}
              {method === 'THREE_POINT' ? (
                <div className="space-y-3 p-3 bg-slate-950/80 border border-slate-800 rounded-lg">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-400 uppercase mb-1">
                        Optimistic (O)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={optimistic}
                        onChange={(e) => setOptimistic(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100 font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">
                        Most Likely (M)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={mostLikely}
                        onChange={(e) => setMostLikely(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100 font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-rose-400 uppercase mb-1">
                        Pessimistic (P)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={pessimistic}
                        onChange={(e) => setPessimistic(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100 font-mono"
                        required
                      />
                    </div>
                  </div>

                  {/* Calculated PERT Output */}
                  <div className="p-3 bg-blue-950/30 border border-blue-900/40 rounded-lg flex items-center justify-between text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Expected Estimate (E):</span>
                      <span className="text-lg font-bold text-blue-400 font-mono">{expectedPert} hours</span>
                      <span className="text-[10px] text-slate-500 block">
                        Range: {Math.max(0, Math.round((expectedPert - 2 * standardDev) * 10) / 10)}h – {Math.round((expectedPert + 2 * standardDev) * 10) / 10}h
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Confidence</span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[10px] font-mono ${
                          confidence === 'HIGH'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : confidence === 'MEDIUM'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {confidence} CONFIDENCE
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">
                        σ = ±{standardDev}h
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Value ({method === 'STORY_POINTS' ? 'Points' : method === 'PERSON_DAYS' ? 'Days' : 'Hours'})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={method === 'STORY_POINTS' ? '1' : '0.5'}
                    value={value}
                    onChange={(e) => setValue(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 font-mono"
                    required
                  />
                </div>
              )}

              {/* Reason for Audit Log */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Reason for Estimate Change (Audit Trail)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Discovery of API complexity or revised scope"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors flex items-center space-x-1"
                >
                  {saveSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <span>Apply Estimate</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Drawer Modal */}
      {activeHistoryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden text-xs">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  Estimation Audit History: <span className="font-mono text-blue-400">{activeHistoryItem.humanId}</span>
                </h3>
              </div>
              <button onClick={() => setActiveHistoryItem(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 max-h-[400px] overflow-y-auto space-y-2.5">
              {isLoadingHistory ? (
                <div className="p-4 text-center text-slate-400">Loading audit history...</div>
              ) : historyRecords.length === 0 ? (
                <div className="p-6 text-center text-slate-500 italic">
                  No historical changes logged for this item yet.
                </div>
              ) : (
                historyRecords.map((h) => (
                  <div key={h.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-200">
                        {h.previousValue} → <span className="text-blue-400 font-mono">{h.newValue} {h.unit}</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(h.estimatedAt).toLocaleString()}
                      </span>
                    </div>
                    {h.reason && (
                      <p className="text-[11px] text-slate-400 italic">
                        "{h.reason}"
                      </p>
                    )}
                    <div className="text-[10px] text-slate-500">
                      Modified by <span className="text-slate-300 font-medium">{h.estimatedBy?.fullName || 'User'}</span> ({h.method})
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
