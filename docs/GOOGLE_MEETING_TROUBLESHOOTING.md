# Google Meeting & Calendar Troubleshooting Guide

## 1. Common Google Calendar API Errors & Resolutions

| HTTP Status | Error Type | Cause | Solution |
|---|---|---|---|
| **401 Unauthorized** | Token Expired / Revoked | OAuth access token expired and refresh token is invalid or was revoked in Google Account settings. | Click **Disconnect** in Settings/Integrations and complete the Google OAuth connection flow again. |
| **403 Forbidden** | Insufficient Scopes / Permission | Google connection was authorized before Calendar scopes (`https://www.googleapis.com/auth/calendar.events`) were added, or attempting to edit someone else's private calendar. | Re-authenticate to grant updated Calendar permissions. |
| **404 Not Found** | Event Deleted on Google | The event was deleted directly inside the Google Calendar web app. | The sync engine automatically detects this and marks the meeting as `CANCELLED`. |
| **429 Rate Limited** | Quota Exceeded | Too many rapid requests to Google Calendar API. | Wait 30–60 seconds before retrying. Backoff logic is built into service polling. |
| **400 Bad Request** | Invalid Conference Data / Datetime | Past date/time passed or malformed timezone string. | Verify frontend validation is enabled; backend automatically maps `Asia/Calcutta` to `Asia/Kolkata`. |

---

## 2. Attendee Invitation Delivery FAQ

### Why did the attendee not receive an email?
1. **Organizer vs. Attendee**: Google Calendar does **not** send invitation emails to the organizer's own email address. It only sends emails to invited attendees whose emails differ from the organizer's connected Google account.
2. **`sendUpdates=all`**: Ensured `sendUpdates=all` is included in the query string of the insert/patch request.
3. **Spam / Filter Folders**: Attendees should check the "Updates" tab or "Spam" folder in Gmail.

---

## 3. Google Meet Link Generation

- Meet conference requests use `conferenceData.createRequest` with a unique `requestId` and `conferenceSolutionKey: { type: 'hangoutsMeet' }`.
- If Google returns `statusCode: 'pending'`, the service polls `GET /events/{id}` up to 3 times before finalizing the meeting.
