import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { fetchApi } from '../services/api';
import { WorkItem } from '../types';
import { WorkItemSideDrawer } from '../components/common/WorkItemSideDrawer';
import { CreateWorkItemModal } from '../components/common/CreateWorkItemModal';
import { useAuth } from '../context/AuthContext';

export const MyWorkPage: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<WorkItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'today' | 'upcoming' | 'overdue' | 'blocked'>('all');

  const loadMyWork = () => {
    fetchApi<WorkItem[]>('/work-items?isMyWork=true')
      .then((data) => setItems(data))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadMyWork();
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 p-8 text-xs font-mono text-brand-muted bg-[#070b12] flex items-center space-x-2">
        <span className="w-2 h-2 rounded-full bg-brand-lime animate-pulse" />
        <span>Loading your personal operational queue...</span>
      </div>
    );
  }

  const now = new Date();

  const blockedCount = items.filter((i) => i.status === 'BLOCKED').length;
  const overdueCount = items.filter((i) => i.status !== 'DONE' && i.dueDate && new Date(i.dueDate) < now).length;
  const todayCount = items.filter((i) => i.status !== 'DONE' && i.dueDate && new Date(i.dueDate).toDateString() === now.toDateString()).length;
  const upcomingCount = items.filter((i) => i.status !== 'DONE' && i.dueDate && new Date(i.dueDate) > now).length;

  const filteredItems = items.filter((i) => {
    if (filterTab === 'overdue') {
      return i.status !== 'DONE' && i.dueDate && new Date(i.dueDate) < now;
    }
    if (filterTab === 'blocked') {
      return i.status === 'BLOCKED';
    }
    if (filterTab === 'today') {
      return i.status !== 'DONE' && i.dueDate && new Date(i.dueDate).toDateString() === now.toDateString();
    }
    if (filterTab === 'upcoming') {
      return i.status !== 'DONE' && i.dueDate && new Date(i.dueDate) > now;
    }
    return true;
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'DONE':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
      case 'IN_PROGRESS':
      case 'CODE_REVIEW':
      case 'TESTING':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/30';
      case 'BLOCKED':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/30';
      default:
        return 'bg-slate-800/80 text-slate-400 border border-slate-700/60';
    }
  };

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'text-brand-accentRed font-bold';
      case 'HIGH':
        return 'text-brand-accentAmber font-bold';
      case 'MEDIUM':
        return 'text-slate-300 font-medium';
      default:
        return 'text-slate-400 font-medium';
    }
  };

  return (
    <div className="w-full min-h-full p-6 md:p-8 space-y-6 bg-[#070b12] text-slate-200 font-sans select-none">
      {/* Header Banner Section matching Stitch design reference */}
      <header className="space-y-3">
        <div className="space-y-3 max-w-4xl">
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-brand-lime/10 text-brand-lime border border-brand-lime/25 font-mono">
            MY WORK
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Everything that <span className="text-brand-lime">needs your attention.</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl leading-relaxed">
            Your personal operational queue across assigned deliverables, code reviews, and blocked tasks.
          </p>

          {/* Counter Summary Pills matching Stitch reference */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#0f141e] border border-brand-border text-xs text-slate-300 font-medium">
              <span className="text-slate-400">Total:</span>
              <span className="font-mono font-bold text-white text-sm">{items.length}</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-rose-950/20 border border-brand-accentRed/40 text-xs text-rose-300 font-medium">
              <span className="text-rose-400">Blocked:</span>
              <span className="font-mono font-bold text-brand-accentRed text-sm">{blockedCount}</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-950/20 border border-brand-accentAmber/40 text-xs text-amber-300 font-medium">
              <span className="text-amber-400">Overdue:</span>
              <span className="font-mono font-bold text-brand-accentAmber text-sm">{overdueCount}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Filter Navigation Tabs matching Stitch reference */}
      <div className="flex items-center gap-2 border-b border-brand-border/60 pb-3 overflow-x-auto text-xs font-medium">
        {[
          { id: 'all', label: 'All Assigned', count: items.length },
          { id: 'today', label: 'Due Today', count: todayCount },
          { id: 'upcoming', label: 'Upcoming', count: upcomingCount },
          { id: 'overdue', label: 'Overdue', count: overdueCount },
          { id: 'blocked', label: 'Blocked', count: blockedCount },
        ].map((tab) => {
          const isActive = filterTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-brand-lime text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-[#11192a] border border-transparent hover:border-brand-border'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[11px] ${isActive ? 'opacity-80 font-mono' : 'text-slate-500 font-mono'}`}>
                ({tab.count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Work Items Table Container matching Stitch reference */}
      <section className="rounded-xl border border-brand-border bg-[#0b1220] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            {/* Table Header */}
            <thead>
              <tr className="border-b border-brand-border bg-[#0e1627] text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold w-28">ID</th>
                <th className="py-3 px-4 font-semibold">TITLE</th>
                <th className="py-3 px-4 font-semibold">PROJECT</th>
                <th className="py-3 px-4 font-semibold">STATUS</th>
                <th className="py-3 px-4 font-semibold">PRIORITY</th>
                <th className="py-3 px-4 font-semibold text-center">POINTS</th>
                <th className="py-3 px-4 font-semibold text-right">DUE DATE</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-brand-border/40">
              {filteredItems.map((item) => {
                const isOverdueItem = item.status !== 'DONE' && item.dueDate && new Date(item.dueDate) < now;
                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="hover:bg-[#10192b] transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-brand-lime whitespace-nowrap">
                      {item.humanId}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-200 group-hover:text-brand-lime transition-colors max-w-md truncate">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[9px] font-mono text-slate-400 bg-[#121c2e] border border-brand-border px-1.5 py-0.5 rounded uppercase">
                          {item.type}
                        </span>
                        <span className="truncate">{item.title}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {item.project ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono text-slate-300 bg-[#121c2e] border border-[#1e2d4a]">
                          <span>{item.project.name}</span>
                          <span className="text-[9px] text-brand-lime">({item.project.key})</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[11px]">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${getStatusBadgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className={`py-3 px-4 font-mono text-xs whitespace-nowrap ${getPriorityClass(item.priority)}`}>
                      {item.priority}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold text-slate-300 whitespace-nowrap">
                      {item.storyPoints ?? 0}
                    </td>
                    <td className={`py-3 px-4 text-right font-mono text-xs whitespace-nowrap ${isOverdueItem ? 'text-brand-accentRed font-bold' : 'text-slate-400'}`}>
                      {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'No deadline'}
                    </td>
                  </tr>
                );
              })}

              {/* Empty State matching Stitch reference */}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3 py-16">
                      <div className="w-12 h-12 rounded-xl bg-[#0e1626] border border-brand-border flex items-center justify-center shadow-inner">
                        <CheckCircle2 className="w-6 h-6 text-brand-lime/70" />
                      </div>
                      <p className="italic text-zinc-300 text-sm font-semibold">
                        No work items match filter ({filterTab}).
                      </p>
                      <p className="text-xs text-zinc-500 max-w-sm text-center leading-relaxed">
                        You have no pending items right now. Create a new task or review another project filter.
                      </p>
                      <div className="pt-2">
                        <button
                          onClick={() => setIsCreateOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-lime text-slate-950 font-bold text-xs hover:bg-brand-limeHover transition shadow-sm"
                          type="button"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create Work Item</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Side Drawer & Creation Modal */}
      {selectedItem && (
        <WorkItemSideDrawer item={selectedItem} onClose={() => setSelectedItem(null)} onUpdated={loadMyWork} />
      )}
      {isCreateOpen && (
        <CreateWorkItemModal onClose={() => setIsCreateOpen(false)} onCreated={loadMyWork} />
      )}
    </div>
  );
};
