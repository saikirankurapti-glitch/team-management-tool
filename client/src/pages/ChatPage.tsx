import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Edit2,
  Paperclip,
  CheckCircle2,
  Bug,
  FileText,
} from 'lucide-react';
import { fetchApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { User, WorkItem } from '../types';
import { CreateChannelModal } from '../components/chat/CreateChannelModal';
import { CreateTaskFromChatModal } from '../components/chat/CreateTaskFromChatModal';
import { WorkItemSideDrawer } from '../components/common/WorkItemSideDrawer';

export const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [channels, setChannels] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [members, setMembers] = useState<User[]>([]);

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlinePresence, setOnlinePresence] = useState<Record<string, string>>({});

  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [taskModalMessage, setTaskModalMessage] = useState<any | null>(null);
  const [selectedWorkItem, setSelectedWorkItem] = useState<WorkItem | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  const activeRoomId = activeChannelId ? `channel:${activeChannelId}` : activeConversationId ? `conversation:${activeConversationId}` : null;

  const loadSidebarData = () => {
    Promise.all([
      fetchApi<any[]>('/chat/channels'),
      fetchApi<any[]>('/chat/conversations'),
      fetchApi<User[]>('/organization/members'),
    ]).then(([chanData, convData, memData]) => {
      setChannels(chanData);
      setConversations(convData);
      setMembers(memData);

      if (chanData.length > 0 && !activeChannelId && !activeConversationId) {
        setActiveChannelId(chanData[0].id);
      }
    });
  };

  useEffect(() => {
    loadSidebarData();
  }, []);

  useEffect(() => {
    if (!activeChannelId && !activeConversationId) return;

    const query = activeChannelId ? `channelId=${activeChannelId}` : `conversationId=${activeConversationId}`;

    fetchApi<any[]>(`/chat/messages?${query}`).then((data) => {
      setMessages(data);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });

    fetchApi('/chat/read', {
      method: 'POST',
      body: JSON.stringify({
        channelId: activeChannelId || undefined,
        conversationId: activeConversationId || undefined,
      }),
    }).then(() => loadSidebarData());

    if (socket && activeRoomId) {
      socket.emit('join_room', activeRoomId);
      if (user?.id) socket.emit('user_online', { userId: user.id });
    }

    return () => {
      if (socket && activeRoomId) {
        socket.emit('leave_room', activeRoomId);
      }
    };
  }, [activeChannelId, activeConversationId, socket]);

  useEffect(() => {
    if (!socket) return;

    socket.on('new_message', (newMsg: any) => {
      setMessages((prev) => [...prev, newMsg]);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });

    socket.on('typing_start', (data: { userId: string }) => {
      const u = members.find((m) => m.id === data.userId);
      if (u && !typingUsers.includes(u.fullName)) {
        setTypingUsers((prev) => [...prev, u.fullName]);
      }
    });

    socket.on('typing_stop', (data: { userId: string }) => {
      const u = members.find((m) => m.id === data.userId);
      if (u) {
        setTypingUsers((prev) => prev.filter((name) => name !== u.fullName));
      }
    });

    return () => {
      socket.off('new_message');
      socket.off('typing_start');
      socket.off('typing_stop');
    };
  }, [socket, members, typingUsers]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    const payload = {
      channelId: activeChannelId || undefined,
      conversationId: activeConversationId || undefined,
      content: messageText,
    };

    try {
      const created = await fetchApi<any>('/chat/messages', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setMessages((prev) => [...prev, created]);
      setMessageText('');
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleTyping = (val: string) => {
    setMessageText(val);
    if (!socket || !activeRoomId || !user?.id) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing_start', { roomId: activeRoomId, userId: user.id });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('typing_stop', { roomId: activeRoomId, userId: user.id });
    }, 2000);
  };

  const handleStartDM = async (targetUserId: string) => {
    try {
      const conv = await fetchApi('/chat/conversations/dm', {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      });
      setActiveChannelId(null);
      setActiveConversationId(conv.id);
      loadSidebarData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      await fetchApi(`/chat/messages/${messageId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      });

      const query = activeChannelId ? `channelId=${activeChannelId}` : `conversationId=${activeConversationId}`;
      const updated = await fetchApi<any[]>(`/chat/messages?${query}`);
      setMessages(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditSave = async (messageId: string) => {
    try {
      const updated = await fetchApi(`/chat/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: editText }),
      });
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
      if (socket && activeRoomId) {
        socket.emit('edit_message', { roomId: activeRoomId, message: updated });
      }
      setEditingMessageId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await fetchApi(`/chat/messages/${messageId}`, { method: 'DELETE' });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content: 'This message was deleted.', deletedAt: new Date().toISOString() } : m))
      );
      if (socket && activeRoomId) {
        socket.emit('delete_message', { roomId: activeRoomId, messageId });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const referencedWorkItems = messages.filter((m) => m.workItem).map((m) => m.workItem);

  return (
    <div className="flex h-full bg-canvas text-xs overflow-hidden select-none">
      {/* Pane 1: Channels & DMs Navigation */}
      <div className="w-60 bg-canvas-secondary border-r border-borderWarm flex flex-col shrink-0">
        <div className="p-3.5 border-b border-borderWarm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-olive-dark" />
            <h2 className="font-bold text-ink text-xs uppercase tracking-wider">Chat & Threads</h2>
          </div>
          <button
            onClick={() => setIsCreateChannelOpen(true)}
            className="p-1 hover:bg-surface-hover rounded text-ink-muted hover:text-ink transition-colors"
            title="Create Channel"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-eyebrow text-ink-muted mb-1 px-1.5">Channels</div>
            <div className="space-y-0.5">
              {channels.map((chan) => (
                <button
                  key={chan.id}
                  onClick={() => {
                    setActiveConversationId(null);
                    setActiveChannelId(chan.id);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    activeChannelId === chan.id
                      ? 'bg-lime/30 text-ink font-bold border-l-2 border-olive-dark'
                      : 'text-ink-secondary hover:bg-surface-hover hover:text-ink'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <span className="font-mono text-ink-muted">#</span>
                    <span className="truncate">{chan.name}</span>
                  </div>
                  {chan.unreadCount > 0 && (
                    <span className="bg-lime text-ink font-mono font-bold text-[9px] px-1.5 py-0.2 rounded-full">
                      {chan.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-eyebrow text-ink-muted mb-1 px-1.5">Direct Messages</div>
            <div className="space-y-0.5">
              {members
                .filter((m) => m.id !== user?.id)
                .map((member) => {
                  const existingDM = conversations.find((c) => c.otherUser?.id === member.id);
                  const isSelected = activeConversationId === existingDM?.id;
                  const status = onlinePresence[member.id] || 'ONLINE';

                  return (
                    <button
                      key={member.id}
                      onClick={() => handleStartDM(member.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        isSelected
                          ? 'bg-lime/30 text-ink font-bold border-l-2 border-olive-dark'
                          : 'text-ink-secondary hover:bg-surface-hover hover:text-ink'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <div className="relative shrink-0">
                          <img src={member.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-borderWarm" />
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-surface ${
                              status === 'ONLINE' ? 'bg-status-success' : 'bg-ink-muted'
                            }`}
                          />
                        </div>
                        <span className="truncate">{member.fullName}</span>
                      </div>
                      {existingDM?.unreadCount > 0 && (
                        <span className="bg-lime text-ink font-mono font-bold text-[9px] px-1.5 py-0.2 rounded-full">
                          {existingDM.unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* Pane 2: Conversation View */}
      <div className="flex-1 flex flex-col bg-canvas min-w-0">
        <div className="h-12 px-4 border-b border-borderWarm bg-canvas flex items-center justify-between shrink-0">
          <span className="font-mono text-olive-dark font-bold text-xs">
            {activeChannel ? `#${activeChannel.name}` : activeConversation ? `@${activeConversation.otherUser?.fullName}` : ''}
          </span>
          {activeChannel?.description && <span className="text-[11px] text-ink-muted truncate max-w-sm">{activeChannel.description}</span>}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className="group flex items-start space-x-3 hover:bg-surface-hover/50 p-2.5 rounded-xl transition-colors">
              <img src={msg.sender?.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5 ring-1 ring-borderWarm" />

              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex items-center space-x-2 font-mono text-[10px]">
                  <span className="font-bold text-ink">{msg.sender?.fullName}</span>
                  <span className="text-ink-muted">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                </div>

                {editingMessageId === msg.id ? (
                  <div className="flex space-x-2 pt-1">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="input-warm flex-1 h-8 text-xs"
                    />
                    <button onClick={() => handleEditSave(msg.id)} className="btn-pill-primary text-xs h-8 px-3">
                      Save
                    </button>
                    <button onClick={() => setEditingMessageId(null)} className="px-2 text-ink-muted text-xs">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <p className={`text-ink leading-relaxed ${msg.deletedAt ? 'italic text-ink-muted' : ''}`}>
                    {msg.content}
                  </p>
                )}

                {/* Work Item Badge Card */}
                {msg.workItem && (
                  <div
                    onClick={() => setSelectedWorkItem(msg.workItem)}
                    className="mt-1.5 p-2.5 bg-surface border border-borderWarm rounded-xl cursor-pointer hover:border-olive-dark transition-colors flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="editorial-eyebrow text-[9px]">{msg.workItem.humanId}</span>
                      <span className="font-semibold text-ink truncate">{msg.workItem.title}</span>
                    </div>
                    <span className="text-[10px] text-olive-dark font-semibold">Inspect →</span>
                  </div>
                )}

                {/* Reactions */}
                <div className="flex items-center space-x-1.5 pt-1">
                  {['👍', '❤️', '🚀', '🔥'].map((emoji) => {
                    const count = msg.reactions?.filter((r: any) => r.emoji === emoji).length || 0;
                    return (
                      <button
                        key={emoji}
                        onClick={() => handleToggleReaction(msg.id, emoji)}
                        className={`px-2 py-0.5 rounded-full border text-[10px] flex items-center space-x-1 ${
                          count > 0 ? 'bg-lime/30 border-olive-dark/40 text-ink font-bold' : 'bg-surface border-borderWarm text-ink-muted'
                        }`}
                      >
                        <span>{emoji}</span>
                        {count > 0 && <span>{count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Message Actions */}
              {!msg.deletedAt && (
                <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 bg-surface border border-borderWarm p-0.5 rounded-lg shadow-xs">
                  <button
                    onClick={() => setTaskModalMessage(msg)}
                    className="p-1 hover:bg-surface-hover text-ink-muted hover:text-olive-dark rounded"
                    title="Create Work Item from Chat"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                  {msg.senderId === user?.id && (
                    <>
                      <button
                        onClick={() => {
                          setEditingMessageId(msg.id);
                          setEditText(msg.content);
                        }}
                        className="p-1 hover:bg-surface-hover text-ink-muted hover:text-ink rounded"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="p-1 hover:bg-surface-hover text-ink-muted hover:text-status-error rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {typingUsers.length > 0 && (
          <div className="px-5 py-1 text-[10px] text-olive-dark font-mono italic">
            {typingUsers.join(', ')} typing...
          </div>
        )}

        <div className="p-3.5 border-t border-borderWarm bg-canvas">
          <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
            <input
              type="text"
              placeholder={`Message ${activeChannel ? `#${activeChannel.name}` : `@${activeConversation?.otherUser?.fullName}`}`}
              value={messageText}
              onChange={(e) => handleTyping(e.target.value)}
              className="input-warm flex-1 text-xs"
            />
            <button type="submit" className="btn-pill-primary h-10 px-5 text-xs">
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>

      {/* Pane 3: Context Panel (Referenced Work Items & Shared Assets) */}
      <div className="hidden lg:flex w-68 bg-canvas-secondary border-l border-borderWarm flex-col shrink-0">
        <div className="p-3.5 border-b border-borderWarm">
          <h3 className="font-bold text-ink text-xs uppercase tracking-wider">Channel Context</h3>
        </div>
        <div className="p-3.5 overflow-y-auto space-y-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-eyebrow text-ink-muted block mb-2">
              Referenced Work Items ({referencedWorkItems.length})
            </span>
            <div className="space-y-1.5">
              {referencedWorkItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedWorkItem(item)}
                  className="p-2.5 card-cream cursor-pointer flex items-center justify-between"
                >
                  <div className="min-w-0 pr-1">
                    <span className="editorial-eyebrow text-[9px] mb-1">{item.humanId}</span>
                    <span className="font-semibold text-ink truncate block text-[11px]">{item.title}</span>
                  </div>
                </div>
              ))}
              {referencedWorkItems.length === 0 && (
                <div className="text-[11px] text-ink-muted italic">No work items linked in conversation</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isCreateChannelOpen && <CreateChannelModal onClose={() => setIsCreateChannelOpen(false)} onCreated={loadSidebarData} />}
      {taskModalMessage && (
        <CreateTaskFromChatModal
          messageId={taskModalMessage.id}
          initialContent={taskModalMessage.content}
          onClose={() => setTaskModalMessage(null)}
          onCreated={() => {
            fetchApi<any[]>(
              `/chat/messages?${activeChannelId ? `channelId=${activeChannelId}` : `conversationId=${activeConversationId}`}`
            ).then((data) => setMessages(data));
          }}
        />
      )}
      {selectedWorkItem && <WorkItemSideDrawer item={selectedWorkItem} onClose={() => setSelectedWorkItem(null)} />}
    </div>
  );
};
