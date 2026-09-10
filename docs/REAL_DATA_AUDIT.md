# Real Data & Integration Audit

## Overview
This document contains the repository-wide audit of all data sources, external integrations (GitHub, AI Copilot, Google Drive), fallbacks, and execution paths in the application.

## Audit Matrix

| Area | Current Source | Fake / Real Status | Required Change |
| --- | --- | --- | --- |
| **Dashboard** | DB (`/projects`, `/work-items`, `/teams/workload`) | **Partially Real** (DB populated, but no real GitHub metrics or telemetry) | Connect real GitHub PR/commit counts; eliminate hardcoded telemetry indicators. |
| **Projects** | DB (`Project`, `ProjectMember`) | **Real DB**, missing real GitHub repository links | Connect real GitHub repositories, branches, and commits to Projects. |
| **Teams** | DB (`Team`, `TeamMember`, `User`) | **Real DB** | Maintain strict organization scoping and real workload aggregation. |
| **Kanban** | DB (`WorkItem`, `WorkItemStatusHistory`) | **Real DB** | Link work items to real GitHub branches and PRs; trigger status updates via verified webhooks. |
| **Chat** | DB (`Channel`, `Conversation`, `Message`) | **Real DB** | Ensure online presence uses real Socket.IO connections; remove fake chat messages. |
| **GitHub Integration** | Mock POST in `IntegrationsPage.tsx`, placeholder secret in `integrationController.ts` | **FAKE / Simulated** | Replace simulated connect button with real GitHub OAuth flow; implement GitHub REST API endpoints (repos, branches, commits, PRs) and webhook signature verification (`X-Hub-Signature-256`). |
| **AI Copilot** | Keyword matching (`aiGateway.ts`), `provider: MOCK_OPENAI`, `Math.random()` IDs | **FAKE / Simulated** | Integrate real LLM Provider (OpenAI / Gemini API); implement controlled tool registry with RBAC checks, read/write confirmation, source citations, persistent conversations (`AIConversation`, `AIMessage`), and SSE streaming. |
| **Analytics** | DB (`analyticsController.ts`) | **Real DB** | Remove any remaining static chart datasets; return clear empty states ("Not enough historical data") if history is empty. |
| **Files & Storage** | Local Disk (`uploads/`) | **Local Disk / Simulated Drive** | Implement Google Drive storage provider integration with database metadata tracking (`driveFileId`, `filename`, `mimeType`, `size`, `uploadedBy`, `organizationId`); enforce organization isolation. |
| **Integration Health** | Hardcoded UI indicators | **FAKE** | Create `/api/health/integrations` endpoint that actually tests DB, Auth, GitHub, Google Drive, AI Provider, and WebSockets. |

## Discovered Mock Data & Unsafe Patterns
1. **GitHub Connection**: `IntegrationsPage.tsx` creates mock integration records with static `accessToken: 'mock_encrypted_token_123'`.
2. **AI Copilot Gateway**: `aiGateway.ts` uses keyword string matching (`if promptLower.includes('risk')`) instead of LLM function calling / tool orchestration.
3. **AI Settings**: `copilotController.ts` defaults to `provider: 'MOCK_OPENAI'` and `currentUsage: 450`.
4. **Work Item Creation in AI**: Uses `Math.random()` for humanId generation instead of strictly atomic DB sequence per project.
5. **Webhooks**: Signature verification in `webhookController.ts` falls back silently when secret is missing or not set.
6. **File Storage**: Saves to local disk without Google Drive API integration or encrypted metadata persistence.

## Production Enforcement Target
- `DEMO_MODE=false` enforced by default in server startup.
- Unsafe fallback mocks removed from production paths.
- Error contract standardized (`{ success: false, error: { code: string, message: string } }`).
