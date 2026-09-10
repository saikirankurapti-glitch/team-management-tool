import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Search,
  RefreshCw,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { fetchApi } from '../../services/api';

export const CapacityPlanningView: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVER_ALLOCATED' | 'HIGH_UTILIZATION' | 'HEALTHY'>('ALL');

  const loadCapacity = () => {
    setIsLoading(true);
    fetchApi<any>('/capacity')
      .then((res) => setData(res))
      .catch((err) => console.error('Failed to load capacity planning:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadCapacity();
  }, []);

  if (isLoading) {
    return <div className="p-8 text-xs font-mono text-slate-400">Evaluating capacity planning across projects...</div>;
  }

  if (!data) {
    return <div className="p-8 text-xs text-rose-400">Failed to load capacity planning data.</div>;
  }

  const summary = data.summary || {};
  const capacityByUser: any[] = data.capacityByUser || [];

  const filteredUsers = capacityByUser.filter((c) => {
    const q = filterText.toLowerCase();
    const matchesName =
      c.user.fullName.toLowerCase().includes(q) ||
      c.user.email.toLowerCase().includes(q) ||
      (c.user.role || '').toLowerCase().includes(q) ||
      (c.user.jobTitle || '').toLowerCase().includes(q) ||
      (c.user.skills || []).some((s: any) => (s.skillName || s).toLowerCase().includes(q)) ||
      c.evaluation.allocations.some((a: any) =>
        (a.role || '').toLowerCase().includes(q) ||
        (a.skill || '').toLowerCase().includes(q) ||
        (a.projectName || '').toLowerCase().includes(q)
      );

    if (!matchesName) return false;
    if (statusFilter === 'ALL') return true;
    return c.evaluation.status === statusFilter;
  });

  return (
    <div className="space-y-4 text-xs">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="card-cream p-4">
          <div className="text-[10px] uppercase font-bold text-ink-muted tracking-wider mb-1">
            Total Team Capacity
          </div>
          <div className="text-2xl font-bold text-ink-primary font-mono">{summary.totalCapacityHours}h</div>
          <div className="text-[11px] text-ink-muted mt-1">
            {summary.totalTeamMembers} members • 160h standard month
          </div>
        </div>

        <div className="card-cream p-4">
          <div className="text-[10px] uppercase font-bold text-ink-muted tracking-wider mb-1">
            Committed Effort
          </div>
          <div className="text-2xl font-bold text-olive-dark font-mono">{summary.totalAllocatedHours}h</div>
          <div className="text-[11px] text-ink-muted mt-1">Across all active projects</div>
        </div>

        <div className="card-cream p-4">
          <div className="text-[10px] uppercase font-bold text-ink-muted tracking-wider mb-1">
            Available Capacity
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            {summary.availableCapacityHours}h
          </div>
          <div className="text-[11px] text-ink-muted mt-1">Ready for allocation</div>
        </div>

        <div className="card-cream p-4">
          <div className="text-[10px] uppercase font-bold text-ink-muted tracking-wider mb-1">
            Organization Utilization
          </div>
          <div className="text-2xl font-bold text-ink-primary flex items-center space-x-2 font-mono">
            <span>{summary.overallUtilization}%</span>
            {summary.overAllocatedCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                {summary.overAllocatedCount} Over-allocated
              </span>
            )}
          </div>
          <div className="text-[11px] text-ink-muted mt-1">Capacity balance</div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="panel-cream p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-1.5 p-1 bg-canvas-secondary rounded-full border border-border-warm w-fit">
          {[
            { id: 'ALL', label: `All (${capacityByUser.length})` },
            { id: 'OVER_ALLOCATED', label: 'Over-allocated' },
            { id: 'HIGH_UTILIZATION', label: 'High (≥85%)' },
            { id: 'HEALTHY', label: 'Healthy (50-84%)' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                statusFilter === tab.id
                  ? 'bg-olive text-canvas shadow-xs font-bold'
                  : 'text-ink-muted hover:text-ink hover:bg-canvas'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search resource..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="input-warm pl-8 pr-3 text-xs w-44 sm:w-56"
            />
          </div>
          <button
            onClick={loadCapacity}
            className="btn-pill-secondary btn-pill-sm p-2"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Capacity Grid */}
      <div className="panel-cream overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-editorial">
            <thead>
              <tr>
                <th>Team Member</th>
                <th className="text-right">Capacity</th>
                <th className="text-right">Allocated</th>
                <th className="text-right">Available</th>
                <th>Utilization</th>
                <th>Status</th>
                <th>Cross-Project Allocations</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-ink-muted italic">
                    No resources matching filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((item) => {
                  const ev = item.evaluation;
                  const utilPercent = ev.capacityHours > 0 ? Math.round((ev.totalAllocatedHours / ev.capacityHours) * 100) : 0;
                  const isOver = ev.isOverAllocated;

                  return (
                    <tr key={item.user.id}>
                      <td>
                        <div className="flex items-center space-x-2.5">
                          <img
                            src={item.user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover shrink-0 border border-border-warm"
                          />
                          <div>
                            <div className="font-semibold text-ink-primary">{item.user.fullName}</div>
                            <div className="text-[10px] text-ink-muted font-mono">{item.user.role}</div>
                          </div>
                        </div>
                      </td>

                      <td className="text-right font-mono text-ink-muted">{ev.capacityHours}h</td>

                      <td className="text-right font-mono font-bold text-olive-dark">
                        {ev.totalAllocatedHours}h
                      </td>

                      <td className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {ev.availableHours}h
                      </td>

                      <td className="w-40">
                        <div className="flex justify-between text-[10px] font-mono text-ink-muted mb-1">
                          <span>{utilPercent}%</span>
                        </div>
                        <div className="w-full bg-canvas-secondary rounded-full h-1.5 overflow-hidden border border-border-warm">
                          <div
                            className={`h-full rounded-full ${
                              isOver ? 'bg-rose-500' : utilPercent >= 85 ? 'bg-amber-500' : 'bg-olive'
                            }`}
                            style={{ width: `${Math.min(100, utilPercent)}%` }}
                          />
                        </div>
                      </td>

                      <td>
                        <span
                          className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                            isOver
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                              : ev.status === 'HIGH_UTILIZATION'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : ev.status === 'HEALTHY'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : 'bg-canvas-secondary text-ink-muted border border-border-warm'
                          }`}
                        >
                          {ev.status}
                        </span>
                      </td>

                      <td>
                        {ev.allocations.length === 0 ? (
                          <span className="text-[10px] text-ink-muted italic">No allocations</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {ev.allocations.map((a: any) => (
                              <span
                                key={a.id}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-surface-primary border border-border-warm text-ink-primary font-mono"
                              >
                                {a.projectKey || 'PROJ'}: {a.allocatedHours}h ({a.allocationPercentage}%)
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
