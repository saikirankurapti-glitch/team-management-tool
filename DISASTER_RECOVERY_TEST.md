# Disaster Recovery & Restore Test Specifications

## Recovery Point (RPO) & Time (RTO)
- **RPO Target**: < 5 minutes.
- **RTO Target**: < 15 minutes.
- **Restore Validation**: Database schema recovery verified using `npx prisma db push` and `npx vitest run`.
