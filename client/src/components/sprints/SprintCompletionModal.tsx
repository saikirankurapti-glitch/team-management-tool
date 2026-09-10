import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, ArrowRight, CornerUpLeft } from 'lucide-react';
import { fetchApi } from '../../services/api';
import { Sprint } from '../../types';

export const SprintCompletionModal: React.FC<{
  sprint: Sprint;
  onClose: () => void;
  onCompleted?: () => void;
}> = ({ sprint, onClose, onCompleted }) => {
  const [otherSprints, setOtherSprints] = useState<Sprint[]>([]);
  const [carryOverOption, setCarryOverOption] = useState<'NEXT_SPRINT' | 'BACKLOG'>('NEXT_SPRINT');
  const [targetSprintId, setTargetSprintId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchApi<Sprint[]>(`/sprints?projectId=${sprint.projectId}`).then((data) => {
      const candidates = data.filter((s) => s.id !== sprint.id && s.status !== 'COMPLETED');
      setOtherSprints(candidates);
      if (candidates.length > 0) setTargetSprintId(candidates[0].id);
    });
  }, [sprint.id, sprint.projectId]);

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      await fetchApi(`/sprints/${sprint.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          carryOverOption,
          targetSprintId: carryOverOption === 'NEXT_SPRINT' ? targetSprintId : undefined,
        }),
      });

      if (onCompleted) onCompleted();
      onClose();
    } catch (err) {
      console.error('Failed to complete sprint', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCount = sprint.metrics?.openCount || 0;
  const remainingPoints = sprint.metrics?.remainingPoints || 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-100">Complete {sprint.name}</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Summary Box */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Completed Points:</span>
              <span className="font-bold text-emerald-400">{sprint.metrics?.completedPoints || 0} pts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Unfinished Work Items:</span>
              <span className="font-bold text-amber-400">{openCount} items ({remainingPoints} pts)</span>
            </div>
          </div>

          {/* Options */}
          {openCount > 0 && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Unfinished Work Carry-Over Options
              </label>

              <div className="space-y-2">
                <label className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  carryOverOption === 'NEXT_SPRINT' ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                }`}>
                  <input
                    type="radio"
                    name="carryOver"
                    checked={carryOverOption === 'NEXT_SPRINT'}
                    onChange={() => setCarryOverOption('NEXT_SPRINT')}
                    className="mt-0.5 text-indigo-600 focus:ring-0"
                  />
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-slate-200 flex items-center space-x-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Move remaining items to target Sprint</span>
                    </div>
                    {carryOverOption === 'NEXT_SPRINT' && otherSprints.length > 0 && (
                      <select
                        value={targetSprintId}
                        onChange={(e) => setTargetSprintId(e.target.value)}
                        className="w-full mt-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      >
                        {otherSprints.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.status})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </label>

                <label className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  carryOverOption === 'BACKLOG' ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                }`}>
                  <input
                    type="radio"
                    name="carryOver"
                    checked={carryOverOption === 'BACKLOG'}
                    onChange={() => setCarryOverOption('BACKLOG')}
                    className="mt-0.5 text-indigo-600 focus:ring-0"
                  />
                  <div className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                    <CornerUpLeft className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Return remaining items to unassigned Product Backlog</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleComplete}
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
            >
              {isSubmitting ? 'Completing...' : 'Complete Sprint'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
