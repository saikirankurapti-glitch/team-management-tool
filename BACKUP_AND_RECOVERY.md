# Data Backup & Disaster Recovery Standard Operating Procedure

## 1. Database Backup Strategy
- **SQLite Dev Database (`dev.db`)**: Automated daily snapshot copy stored in `backups/sqlite/db_backup_YYYY-MM-DD.db`.
- **Production PostgreSQL Database**:
  - Daily automated `pg_dump` snapshot: `pg_dump -U postgres -d team_management -F c -b -v -f /backups/pg/db_$(date +%F).dump`
  - Point-In-Time Recovery (PITR) WAL archiving configured with 30-day retention.

## 2. File Attachments Storage Backup Strategy
- Local directory `uploads/` backed up via daily rsync / AWS S3 Sync:
  `aws s3 sync uploads/ s3://startup-team-backups/uploads/ --delete`

## 3. Disaster Recovery Testing & SLA Targets
- **Recovery Point Objective (RPO)**: < 1 Hour (maximum acceptable data loss window).
- **Recovery Time Objective (RTO)**: < 15 Minutes (maximum acceptable system outage window).
- **Restoration Verification Test Procedure**:
  1. Restore database snapshot to temporary database instance `restore_test_db`.
  2. Run `npx prisma db push --preview` to verify schema compatibility.
  3. Run backend test suite (`npm test`) against restored data.
