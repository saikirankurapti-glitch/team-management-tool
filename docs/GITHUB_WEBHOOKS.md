# GitHub Webhooks Architecture & Event Processing

This document explains the webhook delivery, cryptographic signature verification, idempotency, and automated state transitions driven by GitHub webhooks.

---

## 1. Webhook Endpoint Configuration

- **Webhook URL**: `https://<your-domain>/api/webhooks/github`
- **Content type**: `application/json`
- **Secret**: Stored securely in `OrganizationGitHubConfig.webhookSecret`.
- **Signature Header**: `x-hub-signature-256`

---

## 2. Security & Signature Verification

Incoming payloads are validated using HMAC SHA-256 against raw request bytes before parsing:

```typescript
const computedSignature = `sha256=${crypto
  .createHmac('sha256', webhookSecret)
  .update(rawBody)
  .digest('hex')}`;

if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature))) {
  throw new Error('Invalid signature');
}
```

---

## 3. Supported Events & Automatic Actions

### `push` Event
1. Iterates through all pushed commits.
2. Extracts work-item human IDs (regex `\b[A-Z0-9]+-\d+\b`).
3. Creates or updates `WorkItemGitHubLink` of type `COMMIT`.
4. Adds history entry and activity telemetry.

### `pull_request` (`opened`, `reopened`)
1. Extracts linked work item human IDs from PR title, branch name, and body description.
2. Links PR to work item via `WorkItemGitHubLink`.
3. Automatically transitions work item status to **`CODE_REVIEW`**.
4. Posts an update to the project's real-time chat channel.
5. Emits notification to the work item assignee.

### `pull_request` (`closed` + `merged: true`)
1. Updates `WorkItemGitHubLink` status to **`MERGED`**.
2. Automatically transitions linked work items to **`DONE`**.
3. Posts a merge celebration announcement to the project chat channel.
4. Notifies assignees and reviewers.

### `pull_request_review` (`submitted`)
1. Updates PR review status (`APPROVED`, `CHANGES_REQUESTED`, `COMMENTED`).
2. Syncs status to the work item's development summary.

### `check_run` / `workflow_run`
1. Computes live CI status (`SUCCESS`, `FAILURE`, `RUNNING`).
2. Displays passing/failing status chips in work item and project views.

---

## 4. Idempotency & Delivery Reliability

- Webhook deliveries are tracked by GitHub Delivery ID (`x-github-delivery`).
- Existing link records are upserted to ensure identical webhook redeliveries do not produce duplicated records or conflicting state history.
