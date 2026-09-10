# Customer Support System Specifications (`CustomerSupportTicket`)

## 1. Ticket Management Architecture
Allows organization users to submit technical, billing, security, account, or feature request tickets (`POST /api/v1/support`).
- **Ticket Categories**: `TECHNICAL`, `BILLING`, `SECURITY`, `ACCOUNT`, `FEATURE_REQUEST`.
- **Status Lifecycle**: `OPEN` ➔ `IN_PROGRESS` ➔ `RESOLVED`.
