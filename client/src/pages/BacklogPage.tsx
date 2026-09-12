import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  ListOrdered,
  Plus,
  GitBranch,
} from 'lucide-react';
import { fetchApi } from '../services/api';
import { WorkItem, Project, Sprint } from '../types';
import { WorkItemSideDrawer } from '../components/common/WorkItemSideDrawer';
import { CreateWorkItemModal } from '../components/common/CreateWorkItemModal';

export const BacklogPage: React.FC = () => {
  const { key } = useParams<{ key?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initial load projects
  useEffect(() => {
    fetchApi<Project[]>('/projects')
      .then((projData) => setProjects(projData))
      .catch((err) => console.error(err));
  }, []);

  // Determine active project ID based on route / query params / projects
  useEffect(() => {
    if (projects.length === 0) return;

    const routeParam = key || searchParams.get('project') || searchParams.get('projectId') || searchParams.get('key');
    let matchingProj: Project | undefined;

    if (routeParam) {
      matchingProj = projects.find((p) => p.key === routeParam || p.id === routeParam);
    }

    if (matchingProj) {
      setSelectedProjectId(matchingProj.id);
    } else if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [key, searchParams, projects]);

  const loadData = () => {
    setIsLoading(true);
    const itemQuery = selectedProjectId ? `/work-items?projectId=${selectedProjectId}` : '/work-items';
    const sprintQuery = selectedProjectId ? `/sprints?projectId=${selectedProjectId}` : '/sprints';

    Promise.all([
      fetchApi<WorkItem[]>(itemQuery),
      fetchApi<Sprint[]>(sprintQuery),
    ])
      .then(([itemData, sprintData]) => {
        setWorkItems(itemData);
        setSprints(sprintData);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  };

  // Load project-scoped work items and sprints
  useEffect(() => {
    loadData();
  }, [selectedProjectId]);

  const handleProjectSelect = (projId: string) => {
    setSelectedProjectId(projId);
    const targetProj = projects.find((p) => p.id === projId);
    if (targetProj) {
      navigate(`/projects/${targetProj.key}/backlog`);
    } else {
      navigate('/backlogs');
    }
  };

  const currentProject = projects.find(p => p.id === selectedProjectId);

  const reloadProjectData = () => {
    if (selectedProjectId) {
      setIsLoading(true);
      Promise.all([
        fetchApi<WorkItem[]>(`/work-items?projectId=${selectedProjectId}`),
        fetchApi<Sprint[]>(`/sprints?projectId=${selectedProjectId}`),
      ])
        .then(([itemData, sprintData]) => {
          setWorkItems(itemData);
          setSprints(sprintData);
        })
        .finally(() => setIsLoading(false));
    }
  };

  const handleSprintAssign = async (itemId: string, sprintId: string) => {
    try {
      await fetchApi(`/work-items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ sprintId: sprintId || null }),
      });
      reloadProjectData();
    } catch (err) {
      console.error('Failed to assign sprint', err);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-xs font-mono text-ink-muted">Loading backlog tree...</div>;
  }

  const filteredItems = workItems.filter((i) => !selectedProjectId || i.projectId === selectedProjectId);
  const epics = filteredItems.filter((i) => i.type === 'EPIC');
  const nonEpics = filteredItems.filter((i) => i.type !== 'EPIC');

  return (
    <div className="p-6 md:p-10 space-y-8 overflow-y-auto h-full text-xs bg-canvas select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-borderWarm pb-4 gap-3">
        <div className="space-y-1">
          <div className="editorial-eyebrow text-[9px] flex items-center space-x-1">
            <span>PROJECTS</span>
            {currentProject && (
              <>
                <span>/</span>
                <span className="font-bold text-olive-dark">{currentProject.name} ({currentProject.key})</span>
              </>
            )}
            <span>/</span>
            <span>BACKLOG</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-ink tracking-tight">
            {currentProject ? `${currentProject.name} Backlog` : 'Delivery Backlog'}
          </h1>
          <p className="text-sm text-ink-muted">
            Epics, features, user stories, and sprint assignments
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={selectedProjectId}
            onChange={(e) => handleProjectSelect(e.target.value)}
            className="input-warm h-9 text-xs"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.key})
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="btn-pill-primary h-9 px-4 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Item</span>
          </button>
        </div>
      </div>

      {/* Epics Tree Panel */}
      <div className="card-cream p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-borderWarm pb-3">
          <span className="font-bold text-xs text-ink uppercase tracking-wider">
            Epics & Features Hierarchy
          </span>
          <span className="editorial-eyebrow text-[9px]">
            {epics.length} Epics Defined
          </span>
        </div>

        <div className="space-y-4">
          {epics.map((epic) => (
            <div key={epic.id} className="p-4 bg-canvas-secondary rounded-xl border border-borderWarm/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <GitBranch className="w-4 h-4 text-olive-dark" />
                  <span className="font-mono font-bold text-olive-dark">{epic.humanId}</span>
                  <span className="font-bold text-ink text-sm">{epic.title}</span>
                  <span className="text-[9px] font-mono uppercase bg-surface text-ink-muted px-2 py-0.5 rounded-full font-bold border border-borderWarm">
                    EPIC
                  </span>
                </div>
                <span className="font-mono text-[10px] text-ink-muted font-semibold">{epic.status}</span>
              </div>

              {/* Children Under Epic */}
              <div className="pl-4 space-y-2 border-l-2 border-borderWarm ml-2">
                {filteredItems
                  .filter((i) => i.parentId === epic.id)
                  .map((child) => (
                    <div
                      key={child.id}
                      onClick={() => setSelectedItem(child)}
                      className="p-2.5 bg-surface rounded-lg border border-borderWarm/80 cursor-pointer flex items-center justify-between hover:border-olive-dark transition-colors"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span className="font-mono font-bold text-olive-dark">{child.humanId}</span>
                        <span className="font-semibold text-ink truncate max-w-xs">{child.title}</span>
                        <span className="text-[9px] font-mono text-ink-muted uppercase">{child.type}</span>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0">
                        <select
                          value={child.sprintId || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleSprintAssign(child.id, e.target.value)}
                          className="input-warm text-[11px] h-7 py-0 px-2 rounded-full"
                        >
                          <option value="">Backlog (Unassigned)</option>
                          {sprints.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>

                        <span className="font-mono font-bold text-olive-dark bg-lime/30 px-2 py-0.5 rounded-full">{child.storyPoints || 0} pts</span>
                        {child.assignee && (
                          <img
                            src={child.assignee.avatarUrl || ''}
                            alt=""
                            className="w-5 h-5 rounded-full object-cover ring-1 ring-borderWarm"
                          />
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Flat Backlog Queue */}
      <div className="card-cream p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-borderWarm pb-3">
          <span className="font-bold text-xs text-ink uppercase tracking-wider">
            Unassigned Backlog Items
          </span>
          <span className="font-mono text-[11px] text-ink-muted font-medium">
            {nonEpics.filter((i) => !i.sprintId).length} Items Pending Sprint
          </span>
        </div>

        <div className="space-y-2">
          {nonEpics
            .filter((i) => !i.sprintId)
            .map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="p-3 bg-canvas-secondary rounded-xl border border-borderWarm/80 cursor-pointer flex items-center justify-between text-xs hover:border-olive-dark transition-colors"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <span className="font-mono font-bold text-olive-dark">{item.humanId}</span>
                  <span className="font-semibold text-ink truncate max-w-sm">{item.title}</span>
                  <span className="text-[9px] font-mono text-ink-muted uppercase">{item.type}</span>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <select
                    value={item.sprintId || ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleSprintAssign(item.id, e.target.value)}
                    className="input-warm text-[11px] h-7 py-0 px-2 rounded-full"
                  >
                    <option value="">Assign Sprint...</option>
                    {sprints.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <span className="font-mono font-bold text-olive-dark bg-lime/30 px-2 py-0.5 rounded-full">{item.storyPoints || 0} pts</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {selectedItem && (
        <WorkItemSideDrawer item={selectedItem} onClose={() => setSelectedItem(null)} onUpdated={loadData} />
      )}
      {isCreateOpen && (
        <CreateWorkItemModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={loadData}
          defaultProjectId={selectedProjectId}
        />
      )}
    </div>
  );
};
