# Automation Execution Reliability

## Queue-Based Automation Workers
Automations execute via the background job queue engine (`JobQueueManager.ts`), supporting retries, execution duration tracking, and dead-letter queue isolation for failing automation scripts.
