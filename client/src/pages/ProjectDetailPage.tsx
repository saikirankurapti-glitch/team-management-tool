import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  Kanban,
  ListOrdered,
  Zap,
  MessageSquare,
  BarChart3,
  FileText,
  BookOpen,
  LayoutGrid,
  Users,
  Code2,
  Calendar,
  Calculator,
  FolderTree,
  DollarSign,
  Sliders,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { fetchApi } from '../services/api';
import { Project } from '../types';
import { useAuth } from '../context/AuthContext';
import { canAccessAdmin, canAccessPriceAllocation, canAccessRestrictedManagement } from '../utils/rbac';
import { ProjectDevelopmentView } from '../components/github/ProjectDevelopmentView';
import { TimelineGanttView } from '../components/planning/TimelineGanttView';
import { SoftwareEstimationView } from '../components/planning/SoftwareEstimationView';
import { WorkBreakdownStructureView } from '../components/planning/WorkBreakdownStructureView';
import { ResourceAllocationView } from '../components/planning/ResourceAllocationView';
import { ProjectPricingView } from '../components/planning/ProjectPricingView';
import { ScenarioModelingView } from '../components/planning/ScenarioModelingView';
import { PlannedVsActualView } from '../components/planning/PlannedVsActualView';

type ProjectTab =
  | 'overview'
  | 'timeline'
  | 'estimation'
  | 'wbs'
  | 'resources'
  | 'pricing'
  | 'scenarios'
  | 'variance'
  | 'development';

export const ProjectDetailPage: React.FC = () => {
  const { key } = useParams<{ key: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { user } = useAuth();
  const isAdmin = canAccessAdmin(user?.role);
  const canSeePriceAllocation = canAccessPriceAllocation(user?.role);
  const canSeeRestrictedTabs = canAccessRestrictedManagement(user?.role);

  const initialTab = (searchParams.get('tab') as ProjectTab) || 'overview';
  const [currentTab, setCurrentTab] = useState<ProjectTab>(initialTab);

  // If unauthorized user lands directly on a restricted tab, fall back to 'overview'
  useEffect(() => {
    // Restricted management tabs (Timeline, Estimation, WBS, Commercial Pricing, Scenarios, Planned vs Actual) -> Admin ONLY
    const adminRestrictedTabs: ProjectTab[] = ['timeline', 'estimation', 'wbs', 'pricing', 'scenarios', 'variance'];
    if (adminRestrictedTabs.includes(currentTab) && !canSeeRestrictedTabs) {
      setCurrentTab('overview');
      setSearchParams({ tab: 'overview' });
    } else if (currentTab === 'resources' && !canSeePriceAllocation) {
      // Price Allocation -> Admin & CTO/Manager ONLY
      setCurrentTab('overview');
      setSearchParams({ tab: 'overview' });
    }
  }, [currentTab, canSeeRestrictedTabs, canSeePriceAllocation]);

  const handleTabChange = (tab: ProjectTab) => {
    setCurrentTab(tab);
    setSearchParams({ tab });
  };

  useEffect(() => {
    if (key) {
      fetchApi<Project>(`/projects/${key}`)
        .then((data) => setProject(data))
        .catch((err) => console.error(err))
        .finally(() => setIsLoading(false));
    }
  }, [key]);

  if (isLoading) {
    return <div className="p-8 text-xs font-mono text-ink-muted">Loading project workspace...</div>;
  }

  if (!project) {
    return <div className="p-8 text-xs text-status-error font-medium">Project not found.</div>;
  }

  return (
    <div className="p-6 md:p-10 space-y-6 overflow-y-auto h-full text-xs bg-canvas select-none">
      {/* Project Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-borderWarm pb-4 gap-3">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="editorial-eyebrow text-[9px]">
              {project.key}
            </span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${project.health === 'HEALTHY' ? 'badge-green' : 'badge-amber'}`}>
              {project.health}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-ink tracking-tight">{project.name}</h1>
          <p className="text-sm text-ink-muted max-w-2xl">{project.description}</p>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            to={`/boards?project=${project.id}`}
            className="btn-pill-primary px-3.5 py-1.5 font-bold flex items-center space-x-1.5 shadow-xs"
          >
            <Kanban className="w-3.5 h-3.5" />
            <span>Open Board</span>
          </Link>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex items-center space-x-1 border-b border-borderWarm pb-2 overflow-x-auto">
        {[
          { id: 'overview' as ProjectTab, label: 'Overview', icon: LayoutGrid, visible: true },
          { id: 'timeline' as ProjectTab, label: 'Timeline / Gantt', icon: Calendar, visible: canSeeRestrictedTabs },
          { id: 'estimation' as ProjectTab, label: 'Estimation', icon: Calculator, visible: canSeeRestrictedTabs },
          { id: 'wbs' as ProjectTab, label: 'WBS Tree', icon: FolderTree, visible: canSeeRestrictedTabs },
          { id: 'resources' as ProjectTab, label: 'Price Allocation', icon: UserCheck, visible: canSeePriceAllocation },
          { id: 'pricing' as ProjectTab, label: 'Commercial Pricing', icon: DollarSign, visible: canSeeRestrictedTabs },
          { id: 'scenarios' as ProjectTab, label: 'Scenarios', icon: Sliders, visible: canSeeRestrictedTabs },
          { id: 'variance' as ProjectTab, label: 'Planned vs Actual', icon: TrendingUp, visible: canSeeRestrictedTabs },
          { id: 'development' as ProjectTab, label: 'Development Hub', icon: Code2, visible: true },
        ]
          .filter((t) => t.visible)
          .map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-3 py-1.5 font-semibold text-xs rounded-full flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-olive-dark text-canvas'
                    : 'text-ink-secondary hover:text-ink hover:bg-surface-hover'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
      </div>

      {/* Main Tab Content */}
      {currentTab === 'timeline' && canSeeRestrictedTabs && <TimelineGanttView projectId={project.id} />}
      {currentTab === 'estimation' && canSeeRestrictedTabs && <SoftwareEstimationView projectId={project.id} />}
      {currentTab === 'wbs' && canSeeRestrictedTabs && <WorkBreakdownStructureView projectId={project.id} />}
      {currentTab === 'resources' && canSeePriceAllocation && <ResourceAllocationView projectId={project.id} />}
      {currentTab === 'pricing' && canSeeRestrictedTabs && <ProjectPricingView projectId={project.id} />}
      {currentTab === 'scenarios' && canSeeRestrictedTabs && <ScenarioModelingView projectId={project.id} />}
      {currentTab === 'variance' && canSeeRestrictedTabs && <PlannedVsActualView projectId={project.id} />}
      {currentTab === 'development' && <ProjectDevelopmentView projectId={project.id} />}

      {currentTab === 'overview' && (
        <div className="space-y-6">
          {/* Management & Restricted Summary Panels */}
          {(canSeePriceAllocation || canSeeRestrictedTabs) && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {canSeeRestrictedTabs && (
                <>
                  <button
                    onClick={() => handleTabChange('timeline')}
                    className="card-cream p-4 space-y-1.5 text-left"
                  >
                    <Calendar className="w-4 h-4 text-olive-dark" />
                    <div className="font-bold text-ink text-sm">Timeline & Gantt</div>
                    <div className="text-[11px] text-ink-muted">Critical path, CPM schedule & milestones</div>
                  </button>

                  <button
                    onClick={() => handleTabChange('estimation')}
                    className="card-cream p-4 space-y-1.5 text-left"
                  >
                    <Calculator className="w-4 h-4 text-olive-dark" />
                    <div className="font-bold text-ink text-sm">Software Estimation</div>
                    <div className="text-[11px] text-ink-muted">PERT 3-point, story points & audit trail</div>
                  </button>
                </>
              )}

              {canSeePriceAllocation && (
                <button
                  onClick={() => handleTabChange('resources')}
                  className="card-cream p-4 space-y-1.5 text-left"
                >
                  <UserCheck className="w-4 h-4 text-olive-dark" />
                  <div className="font-bold text-ink text-sm">Price Allocation</div>
                  <div className="text-[11px] text-ink-muted">Resource billing rates & capacity planning</div>
                </button>
              )}

              {canSeeRestrictedTabs && (
                <button
                  onClick={() => handleTabChange('pricing')}
                  className="card-cream p-4 space-y-1.5 text-left"
                >
                  <DollarSign className="w-4 h-4 text-olive-dark" />
                  <div className="font-bold text-ink text-sm">Commercial Pricing</div>
                  <div className="text-[11px] text-ink-muted">T&M, Fixed Price, cost, margins & taxes</div>
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link to={`/boards?project=${project.id}`} className="card-cream p-4 space-y-1.5">
              <Kanban className="w-4 h-4 text-olive-dark" />
              <div className="font-bold text-ink text-sm">Kanban Board</div>
              <div className="text-[11px] text-ink-muted">Task workflow columns & statuses</div>
            </Link>

            <Link to={`/backlogs?project=${project.id}`} className="card-cream p-4 space-y-1.5">
              <ListOrdered className="w-4 h-4 text-olive-dark" />
              <div className="font-bold text-ink text-sm">Backlog</div>
              <div className="text-[11px] text-ink-muted">Hierarchy & backlog prioritization</div>
            </Link>

            <Link to={`/sprints?project=${project.id}`} className="card-cream p-4 space-y-1.5">
              <Zap className="w-4 h-4 text-olive-dark" />
              <div className="font-bold text-ink text-sm">Sprints</div>
              <div className="text-[11px] text-ink-muted">Sprint planning & burndown</div>
            </Link>

            <button
              onClick={() => handleTabChange('development')}
              className="card-cream p-4 space-y-1.5 text-left"
            >
              <Code2 className="w-4 h-4 text-olive-dark" />
              <div className="font-bold text-ink text-sm">Development Hub</div>
              <div className="text-[11px] text-ink-muted">Branches, PRs, CI status & commits</div>
            </button>
          </div>

          {/* Members Section */}
          <div className="card-cream p-6 space-y-4">
            <div className="flex items-center space-x-2 border-b border-borderWarm pb-3">
              <Users className="w-4 h-4 text-olive-dark" />
              <h2 className="text-xs font-bold text-ink uppercase tracking-wider">
                Assigned Project Members ({project.members?.length || 0})
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {project.members?.map((m) => (
                <div key={m.user.id} className="p-3 bg-canvas-secondary rounded-xl border border-borderWarm/80 flex items-center space-x-3">
                  <img src={m.user.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-borderWarm" />
                  <div className="min-w-0 truncate">
                    <div className="font-bold text-ink truncate">{m.user.fullName}</div>
                    <div className="text-[10px] text-ink-muted font-mono">{m.user.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
