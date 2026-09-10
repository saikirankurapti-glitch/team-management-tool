# AI Data Privacy & Data Minimization Standard

## 1. Minimal Payload Policy
Only records explicitly required to satisfy a query are sent to the AI processing layer. User passwords, OAuth tokens, and system secrets are strictly excluded from AI context.

## 2. Retention & Audit Controls
AI audit logs (`AiAuditLog` database model) record execution metadata (prompt, tool invoked, duration, status) while respecting organization retention policies.
