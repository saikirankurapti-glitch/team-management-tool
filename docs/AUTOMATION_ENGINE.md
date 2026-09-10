# PHASE 53 — TMP WORKFLOW AUTOMATION & RULES ENGINE

## EXECUTIVE SUMMARY
This document specifies the architecture, data models, event model, condition AST evaluator, action execution pipeline, reliability mechanisms (idempotency, loop detection, spam throttling), and RBAC security boundaries implemented in **Phase 53** for the Team Management Platform (TMP).

---

## 1. AUTOMATION ARCHITECTURE

The platform implements a pure event-driven architecture decoupled from direct controller mutations:

```text
Event Source
(Work Item / GitHub Webhook / Capacity Planning / Sprint / Calendar)
      │
      ▼
emitAutomationEvent({ organizationId, trigger, eventId, depth, ... })
      │
      ├─► [Idempotency Guard] (Deduplicate deliveries within TTL)
      ├─► [Loop Protection] (Recursion depth > 4 check)
      │
      ▼
Rule Evaluation Engine
(Matches Organization, Project Scoping, Trigger Whitelist, and isEnabled=true)
      │
      ├─► [Spam Throttling Guard] (lastExecutedAt vs throttleMinutes)
      │
      ▼
Safe Condition AST Runner
(Structured logical operators: AND / OR; Operators: EQUALS, NOT_EQUALS, IN, CONTAINS, GREATER_THAN, etc.)
(ZERO eval() / dynamic JavaScript execution)
      │
      ▼
Action Executor Registry
(Whitelisted mutations: STATUS, ASSIGN, COMMENT, SPRINT, NOTIFY, CHAT)
(Non-destructive failure handling)
      │
      ▼
Execution Audit Log (`AutomationLog` / `AutomationExecution`)
      │
      ▼
Real-time Socket & In-app Notification Delivery
```

---

## 2. PREDEFINED REGISTRIES

### A. Supported Triggers
All triggers are strictly whitelisted and registered in `server/src/services/automationEngine.ts`:

- **Work Item Lifecycle**:
  - `WORK_ITEM_CREATED`: Fired upon work item insertion.
  - `WORK_ITEM_UPDATED`: Fired on generic work item updates.
  - `WORK_ITEM_STATUS_CHANGED`: Fired whenever a work item transitions between kanban columns.
  - `WORK_ITEM_PRIORITY_CHANGED`: Fired when priority increases or decreases.
  - `WORK_ITEM_ASSIGNEE_CHANGED`: Fired when an item is reassigned.
  - `WORK_ITEM_DUE_DATE_APPROACHING`: Evaluated on scheduled/imminent due dates.
  - `WORK_ITEM_DUE_DATE_PASSED`: Evaluated on overdue work items.
  - `WORK_ITEM_BLOCKED`: Fired whenever work item status moves to `BLOCKED`.
  - `WORK_ITEM_UNBLOCKED`: Fired when item moves out of `BLOCKED`.
  - `WORK_ITEM_COMPLETED`: Fired when item moves to `DONE`.
  - `WORK_ITEM_REOPENED`: Fired when item moves from `DONE` back to active status.

- **Sprint Lifecycle**:
  - `SPRINT_STARTED`: Fired when a sprint is activated.
  - `SPRINT_ENDING`: Fired when sprint end date is within notification threshold.
  - `SPRINT_COMPLETED`: Fired when a sprint is completed and carry-over processed.
  - `SPRINT_SCOPE_CHANGED`: Fired when items are added/removed from active sprint.

- **GitHub Integrations (Normalized Webhooks)**:
  - `GITHUB_PR_OPENED`: Pull request opened in connected repository.
  - `GITHUB_PR_UPDATED`: Pull request updated or synchronized.
  - `GITHUB_PR_APPROVED`: Pull request approved by reviewers.
  - `GITHUB_PR_MERGED`: Pull request merged into target branch.
  - `GITHUB_PR_CLOSED`: Pull request closed without merge.
  - `GITHUB_COMMIT_PUSHED`: Git commits pushed to branch.
  - `GITHUB_BRANCH_CREATED`: New git branch created.
  - `GITHUB_CHECK_FAILED` / `GITHUB_CHECK_PASSED`: CI check status.
  - `GITHUB_WORKFLOW_FAILED` / `GITHUB_WORKFLOW_COMPLETED`: GitHub Actions workflow status.

- **Capacity & Resource Planning**:
  - `CAPACITY_OVER_ALLOCATED`: Fired whenever resource allocation or workload evaluation exceeds 100% (or total allocated hours exceed monthly capacity).

- **Calendar & Meetings**:
  - `MEETING_CREATED`: Meeting scheduled.
  - `MEETING_UPDATED`: Meeting details changed.
  - `MEETING_CANCELLED`: Meeting cancelled.

---

## 3. CORE MANDATORY AUTOMATIONS IMPLEMENTED

1. **Automation 1 — PR Opened**:
   - Webhook `pull_request.action = opened` → linked work item extracted → status moves to `CODE_REVIEW` → Assignee notified.
2. **Automation 2 — PR Merged**:
   - Webhook `pull_request.action = closed` & `merged = true` → linked work item → status moves to `DONE` → Completion comment posted → Assignee notified.
3. **Automation 3 — Work Item Blocked**:
   - Status updated to `BLOCKED` → `WORK_ITEM_BLOCKED` event dispatched → Managers and Assignee notified → Execution record created.
4. **Automation 4 — Due Date Approaching**:
   - Condition `dueDateDays <= 2 AND status != DONE` → Notify Assignee.
5. **Automation 5 — Sprint Ending**:
   - Sprint completion / end check → Incomplete work detected → Manager notified.
6. **Automation 6 — Capacity Overload**:
   - Allocation created or updated resulting in >100% utilization → `CAPACITY_OVER_ALLOCATED` emitted → Manager notified.

---

## 4. RELIABILITY & PROTECTION GUARANTEES

1. **Idempotency**:
   - In-memory sliding TTL cache + DB `eventId` indexing ensures redelivered webhooks or duplicate events are detected and skipped with status `SKIPPED_IDEMPOTENT`.
2. **Loop & Recursion Detection**:
   - Every event tracks recursion `depth`. If cascade chaining exceeds depth 4, the engine aborts with status `SKIPPED_LOOP`.
3. **Spam Throttling**:
   - Each rule supports `throttleMinutes`. If triggered before the cooldown expires, the execution is recorded as `THROTTLED` without spamming notifications.
4. **Non-Destructive Failures**:
   - If an action fails, the failure is safely recorded in `AutomationLog` with `errorCode` and safe message; the underlying database state is not corrupted.

---

## 5. RBAC & PERMISSION BOUNDARIES

Following the authoritative TMP policy:
- **Sai Kiran (saikirankurapti@gmail.com) — ADMIN**:
  - Full management of organization-wide and project-level automation rules.
  - Access to execution audit logs, dry-run testing, and manual retries.
- **Ashwin T (ashwin.zerokost@gmail.com) — CTO + MANAGER**:
  - Management of project-scoped automation rules.
  - Can dry-run and retry project automations.
- **Regular Team Members**:
  - Cannot create, edit, toggle, or delete automation rules (403 Forbidden).
  - Can view and interact with automated results according to normal team member permissions.

---

## 6. COPILOT NATURAL-LANGUAGE INTEGRATION

- AI Copilot includes the `propose_automation_rule` tool.
- When prompted (e.g., *"When a PR is merged, move the linked task to Done"*), Copilot returns a structured `PROPOSAL_CREATE_AUTOMATION_RULE` draft.
- Copilot **never** silently creates or enables the rule. The user must review the proposed trigger, conditions, and actions, and confirm explicitly via `/copilot/confirm`.
- Confirmation enforces strict user RBAC.

---

## 7. TEST SUITE RESULTS

The test suite in `server/src/tests/automationEngine.test.ts` executes 11 automated test cases against live database:

```text
 ✓ server/src/tests/automationEngine.test.ts (11 tests passed)
   ✓ 1. RBAC Permissions & Security Boundaries
     - allows Admin to create organization-wide rule
     - allows Project Manager to create project-scoped rule
     - blocks Regular Team Member with 403 Forbidden
     - rejects invalid triggers with 400 Bad Request
   ✓ 2. Safe Condition Evaluation
     - evaluates EQUALS, NOT_EQUALS, IN, CONTAINS, GREATER_THAN without eval()
   ✓ 3. Core Automations Execution
     - Automation 1 & 2: PR Merged -> Move to DONE
     - Automation 3: Work Item Blocked -> Records execution and notifies manager
     - Automation 6: Capacity Over-allocation (>100%) -> Emits & notifies
   ✓ 4. Reliability: Idempotency & Loop Protection
     - Idempotency: Rejects duplicate webhook deliveries
     - Loop Protection: Aborts execution when recursion depth exceeds threshold
   ✓ 5. Dry-Run / Test Rule Simulation
     - Simulates conditions against active database records without mutating data
```

---

## 8. PRODUCTION CLIENT BUILD

```text
$ npm run build (in client/)
✓ built in 7.89s
dist/index.html                     0.91 kB │ gzip:   0.52 kB
dist/assets/index-BekYsH9-.css     56.35 kB │ gzip:  10.01 kB
dist/assets/index-uRzZrlF6.js   1,281.01 kB │ gzip: 316.48 kB
```
