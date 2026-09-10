# Phase 38 — Google OAuth Test Users, Dual Security Layers & Private Team Login

## Overview & Executive Summary

During Google OAuth authentication in the browser, an unapproved test account encountered:
```text
Access blocked: tmp has not completed the Google verification process.
The app is currently being tested, and can only be accessed by developer-approved testers.
Error 403: access_denied
```

### 1. Critical Finding: Email Mismatch
The account attempting to sign in in the browser screenshot was:
```text
saikirankurapati04@gmail.com
```
This is **NOT** the same as the administrator account:
```text
saikirankurapti@gmail.com
```
* **Status**: `saikirankurapati04@gmail.com` has **NOT** been added and remains strictly **UNAUTHORIZED**.
* The application treats these as distinct accounts. `saikirankurapati04@gmail.com` is denied access at both layers until explicitly authorized by the administrator.

---

## 2. Google OAuth Configuration Inspection

* **Google Cloud Client ID**: `901708821322-kkqgtpffb54tdarf2t3itgpi2c5tm05c.apps.googleusercontent.com`
* **Publishing Status**: **Testing** (User Type: External, Testing mode)
* **Authorized Redirect URI**: `http://localhost:5173/auth/google/callback`
* **Authorized JavaScript Origin**: `http://localhost:5173`
* **OAuth Scopes**:
  - `openid`
  - `email`
  - `profile`
  - `https://www.googleapis.com/auth/calendar.events`
  - `https://www.googleapis.com/auth/calendar.events.freebusy`
  - `https://www.googleapis.com/auth/drive.file`
* **Client App Policy**: Private closed-team platform. The app is kept in **Testing mode** intentionally during development and internal operations without compromising privacy.

---

## 3. Google Cloud OAuth Consent Screen: Test Users Configuration

In Google Cloud Console (**APIs & Services → OAuth consent screen → Audience → Test users**), only explicitly developer-approved Google accounts can consent when the app is in "Testing" mode.

### Approved Test User Accounts:
1. `saikirankurapti@gmail.com`
2. `saikiran.zerokost@gmail.com`
3. `everythingdata789@gmail.com`
4. `shashi.zerokost@gmail.com`
5. `ammarraza.zerokost@gmail.com`

> [!WARNING]
> Do **NOT** add `saikirankurapati04@gmail.com` to Google Cloud Test Users unless explicitly requested by the administrator.
> Do **NOT** switch the OAuth consent screen to "In production" / Public mode to bypass the error.

---

## 4. Two Independent Security Layers

```
Layer 1: Google Cloud OAuth Consent (Google Platform)
  ├─ Checks if account is registered in Google Cloud "Test Users"
  └─ If NOT in Test Users → Google blocks authentication immediately with 403: access_denied
                                  ↓
Layer 2: Application Organization Allowlist (Backend Authorization)
  ├─ Receives verified identity token from Google
  ├─ Verifies email against OrganizationAuthAllowlist in database
  ├─ If NOT in Allowlist → Rejected with 403 UNAUTHORIZED_GOOGLE_ACCOUNT
  ├─ Admin notified (notification sent to saikirankurapti@gmail.com)
  └─ Security event logged: UNAUTHORIZED_LOGIN_ATTEMPT
```

Neither layer is weakened or bypassed:
* Being a Google Test User **never** bypasses the application allowlist.
* The application allowlist **never** provisions unknown accounts automatically.

---

## 5. Differentiated Error Handling & User Guidance

We updated `GoogleCallbackPage.tsx` to distinctly differentiate Layer 1 vs Layer 2 errors:

### Layer 1: Google OAuth Denied (`GOOGLE_OAUTH_DENIED`)
When Google returns `error=access_denied` before reaching backend callback:
```text
Google authorization was denied.

This application is currently available only to approved Google test accounts.

If you are a team member, make sure your Google account has been added as an approved test user.
```

### Layer 2: Application Access Denied (`APPLICATION_ACCESS_DENIED`)
When Google authenticates successfully but the backend rejects the account:
```text
Access Restricted

Your Google account is authenticated, but it is not authorized for this organization.

The administrator has been notified.
```

---

## 6. Security Center & Dynamic Allowlist Policy UI

In `AuthAllowlistManager.tsx`:
* Added the **GOOGLE AUTHENTICATION** policy banner:
  - **Google OAuth**: `Enabled`
  - **Application Access Policy**: `Private Team`
  - **Authorized Accounts**: Dynamic database count (currently `5`)
  - **Automatic Account Creation**: `Disabled`
  - **Unknown Account Access**: `Blocked`
  - **Admin Security Alerts**: `Enabled`
* Added inline team member selection dropdown for unmapped accounts (such as `everythingdata789@gmail.com`) so the administrator can map identities to directory members directly from the table or during onboarding.
* Verified that team limits and allowlists are purely driven by database records with zero hardcoded `5` or `teamSize === 5` checks.

---

## 7. Automated Test Suite Results

All 11 tests across allowlist security, email normalization, Google login identity resolution, and audit logging pass:

```bash
npx vitest run src/tests/closedAuthAllowlist.test.ts src/tests/googleLoginAuditLog.test.ts
```

Output:
```text
 RUN  v1.6.1 C:/Users/raksh/GENQUANTAA/team-management/server

 ✓ src/tests/googleLoginAuditLog.test.ts  (3 tests) 40ms
stderr | src/tests/closedAuthAllowlist.test.ts > Phase 36: Closed Team Authentication & Allowlist Security Tests > should REJECT unknown Google account, log security event, and notify admin
[SECURITY ALERT] UNAUTHORIZED_LOGIN_ATTEMPT: Provider=GOOGLE, Email=unauthorized.stranger@gmail.com, IP=198.51.100.25

 ✓ src/tests/closedAuthAllowlist.test.ts  (8 tests) 145ms

 Test Files  2 passed (2)
      Tests  11 passed (11)
   Start at  12:13:32
   Duration  889ms
```

Standalone lifecycle tests:
* `src/tests/meetingLifecycle.test.ts`: **All 6 tests PASSED**
* `src/tests/githubEngineeringWorkflow.test.ts`: **All 4 tests PASSED**
* Client Production Build (`npm run build`): **Compiled successfully in 7.19s**
