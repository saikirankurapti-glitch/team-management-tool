import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ZoomIn,
  ZoomOut,
  Plus,
  GitCommit,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  X,
  Layers,
} from 'lucide-react';
import { fetchApi } from '../../services/api';

interface TimelineGanttViewProps {
  projectId: string;
}

export const TimelineGanttView: React.FC<TimelineGanttViewProps> = ({ projectId }) => {
  const [timelineData, setTimelineData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState<'day' | 'week' | 'month' | 'quarter'>('week');
  const [viewMode, setViewMode] = useState<'all' | 'critical' | 'milestones'>('all');
  const [isAddDepOpen, setIsAddDepOpen] = useState(false);
  const [blockingId, setBlockingId] = useState('');
  const [blockedId, setBlockedId] = useState('');
  const [depType, setDepType] = useState('FINISH_TO_START');
  const [depError, setDepError] = useState<string | null>(null);
  const [isSubmittingDep, setIsSubmittingDep] = useState(false);

  const loadTimeline = () => {
    setIsLoading(true);
    fetchApi<any>(`/projects/${projectId}/timeline`)
      .then((data) => setTimelineData(data))
      .catch((err) => console.error('Failed to load timeline:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (projectId) loadTimeline();
  }, [projectId]);

  const handleAddDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockingId || !blockedId) return;
    if (blockingId === blockedId) {
      setDepError('A work item cannot depend on itself');
      return;
    }

    setIsSubmittingDep(true);
    setDepError(null);

    try {
      await fetchApi(`/projects/${projectId}/dependencies`, {
        method: 'POST',
        body: JSON.stringify({
          blockingWorkItemId: blockingId,
          blockedWorkItemId: blockedId,
          type: depType,
        }),
      });
      setIsAddDepOpen(false);
      setBlockingId('');
      setBlockedId('');
      loadTimeline();
    } catch (err: any) {
      setDepError(err.message || 'Failed to add dependency');
    } finally {
      setIsSubmittingDep(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-xs font-mono text-slate-400">Loading timeline & calculating critical path...</div>;
  }

  if (!timelineData) {
    return <div className="p-8 text-xs text-rose-400">Failed to load timeline data.</div>;
  }

  const workItems: any[] = timelineData.workItems || [];
  const milestones: any[] = timelineData.milestones || [];
  const dependencies: any[] = timelineData.dependencies || [];
  const criticalPath: string[] = timelineData.criticalPath || [];

  const filteredItems = workItems.filter((item) => {
    if (viewMode === 'critical') return item.isCritical;
    return true;
  });

  // Calculate project date bounds
  const dates: Date[] = [];
  workItems.forEach((w) => {
    if (w.startDate) dates.push(new Date(w.startDate));
    if (w.dueDate) dates.push(new Date(w.dueDate));
  });
  milestones.forEach((m) => {
    if (m.targetDate) dates.push(new Date(m.targetDate));
  });

  const minDate = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : new Date();
  const maxDate = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : new Date(minDate.getTime() + 30 * 86400000);

  // Extend minDate to start of month and maxDate to end of month
  const timelineStart = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const timelineEnd = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 0);
  const totalDays = Math.max(30, Math.round((timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)));

  const getPositionPercent = (d?: string | null) => {
    if (!d) return 0;
    const itemDate = new Date(d);
    const diff = itemDate.getTime() - timelineStart.getTime();
    const percent = (diff / (timelineEnd.getTime() - timelineStart.getTime())) * 100;
    return Math.max(0, Math.min(100, percent));
  };

  const getWidthPercent = (start?: string | null, due?: string | null, estHours?: number) => {
    if (start && due) {
      const s = getPositionPercent(start);
      const e = getPositionPercent(due);
      return Math.max(3, e - s);
    }
    // Default width proportional to estimated hours
    const days = Math.max(1, (estHours || 8) / 8);
    return Math.max(3, (days / totalDays) * 100);
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-900 border border-slate-800 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <span>Project Gantt Timeline</span>
              {criticalPath.length > 0 && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  Critical Path: {criticalPath.length} Tasks
                </span>
              )}
            </h2>
            <div className="text-[11px] text-slate-400">
              Total Duration: <span className="font-semibold text-slate-200">{timelineData.projectDurationHours}h</span> • Work Items: {workItems.length} • Milestones: {milestones.length}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* View Filter */}
          <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px]">
            <button
              onClick={() => setViewMode('all')}
              className={`px-2.5 py-1 rounded transition-colors ${viewMode === 'all' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              All
            </button>
            <button
              onClick={() => setViewMode('critical')}
              className={`px-2.5 py-1 rounded transition-colors ${viewMode === 'critical' ? 'bg-rose-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Critical Path
            </button>
          </div>

          {/* Zoom Level */}
          <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-400">
            <button
              onClick={() => setZoomLevel('day')}
              className={`px-1.5 py-0.5 rounded ${zoomLevel === 'day' ? 'text-blue-400 font-bold' : 'hover:text-white'}`}
            >
              D
            </button>
            <button
              onClick={() => setZoomLevel('week')}
              className={`px-1.5 py-0.5 rounded ${zoomLevel === 'week' ? 'text-blue-400 font-bold' : 'hover:text-white'}`}
            >
              W
            </button>
            <button
              onClick={() => setZoomLevel('month')}
              className={`px-1.5 py-0.5 rounded ${zoomLevel === 'month' ? 'text-blue-400 font-bold' : 'hover:text-white'}`}
            >
              M
            </button>
            <button
              onClick={() => setZoomLevel('quarter')}
              className={`px-1.5 py-0.5 rounded ${zoomLevel === 'quarter' ? 'text-blue-400 font-bold' : 'hover:text-white'}`}
            >
              Q
            </button>
          </div>

          <button
            onClick={() => setIsAddDepOpen(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center space-x-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Dependency</span>
          </button>

          <button
            onClick={loadTimeline}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Cycle Warning if present */}
      {timelineData.hasCycle && (
        <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>
            Circular dependency loop detected in items: <code className="font-mono bg-rose-900/60 px-1.5 py-0.5 rounded">{timelineData.cyclePath?.join(' → ')}</code>. Critical path calculation paused.
          </span>
        </div>
      )}

      {/* Gantt Timeline Container */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
        {/* Timeline Header Dates */}
        <div className="flex border-b border-slate-800 bg-slate-900/90 text-[10px] font-mono font-semibold text-slate-400 select-none">
          <div className="w-72 p-2.5 border-r border-slate-800 shrink-0 uppercase tracking-wider">
            Work Item / Hierarchy
          </div>
          <div className="flex-1 relative h-9 flex items-center px-2">
            <span className="absolute left-2">{timelineStart.toLocaleDateString([], { month: 'short', year: 'numeric' })}</span>
            <span className="absolute right-2">{timelineEnd.toLocaleDateString([], { month: 'short', year: 'numeric' })}</span>
          </div>
        </div>

        {/* Milestones Row */}
        {milestones.length > 0 && (
          <div className="border-b border-slate-800/80 bg-slate-900/40 flex items-center">
            <div className="w-72 p-2 border-r border-slate-800 text-[11px] font-bold text-amber-400 shrink-0 flex items-center space-x-1.5">
              <span>◆</span>
              <span>Project Milestones ({milestones.length})</span>
            </div>
            <div className="flex-1 relative h-8">
              {milestones.map((m) => {
                const pos = getPositionPercent(m.targetDate || m.plannedDate);
                const isCompleted = m.status === 'COMPLETED';
                const isAtRisk = m.status === 'AT_RISK' || m.status === 'DELAYED';

                return (
                  <div
                    key={m.id}
                    style={{ left: `${pos}%` }}
                    className="absolute top-1 transform -translate-x-1/2 flex items-center space-x-1 group cursor-pointer"
                    title={`${m.name} (${new Date(m.targetDate).toLocaleDateString()}) - ${m.status}`}
                  >
                    <div
                      className={`w-3.5 h-3.5 transform rotate-45 border shadow-sm ${
                        isCompleted
                          ? 'bg-emerald-500 border-emerald-400'
                          : isAtRisk
                          ? 'bg-rose-500 border-rose-400 animate-pulse'
                          : 'bg-amber-400 border-amber-300'
                      }`}
                    />
                    <span className="text-[10px] font-semibold text-slate-300 whitespace-nowrap hidden group-hover:block bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 shadow-lg z-20">
                      {m.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Work Items Rows */}
        <div className="divide-y divide-slate-850 max-h-[550px] overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-slate-500 italic">No work items matching current view.</div>
          ) : (
            filteredItems.map((item) => {
              const startPos = getPositionPercent(item.startDate);
              const width = getWidthPercent(item.startDate, item.dueDate, item.estimatedHours);
              const isCritical = item.isCritical;
              const isDone = item.status === 'DONE';

              return (
                <div key={item.id} className="flex items-center hover:bg-slate-900/50 transition-colors h-10 group">
                  {/* Left Metadata column */}
                  <div className="w-72 p-2 border-r border-slate-800 shrink-0 flex items-center space-x-2 truncate">
                    <span className="font-mono text-[10px] font-bold text-blue-400 shrink-0">
                      {item.humanId}
                    </span>
                    <span className="truncate text-slate-200 font-medium text-[11px]" title={item.title}>
                      {item.title}
                    </span>
                    {isCritical && (
                      <span className="text-[9px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1 rounded shrink-0">
                        CP
                      </span>
                    )}
                  </div>

                  {/* Gantt Bar Lane */}
                  <div className="flex-1 relative h-full flex items-center px-1">
                    {/* Background grid markings */}
                    <div className="absolute inset-0 grid grid-cols-4 pointer-events-none opacity-10 divide-x divide-slate-600" />

                    {/* Gantt Bar */}
                    <div
                      style={{
                        left: `${startPos}%`,
                        width: `${width}%`,
                      }}
                      className={`absolute h-5 rounded flex items-center px-2 shadow-sm transition-all text-[10px] font-semibold text-white truncate ${
                        isDone
                          ? 'bg-slate-700 border border-slate-600'
                          : isCritical
                          ? 'bg-rose-600 border border-rose-400 shadow-rose-950/40'
                          : 'bg-blue-600 border border-blue-400'
                      }`}
                      title={`${item.humanId}: ${item.title} | Slack: ${item.slackHours || 0}h | Duration: ${item.estimatedHours || 8}h`}
                    >
                      <span className="truncate">{item.estimatedHours || 8}h</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Dependency Modal */}
      {isAddDepOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden text-xs">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
              <h3 className="text-sm font-bold text-slate-100">Add Task Dependency</h3>
              <button onClick={() => setIsAddDepOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddDependency} className="p-5 space-y-4">
              {depError && (
                <div className="p-3 bg-rose-950/40 border border-rose-900/50 rounded-lg text-rose-300">
                  {depError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Predecessor (Blocking Task)
                </label>
                <select
                  value={blockingId}
                  onChange={(e) => setBlockingId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value="">Select predecessor task...</option>
                  {workItems.map((w) => (
                    <option key={w.id} value={w.id}>
                      [{w.humanId}] {w.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Dependency Type
                </label>
                <select
                  value={depType}
                  onChange={(e) => setDepType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-blue-500"
                >
                  <option value="FINISH_TO_START">Finish → Start (Standard)</option>
                  <option value="START_TO_START">Start → Start</option>
                  <option value="FINISH_TO_FINISH">Finish → Finish</option>
                  <option value="START_TO_FINISH">Start → Finish</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Successor (Blocked Task)
                </label>
                <select
                  value={blockedId}
                  onChange={(e) => setBlockedId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value="">Select successor task...</option>
                  {workItems.map((w) => (
                    <option key={w.id} value={w.id}>
                      [{w.humanId}] {w.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddDepOpen(false)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDep || !blockingId || !blockedId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                >
                  {isSubmittingDep ? 'Adding...' : 'Add Dependency'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
