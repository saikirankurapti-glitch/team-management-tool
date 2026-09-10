# Google Meet Conference Generation

## Overview
Google Meet integration is built natively on top of Google Calendar API's `conferenceData` extension. Real video conference URLs (`https://meet.google.com/xxx-yyyy-zzz`) are generated dynamically for all scheduled meetings.

## Requirements & Execution
1. **Query Parameter**: All event creation and update requests MUST include `conferenceDataVersion=1`.
2. **Unique Request ID**: Google requires a globally unique `requestId` for each conference creation request to ensure idempotency.
3. **Payload Structure**:
```json
{
  "conferenceData": {
    "createRequest": {
      "requestId": "meet-1788849400-x9y8z7",
      "conferenceSolutionKey": {
        "type": "hangoutsMeet"
      }
    }
  }
}
```

## Parsing Google Meet URLs
Upon successful creation, the Google API returns conference details:
```json
{
  "hangoutLink": "https://meet.google.com/abc-defg-hij",
  "conferenceData": {
    "entryPoints": [
      {
        "entryPointType": "video",
        "uri": "https://meet.google.com/abc-defg-hij",
        "label": "meet.google.com/abc-defg-hij"
      }
    ]
  }
}
```
The application extracts `hangoutLink` or entry point URI and stores it in the `Meeting.meetLink` column. Zero fake links or demo URLs are generated.
