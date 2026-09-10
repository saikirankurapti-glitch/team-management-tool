# Google OAuth 2.0 Setup & Configuration Guide

## Overview
This document guides system administrators on setting up Google Cloud Console credentials and managing Google OAuth 2.0 integration through the application UI.

## Google Cloud Console Step-by-Step Setup

1. **Navigate to Google Cloud Console**:
   Open [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials).

2. **Enable Required Google Workspace APIs**:
   - Google Calendar API
   - Google Drive API
   - Google People API

3. **Configure OAuth Consent Screen**:
   - User Type: Internal (for Google Workspace domain) or External (for testing).
   - Add App Name: `Antigravity Team Management`.
   - Add Scopes:
     - `openid`
     - `email`
     - `profile`
     - `https://www.googleapis.com/auth/calendar.events`
     - `https://www.googleapis.com/auth/calendar.events.freebusy`
     - `https://www.googleapis.com/auth/drive.file`

4. **Create OAuth 2.0 Credentials**:
   - Application Type: `Web Application`
   - Name: `Antigravity Workstation Client`
   - Authorized Javascript Origins: `http://localhost:5173`
   - Authorized Redirect URIs: `http://localhost:5173/auth/google/callback`

5. **Copy Client Credentials into UI**:
   - Open application: `Settings -> Integrations -> Google Workspace`.
   - Input **Client ID** and **Client Secret**.
   - Click **Save Configuration**.
   - Click **Test Configuration** to verify setup.

## Technical Resolution Hierarchy
The server resolves Google OAuth credentials using the following order of precedence:
1. `GoogleAppConfig` database record for the organization.
2. Server environment variables (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`).
3. Return `configured: false` with actionable admin prompt.
