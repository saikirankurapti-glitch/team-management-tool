# Platform Reliability & Resilience Specifications

## 1. Background Job Reliability (`JobQueueManager.ts`)
Automatic retries with exponential backoff and dead-letter queues (`DEAD_LETTER`).

## 2. AI Fault Isolation (`AiCircuitBreaker.ts`)
Circuit breaker isolates AI provider outages, allowing core work management, chat, and analytics to continue uninterrupted.
