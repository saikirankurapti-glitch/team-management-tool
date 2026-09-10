# Offline Mutation Sync & Idempotency Specifications (`OfflineSyncManager.ts`)

## 1. Offline Mutation Queue
When network connectivity is unavailable, safe mutations (comments, work item status updates) are queued locally with idempotency keys (`idempotencyKey`).

## 2. Server Conflict Resolution (`POST /api/v1/offline/sync`)
Upon network recovery, the client automatically flushes queued mutations to the server. Conflicts are detected and reported to the user without silent data loss.
