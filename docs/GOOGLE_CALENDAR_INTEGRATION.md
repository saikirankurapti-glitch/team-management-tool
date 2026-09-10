# Google Calendar API Integration

## Overview
The Google Calendar service (`server/src/services/googleCalendarService.ts`) handles bidirectional calendar event scheduling, attendee invitations, free/busy queries, and meeting state updates.

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/google/meetings` | Schedules a calendar event and generates a Google Meet video link |
| `GET` | `/api/google/meetings` | Lists calendar events from Google Calendar API and local DB |
| `PATCH` | `/api/google/meetings/:id` | Updates an existing meeting event |
| `DELETE` | `/api/google/meetings/:id` | Cancels a meeting event in Google Calendar and DB |
| `POST` | `/api/google/meetings/freebusy` | Queries free/busy availability for team members |

## Event Model & Data Synchronization
When a user schedules a meeting, the application issues a HTTP POST request to Google Calendar API:
```http
POST /calendar/v3/calendars/primary/events?conferenceDataVersion=1 HTTP/1.1
Authorization: Bearer <user_access_token>
Content-Type: application/json

{
  "summary": "Sprint Retrospective Sync",
  "description": "Discuss sprint velocity, blockers, and improvements.",
  "start": { "dateTime": "2026-09-10T14:00:00Z", "timeZone": "UTC" },
  "end": { "dateTime": "2026-09-10T15:00:00Z", "timeZone": "UTC" },
  "attendees": [{ "email": "alex@company.com" }, { "email": "sarah@company.com" }],
  "conferenceData": {
    "createRequest": {
      "requestId": "meet-1788849400-a1b2c3",
      "conferenceSolutionKey": { "type": "hangoutsMeet" }
    }
  }
}
```

The response contains the created Google event ID and hangout link (`meetLink`), which are saved in the local `Meeting` database model for fast queries and offline resilience.
