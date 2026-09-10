# AI Copilot Failure Isolation & Circuit Breaker (`AiCircuitBreaker.ts`)

## Fault Isolation Guarantee
The AI Gateway Circuit Breaker monitors consecutive AI provider failures. When open, it returns readable fallback responses without affecting core work management, Kanban boards, chat, or analytics.
