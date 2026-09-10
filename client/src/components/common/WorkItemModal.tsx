import React, { useState, useEffect } from 'react';
import {
  X,
  User as UserIcon,
  Calendar,
  AlertTriangle,
  Send,
  MessageSquare,
  Bug,
  GitBranch,
  Paperclip,
  CheckCircle2,
} from 'lucide-react';
import { fetchApi } from '../../services/api';
import { WorkItem, User, WorkItemStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const WorkItemModal: React.FC<{ item: WorkItem; onClose: () => void; onUpdated?: () => void }> = ({
  item: initialItem,
  onClose,
  onUpdated,
}) => {
  const { user } = useAuth();
  const [item, setItem] = useState<WorkItem>(initialItem);
  const [members, setMembers] = useState<User[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [blockedReason, setBlockedReason] = useState(item.blockedReason || '');
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'discussion' | 'hierarchy' | 'attachments' | 'history'>('details');

  useEffect(() => {
    fetchApi<User[]>('/organization/members').then((data) => setMembers(data));
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchApi<any[]>(`/work-items/${item.id}/history`).then((data) => setHistory(data));
    }
  }, [activeTab, item.id]);

  const handleStatusChange = async (newStatus: WorkItemStatus) => {
    try {
      const updated = await fetchApi<WorkItem>(`/work-items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus,
          blockedReason: newStatus === 'BLOCKED' ? blockedReason : null,
        }),
      });
      setItem(updated);
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleAssigneeChange = async (assigneeId: string) => {
    try {
      const updated = await fetchApi<WorkItem>(`/work-items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ assigneeId: assigneeId || null }),
      });
      setItem(updated);
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('Failed to update assignee', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsSubmittingComment(true);
    try {
      const newComment = await fetchApi(`/work-items/${item.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: commentText }),
      });

      setItem((prev) => ({
        ...prev,
        comments: [newComment, ...(prev.comments || [])],
      }));
      setCommentText('');
    } catch (err) {
      console.error('Failed to post comment', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <span className="font-mono font-bold text-sm text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded border border-indigo-500/20">
              {item.humanId}
            </span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-800 px-2 py-0.5 rounded">
              {item.type}
            </span>
            {item.project && <span className="text-xs text-slate-400 font-medium">({item.project.name})</span>}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={async () => {
                const channels = await fetchApi<any[]>('/chat/channels');
                if (channels.length > 0) {
                  await fetchApi('/chat/share-work-item', {
                    method: 'POST',
                    body: JSON.stringify({ workItemId: item.id, channelId: channels[0].id }),
                  });
                  alert(`Shared ${item.humanId} to #${channels[0].name}`);
                }
              }}
              className="px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-bold flex items-center space-x-1"
            >
              <Send className="w-3 h-3" />
              <span>Share to Chat</span>
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-950/20">
          {[
            { id: 'details', label: 'Details & Spec' },
            { id: 'discussion', label: `Discussion (${item.comments?.length || 0})` },
            { id: 'hierarchy', label: 'Parent / Child Hierarchy' },
            { id: 'history', label: 'Activity & Status History' },
            { id: 'attachments', label: 'Attachments' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Content Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-3 gap-6">
          {/* Left Column: Details & Tabs */}
          <div className="col-span-2 space-y-6">
            <div>
              <h1 className="text-lg font-bold text-slate-100 mb-2">{item.title}</h1>
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/60 text-xs text-slate-300 leading-relaxed min-h-[100px]">
                {item.description || <span className="text-slate-600 italic">No description provided.</span>}
              </div>
            </div>

            {/* Bug Specific Details */}
            {item.type === 'BUG' && (
              <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl space-y-3">
                <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
                  <Bug className="w-4 h-4" />
                  <span>Bug Diagnostics</span>
                </div>
                {item.environment && (
                  <div className="text-xs">
                    <span className="text-slate-400 font-semibold">Environment: </span>
                    <span className="text-slate-200">{item.environment}</span>
                  </div>
                )}
                {item.stepsToReproduce && (
                  <div className="text-xs">
                    <span className="text-slate-400 font-semibold block mb-1">Steps to Reproduce:</span>
                    <pre className="bg-slate-950/80 p-2.5 rounded text-slate-300 font-mono text-[11px] whitespace-pre-wrap">
                      {item.stepsToReproduce}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Discussion Tab */}
            {activeTab === 'discussion' && (
              <div className="space-y-4">
                <form onSubmit={handleAddComment} className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Add to discussion... (mentions @PROJ-102 supported)"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingComment}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Post</span>
                  </button>
                </form>

                <div className="space-y-3">
                  {item.comments?.map((comment) => (
                    <div key={comment.id} className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/40 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-indigo-400">{comment.author?.fullName}</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">{comment.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hierarchy Tab */}
            {activeTab === 'hierarchy' && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 text-xs">
                  <span className="text-slate-400 font-bold block mb-1">Parent Item:</span>
                  {item.parent ? (
                    <div className="flex items-center space-x-2 text-indigo-400 font-semibold">
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>
                        [{item.parent.humanId}] {item.parent.title} ({item.parent.type})
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-600 italic">No parent item assigned.</span>
                  )}
                </div>

                <div>
                  <span className="text-slate-400 font-bold text-xs block mb-2">Child Items:</span>
                  <div className="space-y-1.5">
                    {item.children && item.children.length > 0 ? (
                      item.children.map((child) => (
                        <div
                          key={child.id}
                          className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/40 text-xs"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-indigo-400 font-bold">{child.humanId}</span>
                            <span className="text-slate-200">{child.title}</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded">
                            {child.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-600 italic">No child items.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* History & Activity Timeline Tab */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                <span className="text-slate-400 font-bold text-xs block mb-2">Historical Status Transitions:</span>
                {history.length > 0 ? (
                  history.map((record) => (
                    <div
                      key={record.id}
                      className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 text-xs flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 font-semibold">
                          <span className="text-slate-400">{record.oldStatus}</span>
                          <span className="text-indigo-400 font-bold">→</span>
                          <span className="text-emerald-400 font-bold">{record.newStatus}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Changed by {record.changedBy?.fullName || 'User'}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(record.changedAt).toLocaleString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-600 italic">No historical status transitions recorded yet.</div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Status & Metadata Panel */}
          <div className="space-y-5 bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 text-xs">
            {/* Status */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Workflow Status
              </label>
              <select
                value={item.status}
                onChange={(e) => handleStatusChange(e.target.value as WorkItemStatus)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-100 focus:outline-none"
              >
                <option value="BACKLOG">Backlog</option>
                <option value="TO_DO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="CODE_REVIEW">Code Review</option>
                <option value="TESTING">Testing</option>
                <option value="BLOCKED">Blocked</option>
                <option value="DONE">Done</option>
              </select>
            </div>

            {/* Blocked Reason Warning */}
            {item.status === 'BLOCKED' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1">
                <div className="flex items-center space-x-1.5 text-amber-400 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Blocked Reason</span>
                </div>
                <input
                  type="text"
                  placeholder="Why is this item blocked?"
                  value={blockedReason}
                  onChange={(e) => setBlockedReason(e.target.value)}
                  onBlur={() => handleStatusChange('BLOCKED')}
                  className="w-full bg-slate-950 border border-amber-500/30 rounded px-2 py-1 text-xs text-amber-200 focus:outline-none"
                />
              </div>
            )}

            {/* Assignee */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Assignee
              </label>
              <select
                value={item.assigneeId || ''}
                onChange={(e) => handleAssigneeChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority & Story Points */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-500 block text-[10px] font-bold uppercase">Priority</span>
                <span className="font-semibold text-slate-200">{item.priority}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] font-bold uppercase">Story Points</span>
                <span className="font-bold text-indigo-400">{item.storyPoints || 0} pts</span>
              </div>
            </div>

            {/* Due Date */}
            <div>
              <span className="text-slate-500 block text-[10px] font-bold uppercase mb-1">Due Date</span>
              <div className="flex items-center space-x-2 text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'No deadline set'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
