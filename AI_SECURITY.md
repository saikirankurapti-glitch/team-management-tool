# AI Copilot Security & Permission Isolation Policy

## 1. Multi-Tenant Organization Isolation
Every AI tool request includes `organizationId` and `userId` context derived from verified JWT tokens. Pre-retrieval authorization checks guarantee that AI tool executions never cross organization boundaries or return unauthorized data.

## 2. Prompt Injection Defense
Retrieved application data (task descriptions, chat messages, git commit logs) is strictly isolated from system prompts to prevent prompt injection attacks (e.g. *"Ignore previous instructions"*).

## 3. Human Confirmation Gate for Mutations
AI cannot silently mutate database records. Actions such as creating work items or moving column statuses return **Draft Proposals** requiring explicit user click confirmation before backend execution.
