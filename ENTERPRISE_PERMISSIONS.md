# Enterprise Permission Matrix & RBAC Scoping

## Permission Hierarchy
Organization ➔ Team ➔ Project ➔ Workflow ➔ Work Item.

## Role matrix
- `ADMIN` / `OWNER`: Full configuration rights for workflows, custom fields, and governance policies.
- `PROJECT_MANAGER`: Assigns project workflows and configures project-specific required fields.
- `DEVELOPER` / `MEMBER`: Executes allowed transitions and submits custom field values.
