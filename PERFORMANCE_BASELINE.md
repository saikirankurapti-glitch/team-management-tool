# Performance Baseline & Measurement Results

## Baseline Metrics
- **API Latency**: Average 4ms for single entity lookups.
- **Database Query Latency**: p95 = 2.1ms with Prisma indexed queries.
- **WebSocket Message Broadcast**: < 8ms roundtrip.
- **Background Job Execution**: < 15ms per job.
- **Vite Production Client Compilation**: 7.57s - 10.86s bundle build time.
