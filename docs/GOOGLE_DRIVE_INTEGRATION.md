# Google Drive Document Storage Integration

## Overview
The Google Drive service (`server/src/services/googleDriveService.ts`) enables users to upload, organize, list, and stream download project documents, chat attachments, and work item files directly to Google Drive.

## Scope & Security Policy
The integration requests the narrow Google Drive scope `https://www.googleapis.com/auth/drive.file`. This scope only permits access to files and folders created by this application, preserving user privacy across the rest of their personal Google Drive.

## Organizational Folder Hierarchy
Files are automatically categorized into Google Drive folder hierarchies:
```text
Google Drive Root
└── GenQuantaa Workstation
    └── [Organization Name]
        └── Projects
            └── [Project Name]
```

## API Endpoint Matrix

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/google/drive/upload` | Multipart file upload to Google Drive with folder metadata |
| `GET` | `/api/google/drive/files` | Lists user's Google Drive files and DB attachments |
| `GET` | `/api/google/drive/files/:id/download` | Streams file content directly from Google Drive |
| `DELETE` | `/api/google/drive/files/:id` | Deletes file from Google Drive and removes DB attachment |
