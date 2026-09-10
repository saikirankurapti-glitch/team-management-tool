# API Specification & Endpoint Documentation

## Operational Excellence & Health Check Endpoints
- `GET /health/live` → Public liveness probe returning process status (`UP`).
- `GET /health/ready` → Public readiness probe checking database connection status (`READY`).
- `GET /health/deps` → Public dependency health check (Database, Job Queue, Socket Server).
- `GET /api/v1/ops/metrics` → Fetch real-time operational dashboard metrics (system uptime, average latency, active sockets, pending/failed jobs, AI circuit breaker state).
- `POST /api/v1/ops/jobs/enqueue` → Enqueue test background job for queue processing and execution.
- `POST /api/v1/ops/webhooks/replay` → Trigger safe webhook event replay simulation.
