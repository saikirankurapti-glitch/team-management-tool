# Centralized Entitlement Engine Specifications

## 1. Resource Limit Checks (`entitlementEngine.ts`)
The `EntitlementEngine` enforces centralized plan limits for:
- Member Seats (`MEMBERS`)
- Active Projects (`PROJECTS`)
- Monthly AI Copilot Usage (`AI_USAGE`)

```typescript
// Centralized pre-action check
await checkEntitlement(organizationId, 'MEMBERS');
```
