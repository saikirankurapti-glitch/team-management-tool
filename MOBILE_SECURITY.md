# Mobile Security & Session Management Specifications (`UserSession`)

## 1. Session Revocation Controls (`POST /api/v1/sessions/revoke`)
Allows users to view active sessions across mobile/desktop browsers and revoke specific compromised sessions or revoke all other sessions instantly.

## 2. Server-Side Deep Link Authorization
Every deep link (`/work-items/:id`, `/chat/:id`, `/knowledge/:id`) strictly enforces server-side authentication and organization RBAC permissions.
