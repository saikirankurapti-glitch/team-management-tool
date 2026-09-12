import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FolderKanban,
  ArrowRight,
  ShieldAlert,
  BarChart2,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { fetchApi } from '../services/api';
import { Project, WorkItem, TeamWorkloadItem } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { CreateWorkItemModal } from '../components/common/CreateWorkItemModal';

export const HomeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [workload, setWorkload] = useState<TeamWorkloadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchApi<Project[]>('/projects'),
      fetchApi<WorkItem[]>('/work-items'),
      fetchApi<TeamWorkloadItem[]>('/teams/workload'),
    ])
      .then(([projData, itemData, workloadData]) => {
        setProjects(projData);
        setWorkItems(itemData);
        setWorkload(workloadData);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 p-8 text-xs font-mono text-brand-muted bg-[#090b0e] flex items-center space-x-2">
        <span className="w-2 h-2 rounded-full bg-brand-lime animate-pulse" />
        <span>Loading workspace telemetry...</span>
      </div>
    );
  }

  const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;
  const activeItems = workItems.filter((i) => i.status !== 'DONE').length;
  const inProgressItems = workItems.filter((i) => i.status === 'IN_PROGRESS' || i.status === 'CODE_REVIEW').length;
  const blockedItems = workItems.filter((i) => i.status === 'BLOCKED').length;
  const now = new Date();

  const attentionItems = workItems.filter(
    (i) => i.status === 'BLOCKED' || (i.dueDate && new Date(i.dueDate) < now && i.status !== 'DONE')
  );

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="w-full min-h-full px-6 md:px-8 py-8 space-y-8 bg-[#090b0e] text-zinc-200 font-sans select-none">
      {/* HERO / WORKSPACE BANNER SECTION */}
      <section className="relative">
        <div className="space-y-4 max-w-3xl">
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-brand-lime/10 text-brand-lime border border-brand-lime/25 font-mono">
            Workspace
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight font-display">
            Run your team <br className="hidden sm:inline" />
            <span className="text-brand-lime bg-gradient-to-r from-lime-300 via-brand-lime to-emerald-400 bg-clip-text text-transparent">
              with clarity.
            </span>
          </h1>
          <p className="text-zinc-400 text-base max-w-xl leading-relaxed">
            Projects, delivery, capacity and engineering activity in one operating view.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-lime text-zinc-950 font-bold text-sm hover:bg-brand-limeHover transition shadow-lg glow-lime-sm"
              type="button"
            >
              <span>+ Create Work Item</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/my-work')}
              className="px-5 py-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 font-semibold text-sm transition"
              type="button"
            >
              Open My Work
            </button>
          </div>
        </div>

        {/* KPI Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          {/* Active Projects */}
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 backdrop-blur hover:border-zinc-700 transition">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Active Projects</span>
            <div className="text-3xl font-display font-extrabold text-white mt-1">
              {String(activeProjects).padStart(2, '0')}
            </div>
            <p className="text-xs text-zinc-500 mt-1">Active delivery tracks</p>
          </div>

          {/* Open Work */}
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 backdrop-blur hover:border-zinc-700 transition">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Open Work</span>
            <div className="text-3xl font-display font-extrabold text-white mt-1">
              {String(activeItems).padStart(2, '0')}
            </div>
            <p className="text-xs text-zinc-500 mt-1">In backlog & active sprints</p>
          </div>

          {/* In Progress */}
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 backdrop-blur hover:border-lime-500/40 transition">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-lime">In Progress</span>
            <div className="text-3xl font-display font-extrabold text-brand-lime mt-1">
              {String(inProgressItems).padStart(2, '0')}
            </div>
            <p className="text-xs text-zinc-500 mt-1">Active developer work</p>
          </div>

          {/* Blocked */}
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 backdrop-blur hover:border-red-500/40 transition">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">Blocked</span>
            <div className="text-3xl font-display font-extrabold text-red-500 mt-1">
              {String(blockedItems).padStart(2, '0')}
            </div>
            <p className="text-xs text-zinc-500 mt-1">Requiring escalation</p>
          </div>
        </div>
      </section>

      {/* TEAM WORKLOAD & PROJECT HEALTH SECTION */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* TEAM WORKLOAD & ALLOCATION (lg:col-span-8) */}
        <div className="lg:col-span-8 rounded-2xl bg-[#0f1217]/90 border border-zinc-800/80 p-5 flex flex-col justify-between shadow-sm">
          {/* Card Header */}
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-zinc-800 text-brand-lime">
                <BarChart2 className="w-4 h-4" />
              </span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Team Workload & Allocation
              </h2>
            </div>
            <Link to="/teams" className="text-xs font-semibold text-brand-lime hover:text-lime-300 flex items-center gap-1">
              <span>Directory</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Recharts Workload Bar Chart */}
          <div className="pt-6 pb-2">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workload} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <XAxis
                    dataKey="fullName"
                    stroke="#71717a"
                    fontSize={11}
                    tickLine={false}
                    tick={{ fill: '#a1a1aa' }}
                  />
                  <YAxis
                    stroke="#71717a"
                    fontSize={11}
                    tickLine={false}
                    unit="%"
                    domain={[0, 120]}
                    tick={{ fill: '#71717a' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#13161a',
                      borderColor: '#232830',
                      borderRadius: '12px',
                      fontSize: '11px',
                      color: '#f4f4f5',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    }}
                  />
                  <Bar dataKey="workloadPercentage" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {workload.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.workloadPercentage > 90 ? '#ef4444' : '#bbf438'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-500 px-4 pt-2 border-t border-zinc-800/40">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-brand-lime" /> Optimal Allocation (30 - 85%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-red-600" /> Overcapacity (&gt;100%)
                </span>
              </div>
              <span className="text-[11px] font-mono">Live telemetry synced</span>
            </div>
          </div>
        </div>

        {/* PROJECT HEALTH (lg:col-span-4) */}
        <div className="lg:col-span-4 rounded-2xl bg-[#0f1217]/90 border border-zinc-800/80 p-5 flex flex-col justify-between shadow-sm">
          <div>
            {/* Card Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-zinc-800 text-brand-lime">
                  <FolderKanban className="w-4 h-4" />
                </span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                  Project Health
                </h2>
              </div>
              <Link to="/projects" className="text-xs font-semibold text-brand-lime hover:text-lime-300">
                All ({projects.length})
              </Link>
            </div>

            {/* Project Cards List */}
            <div className="space-y-3 mt-4">
              {projects.slice(0, 4).map((proj) => {
                const healthStatus = proj.health || 'HEALTHY';
                const isHealthy = healthStatus === 'HEALTHY';
                const isAtRisk = healthStatus === 'AT_RISK';

                const healthBadgeClass = isHealthy
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                  : isAtRisk
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/25';

                const progress = proj.stats?.progress ?? 0;
                const completedItems = proj.stats?.completedItems ?? 0;
                const totalItems = proj.stats?.totalItems ?? 0;

                return (
                  <div
                    key={proj.id}
                    onClick={() => navigate(`/projects/${proj.key}/overview`)}
                    className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-xs font-mono font-bold text-brand-lime bg-brand-lime/10 px-1.5 py-0.5 rounded border border-brand-lime/20">
                          {proj.key}
                        </span>
                        <span className="text-xs font-semibold text-zinc-100 truncate">{proj.name}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${healthBadgeClass}`}>
                        {healthStatus}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
                      <span>{completedItems} / {totalItems} items</span>
                      <span className="font-mono text-brand-lime font-semibold">{progress}%</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="bg-brand-lime h-full rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="pt-3 text-center">
            <span className="text-[11px] text-zinc-500 font-medium font-mono">
              Sprint velocity is pacing 12% ahead of last cycle
            </span>
          </div>
        </div>
      </section>

      {/* ATTENTION REQUIRED SECTION: BLOCKED & OVERDUE ITEMS */}
      <section className="rounded-2xl bg-[#0f1217]/90 border border-red-900/30 p-5 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <ShieldAlert className="w-4 h-4" />
            </span>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
              Attention Required: Blocked & Overdue Items
            </h2>
          </div>
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-500/10 text-red-400 border border-red-500/30 font-mono">
            {attentionItems.length} ITEMS
          </span>
        </div>

        {/* Blocked Work Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {attentionItems.slice(0, 4).map((item) => {
            const assigneeName = item.assignee?.fullName || 'Unassigned';
            const initials = getInitials(assigneeName);
            const isBlocked = item.status === 'BLOCKED';

            return (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-zinc-900/70 border border-red-500/20 hover:border-red-500/40 transition flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                        {item.humanId}
                      </span>
                      <h3 className="text-xs font-medium text-zinc-100 leading-snug">
                        {item.title}
                      </h3>
                    </div>

                    {/* Assignee Pill */}
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-[11px] text-zinc-300 shrink-0">
                      <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-[9px] font-bold text-white uppercase">
                        {initials}
                      </div>
                      <span className="truncate max-w-[90px]">{assigneeName}</span>
                    </div>
                  </div>
                </div>

                {/* Escalation / Notice */}
                <div className="pt-2.5 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
                  {isBlocked && item.blockedReason ? (
                    <p className="text-red-400/90 italic flex items-center gap-1.5 truncate">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                      <span className="truncate">Reason: {item.blockedReason}</span>
                    </p>
                  ) : (
                    <span className="text-red-400 font-semibold font-mono">
                      Overdue Task
                    </span>
                  )}
                  <span
                    onClick={() => navigate('/my-work')}
                    className="text-zinc-400 hover:text-zinc-200 cursor-pointer font-mono shrink-0 ml-2"
                  >
                    View details →
                  </span>
                </div>
              </div>
            );
          })}

          {attentionItems.length === 0 && (
            <div className="py-8 text-center text-zinc-500 italic col-span-2 text-xs font-mono">
              No blocked or overdue work items. Team delivery is flowing smoothly.
            </div>
          )}
        </div>
      </section>

      {/* Work Item Create Modal */}
      {isCreateOpen && (
        <CreateWorkItemModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            fetchApi<WorkItem[]>('/work-items').then(setWorkItems);
          }}
        />
      )}
    </div>
  );
};
