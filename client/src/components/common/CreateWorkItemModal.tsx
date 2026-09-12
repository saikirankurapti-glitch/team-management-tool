import React, { useState, useEffect } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { fetchApi } from '../../services/api';
import { Project, User, WorkItemType, WorkItemPriority, BugSeverity } from '../../types';

export const CreateWorkItemModal: React.FC<{
  onClose: () => void;
  onCreated?: () => void;
  defaultProjectId?: string;
}> = ({ onClose, onCreated, defaultProjectId }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<User[]>([]);

  const [projectId, setProjectId] = useState<string>(defaultProjectId || '');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [type, setType] = useState<WorkItemType>('TASK');
  const [priority, setPriority] = useState<WorkItemPriority>('MEDIUM');
  const [severity, setSeverity] = useState<BugSeverity>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [storyPoints, setStoryPoints] = useState<number>(3);
  const [dueDate, setDueDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchApi<Project[]>('/projects').then((data) => {
      setProjects(data);
      if (defaultProjectId && data.some((p) => p.id === defaultProjectId)) {
        setProjectId(defaultProjectId);
      } else if (data.length > 0) {
        setProjectId(data[0].id);
      }
    });
    fetchApi<User[]>('/organization/members').then((data) => setMembers(data));
  }, [defaultProjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !projectId) {
      setError('Title and Project are required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await fetchApi('/work-items', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          title,
          description,
          type,
          priority,
          severity: type === 'BUG' ? severity : undefined,
          assigneeId: assigneeId || undefined,
          storyPoints,
          dueDate: dueDate || undefined,
        }),
      });

      if (onCreated) onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create work item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-borderWarm rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden font-sans">
        {/* Editorial Header */}
        <div className="p-5 border-b border-borderWarm flex items-center justify-between bg-canvas">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-lime/30 rounded-xl text-olive border border-borderWarm">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="editorial-eyebrow text-[9px] mb-0.5">[ WORK ITEM CREATION ]</div>
              <h2 className="text-base font-black text-ink">Create New Work Item</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-ink/60 hover:text-ink rounded-full hover:bg-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs rounded-2xl font-mono">
              {error}
            </div>
          )}

          {/* Project & Item Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="editorial-eyebrow text-[9px] block mb-1">Project *</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="input-warm w-full text-xs font-semibold py-2 px-3 rounded-xl"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.key})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="editorial-eyebrow text-[9px] block mb-1">Work Item Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as WorkItemType)}
                className="input-warm w-full text-xs font-semibold py-2 px-3 rounded-xl"
              >
                <option value="EPIC">Epic</option>
                <option value="FEATURE">Feature</option>
                <option value="USER_STORY">User Story</option>
                <option value="TASK">Task</option>
                <option value="BUG">Bug / Issue</option>
                <option value="SUBTASK">Subtask</option>
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="editorial-eyebrow text-[9px] block mb-1">Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Build User Authentication API"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-warm w-full text-xs font-medium py-2 px-3 rounded-xl"
            />
          </div>

          {/* Description */}
          <div>
            <label className="editorial-eyebrow text-[9px] block mb-1">Description</label>
            <textarea
              rows={3}
              placeholder="Provide context, acceptance criteria, or reproduction steps..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-warm w-full text-xs font-normal py-2 px-3 rounded-xl leading-relaxed"
            />
          </div>

          {/* Priority & Assignee */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="editorial-eyebrow text-[9px] block mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as WorkItemPriority)}
                className="input-warm w-full text-xs font-semibold py-2 px-3 rounded-xl"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label className="editorial-eyebrow text-[9px] block mb-1">Assignee</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="input-warm w-full text-xs font-semibold py-2 px-3 rounded-xl"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Story Points & Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="editorial-eyebrow text-[9px] block mb-1">Story Points</label>
              <input
                type="number"
                min="0"
                max="100"
                value={storyPoints}
                onChange={(e) => setStoryPoints(parseInt(e.target.value) || 0)}
                className="input-warm w-full text-xs font-semibold py-2 px-3 rounded-xl"
              />
            </div>
            <div>
              <label className="editorial-eyebrow text-[9px] block mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="input-warm w-full text-xs font-medium py-2 px-3 rounded-xl"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-borderWarm">
            <button
              type="button"
              onClick={onClose}
              className="btn-pill-secondary py-2 px-4 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-pill-primary py-2 px-5 text-xs font-bold shadow-sm"
            >
              {isSubmitting ? 'Creating...' : 'Create Work Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
