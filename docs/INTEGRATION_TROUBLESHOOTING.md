# Integration Troubleshooting Guide

## Overview
This document contains diagnostic procedures for resolving integration errors across GitHub OAuth, Webhooks, AI Copilot, and Google Drive.

## 1. Integration Health Check Endpoint
To inspect live backend status, make an authenticated request to:
```http
GET /api/health/integrations
```

Sample Response:
```json
{
  "timestamp": "2026-09-08T02:15:00.000Z",
  "organizationId": "org-uuid",
  "integrations": {
    "database": { "status": "HEALTHY", "error": null },
    "authentication": { "status": "HEALTHY" },
    "github": { "status": "CONNECTED", "account": "demostartup-org" },
    "googleDrive": { "status": "CONFIGURED", "configured": true },
    "aiProvider": { "status": "HEALTHY", "provider": "openai", "configured": true },
    "webSockets": { "status": "HEALTHY" }
  }
}
```

## 2. Common Issues & Solutions

### GitHub Connection Error: `401 Unauthorized` / `REVOKED`
- **Cause**: User revoked OAuth permissions in GitHub Settings or token expired.
- **Solution**: Click **Disconnect Account** on `/integrations` page and perform **Connect GitHub** flow again.

### GitHub Webhook Error: `401 Invalid webhook signature`
- **Cause**: `GITHUB_WEBHOOK_SECRET` in `server/.env` does not match secret entered in GitHub repository Webhook settings.
- **Solution**: Update both secrets to match exactly.

### AI Copilot Error: `AI_API_KEY environment variable is missing`
- **Cause**: AI Provider credentials not set.
- **Solution**: Add `AI_API_KEY=your_key` in `server/.env` and restart the server.

### File Upload Error: `Google Drive Authentication failed`
- **Cause**: `GOOGLE_REFRESH_TOKEN` expired or invalid credentials.
- **Solution**: Regenerate OAuth refresh token in Google Cloud Console.
