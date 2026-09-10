# Operational Runbooks & Standard Procedures

## Runbook Directory
1. **Database Outage Recovery**: Restart database process and verify readiness (`/health/ready`).
2. **Job Queue Backlog Resolution**: Inspect dead-letter jobs and execute queue recovery (`/api/v1/ops/jobs/enqueue`).
3. **Webhook Replay Procedure**: Trigger safe event replay (`/api/v1/ops/webhooks/replay`).
