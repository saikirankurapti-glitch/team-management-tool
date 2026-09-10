import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { fetchApi } from '../services/api';
import { Notification } from '../types';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadNotifications = () => {
    fetchApi<{ notifications: Notification[] }>('/notifications')
      .then((data) => setNotifications(data.notifications || []))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markAllRead = async () => {
    try {
      await fetchApi('/notifications/all/read', { method: 'PATCH' });
      loadNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-xs font-mono text-slate-400">Loading Notification Center...</div>;
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full text-xs">
      {/* Header Standard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border-warm pb-4 gap-2">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-olive-soft flex items-center justify-center text-olive-dark">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink-primary tracking-tight">
              Notification Feed
            </h1>
            <p className="text-ink-muted text-xs">
              Task assignments, mentions, PR reviews, and automated alert activity
            </p>
          </div>
        </div>

        <button
          onClick={markAllRead}
          className="btn-pill-secondary btn-pill-sm flex items-center space-x-1.5"
        >
          <CheckCheck className="w-3.5 h-3.5 text-olive" />
          <span>Mark All Read</span>
        </button>
      </div>

      {/* Notifications List Table */}
      <div className="panel-cream overflow-hidden">
        <div className="p-3.5 border-b border-border-warm font-bold text-xs uppercase tracking-wider text-ink-primary bg-canvas-secondary">
          Activity Logs ({notifications.length})
        </div>
        <div className="divide-y divide-border-warm">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-3.5 text-xs flex items-center justify-between transition-colors ${
                notif.isRead ? 'bg-surface-primary opacity-75' : 'bg-surface-hover font-semibold'
              }`}
            >
              <div className="space-y-0.5 min-w-0 pr-3">
                <div className="flex items-center space-x-2">
                  <span className={`font-bold ${!notif.isRead ? 'text-olive-dark' : 'text-ink-primary'}`}>
                    {notif.title}
                  </span>
                  <span className="font-mono text-[10px] text-ink-muted">
                    {new Date(notif.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-ink-secondary text-[11px] truncate">{notif.body}</p>
              </div>

              {notif.link && (
                <a
                  href={notif.link}
                  className="btn-pill-secondary btn-pill-sm h-7 text-[10px] px-3 font-mono shrink-0"
                >
                  View Link →
                </a>
              )}
            </div>
          ))}
          {notifications.length === 0 && (
            <div className="p-8 text-center text-ink-muted italic text-xs">No notifications</div>
          )}
        </div>
      </div>
    </div>
  );
};
