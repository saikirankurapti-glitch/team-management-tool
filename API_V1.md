# REST API v1 Architecture & Pagination Standards

## 1. Stable v1 Resource Endpoints
- `/api/v1/keys`: API Key credentials.
- `/api/v1/templates`: Project templates library.
- `/api/v1/oauth/apps`: Developer OAuth applications.
- `/api/v1/webhooks`: Outbound customer webhooks.
- `/api/v1/security`: Security Center overview.
- `/api/v1/billing`: SaaS subscription metering.
- `/api/v1/support`: Customer support tickets.

## 2. Pagination & Filtering Standards
All list endpoints support standard query filters (`project`, `status`, `priority`, `limit`, `offset`).
