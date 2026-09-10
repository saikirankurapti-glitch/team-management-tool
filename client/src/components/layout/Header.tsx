import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Bell, CheckCheck, X, Sparkles, MessageSquare, Sun, Moon } from 'lucide-react';
import { fetchApi } from '../../services/api';
import { Notification } from '../../types';
import { GlobalSearchModal } from '../common/GlobalSearchModal';
import { CreateWorkItemModal } from '../common/CreateWorkItemModal';
import { FeedbackModal } from '../common/FeedbackModal';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { AiCopilotDrawer } from '../copilot/AiCopilotDrawer';

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState<boolean>(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);

  const loadNotifications = () => {
    fetchApi<{ notifications: Notification[]; unreadCount: number }>('/notifications')
      .then((data) => {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetchApi(`/notifications/${id}/read`, { method: 'PATCH' });
      loadNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetchApi('/notifications/mark-all-read', { method: 'PATCH' });
      loadNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <header className="h-14 bg-canvas border-b border-borderWarm px-5 flex items-center justify-between shrink-0 select-none z-20">
        {/* Left / Global Search Input Trigger */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center justify-between bg-surface border border-borderWarm hover:border-olive rounded-full px-3.5 py-1.5 text-xs text-ink-muted transition-all w-64 md:w-80 shadow-xs"
          >
            <div className="flex items-center space-x-2">
              <Search className="w-3.5 h-3.5 text-olive-dark" />
              <span className="truncate">Search work items, projects, members...</span>
            </div>
            <kbd className="bg-canvas-secondary text-[10px] text-ink-muted font-mono px-1.5 py-0.5 rounded-full border border-borderWarm">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right Actions Toolbar */}
        <div className="flex items-center space-x-2">
          {/* AI Copilot Button */}
          <button
            onClick={() => setIsCopilotOpen(true)}
            className="flex items-center space-x-1.5 bg-lime/30 hover:bg-lime/50 text-ink border border-olive/30 text-xs px-3 py-1.5 rounded-full font-semibold transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-olive-dark" />
            <span>Copilot</span>
          </button>

          {/* Quick Create Item */}
          <button
            onClick={() => setIsCreateOpen(true)}
            className="btn-pill-primary h-8 px-3.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Item</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            className="p-1.5 text-ink-muted hover:text-ink hover:bg-surface-hover rounded-full transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-lime" /> : <Moon className="w-4 h-4 text-olive-dark" />}
          </button>

          {/* Notifications Bell Button */}
          <div className="relative">
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative p-1.5 text-ink-muted hover:text-ink hover:bg-surface-hover rounded-full transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-olive-dark ring-2 ring-canvas" />
              )}
            </button>

            {/* Notifications Dropdown Panel */}
            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-84 bg-surface border border-borderWarm rounded-card shadow-xl z-50 overflow-hidden text-xs">
                <div className="p-3 border-b border-borderWarm flex items-center justify-between bg-canvas-secondary">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-ink text-xs">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="editorial-eyebrow text-[9px] px-1.5 py-0.5">
                        {unreadCount} Unread
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-[10px] text-olive-dark hover:underline font-semibold flex items-center space-x-1"
                    >
                      <CheckCheck className="w-3 h-3" />
                      <span>Read all</span>
                    </button>
                    <button onClick={() => setIsNotifOpen(false)} className="text-ink-muted hover:text-ink">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-borderWarm/60">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        handleMarkAsRead(n.id);
                        setIsNotifOpen(false);
                        if (n.link) {
                          navigate(n.link);
                        }
                      }}
                      className={`p-3 cursor-pointer hover:bg-surface-hover transition-colors ${
                        !n.isRead ? 'bg-lime/10' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className={`font-semibold ${!n.isRead ? 'text-ink font-bold' : 'text-ink-secondary'}`}>{n.title}</span>
                        {!n.isRead && <span className="w-2 h-2 rounded-full bg-olive-dark shrink-0 mt-1" />}
                      </div>
                      <p className="text-[11px] text-ink-muted mt-0.5 leading-snug">{n.body}</p>
                      <span className="text-[9px] text-ink-muted font-mono mt-1 block">
                        {new Date(n.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                  {notifications.length === 0 && (
                    <div className="p-5 text-center text-ink-muted italic text-xs">No notifications</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Feedback Button */}
          <button
            onClick={() => setIsFeedbackOpen(true)}
            className="p-1.5 text-ink-muted hover:text-ink hover:bg-surface-hover rounded-full transition-colors"
            title="Submit Feedback"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {/* User Role Badge */}
          {user && (
            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-surface border border-borderWarm text-[11px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
              <span className="font-semibold text-ink-secondary">{user.role}</span>
            </div>
          )}
        </div>
      </header>

      {/* Modals & Drawers */}
      {isSearchOpen && <GlobalSearchModal onClose={() => setIsSearchOpen(false)} />}
      {isCreateOpen && <CreateWorkItemModal onClose={() => setIsCreateOpen(false)} />}
      {isFeedbackOpen && <FeedbackModal onClose={() => setIsFeedbackOpen(false)} />}
      <AiCopilotDrawer isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} />
    </>
  );
};
