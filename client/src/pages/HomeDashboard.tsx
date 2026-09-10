import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  Zap,
  Activity,
  ArrowRight,
  ShieldAlert,
  BarChart2,
  Plus,
  GitPullRequest,
  Users,
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
      <div className="p-8 text-xs font-mono text-ink-muted flex items-center space-x-2">
        <Activity className="w-4 h-4 animate-spin text-olive-dark" />
        <span>Loading workspace telemetry...</span>
      </div>
    );
  }

  const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;
  const activeItems = workItems.filter((i) => i.status !== 'DONE').length;
  const inProgressItems = workItems.filter((i) => i.status === 'IN_PROGRESS' || i.status === 'CODE_REVIEW').length;
  const completedItems = workItems.filter((i) => i.status === 'DONE').length;
  const blockedItems = workItems.filter((i) => i.status === 'BLOCKED').length;
  const overdueItems = workItems.filter(
    (i) => i.status !== 'DONE' && i.dueDate && new Date(i.dueDate) < new Date()
  ).length;

  return (
    <div className="p-6 md:p-10 space-y-10 overflow-y-auto h-full text-xs bg-canvas select-none">
      {/* Editorial Introduction Section */}
      <section className="space-y-4 max-w-4xl">
        <div className="editorial-eyebrow">
          WORKSPACE
        </div>
        
        <h1 className="text-4xl md:text-5xl font-black text-ink tracking-tighter leading-tight">
          Run your team <br />
          <span className="text-olive-dark">with clarity.</span>
        </h1>
        
        <p className="text-base text-ink-muted leading-relaxed max-w-2xl">
          Projects, delivery, capacity and engineering activity in one operating view.
        </p>

        {/* Primary Action Pills */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="btn-pill-primary"
          >
            <Plus className="w-4 h-4" />
            <span>Create Work Item →</span>
          </button>
          
          <button
            onClick={() => navigate('/my-work')}
            className="btn-pill-secondary"
          >
            <span>Open My Work</span>
          </button>
        </div>
      </section>

      {/* Large Typography Operational Metrics Bar */}
      <section className="pt-2 border-t border-borderWarm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold tracking-eyebrow text-ink-muted uppercase block">
              ACTIVE PROJECTS
            </span>
            <div className="text-4xl md:text-5xl font-extrabold text-ink tracking-tight font-mono">
              {String(activeProjects).padStart(2, '0')}
            </div>
            <span className="text-[11px] text-ink-muted">Active delivery tracks</span>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold tracking-eyebrow text-ink-muted uppercase block">
              OPEN WORK
            </span>
            <div className="text-4xl md:text-5xl font-extrabold text-ink tracking-tight font-mono">
              {String(activeItems).padStart(2, '0')}
            </div>
            <span className="text-[11px] text-ink-muted">In backlog & active sprints</span>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold tracking-eyebrow text-ink-muted uppercase block">
              IN PROGRESS
            </span>
            <div className="text-4xl md:text-5xl font-extrabold text-olive-dark tracking-tight font-mono">
              {String(inProgressItems).padStart(2, '0')}
            </div>
            <span className="text-[11px] text-ink-muted">Active developer work</span>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold tracking-eyebrow text-ink-muted uppercase block">
              BLOCKED
            </span>
            <div className="text-4xl md:text-5xl font-extrabold text-status-error tracking-tight font-mono">
              {String(blockedItems).padStart(2, '0')}
            </div>
            <span className="text-[11px] text-ink-muted">Requiring escalation</span>
          </div>
        </div>
      </section>

      {/* Main Operational Section: Current Delivery & Project Health */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Capacity & Workload Allocation (2 cols) */}
        <div className="lg:col-span-2 card-cream p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-borderWarm pb-3">
            <div className="flex items-center space-x-2">
              <BarChart2 className="w-4 h-4 text-olive-dark" />
              <h2 className="text-xs font-bold text-ink uppercase tracking-wider">
                Team Workload & Allocation
              </h2>
            </div>
            <Link
              to="/teams"
              className="text-xs text-olive-dark hover:underline font-semibold flex items-center space-x-1"
            >
              <span>Directory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="h-60 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workload}>
                <XAxis dataKey="fullName" stroke="#66705D" fontSize={11} tickLine={false} />
                <YAxis stroke="#66705D" fontSize={11} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface-primary)',
                    borderColor: 'var(--border-warm)',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: 'var(--ink-primary)',
                  }}
                />
                <Bar dataKey="workloadPercentage" radius={[6, 6, 0, 0]}>
                  {workload.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.workloadPercentage > 90
                          ? '#9A332B'
                          : entry.workloadPercentage > 75
                          ? '#927000'
                          : '#7F8500'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Health Overview (1 col) */}
        <div className="card-cream p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-borderWarm pb-3">
            <div className="flex items-center space-x-2">
              <FolderKanban className="w-4 h-4 text-olive-dark" />
              <h2 className="text-xs font-bold text-ink uppercase tracking-wider">
                Project Health
              </h2>
            </div>
            <Link to="/projects" className="text-xs text-olive-dark hover:underline font-semibold">
              All ({projects.length})
            </Link>
          </div>

          <div className="space-y-3">
            {projects.slice(0, 4).map((proj) => (
              <div
                key={proj.id}
                className="p-3 rounded-xl bg-canvas-secondary border border-borderWarm/80 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-olive-dark">{proj.key}</span>
                    <span className="text-xs font-semibold text-ink truncate max-w-[130px]">
                      {proj.name}
                    </span>
                  </div>
                  <span
                    className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      proj.health === 'HEALTHY' ? 'badge-green' : 'badge-amber'
                    }`}
                  >
                    {proj.health}
                  </span>
                </div>
                <div className="w-full bg-borderWarm/60 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-olive-dark h-full transition-all"
                    style={{ width: `${proj.stats?.progress || 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-ink-muted font-mono">
                  <span>{proj.stats?.completedItems || 0} / {proj.stats?.totalItems || 0} items</span>
                  <span className="font-semibold text-ink">{proj.stats?.progress || 0}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Attention Required: Blocked & Critical Items */}
      <section className="card-cream p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-borderWarm pb-3">
          <div className="flex items-center space-x-2 text-status-error">
            <ShieldAlert className="w-4 h-4" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink">
              Attention Required: Blocked & Overdue Items
            </h2>
          </div>
          <span className="editorial-eyebrow text-[9px]">
            {workItems.filter((i) => i.status === 'BLOCKED' || (i.dueDate && new Date(i.dueDate) < new Date() && i.status !== 'DONE')).length} Items
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {workItems
            .filter(
              (i) => i.status === 'BLOCKED' || (i.dueDate && new Date(i.dueDate) < new Date() && i.status !== 'DONE')
            )
            .slice(0, 4)
            .map((item) => (
              <div
                key={item.id}
                className="p-3 bg-canvas-secondary rounded-xl border border-borderWarm/80 flex items-center justify-between text-xs"
              >
                <div className="space-y-1 min-w-0 pr-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-olive-dark">{item.humanId}</span>
                    <span className="font-medium text-ink truncate">{item.title}</span>
                  </div>
                  {item.blockedReason && (
                    <div className="text-[10px] text-status-error italic truncate">
                      Reason: {item.blockedReason}
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-surface border border-borderWarm text-ink-secondary shrink-0 font-medium">
                  {item.assignee?.fullName || 'Unassigned'}
                </span>
              </div>
            ))}
          {workItems.filter((i) => i.status === 'BLOCKED' || (i.dueDate && new Date(i.dueDate) < new Date() && i.status !== 'DONE')).length === 0 && (
            <div className="py-6 text-center text-ink-muted italic col-span-2">
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
