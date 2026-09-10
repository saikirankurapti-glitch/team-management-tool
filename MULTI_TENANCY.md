# Multi-Tenant Architecture & Logical Isolation Specifications

## 1. Multi-Tenant Model Overview
The platform enforces multi-tenant logical data isolation using `organizationId` schema foreign key relations on all tenant-owned models (`User`, `Project`, `WorkItem`, `Sprint`, `Channel`, `FileAttachment`, `AuditLog`, `Integration`, `AutomationRule`, `RiskObservation`, `AiAuditLog`, `ApiKey`, `WebhookEndpoint`, `Subscription`).

```text
                               Tenant Context Middleware (tenantContext.ts)
                                                │
                                                ▼
                             Server-Side Permission Validation
                                                │
       ┌────────────────────────────────────────┼────────────────────────────────────────┐
       ▼                                        ▼                                        ▼
Organization A Data Scope              Organization B Data Scope              Organization C Data Scope
- Projects (org_a)                     - Projects (org_b)                     - Projects (org_c)
- Work Items (org_a)                   - Work Items (org_b)                   - Work Items (org_c)
- Chat Channels (org_a)                - Chat Channels (org_b)                - Chat Channels (org_c)
- Files & Storage (org_a)              - Files & Storage (org_b)              - Files & Storage (org_c)
- Analytics & AI (org_a)               - Analytics & AI (org_b)               - Analytics & AI (org_c)
```

## 2. Organization Context Switcher
When a user belongs to multiple organizations, the `Organization Switcher` allows seamless context switching. Changing organizations invalidates the active workspace session and re-evaluates role-based access control (RBAC) permissions.
