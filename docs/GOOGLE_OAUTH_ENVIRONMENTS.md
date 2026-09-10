# Google OAuth Environments & TMP Closed-Team Authorization Architecture

This document defines the separation between Google Cloud OAuth configuration and TMP's organization-level authorization layer, and explains the operational workflow for onboarding team members in development versus production.

---

## 1. Executive Summary & Root Cause Analysis

### The Problem
During development, when users attempted to sign in with an unapproved Google account, Google blocked the login before TMP ever received the callback with:
```text
Access blocked: tmp has not completed the Google verification process.
The app is currently being tested, and can only be accessed by developer-approved testers.
Error 403: access_denied
```
In early iterations, developers frequently attempted to resolve this by manually adding email addresses to Google Cloud Console > OAuth Consent Screen > Test Users. 

### Why This Is Not Acceptable in Production
1. **Google Cloud Console is infrastructure configuration, not employee onboarding.** Workspace administrators should never be required to log into Google Cloud Console to add every new contractor, employee, or tester.
2. **Google OAuth Testing mode** strictly enforces a 100-user whitelist directly on Google's authorization servers. Any account not in Google's Test User list is rejected by Google before TMP's callback endpoint is ever invoked.
3. In a production deployment, **Google Cloud authenticates the Google account** (Layer 1: Identity verification), while **TMP controls organization authorization** (Layer 2: Access governance).

---

## 2. Two-Layer Architecture: Authentication vs Authorization

```text
               LAYER 1: IDENTITY AUTHENTICATION
            [Google Cloud OAuth 2.0 / Auth Platform]
                               │
            "Google confirms who the user is"
            (name, email, email_verified, sub ID)
                               │
                               ▼
               LAYER 2: ORGANIZATION AUTHORIZATION
             [TMP Backend & Closed-Team Allowlist]
                               │
                               ├──────────────────────────────────────┐
                               ▼                                      ▼
                      Account is Authorized?                Account is Unauthorized?
                               │                                      │
                               ▼                                      ▼
                      [TMP User Session]                    [Access Request Created]
                      - Resolved User Record                - Admin Alert & Notification
                      - Organization Membership             - In-App Review Pending
                      - Dashboard Access                    - Layer 2 "Access Pending" UI
```

* **Layer 1: Google OAuth (Authentication)**  
  * **Role**: Authenticates that the user owns the specified Google account.
  * **Rule**: Google authentication alone **NEVER** grants membership or entry into TMP.
  * **Behavior**: In Production, Google authenticates the identity and safely redirects the user back to TMP with the OAuth code.

* **Layer 2: TMP Organization Allowlist (Authorization)**  
  * **Role**: Closed-team gatekeeper determining whether this identity is an authorized member of this organization.
  * **Rule**: Unknown identities are blocked. TMP auto-generates a secure `AuthAccessRequest`, logs a `SecurityEvent`, pushes in-app notifications to organization administrators, and displays the **Access Request Pending** page.
  * **Admin Action**: Administrators approve or reject requests directly within TMP (`Settings` → `Security` → `Access Requests`). On approval, the admin maps the Google identity to an existing team member profile (e.g. Raj Mange, Sai Kiran, Ammar Raza, Ashwin T, Shashi, Navya Sri).

---

## 3. Environment Configurations: Development vs Production

| Environment Dimension | Development / Staging | Production (Internal Workspace) | Production (External SaaS / Multi-Domain) |
| :--- | :--- | :--- | :--- |
| **OAuth Consent User Type** | `External` (Publishing status: **Testing**) | `Internal` (Publishing status: **In production**) | `External` (Publishing status: **In production**) |
| **Google Test Users Required?** | **YES** (Developer-controlled test accounts) | **NO** (Any user in the Workspace organization can authenticate) | **NO** (Any Google user can authenticate) |
| **Google Verification Required?** | No | No (Bypasses Google verification for internal domain users) | Yes (Requires Google verification if sensitive scopes like Google Calendar/Drive are requested) |
| **Target Audience** | Developers, QA team | Employees with corporate Google accounts (e.g. `@demostartup.com`) | External contractors, clients, or multi-domain team members |
| **Onboarding Flow** | Developer adds account to Google Cloud Test Users + TMP Allowlist | User clicks "Sign in with Google" → TMP creates `AccessRequest` → Admin approves in TMP | User clicks "Sign in with Google" → TMP creates `AccessRequest` → Admin approves in TMP |
| **Google Cloud Console Needed for New Employees?** | Yes (Google testing restriction) | **NO** (Managed entirely inside TMP UI) | **NO** (Managed entirely inside TMP UI) |

---

## 4. Production Google Cloud Setup Guidelines

To transition the application to a production posture where no administrator touches Google Cloud Console for daily onboarding:

### Option A: Internal Google Workspace App (Recommended for Private Teams)
If the organization uses Google Workspace:
1. Open [Google Cloud Console](https://console.cloud.google.com/) > **APIs & Services** > **OAuth consent screen**.
2. Select **User Type**: `Internal`.
3. Click **Save and Continue**.
4. In this mode:
   - Any team member with an organization account can authenticate through Google.
   - Google bypasses the 100-user testing restriction.
   - Google does not require OAuth app verification.
   - TMP's Layer 2 allowlist continues to enforce closed-team security and map identities to directory profiles.

### Option B: External Production App (For Gmail / External Accounts)
If team members use personal `@gmail.com` addresses:
1. Open [Google Cloud Console](https://console.cloud.google.com/) > **APIs & Services** > **OAuth consent screen**.
2. Click **Publish App** to change status from *Testing* to *In production*.
3. Complete the Google App Verification process for the scopes requested (`openid`, `profile`, `email`, and optionally calendar scopes).
4. Once approved by Google:
   - Any Google user can authenticate through Google.
   - Google delivers the identity to TMP.
   - TMP checks `OrganizationAuthAllowlist`. Unauthorized users are intercepted, an `AccessRequest` is created, and the administrator reviews and approves the user from TMP.

---

## 5. TMP Administrator Security Workflow

### Onboarding a New Employee:
1. The new employee opens TMP and clicks **Sign in with Google**.
2. Google authenticates the account and returns the identity to TMP.
3. TMP detects that the account is not yet authorized in `OrganizationAuthAllowlist`:
   - An `AuthAccessRequest` is automatically generated (Status: `PENDING`).
   - A `SecurityEvent` is recorded.
   - An in-app alert notification is dispatched to all Organization Administrators.
   - The employee is shown the **Access Request Pending** screen displaying non-sensitive request diagnostics.
4. The TMP Administrator sees the notification bell update, clicks the notification, and is taken directly to **Settings** → **Security & Access Control** → **Access Requests**.
5. The Administrator inspects the request drawer and clicks **Approve Access**.
6. The modal prompts: *"Which existing TMP team member should this Google identity belong to?"*
   - The Administrator selects the directory member (e.g. *Ammar Raza*).
7. The approval executes in an atomic database transaction:
   - `OrganizationAuthAllowlist` is created/updated to `ACTIVE` with `userId` mapped.
   - `AuthAccessRequest` status is set to `APPROVED`.
   - An `AuditLog` record (`ACCESS_REQUEST_APPROVED`) is logged with Prisma relations connected.
8. The employee signs in with Google again and is instantly routed to their TMP Dashboard.

### Revoking Access:
1. Administrator navigates to **Settings** → **Security** → **Authentication Allowlist**.
2. Finds the user and clicks **Revoke**.
3. `OrganizationAuthAllowlist.status` is set to `REVOKED`.
4. Subsequent login attempts by that Google account are immediately blocked by TMP with `ACCOUNT_REVOKED`. Historical audit records remain preserved.
