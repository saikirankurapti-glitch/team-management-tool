import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Video,
  Info,
  ExternalLink,
  Layers,
  Briefcase,
  Globe,
  Clock,
  Users,
  MapPin,
  CalendarDays,
  List,
  RefreshCw,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchApi } from '../services/api';
import { Project, User, WorkItem } from '../types';
import { WorkItemSideDrawer } from '../components/common/WorkItemSideDrawer';
import { ScheduleMeetingModal } from '../components/calendar/ScheduleMeetingModal';
import { GoogleEventDetailsModal } from '../components/calendar/GoogleEventDetailsModal';

type CalendarSource = 'ALL' | 'WORK_MANAGEMENT' | 'GOOGLE_CALENDAR';
type CalendarView = 'MONTH' | 'WEEK' | 'DAY' | 'AGENDA';

export const CalendarPage: React.FC = () => {
  const navigate = useNavigate();

  // Sources & Views
  const [source, setSource] = useState<CalendarSource>('ALL');
  const [view, setView] = useState<CalendarView>('MONTH');

  // Data
  const [workEvents, setWorkEvents] = useState<any[]>([]);
  const [googleEvents, setGoogleEvents] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ totalEvents: 0, overdueCount: 0 });
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);

  // Filters & State
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals & Drawers
  const [selectedWorkItem, setSelectedWorkItem] = useState<WorkItem | null>(null);
  const [selectedGoogleEvent, setSelectedGoogleEvent] = useState<any | null>(null);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const handleManualSync = async () => {
    setIsRefreshing(true);
    setSyncMessage(null);
    try {
      if (googleConnected) {
        const syncRes = await fetchApi<{ message?: string; updatedCount?: number; cancelledCount?: number }>(
          '/google/meetings/sync',
          { method: 'POST' }
        );
        setSyncMessage(syncRes.message || 'Google Calendar synchronized.');
        setTimeout(() => setSyncMessage(null), 4000);
      }
      await loadCalendarEvents();
    } catch (err: any) {
      console.error('Manual sync error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadCalendarEvents = async () => {
    setIsRefreshing(true);
    let query = '';
    if (selectedProjectId) query += `projectId=${selectedProjectId}&`;
    if (selectedAssigneeId) query += `assigneeId=${selectedAssigneeId}&`;

    try {
      const [calData, gStatus, projData, memData] = await Promise.all([
        fetchApi<{ events: any[]; summary: any }>(`/calendar/events?${query}`),
        fetchApi<{ connected: boolean; googleEmail?: string }>('/integrations/google/status').catch(() => ({
          connected: false,
          googleEmail: undefined,
        })),
        fetchApi<Project[]>('/projects').catch(() => []),
        fetchApi<User[]>('/organization/members').catch(() => []),
      ]);

      setWorkEvents(calData.events || []);
      setSummary(calData.summary || { totalEvents: 0, overdueCount: 0 });
      setGoogleConnected(gStatus.connected);
      setGoogleEmail(gStatus.googleEmail || null);
      setProjects(projData);
      setMembers(memData);

      // If Google is connected, fetch real Google Calendar events
      if (gStatus.connected) {
        try {
          const gData = await fetchApi<{ googleEvents: any[]; dbMeetings: any[] }>('/google/meetings');
          setGoogleEvents(gData.googleEvents || []);
        } catch (gErr) {
          console.error('Failed to fetch real Google Calendar events', gErr);
        }
      } else {
        setGoogleEvents([]);
      }
    } catch (err) {
      console.error('Error loading calendar data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadCalendarEvents();
  }, [selectedProjectId, selectedAssigneeId]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDay = firstDayOfMonth.getDay();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const handlePrev = () => {
    if (view === 'MONTH') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else if (view === 'WEEK') {
      const prevWeek = new Date(currentDate);
      prevWeek.setDate(prevWeek.getDate() - 7);
      setCurrentDate(prevWeek);
    } else if (view === 'DAY') {
      const prevDay = new Date(currentDate);
      prevDay.setDate(prevDay.getDate() - 1);
      setCurrentDate(prevDay);
    }
  };

  const handleNext = () => {
    if (view === 'MONTH') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else if (view === 'WEEK') {
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(nextWeek.getDate() + 7);
      setCurrentDate(nextWeek);
    } else if (view === 'DAY') {
      const nextDay = new Date(currentDate);
      nextDay.setDate(nextDay.getDate() + 1);
      setCurrentDate(nextDay);
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleWorkItemClick = async (event: any) => {
    if (event.entityType === 'WORK_ITEM') {
      try {
        const items = await fetchApi<WorkItem[]>(`/work-items?projectId=${event.projectKey}`);
        const found = items.find((i: WorkItem) => i.id === event.entityId);
        if (found) setSelectedWorkItem(found);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleGoogleEventClick = (event: any) => {
    setSelectedGoogleEvent(event);
  };

  // Filtered Events
  const showWork = source === 'ALL' || source === 'WORK_MANAGEMENT';
  const showGoogle = source === 'ALL' || source === 'GOOGLE_CALENDAR';

  // Normalize date string (YYYY-MM-DD) helper
  const getEventDateString = (e: any, isGoogle: boolean) => {
    if (isGoogle) {
      const raw = e.start?.dateTime || e.start?.date;
      return raw ? raw.slice(0, 10) : '';
    }
    return e.date ? e.date.slice(0, 10) : '';
  };

  // Agenda items builder
  const allAgendaItems = [
    ...(showGoogle
      ? googleEvents.map((ge) => ({
          ...ge,
          isGoogle: true,
          dateSort: new Date(ge.start?.dateTime || ge.start?.date || 0).getTime(),
        }))
      : []),
    ...(showWork
      ? workEvents.map((we) => ({
          ...we,
          isGoogle: false,
          dateSort: new Date(we.date || 0).getTime(),
        }))
      : []),
  ].sort((a, b) => a.dateSort - b.dateSort);

  if (isLoading) {
    return <div className="p-6 text-xs font-mono text-slate-400">Loading Calendar Hub...</div>;
  }

  return (
    <div className="p-5 space-y-4 overflow-y-auto h-full text-xs">
      {/* Header Standard */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-borderWarm pb-4 gap-3">
        <div className="space-y-1">
          <div className="editorial-eyebrow text-[9px]">
            SCHEDULE
          </div>
          <h1 className="text-2xl font-black text-ink tracking-tight">
            Work Calendar & Meetings
          </h1>
          <p className="text-xs text-ink-muted">
            Work management deadlines & synchronized Google Calendar events
          </p>
        </div>

        {/* Controls Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Calendar Source Switcher */}
          <div className="flex items-center bg-surface border border-borderWarm rounded-full p-1 shadow-xs">
            <button
              onClick={() => setSource('ALL')}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all flex items-center space-x-1.5 ${
                source === 'ALL'
                  ? 'bg-olive-dark text-canvas'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All</span>
            </button>
            <button
              onClick={() => setSource('WORK_MANAGEMENT')}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all flex items-center space-x-1.5 ${
                source === 'WORK_MANAGEMENT'
                  ? 'bg-olive-dark text-canvas'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Work</span>
            </button>
            <button
              onClick={() => setSource('GOOGLE_CALENDAR')}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all flex items-center space-x-1.5 ${
                source === 'GOOGLE_CALENDAR'
                  ? 'bg-olive-dark text-canvas'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Google</span>
            </button>
          </div>

          {/* View Switcher (Month / Week / Day / Agenda) */}
          <div className="flex items-center bg-surface border border-borderWarm rounded-full p-1 shadow-xs">
            {(['MONTH', 'WEEK', 'DAY', 'AGENDA'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1 text-xs rounded-full font-semibold transition-colors capitalize ${
                  view === v
                    ? 'bg-lime/40 text-ink font-bold'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {v.toLowerCase()}
              </button>
            ))}
          </div>

          {summary.overdueCount > 0 && (
            <div className="px-3 py-1 bg-status-error/15 border border-status-error/30 text-status-error font-mono font-bold rounded-full text-xs flex items-center space-x-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{summary.overdueCount} Overdue</span>
            </div>
          )}

          <button
            onClick={() => setIsMeetingModalOpen(true)}
            className="btn-pill-primary h-9 px-4 text-xs font-semibold shrink-0"
          >
            <Video className="w-3.5 h-3.5" />
            <span>Schedule Meeting</span>
          </button>

          <button
            onClick={handleManualSync}
            disabled={isRefreshing}
            title="Synchronize events with Google Calendar"
            className="btn-pill-secondary h-9 w-9 p-0 flex items-center justify-center shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-olive-dark ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Google Connection Status Banner */}
      {googleConnected === false && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-2 text-amber-400 text-[11px]">
            <Info className="w-4 h-4 shrink-0" />
            <span>
              <strong>Google account not connected.</strong> Connect your Google account to view real Google Calendar events and schedule Google Meet calls.
            </span>
          </div>
          <button
            onClick={() => navigate('/integrations')}
            className="ent-btn-primary flex items-center space-x-1 text-[11px] px-3 py-1 bg-blue-600 hover:bg-blue-500 border-blue-500 shrink-0"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Connect Google Account</span>
          </button>
        </div>
      )}

      {googleConnected === true && googleEmail && (
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-between text-emerald-400 text-[11px] font-mono">
          <div className="flex items-center space-x-2">
            <Video className="w-4 h-4" />
            <span>
              Google Calendar & Meet connected as <strong>{googleEmail}</strong> ({googleEvents.length} active events synchronized)
            </span>
          </div>
          <button
            onClick={() => window.open('https://calendar.google.com', '_blank')}
            className="flex items-center space-x-1 text-slate-300 hover:text-white text-[11px] font-sans"
          >
            <span>Open Google Calendar</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      )}

      {syncMessage && (
        <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-300 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            <span>{syncMessage}</span>
          </div>
          <button onClick={() => setSyncMessage(null)} className="text-slate-400 hover:text-slate-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Date Navigation & Period Label */}
      <div className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
        <div className="flex items-center space-x-2">
          <button onClick={handleToday} className="ent-btn-secondary text-xs px-2.5 py-1 font-semibold">
            Today
          </button>
          <div className="flex items-center space-x-1">
            <button onClick={handlePrev} className="p-1 ent-btn-secondary h-7 w-7 flex items-center justify-center">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleNext} className="p-1 ent-btn-secondary h-7 w-7 flex items-center justify-center">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="text-sm font-bold text-slate-100 font-mono">
          {view === 'MONTH' && `${monthNames[month]} ${year}`}
          {view === 'WEEK' && `Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
          {view === 'DAY' && currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          {view === 'AGENDA' && 'All Scheduled Events & Milestones'}
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-3 text-[10px] font-mono text-slate-400">
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded bg-rose-600 inline-block" />
            <span>Google Meet / Calendar</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded bg-blue-600 inline-block" />
            <span>Work Item</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block" />
            <span>Sprint Start</span>
          </span>
        </div>
      </div>

      {/* VIEW 1: MONTH VIEW */}
      {view === 'MONTH' && (
        <div className="ent-panel overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-500 text-center py-2 text-[10px] uppercase tracking-wider bg-slate-50 dark:bg-slate-950">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          <div className="grid grid-cols-7 bg-slate-100 dark:bg-slate-950 gap-[1px]">
            {Array.from({ length: startingDay }).map((_, idx) => (
              <div key={`empty-${idx}`} className="min-h-[110px] p-1.5 bg-slate-50/50 dark:bg-slate-950/40" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

              const dayWorkEvents = showWork
                ? workEvents.filter((e) => getEventDateString(e, false) === cellDateStr)
                : [];
              const dayGoogleEvents = showGoogle
                ? googleEvents.filter((e) => getEventDateString(e, true) === cellDateStr)
                : [];

              const totalItems = dayWorkEvents.length + dayGoogleEvents.length;
              const isToday =
                new Date().toISOString().slice(0, 10) === cellDateStr;

              return (
                <div
                  key={dayNum}
                  className={`min-h-[110px] p-1.5 bg-white dark:bg-slate-900/80 space-y-1 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                    isToday ? 'ring-1 ring-blue-500/50 bg-blue-500/5 dark:bg-blue-900/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between font-mono">
                    <span
                      className={`font-bold text-xs ${
                        isToday
                          ? 'w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {totalItems > 0 && (
                      <span className="text-[9px] text-slate-400 font-semibold">{totalItems} items</span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {/* Google Calendar Events */}
                    {dayGoogleEvents.map((evt) => (
                      <div
                        key={evt.id}
                        onClick={() => handleGoogleEventClick(evt)}
                        title={`${evt.summary} (Google Calendar)`}
                        className="p-1 rounded text-[10px] font-mono cursor-pointer truncate bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 flex items-center space-x-1"
                      >
                        <Video className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                        <span className="truncate">{evt.summary}</span>
                      </div>
                    ))}

                    {/* Work Management Events */}
                    {dayWorkEvents.map((evt) => (
                      <div
                        key={evt.id}
                        onClick={() => handleWorkItemClick(evt)}
                        className={`p-1 rounded text-[10px] font-mono cursor-pointer truncate ${
                          evt.isOverdue
                            ? 'badge-red'
                            : evt.entityType === 'SPRINT_START'
                            ? 'badge-green'
                            : 'badge-blue'
                        }`}
                      >
                        {evt.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: WEEK VIEW */}
      {view === 'WEEK' && (
        <div className="ent-panel overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950 text-slate-400 font-mono text-[11px] py-2 text-center">
            {Array.from({ length: 7 }).map((_, idx) => {
              const startOfWeek = new Date(currentDate);
              startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + idx);
              const dateStr = startOfWeek.toISOString().slice(0, 10);
              const isToday = new Date().toISOString().slice(0, 10) === dateStr;

              return (
                <div key={idx} className={isToday ? 'text-blue-400 font-bold' : ''}>
                  <div>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][idx]}</div>
                  <div className="text-xs font-bold text-slate-200">{startOfWeek.getDate()}</div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-7 bg-slate-950 gap-[1px] min-h-[400px]">
            {Array.from({ length: 7 }).map((_, idx) => {
              const colDate = new Date(currentDate);
              colDate.setDate(currentDate.getDate() - currentDate.getDay() + idx);
              const colDateStr = colDate.toISOString().slice(0, 10);

              const dayWorkEvents = showWork
                ? workEvents.filter((e) => getEventDateString(e, false) === colDateStr)
                : [];
              const dayGoogleEvents = showGoogle
                ? googleEvents.filter((e) => getEventDateString(e, true) === colDateStr)
                : [];

              return (
                <div key={idx} className="p-2 bg-slate-900/60 space-y-2 border-r border-slate-800/60 last:border-r-0">
                  {dayGoogleEvents.map((evt) => (
                    <div
                      key={evt.id}
                      onClick={() => handleGoogleEventClick(evt)}
                      className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 cursor-pointer space-y-1"
                    >
                      <div className="flex items-center space-x-1 font-bold truncate">
                        <Video className="w-3 h-3 text-rose-400 shrink-0" />
                        <span className="truncate">{evt.summary}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {evt.start?.dateTime
                          ? new Date(evt.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'All Day'}
                      </div>
                    </div>
                  ))}

                  {dayWorkEvents.map((evt) => (
                    <div
                      key={evt.id}
                      onClick={() => handleWorkItemClick(evt)}
                      className="p-2 rounded bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 cursor-pointer space-y-1"
                    >
                      <div className="font-bold truncate">{evt.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{evt.projectKey || 'Work Item'}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: DAY VIEW */}
      {view === 'DAY' && (
        <div className="ent-panel p-4 space-y-4">
          <div className="text-sm font-bold text-slate-200 font-mono border-b border-slate-800 pb-2 flex items-center justify-between">
            <span>Schedule for {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
            <button
              onClick={() => setIsMeetingModalOpen(true)}
              className="ent-btn-primary px-3 py-1 text-xs bg-rose-600 hover:bg-rose-500 border-rose-500 flex items-center space-x-1"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Schedule for this Day</span>
            </button>
          </div>

          {(() => {
            const dateStr = currentDate.toISOString().slice(0, 10);
            const dayWorkEvents = showWork
              ? workEvents.filter((e) => getEventDateString(e, false) === dateStr)
              : [];
            const dayGoogleEvents = showGoogle
              ? googleEvents.filter((e) => getEventDateString(e, true) === dateStr)
              : [];

            if (dayWorkEvents.length === 0 && dayGoogleEvents.length === 0) {
              return (
                <div className="p-8 text-center text-slate-500 font-mono text-xs">
                  No events or deadlines scheduled for this date.
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {dayGoogleEvents.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => handleGoogleEventClick(evt)}
                    className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center justify-between cursor-pointer hover:bg-rose-500/15"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Video className="w-4 h-4 text-rose-400" />
                        <span className="font-bold text-slate-100 text-sm">{evt.summary}</span>
                        <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-300 rounded text-[10px] font-mono">
                          Google Calendar
                        </span>
                      </div>
                      <div className="text-slate-400 text-xs flex items-center space-x-3 font-mono">
                        <span>
                          {evt.start?.dateTime
                            ? new Date(evt.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'All day'}
                          {evt.end?.dateTime &&
                            ` – ${new Date(evt.end.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        </span>
                        {evt.attendees && <span>👥 {evt.attendees.length} attendee{evt.attendees.length > 1 ? 's' : ''}</span>}
                      </div>
                    </div>
                    {evt.hangoutLink && (
                      <a
                        href={evt.hangoutLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="ent-btn-primary px-3 py-1.5 text-xs bg-rose-600 hover:bg-rose-500 border-rose-500 flex items-center space-x-1"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Join Meet</span>
                      </a>
                    )}
                  </div>
                ))}

                {dayWorkEvents.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => handleWorkItemClick(evt)}
                    className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center justify-between cursor-pointer hover:bg-blue-500/15"
                  >
                    <div>
                      <div className="font-bold text-slate-100 text-sm">{evt.title}</div>
                      <div className="text-slate-400 text-xs font-mono">
                        {evt.projectKey} • {evt.entityType}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* VIEW 4: AGENDA VIEW */}
      {view === 'AGENDA' && (
        <div className="ent-panel p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-sm font-bold text-slate-100">Chronological Agenda</span>
            <span className="text-xs font-mono text-slate-400">{allAgendaItems.length} total entries</span>
          </div>

          {allAgendaItems.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-mono text-xs">
              No upcoming events found for the active filter.
            </div>
          ) : (
            <div className="space-y-2">
              {allAgendaItems.map((item, idx) => {
                const dateDisplay = item.isGoogle
                  ? new Date(item.start?.dateTime || item.start?.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })
                  : new Date(item.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    });

                return (
                  <div
                    key={item.id || idx}
                    onClick={() => (item.isGoogle ? handleGoogleEventClick(item) : handleWorkItemClick(item))}
                    className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                      item.isGoogle
                        ? 'bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/15'
                        : 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/15'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        {item.isGoogle ? (
                          <Video className="w-4 h-4 text-rose-400" />
                        ) : (
                          <CalendarDays className="w-4 h-4 text-blue-400" />
                        )}
                        <span className="font-bold text-slate-100 text-xs">{item.summary || item.title}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                            item.isGoogle ? 'bg-rose-500/20 text-rose-300' : 'bg-blue-500/20 text-blue-300'
                          }`}
                        >
                          {item.isGoogle ? 'Google Meet' : item.entityType || 'Work Item'}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px] font-mono flex items-center space-x-3">
                        <span>📅 {dateDisplay}</span>
                        {item.isGoogle && item.start?.dateTime && (
                          <span>
                            ⏰ {new Date(item.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {item.attendees && (
                          <span>👥 {item.attendees.length} attendee{item.attendees.length > 1 ? 's' : ''}</span>
                        )}
                        {item.projectName && <span>📁 {item.projectName}</span>}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {item.hangoutLink && (
                        <a
                          href={item.hangoutLink}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="ent-btn-primary px-3 py-1.5 text-xs bg-rose-600 hover:bg-rose-500 border-rose-500 flex items-center space-x-1"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Join Meet</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Side Drawer for Work Item Details */}
      {selectedWorkItem && <WorkItemSideDrawer item={selectedWorkItem} onClose={() => setSelectedWorkItem(null)} />}

      {/* Modal for Google Calendar Event Details */}
      {selectedGoogleEvent && (
        <GoogleEventDetailsModal
          isOpen={!!selectedGoogleEvent}
          event={selectedGoogleEvent}
          onClose={() => setSelectedGoogleEvent(null)}
          onEventCancelled={loadCalendarEvents}
          onEventUpdated={loadCalendarEvents}
        />
      )}

      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        isOpen={isMeetingModalOpen}
        onClose={() => setIsMeetingModalOpen(false)}
        onMeetingScheduled={loadCalendarEvents}
      />
    </div>
  );
};

