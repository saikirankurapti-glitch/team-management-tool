import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Code2,
  ListTodo,
  CheckSquare,
  Filter,
} from 'lucide-react';
import { fetchApi } from '../services/api';
import { WorkItem } from '../types';
import { WorkItemSideDrawer } from '../components/common/WorkItemSideDrawer';
import { useAuth } from '../context/AuthContext';

export const MyWorkPage: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<WorkItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
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
    return <div className="p-8 text-xs font-mono text-ink-muted">Loading your delivery console...</div>;
  }

  const now = new Date();

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DONE':
        return 'badge-green';
      case 'IN_PROGRESS':
      case 'CODE_REVIEW':
        return 'badge-blue';
      case 'BLOCKED':
        return 'badge-red';
      default:
        return 'badge-slate';
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-8 overflow-y-auto h-full text-xs bg-canvas select-none">
      {/* Editorial Header */}
      <div className="space-y-3 max-w-3xl">
        <div className="editorial-eyebrow">
          MY WORK
        </div>

        <h1 className="text-3xl md:text-4xl font-black text-ink tracking-tight leading-tight">
          Everything that <br />
          <span className="text-olive-dark">needs your attention.</span>
        </h1>

        <p className="text-sm text-ink-muted leading-relaxed">
          Your personal operational queue across assigned deliverables, code reviews, and blocked tasks.
        </p>

        {/* Counter Summary Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 font-mono">
          <span className="px-3 py-1 rounded-full bg-surface border border-borderWarm text-ink font-semibold">
            Total: {items.length}
          </span>
          <span className="px-3 py-1 rounded-full bg-status-error/10 border border-status-error/25 text-status-error font-bold">
            Blocked: {items.filter((i) => i.status === 'BLOCKED').length}
          </span>
          <span className="px-3 py-1 rounded-full bg-status-warning/15 border border-status-warning/30 text-status-warning font-bold">
            Overdue: {items.filter((i) => i.status !== 'DONE' && i.dueDate && new Date(i.dueDate) < now).length}
          </span>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div className="flex items-center space-x-1 border-b border-borderWarm pb-2 overflow-x-auto">
        {[
          { id: 'all', label: 'All Assigned', count: items.length },
          { id: 'today', label: 'Due Today', count: items.filter((i) => i.status !== 'DONE' && i.dueDate && new Date(i.dueDate).toDateString() === now.toDateString()).length },
          { id: 'upcoming', label: 'Upcoming', count: items.filter((i) => i.status !== 'DONE' && i.dueDate && new Date(i.dueDate) > now).length },
          { id: 'overdue', label: 'Overdue', count: items.filter((i) => i.status !== 'DONE' && i.dueDate && new Date(i.dueDate) < now).length },
          { id: 'blocked', label: 'Blocked', count: items.filter((i) => i.status === 'BLOCKED').length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterTab(tab.id as any)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
              filterTab === tab.id
                ? 'bg-olive-dark text-canvas'
                : 'text-ink-secondary hover:text-ink hover:bg-surface-hover'
            }`}
          >
            <span>{tab.label}</span>
            <span className="text-[10px] opacity-75 font-mono">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Dense Table View */}
      <div className="card-cream overflow-hidden">
        <table className="table-editorial">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Project</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Points</th>
              <th>Due Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="cursor-pointer transition-colors"
              >
                <td className="font-mono font-bold text-olive-dark whitespace-nowrap">
                  {item.humanId}
                </td>
                <td className="font-medium max-w-md truncate text-ink">
                  {item.title}
                </td>
                <td className="text-ink-muted font-medium whitespace-nowrap">
                  {item.project?.name || '-'}
                </td>
                <td className="whitespace-nowrap">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${getStatusBadge(item.status)}`}>
                    {item.status}
                  </span>
                </td>
                <td className="font-mono font-semibold whitespace-nowrap text-ink-secondary">
                  {item.priority}
                </td>
                <td className="font-mono text-ink-muted whitespace-nowrap">
                  {item.storyPoints || 0} pts
                </td>
                <td className="font-mono text-ink-muted whitespace-nowrap">
                  {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'No deadline'}
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-ink-muted italic">
                  No work items match filter ({filterTab}).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedItem && (
        <WorkItemSideDrawer item={selectedItem} onClose={() => setSelectedItem(null)} onUpdated={loadMyWork} />
      )}
    </div>
  );
};
