# Generic Approval Framework Specifications (`ApprovalRequest`)

## 1. Approval Request Lifecycle (`POST /api/v1/approvals`)
Supports approval requests for work item transitions, production releases, and policy changes with `PENDING`, `APPROVED`, or `REJECTED` states.

## 2. Decision Logging & Comments (`POST /api/v1/approvals/:id/respond`)
Captures approver identity (`approverId`), timestamp (`updatedAt`), and mandatory decision comments.
