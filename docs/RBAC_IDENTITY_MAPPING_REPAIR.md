# PHASE 48 — RBAC DATA + IDENTITY MAPPING REPAIR REPORT

## 1. Executive Summary
The security defect where the Google identity `saikirankurapati04@gmail.com` could see Admin tabs, Security controls, and Price/Pricing functionality has been investigated, diagnosed to its root cause, and completely repaired across the database, authentication pipeline, API route guards, and UI permissions.

---

## 2. Root Cause Analysis

### A. The Identity Mismatch in the Database
When inspecting the SQLite database via [inspect_conns.js](file:///C:/Users/raksh/.gemini/antigravity-ide/brain/062b3a51-cf5b-441f-8edd-125b3626e60e/scratch/inspect_conns.js) and [check_allowlist_mappings.js](file:///C:/Users/raksh/.gemini/antigravity-ide/brain/062b3a51-cf5b-441f-8edd-125b3626e60e/scratch/check_allowlist_mappings.js), we discovered the exact origin:
1. An allowlist record `2af091ae-4bd2-49a4-b61a-5488ba002816` for `saikirankurapati04@gmail.com` had its `userId` foreign key pointing directly to Sai Kiran's User ID `467a2534-a1a3-44f7-9dad-798582eabbab` (`role: 'ADMIN'`).
2. A `GoogleConnection` record for `saikirankurapati04@gmail.com` was also created referencing Sai Kiran's User ID.
3. Because Google OAuth validates identity and then loads the mapped `userId` (`user.role = 'ADMIN'`), logging in with `saikirankurapati04@gmail.com` issued a JWT with `role: 'ADMIN'` and returned `user.role: 'ADMIN'` from `/auth/me`.
4. As a result, the client and backend evaluated this identity as the Administrator.

---

## 3. Immediate Database Repair Executed

The script [repair_identities_phase48.js](file:///C:/Users/raksh/.gemini/antigravity-ide/brain/062b3a51-cf5b-441f-8edd-125b3626e60e/scratch/repair_identities_phase48.js) performed:
1. **Unlinked `saikirankurapati04@gmail.com` from Sai Kiran (`ADMIN`)**:
   - Cleared `userId` on the allowlist entry so it does **not** map to Sai Kiran.
   - Deleted the erroneous `GoogleConnection` linking `saikirankurapati04@gmail.com` to Sai Kiran.
2. **Strict Identity Isolation**:
   - `saikirankurapti@gmail.com` -> Sole identity mapped to Sai Kiran (`ADMIN`).
   - `ashwin.zerokost@gmail.com` -> Sole identity mapped to Ashwin T (`PROJECT_MANAGER`: CTO / Manager).
   - `saikirankurapati04@gmail.com` -> Disassociated from Admin/CTO/Manager; behaves as standard unmapped/team-member identity.
3. **Session Invalidation**:
   - Invalidated all active sessions to ensure any stale JWT token held in browsers is discarded on next request.

---

## 4. Architectural Defenses & Hardening

### A. Access Request Approval Hardening ([AuthAllowlistManager.tsx](file:///c:/Users/raksh/GENQUANTAA/team-management/client/src/components/security/AuthAllowlistManager.tsx))
- Modified the access approval modal to require selecting a concrete team member profile before approving, preventing accidental unmapped or admin mappings.

### B. Route Protection Hardening ([server/src/routes/index.ts](file:///c:/Users/raksh/GENQUANTAA/team-management/server/src/routes/index.ts))
- Protected `GET /projects/:id/resources` and `GET /projects/:id/price-allocation` with `requireRole('PROJECT_MANAGER')` (403 for team members and unauthorized accounts).
- Aliased explicit admin endpoints (`/access-requests`, `/auth/allowlist`, `/credentials`) with `requireRole('ADMIN')`.
- Maintained strict `requireRole('ADMIN')` on `/projects/:id/pricing`, `/rate-cards`, `/projects/:id/scenarios*`, and `/projects/:id/variance`.

### C. Fail-Closed Authorization Verification ([rbac.ts](file:///c:/Users/raksh/GENQUANTAA/team-management/client/src/utils/rbac.ts))
- Every permission helper (`canAccessAdmin`, `canAccessManagement`, `canAccessPriceAllocation`, `canAccessRestrictedManagement`) is strictly fail-closed: missing/null roles return `false`.

---

## 5. Authoritative Final Matrix

| Identity / Gmail | Mapped User | Effective Role | Admin Area | Security & Access | Commercial Pricing | Price Allocation |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **`saikirankurapti@gmail.com`** | **Sai Kiran** | **ADMIN** | **YES** | **YES** | **YES** | **YES** |
| **`ashwin.zerokost@gmail.com`** | **Ashwin T** | **CTO + MANAGER** | **NO** | **NO** | **NO** | **YES** |
| **`saikirankurapati04@gmail.com`** | **Unlinked / Member** | **TEAM_MEMBER** | **NO (403)** | **NO (403)** | **NO (403)** | **NO (403)** |
| **All Other Team Members** | **Directory Users** | **TEAM_MEMBER** | **NO (403)** | **NO (403)** | **NO (403)** | **NO (403)** |

---

## 6. Verification Results

### Automated Regression Test Suite (48 / 48 Tests Passed)
1. **[unauthorizedAdminAndPriceVisibility.test.ts](file:///c:/Users/raksh/GENQUANTAA/team-management/server/src/tests/unauthorizedAdminAndPriceVisibility.test.ts)**: 16 passed.
   - Confirms `saikirankurapati04@gmail.com` has `ADMIN = false`, `CTO = false`, `MANAGER = false`, `Price Allocation = false`.
   - Confirms fail-closed behavior for null/undefined roles.
2. **[databaseIdentityMapping.test.ts](file:///c:/Users/raksh/GENQUANTAA/team-management/server/src/tests/databaseIdentityMapping.test.ts)**: 8 passed.
   - Confirms single ADMIN in DB (`Sai Kiran`).
   - Confirms `saikirankurapati04@gmail.com` is completely unlinked from Sai Kiran.
3. **[liveEndpointAccess.test.ts](file:///c:/Users/raksh/GENQUANTAA/team-management/server/src/tests/liveEndpointAccess.test.ts)**: 9 passed.
   - Tests live HTTP server endpoints against all 3 identities.
   - `saikirankurapati04@gmail.com` receives **403 Forbidden** on `/security/allowlist`, `/pricing`, and `/price-allocation`.
   - `ashwin.zerokost@gmail.com` receives **403 Forbidden** on Admin/Pricing and **200 OK** on Price Allocation.
   - `saikirankurapti@gmail.com` receives **200 OK** on all endpoints.
4. **[exactRoleAccessPolicy.test.ts](file:///c:/Users/raksh/GENQUANTAA/team-management/server/src/tests/exactRoleAccessPolicy.test.ts)**: 15 passed.

### Production Client Build
- `npm run build` executed in `client/` and completed in **24.15s** with **0 TypeScript or Vite errors**.
