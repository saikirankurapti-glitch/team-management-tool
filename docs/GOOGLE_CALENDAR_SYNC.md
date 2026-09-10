# Google Calendar Bidirectional Synchronization

## Overview
This document describes how the application synchronizes with Google Calendar, reconciling local meetings with external changes (edits, cancellations, attendee RSVP responses).

---

## 1. Synchronization Architecture

```
                    Google Calendar API
                            │
               GET /calendar/v3/calendars/primary/events
               (?singleEvents=true&maxResults=250)
                            │
                            ▼
               Google Calendar Sync Service
                            │
          ┌─────────────────┴─────────────────┐
          ▼                                   ▼
    Active Remote Events              Missing / Cancelled Remotes
          │                                   │
          ▼                                   ▼
  Update Local Meeting              Mark Local Meeting
  (Title, Time, Meet URL,           status = 'CANCELLED'
   Live RSVP statuses)              cancelledAt = new Date()
          │                                   │
          └─────────────────┬─────────────────┘
                            ▼
                  Log MeetingActivity
                  Log Security AuditLog
```

---

## 2. Sync Triggers

1. **On Calendar Page Load**:
   - Fetches both internal work items and live Google Calendar events.
2. **Manual Sync (`POST /google/meetings/sync`)**:
   - The user clicks the refresh icon on the Calendar page.
   - Syncs all local meetings with remote Google events.
   - Returns `{ totalRemoteEvents, updatedCount, cancelledCount, syncedAt }`.
3. **On Meeting Details View (`GET /google/meetings/:id`)**:
   - Real-time single-event query to Google Calendar API to ensure the latest attendee RSVP status and meeting time.

---

## 3. Handling External Deletions
- When an event is deleted directly in the Google Calendar web UI or mobile app, the sync engine detects the deletion (404/410 status code or `status === 'cancelled'`).
- The local database record is marked `status = 'CANCELLED'` and records a `MeetingActivity` entry: `"Synchronized cancellation from Google Calendar"`.
- Local audit records and work-item associations remain intact.

---

## 4. Rate Limiting & Safety
- Google Calendar API quotas: 1,000,000 queries per day.
- Single event operations are performed on-demand; batch listings are throttled and scoped to 250 events per page.
