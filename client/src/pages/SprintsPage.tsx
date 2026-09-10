import React, { useState, useEffect } from 'react';
import {
  Zap,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowRight,
  Users,
  Play,
} from 'lucide-react';
import { fetchApi } from '../services/api';
import { Sprint, WorkItem, Project } from '../types';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { CreateSprintModal } from '../components/sprints/CreateSprintModal';
import { SprintCompletionModal } from '../components/sprints/SprintCompletionModal';
import { WorkItemSideDrawer } from '../components/common/WorkItemSideDrawer';
import { useAuth } from '../context/AuthContext';

export const SprintsPage: React.FC = () => {
  const { user } = useAuth();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedSprintId, setSelectedSprintId] = useState<string>('');

  const [metrics, setMetrics] = useState<any>(null);
  const [capacity, setCapacity] = useState<any[]>([]);
  const [velocity, setVelocity] = useState<any>(null);
  const [backlogItems, setBacklogItems] = useState<WorkItem[]>([]);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'planning' | 'velocity' | 'history'>('dashboard');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [completingSprint, setCompletingSprint] = useState<Sprint | null>(null);
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isManager = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER';

  const loadData = () => {
    Promise.all([
      fetchApi<Sprint[]>('/sprints'),
      fetchApi<Project[]>('/projects'),
      fetchApi<WorkItem[]>('/work-items?sprintId=unassigned'),
      fetchApi<any>('/sprints/velocity'),
    ])
      .then(([sprintData, projData, unassignedItems, velData]) => {
        setSprints(sprintData);
        setProjects(projData);
        setBacklogItems(unassignedItems);
        setVelocity(velData);

        if (sprintData.length > 0 && !selectedSprintId) {
          const active = sprintData.find((s) => s.status === 'ACTIVE') || sprintData[0];
          setSelectedSprintId(active.id);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedSprintId) {
      Promise.all([
        fetchApi(`/sprints/${selectedSprintId}/metrics`),
        fetchApi(`/sprints/${selectedSprintId}/capacity`),
      ])
        .then(([metData, capData]) => {
          setMetrics(metData);
          setCapacity(capData);
        })
        .catch((err) => console.error(err));
    }
  }, [selectedSprintId]);

  const handleStartSprint = async (sprintId: string) => {
    try {
      await fetchApi(`/sprints/${sprintId}/start`, { method: 'POST' });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveToSprint = async (itemId: string, sprintId: string | null) => {
    try {
      await fetchApi(`/work-items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ sprintId }),
      });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-xs font-mono text-slate-400">Loading Sprint Engine...</div>;
  }

  const activeSprint = sprints.find((s) => s.id === selectedSprintId);

  return (
    <div className="p-5 space-y-4 overflow-y-auto h-full text-xs">
      {/* Header Standard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
        <div className="flex items-center space-x-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Sprint Execution & Burndown
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              Capacity management, sprint velocity, and burndown trajectory
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="ent-input text-xs"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.key})
              </option>
            ))}
          </select>

          <select
            value={selectedSprintId}
            onChange={(e) => setSelectedSprintId(e.target.value)}
            className="ent-input text-xs font-semibold"
          >
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.status})
              </option>
            ))}
          </select>

          {isManager && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="ent-btn-primary flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Sprint</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="ent-toolbar flex items-center space-x-1 p-1 rounded-full text-xs font-medium w-fit">
        {[
          { id: 'dashboard', label: 'Sprint Dashboard' },
          { id: 'planning', label: 'Sprint Backlog Planning' },
          { id: 'velocity', label: 'Team Velocity' },
          { id: 'history', label: `All Sprints (${sprints.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-olive text-canvas shadow-xs font-bold'
                : 'text-ink-muted hover:text-ink hover:bg-canvas'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: SPRINT DASHBOARD */}
      {activeTab === 'dashboard' && activeSprint && metrics && (
        <div className="space-y-4">
          <div className="ent-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{activeSprint.name}</h2>
                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                    activeSprint.status === 'ACTIVE' ? 'badge-green' : 'badge-slate'
                  }`}
                >
                  {activeSprint.status}
                </span>
              </div>
              <p className="text-slate-400 text-xs">Goal: {activeSprint.goal || 'No goal set'}</p>
              <div className="text-[10px] font-mono text-slate-500 flex items-center space-x-1">
                <Calendar className="w-3 h-3 text-blue-500" />
                <span>
                  {new Date(activeSprint.startDate).toLocaleDateString()} — {new Date(activeSprint.endDate).toLocaleDateString()}
                </span>
              </div>
            </div>

            {isManager && (
              <div className="flex items-center space-x-2">
                {activeSprint.status === 'PLANNED' && (
                  <button
                    onClick={() => handleStartSprint(activeSprint.id)}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded text-xs flex items-center space-x-1"
                  >
                    <Play className="w-3 h-3" />
                    <span>Start Sprint</span>
                  </button>
                )}
                {activeSprint.status === 'ACTIVE' && (
                  <button
                    onClick={() => setCompletingSprint(activeSprint)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded text-xs flex items-center space-x-1"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Complete Sprint</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
            <div className="ent-card p-3">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Committed Points</span>
              <div className="text-lg font-bold text-slate-100">{metrics.committedPoints} pts</div>
            </div>

            <div className="ent-card p-3">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Completed Points</span>
              <div className="text-lg font-bold text-emerald-400">{metrics.completedPoints} pts</div>
            </div>

            <div className="ent-card p-3">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Remaining Points</span>
              <div className="text-lg font-bold text-amber-400">{metrics.remainingPoints} pts</div>
            </div>

            <div className="ent-card p-3">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Progress</span>
              <div className="text-lg font-bold text-blue-400">{metrics.completionPercentage}%</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 ent-panel p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Sprint Burndown Chart
              </h3>
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.burndownData}>
                    <XAxis dataKey="day" stroke="#66705D" fontSize={10} tickLine={false} />
                    <YAxis stroke="#66705D" fontSize={10} tickLine={false} unit=" pts" />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--surface-primary)', borderColor: 'var(--border-warm)', borderRadius: '12px', fontSize: '11px', color: 'var(--ink-primary)' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                    <Line type="monotone" dataKey="ideal" name="Ideal" stroke="#66705D" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="actual" name="Actual Remaining" stroke="#7F8500" strokeWidth={2.5} dot={{ r: 3.5, fill: '#EAF04B', stroke: '#7F8500' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="ent-panel p-4 space-y-3">
              <div className="flex items-center space-x-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Sprint Member Allocation
                </h3>
              </div>

              <div className="space-y-2">
                {capacity.map((cap) => (
                  <div
                    key={cap.userId}
                    className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center space-x-2">
                      <img src={cap.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
                      <span className="text-slate-800 dark:text-slate-200 font-sans font-semibold">{cap.fullName}</span>
                    </div>
                    <span className={cap.isOverCapacity ? 'text-rose-500 font-bold' : 'text-slate-400'}>
                      {cap.assignedHours}/{cap.capacityHours}h
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PLANNING */}
      {activeTab === 'planning' && activeSprint && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="ent-panel p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Backlog Pool ({backlogItems.length})
              </span>
              <span className="font-mono text-blue-500 font-bold">
                {backlogItems.reduce((acc, i) => acc + (i.storyPoints || 0), 0)} pts
              </span>
            </div>

            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
              {backlogItems.map((item) => (
                <div key={item.id} className="p-2.5 ent-card flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <span className="font-mono font-bold text-blue-500 mr-2">{item.humanId}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{item.title}</span>
                  </div>
                  <button
                    onClick={() => handleMoveToSprint(item.id, activeSprint.id)}
                    className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded text-[10px] shrink-0"
                  >
                    + Add to Sprint
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="ent-panel p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {activeSprint.name} Sprint Scope ({activeSprint.workItems?.length || 0})
              </span>
              <span className="font-mono text-emerald-500 font-bold">
                {activeSprint.workItems?.reduce((acc, i) => acc + (i.storyPoints || 0), 0)} pts
              </span>
            </div>

            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
              {activeSprint.workItems?.map((item) => (
                <div key={item.id} className="p-2.5 ent-card flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <span className="font-mono font-bold text-blue-500 mr-2">{item.humanId}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{item.title}</span>
                  </div>
                  <button
                    onClick={() => handleMoveToSprint(item.id, null)}
                    className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-700 dark:text-slate-300 font-medium rounded text-[10px] shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: VELOCITY */}
      {activeTab === 'velocity' && velocity && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 font-mono">
            <div className="ent-card p-3">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Average Velocity</span>
              <div className="text-xl font-bold text-blue-500">{velocity.avgVelocity} Story Points</div>
            </div>
            <div className="ent-card p-3">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Recent 3 Sprint Average</span>
              <div className="text-xl font-bold text-emerald-500">{velocity.last3Avg} Story Points</div>
            </div>
          </div>

          <div className="ent-panel p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Sprint Delivery Velocity History
            </h3>
            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={velocity.velocityHistory}>
                  <XAxis dataKey="sprintName" stroke="#66705D" fontSize={10} tickLine={false} />
                  <YAxis stroke="#66705D" fontSize={10} tickLine={false} unit=" pts" />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--surface-primary)', borderColor: 'var(--border-warm)', borderRadius: '12px', fontSize: '11px', color: 'var(--ink-primary)' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  <Bar dataKey="committedPoints" name="Committed" fill="#927000" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completedPoints" name="Completed" fill="#7F8500" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-2">
          {sprints.map((s) => (
            <div key={s.id} className="p-3 ent-card flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-slate-900 dark:text-slate-100">{s.name}</div>
                <div className="text-[10px] font-mono text-slate-500">
                  {new Date(s.startDate).toLocaleDateString()} — {new Date(s.endDate).toLocaleDateString()}
                </div>
              </div>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${s.status === 'ACTIVE' ? 'badge-green' : 'badge-slate'}`}>
                {s.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {isCreateOpen && <CreateSprintModal onClose={() => setIsCreateOpen(false)} onCreated={loadData} />}
      {completingSprint && (
        <SprintCompletionModal
          sprint={completingSprint}
          onClose={() => setCompletingSprint(null)}
          onCompleted={loadData}
        />
      )}
      {selectedItem && (
        <WorkItemSideDrawer item={selectedItem} onClose={() => setSelectedItem(null)} onUpdated={loadData} />
      )}
    </div>
  );
};
