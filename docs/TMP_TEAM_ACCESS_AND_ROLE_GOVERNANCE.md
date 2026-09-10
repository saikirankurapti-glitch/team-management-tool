# TMP Team, Access, and Role Governance Architecture (Phase 50)

## 1. Authoritative Role Policy & Invariants
The TMP platform strictly enforces the following centralized identity and role hierarchy:
1. **Primary & Sole Administrator:**
   - Account: `saikirankurapti@gmail.com`
   - User Name: `Sai Kiran`
   - Role: `ADMIN` (Level: 40)
   - Capabilities: Complete platform administration, Security Allowlist, Access Requests, System Credentials & API Keys, Developer Apps, Audit Logs, Billing, Project Pricing, and Price Allocation.
   - Protection: Protected from accidental deactivation, demotion, or deletion. An organization must maintain at least one active Administrator.
2. **Authorized CTO & Project Manager:**
   - Account: `ashwin.zerokost@gmail.com`
   - User Name: `Ashwin T`
   - Role: `PROJECT_MANAGER` (Level: 30)
   - Capabilities: Project management, sprint lifecycle, capacity planning, and **Price Allocation**.
   - Strict Boundaries: Prohibited from accessing Security, Allowlist, Access Requests, System Credentials, Billing, Governance, or Commercial Pricing models.
3. **Normal Team Members:**
   - Example: `saikirankurapati04@gmail.com` (Google Identity (04)), `raj.mange@demostartup.com`, `shashi.zerokost@gmail.com`, etc.
   - Role: `TEAM_MEMBER` (Level: 20)
   - Capabilities: Standard delivery workflows, boards, my-work, backlog, sprints, chat, calendar, files, and project collaboration.
   - Strict Boundaries: Prohibited from viewing or accessing Admin, Security, Pricing, or Price Allocation.

---

## 2. Core Architecture & Enhancements

### A. Settings → Security → Team & Access
Located at `/settings/security` (with primary tab **Team & Access**):
- Accessible exclusively by the Administrator.
- Renders the complete organization roster including both active and deactivated members.
- Columns:
  1. **Team Member**: Full Name, Email, Avatar, and Special Role badges.
  2. **Role**: Role badge (`ADMIN`, `CTO / MANAGER`, `TEAM MEMBER`).
  3. **Status**: `ACTIVE` (green badge) vs `DEACTIVATED` (slate badge).
  4. **Google Identity**: Displays OAuth link status and immutable Google subject ID.
  5. **Project Access**: Badges showing projects the member is enrolled in.
  6. **Actions**:
     - *Change Role*: Role change modal with double-confirmation safety barriers. Demoting the sole Admin is blocked. Promoting to `ADMIN` requires typing "CONFIRM ADMIN".
     - *Projects*: Manage project membership access on a per-member basis.
     - *Deactivate / Reactivate*: One-click governed deactivation that preserves all historical work, tasks, comments, and messages.

### B. Access Request Review & Auto-Provisioning Flow
When an unallowlisted Google account authenticates:
1. Google OAuth validates the Google identity and issues profile claims (Google subject ID, display name, email, avatar).
2. TMP creates a `PENDING` `AuthAccessRequest` with client IP, user agent, attempt count, and last seen timestamp.
3. In-app notifications are dispatched **strictly** to the Administrator (`saikirankurapti@gmail.com`).
4. In **Settings → Security → Access Requests**, the Admin reviews:
   - Requester Name, Gmail, profile image, provider, attempt history, and request date.
5. On clicking **Approve Access**:
   - Option to link to an existing TMP profile OR automatically provision a new `User` profile.
   - Default role is strictly locked to `TEAM_MEMBER`.
   - Multi-select project access checkboxes allow immediately enrolling the approved user into target projects.
   - Upon confirmation, an atomic transaction upserts `OrganizationAuthAllowlist`, marks `AuthAccessRequest` as `APPROVED`, and writes an immutable `USER_APPROVED` audit log.

### C. Deactivation & Reactivation Lifecycle
- **Deactivation (`POST /api/organization/members/:id/deactivate`):**
  - Sets `user.isActive = false` and `user.status = 'OFFLINE'`.
  - Sets linked allowlist records to `status = 'SUSPENDED'` to prevent new login attempts.
  - Historical work items, sprint history, chat messages, meetings, and audit trails remain 100% preserved.
  - Sole Admin cannot be deactivated (returns 400).
- **Reactivation (`POST /api/organization/members/:id/reactivate`):**
  - Restores `user.isActive = true`.
  - Restores allowlist records to `status = 'ACTIVE'`.
  - Existing identity mappings, team memberships, and project associations remain intact with zero duplicate user records created.

---

## 3. Security Audit Trail
The platform records structured audit logs for all access and governance mutations:
- `USER_APPROVED`: Target user, email, assigned role, project IDs, reviewer ID.
- `USER_REJECTED`: Target email, rejection reason, reviewer ID.
- `ROLE_CHANGED`: Actor, target user, previous role, new role.
- `USER_DEACTIVATED`: Actor, target user, deactivated status.
- `USER_REACTIVATED`: Actor, target user, restored status.
- `PROJECT_ACCESS_GRANTED` / `PROJECT_ACCESS_REMOVED`: Project ID, target user ID, actor ID.

---

## 4. Test Verification Summary

### Automated Test Suites
1. **[teamAndAccessGovernance.test.ts](file:///c:/Users/raksh/GENQUANTAA/team-management/server/src/tests/teamAndAccessGovernance.test.ts)**:
   - 9 passed: Sole Admin invariant (`COUNT(ADMIN) === 1`), Ashwin CTO invariant, saikirankurapati04@gmail.com Team Member invariant, RBAC boundaries, email identity disambiguation, and deactivation/reactivation semantics.
2. **[autoProvisionTeamMember.test.ts](file:///c:/Users/raksh/GENQUANTAA/team-management/server/src/tests/autoProvisionTeamMember.test.ts)**:
   - 4 passed: Auto-provisioning of Team Member on allowlisted login, team/project enrollment, strict RBAC restriction, idempotency.
3. **[unauthorizedAdminAndPriceVisibility.test.ts](file:///c:/Users/raksh/GENQUANTAA/team-management/server/src/tests/unauthorizedAdminAndPriceVisibility.test.ts)**:
   - 16 passed: Comprehensive RBAC visibility matrix across Admin, CTO/Manager, and Team Member roles.
4. **[liveEndpointAccess.test.ts](file:///c:/Users/raksh/GENQUANTAA/team-management/server/src/tests/liveEndpointAccess.test.ts)**:
   - 9 passed: Live HTTP API tests against running server validating 200 vs 403 enforcement.
5. **[closedAuthAllowlist.test.ts](file:///c:/Users/raksh/GENQUANTAA/team-management/server/src/tests/closedAuthAllowlist.test.ts) & [closedTeamAuthMatrix.test.ts](file:///c:/Users/raksh/GENQUANTAA/team-management/server/src/tests/closedTeamAuthMatrix.test.ts)**:
   - 20 passed: Closed-team OAuth authentication and access request tests.

### Live API Verification Results (`scratch/verify_phase50_live.js`)
- `GET /api/organization/members?includeInactive=true`: 200 OK (Roster of 9 members returned with roles, google identities, and project memberships).
- `GET /api/security/allowlist`:
  - Sai Kiran (ADMIN): **200 OK**
  - Ashwin T (CTO/Manager): **403 Forbidden**
  - saikirankurapati04@gmail.com (Team Member): **403 Forbidden**
- `GET /api/security/access-requests`:
  - Sai Kiran (ADMIN): **200 OK**
  - Ashwin T (CTO/Manager): **403 Forbidden**
  - saikirankurapati04@gmail.com (Team Member): **403 Forbidden**
- `PUT /api/organization/members/:saiId` (Demote sole Admin): **400 Bad Request** ("Cannot demote the sole Administrator...")
- `POST /api/organization/members/:saiId/deactivate` (Deactivate sole Admin): **400 Bad Request** ("Cannot deactivate yourself")

### Client Build
- `npm run build`: built in 7.48s with zero TypeScript or Vite bundle errors.
