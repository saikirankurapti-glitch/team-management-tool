import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Video,
  Users,
  MapPin,
  X,
  ExternalLink,
  Trash2,
  AlertTriangle,
  FolderKanban,
  CheckSquare,
  Globe,
  Loader2,
  Edit2,
  History,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { fetchApi } from '../../services/api';

export interface GoogleEventDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: any | null;
  onEventCancelled?: () => void;
  onEventUpdated?: () => void;
}

export const GoogleEventDetailsModal: React.FC<GoogleEventDetailsModalProps> = ({
  isOpen,
  onClose,
  event: initialEvent,
  onEventCancelled,
  onEventUpdated,
}) => {
  const [eventData, setEventData] = useState<any>(initialEvent);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Edit / Reschedule form state
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editTimeZone, setEditTextZone] = useState('Asia/Kolkata');
  const [editLocation, setEditLocation] = useState('');
  const [editAttendees, setEditAttendees] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'edit'>('details');

  const startIso = eventData?.start?.dateTime || eventData?.start?.date || eventData?.startTime;
  const endIso = eventData?.end?.dateTime || eventData?.end?.date || eventData?.endTime;

  const startDate = startIso ? new Date(startIso) : null;
  const endDate = endIso ? new Date(endIso) : null;

  // Initialize edit fields
  const initializeEditState = (data: any) => {
    setEditTitle(data.summary || data.title || '');
    setEditDescription(data.description || '');
    const sDate = data.start?.dateTime || data.startTime ? new Date(data.start?.dateTime || data.startTime) : new Date();
    const eDate = data.end?.dateTime || data.endTime ? new Date(data.end?.dateTime || data.endTime) : new Date(Date.now() + 30 * 60000);

    const year = sDate.getFullYear();
    const month = String(sDate.getMonth() + 1).padStart(2, '0');
    const day = String(sDate.getDate()).padStart(2, '0');
    setEditDate(`${year}-${month}-${day}`);

    const startH = String(sDate.getHours()).padStart(2, '0');
    const startM = String(sDate.getMinutes()).padStart(2, '0');
    setEditStartTime(`${startH}:${startM}`);

    const endH = String(eDate.getHours()).padStart(2, '0');
    const endM = String(eDate.getMinutes()).padStart(2, '0');
    setEditEndTime(`${endH}:${endM}`);

    const tz = data.start?.timeZone || data.timeZone || 'Asia/Kolkata';
    setEditTextZone(tz === 'Asia/Calcutta' ? 'Asia/Kolkata' : tz);
    setEditLocation(data.location || '');

    const attList = (data.attendees || []).map((a: any) => (typeof a === 'string' ? a : a.email)).filter(Boolean);
    setEditAttendees(attList.join(', '));
  };

  useEffect(() => {
    if (initialEvent) {
      setEventData(initialEvent);
      initializeEditState(initialEvent);

      // Fetch fresh live details if meetingId or ID exists
      const idToFetch = initialEvent.meetingId || initialEvent.id;
      if (idToFetch) {
        setIsLoadingDetails(true);
        fetchApi<{ meeting?: any; googleEvent?: any; liveAttendees?: any[]; activities?: any[] }>(
          `/google/meetings/${idToFetch}`
        )
          .then((res) => {
            if (res.meeting || res.googleEvent) {
              const merged = {
                ...initialEvent,
                ...(res.meeting || {}),
                ...(res.googleEvent || {}),
                attendees: res.liveAttendees || initialEvent.attendees,
                activities: res.activities || res.meeting?.activities || [],
              };
              setEventData(merged);
              initializeEditState(merged);
            }
          })
          .catch((err) => {
            console.warn('Could not load extra meeting details:', err);
          })
          .finally(() => {
            setIsLoadingDetails(false);
          });
      }
    }
  }, [initialEvent]);

  if (!isOpen || !eventData) return null;

  const getRsvpBadge = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'accepted':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
            ACCEPTED
          </span>
        );
      case 'tentative':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold">
            TENTATIVE
          </span>
        );
      case 'declined':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
            DECLINED
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-400">
            NEEDS ACTION
          </span>
        );
    }
  };

  const handleCancelMeeting = async () => {
    const targetId = eventData.meetingId || eventData.id;
    if (!targetId) return;
    setIsCancelling(true);
    setErrorMsg('');

    try {
      await fetchApi(`/google/meetings/${targetId}`, {
        method: 'DELETE',
      });
      if (onEventCancelled) onEventCancelled();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to cancel meeting on Google Calendar.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleSaveUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!editTitle.trim()) {
      setErrorMsg('Meeting title is required.');
      return;
    }

    if (!editDate || !editStartTime || !editEndTime) {
      setErrorMsg('Date, start time, and end time are required.');
      return;
    }

    const startDateTime = new Date(`${editDate}T${editStartTime}:00`);
    const endDateTime = new Date(`${editDate}T${editEndTime}:00`);
    const now = Date.now();

    if (startDateTime.getTime() < now) {
      setErrorMsg('Rescheduled start time cannot be in the past.');
      return;
    }

    if (endDateTime.getTime() <= startDateTime.getTime()) {
      setErrorMsg('End time must be strictly after start time.');
      return;
    }

    const parsedAttendees = editAttendees
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

    setIsSaving(true);

    try {
      const targetId = eventData.meetingId || eventData.id;
      const res = await fetchApi<{ meeting: any; googleEvent: any }>(`/google/meetings/${targetId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          timeZone: editTimeZone,
          location: editLocation.trim(),
          attendees: parsedAttendees,
        }),
      });

      setSuccessMsg('Meeting successfully updated on Google Calendar!');
      setEventData((prev: any) => ({
        ...prev,
        ...(res.meeting || {}),
        summary: res.meeting.title,
        start: { dateTime: res.meeting.startTime, timeZone: res.meeting.timeZone },
        end: { dateTime: res.meeting.endTime, timeZone: res.meeting.timeZone },
      }));
      setIsEditing(false);
      setActiveTab('details');

      if (onEventUpdated) onEventUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update meeting on Google Calendar.');
    } finally {
      setIsSaving(false);
    }
  };

  const activities = eventData.activities || [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-xl ent-panel p-6 space-y-4 border border-slate-800 shadow-2xl bg-slate-950 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-start space-x-2.5">
            <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 mt-0.5">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-mono text-blue-400 font-semibold">
                  Google Calendar Event
                </span>
                {eventData.status === 'cancelled' || eventData.status === 'CANCELLED' ? (
                  <span className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 rounded text-[10px] font-mono text-rose-400 font-semibold">
                    CANCELLED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] font-mono text-emerald-400 font-semibold">
                    CONFIRMED
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-100 mt-1">{eventData.summary || eventData.title || '(No Title)'}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 text-xs font-medium">
          <button
            onClick={() => {
              setActiveTab('details');
              setIsEditing(false);
            }}
            className={`px-3 py-2 border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'details'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Meeting Details</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('timeline');
              setIsEditing(false);
            }}
            className={`px-3 py-2 border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'timeline'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Activity Timeline ({activities.length})</span>
          </button>

          {eventData.status !== 'CANCELLED' && eventData.status !== 'cancelled' && (
            <button
              onClick={() => {
                setActiveTab('edit');
                setIsEditing(true);
              }}
              className={`px-3 py-2 border-b-2 transition-colors flex items-center space-x-1.5 ${
                activeTab === 'edit'
                  ? 'border-blue-500 text-blue-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit / Reschedule</span>
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-300 text-xs flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-300 text-xs flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB 1: DETAILS VIEW */}
        {activeTab === 'details' && (
          <div className="space-y-3.5 text-xs text-slate-300">
            {/* Time */}
            {startDate && (
              <div className="flex items-start space-x-2.5">
                <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-200">
                    {startDate.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                  <div className="text-slate-400 font-mono text-[11px]">
                    {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {endDate && ` – ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                </div>
              </div>
            )}

            {/* Timezone / Calendar */}
            <div className="flex items-center space-x-2.5 text-slate-400 font-mono text-[11px]">
              <Globe className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Calendar: Primary Google Calendar ({eventData.start?.timeZone || eventData.timeZone || 'Asia/Kolkata'})</span>
            </div>

            {/* Organizer */}
            {eventData.organizer && (
              <div className="flex items-start space-x-2.5">
                <Users className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-slate-400 text-[11px]">Organizer</div>
                  <div className="font-mono text-slate-200">
                    {eventData.organizer.displayName || eventData.organizer.email}
                    {eventData.organizer.self && <span className="text-blue-400 ml-1">(You)</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Attendees & Live RSVP Status */}
            {eventData.attendees && eventData.attendees.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                  <span>Attendees & RSVP Status ({eventData.attendees.length})</span>
                  <span className="text-[10px] text-slate-500">Live Google Calendar Status</span>
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {eventData.attendees.map((att: any, idx: number) => {
                    const email = typeof att === 'string' ? att : att.email;
                    const name = typeof att === 'object' ? att.displayName : undefined;
                    const rsvp = typeof att === 'object' ? att.responseStatus : 'needsAction';
                    const isSelf = typeof att === 'object' ? att.self : false;

                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-slate-900/80 border border-slate-800 rounded text-[11px]"
                      >
                        <div className="truncate pr-2 font-mono text-slate-300">
                          {name ? `${name} (${email})` : email}
                          {isSelf && <span className="text-blue-400 ml-1">(You)</span>}
                        </div>
                        <div>{getRsvpBadge(rsvp)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Project / Work Item Linkage */}
            {(eventData.projectName || eventData.workItemHumanId || eventData.projectKey) && (
              <div className="flex items-center space-x-3 pt-1 border-t border-slate-800/80">
                {(eventData.projectName || eventData.projectKey) && (
                  <div className="flex items-center space-x-1.5 text-blue-400 text-[11px] font-mono">
                    <FolderKanban className="w-3.5 h-3.5 text-blue-400" />
                    <span>{eventData.projectName || 'Project'} ({eventData.projectKey || 'PROJ'})</span>
                  </div>
                )}
                {eventData.workItemHumanId && (
                  <div className="flex items-center space-x-1.5 text-emerald-400 text-[11px] font-mono">
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{eventData.workItemHumanId}</span>
                  </div>
                )}
              </div>
            )}

            {/* Location */}
            {eventData.location && (
              <div className="flex items-start space-x-2.5">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="text-slate-300">{eventData.location}</div>
              </div>
            )}

            {/* Description */}
            {eventData.description && (
              <div className="space-y-1 pt-1 border-t border-slate-800/80">
                <div className="text-[11px] font-semibold text-slate-400">Description / Agenda</div>
                <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded text-slate-300 whitespace-pre-wrap text-[11px]">
                  {eventData.description}
                </div>
              </div>
            )}

            {/* Video Conference Link */}
            {eventData.hangoutLink && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">
                    Google Meet Video Call
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 truncate max-w-[200px]">
                    {eventData.hangoutLink}
                  </span>
                </div>
                <a
                  href={eventData.hangoutLink}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full ent-btn-primary flex items-center justify-center space-x-2 text-xs py-2 bg-rose-600 hover:bg-rose-500 border-rose-500"
                >
                  <Video className="w-4 h-4" />
                  <span>Join Google Meet</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-1" />
                </a>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TIMELINE VIEW */}
        {activeTab === 'timeline' && (
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Meeting Lifecycle History
            </span>

            {activities.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-4 text-center">No activity history recorded for this meeting.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {activities.map((act: any) => (
                  <div
                    key={act.id}
                    className="p-2.5 bg-slate-900/60 border border-slate-800 rounded flex items-start justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-200 flex items-center space-x-1.5">
                        <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-300 rounded text-[9px] font-mono">
                          {act.action}
                        </span>
                        <span>{act.description}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {new Date(act.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: EDIT / RESCHEDULE FORM */}
        {activeTab === 'edit' && (
          <form onSubmit={handleSaveUpdate} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Meeting Title *
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={editDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  End Time *
                </label>
                <input
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Attendees (comma separated emails)
              </label>
              <input
                type="text"
                placeholder="colleague@example.com, client@domain.com"
                value={editAttendees}
                onChange={(e) => setEditAttendees(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Google Calendar will send update emails to all attendees via sendUpdates=all.
              </span>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Location (Optional)
              </label>
              <input
                type="text"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Description / Agenda
              </label>
              <textarea
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setActiveTab('details');
                }}
                className="ent-btn-secondary px-3 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="ent-btn-primary px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 border-blue-500 flex items-center space-x-1.5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save Google Calendar Update</span>
              </button>
            </div>
          </form>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <div>
            {eventData.htmlLink && (
              <a
                href={eventData.htmlLink}
                target="_blank"
                rel="noreferrer"
                className="ent-btn-secondary text-xs px-3 py-1.5 flex items-center space-x-1.5 text-blue-400"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Google Calendar</span>
              </a>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {eventData.status !== 'CANCELLED' && eventData.status !== 'cancelled' && (
              confirmCancel ? (
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-rose-400 font-semibold">Cancel this Google meeting?</span>
                  <button
                    type="button"
                    onClick={handleCancelMeeting}
                    disabled={isCancelling}
                    className="ent-btn-primary px-3 py-1 text-xs bg-rose-600 hover:bg-rose-500 border-rose-500 flex items-center space-x-1"
                  >
                    {isCancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    <span>Confirm Cancel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                    className="ent-btn-secondary px-2 py-1 text-xs"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  className="ent-btn-secondary text-xs px-3 py-1.5 text-rose-400 hover:text-rose-300 hover:border-rose-500/50 flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Cancel Meeting</span>
                </button>
              )
            )}

            <button onClick={onClose} className="ent-btn-secondary text-xs px-4 py-1.5">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
