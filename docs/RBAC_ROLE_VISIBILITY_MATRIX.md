# Phase 45 — Strict Role-Based UI Visibility & Access Control Matrix

## Overview
This document records the definitive authorization architecture, role hierarchy, navigation visibility policies, project-tab visibility matrices, API route protection rules, and verification test results for TMP.

Administrative, financial, governance, security, pricing, and resource management operations are restricted strictly to authorized management tiers. Regular team members (`TEAM_MEMBER`, `VIEWER`) only see everyday execution surfaces, and sensitive direct API requests return `403 Forbidden`.

---

## 1. Role Model Hierarchy & Weight Assignment

| Role | Weight | Target Personas | Scope & Capabilities |
| :--- | :---: | :--- | :--- |
| **`OWNER`** | 50 | Organization Founders, Platform Owners | Full root access. Organization deletion, billing ownership, tenant configuration. |
| **`ADMIN`** | 40 | Sai Kiran, Technical Administrators | Full administration: Security Center, Closed-Team Allowlists, Access Requests, System Credentials, Governance, Integrations secrets, Ops Dashboard, Billing, User Deactivation. |
| **`PROJECT_MANAGER`** | 30 | Engineering Managers, Leads, CTO tier | Management & commercial tier: Project planning, Timeline/Gantt (CPM), Software Estimation (PERT), WBS, Resource Allocation, Capacity Planning, Commercial Pricing, Rate Cards, Scenarios, Planned vs Actual, Executive Analytics, Portfolio Intelligence. Cannot modify security allowlists or delete system credentials. |
| **`TEAM_MEMBER`** | 20 | Raj Mange, Ammar Raza, Navya Sri, Shashi | Core work execution: Home, My Work, Projects (Board, Backlog, Sprints, Dev Hub, Chat), Calendar, Files, Knowledge Hub, personal workload/capacity, notifications, profile. Zero access to Admin, Security, Governance, Billing, or Commercial Pricing. |
| **`VIEWER`** | 10 | External Stakeholders, Guests | Read-only access to assigned projects and tasks. |

---

## 2. Navigation Visibility Policy

No disabled locks or "teaser" links (e.g. `Security 🔒`) are displayed to regular users. Items are conditionally omitted based on authoritative permissions:

### Sidebar Navigation (`client/src/components/layout/Sidebar.tsx`)
- **`ADMIN` & `OWNER`:**
  - `WORKSPACE`: Home, My Work, Projects, Teams
  - `DELIVERY`: Backlog, Board, Sprints, Capacity
  - `COLLABORATION`: Chat, Calendar, Files, Knowledge
  - `ENGINEERING`: GitHub & Integrations, Developer Apps
  - `INTELLIGENCE`: Analytics, Governance, Ops Dashboard
  - `ADMINISTRATION`: Security & Access, Billing & Plans, AI Configuration, Settings
- **`PROJECT_MANAGER`:**
  - `WORKSPACE`: Home, My Work, Projects, Teams
  - `DELIVERY`: Backlog, Board, Sprints, Capacity
  - `COLLABORATION`: Chat, Calendar, Files, Knowledge
  - `ENGINEERING`: GitHub & Integrations
  - `INTELLIGENCE`: Analytics
  - `SETTINGS`: Settings (personal profile & workspace context)
- **`TEAM_MEMBER` / `VIEWER`:**
  - `WORKSPACE`: Home, My Work, Projects, Teams
  - `DELIVERY`: Backlog, Board, Sprints
  - `COLLABORATION`: Chat, Calendar, Files, Knowledge
  - `ENGINEERING`: GitHub & Integrations
  - `INTELLIGENCE`: Analytics
  - `SETTINGS`: Settings (personal profile & preferences only)

---

## 3. Project Tab Visibility Matrix (`client/src/pages/ProjectDetailPage.tsx`)

| Project Tab | `ADMIN` / `OWNER` | `PROJECT_MANAGER` | `TEAM_MEMBER` / `VIEWER` |
| :--- | :---: | :---: | :---: |
| **Overview** | ✓ | ✓ | ✓ *(financial cards omitted)* |
| **Board** | ✓ | ✓ | ✓ |
| **Backlog** | ✓ | ✓ | ✓ |
| **Sprints** | ✓ | ✓ | ✓ |
| **Development Hub** | ✓ | ✓ | ✓ |
| **Timeline / Gantt (CPM)** | ✓ | ✓ | — *(hidden & guarded)* |
| **Software Estimation (PERT)**| ✓ | ✓ | — *(hidden & guarded)* |
| **WBS Tree** | ✓ | ✓ | — *(hidden & guarded)* |
| **Resource Allocation** | ✓ | ✓ | — *(hidden & guarded)* |
| **Commercial Pricing** | ✓ | ✓ | — *(hidden & guarded)* |
| **Scenarios Modeling** | ✓ | ✓ | — *(hidden & guarded)* |
| **Planned vs Actual Variance**| ✓ | ✓ | — *(hidden & guarded)* |

---

## 4. Settings Sub-Navigation (`client/src/pages/SettingsPage.tsx`)

| Settings Section | `ADMIN` / `OWNER` | `PROJECT_MANAGER` | `TEAM_MEMBER` |
| :--- | :---: | :---: | :---: |
| **User Profile Parameters** | ✓ | ✓ | ✓ |
| **Organization & Isolation**| ✓ | ✓ | ✓ |
| **Security & Access** | ✓ | — *(hidden & 403)* | — *(hidden & 403)* |
| **Billing & Subscriptions** | ✓ | — *(hidden & 403)* | — *(hidden & 403)* |
| **AI Configuration** | ✓ | — *(hidden & 403)* | — *(hidden & 403)* |
| **Developer Apps** | ✓ | — *(hidden & 403)* | — *(hidden & 403)* |
| **Integrations & Webhooks** | ✓ | — *(hidden & 403)* | — *(hidden & 403)* |
| **Ops Dashboard** | ✓ | — *(hidden & 403)* | — *(hidden & 403)* |

---

## 5. API Route Protection & Authorization (`server/src/routes/index.ts`)

| Endpoint | Method | Required Min Role | Unauthorized Status |
| :--- | :---: | :---: | :---: |
| `/api/security/allowlist` | GET, POST, PATCH, DELETE | `ADMIN` | `403 Forbidden` |
| `/api/security/access-requests` | GET, POST | `ADMIN` | `403 Forbidden` |
| `/api/admin/auth-allowlist` | GET, POST, PATCH, DELETE | `ADMIN` | `403 Forbidden` |
| `/api/v1/billing` | GET, POST | `ADMIN` | `403 Forbidden` |
| `/api/v1/keys` | GET, POST, DELETE | `ADMIN` | `403 Forbidden` |
| `/api/v1/webhooks` | GET, POST, DELETE | `ADMIN` | `403 Forbidden` |
| `/api/v1/oauth/apps` | GET, POST | `ADMIN` | `403 Forbidden` |
| `/api/v1/governance/policies` | GET, POST | `ADMIN` | `403 Forbidden` |
| `/api/v1/governance/health` | GET | `ADMIN` | `403 Forbidden` |
| `/api/v1/ops/metrics` | GET | `ADMIN` | `403 Forbidden` |
| `/api/v1/ops/jobs/enqueue` | POST | `ADMIN` | `403 Forbidden` |
| `/api/integrations/github/config` | GET, POST, DELETE | `ADMIN` | `403 Forbidden` |
| `/api/integrations/google/config` | GET, POST, DELETE | `ADMIN` | `403 Forbidden` |
| `/api/copilot/settings` | GET | `ADMIN` | `403 Forbidden` |
| `/api/copilot/logs` | GET | `ADMIN` | `403 Forbidden` |
| `/api/organization/members/:id/deactivate` | POST | `ADMIN` | `403 Forbidden` |
| `/api/analytics/executive` | GET | `PROJECT_MANAGER` | `403 Forbidden` |
| `/api/v1/executive/reports` | GET | `PROJECT_MANAGER` | `403 Forbidden` |
| `/api/analytics/portfolio` | GET | `PROJECT_MANAGER` | `403 Forbidden` |
| `/api/v1/portfolio/intelligence` | GET | `PROJECT_MANAGER` | `403 Forbidden` |
| `/api/capacity` | GET | `PROJECT_MANAGER` | `403 Forbidden` |
| `/api/projects/:id/pricing` | GET, PUT | `PROJECT_MANAGER` | `403 Forbidden` |
| `/api/rate-cards` | GET, POST | `PROJECT_MANAGER` | `403 Forbidden` |
| `/api/projects/:id/scenarios` | GET, POST | `PROJECT_MANAGER` | `403 Forbidden` |
| `/api/projects/:id/resources/allocate` | POST | `PROJECT_MANAGER` | `403 Forbidden` |
| `/api/resource-allocations/:id` | DELETE | `PROJECT_MANAGER` | `403 Forbidden` |

---

## 6. Financial Data Masking in Tables
In `ResourceAllocationView.tsx`:
- Team members can view assigned resource members, roles, skills, and total percentage/hours.
- `costRate` is masked to `null` on the server for non-PM roles.
- `billingRate`, cost sum metrics, and allocation action buttons (`+ Allocate`, delete) are rendered strictly when `canSeeCost` is true (`PROJECT_MANAGER` or higher).

---

## 7. AI Copilot Authorization (`server/src/services/aiGateway.ts`)
- Prompts attempting to query system security, credentials, allowlist, access requests, or audit logs verify `userWeight >= ADMIN (40)`. If unauthorized, an immediate permission denial response is returned without tool execution.
- Prompts attempting to query commercial pricing, rate cards, cost rates, or margin forecasts verify `userWeight >= PROJECT_MANAGER (30)`.

---

## 8. Automated Verification Results

### Vitest Test Suites
1. **`src/tests/rbacAccessControl.test.ts`**:
   - **25 / 25 Passed**
   - Verified 403 Forbidden responses on all protected administrative and commercial endpoints for `TEAM_MEMBER`.
   - Verified 200 OK responses on all endpoints for `ADMIN`.
   - Verified data masking of `costRate` for normal team members.
2. **`src/tests/closedTeamGoogleAuthWorkflow.test.ts`**:
   - **13 / 13 Passed**
   - Verified closed-team Google authentication workflow, access requests, security event logging, and notification routing.
3. **Frontend Production Build**:
   - `tsc && vite build`: Succeeded with **0 errors**.
