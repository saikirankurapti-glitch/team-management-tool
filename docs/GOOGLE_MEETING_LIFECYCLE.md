# Complete Google Meeting Lifecycle & Integration Guide

## Overview
This document specifies the architecture, data models, Google Calendar API integration, attendee RSVP handling, Meet conference creation, rescheduling, cancellation, and activity audit timeline for Google Meetings.

---

## 1. Complete Meeting Lifecycle Architecture

```
                                  Application Frontend
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
                Create / Reschedule                     View Details / Cancel
                        │                                     │
                        ▼                                     ▼
            Meeting Controller (Express)          Google Calendar Service
                        │                                     │
                        ▼                                     ▼
            Google OAuth 2.0 Auth             Google Calendar API (v3)
            (Bearer Access Token)             ├── POST /events (Create)
                        │                     ├── GET /events/{id} (Live RSVP)
                        │                     ├── PATCH /events/{id} (Reschedule)
                        │                     └── DELETE /events/{id} (Cancel)
                        ▼                                     │
            Google Calendar & Meet                            ▼
            ├── Conference Solution: Meet             sendUpdates=all
            └── Attendee Delivery (Email) ────────────► Attendees (Inbox/Calendar)
```

---

## 2. Meeting Database Model & Relationship

```prisma
model Meeting {
  id                         String            @id @default(uuid())
  organizationId             String
  createdById                String
  googleConnectionId         String?
  projectId                  String?
  workItemId                 String?
  chatChannelId              String?
  chatMessageId              String?
  googleCalendarId           String?           @default("primary")
  googleEventId              String?           @unique
  googleEventUrl             String?
  title                      String
  description                String?
  startTime                  DateTime
  endTime                    DateTime
  timeZone                   String            @default("UTC")
  meetLink                   String?
  hangoutLink                String?
  googleMeetConferenceId     String?
  googleMeetConferenceStatus String?           @default("pending")
  organizerEmail             String?
  location                   String?
  attendees                  String            // JSON stringified array of emails
  status                     String            @default("CONFIRMED") // CONFIRMED | CANCELLED
  syncStatus                 String            @default("SYNCED")
  cancelledAt                DateTime?
  lastSyncedAt               DateTime?
  createdAt                  DateTime          @default(now())
  updatedAt                  DateTime          @updatedAt

  activities                 MeetingActivity[]
}

model MeetingActivity {
  id          String   @id @default(uuid())
  meetingId   String
  meeting     Meeting  @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  actorId     String?
  action      String   // CREATED, MEET_GENERATED, INVITATIONS_SENT, UPDATED, RESCHEDULED, ATTENDEE_CHANGED, CANCELLED, SYNCED
  description String
  details     String?  // JSON string
  createdAt   DateTime @default(now())
}
```

---

## 3. Operations & REST Endpoints

### 1. Create Meeting (`POST /google/meetings`)
- **Query Params**: `conferenceDataVersion=1&sendUpdates=all`
- **Payload**: `summary`, `description`, `start`, `end`, `attendees: [{ email }]`, `conferenceData.createRequest`.
- **Conference Generation**: Asynchronous polling with exponential backoff if initially pending.
- **Verification**: `GET /events/{id}` before returning 201 Created.
- **Activity Log**: `CREATED`, `MEET_GENERATED`, `INVITATIONS_SENT`.

### 2. View Meeting Details (`GET /google/meetings/:id`)
- Returns database record + live Google Calendar state.
- Live Attendee RSVP mapping:
  - `needsAction`: Attendee has not yet responded.
  - `accepted`: Attendee accepted the invitation.
  - `declined`: Attendee declined.
  - `tentative`: Attendee tentatively accepted.
- Chronological `MeetingActivity` timeline.

### 3. Update & Reschedule (`PATCH /google/meetings/:id`)
- Validates future start time (`startTime > now`) and duration bounds (`endTime > startTime`, duration $\le$ 24h).
- Sends `PATCH /events/{id}?conferenceDataVersion=1&sendUpdates=all`.
- Re-fetches with `GET /events/{id}` to verify Google's updated timestamps.
- Records `MeetingActivity` (`RESCHEDULED` or `UPDATED`).
- Posts update notice to linked project chat channel.

### 4. Cancellation (`DELETE /google/meetings/:id`)
- Prompts for confirmation in UI.
- Calls `DELETE /events/{id}?sendUpdates=all` on Google Calendar.
- Updates database record to `status: 'CANCELLED'` and sets `cancelledAt`.
- Preserves local database record, audit history, and work-item linkages.
- Records `MeetingActivity` (`CANCELLED`).
- Posts cancellation message to linked chat channel.

---

## 4. Multi-Tenant Organization Isolation
- Every database query strictly filters by `organizationId`.
- Users from Organization A cannot view, update, reschedule, or cancel meetings owned by Organization B.
