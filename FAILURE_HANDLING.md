# System Failure Handling & Circuit Breaker Architecture

## Failure Isolation Policies
- **AI Gateway Fault Isolation**: Circuit Breaker (`AiCircuitBreaker.ts`) opens upon consecutive failures, returning graceful fallback notices without crashing core work management.
- **External Webhook Retries**: Retried up to 5 times before moving to dead-letter queue.
