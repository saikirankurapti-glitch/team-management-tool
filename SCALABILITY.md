# System Scalability Architecture & Performance Milestones

## Scaling Stages
- **Stage 1 (6–25 Users)**: Single-instance Express server with local SQLite / PostgreSQL.
- **Stage 2 (25–200 Users)**: Connection pooling, indexed queries, background job queueing.
- **Stage 3 (200–1,000 Users)**: Horizontal application scaling with Redis pub/sub for WebSocket sync.
- **Stage 4 (1,000+ Users)**: Dedicated read-replicas, search engine cluster, partitioned database storage.
