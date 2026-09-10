# System Architecture & Technical Specifications

## 1. Overview & Technology Stack
- **Frontend & Operational Dashboard**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts, React Router v6. Operational Excellence Dashboard (`OpsDashboardPage.tsx`), Enterprise Governance Center (`GovernancePage.tsx`), Progressive Web App (PWA) with Web App Manifest (`manifest.json`), Service Worker (`sw.js`), Mobile Navigation (`MobileBottomNav.tsx`), and Client-side Offline Mutation Queue (`OfflineSyncManager.ts`).
- **Backend Service**: Node.js, Express, TypeScript, Socket.io for real-time WebSocket events. Includes `tenantContextMiddleware` with correlation ID injection.
- **Reliability & Operational Telemetry Services**: Background Job Queue Engine (`JobQueueManager.ts`), AI Gateway Circuit Breaker (`AiCircuitBreaker.ts`), Structured System Metrics Registry (`MetricsRegistry.ts`), Liveness/Readiness/Dependency Health controller (`healthController.ts`), and Operational Telemetry controller (`opsController.ts`).
- **Enterprise Workflow Engine & Policy Services**: Configurable Workflow Engine (`workflowEngine.ts`), Custom Fields Framework (`customFieldController.ts`), Generic Approval Framework (`approvalController.ts`), and Governance Policy & Configuration Health Checker (`governanceController.ts`).
- **Mobile Push & Session Security Controllers**: PWA Web Push subscriptions & test notifications (`pushNotificationController.ts`), Active Session management (`UserSession`), and Idempotent Offline Mutation Sync (`offlineSyncController.ts`).
- **Knowledge & Collaboration Workspace Services**: Knowledge Hub wiki controller (`knowledgeController.ts`), Architectural Decision Log controller (`decisionController.ts`), Meetings Workspace & Action Item engine (`meetingController.ts`), Project Updates controller (`projectUpdateController.ts`), and Grounded AI Collaboration Search (`collaborationSearchController.ts`).
- **Product Templates & Extensibility Engine**: Project Template gallery & instantiation (`templateController.ts`), Developer OAuth applications & Webhook Test simulator (`developerPlatformController.ts`), and Product Feedback & Activation Telemetry (`feedbackController.ts`).
- **Commercial SaaS Engine**: Public signup controller (`saasOnboardingController.ts`), 14-day trial initialization, Billing & Metering controller (`billingController.ts`), Support controller (`supportController.ts`), and `EntitlementEngine`.
- **Enterprise v1 API & Webhook Dispatcher**: Versioned `/api/v1` REST routes, API key authentication (`ApiKey`), HMAC-SHA256 customer webhooks (`WebhookEndpoint`), and Entitlement Engine (`Subscription`).
- **AI Copilot Gateway**: Permission-Grounded AI Gateway + Controlled Tool Registry (`aiToolRegistry.ts`) + Circuit Breaker + Human Confirmation Gate + Audit Logger (`AiAuditLog`).
- **ORM & Database Engine**: Prisma ORM v5 with SQLite (`dev.db`) locally and PostgreSQL support in production.
- **Testing Engine**: Vitest + Supertest integration test suite (90 tests across 17 test files).

---

## 2. Component Diagram

```text
       Enterprise, Operational & Mobile Users        Health Probes & Webhook Replays
                         │                                         │
                         ▼                                         ▼
         React 18 PWA & Ops Dashboard              Liveness / Readiness / Health Probes
                         │                                         │
                         └───────────────────┬─────────────────────┘
                                             │
                                    Express API Router
                                             │
    ┌────────────────────────────────────────┼────────────────────────────────────────┐
    ▼                                        ▼                                        ▼
Operational Telemetry & Reliability      Enterprise Governance & Workflows        DevOps & Chat Services
- Metrics Registry & Latency Tracking    - Configurable Workflows & Statuses      - Work Items & Boards
- Job Queue Engine & Dead-Letter Queue   - Server Transition Engine               - Sprints & Capacity
- AI Circuit Breaker Fault Isolation     - Custom Fields & Work Item Types        - Chat & WebSockets
- Webhook Replay & Idempotency           - Generic Approvals & Policies           - AI Copilot Gateway
    │                                        │                                        │
    └────────────────────────────────────────┼────────────────────────────────────────┘
                                             │
                                        Prisma ORM
                                             │
                                     PostgreSQL / SQLite
```
