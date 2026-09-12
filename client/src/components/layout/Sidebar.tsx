import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  CheckCircle2,
  FolderKanban,
  Kanban,
  ListOrdered,
  Zap,
  MessageSquare,
  Users,
  Calendar,
  BarChart3,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Sparkles,
  ShieldCheck,
  CreditCard,
  Code2,
  BookOpen,
  Activity,
  Sliders,
  UserCheck,
  Calculator,
  DollarSign,
  LayoutGrid,
  GitBranch,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchApi } from '../../services/api';
import { Project } from '../../types';
import { canAccessAdmin, canAccessManagement } from '../../utils/rbac';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({
    PROJ: true,
  });

  useEffect(() => {
    fetchApi<Project[]>('/projects')
      .then((data) => setProjects(data))
      .catch((err) => console.error('Failed to load projects for sidebar', err));
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  const toggleProject = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedProjects((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isAdmin = canAccessAdmin(user?.role);
  const isManager = canAccessManagement(user?.role);

  const navGroups = [
    {
      group: 'WORKSPACE',
      items: [
        { label: 'Home', icon: Home, path: '/' },
        { label: 'My Work', icon: CheckCircle2, path: '/my-work', badge: 'Daily' },
        { label: 'Projects', icon: FolderKanban, path: '/projects' },
        { label: 'Teams', icon: Users, path: '/teams' },
      ],
    },
    {
      group: 'DELIVERY',
      items: [
        { label: 'Backlog', icon: ListOrdered, path: '/backlogs' },
        { label: 'Board', icon: Kanban, path: '/boards' },
        { label: 'Sprints', icon: Zap, path: '/sprints' },
        ...(isManager ? [{ label: 'Capacity', icon: UserCheck, path: '/capacity' }] : []),
      ],
    },
    {
      group: 'COLLABORATION',
      items: [
        { label: 'Chat', icon: MessageSquare, path: '/chat' },
        { label: 'Calendar', icon: Calendar, path: '/calendar' },
        { label: 'Files', icon: FileText, path: '/files' },
        { label: 'Knowledge', icon: BookOpen, path: '/knowledge' },
      ],
    },
    {
      group: 'ENGINEERING',
      items: [
        { label: 'GitHub & Integrations', icon: GitBranch, path: '/integrations' },
        ...(isAdmin ? [{ label: 'Developer Apps', icon: Code2, path: '/settings/developer-apps' }] : []),
      ],
    },
    {
      group: 'INTELLIGENCE',
      items: [
        { label: 'Analytics', icon: BarChart3, path: '/analytics' },
        ...(isAdmin
          ? [
              { label: 'Governance', icon: ShieldCheck, path: '/governance' },
              { label: 'Ops Dashboard', icon: Activity, path: '/ops' },
            ]
          : []),
      ],
    },
    ...(isAdmin
      ? [
          {
            group: 'ADMINISTRATION',
            items: [
              { label: 'Security & Access', icon: ShieldCheck, path: '/settings/security' },
              { label: 'Billing & Plans', icon: CreditCard, path: '/settings/billing' },
              { label: 'AI Configuration', icon: Sparkles, path: '/settings/ai' },
              { label: 'Settings', icon: Settings, path: '/settings' },
            ],
          },
        ]
      : [
          {
            group: 'SETTINGS',
            items: [{ label: 'Settings', icon: Settings, path: '/settings' }],
          },
        ]),
  ];

  return (
    <aside
      className={`bg-canvas border-r border-borderWarm flex flex-col h-screen select-none shrink-0 transition-all duration-200 z-30 ${
        isCollapsed ? 'w-[68px]' : 'w-[240px]'
      }`}
    >
      {/* Top Workspace Context Header */}
      <div className="h-14 px-3.5 border-b border-borderWarm flex items-center justify-between shrink-0 bg-canvas">
        {!isCollapsed && (
          <div className="flex items-center space-x-2.5 min-w-0">
            {/* TMP Brand Logo */}
            <div className="w-7 h-7 rounded-lg bg-olive-dark flex items-center justify-center text-canvas text-xs font-black tracking-tight shrink-0 shadow-xs">
              T
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-extrabold tracking-tight text-ink uppercase">
                  TMP
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-lime" />
              </div>
              <span className="text-[10px] text-ink-muted font-mono tracking-tight block">
                Engineering OS
              </span>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="w-7 h-7 rounded-lg bg-olive-dark flex items-center justify-center text-canvas text-xs font-black mx-auto shadow-xs">
            T
          </div>
        )}

        <button
          onClick={toggleCollapse}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className="p-1 text-ink-muted hover:text-ink hover:bg-surface-hover rounded-md transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav List Scroll Area */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
        {navGroups.map((group) => (
          <div key={group.group}>
            {!isCollapsed && (
              <div className="px-2 mb-1 text-[10px] font-bold tracking-eyebrow text-ink-muted uppercase">
                {group.group}
              </div>
            )}
            <nav className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={isCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-lime/30 text-ink font-bold border-l-3 border-olive-dark'
                        : 'text-ink-secondary hover:text-ink hover:bg-surface-hover'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`
                  }
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <item.icon className="w-4 h-4 shrink-0 text-olive-dark" />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!isCollapsed && item.badge && (
                    <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-lime text-ink rounded-full">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}

        {/* Projects Tree Section */}
        {!isCollapsed && projects.length > 0 && (
          <div className="pt-2 border-t border-borderWarm/60">
            <div className="px-2 mb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-eyebrow text-ink-muted uppercase">
                PROJECTS
              </span>
              <NavLink to="/projects" className="text-[10px] text-olive-dark hover:underline font-semibold">
                View All
              </NavLink>
            </div>
            <div className="space-y-0.5">
              {projects.slice(0, 4).map((proj) => {
                const isExpanded = expandedProjects[proj.key];
                const isProjActive = location.pathname.startsWith(`/projects/${proj.key}`);

                return (
                  <div key={proj.id}>
                    <div
                      onClick={(e) => toggleProject(proj.key, e)}
                      className={`flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                        isProjActive ? 'bg-lime/20 text-ink font-semibold' : 'text-ink-secondary hover:text-ink hover:bg-surface-hover'
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <FolderKanban className="w-3.5 h-3.5 text-olive-dark shrink-0" />
                        <span className="truncate">{proj.name}</span>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        <span className="text-[9px] font-mono px-1 py-0.2 bg-surface-secondary text-ink-muted rounded">
                          {proj.key}
                        </span>
                        {isExpanded ? <ChevronDown className="w-3 h-3 text-ink-muted" /> : <ChevronRight className="w-3 h-3 text-ink-muted" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="pl-4 space-y-0.5 border-l border-borderWarm ml-3 my-0.5">
                        <NavLink
                          to={`/projects/${proj.key}`}
                          className={({ isActive }) =>
                            `flex items-center space-x-2 px-2 py-1 text-[11px] rounded transition-colors ${
                              isActive ? 'bg-lime/30 text-ink font-bold' : 'text-ink-secondary hover:text-ink hover:bg-surface-hover'
                            }`
                          }
                        >
                          <LayoutGrid className="w-3 h-3 text-olive-dark" />
                          <span>Overview</span>
                        </NavLink>
                        <NavLink
                          to={`/projects/${proj.key}/board`}
                          className={({ isActive }) =>
                            `flex items-center space-x-2 px-2 py-1 text-[11px] rounded transition-colors ${
                              isActive ? 'bg-lime/30 text-ink font-bold' : 'text-ink-secondary hover:text-ink hover:bg-surface-hover'
                            }`
                          }
                        >
                          <Kanban className="w-3 h-3 text-olive-dark" />
                          <span>Board</span>
                        </NavLink>
                        <NavLink
                          to={`/projects/${proj.key}/backlog`}
                          className={({ isActive }) =>
                            `flex items-center space-x-2 px-2 py-1 text-[11px] rounded transition-colors ${
                              isActive ? 'bg-lime/30 text-ink font-bold' : 'text-ink-secondary hover:text-ink hover:bg-surface-hover'
                            }`
                          }
                        >
                          <ListOrdered className="w-3 h-3 text-olive-dark" />
                          <span>Backlog</span>
                        </NavLink>
                        <NavLink
                          to={`/projects/${proj.key}/sprints`}
                          className={({ isActive }) =>
                            `flex items-center space-x-2 px-2 py-1 text-[11px] rounded transition-colors ${
                              isActive ? 'bg-lime/30 text-ink font-bold' : 'text-ink-secondary hover:text-ink hover:bg-surface-hover'
                            }`
                          }
                        >
                          <Zap className="w-3 h-3 text-olive-dark" />
                          <span>Sprints</span>
                        </NavLink>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* User Profile Footer */}
      {user && (
        <div className="p-2.5 border-t border-borderWarm bg-canvas flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <img
              src={user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
              alt={user.fullName}
              className="w-7 h-7 rounded-full object-cover ring-1 ring-borderWarm shrink-0"
            />
            {!isCollapsed && (
              <div className="truncate min-w-0">
                <div className="text-xs font-bold text-ink truncate leading-tight">
                  {user.fullName}
                </div>
                <div className="text-[10px] text-ink-muted font-mono truncate">
                  {user.role}
                </div>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 text-ink-muted hover:text-status-error hover:bg-status-error/10 rounded-md transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </aside>
  );
};
