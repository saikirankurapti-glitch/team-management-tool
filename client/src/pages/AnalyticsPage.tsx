import React, { useState, useEffect } from 'react';
import {
  Download,
  AlertTriangle,
  FileSpreadsheet,
  Clock,
  Sparkles,
} from 'lucide-react';
import { fetchApi } from '../services/api';
import { Project, WorkItem } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { WorkItemSideDrawer } from '../components/common/WorkItemSideDrawer';

export const AnalyticsPage: React.FC = () => {
  const [overview, setOverview] = useState<any>(null);
  const [teamAnalytics, setTeamAnalytics] = useState<any>(null);
  const [flowAnalytics, setFlowAnalytics] = useState<any>(null);
  const [bugAnalytics, setBugAnalytics] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [timeframe, setTimeframe] = useState('30days');
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'flow' | 'bugs' | 'reports'>('overview');

  const [selectedWorkItem, setSelectedWorkItem] = useState<WorkItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = () => {
    let query = `timeframe=${timeframe}`;
    if (selectedProjectId) query += `&projectId=${selectedProjectId}`;

    Promise.all([
      fetchApi<any>(`/analytics?${query}`),
      fetchApi<any>('/analytics/team'),
      fetchApi<any>('/analytics/flow'),
      fetchApi<any>('/analytics/bugs'),
      fetchApi<any[]>('/analytics/reports'),
      fetchApi<Project[]>('/projects'),
    ])
      .then(([overData, teamData, flowData, bugData, repData, projData]) => {
        setOverview(overData);
        setTeamAnalytics(teamData);
        setFlowAnalytics(flowData);
        setBugAnalytics(bugData);
        setReports(repData);
        setProjects(projData);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [selectedProjectId, timeframe]);

  const handleExportCSV = () => {
    const token = localStorage.getItem('token');
    window.open(`/api/analytics/export?token=${token}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <div className="editorial-eyebrow">[ INTELLIGENCE ]</div>
        <div className="text-xl font-bold tracking-tight text-ink">Calibrating engineering metrics...</div>
        <div className="h-64 bg-surface border border-borderWarm rounded-2xl animate-pulse" />
      </div>
    );
  }

  const COLORS = ['#7F8500', '#A3AB05', '#525700', '#D97706', '#E11D48', '#0D9488'];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Editorial Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-borderWarm">
        <div>
          <div className="editorial-eyebrow mb-1.5">[ INTELLIGENCE & TELEMETRY ]</div>
          <h1 className="editorial-headline text-2xl md:text-3xl font-black text-ink">
            Understand how work moves.
          </h1>
          <p className="text-xs text-ink/65 max-w-2xl font-sans mt-1">
            Empirical throughput, cycle times, WIP limits, and team capacity calibration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="input-warm text-xs font-semibold py-2 px-3 rounded-full cursor-pointer"
          >
            <option value="7days">This Week</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="quarter">This Quarter</option>
          </select>

          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="input-warm text-xs font-semibold py-2 px-3 rounded-full cursor-pointer max-w-[200px]"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.key})
              </option>
            ))}
          </select>

          <button
            onClick={handleExportCSV}
            className="btn-pill-secondary flex items-center space-x-1.5 py-2 px-4 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-olive" />
            <span className="font-semibold text-xs">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Pill Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-surface border border-borderWarm rounded-full w-fit overflow-x-auto">
        {[
          { id: 'overview', label: 'Executive Overview' },
          { id: 'team', label: 'Team Workload' },
          { id: 'flow', label: 'Flow & Aging' },
          { id: 'bugs', label: 'Bug Quality' },
          { id: 'reports', label: `Saved Reports (${reports.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-olive text-white shadow-sm'
                : 'text-ink/70 hover:text-ink hover:bg-canvas'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="card-cream p-4">
              <span className="editorial-eyebrow text-[10px] block mb-1">Active Projects</span>
              <div className="text-2xl font-black text-ink">{overview.summary.activeProjectsCount}</div>
            </div>

            <div className="card-cream p-4">
              <span className="editorial-eyebrow text-[10px] block mb-1">Open Items</span>
              <div className="text-2xl font-black text-olive">{overview.summary.totalCount - overview.summary.completedCount}</div>
            </div>

            <div className="card-cream p-4">
              <span className="editorial-eyebrow text-[10px] block mb-1">Completed</span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{overview.summary.completedCount}</div>
            </div>

            <div className="card-cream p-4">
              <span className="editorial-eyebrow text-[10px] block mb-1">Blocked</span>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400">{overview.summary.blockedCount}</div>
            </div>

            <div className="card-cream p-4">
              <span className="editorial-eyebrow text-[10px] block mb-1">Overdue</span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{overview.summary.overdueCount}</div>
            </div>

            <div className="card-cream p-4">
              <span className="editorial-eyebrow text-[10px] block mb-1">Avg Cycle Time</span>
              <div className="text-2xl font-black text-ink">{overview.summary.avgCycleTimeDays}<span className="text-xs font-normal text-ink/60 ml-1">days</span></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="panel-cream p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
                  Workflow Status Breakdown
                </h3>
                <span className="editorial-eyebrow text-[10px]">[ DISTRIBUTION ]</span>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.statusDistribution}>
                    <XAxis dataKey="name" stroke="#7F8500" fontSize={11} tickLine={false} />
                    <YAxis stroke="#7F8500" fontSize={11} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#FAFBE8', borderColor: '#D9DEC2', borderRadius: '12px', fontSize: '11px', color: '#1B2414' }} />
                    <Bar dataKey="value" name="Work Items" fill="#7F8500" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel-cream p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
                  Work Item Types
                </h3>
                <span className="editorial-eyebrow text-[10px]">[ BREAKDOWN ]</span>
              </div>
              <div className="h-56 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={overview.typeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label>
                      {overview.typeDistribution.map((_entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#FAFBE8', borderColor: '#D9DEC2', borderRadius: '12px', fontSize: '11px', color: '#1B2414' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', color: '#1B2414' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TEAM WORKLOAD */}
      {activeTab === 'team' && teamAnalytics && (
        <div className="panel-cream p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="editorial-eyebrow mb-1">[ CAPACITY ]</div>
              <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
                Team Workload & Capacity Utilization Matrix
              </h3>
            </div>
            <span className="badge-pill bg-lime/30 text-ink text-[11px] font-bold">
              {teamAnalytics.workloadMatrix?.length || 0} Members Tracked
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {teamAnalytics.workloadMatrix?.map((member: any) => (
              <div key={member.userId} className="card-cream p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <img src={member.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-borderWarm shrink-0" />
                  <div>
                    <span className="text-sm font-bold text-ink">{member.fullName}</span>
                    <span className="text-ink/60 font-mono text-[11px] block">{member.totalActiveItems} active items in flight</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className={`font-mono text-xs font-bold block ${member.isOverCapacity ? 'text-rose-600' : 'text-olive'}`}>
                      {member.utilization}%
                    </span>
                    <span className="text-[11px] text-ink/60 font-mono">
                      {member.assignedHours} / {member.capacityHours} hrs
                    </span>
                  </div>
                  <div className="w-32 bg-borderWarm/50 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${member.isOverCapacity ? 'bg-rose-500' : 'bg-olive'}`}
                      style={{ width: `${Math.min(member.utilization, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: FLOW & AGING */}
      {activeTab === 'flow' && flowAnalytics && (
        <div className="space-y-6">
          {flowAnalytics.potentialBottlenecks?.length > 0 && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
              <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-300 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Detected Flow Bottlenecks</span>
              </div>
              <ul className="list-disc list-inside text-amber-800 dark:text-amber-200 text-xs space-y-1">
                {flowAnalytics.potentialBottlenecks.map((b: string, idx: number) => (
                  <li key={idx}>{b}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="panel-cream p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="editorial-eyebrow mb-1">[ INVENTORY ]</div>
                <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
                  Work In Progress (WIP) Aging List
                </h3>
              </div>
              <span className="text-xs text-ink/60 font-mono">
                {flowAnalytics.wipAging?.length || 0} items analyzed
              </span>
            </div>

            <div className="space-y-2 pt-2">
              {flowAnalytics.wipAging?.map((item: any) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedWorkItem(item)}
                  className="card-cream p-3.5 flex items-center justify-between cursor-pointer hover:border-olive transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="font-mono font-bold text-xs text-olive bg-olive/10 px-2 py-0.5 rounded-full">{item.humanId}</span>
                    <span className="font-medium text-xs text-ink">{item.title}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-ink/60 font-mono text-xs">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{item.daysInStatus} days in status</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BUG QUALITY */}
      {activeTab === 'bugs' && bugAnalytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card-cream p-4">
              <span className="editorial-eyebrow text-[10px] block mb-1">Total Bugs</span>
              <div className="text-2xl font-black text-ink">{bugAnalytics.summary.totalBugs}</div>
            </div>
            <div className="card-cream p-4">
              <span className="editorial-eyebrow text-[10px] block mb-1">Open Defects</span>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400">{bugAnalytics.summary.openBugs}</div>
            </div>
            <div className="card-cream p-4">
              <span className="editorial-eyebrow text-[10px] block mb-1">Critical Blockers</span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{bugAnalytics.summary.criticalBugs}</div>
            </div>
            <div className="card-cream p-4">
              <span className="editorial-eyebrow text-[10px] block mb-1">Avg Resolution</span>
              <div className="text-2xl font-black text-olive">{bugAnalytics.summary.avgResolutionDays}<span className="text-xs font-normal text-ink/60 ml-1">days</span></div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: REPORTS */}
      {activeTab === 'reports' && (
        <div className="panel-cream p-6 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-borderWarm">
            <h4 className="text-sm font-bold text-ink uppercase tracking-wider">Automated Intelligence Reports</h4>
            <span className="editorial-eyebrow text-[10px]">[ CSV / JSON ]</span>
          </div>
          {reports.map((r) => (
            <div key={r.id} className="card-cream p-4 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-ink">{r.name}</h4>
                <p className="text-ink/60 text-xs mt-0.5">{r.description || 'Continuous telemetry digest'}</p>
              </div>
              <button
                onClick={handleExportCSV}
                className="btn-pill-secondary py-1.5 px-3 text-xs flex items-center space-x-1"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-olive" />
                <span>Export</span>
              </button>
            </div>
          ))}
          {reports.length === 0 && (
            <div className="text-center py-8 text-ink/60 text-xs">
              <Sparkles className="w-5 h-5 mx-auto text-olive mb-2" />
              No custom scheduled reports generated yet.
            </div>
          )}
        </div>
      )}

      {selectedWorkItem && <WorkItemSideDrawer item={selectedWorkItem} onClose={() => setSelectedWorkItem(null)} />}
    </div>
  );
};

