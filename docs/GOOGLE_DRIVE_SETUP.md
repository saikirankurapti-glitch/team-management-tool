# Google Drive Document Storage Setup

## Overview
Documents uploaded via `/files` or attached to work items are stored in Google Drive when configured, with metadata persisted in the local Prisma database (`FileAttachment` model).

## Database Metadata Tracking
Every document record tracks:
- `driveFileId`: Unique ID assigned by Google Drive API
- `filename`: Original file name
- `fileType`: MIME type
- `fileSize`: Byte size
- `uploadedById`: Authenticated User ID
- `organizationId`: Tenant Organization ID
- `projectId`: Associated Project ID (optional)
- `workItemId`: Associated Work Item ID (optional)
- `storageProvider`: `GOOGLE_DRIVE` | `LOCAL`

## Fallback & Isolation Policy
- If Google Drive environment variables are unconfigured, the file service automatically falls back to secure local storage (`uploads/`) with `storageProvider: LOCAL`.
- Access is strictly governed by user organization membership. Users cannot access files belonging to other organizations.
