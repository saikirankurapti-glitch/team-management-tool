# TMP Closed-Team Authentication & Organization Authorization Architecture

## Overview

The TMP platform implements a strict two-layer enterprise security architecture for identity and access management. This document defines the distinction between Google OAuth authentication and TMP organization authorization, explains the allowlist lifecycle, and outlines administrator workflows.

---

## 1. Core Security Architecture: Two Distinct Layers

```
Layer 1: External Provider Authentication (Google / GitHub)
  "Who is this person?"
  - Cryptographic token exchange (OAuth 2.0 authorization_code grant)
  - ID token / Userinfo verification
  - Stable provider subject (Google `sub` / GitHub `id`) extraction
  - Email extraction & canonical normalization (`trim().toLowerCase()`)
          ↓ [Authenticated Identity]
Layer 2: TMP Organization Closed-Team Authorization
  "Is this authenticated identity permitted to access this private organization?"
  - Organization context resolution
  - Strict allowlist lookup (`OrganizationAuthAllowlist`)
  - Status check: ACTIVE? (Reject SUSPENDED / REVOKED / Missing)
  - Mapped TMP user resolution (`User` model in same organization)
  - Active organization membership confirmation
          ↓ [Access Decision]
  YES → Issue TMP JWT Session Cookie & Audit Log (USER_LOGIN_GOOGLE)
  NO  → Reject (HTTP 403 UNAUTHORIZED_GOOGLE_ACCOUNT), Log Security Event, Notify Admin, Show "Access Restricted"
```

> [!IMPORTANT]
> **Google Cloud Test Users ≠ TMP Organization Allowlist**
> - **Google Cloud Test Users**: Controls whether Google's OAuth consent screen permits the user to complete Google OAuth testing authentication.
> - **TMP Organization Allowlist**: Controls whether that authenticated Google user has permission to enter this private organization.
> Adding a user to Google Cloud Test Users does **not** grant access to TMP. Both gates must be satisfied.

---

## 2. Strict Security Constraints (Non-Negotiable)

1. **No Auto-Provisioning**: Unrecognized Google or GitHub accounts are **never** automatically provisioned into the database as Users, Organizations, or Team Members.
2. **Closed-Team Enforcement**: If an account is not in the allowlist with status `ACTIVE`, it is strictly rejected.
3. **Explicit User Mapping**: Allowlist identities must be explicitly linked to existing team members by an organization administrator. User ownership is never guessed.
4. **Distinct Email Addresses**:
   - `saikirankurapati04@gmail.com` and `saikirankurapti@gmail.com` are completely distinct addresses.
   - Email normalization preserves all mailbox characters and applies `trim().toLowerCase()`.
5. **Preservation of Core Team Members**: The platform maintains exactly six real team members:
   1. **Raj Mange** — AI/ML / Agentic AI Developer
   2. **Sai Kiran** — Cloud Engineer / DevOps / Team Lead
   3. **Ammar Raza** — AI/ML Developer
   4. **Ashwin T** — CEO / CTO / Manager
   5. **Shashi** — Digital Marketing Professional
   6. **Navya Sri** — Full Stack Developer (can remain without an external OAuth identity until supplied)

---

## 3. Account Status in Organization Allowlist

| Status | Behavior on OAuth Callback | Description |
| :--- | :--- | :--- |
| `ACTIVE` | **Access Granted** → TMP Session Created | Authorized team member in good standing. |
| `SUSPENDED` | **Access Denied** (HTTP 403 `ACCOUNT_SUSPENDED`) | Temporarily blocked by administrator. |
| `REVOKED` | **Access Denied** (HTTP 403 `ACCOUNT_REVOKED`) | Permanently disabled; historical data preserved. |
| `PENDING` / *Missing* | **Access Denied** (HTTP 403 `UNAUTHORIZED_GOOGLE_ACCOUNT`) | Security event logged; admin alerted; access request offered. |

---

## 4. Allowlist Identity Configuration & Current Status

The current organization allowlist entries in production SQLite (`dev.db`):

| Email / Identity | Provider | Mapped TMP Team Member | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `saikirankurapati04@gmail.com` | `GOOGLE` | **Sai Kiran** (`467a2534-...`) | `ACTIVE` | Current testing account (Explicitly authorized) |
| `saikirankurapti@gmail.com` | `GOOGLE` | **Sai Kiran** (`467a2534-...`) | `ACTIVE` | Admin primary email |
| `saikiran.zerokost@gmail.com` | `GOOGLE` | **Sai Kiran** (`467a2534-...`) | `ACTIVE` | Secondary Google account |
| `shashi.zerokost@gmail.com` | `GOOGLE` | **Shashi** | `ACTIVE` | Team Member Google identity |
| `ammarraza.zerokost@gmail.com` | `GOOGLE` | **Ammar Raza** | `ACTIVE` | Team Member Google identity |
| `everythingdata789@gmail.com` | `GOOGLE` | *Unmapped* | `ACTIVE` | Authorized identity awaiting explicit user mapping |

---

## 5. Administrator Authorization API

Administrators manage authorization via the following endpoints (protected by `authenticate` + `requireRole('ADMIN')`):

### Standard Routes:
- `GET /api/admin/auth-allowlist` / `GET /api/security/allowlist`
  - Returns all authorized identities with their linked TMP team member details.
- `POST /api/admin/auth-allowlist` / `POST /api/security/allowlist`
  - Adds a new authorization record:
    ```json
    {
      "provider": "GOOGLE",
      "email": "saikirankurapati04@gmail.com",
      "userId": "467a2534-a1a3-44f7-9dad-798582eabbab",
      "status": "ACTIVE",
      "displayName": "Sai Kiran"
    }
    ```
- `PATCH /api/admin/auth-allowlist/:id` / `PATCH /api/security/allowlist/:id`
  - Updates status (`ACTIVE`, `SUSPENDED`, `REVOKED`) or remaps `userId`.
- `DELETE /api/admin/auth-allowlist/:id` / `DELETE /api/security/allowlist/:id`
  - Deletes an allowlist record and logs audit event.
- `GET /api/security/access-requests`
  - Returns pending, approved, and rejected access requests.
- `POST /api/security/access-requests/:id/review`
  - Decision: `"APPROVE"` (activates allowlist & maps user) or `"REJECT"`.

---

## 6. Access Restricted Diagnostic Display

When an unauthorized Google account attempts login, the UI displays the **Access Restricted** card with non-sensitive diagnostic details:

```text
==================================================
              Access Restricted
    Private Organization Closed Team Policy
==================================================
Your Google account is authenticated, but it is not authorized for this organization.
The administrator has been notified.

[ Authorization Diagnostics ]
  Authenticated identity: saikirankurapati04@gmail.com
  Provider:               Google
  Authorization:          Not authorized
  Organization:           Demo Startup Inc.
  Request status:         Not requested / Pending / Approved / Rejected

[ Need Access? ]
  [ Confirm your Google email ] [ Request ]
==================================================
```
*No internal database IDs, client secrets, or OAuth access tokens are exposed.*

---

## 7. Audit Logging & Security Alert Architecture

Every authorization check and administrative action writes structured audit records:
1. **Successful Google Login**: Recorded via `prisma.auditLog.create` with proper `organization` and `actor` relation connections (`action: USER_LOGIN_GOOGLE`).
2. **Unauthorized Attempt**: Recorded via `prisma.securityEvent.create` (`eventType: UNAUTHORIZED_LOGIN_ATTEMPT`, `status: BLOCKED`). In-app notification pushed immediately to all organization administrators (`ADMIN` / `OWNER`).
3. **Revocation**: When an identity is revoked, the allowlist record status is set to `REVOKED`. The underlying `User` record, task history, work items, and resource allocations remain completely intact.
