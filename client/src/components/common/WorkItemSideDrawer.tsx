import React, { useState, useEffect } from 'react';
import {
  X,
  User as UserIcon,
  Calendar,
  AlertTriangle,
  Send,
  Bug,
  GitBranch,
  ExternalLink,
  MessageSquare,
  Video,
  Plus,
} from 'lucide-react';
import { fetchApi } from '../../services/api';
import { WorkItem, User, WorkItemStatus } from '../../types';
import { ScheduleMeetingModal } from '../calendar/ScheduleMeetingModal';
import { WorkItemDevelopmentSection } from '../github/WorkItemDevelopmentSection';

export const WorkItemSideDrawer: React.FC<{ item: WorkItem; onClose: () => void; onUpdated?: () => void }> = ({
  item: initialItem,
  onClose,
  onUpdated,
}) => {
  const [item, setItem] = useState<WorkItem>(initialItem);
  const [members, setMembers] = useState<User[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [blockedReason, setBlockedReason] = useState(item.blockedReason || '');
  const [history, setHistory] = useState<any[]>([]);
  const [linkedMeetings, setLinkedMeetings] = useState<any[]>([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'discussion' | 'hierarchy' | 'history'>('details');

  const loadLinkedMeetings = () => {
    fetchApi<{ googleEvents: any[]; dbMeetings: any[] }>('/google/meetings')
      .then((data) => {
        const matching = (data.googleEvents || []).filter(
          (ge) => ge.workItemId === item.id || ge.workItemHumanId === item.humanId
        );
        setLinkedMeetings(matching);
      })
      .catch(() => setLinkedMeetings([]));
  };

  useEffect(() => {
    fetchApi<User[]>('/organization/members').then((data) => setMembers(data)).catch(() => {});
    loadLinkedMeetings();
  }, [item.id]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchApi<any[]>(`/work-items/${item.id}/history`).then((data) => setHistory(data)).catch(() => {});
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-ink/40 backdrop-blur-[2px] flex justify-end">
      <div className="w-full max-w-2xl bg-surface border-l border-borderWarm h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200 font-sans">
        {/* Drawer Header */}
        <div className="h-14 px-5 border-b border-borderWarm flex items-center justify-between bg-canvas shrink-0 select-none">
          <div className="flex items-center space-x-2.5">
            <span className="font-mono font-bold text-xs text-white bg-olive px-2.5 py-0.5 rounded-full shadow-sm">
              {item.humanId}
            </span>
            <span className="text-[10px] font-bold text-ink uppercase tracking-wider bg-lime/30 px-2 py-0.5 rounded-full border border-borderWarm">
              {item.type}
            </span>
            {item.project && <span className="text-xs text-ink/70 font-semibold truncate max-w-[180px]">({item.project.name})</span>}
          </div>

          <div className="flex items-center space-x-2">
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
              className="btn-pill-secondary py-1.5 px-3 text-xs flex items-center space-x-1"
            >
              <Send className="w-3 h-3 text-olive" />
              <span>Share to Chat</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-ink/60 hover:text-ink hover:bg-surface rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation Pills */}
        <div className="flex border-b border-borderWarm px-5 py-2 bg-surface gap-1 shrink-0 text-xs font-medium">
          {[
            { id: 'details', label: 'Details & Spec' },
            { id: 'discussion', label: `Discussion (${item.comments?.length || 0})` },
            { id: 'hierarchy', label: 'Hierarchy' },
            { id: 'history', label: 'History' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-olive text-white shadow-sm'
                  : 'text-ink/70 hover:text-ink hover:bg-canvas'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Drawer Body Scroll Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Main Title */}
          <div>
            <h2 className="text-base md:text-lg font-black text-ink mb-2 leading-snug">{item.title}</h2>
            <div className="bg-canvas p-4 rounded-xl border border-borderWarm text-ink/80 leading-relaxed min-h-[80px]">
              {item.description || <span className="text-ink/50 italic">No description specified.</span>}
            </div>
          </div>

          {/* Bug Details if Type == BUG */}
          {item.type === 'BUG' && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-2">
              <div className="flex items-center space-x-1.5 text-rose-700 dark:text-rose-400 text-xs font-bold uppercase tracking-wider">
                <Bug className="w-3.5 h-3.5" />
                <span>Bug Diagnostics</span>
              </div>
              {item.environment && (
                <div>
                  <span className="text-ink/60 font-semibold">Environment: </span>
                  <span className="text-ink font-mono">{item.environment}</span>
                </div>
              )}
              {item.stepsToReproduce && (
                <div>
                  <span className="text-ink/60 font-semibold block mb-1">Steps to Reproduce:</span>
                  <pre className="bg-surface p-2.5 rounded-lg text-ink font-mono text-[11px] whitespace-pre-wrap border border-borderWarm">
                    {item.stepsToReproduce}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Property Panel Grid */}
          <div className="p-4 bg-canvas rounded-2xl border border-borderWarm grid grid-cols-2 gap-4">
            <div>
              <label className="editorial-eyebrow text-[9px] block mb-1">
                Status
              </label>
              <select
                value={item.status}
                onChange={(e) => handleStatusChange(e.target.value as WorkItemStatus)}
                className="input-warm w-full text-xs font-bold py-1.5 px-2.5 rounded-lg"
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

            <div>
              <label className="editorial-eyebrow text-[9px] block mb-1">
                Assignee
              </label>
              <select
                value={item.assigneeId || ''}
                onChange={(e) => handleAssigneeChange(e.target.value)}
                className="input-warm w-full text-xs font-semibold py-1.5 px-2.5 rounded-lg"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="editorial-eyebrow text-[9px] block mb-0.5">Priority</span>
              <span className="font-bold text-xs text-ink">{item.priority}</span>
            </div>

            <div>
              <span className="editorial-eyebrow text-[9px] block mb-0.5">Story Points</span>
              <span className="font-bold text-xs text-olive">{item.storyPoints || 0} pts</span>
            </div>

            {item.dueDate && (
              <div className="col-span-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Due Date</span>
                <span className="text-slate-300 font-mono">{new Date(item.dueDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Section 13: Linked Upcoming Meetings */}
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Video className="w-3.5 h-3.5 text-rose-400" />
                <span>Upcoming Meetings ({linkedMeetings.length})</span>
              </span>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(true)}
                className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 flex items-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>Schedule Google Meet</span>
              </button>
            </div>

            {linkedMeetings.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic">No meetings scheduled for this work item.</p>
            ) : (
              <div className="space-y-1.5">
                {linkedMeetings.map((m) => (
                  <div
                    key={m.id}
                    className="p-2 bg-rose-500/10 border border-rose-500/20 rounded flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-200">{m.summary}</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {m.start?.dateTime
                          ? new Date(m.start.dateTime).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Scheduled'}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      {m.hangoutLink && (
                        <a
                          href={m.hangoutLink}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-medium flex items-center space-x-1"
                        >
                          <Video className="w-3 h-3" />
                          <span>Join Meet</span>
                        </a>
                      )}
                      {m.htmlLink && (
                        <a
                          href={m.htmlLink}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-slate-400 hover:text-white"
                          title="Open in Google Calendar"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Development Section (GitHub Branches, PRs, Commits) */}
          <WorkItemDevelopmentSection
            workItem={item}
            onUpdated={() => {
              if (onUpdated) onUpdated();
            }}
          />

          {/* Blocked Reason Warning Input */}
          {item.status === 'BLOCKED' && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded space-y-1">
              <div className="flex items-center space-x-1.5 text-amber-400 font-bold text-xs">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Blocked Reason</span>
              </div>
              <input
                type="text"
                placeholder="Why is this work item blocked?"
                value={blockedReason}
                onChange={(e) => setBlockedReason(e.target.value)}
                onBlur={() => handleStatusChange('BLOCKED')}
                className="w-full bg-slate-950 border border-amber-500/30 rounded px-2.5 py-1 text-xs text-amber-200 focus:outline-none"
              />
            </div>
          )}

          {/* Tab Content: Discussion */}
          {activeTab === 'discussion' && (
            <div className="space-y-3">
              <form onSubmit={handleAddComment} className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Post comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={isSubmittingComment}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center space-x-1 shrink-0"
                >
                  <Send className="w-3 h-3" />
                  <span>Post</span>
                </button>
              </form>

              <div className="space-y-2">
                {item.comments?.map((c) => (
                  <div key={c.id} className="p-2.5 bg-slate-950 rounded border border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-blue-400">{c.author?.fullName}</span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{c.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab Content: Hierarchy */}
          {activeTab === 'hierarchy' && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-400 font-bold block mb-1">Parent Item:</span>
                {item.parent ? (
                  <div className="flex items-center space-x-2 text-blue-400 font-semibold">
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>
                      [{item.parent.humanId}] {item.parent.title} ({item.parent.type})
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-500 italic">No parent item assigned.</span>
                )}
              </div>

              <div>
                <span className="text-slate-400 font-bold block mb-1.5">Child Items:</span>
                <div className="space-y-1">
                  {item.children && item.children.length > 0 ? (
                    item.children.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center justify-between p-2 bg-slate-950 rounded border border-slate-800"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-blue-400 font-bold">{child.humanId}</span>
                          <span className="text-slate-200 truncate max-w-[240px]">{child.title}</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded">
                          {child.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-500 italic block">No child items.</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab Content: History */}
          {activeTab === 'history' && (
            <div className="space-y-2">
              {history.length > 0 ? (
                history.map((h) => (
                  <div key={h.id} className="p-2 bg-slate-950 rounded border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 font-semibold">{h.oldStatus}</span> →{' '}
                      <span className="text-emerald-400 font-bold">{h.newStatus}</span>
                      <div className="text-[10px] text-slate-500">By {h.changedBy?.fullName || 'User'}</div>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono">
                      {new Date(h.changedAt).toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <span className="text-slate-500 italic block">No history records.</span>
              )}
            </div>
          )}
        </div>
      </div>

      <ScheduleMeetingModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        defaultProjectId={item.projectId}
        defaultWorkItemId={item.id}
        defaultTitle={`Discussion on ${item.humanId}: ${item.title}`}
        onMeetingScheduled={() => {
          loadLinkedMeetings();
        }}
      />
    </div>
  );
};
