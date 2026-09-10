# Backup & Disaster Recovery Standard Operating Procedures

## Recovery Targets
- **Recovery Point Objective (RPO)**: < 1 Hour.
- **Recovery Time Objective (RTO)**: < 2 Hours.
- **Backup Verification Drill**: Periodic automated backup restoration drill restoring `dev.db` or PostgreSQL dump and verifying schema integrity & test suite execution.
