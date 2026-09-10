import { Request, Response } from 'express';
import { prisma } from '../prisma.js';
import {
  createCalendarEvent,
  listCalendarEvents,
  getMeetingDetails,
  updateCalendarEvent,
  deleteCalendarEvent,
  syncGoogleCalendar,
  checkFreeBusy,
} from '../services/googleCalendarService.js';

const MEETING_MIN_LEAD_MINUTES = 5;
const MAX_MEETING_DURATION_MINUTES = 1440; // 24 hours

const normalizeTimeZone = (tz?: string): string => {
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

const formatErrorMessage = (error: any): { status: number; message: string } => {
  const msg = error.message || 'An unexpected error occurred';
  if (msg.includes('Google account not connected') || msg.includes('Google connection expired') || msg.includes('401')) {
    return { status: 401, message: 'Google connection expired or not connected. Please reconnect your Google account.' };
  }
  if (msg.includes('permission') || msg.includes('403')) {
    return { status: 403, message: 'You do not have permission to modify this calendar event.' };
  }
  if (msg.includes('not found') || msg.includes('404')) {
    return { status: 404, message: 'Meeting not found.' };
  }
  if (msg.includes('rate limit') || msg.includes('429')) {
    return { status: 429, message: 'Google Calendar rate limit reached. Please try again in a few moments.' };
  }
  return { status: 400, message: msg };
};

export const createMeetingHandler = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId;
    const {
      title,
      description,
      startTime,
      endTime,
      timeZone,
      location,
      attendees,
      createMeetLink,
      projectId,
      workItemId,
      sendUpdates,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Meeting title is required', error: 'Meeting title is required' });
    }

    if (!startTime || !endTime) {
      return res.status(400).json({ message: 'Start time and end time are required', error: 'Start time and end time are required' });
    }

    const startMillis = new Date(startTime).getTime();
    const endMillis = new Date(endTime).getTime();
    const nowMillis = Date.now();

    if (isNaN(startMillis) || isNaN(endMillis)) {
      return res.status(400).json({ message: 'Invalid start time or end time format', error: 'Invalid datetime format' });
    }

    const minAllowedStart = nowMillis + (MEETING_MIN_LEAD_MINUTES * 60 * 1000);

    if (startMillis < nowMillis) {
      return res.status(400).json({
        message: 'Meeting start time must be in the future. Meeting date/time cannot be in the past.',
        error: 'Meeting date cannot be in the past.',
      });
    }

    if (startMillis < minAllowedStart) {
      return res.status(400).json({
        message: `Meetings must be scheduled at least ${MEETING_MIN_LEAD_MINUTES} minutes in advance.`,
        error: `Meetings must be scheduled at least ${MEETING_MIN_LEAD_MINUTES} minutes in advance.`,
      });
    }

    if (endMillis <= startMillis) {
      return res.status(400).json({
        message: 'End time must be strictly after start time. Please select a valid meeting duration.',
        error: 'End time must be after start time.',
      });
    }

    const durationMinutes = (endMillis - startMillis) / (60 * 1000);
    if (durationMinutes > MAX_MEETING_DURATION_MINUTES) {
      return res.status(400).json({
        message: 'Meeting duration cannot exceed 24 hours.',
        error: 'Meeting duration exceeds maximum allowable limit of 24 hours.',
      });
    }

    const rawAttendees = Array.isArray(attendees)
      ? attendees
      : typeof attendees === 'string'
      ? attendees.split(',').map((e: string) => e.trim()).filter(Boolean)
      : [];

    const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const parsedAttendees = Array.from(
      new Set(
        rawAttendees
          .map((a: string) => a.trim().toLowerCase())
          .filter((a: string) => validEmailRegex.test(a))
      )
    );

    const targetTimeZone = normalizeTimeZone(timeZone);

    const result = await createCalendarEvent(user.id, orgId, {
      title: title.trim(),
      description: description?.trim() || undefined,
      startTime: new Date(startMillis).toISOString(),
      endTime: new Date(endMillis).toISOString(),
      timeZone: targetTimeZone,
      location: location?.trim() || undefined,
      attendees: parsedAttendees,
      createMeetLink: createMeetLink !== false,
      projectId: projectId || undefined,
      workItemId: workItemId || undefined,
      sendUpdates: sendUpdates || 'all',
    });

    return res.status(201).json({
      message: 'Meeting scheduled successfully with Google Calendar & Google Meet',
      meeting: result.meeting,
      meetLink: result.meeting.meetLink,
      googleEvent: result.gEvent,
      organizerEmail: result.organizerEmail,
      invitationStatus: 'SENT_TO_GOOGLE_CALENDAR',
    });
  } catch (error: any) {
    console.error('[MeetingController] Create meeting error:', error);
    const { status, message } = formatErrorMessage(error);
    return res.status(status).json({ message, error: message });
  }
};

export const listMeetingsHandler = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId;
    const { timeMin, timeMax } = req.query;

    const result = await listCalendarEvents(
      user.id,
      orgId,
      timeMin as string | undefined,
      timeMax as string | undefined
    );

    return res.json(result);
  } catch (error: any) {
    console.error('[MeetingController] List meetings error:', error);
    const { status, message } = formatErrorMessage(error);
    return res.status(status).json({ error: message });
  }
};

export const getMeetingDetailsHandler = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId;
    const meetingId = req.params.id;

    const details = await getMeetingDetails(user.id, orgId, meetingId);

    return res.json(details);
  } catch (error: any) {
    console.error('[MeetingController] Get meeting details error:', error);
    const { status, message } = formatErrorMessage(error);
    return res.status(status).json({ error: message });
  }
};

export const updateMeetingHandler = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId;
    const meetingId = req.params.id;
    const {
      title,
      description,
      startTime,
      endTime,
      timeZone,
      location,
      attendees,
      projectId,
      workItemId,
    } = req.body;

    const parsedAttendees = Array.isArray(attendees)
      ? attendees
      : typeof attendees === 'string'
      ? attendees.split(',').map((e: string) => e.trim()).filter(Boolean)
      : undefined;

    const result = await updateCalendarEvent(user.id, orgId, meetingId, {
      title,
      description,
      startTime,
      endTime,
      timeZone,
      location,
      attendees: parsedAttendees,
      projectId: projectId || undefined,
      workItemId: workItemId || undefined,
      sendUpdates: 'all',
    });

    return res.json({
      message: 'Meeting updated successfully on Google Calendar',
      meeting: result.meeting,
      googleEvent: result.gEvent,
    });
  } catch (error: any) {
    console.error('[MeetingController] Update meeting error:', error);
    const { status, message } = formatErrorMessage(error);
    return res.status(status).json({ error: message });
  }
};

export const deleteMeetingHandler = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId;
    const meetingId = req.params.id;

    await deleteCalendarEvent(user.id, orgId, meetingId);

    return res.json({ success: true, message: 'Meeting cancelled successfully on Google Calendar' });
  } catch (error: any) {
    console.error('[MeetingController] Delete meeting error:', error);
    const { status, message } = formatErrorMessage(error);
    return res.status(status).json({ error: message });
  }
};

export const syncMeetingsHandler = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId;

    const syncResult = await syncGoogleCalendar(user.id, orgId);

    return res.json({
      message: 'Google Calendar synchronized successfully',
      ...syncResult,
    });
  } catch (error: any) {
    console.error('[MeetingController] Sync meetings error:', error);
    const { status, message } = formatErrorMessage(error);
    return res.status(status).json({ error: message });
  }
};

export const checkFreeBusyHandler = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId;
    const { timeMin, timeMax, items } = req.body;

    if (!timeMin || !timeMax) {
      return res.status(400).json({ error: 'timeMin and timeMax are required' });
    }

    const freeBusyData = await checkFreeBusy(user.id, orgId, timeMin, timeMax, items || ['primary']);
    return res.json(freeBusyData);
  } catch (error: any) {
    console.error('[MeetingController] FreeBusy error:', error);
    const { status, message } = formatErrorMessage(error);
    return res.status(status).json({ error: message });
  }
};

export const getMeetings = listMeetingsHandler;
export const createMeeting = createMeetingHandler;

export const convertActionItemToTask = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId;
    const { actionItemText, projectId } = req.body;

    if (!actionItemText) {
      return res.status(400).json({ error: 'Action item text is required' });
    }

    const targetProject = projectId
      ? await prisma.project.findUnique({ where: { id: projectId } })
      : await prisma.project.findFirst({ where: { organizationId: orgId } });

    if (!targetProject) {
      return res.status(400).json({ error: 'No project found to assign work item' });
    }

    const count = await prisma.workItem.count({ where: { projectId: targetProject.id } });
    const humanId = `${targetProject.key}-${count + 101}`;

    const workItem = await prisma.workItem.create({
      data: {
        projectId: targetProject.id,
        humanId,
        title: actionItemText,
        description: `Created from Meeting Action Item`,
        type: 'TASK',
        status: 'TO_DO',
        priority: 'MEDIUM',
        reporterId: user.id,
        assigneeId: user.id,
      },
    });

    return res.status(201).json({ message: 'Converted action item to task', workItem });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to convert action item to task' });
  }
};
