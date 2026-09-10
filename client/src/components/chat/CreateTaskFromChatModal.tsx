import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Sparkles } from 'lucide-react';
import { fetchApi } from '../../services/api';
import { Project, User, Sprint, WorkItemType, WorkItemPriority } from '../../types';

export const CreateTaskFromChatModal: React.FC<{
  messageId: string;
  initialContent: string;
  onClose: () => void;
  onCreated: (workItem: any) => void;
}> = ({ messageId, initialContent, onClose, onCreated }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);

  const [projectId, setProjectId] = useState('');
  const [type, setType] = useState<WorkItemType>('BUG');
  const [priority, setPriority] = useState<WorkItemPriority>('HIGH');
  const [assigneeId, setAssigneeId] = useState('');
  const [sprintId, setSprintId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchApi<Project[]>('/projects').then((data) => {
      setProjects(data);
      if (data.length > 0) setProjectId(data[0].id);
    });
    fetchApi<User[]>('/organization/members').then((data) => setMembers(data));
    fetchApi<Sprint[]>('/sprints').then((data) => setSprints(data));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const created = await fetchApi(`/chat/messages/${messageId}/create-task`, {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          type,
          priority,
          assigneeId: assigneeId || undefined,
          sprintId: sprintId || undefined,
        }),
      });

      onCreated(created);
      onClose();
    } catch (err) {
      console.error('Failed to convert chat message to work item', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 font-bold text-slate-100 text-sm">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Create Work Item from Chat Message</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Original Message Preview */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400">Source Chat Message:</span>
            <p className="text-slate-200 italic font-mono text-[11px] leading-relaxed">"{initialContent}"</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Project *</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.key})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-400 mb-1">Work Item Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
              >
                <option value="BUG">Bug</option>
                <option value="TASK">Task</option>
                <option value="USER_STORY">User Story</option>
                <option value="FEATURE">Feature</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-400 mb-1">Assignee</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-400 mb-1">Target Sprint (Optional)</label>
            <select
              value={sprintId}
              onChange={(e) => setSprintId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
            >
              <option value="">Product Backlog (Unassigned)</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 font-medium text-slate-400">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-lg shadow-amber-600/20"
            >
              {isSubmitting ? 'Creating Work Item...' : 'Create Work Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
