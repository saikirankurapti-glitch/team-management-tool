# Release Engineering & Pipeline Process

## 1. Versioning Strategy
The platform follows Semantic Versioning (`MAJOR.MINOR.PATCH`):
- `v1.0.0-pilot`: Initial 6-member startup pilot release.
- `v1.1.0`: Minor feature additions or workflow enhancements.
- `v1.0.1`: Hotfixes or patch releases.

---

## 2. Release Candidate Gating Requirements
Before tag approval or deployment, all 4 checks must pass:
1. **Automated Test Gate**: All Vitest integration test suites must pass (`npm test` in `server/`).
2. **Build Gate**: Client Vite production compilation must succeed with zero TypeScript or Vite errors (`npm run build` in `client/`).
3. **Database Migration Sync**: Prisma schema must be in sync (`npx prisma db push --skip-generate`).
4. **Security Audit**: No committed secrets, environment variable validation passed.

---

## 3. Rollback Procedure
If a production release exhibits critical regressions:
1. Roll back backend binary/container to previous release tag `v1.0.0-pilot`.
2. Execute down-migration script if schema alterations occurred.
3. Verify `/ready` endpoint database connection status.
