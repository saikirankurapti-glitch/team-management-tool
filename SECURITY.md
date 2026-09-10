# Security Architecture & Permission Control Policies

## 1. Server-Side Workflow Authorization (`workflowEngine.ts`)
Transition execution (`POST /api/v1/work-items/:id/transition`) validates user role permissions (`allowedRoles`) server-side. Client-side UI restrictions alone are never trusted.

## 2. Organization Policy Enforcement (`OrganizationPolicy`)
Configurable policies restrict security settings, approval requirements, and AI Copilot action permissions across tenant boundaries.

## 3. Configuration Change Auditing & Health Checks
Every administrative policy or workflow edit creates an immutable `ConfigurationVersion` record and `AuditLog` entry, and can be validated using the Configuration Health Checker (`GET /api/v1/governance/health`).
