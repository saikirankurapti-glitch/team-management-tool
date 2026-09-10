import React, { useState, useEffect } from 'react';
import { X, Hash, Lock, Users, FolderKanban } from 'lucide-react';
import { fetchApi } from '../../services/api';
import { Project, Team } from '../../types';

export const CreateChannelModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'PUBLIC' | 'PRIVATE' | 'PROJECT' | 'TEAM'>('PUBLIC');
  const [projectId, setProjectId] = useState('');
  const [teamId, setTeamId] = useState('');

  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchApi<Project[]>('/projects').then((data) => setProjects(data));
    fetchApi<Team[]>('/teams').then((data) => setTeams(data));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await fetchApi('/chat/channels', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          type,
          projectId: type === 'PROJECT' ? projectId : undefined,
          teamId: type === 'TEAM' ? teamId : undefined,
        }),
      });

      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 font-bold text-slate-100 text-sm">
            <Hash className="w-4 h-4 text-indigo-400" />
            <span>Create New Channel</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-400 mb-1">Channel Name *</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-500 font-mono font-bold">#</span>
              <input
                type="text"
                required
                placeholder="e.g. engineering-help"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-400 mb-1">Channel Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="PUBLIC">Public (Open to organization)</option>
              <option value="PRIVATE">Private (Invite only)</option>
              <option value="PROJECT">Project Channel</option>
              <option value="TEAM">Team Channel</option>
            </select>
          </div>

          {type === 'PROJECT' && (
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Target Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
              >
                <option value="">Select Project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {type === 'TEAM' && (
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Target Team</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
              >
                <option value="">Select Team...</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-400 mb-1">Description / Topic</label>
            <textarea
              rows={2}
              placeholder="What is this channel about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 font-medium text-slate-400">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/20"
            >
              {isSubmitting ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
