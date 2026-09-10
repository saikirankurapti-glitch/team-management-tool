# Incident Response & Escalation Framework

## Incident Severity Levels
- **P1 (Critical Outage)**: System unready (`/health/ready` 503) or database connection lost.
- **P2 (Degraded Performance)**: Job queue backlog or high API latency.
- **P3 (Minor Issue)**: Non-critical integration or external webhook retry.
