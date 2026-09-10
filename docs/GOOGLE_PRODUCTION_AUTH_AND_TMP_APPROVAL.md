# Google Production Auth & TMP Closed-Team Approval Workflow

## Executive Summary

This document establishes the architecture, operational workflows, and security boundaries for Google OAuth authentication integrated with Team Management Platform's (TMP) closed-team authorization model.

### Primary Rule
**Google Cloud Console is infrastructure configuration, NOT an employee onboarding mechanism.**

* **Layer 1: Google OAuth (Authentication)**: Validates "Who is this person?" and provides an authenticated Google identity (email, Google subject ID, verified state).
* **Layer 2: TMP Closed-Team Allowlist (Authorization)**: Validates "Is this identity permitted into this organization?". If unauthorized, TMP generates an `AccessRequest`, alerts administrators, and keeps the user in a safe **Access Request Pending** holding state until an admin maps them to a team member profile.

---

## 1. Development vs Production OAuth Configuration

| Configuration Property | Development (Current) | Production (Required) |
| :--- | :--- | :--- |
| **OAuth Consent User Type** | `External` | `External` (or `Internal` if Google Workspace) |
| **Publishing Status** | **Testing** | **In Production** |
| **Google Test Users Required?** | **YES** (Google platform enforcement) | **NO** (Any user can authenticate at Layer 1) |
| **Google Verification** | Not required for Test Users (max 100) | Required for sensitive/restricted scopes |
| **Google Cloud Console per Employee** | Required only during testing/dev | **NEVER** required |
| **TMP Access Request Workflow** | Fully functional once identity reaches TMP | Fully functional for all new users |
| **Redirect URI** | `http://localhost:5173/auth/google/callback` | `https://<production-domain>/auth/google/callback` |

---

## 2. Root Cause Analysis: `saikirankur1p1ti@gmail.com`

When `saikirankur1p1ti@gmail.com` attempted to sign in via Google:
1. Google returned:
   ```text
   Access blocked: tmp has not completed the Google verification process.
   Error 403: access_denied
   ```
2. Google stopped the handshake **on Google's servers**.
3. TMP's backend `/auth/google/callback` was **never reached**.
4. **Conclusion**: TMP cannot create an `AccessRequest` for an identity it never received. This is a Google Testing Mode restriction (Error Type A), not a failure of the TMP backend.

---

## 3. The 5 Error Classifications

| Error Type | Trigger | System Responsible | TMP Action | User Display |
| :--- | :--- | :--- | :--- | :--- |
| **Type A: Google Blocked** | App in Testing; account not in Google Test Users | Google Cloud | Never receives callback | "Google Authorization Denied" / 403 access_denied |
| **Type B: TMP Suspended/Revoked** | Authenticated by Google; Allowlist status is `SUSPENDED` or `REVOKED` | TMP Backend | Reject login, log `UNAUTHORIZED_LOGIN_ATTEMPT` | "Access Denied: Account suspended or revoked" |
| **Type C: TMP Unauthorized (New)** | Authenticated by Google; No active entry in Allowlist | TMP Backend | Create `AccessRequest` (PENDING), notify admins | "Access Request Pending" UI |
| **Type D: TMP Approved** | Authenticated by Google; Allowlist status is `ACTIVE` & mapped | TMP Backend | Generate JWT session, log `LOGIN_SUCCESS` | Redirect to TMP Dashboard |
| **Type E: Duplicate Request Attempt** | Authenticated by Google; Existing `PENDING` request exists | TMP Backend | Deduplicate (suppress second request), preserve timestamp | "Access Request Pending" UI |

---

## 4. Complete End-to-End Workflow

```text
[ New Google User ]
       │
       ▼ Clicks "Sign in with Google"
[ Google OAuth Consent ]
       │ (Production: All accounts allowed / Dev: Google Test Users only)
       ▼ Authenticates identity
[ TMP Callback: POST /auth/google/callback ]
       │ Safe diagnostics logged (correlation ID, no secrets)
       ▼ Check OrganizationAuthAllowlist
       ├─────────────────────────────────────────────────┐
       ▼ [ACTIVE]                                        ▼ [NOT FOUND / PENDING]
[ Issue JWT Session ]                         [ Create AuthAccessRequest ]
       │                                                 │ - Status: PENDING
       ▼ Redirect to Dashboard                           │ - Dedup by orgId + provider + email
                                                         │ - Deduplicate duplicate logins
                                                         ▼
                                              [ Create In-App Admin Notification ]
                                                         │ - Target: ADMIN & OWNER roles
                                                         │ - Badge count increments (+1)
                                                         ▼
                                              [ User sees: Access Pending Page ]
                                                         │
                                                         ▼
                                              [ Admin reviews in Security UI ]
                                                         │ - Inspects email, provider, timestamp
                                                         │ - Selects team member to map
                                                         ▼
                                              [ Atomic Transaction Execution ]
                                                         │ - Validate admin permission
                                                         │ - Validate request is PENDING
                                                         │ - Create/Update ExternalIdentity
                                                         │ - Create/Update OrganizationAuthAllowlist (ACTIVE)
                                                         │ - Set AccessRequest APPROVED
                                                         │ - Record Audit Event & Security Log
                                                         ▼
                                              [ User Logs In Again ]
                                                         │
                                                         ▼
                                              [ Direct Entry to TMP Dashboard ]
```

---

## 5. Google Cloud Production Migration Guide

### Audience Selection: External vs Internal
* **Current Team Reality**: The team uses personal Gmail addresses (e.g. `@gmail.com`).
* **Rule**: You **MUST NOT** select `Internal` unless all team members belong to a single Google Workspace / Cloud Identity organization. Personal `@gmail.com` accounts cannot authenticate against `Internal` apps.
* **Selection**: Use **External** with Publishing Status **In production**.

### Scope Classifications & Verification Requirements

| Scope | Type | Purpose | Verification Requirement |
| :--- | :--- | :--- | :--- |
| `openid` | Non-sensitive | OpenID identity | None |
| `https://www.googleapis.com/auth/userinfo.email` | Non-sensitive | Account email | None |
| `https://www.googleapis.com/auth/userinfo.profile` | Non-sensitive | Name & avatar | None |
| `https://www.googleapis.com/auth/calendar.events` | **Sensitive** | Meeting scheduling & event management | Requires Google OAuth Verification |
| `https://www.googleapis.com/auth/calendar.events.freebusy`| **Sensitive** | Availability conflict checking | Requires Google OAuth Verification |
| `https://www.googleapis.com/auth/drive.file` | **Sensitive** | Project artifact storage & linking | Requires Google OAuth Verification |

*Note: Do NOT remove Calendar, Meet, or Drive scopes merely to skip verification; these features are integral to TMP project workflows.*

### Production Checklist for Google Cloud Console:
1. **OAuth Consent Screen**:
   - App Name: `Team Management Platform`
   - User Support Email: Admin contact email
   - App Logo: High-res square logo
   - Authorized Domains: Your production domain (e.g., `genquantaa.com`)
   - Privacy Policy URL: `https://<domain>/privacy`
   - Terms of Service URL: `https://<domain>/terms`
2. **Publishing Status**: Click **Publish App** to move from *Testing* to *In Production*.
3. **Submit for Verification**:
   - Provide a demo video showing why `calendar.events` and `drive.file` are needed.
   - Explain that users schedule client meetings and link design docs to project tasks.

---

## 6. Database & Model Architecture (Phase 44)

The `AuthAccessRequest` model in `schema.prisma` stores rich user identity attributes so administrators never have to query Google Cloud Console or external providers:

```prisma
model AuthAccessRequest {
  id                  String       @id @default(uuid())
  organizationId      String
  organization        Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  provider            String       // GOOGLE, GITHUB
  email               String
  normalizedEmail     String?
  externalIdentityId  String?      // Google sub ID or GitHub user ID (immutable)
  name                String?
  displayName         String?
  givenName           String?
  familyName          String?
  profileImageUrl     String?
  status              String       @default("PENDING") // PENDING, APPROVED, REJECTED
  ip                  String?
  userAgent           String?
  attemptCount        Int          @default(1)
  lastSeenAt          DateTime?
  rejectionReason     String?
  mappedUserId        String?
  reviewedById        String?
  reviewedAt          DateTime?
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt

  @@index([organizationId])
  @@index([status])
  @@index([email])
  @@index([normalizedEmail])
  @@index([provider, externalIdentityId])
}
```

### Key Architectural Guarantees:
1. **No Google Token Storage in Access Requests**: Access tokens and refresh tokens are NEVER stored in `AuthAccessRequest`.
2. **Notification Throttling & Deduplication**: Repeated logins for an account in `PENDING` state update `lastSeenAt` and increment `attemptCount` without dispatching duplicate notifications to administrators.
3. **Immutable Identity Binding**: On admin approval, `externalIdentityId` (Google `sub` ID) is stored directly in `OrganizationAuthAllowlist`, ensuring immutable cryptographic identity binding.
4. **Governed Team Member Mapping**: Admin explicitly chooses from the existing 6 TMP team members (Raj Mange, Sai Kiran, Ammar Raza, Ashwin T, Shashi, Navya Sri). No duplicate `User` or `OrganizationMember` records are ever created.

---

## 7. Safe Server-Side Diagnostics

In `server/src/controllers/authController.ts`, all Google OAuth callbacks generate structured logs with correlation IDs. **Credentials, access tokens, refresh tokens, and client secrets are NEVER logged.**

Example Diagnostic Output:
```text
[GOOGLE_CALLBACK] correlation_id=7f8b91a2 stage=callback_received {"code_present":true}
[GOOGLE_CALLBACK] correlation_id=7f8b91a2 stage=config_loaded {"source":"DATABASE","configured":true}
[GOOGLE_CALLBACK] correlation_id=7f8b91a2 stage=token_exchanged {"has_access_token":true}
[GOOGLE_CALLBACK] correlation_id=7f8b91a2 stage=google_identity_received {"email":"user@example.com","email_verified":true}
[GOOGLE_CALLBACK] correlation_id=7f8b91a2 stage=org_resolved {"orgName":"Demo Startup Inc."}
[GOOGLE_CALLBACK] correlation_id=7f8b91a2 stage=allowlist_checked {"allowed":false,"reason":"NOT_IN_ALLOWLIST"}
[GOOGLE_CALLBACK] correlation_id=7f8b91a2 stage=access_request_created {"requestId":"11d8add6...","email":"user@example.com"}
[GOOGLE_CALLBACK] SUMMARY correlation_id=7f8b91a2 email=user@example.com googleIdentity=FOUND tmpUser=NOT_FOUND allowlist=NOT_FOUND accessRequest=CREATED result=ACCESS_PENDING
```

---

## 8. Status Report

```text
CURRENT GOOGLE OAUTH STATUS:
TESTING (Google Cloud Console project 901708821322-kkqgt... is currently in Testing mode; publishing to Production enables any Gmail account to authenticate at Layer 1)

CURRENT TMP AUTHORIZATION:
WORKING (Closed-team allowlist strictly enforced; unauthorized users blocked)

NEW USER ACCESS REQUEST:
WORKING (AccessRequest created with rich Google identity metadata, deduplicated on repeated logins, attempt count tracked)

ADMIN NOTIFICATION:
WORKING (In-app notifications dispatched to ADMIN & OWNER roles, badge increments, repeated notifications throttled)

ADMIN APPROVAL:
WORKING (Atomic review transaction maps Google identity to existing member, sets allowlist ACTIVE, no duplicate users created)
```
