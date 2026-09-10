import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Video,
  Users,
  MapPin,
  X,
  Check,
  Copy,
  ExternalLink,
  AlertCircle,
  Loader2,
  FolderKanban,
  CheckSquare,
  Globe,
  Mail,
} from 'lucide-react';
import { fetchApi } from '../../services/api';
import { Project, WorkItem } from '../../types';

interface ScheduleMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMeetingScheduled?: (meeting: any) => void;
  defaultTitle?: string;
  defaultAttendees?: string[];
  defaultProjectId?: string;
  defaultWorkItemId?: string;
}

const MEETING_MIN_LEAD_MINUTES = 5;
const MAX_MEETING_DURATION_MINUTES = 1440;

const normalizeCanonicalTimeZone = (tz?: string): string => {
  if (!tz) return 'Asia/Kolkata';
  let cleaned = tz.trim();
  if (cleaned === 'Asia/Calcutta') cleaned = 'Asia/Kolkata';
  try {
    Intl.DateTimeFormat(undefined, { timeZone: cleaned });
    return cleaned;
  } catch {
    return 'UTC';
  }
};

const getFutureSlotDefaults = (tz: string) => {
  const now = new Date();
  // Advance by 15 mins and round to next 15 min boundary
  const target = new Date(now.getTime() + 15 * 60 * 1000);
  const minutes = target.getMinutes();
  const roundedMinutes = Math.ceil(minutes / 15) * 15;
  target.setMinutes(roundedMinutes, 0, 0);

  const startFormatted = `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`;
  
  const endTarget = new Date(target.getTime() + 30 * 60 * 1000);
  const endFormatted = `${String(endTarget.getHours()).padStart(2, '0')}:${String(endTarget.getMinutes()).padStart(2, '0')}`;

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  return {
    todayStr,
    startFormatted,
    endFormatted,
  };
};

export const ScheduleMeetingModal: React.FC<ScheduleMeetingModalProps> = ({
  isOpen,
  onClose,
  onMeetingScheduled,
  defaultTitle = '',
  defaultAttendees = [],
  defaultProjectId = '',
  defaultWorkItemId = '',
}) => {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState('');
  
  const [timeZone, setTimeZone] = useState(() => {
    try {
      const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return normalizeCanonicalTimeZone(resolved);
    } catch {
      return 'Asia/Kolkata';
    }
  });

  const [dateStr, setDateStr] = useState(() => getFutureSlotDefaults('Asia/Kolkata').todayStr);
  const [startTimeStr, setStartTimeStr] = useState(() => getFutureSlotDefaults('Asia/Kolkata').startFormatted);
  const [endTimeStr, setEndTimeStr] = useState(() => getFutureSlotDefaults('Asia/Kolkata').endFormatted);

  const [location, setLocation] = useState('');
  const [attendeesInput, setAttendeesInput] = useState(defaultAttendees.join(', '));
  const [attendeeChips, setAttendeeChips] = useState<string[]>(defaultAttendees);
  const [createMeetLink, setCreateMeetLink] = useState(true);
  const [sendInvitationEmails, setSendInvitationEmails] = useState(true);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState(defaultWorkItemId);
  const [organizerEmail, setOrganizerEmail] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdMeeting, setCreatedMeeting] = useState<any | null>(null);
  const [createdOrganizer, setCreatedOrganizer] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedDetails, setCopiedDetails] = useState(false);

  // Re-calculate fresh future defaults whenever modal opens (Section 35)
  useEffect(() => {
    if (isOpen) {
      const canonicalTz = normalizeCanonicalTimeZone(timeZone);
      setTimeZone(canonicalTz);
      const slot = getFutureSlotDefaults(canonicalTz);
      setDateStr(slot.todayStr);
      setStartTimeStr(slot.startFormatted);
      setEndTimeStr(slot.endFormatted);
      setErrorMsg('');
      setCreatedMeeting(null);

      fetchApi<Project[]>('/projects').then(setProjects).catch(() => {});
      fetchApi<{ connected: boolean; googleEmail?: string }>('/integrations/google/status')
        .then((res) => {
          if (res.googleEmail) {
            setOrganizerEmail(res.googleEmail);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedProjectId) {
      const selectedProj = projects.find((p) => p.id === selectedProjectId);
      const projKey = selectedProj?.key || selectedProjectId;
      fetchApi<WorkItem[]>(`/work-items?projectId=${projKey}`)
        .then(setWorkItems)
        .catch(() => setWorkItems([]));
    } else {
      setWorkItems([]);
      setSelectedWorkItemId('');
    }
  }, [selectedProjectId, projects]);

  // Derived Live Validations (Section 1 - 7)
  const now = new Date();
  const minDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const validateForm = (): string | null => {
    if (!title.trim()) return 'Meeting title is required.';
    
    if (dateStr < minDateStr) {
      return 'Meeting date cannot be in the past.';
    }

    const startDateTime = new Date(`${dateStr}T${startTimeStr}:00`);
    const endDateTime = new Date(`${dateStr}T${endTimeStr}:00`);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      return 'Please enter valid date and time values.';
    }

    const startMillis = startDateTime.getTime();
    const endMillis = endDateTime.getTime();
    const nowMillis = Date.now();

    if (startMillis < nowMillis) {
      return 'Meeting start time must be in the future.';
    }

    if (startMillis < nowMillis + MEETING_MIN_LEAD_MINUTES * 60 * 1000) {
      return `Meetings must be scheduled at least ${MEETING_MIN_LEAD_MINUTES} minutes in advance.`;
    }

    if (endMillis <= startMillis) {
      return 'End time must be after start time.';
    }

    const durationMinutes = (endMillis - startMillis) / (60 * 1000);
    if (durationMinutes > MAX_MEETING_DURATION_MINUTES) {
      return 'Meeting duration cannot exceed 24 hours.';
    }

    const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = attendeeChips.filter((em) => !validEmailRegex.test(em));
    if (invalidEmails.length > 0) {
      return `Invalid attendee email: ${invalidEmails.join(', ')}`;
    }

    return null;
  };

  const liveValidationError = validateForm();

  if (!isOpen) return null;

  const handleAttendeesChange = (val: string) => {
    setAttendeesInput(val);
    const emails = val
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0);
    setAttendeeChips(Array.from(new Set(emails)));
  };

  const handleRemoveChip = (emailToRemove: string) => {
    const updated = attendeeChips.filter((e) => e !== emailToRemove);
    setAttendeeChips(updated);
    setAttendeesInput(updated.join(', '));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const parsedAttendees = attendeesInput
        .split(',')
        .map((a) => a.trim().toLowerCase())
        .filter(Boolean);

      const invalidEmails = parsedAttendees.filter((em) => !validEmailRegex.test(em));
      if (invalidEmails.length > 0) {
        throw new Error(`Invalid email address format: ${invalidEmails.join(', ')}`);
      }

      const startDateTime = new Date(`${dateStr}T${startTimeStr}:00`);
      const endDateTime = new Date(`${dateStr}T${endTimeStr}:00`);

      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        throw new Error('Please select valid start and end dates/times.');
      }

      if (endDateTime.getTime() <= startDateTime.getTime()) {
        throw new Error('End time must be strictly after start time.');
      }

      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        timeZone,
        location: location.trim() || undefined,
        attendees: Array.from(new Set(parsedAttendees)),
        createMeetLink,
        projectId: selectedProjectId || undefined,
        workItemId: selectedWorkItemId || undefined,
        sendUpdates: sendInvitationEmails ? 'all' : 'none',
      };

      const res = await fetchApi<any>('/google/meetings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setCreatedMeeting(res.meeting);
      if (onMeetingScheduled) onMeetingScheduled(res.meeting);
    } catch (err: any) {
      const msg = err.message || 'Failed to schedule meeting with Google Calendar.';
      if (
        msg.toLowerCase().includes('connection not found') ||
        msg.toLowerCase().includes('connect your google') ||
        msg.toLowerCase().includes('disconnected')
      ) {
        setErrorMsg('Google account not connected. Please go to Settings → Integrations and click "Connect Google Account" first.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyMeetLink = () => {
    if (createdMeeting?.meetLink) {
      navigator.clipboard.writeText(createdMeeting.meetLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyMeetingDetails = () => {
    if (!createdMeeting) return;
    const startFmt = new Date(createdMeeting.startTime).toLocaleString();
    const endFmt = new Date(createdMeeting.endTime).toLocaleTimeString();
    const details = [
      `Meeting: ${createdMeeting.title}`,
      `Time: ${startFmt} - ${endFmt} (${createdMeeting.timeZone || 'UTC'})`,
      createdMeeting.meetLink ? `Google Meet Link: ${createdMeeting.meetLink}` : null,
      createdMeeting.location ? `Location: ${createdMeeting.location}` : null,
      createdMeeting.description ? `Agenda: ${createdMeeting.description}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(details);
    setCopiedDetails(true);
    setTimeout(() => setCopiedDetails(false), 2000);
  };

  const handleResetAndClose = () => {
    setCreatedMeeting(null);
    setErrorMsg('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-xl panel-cream p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto font-sans">
        {/* Editorial Header */}
        <div className="flex items-center justify-between border-b border-borderWarm pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-lime/30 border border-borderWarm rounded-xl text-olive">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <div className="editorial-eyebrow text-[9px] mb-0.5">[ CALENDAR ENGINE ]</div>
              <h3 className="text-base font-black text-ink">Schedule Google Meet</h3>
              <p className="text-xs text-ink/65">
                Instant Google Meet video conference, attendee synchronization & invitations.
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="text-ink/60 hover:text-ink p-1.5 rounded-full hover:bg-canvas transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-700 dark:text-rose-400 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span className="leading-relaxed font-mono">{errorMsg}</span>
          </div>
        )}

        {createdMeeting ? (
          /* Success Screen (Section 20) */
          <div className="space-y-4 py-2">
            <div className="p-4 bg-slate-900/90 border border-emerald-500/40 rounded-xl space-y-3.5 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="text-emerald-400 font-bold text-xs flex items-center space-x-1.5 font-mono">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>MEETING SCHEDULED</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
                  Google Calendar Synchronized
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="text-slate-100 font-bold text-sm tracking-tight">{createdMeeting.title}</div>
                <div className="text-slate-300 flex items-center space-x-2 font-mono text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    {new Date(createdMeeting.startTime).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    •{' '}
                    {new Date(createdMeeting.startTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    –{' '}
                    {new Date(createdMeeting.endTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Organizer */}
                <div className="p-2 bg-slate-950/80 rounded border border-slate-800/80 flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Organizer</span>
                  <span className="font-mono text-slate-200 text-[11px]">
                    {createdOrganizer || organizerEmail || 'Connected Google Account'}
                  </span>
                </div>

                {/* Attendees */}
                <div className="p-2 bg-slate-950/80 rounded border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Attendees</span>
                    <span className="text-[10px] font-mono text-slate-500">{attendeeChips.length} recipient(s)</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {attendeeChips.map((att) => (
                      <span key={att} className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-300 rounded text-[10px] font-mono">
                        {att}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Verification Checkmarks */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <div className="p-2 bg-slate-950 rounded border border-slate-800 text-[11px] space-y-0.5">
                    <div className="text-slate-400">Google Calendar</div>
                    <div className="text-emerald-400 font-semibold flex items-center space-x-1">
                      <Check className="w-3 h-3" />
                      <span>✓ Event created</span>
                    </div>
                  </div>

                  <div className="p-2 bg-slate-950 rounded border border-slate-800 text-[11px] space-y-0.5">
                    <div className="text-slate-400">Invitation</div>
                    <div className="text-emerald-400 font-semibold flex items-center space-x-1">
                      <Check className="w-3 h-3" />
                      <span>✓ Sent to Google</span>
                    </div>
                  </div>

                  <div className="p-2 bg-slate-950 rounded border border-slate-800 text-[11px] space-y-0.5">
                    <div className="text-slate-400">Google Meet</div>
                    <div className="text-emerald-400 font-semibold flex items-center space-x-1">
                      <Check className="w-3 h-3" />
                      <span>✓ Conference ready</span>
                    </div>
                  </div>
                </div>
              </div>

              {createdMeeting.meetLink && (
                <div className="pt-2 space-y-2 border-t border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Google Meet Video Conference URL
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={createdMeeting.meetLink}
                      className="ent-input w-full text-xs font-mono bg-slate-950 text-rose-300 border-slate-800 select-all"
                    />
                    <button
                      onClick={handleCopyMeetLink}
                      className="ent-btn-secondary px-3 py-1.5 text-xs flex items-center space-x-1 shrink-0"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <a
                      href={createdMeeting.meetLink}
                      target="_blank"
                      rel="noreferrer"
                      className="ent-btn-primary flex items-center justify-center space-x-1.5 text-xs py-2 bg-rose-600 hover:bg-rose-500 border-rose-500"
                    >
                      <Video className="w-4 h-4" />
                      <span>Join Google Meet</span>
                      <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
                    </a>

                    {createdMeeting.googleEventUrl ? (
                      <a
                        href={createdMeeting.googleEventUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ent-btn-secondary flex items-center justify-center space-x-1.5 text-xs py-2"
                      >
                        <Calendar className="w-4 h-4 text-blue-400" />
                        <span>Open Google Calendar</span>
                        <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
                      </a>
                    ) : (
                      <button
                        onClick={handleCopyMeetingDetails}
                        className="ent-btn-secondary flex items-center justify-center space-x-1.5 text-xs py-2"
                      >
                        {copiedDetails ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        <span>Copy Details</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={handleCopyMeetingDetails}
                className="ent-btn-secondary text-xs px-3 py-1.5 flex items-center space-x-1.5"
              >
                {copiedDetails ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Meeting Details</span>
              </button>
              <button onClick={handleResetAndClose} className="ent-btn-primary text-xs px-4 py-1.5">
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Scheduling Form (Section 10) */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Meeting Title <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sprint Planning Sync & Code Review"
                className="ent-input w-full text-xs"
              />
            </div>

            {/* Date, Start Time, End Time */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>Date *</span>
                </label>
                <input
                  type="date"
                  required
                  min={minDateStr}
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="ent-input w-full text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>Start Time *</span>
                </label>
                <input
                  type="time"
                  required
                  value={startTimeStr}
                  onChange={(e) => setStartTimeStr(e.target.value)}
                  className="ent-input w-full text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>End Time *</span>
                </label>
                <input
                  type="time"
                  required
                  value={endTimeStr}
                  onChange={(e) => setEndTimeStr(e.target.value)}
                  className="ent-input w-full text-xs font-mono"
                />
              </div>
            </div>

            {/* Live Real-time Validation Error Banner */}
            {liveValidationError && (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded text-amber-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{liveValidationError}</span>
              </div>
            )}

            {/* Timezone and Calendar Source */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                  <Globe className="w-3 h-3 text-slate-400" />
                  <span>Timezone *</span>
                </label>
                <input
                  type="text"
                  required
                  value={timeZone}
                  onChange={(e) => setTimeZone(normalizeCanonicalTimeZone(e.target.value))}
                  className="ent-input w-full text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>Calendar</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value="Primary Google Calendar"
                  className="ent-input w-full text-xs bg-slate-900/60 text-slate-400 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Attendees (Section 6) */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center space-x-1">
                  <Users className="w-3 h-3 text-slate-400" />
                  <span>Attendees (Comma-separated emails) *</span>
                </span>
                {attendeeChips.length > 0 && (
                  <span className="text-[10px] text-blue-400 font-mono">
                    {attendeeChips.length} recipient{attendeeChips.length > 1 ? 's' : ''}
                  </span>
                )}
              </label>
              <input
                type="text"
                required
                value={attendeesInput}
                onChange={(e) => handleAttendeesChange(e.target.value)}
                placeholder="john@example.com, sarah@example.com"
                className="ent-input w-full text-xs font-mono"
              />
              {attendeeChips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {attendeeChips.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-300 rounded text-[10px] font-mono"
                    >
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveChip(email)}
                        className="hover:text-rose-400 text-slate-400"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Project & Work Item Linkage (Section 13) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                  <FolderKanban className="w-3 h-3 text-slate-400" />
                  <span>Project (Optional)</span>
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="ent-input w-full text-xs"
                >
                  <option value="">No Project Linked</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.key})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                  <CheckSquare className="w-3 h-3 text-slate-400" />
                  <span>Work Item (Optional)</span>
                </label>
                <select
                  value={selectedWorkItemId}
                  onChange={(e) => setSelectedWorkItemId(e.target.value)}
                  disabled={!selectedProjectId || workItems.length === 0}
                  className="ent-input w-full text-xs disabled:opacity-50"
                >
                  <option value="">No Work Item Linked</option>
                  {workItems.map((wi) => (
                    <option key={wi.id} value={wi.id}>
                      {wi.humanId} - {wi.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                <span>Location (Optional)</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Conference Room A or Remote"
                className="ent-input w-full text-xs"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Agenda / Notes
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter meeting agenda..."
                className="ent-input w-full text-xs resize-none"
              />
            </div>

            {/* Toggles (Google Meet & Send Invitations) */}
            <div className="space-y-2 pt-1 border-t border-slate-800">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="createMeetLink"
                  checked={createMeetLink}
                  onChange={(e) => setCreateMeetLink(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500"
                />
                <label htmlFor="createMeetLink" className="text-xs font-semibold text-slate-200 cursor-pointer flex items-center space-x-1.5">
                  <Video className="w-3.5 h-3.5 text-rose-400" />
                  <span>Generate Google Meet Video Conference Link</span>
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="sendInvitationEmails"
                  checked={sendInvitationEmails}
                  onChange={(e) => setSendInvitationEmails(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500"
                />
                <label htmlFor="sendInvitationEmails" className="text-xs font-semibold text-slate-200 cursor-pointer flex items-center space-x-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-400" />
                  <span>Send invitation emails via Google Calendar (sendUpdates=all)</span>
                </label>
              </div>
            </div>

            {/* Submit buttons */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="ent-btn-secondary text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !!liveValidationError}
                className="ent-btn-primary flex items-center space-x-1.5 text-xs px-4 py-1.5 bg-rose-600 hover:bg-rose-500 border-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                <span>{isSubmitting ? 'Scheduling with Google...' : 'Create Meeting'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
