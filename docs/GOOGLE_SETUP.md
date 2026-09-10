# Google Integration Setup Guide

## Overview
Google Cloud integration provides OAuth user identity verification and Google Drive document storage for enterprise specifications, attachments, and project assets.

## Google Cloud Console Setup
1. Visit the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new Project (e.g. `Antigravity Enterprise`).
3. Navigate to **APIs & Services > Credentials**.
4. Create an **OAuth 2.0 Client ID**:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:5173/auth/google/callback`
5. Enable **Google Drive API** under **APIs & Services > Library**.
6. Obtain OAuth2 Refresh Token:
   - Use OAuth Playground or Google CLI to generate a refresh token with scope `https://www.googleapis.com/auth/drive.file`.

## Environment Configuration
Add to `server/.env`:
```env
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REFRESH_TOKEN=your_google_refresh_token
GOOGLE_DRIVE_FOLDER_ID=optional_google_drive_folder_id
```
