# TMP Management Intelligence Copilot

A secure, RBAC-aware, organization-isolated AI assistant powered exclusively by **Google Gemini**.
It provides real-time management intelligence by querying actual TMP database data — never fabricating.

---

## Architecture

```
User Query (Frontend)
       │
       ▼
POST /api/copilot/stream  (JWT-authenticated)
       │
       ▼
copilotController.ts
  - Validates auth (organizationId, userId from JWT)
  - Validates RBAC role
  - Constructs ToolContext (organizationId, userId, userRole)
       │
       ▼
aiGateway.ts  (processCopilotQueryStream)
  - Loads conversation history from AIConversation/AIMessage
  - Sends prompt to Google Gemini (gemini-2.0-flash)
  - Gemini returns FunctionCall(s) using GEMINI_TOOLS
       │
       ▼
aiToolRegistry.ts
  - Executes the requested tool(s) with ToolContext
  - Every query filters by ctx.organizationId
  - RBAC-sensitive tools check ctx.userRole
  - Returns structured JSON (no raw SQL, no arbitrary access)
       │
       ▼
aiGateway.ts
  - Sends tool result back to Gemini (second turn)
  - Gemini generates final natural-language response
  - Streams chunks via SSE to frontend
       │
       ▼
AiCopilotDrawer.tsx  (Frontend)
  - Reads SSE stream
  - Renders markdown (including tables)
  - Shows animated tool status banner
  - Persists conversationId for follow-up context
```

**Key principle:** Gemini never touches Prisma or SQL. It only calls structured tools with validated parameters.

---

## Configuration

Set these in `server/.env`:

```env
AI_PROVIDER=gemini
AI_MODEL=gemini-2.0-flash
GEMINI_API_KEY=your_actual_gemini_api_key
```

> **Never use `gemini-1.5-pro` or `gemini-1.5-flash`** — these models are deprecated and return 404.  
> The current SDK (`@google/generative-ai@0.24.1`) works with `gemini-2.0-flash`.

### Supported Models (as of SDK 0.24.1)
| Model | Notes |
|-------|-------|
| `gemini-2.0-flash` | ✅ Recommended — fast, supports function calling |
| `gemini-1.5-pro` | ❌ Deprecated — returns 404 |
| `gemini-1.5-flash` | ❌ Deprecated — returns 404 |

---

## Management Capabilities

### Team Intelligence
| Question | Tools Used |
|----------|-----------|
| Who has the highest workload? | `getTeamWorkload` |
| Who is overloaded? | `getTeamWorkload` |
| Who has available capacity? | `getTeamAvailability` |
| Who is sitting idle? | `getTeamAvailability` |
| How many people are on the team? | `getTeamMembers` |
| What is Raj working on? | `getMemberAssignments` |
| What projects is Sarah on? | `getMemberProjects` |
| What overdue work does John have? | `getMemberOverdueWork` |
| Is anyone blocked? | `getMemberBlockedWork` |

### Project Intelligence
| Question | Tools Used |
|----------|-----------|
| How many active projects? | `getProjectSummary` |
| Which projects are at risk? | `getProjectSummary` |
| Tell me everything about X project | `getProjectDetails` |
| Who is working on X? | `getProjectMembers` |
| What are the milestones? | `getProjectMilestones` |
| What are the risks? | `getProjectRisks` |
| What dependencies exist? | `getProjectDependencies` |
| What is the timeline? | `getProjectTimeline` |
| What is the budget? | `getProjectPricing` (RBAC gated) |
| What documentation exists? | `getProjectDocumentation` |
| What PRs are open? | `getProjectPullRequests` |

### Work Item Intelligence
| Question | Tools Used |
|----------|-----------|
| How many open tasks? | `getWorkItems` |
| How many bugs? | `getBugs` |
| What is blocked? | `getBlockedItems` |
| What is overdue? | `getOverdueItems` |
| What work is Raj doing? | `getWorkItemsByAssignee` |
| What items are in X project? | `getWorkItemsByProject` |

### Sprint Intelligence
| Question | Tools Used |
|----------|-----------|
| How is the current sprint going? | `getCurrentSprint` |
| What is our velocity? | `getSprintVelocity` |
| What carried over? | `getSprintCarryOver` |
| What is the capacity? | `getSprintCapacity` |

### Management Summary
| Question | Tools Used |
|----------|-----------|
| Give me a management summary | `getManagementSummary` |
| What should I be concerned about? | `getManagementSummary` + `getProjectSummary` |

### Documentation
| Question | Tools Used |
|----------|-----------|
| Search for X in docs | `searchKnowledgePages` |
| What docs exist for X project? | `listProjectDocuments` |

---

## AI Tool Registry

All tools are in `server/src/services/aiToolRegistry.ts`.

### Tool Security Contract
1. **Org Isolation:** Every tool receives `ctx.organizationId` from the authenticated JWT and applies it as a Prisma `where` clause. Gemini cannot override this.
2. **RBAC:** Tools with sensitive data check `ctx.userRole` against required minimum role weight.
3. **No SQL:** All tools use Prisma typed queries. Gemini passes structured JSON parameters only.
4. **Read-Only:** No tool modifies TMP data.

### RBAC Matrix
| Tool | Minimum Role |
|------|-------------|
| `getTeamMembers` | VIEWER |
| `getTeamWorkload` | VIEWER |
| `getProjectSummary` | VIEWER |
| `getProjectDetails` | VIEWER |
| `getProjectResourceAllocation` | PROJECT_MANAGER |
| `getProjectPricing` | PROJECT_MANAGER |
| Security/credential queries | ADMIN (prompt-level gate) |

---

## Organization Isolation

The `ToolContext` is constructed **exclusively from the authenticated JWT** in `copilotController.ts`:

```typescript
{ userId, organizationId: orgId, userRole: req.user?.role }
```

Gemini receives **no organization context in the prompt**. It cannot request data for another organization. Every Prisma query enforces `organizationId = ctx.organizationId`.

---

## Conversation Context

Conversation history is persisted in `AIConversation` and `AIMessage` models.

- Up to **20 past messages** are loaded into Gemini's `history` for follow-up context.
- When a user says "What is he working on?" after asking about a specific person, Gemini resolves the pronoun from conversation history.
- Each conversation is scoped to `(organizationId, userId)` — users cannot access other users' conversations.

---

## Data Accuracy Rules

The system prompt enforces these rules on Gemini:

1. **Never invent data** — if a query returns empty, respond: _"I don't have that information in TMP."_
2. **State what's missing** — if data is partial, explicitly say what's absent.
3. **Always use tools** — never answer management data questions from training knowledge.
4. **Cite sources** — indicate which TMP data was used (e.g., "Source: TMP Resource Allocation").

---

## Workload Calculations

| Metric | Formula |
|--------|---------|
| Allocated Hours | Sum of `estimatedHours` on active work items (default 4h if unset) |
| Utilization % | `(allocatedHours / 40) × 100` (40h weekly capacity) |
| Status | >100% = OVERLOADED, <20% = UNDERUTILIZED, else HEALTHY |
| Sprint Completion % | `(doneItems / totalItems) × 100` |
| Sprint Points % | `(completedPoints / totalPoints) × 100` |

---

## Streaming Architecture

1. Frontend sends `POST /api/copilot/stream`
2. Backend sets `Content-Type: text/event-stream`
3. Events emitted:
   - `{ type: 'status', content: 'Checking team workload...' }` — tool executing
   - `{ type: 'text', content: '...' }` — Gemini response chunks
   - `{ type: 'sources', content: {...} }` — raw tool result data
   - `{ type: 'done', conversationId: '...' }` — stream complete
   - `{ type: 'error', message: '...' }` — error occurred

---

## Local Setup

```bash
# 1. Set up environment
cp server/.env.example server/.env
# Edit server/.env — add your GEMINI_API_KEY, set AI_MODEL=gemini-2.0-flash

# 2. Start backend
cd server && npm run dev

# 3. Start frontend
cd client && npm run dev

# 4. Open http://localhost:5173
# 5. Log in → click the Sparkles icon (top-right) to open Copilot
```

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| "Gemini model not found" | Wrong model in `AI_MODEL` | Use `gemini-2.0-flash` |
| "API key not valid" | Wrong/expired `GEMINI_API_KEY` | Get a new key from Google AI Studio |
| Copilot returns empty | DB has no data for that org | Check seed data / dev database |
| Tool returns RBAC error | User role too low | Expected — the tool enforces access control |
| SSE not streaming | Proxy buffering SSE | Ensure `Connection: keep-alive`, `Cache-Control: no-cache` |
| "I don't have that information" | No data in DB | Honest empty state — not a bug |

---

## Files

| File | Purpose |
|------|---------|
| `server/src/services/aiGateway.ts` | Core streaming engine, Gemini client, tool execution loop |
| `server/src/services/aiToolRegistry.ts` | All 30+ tool implementations with RBAC + org isolation |
| `server/src/services/aiToolDefinitions.ts` | Gemini FunctionDeclarations + UI status labels |
| `server/src/controllers/copilotController.ts` | Express handlers, auth, conversation CRUD |
| `server/src/routes/index.ts` | Route registrations |
| `client/src/components/copilot/AiCopilotDrawer.tsx` | Full UI with streaming, markdown, tables |
