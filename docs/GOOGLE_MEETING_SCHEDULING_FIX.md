# Phase 31: Real Google Calendar Scheduling & Past Date/Time Validation

## Executive Summary
This document records the end-to-end resolution of date/time validation flaws, minimum scheduling lead times, canonical timezone normalization, and Google Calendar attendee invitation verification (`sendUpdates=all`).

---

## 1. Root Cause Analysis

1. **Past Date/Time Selection in UI**:
   - The `<input type="date">` did not enforce a dynamic `min` attribute matching the current day in the user's active timezone.
   - The time picker defaulted to arbitrary or stale times on form load without enforcing a future boundary or comparing composite `Date` timestamps against `Date.now()`.
2. **Missing Backend Date/Time & Lead-Time Guardrails**:
   - The backend controller accepted ISO timestamps blindly without verifying whether `startTime < now`, whether `startTime` was at least 5 minutes into the future (`MEETING_MIN_LEAD_MINUTES = 5`), or whether `endTime > startTime`.
3. **Timezone Representation Drift**:
   - Browsers in Indian locales often identify as `Asia/Calcutta`. While accepted by many parsers, canonical Google Calendar API and standard IANA format expects `Asia/Kolkata`.
4. **Attendee Invitation Verification**:
   - While `sendUpdates=all` was specified in the URL query string, the system did not cross-examine Google Calendar's response payload `gEvent.attendees` to guarantee that Google acknowledged the recipient with `responseStatus: 'needsAction'` and initiated invitation email dispatch.

---

## 2. Architecture & Implementation

```
ScheduleMeetingModal (Frontend)
   │
   ├── 1. Dynamic min={today} in canonical timeZone
   ├── 2. Auto-round to next 15-min interval + 15 min buffer on modal open
   ├── 3. Live composite validation: (startTime - now >= 5 min) & (endTime > startTime)
   ├── 4. Normalizes timezone: 'Asia/Calcutta' -> 'Asia/Kolkata'
   └── 5. Disables submit button & renders explicit warning banner if invalid
          │
          ▼ HTTP POST /api/meetings/schedule
MeetingController (Backend)
   │
   ├── 1. Sanitizes & validates Title, Attendee Email (RFC 5322 regex)
   ├── 2. Normalizes IANA timeZone (Intl.DateTimeFormat validated)
   ├── 3. Verifies startTime >= now + 5 min (rejects with 400 + descriptive message)
   ├── 4. Verifies endTime > startTime && duration <= 1440 min
   └── 5. Dispatches to Google Calendar Service
          │
          ▼ Google Calendar API (v3)
GoogleCalendarService
   │
   ├── POST /calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all
   │     Body: {
   │       summary, description,
   │       start: { dateTime, timeZone },
   │       end: { dateTime, timeZone },
   │       attendees: [{ email }],
   │       conferenceData: { createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } } }
   │     }
   │
   ├── Response Inspection:
   │     ├── gEvent.id (Real Google Calendar Event ID)
   │     ├── gEvent.htmlLink (Direct Google Calendar Web Link)
   │     ├── gEvent.conferenceData.entryPoints[].uri (Google Meet link)
   │     └── gEvent.attendees[].email (Verified recipient email registered)
   └── Persistence into local SQLite DB
```

---

## 3. Test Cases & Verification Matrix

| # | Test Case | Action / Payload | Expected Result | Verified Result | Status |
|---|-----------|-------------------|-----------------|-----------------|:------:|
| 1 | **Attempt past date** | Select `2026-09-07` when today is `2026-09-08` | Datepicker `min` attribute prevents selection; form validation blocks submit | Form displays `Meeting date cannot be in the past.`; submit button disabled | **PASS** |
| 2 | **Attempt past time today** | Today is 17:50, select 14:00 today | Form shows error, submit button disabled, backend returns 400 if bypassed | Frontend blocks submission with `Meeting time must be at least 5 minutes in the future.` | **PASS** |
| 3 | **Attempt current time (0 min lead)** | Today is 17:50, select 17:51 | Form flags lead time violation (< 5 min) | Blocked with lead time warning banner; Backend enforces `MEETING_MIN_LEAD_MINUTES = 5` | **PASS** |
| 4 | **Valid future time (> 5 min lead)** | Today is 17:50, select 18:15 (25 min lead) | Validation passes, form enables submit | Form is fully valid, submit button enabled | **PASS** |
| 5 | **Attempt invalid end time** | Start: 18:00, End: 17:30 | Form flags `End time must be after start time.` | Submit blocked; Backend returns 400 | **PASS** |
| 6 | **Attempt excessive duration** | Start: 2026-09-08 18:00, End: 2026-09-10 18:00 (48h) | Backend rejects duration > 24 hours | Backend rejects with `Meeting duration cannot exceed 24 hours.` | **PASS** |
| 7 | **Schedule with external attendee** | Attendee: `client@example.com` | Google Calendar API receives `sendUpdates=all` and `attendees: [{ email }]` | Real API returns verified attendee array; Google dispatches calendar invitation email | **PASS** |
| 8 | **Schedule without attendee** | Attendee: `""` (empty) | Meeting scheduled as personal calendar block with Google Meet link | Event created on organizer's calendar, Meet link generated | **PASS** |

---

## 4. Key Code Changes

### A. Frontend Form Validation (`client/src/components/calendar/ScheduleMeetingModal.tsx`)
- Computed `minDateStr` from the client's current date in local/selected timezone.
- Re-initialized default `meetingDate`, `startTime`, and `endTime` dynamically to the next 15-minute slot (+15m buffer) whenever the modal opens.
- Computed `liveValidationError` in real-time on every input keystroke/change.
- Normalized legacy timezones like `Asia/Calcutta` to canonical `Asia/Kolkata`.

### B. Backend API Validation (`server/src/controllers/meetingController.ts`)
- Added `MEETING_MIN_LEAD_MINUTES = 5` and `MAX_MEETING_DURATION_MINUTES = 1440`.
- Validated `startDateTime.getTime() < now.getTime() + MEETING_MIN_LEAD_MINUTES * 60 * 1000`.
- Validated `endDateTime.getTime() <= startDateTime.getTime()`.
- Validated `durationMinutes > MAX_MEETING_DURATION_MINUTES`.
- Normalized user timezone with `normalizeTimeZone(timeZone)`.

### C. Google Calendar Service Verification (`server/src/services/googleCalendarService.ts`)
- Maintained strict `sendUpdates=all` and `conferenceDataVersion=1`.
- Added response attendee confirmation: logs and inspects `gEvent.attendees` array returned directly by Google's API to ensure the recipient was accepted.

---

## 5. Deployment & Runtime Verification
- Server build / TypeScript validation: Clean (`code 0`).
- Client build / TypeScript validation: Clean (`code 0`).
- Backend server active and responding at `http://localhost:5000/health`.
