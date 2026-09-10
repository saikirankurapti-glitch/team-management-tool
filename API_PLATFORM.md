# External API Platform Specifications (`/api/v1`)

## 1. Versioned REST API Architecture
All external APIs are versioned under `/api/v1/` with key prefix verification, SHA-256 secret hashing, and granular scopes:

| Scope | Description |
|---|---|
| `projects:read` | Read access to project portfolio |
| `projects:write` | Create & modify projects |
| `work_items:read` | Read work items & tasks |
| `work_items:write` | Create & update work items |
| `analytics:read` | Read team velocity & flow metrics |
