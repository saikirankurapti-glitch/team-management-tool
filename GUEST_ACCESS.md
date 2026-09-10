# Guest User Role & External Collaborator Access Controls

## 1. Guest Access Restrictions (`GUEST` Role)
Users assigned the `GUEST` RBAC role are restricted to specifically assigned projects and work items.
- **Denied Operations**: Organization analytics, admin settings, security center, API key creation, and unassigned project backlogs are strictly rejected with HTTP 403 Forbidden.
