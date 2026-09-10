import { prisma } from '../prisma.js';
import { getValidAccessTokenForUser } from './googleAuthService.js';

export interface CalendarEventInput {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  timeZone?: string;
  location?: string;
  attendees?: string[];
  createMeetLink?: boolean;
  projectId?: string;
  workItemId?: string;
  sendUpdates?: 'all' | 'externalOnly' | 'none';
}

export interface GoogleCalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus?: 'needsAction' | 'accepted' | 'tentative' | 'declined';
  organizer?: boolean;
  self?: boolean;
}

export interface GoogleCalendarEventItem {
  id: string;
  meetingId?: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  organizer?: { email?: string; displayName?: string; self?: boolean };
  attendees?: GoogleCalendarAttendee[];
  hangoutLink?: string;
  conferenceData?: any;
  conferenceStatus?: string;
  htmlLink?: string;
  status?: string;
  created?: string;
  updated?: string;
  sourceType?: 'GOOGLE_CALENDAR';
  projectId?: string;
  workItemId?: string;
  projectKey?: string;
  projectName?: string;
  workItemHumanId?: string;
  activities?: any[];
}

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

const sanitizeLogDetails = (obj: any) => {
  const sanitized = { ...obj };
  delete sanitized.accessToken;
  delete sanitized.refreshToken;
  delete sanitized.clientSecret;
  return JSON.stringify(sanitized);
};

export const createCalendarEvent = async (
  userId: string,
  orgId: string,
  input: CalendarEventInput
) => {
  const { accessToken, connection } = await getValidAccessTokenForUser(userId, orgId);

  // Validate and deduplicate attendees
  const rawAttendees = input.attendees || [];
  const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const uniqueEmails = Array.from(
    new Set(
      rawAttendees
        .map((e) => e.trim().toLowerCase())
        .filter((e) => validEmailRegex.test(e))
    )
  );

  const targetTimeZone = normalizeTimeZone(input.timeZone);

  const requestBody: any = {
    summary: input.title,
    description: input.description,
    start: {
      dateTime: input.startTime,
      timeZone: targetTimeZone,
    },
    end: {
      dateTime: input.endTime,
      timeZone: targetTimeZone,
    },
    location: input.location,
    attendees: uniqueEmails.map((email) => ({ email })),
  };

  let uniqueConferenceRequestId: string | null = null;
  if (input.createMeetLink !== false) {
    uniqueConferenceRequestId = `meet-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    requestBody.conferenceData = {
      createRequest: {
        requestId: uniqueConferenceRequestId,
        conferenceSolutionKey: {
          type: 'hangoutsMeet',
        },
      },
    };
  }

  const sendUpdatesParam = input.sendUpdates || 'all';

  console.log(`[GCALEVENT] calendarId=primary`);
  console.log(`[GCALEVENT] summary=${input.title}`);
  console.log(`[GCALEVENT] attendeeCount=${uniqueEmails.length}`);
  console.log(`[GCALEVENT] attendeeEmails=${uniqueEmails.join(', ')}`);
  console.log(`[GCALEVENT] sendUpdates=${sendUpdatesParam}`);
  console.log(`[GCALEVENT] conferenceDataVersion=1`);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=${sendUpdatesParam}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  console.log(`[GCALEVENT] responseStatus=${response.status}`);

  if (!response.ok) {
    const errText = await response.text();
    console.error('[GoogleCalendarService] Create event error:', response.status, errText);
    throw new Error(`Google Calendar API event creation failed: ${response.status} ${errText}`);
  }

  let gEvent = await response.json();

  // Verification fetch from Google Calendar
  try {
    const verifyRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${gEvent.id}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (verifyRes.ok) {
      gEvent = await verifyRes.json();
    }
  } catch (verifyErr) {
    console.warn('[GoogleCalendarService] Verification fetch warning:', verifyErr);
  }

  let meetLink: string | null = gEvent.hangoutLink || null;
  let conferenceId: string | null = gEvent.conferenceData?.conferenceId || null;
  if (!meetLink && gEvent.conferenceData && gEvent.conferenceData.entryPoints) {
    const videoPoint = gEvent.conferenceData.entryPoints.find((ep: any) => ep.entryPointType === 'video');
    if (videoPoint) {
      meetLink = videoPoint.uri;
    }
  }

  let conferenceStatus =
    gEvent.conferenceData?.createRequest?.status?.statusCode ||
    (meetLink ? 'success' : input.createMeetLink !== false ? 'pending' : 'none');

  // Asynchronous conference polling
  if (input.createMeetLink !== false && !meetLink && conferenceStatus === 'pending') {
    for (let attempt = 0; attempt < 3; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        const pollRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${gEvent.id}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (pollRes.ok) {
          gEvent = await pollRes.json();
          if (gEvent.hangoutLink) {
            meetLink = gEvent.hangoutLink;
          } else if (gEvent.conferenceData && gEvent.conferenceData.entryPoints) {
            const vp = gEvent.conferenceData.entryPoints.find((ep: any) => ep.entryPointType === 'video');
            if (vp) meetLink = vp.uri;
          }
          conferenceId = gEvent.conferenceData?.conferenceId || conferenceId;
          conferenceStatus =
            gEvent.conferenceData?.createRequest?.status?.statusCode ||
            (meetLink ? 'success' : 'pending');
          if (meetLink || conferenceStatus === 'success') break;
        }
      } catch (pollErr) {
        console.warn('[GoogleCalendarService] Meet polling warning:', pollErr);
      }
    }
  }

  console.log(`[GCALEVENT] googleEventId=${gEvent.id}`);
  console.log(`[GCALEVENT] attendeeCountReturned=${(gEvent.attendees || []).length}`);
  console.log(`[GCALEVENT] meetConferenceStatus=${conferenceStatus}`);
  console.log(`[GCALEVENT] meetUrlPresent=${!!meetLink}`);

  const organizerEmail = connection.googleEmail || gEvent.organizer?.email || 'Connected Google Account';

  let targetChannelId: string | null = null;
  let targetMessageId: string | null = null;

  try {
    let targetChannel = null;
    if (input.projectId) {
      targetChannel = await prisma.channel.findFirst({
        where: { projectId: input.projectId, organizationId: orgId },
      });
    }
    if (!targetChannel) {
      targetChannel = await prisma.channel.findFirst({
        where: { organizationId: orgId, name: 'general' },
      });
    }

    if (targetChannel) {
      targetChannelId = targetChannel.id;
      const attendeesDisplay = uniqueEmails.length > 0 ? uniqueEmails.join(', ') : 'None specified';
      const startFormatted = new Date(input.startTime).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const endFormatted = new Date(input.endTime).toLocaleString('en-US', {
        timeStyle: 'short',
      });

      let chatContent = `📅 **Google Meet Scheduled: ${input.title}**\n` +
        `⏰ **Time:** ${startFormatted} – ${endFormatted} (${targetTimeZone})\n` +
        `👥 **Attendees:** ${attendeesDisplay}\n`;

      if (meetLink) {
        chatContent += `🎥 **Google Meet:** [Join Video Call](${meetLink})\n`;
      }
      if (gEvent.htmlLink) {
        chatContent += `🔗 **Google Calendar:** [Open Event](${gEvent.htmlLink})\n`;
      }

      const msg = await prisma.message.create({
        data: {
          channelId: targetChannel.id,
          senderId: userId,
          content: chatContent,
          messageType: 'SYSTEM',
          workItemId: input.workItemId || null,
        },
      });
      targetMessageId = msg.id;
    }
  } catch (chatErr) {
    console.error('[GoogleCalendarService] Failed to post chat notification:', chatErr);
  }

  const meeting = await prisma.meeting.create({
    data: {
      organizationId: orgId,
      createdById: userId,
      googleConnectionId: connection.id,
      googleCalendarId: 'primary',
      googleEventId: gEvent.id,
      googleEventUrl: gEvent.htmlLink || null,
      projectId: input.projectId || null,
      workItemId: input.workItemId || null,
      chatChannelId: targetChannelId,
      chatMessageId: targetMessageId,
      title: gEvent.summary || input.title,
      description: gEvent.description || input.description || null,
      startTime: new Date(input.startTime),
      endTime: new Date(input.endTime),
      timeZone: targetTimeZone,
      meetLink,
      hangoutLink: gEvent.hangoutLink || null,
      googleMeetConferenceId: conferenceId,
      googleMeetConferenceStatus: conferenceStatus,
      organizerEmail,
      location: input.location || null,
      attendees: JSON.stringify(uniqueEmails),
      status: 'CONFIRMED',
      syncStatus: 'SYNCED',
      lastSyncedAt: new Date(),
    },
    include: {
      project: { select: { id: true, name: true, key: true } },
      workItem: { select: { id: true, humanId: true, title: true } },
      activities: { orderBy: { createdAt: 'desc' } },
    },
  });

  // Record initial MeetingActivity timeline entries
  await prisma.meetingActivity.create({
    data: {
      meetingId: meeting.id,
      actorId: userId,
      action: 'CREATED',
      description: `Meeting created on Google Calendar: "${meeting.title}"`,
      details: sanitizeLogDetails({
        googleEventId: gEvent.id,
        startTime: input.startTime,
        endTime: input.endTime,
        timeZone: targetTimeZone,
      }),
    },
  });

  if (meetLink) {
    await prisma.meetingActivity.create({
      data: {
        meetingId: meeting.id,
        actorId: userId,
        action: 'MEET_GENERATED',
        description: `Google Meet conference generated: ${meetLink}`,
        details: sanitizeLogDetails({ meetLink, conferenceStatus }),
      },
    });
  }

  if (uniqueEmails.length > 0) {
    await prisma.meetingActivity.create({
      data: {
        meetingId: meeting.id,
        actorId: userId,
        action: 'INVITATIONS_SENT',
        description: `Calendar invitations sent to ${uniqueEmails.length} attendee(s) via sendUpdates=all`,
        details: sanitizeLogDetails({ attendees: uniqueEmails }),
      },
    });
  }

  // Record AuditLog
  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      actorId: userId,
      action: 'GOOGLE_MEETING_CREATED',
      entityType: 'MEETING',
      entityId: meeting.id,
      details: sanitizeLogDetails({
        googleEventId: gEvent.id,
        title: meeting.title,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        attendeeCount: uniqueEmails.length,
      }),
    },
  });

  return { meeting, gEvent, organizerEmail };
};

export const getMeetingDetails = async (
  userId: string,
  orgId: string,
  meetingIdentifier: string
) => {
  // Find local meeting by ID or googleEventId
  const meeting = await prisma.meeting.findFirst({
    where: {
      organizationId: orgId,
      OR: [{ id: meetingIdentifier }, { googleEventId: meetingIdentifier }],
    },
    include: {
      project: { select: { id: true, name: true, key: true } },
      workItem: { select: { id: true, humanId: true, title: true } },
      createdBy: { select: { id: true, fullName: true, email: true } },
      activities: { orderBy: { createdAt: 'desc' } },
    },
  });

  let liveGoogleEvent: any = null;
  let liveAttendees: GoogleCalendarAttendee[] = [];

  if (meeting && meeting.googleEventId) {
    try {
      const { accessToken } = await getValidAccessTokenForUser(userId, orgId);
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${meeting.googleEventId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (res.ok) {
        liveGoogleEvent = await res.json();
        liveAttendees = (liveGoogleEvent.attendees || []).map((att: any) => ({
          email: att.email,
          displayName: att.displayName,
          responseStatus: att.responseStatus,
          organizer: att.organizer,
          self: att.self,
        }));
      } else if (res.status === 404) {
        // Event was deleted externally on Google Calendar
        if (meeting.status !== 'CANCELLED') {
          await prisma.meeting.update({
            where: { id: meeting.id },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
          });
          await prisma.meetingActivity.create({
            data: {
              meetingId: meeting.id,
              actorId: userId,
              action: 'CANCELLED',
              description: 'Meeting marked cancelled (detected deleted on Google Calendar)',
            },
          });
        }
      }
    } catch (gErr) {
      console.warn('[GoogleCalendarService] Failed to fetch live Google event details:', gErr);
    }
  }

  return {
    meeting,
    googleEvent: liveGoogleEvent,
    liveAttendees,
    activities: meeting?.activities || [],
  };
};

export const listCalendarEvents = async (
  userId: string,
  orgId: string,
  timeMin?: string,
  timeMax?: string
) => {
  const { accessToken } = await getValidAccessTokenForUser(userId, orgId);

  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  if (timeMin) params.append('timeMin', timeMin);
  if (timeMax) params.append('timeMax', timeMax);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error('[GoogleCalendarService] List events error:', response.status, errText);
    throw new Error(`Google Calendar API list events failed: ${response.status}`);
  }

  const gData = await response.json();
  const dbMeetings = await prisma.meeting.findMany({
    where: {
      organizationId: orgId,
    },
    include: {
      project: { select: { id: true, name: true, key: true } },
      workItem: { select: { id: true, humanId: true, title: true } },
      activities: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
    orderBy: { startTime: 'asc' },
  });

  const dbMeetingMap = new Map(dbMeetings.map((m) => [m.googleEventId, m]));

  const formattedGoogleEvents: GoogleCalendarEventItem[] = (gData.items || []).map((item: any) => {
    const matchedDb = item.id ? dbMeetingMap.get(item.id) : null;
    let meetLink = item.hangoutLink || null;
    if (!meetLink && item.conferenceData && item.conferenceData.entryPoints) {
      const videoPoint = item.conferenceData.entryPoints.find((ep: any) => ep.entryPointType === 'video');
      if (videoPoint) {
        meetLink = videoPoint.uri;
      }
    }

    return {
      id: item.id,
      meetingId: matchedDb?.id,
      summary: item.summary || '(No Title)',
      description: item.description,
      location: item.location,
      start: item.start || {},
      end: item.end || {},
      organizer: item.organizer,
      attendees: (item.attendees || []).map((att: any) => ({
        email: att.email,
        displayName: att.displayName,
        responseStatus: att.responseStatus,
        organizer: att.organizer,
        self: att.self,
      })),
      hangoutLink: meetLink,
      conferenceData: item.conferenceData,
      conferenceStatus: item.conferenceData?.createRequest?.status?.statusCode || (meetLink ? 'success' : 'none'),
      htmlLink: item.htmlLink,
      status: item.status,
      created: item.created,
      updated: item.updated,
      sourceType: 'GOOGLE_CALENDAR' as const,
      projectId: matchedDb?.projectId || undefined,
      workItemId: matchedDb?.workItemId || undefined,
      projectKey: matchedDb?.project?.key || undefined,
      projectName: matchedDb?.project?.name || undefined,
      workItemHumanId: matchedDb?.workItem?.humanId || undefined,
      activities: matchedDb?.activities || [],
    };
  });

  return { googleEvents: formattedGoogleEvents, dbMeetings };
};

export const updateCalendarEvent = async (
  userId: string,
  orgId: string,
  meetingId: string,
  input: Partial<CalendarEventInput>
) => {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, organizationId: orgId },
    include: {
      project: true,
      workItem: true,
    },
  });

  if (!meeting) {
    throw new Error('Meeting not found or you do not have permission to modify it');
  }

  const { accessToken } = await getValidAccessTokenForUser(userId, orgId);

  const targetTimeZone = normalizeTimeZone(input.timeZone || meeting.timeZone);

  // Validate start / end if times are being updated
  const newStartIso = input.startTime || meeting.startTime.toISOString();
  const newEndIso = input.endTime || meeting.endTime.toISOString();
  const startMillis = new Date(newStartIso).getTime();
  const endMillis = new Date(newEndIso).getTime();
  const nowMillis = Date.now();

  if (input.startTime && startMillis < nowMillis) {
    throw new Error('Rescheduled start time cannot be in the past');
  }

  if (endMillis <= startMillis) {
    throw new Error('End time must be strictly after start time');
  }

  const durationMinutes = (endMillis - startMillis) / (60 * 1000);
  if (durationMinutes > 1440) {
    throw new Error('Meeting duration cannot exceed 24 hours');
  }

  // Parse attendees if provided
  let uniqueEmails: string[] | undefined = undefined;
  if (input.attendees !== undefined) {
    const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    uniqueEmails = Array.from(
      new Set(
        input.attendees
          .map((e) => e.trim().toLowerCase())
          .filter((e) => validEmailRegex.test(e))
      )
    );
  }

  const patchBody: any = {};
  if (input.title) patchBody.summary = input.title.trim();
  if (input.description !== undefined) patchBody.description = input.description?.trim() || '';
  if (input.startTime) {
    patchBody.start = { dateTime: input.startTime, timeZone: targetTimeZone };
  }
  if (input.endTime) {
    patchBody.end = { dateTime: input.endTime, timeZone: targetTimeZone };
  }
  if (input.location !== undefined) patchBody.location = input.location?.trim() || '';
  if (uniqueEmails !== undefined) {
    patchBody.attendees = uniqueEmails.map((email) => ({ email }));
  }

  let updatedGEvent: any = null;
  if (meeting.googleEventId) {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${meeting.googleEventId}?conferenceDataVersion=1&sendUpdates=all`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patchBody),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('[GoogleCalendarService] Patch event error:', response.status, errText);
      throw new Error(`Google Calendar update failed: ${response.status} ${errText}`);
    }

    updatedGEvent = await response.json();

    // Verify update with a subsequent GET
    try {
      const getRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${meeting.googleEventId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (getRes.ok) {
        updatedGEvent = await getRes.json();
      }
    } catch (getErr) {
      console.warn('[GoogleCalendarService] Verify GET warning:', getErr);
    }
  }

  const isRescheduled =
    (input.startTime && new Date(input.startTime).getTime() !== meeting.startTime.getTime()) ||
    (input.endTime && new Date(input.endTime).getTime() !== meeting.endTime.getTime());

  const isAttendeesChanged = uniqueEmails !== undefined;

  const updatedMeeting = await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      ...(input.title ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.startTime ? { startTime: new Date(input.startTime) } : {}),
      ...(input.endTime ? { endTime: new Date(input.endTime) } : {}),
      timeZone: targetTimeZone,
      ...(input.location !== undefined ? { location: input.location?.trim() || null } : {}),
      ...(uniqueEmails !== undefined ? { attendees: JSON.stringify(uniqueEmails) } : {}),
      ...(input.projectId !== undefined ? { projectId: input.projectId || null } : {}),
      ...(input.workItemId !== undefined ? { workItemId: input.workItemId || null } : {}),
      lastSyncedAt: new Date(),
    },
    include: {
      project: { select: { id: true, name: true, key: true } },
      workItem: { select: { id: true, humanId: true, title: true } },
      activities: { orderBy: { createdAt: 'desc' } },
    },
  });

  // Record Activity & Audit Logs
  if (isRescheduled) {
    await prisma.meetingActivity.create({
      data: {
        meetingId: meeting.id,
        actorId: userId,
        action: 'RESCHEDULED',
        description: `Meeting rescheduled to ${new Date(newStartIso).toLocaleString()} (${targetTimeZone})`,
        details: sanitizeLogDetails({
          oldStart: meeting.startTime,
          newStart: newStartIso,
          oldEnd: meeting.endTime,
          newEnd: newEndIso,
        }),
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: userId,
        action: 'GOOGLE_MEETING_RESCHEDULED',
        entityType: 'MEETING',
        entityId: meeting.id,
        details: sanitizeLogDetails({ newStart: newStartIso, newEnd: newEndIso }),
      },
    });
  } else {
    await prisma.meetingActivity.create({
      data: {
        meetingId: meeting.id,
        actorId: userId,
        action: 'UPDATED',
        description: `Meeting details updated on Google Calendar`,
        details: sanitizeLogDetails(patchBody),
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: userId,
        action: 'GOOGLE_MEETING_UPDATED',
        entityType: 'MEETING',
        entityId: meeting.id,
        details: sanitizeLogDetails(patchBody),
      },
    });
  }

  if (isAttendeesChanged && uniqueEmails) {
    await prisma.meetingActivity.create({
      data: {
        meetingId: meeting.id,
        actorId: userId,
        action: 'ATTENDEE_CHANGED',
        description: `Attendee list updated (${uniqueEmails.length} attendee(s))`,
        details: sanitizeLogDetails({ attendees: uniqueEmails }),
      },
    });
  }

  // Post chat update if channel exists
  if (meeting.chatChannelId) {
    try {
      const startFormatted = new Date(newStartIso).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const endFormatted = new Date(newEndIso).toLocaleString('en-US', {
        timeStyle: 'short',
      });
      const updateNote = isRescheduled ? '⏰ **Meeting Rescheduled**' : '📝 **Meeting Details Updated**';

      await prisma.message.create({
        data: {
          channelId: meeting.chatChannelId,
          senderId: userId,
          content: `${updateNote}: **${updatedMeeting.title}**\n` +
            `🕒 **New Time:** ${startFormatted} – ${endFormatted} (${targetTimeZone})\n` +
            (updatedMeeting.meetLink ? `🎥 **Google Meet:** [Join Video Call](${updatedMeeting.meetLink})\n` : '') +
            (updatedMeeting.googleEventUrl ? `🔗 **Google Calendar:** [Open Event](${updatedMeeting.googleEventUrl})\n` : ''),
          messageType: 'SYSTEM',
          workItemId: updatedMeeting.workItemId,
        },
      });
    } catch (chatErr) {
      console.warn('[GoogleCalendarService] Chat update warning:', chatErr);
    }
  }

  return { meeting: updatedMeeting, gEvent: updatedGEvent };
};

export const deleteCalendarEvent = async (userId: string, orgId: string, meetingId: string) => {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, organizationId: orgId },
  });

  if (!meeting) {
    throw new Error('Meeting not found or you do not have permission to cancel it');
  }

  if (meeting.googleEventId) {
    try {
      const { accessToken } = await getValidAccessTokenForUser(userId, orgId);
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${meeting.googleEventId}?sendUpdates=all`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (!res.ok && res.status !== 404 && res.status !== 410) {
        console.error('[GoogleCalendarService] Google Calendar deletion error:', res.status);
      }
    } catch (err) {
      console.error('[GoogleCalendarService] Error deleting Google Calendar event:', err);
    }
  }

  const cancelled = await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      lastSyncedAt: new Date(),
    },
  });

  // Record Activity and AuditLog
  await prisma.meetingActivity.create({
    data: {
      meetingId: meeting.id,
      actorId: userId,
      action: 'CANCELLED',
      description: 'Meeting cancelled on Google Calendar (invitations cancelled via sendUpdates=all)',
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      actorId: userId,
      action: 'GOOGLE_MEETING_CANCELLED',
      entityType: 'MEETING',
      entityId: meeting.id,
      details: sanitizeLogDetails({
        title: meeting.title,
        cancelledAt: new Date(),
      }),
    },
  });

  // Post cancellation notice to chat if channel linked
  if (meeting.chatChannelId) {
    try {
      await prisma.message.create({
        data: {
          channelId: meeting.chatChannelId,
          senderId: userId,
          content: `🚫 **Meeting Cancelled:** **${meeting.title}** has been cancelled on Google Calendar.`,
          messageType: 'SYSTEM',
          workItemId: meeting.workItemId,
        },
      });
    } catch (chatErr) {
      console.warn('[GoogleCalendarService] Chat cancellation warning:', chatErr);
    }
  }

  return { success: true, meeting: cancelled };
};

export const syncGoogleCalendar = async (userId: string, orgId: string) => {
  const { accessToken, connection } = await getValidAccessTokenForUser(userId, orgId);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&maxResults=250&orderBy=startTime`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to sync with Google Calendar: ${response.status} ${errText}`);
  }

  const gData = await response.json();
  const googleItems: any[] = gData.items || [];
  const gEventMap = new Map<string, any>(googleItems.map((item: any) => [item.id, item]));

  const localMeetings = await prisma.meeting.findMany({
    where: { organizationId: orgId },
  });

  let updatedCount = 0;
  let cancelledCount = 0;
  let newCount = 0;

  for (const local of localMeetings) {
    if (!local.googleEventId) continue;
    const remote: any = gEventMap.get(local.googleEventId);

    if (remote) {
      // Check if remote event was cancelled on Google
      if (remote.status === 'cancelled' && local.status !== 'CANCELLED') {
        await prisma.meeting.update({
          where: { id: local.id },
          data: { status: 'CANCELLED', cancelledAt: new Date(), lastSyncedAt: new Date() },
        });
        await prisma.meetingActivity.create({
          data: {
            meetingId: local.id,
            actorId: userId,
            action: 'SYNCED',
            description: 'Synchronized cancellation from Google Calendar',
          },
        });
        cancelledCount++;
      } else if (remote.status !== 'cancelled') {
        // Update local meeting from remote event
        const remoteStart = remote.start?.dateTime ? new Date(remote.start.dateTime) : local.startTime;
        const remoteEnd = remote.end?.dateTime ? new Date(remote.end.dateTime) : local.endTime;
        const remoteMeetLink = remote.hangoutLink || null;

        await prisma.meeting.update({
          where: { id: local.id },
          data: {
            title: remote.summary || local.title,
            description: remote.description !== undefined ? remote.description : local.description,
            startTime: remoteStart,
            endTime: remoteEnd,
            meetLink: remoteMeetLink || local.meetLink,
            hangoutLink: remote.hangoutLink || local.hangoutLink,
            location: remote.location !== undefined ? remote.location : local.location,
            lastSyncedAt: new Date(),
          },
        });
        updatedCount++;
      }
    } else if (local.status !== 'CANCELLED') {
      // Missing from active events list -> check if it was cancelled
      try {
        const checkRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${local.googleEventId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (checkRes.status === 404 || checkRes.status === 410) {
          await prisma.meeting.update({
            where: { id: local.id },
            data: { status: 'CANCELLED', cancelledAt: new Date(), lastSyncedAt: new Date() },
          });
          cancelledCount++;
        }
      } catch (checkErr) {
        console.warn('Sync check warning:', checkErr);
      }
    }
  }

  // AuditLog
  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      actorId: userId,
      action: 'GOOGLE_MEETING_SYNCED',
      entityType: 'MEETING',
      entityId: connection.id,
      details: sanitizeLogDetails({
        totalRemoteEvents: googleItems.length,
        updatedCount,
        cancelledCount,
        newCount,
        syncedAt: new Date(),
      }),
    },
  });

  return {
    totalRemoteEvents: googleItems.length,
    updatedCount,
    cancelledCount,
    newCount,
    syncedAt: new Date(),
  };
};

export const checkFreeBusy = async (
  userId: string,
  orgId: string,
  timeMin: string,
  timeMax: string,
  items: string[] = ['primary']
) => {
  const { accessToken } = await getValidAccessTokenForUser(userId, orgId);

  const requestBody = {
    timeMin,
    timeMax,
    items: items.map((id) => ({ id })),
  };

  const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[GoogleCalendarService] FreeBusy query error:', response.status, errText);
    throw new Error(`Google FreeBusy query failed: ${response.status}`);
  }

  return response.json();
};
