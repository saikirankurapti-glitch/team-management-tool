# Scale Targets Specifications

## 1. Scale Goals (Target Environment)
- **Organizations**: 1,000 active customer organizations.
- **Users**: 50,000 active users (50 users/organization average).
- **Work Items**: 500,000 active work items.
- **Chat Messages**: 5,000,000 messages across channels and direct threads.

## 2. Throughput & Latency Targets
- **API Request Throughput**: 500 requests per second (RPS) peak.
- **API Latency**: p95 < 50ms for core CRUD, p99 < 150ms for complex queries.
- **WebSocket Concurrency**: 5,000 concurrent active connections.
- **Background Queue Throughput**: 1,000 jobs per minute.
