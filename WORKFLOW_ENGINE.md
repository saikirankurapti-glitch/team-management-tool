# Configurable Workflow Engine Specifications (`workflowEngine.ts`)

## 1. Custom Workflows & Transitions (`Workflow` & `WorkflowTransition`)
Allows administrators to define custom status names, categories (`BACKLOG`, `UNSTARTED`, `IN_PROGRESS`, `COMPLETED`, `ARCHIVED`), display ordering, and WIP limits.

## 2. Server-Side Transition Validation (`POST /api/v1/work-items/:id/transition`)
- **Role Permissions (`allowedRoles`)**: Restricts status changes (e.g., `IN_DEVELOPMENT -> QA_VERIFICATION`) to specific user roles (`ADMIN`, `DEVELOPER`).
- **Required Fields (`requiredFields`)**: Enforces required field values before transition execution.
- **Audit Logging**: Every state change writes immutable records to `WorkItemStatusHistory` and `AuditLog`.
