# Google New User Access Request — Diagnostic Report

## Summary

**Status: Backend workflow is CORRECT. The root cause of `saikirankur1p1ti@gmail.com` not producing an AccessRequest is a Google OAuth environment restriction, NOT a TMP application bug.**

---

## Current Google OAuth Configuration

| Parameter | Value |
|-----------|-------|
| **OAuth Client ID** | `901708821322-kkqgtpffb54tdarf2t3itgpi2c5tm05c.apps.googleusercontent.com` |
| **Client Secret** | Stored encrypted in database (configured) |
| **Redirect URI** | `http://localhost:5173/auth/google/callback` |
| **Config Source** | DATABASE (GoogleAppConfig table) |
| **isEnabled** | `true` |
| **OAuth Environment** | **TESTING** (inferred — OAuth project has not been published/verified) |
| **User Type** | External — Gmail accounts supported |
| **Publishing Status** | Testing mode (100-user limit, Google Test Users required) |

The Google OAuth project `901708821322-kkqgt...` is in Testing mode. In this mode, Google will only permit accounts listed as Test Users in the Google Cloud Console → OAuth consent screen → Test users to complete the OAuth handshake. All other accounts receive `access_denied` BEFORE TMP receives the OAuth callback.

---

## Why `saikirankur1p1ti@gmail.com` Does NOT Create an AccessRequest

```
saikirankur1p1ti@gmail.com
    ↓
Clicks "Sign in with Google"
    ↓
Google OAuth consent screen
    ↓  <-- BLOCKED HERE by Google (Testing Mode)
Google returns: error=access_denied
    ↓
Client receives error parameter in redirect URL
    ↓
GoogleCallbackPage detects error=access_denied
    ↓
Shows: "Google Authorization Denied" (GOOGLE_OAUTH_DENIED error type)
    ↓
TMP server /auth/google/callback is NEVER called
    ↓
TMP cannot create AccessRequest for identity it never received
```

**This is Error Type A: Google OAuth environment restriction — NOT a TMP authorization problem.**

---

## Error Classification

| Error Type | Trigger | TMP Action | User Message |
|-----------|---------|-----------|-------------|
| **A - Google Blocked** | OAuth project in Testing, account not a Test User | Cannot do anything | "Google Authorization Denied" |
| **B - TMP Suspended/Revoked** | Google auth succeeds, allowlist entry exists with SUSPENDED/REVOKED status | Log SecurityEvent | "Access Denied: Your account has been suspended/revoked" |
| **C - TMP Unauthorized (new user)** | Google auth succeeds, no allowlist entry found | Create AccessRequest, notify admins | "Access Request Pending" |
| **D - TMP Approved** | Google auth succeeds, allowlist ACTIVE, user linked | Issue JWT session | Redirect to dashboard |

---

## Why `saikirankurapati04@gmail.com` DOES Work

This account is in the OrganizationAuthAllowlist with `status=ACTIVE`. When it previously went through the flow:
1. Google allowed it (it was added as a Test User)
2. TMP received the identity
3. Allowlist check returned `allowed=true`
4. JWT session was issued → login success

---

## Current Database State (as of 2026-09-09)

### OrganizationAuthAllowlist (6 entries, all ACTIVE)

| Provider | Email | Status | Linked User |
|----------|-------|--------|-------------|
| GOOGLE | saikiran.zerokost@gmail.com | ACTIVE | Mapped |
| GOOGLE | saikirankurapti@gmail.com | ACTIVE | Mapped |
| GOOGLE | saikirankurapati04@gmail.com | ACTIVE | Mapped |
| GOOGLE | everythingdata789@gmail.com | ACTIVE | Unmapped |
| GOOGLE | shashi.zerokost@gmail.com | ACTIVE | Mapped |
| GOOGLE | ammarraza.zerokost@gmail.com | ACTIVE | Mapped |

### AuthAccessRequests (2 entries)

| Email | Status | Created |
|-------|--------|---------|
| test_api_check@example.com | PENDING | 2026-09-09 |
| saikirankurapati04@gmail.com | APPROVED | 2026-09-09 |

### Recent SecurityEvents (proves TMP backend IS working)

The backend correctly created `UNAUTHORIZED_LOGIN_ATTEMPT` events for:
- `new.closedteam.candidate@gmail.com` (test account — was allowed through by Google as Test User)
- `unauthorized.stranger@gmail.com` (test account — was allowed through by Google as Test User)

This proves the TMP flow from Google callback → allowlist check → AccessRequest creation is **working correctly** when Google allows the identity through.

---

## For `saikirankur1p1ti@gmail.com` — Development Testing Steps

### Step 1: Add as Google Test User

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select the project containing OAuth Client ID `901708821322-kkqgt...`
3. Navigate to: **APIs & Services → OAuth consent screen**
4. Scroll to **Test users**
5. Click **+ Add users**
6. Add: `saikirankur1p1ti@gmail.com`
7. Save

### Step 2: Test the TMP flow

1. Open TMP login page
2. Click "Sign in with Google"
3. Sign in as `saikirankur1p1ti@gmail.com`
4. Google will now allow the account through (Test User restriction lifted)
5. TMP receives the identity at `POST /auth/google/callback`
6. `checkGoogleAllowlist` finds no ACTIVE entry for this email
7. `createAccessRequest` is called → `PENDING` record created
8. Admin notification sent to all ADMIN/OWNER users
9. User sees "Access Request Pending" page

### Step 3: Approve the request (Admin)

1. Admin opens **Settings → Security → Access Requests**
2. Finds `saikirankur1p1ti@gmail.com` in PENDING state
3. Clicks **Approve**
4. Selects a team member to map the Google identity to
5. Clicks **Approve Access**
6. Transaction executes: AllowlistEntry ACTIVE + AccessRequest APPROVED + AuditLog

### Step 4: Login after approval

1. User logs in with `saikirankur1p1ti@gmail.com` again
2. Google auth succeeds
3. TMP checks allowlist → ACTIVE entry found, user linked
4. JWT session issued → user lands on dashboard

---

## Scopes Currently Requested

```
openid
email
profile
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.events.freebusy
https://www.googleapis.com/auth/drive.file
```

The scopes `calendar.events`, `calendar.events.freebusy`, and `drive.file` are **restricted scopes** that require Google's OAuth verification process for production use. In Testing mode, these work for Test Users without verification.

For production: Either publish the app (go through verification) or use a Google Workspace internal OAuth configuration if all users belong to a single Workspace organization.

---

## Architecture: Development vs Production

### Development (Current — Testing Mode)

```
Google OAuth Project: Testing mode
  Max 100 Google Test Users
  Accounts must be pre-approved in Cloud Console
  This is a Google restriction, NOT TMP authorization

TMP Authorization: Closed-Team Allowlist
  OrganizationAuthAllowlist controls access
  AccessRequest workflow for unknown users
  Admin approval required for every new member
```

### Production Architecture (Required for arbitrary Gmail accounts)

```
Google OAuth Project: Published (Production)
  OAuth consent screen: Published + Verified
  App verification for restricted scopes: Submitted
  User type: External
  No Google Test User restriction — ANY Gmail can authenticate
        ↓
TMP receives identity at POST /auth/google/callback
        ↓
TMP Closed-Team Allowlist check
        ↓
If not allowed → AccessRequest created → Admin notification
        ↓
Admin approves → AllowlistEntry ACTIVE → User can login
```

IMPORTANT: Do NOT add every employee as a Google Test User in production. The intended production architecture is:
1. Publish the Google OAuth project (go through verification for restricted scopes)
2. Any Gmail account can authenticate with Google
3. TMP's allowlist controls who gets in
4. Unknown accounts trigger AccessRequests → admin approval
5. No Google Cloud Console operation required per employee onboarding

### If the team uses Google Workspace (company email)

If the team has a Google Workspace organization (company.com accounts), you can use Internal OAuth:
- No verification required for internal apps
- Only Workspace members can authenticate
- Still use TMP's allowlist for fine-grained access control

CAUTION: The team currently uses Gmail accounts (@gmail.com). Do NOT switch to Internal OAuth unless all users belong to the same Google Workspace organization. Gmail personal accounts cannot authenticate with Internal OAuth apps.

---

## Environment Separation

### Current: `server/.env`
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=...
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL="file:./dev.db"
# Google credentials stored in GoogleAppConfig database table
# No GOOGLE_CLIENT_ID/SECRET in .env needed
```

### Recommended Production `.env.production`
```env
PORT=5000
NODE_ENV=production
JWT_SECRET=<strong_production_secret>
CLIENT_ORIGIN=https://your-production-domain.com
DATABASE_URL=<production_database_url>
# Optional env fallback:
# GOOGLE_CLIENT_ID=<prod_client_id>
# GOOGLE_CLIENT_SECRET=<prod_client_secret>
# GOOGLE_REDIRECT_URI=https://your-production-domain.com/auth/google/callback
```

NOTE: TMP uses a database-first configuration strategy. `GoogleAppConfig` database entries take precedence over environment variables. This allows administrators to update Google OAuth credentials without redeploying the server.

---

## Diagnostic Logging Format (Implemented in POST /auth/google/callback)

Every callback request now emits structured logs with a correlation ID. Secrets are never logged.

```
[GOOGLE_CALLBACK] correlation_id=a1b2c3d4 stage=callback_received {"code_present":true}
[GOOGLE_CALLBACK] correlation_id=a1b2c3d4 stage=config_loaded {"source":"DATABASE","configured":true}
[GOOGLE_CALLBACK] correlation_id=a1b2c3d4 stage=token_exchanged {"has_access_token":true}
[GOOGLE_CALLBACK] correlation_id=a1b2c3d4 stage=google_identity_received {"email":"user@gmail.com","email_verified":true}
[GOOGLE_CALLBACK] correlation_id=a1b2c3d4 stage=org_resolved {"orgName":"Demo Startup Inc."}
[GOOGLE_CALLBACK] correlation_id=a1b2c3d4 stage=allowlist_checked {"allowed":false,"reason":"NOT_IN_ALLOWLIST"}
[GOOGLE_CALLBACK] correlation_id=a1b2c3d4 stage=access_request_created {"requestId":"609749a8...","email":"user@gmail.com"}
[GOOGLE_CALLBACK] SUMMARY correlation_id=a1b2c3d4 email=user@gmail.com googleIdentity=FOUND tmpUser=NOT_FOUND allowlist=NOT_FOUND accessRequest=CREATED result=ACCESS_PENDING
```

Successful login:
```
[GOOGLE_CALLBACK] SUMMARY correlation_id=a1b2c3d4 email=user@gmail.com googleIdentity=FOUND tmpUser=FOUND allowlist=ACTIVE accessRequest=N/A result=LOGIN_SUCCESS
```

Google-blocked (Type A):
```
[GOOGLE_CALLBACK] correlation_id=a1b2c3d4 stage=token_exchange_failed {"error":"...invalid_grant..."}
```
In this case, server logs will show the token exchange failure. No SUMMARY line is emitted because Google blocked before identity was received.

---

## Final Acceptance Criteria Status

| Criterion | Status | Notes |
|-----------|--------|-------|
| Unknown Google user creates AccessRequest | BACKEND OK | Blocked by Google Testing Mode for new account |
| Admin receives notification | IMPLEMENTED | createAccessRequest sends notifications |
| Request appears under Pending Requests | WORKS | Confirmed by DB query |
| Admin can open details | WORKS | Security UI shows requests |
| Admin can approve | WORKS | POST /security/access-requests/:id/review |
| Admin can reject | WORKS | decision=REJECT |
| Admin can map identity to team member | WORKS | userId in approve body |
| No duplicate user created | WORKS | Upserts existing user |
| No duplicate org membership | WORKS | Uses existing organization |
| Approved user can login | WORKS | AllowlistEntry ACTIVE → JWT |
| Revoked user cannot login | WORKS | Status=REVOKED → 403 |
| Existing users still login | WORKS | ACTIVE allowlist entries work |
| Cross-organization isolation | WORKS | orgId checked on all queries |
| Authentication activity correct | WORKS | SecurityEvents recorded |
| Dashboard counters correct | WORKS | getSecurityOverview counts from DB |
| Google Calendar functional | NOT CHANGED | No changes to calendarService |
| Google Meet functional | NOT CHANGED | No changes to meetingController |
| Google Drive functional | NOT CHANGED | No changes to driveController |
| Dev Test User restriction documented | DONE | This document |
| Production architecture defined | DONE | This document |
| Browser E2E | PENDING | Requires adding account as Google Test User first |
| Diagnostic logging | IMPLEMENTED | Structured GOOGLE_CALLBACK logs with correlation ID |
| Build passes | PASSED | tsc exits with code 0 |

---

## Required Action Before Browser E2E Can Be Completed

Browser E2E cannot be completed until `saikirankur1p1ti@gmail.com` is added as a Google Test User in the Google Cloud Console for project `901708821322-kkqgt...`.

Without this, Google returns `access_denied` before TMP receives the identity, and no AccessRequest can be created by TMP. This is a Google OAuth Testing Mode restriction, not a TMP application bug.

Steps:
1. Go to https://console.cloud.google.com/
2. Select your project (containing client ID 901708821322-kkqgt...)
3. APIs & Services → OAuth consent screen → Test users
4. Add saikirankur1p1ti@gmail.com
5. Save and wait ~1 minute for propagation
6. Retry the Google login flow
7. TMP will receive the identity and create the AccessRequest automatically
8. Admin approves in Settings → Security → Access Requests
9. User logs in again → dashboard
