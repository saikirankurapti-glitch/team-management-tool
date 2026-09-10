# Integration Security & Secret Management Policy

## 1. Token Encryption & Storage
- Personal Access Tokens (PAT) and OAuth access tokens are encrypted before database persistence.
- Plaintext tokens are never returned in REST responses or recorded in logs.

## 2. Webhook Authentication & Isolation
- Incoming webhooks authenticate using HMAC-SHA256 digest validation (`X-Hub-Signature-256`).
- Organization multi-tenant isolation boundaries prevent webhooks from mutating entities outside the target tenant.
