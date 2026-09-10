# Database Schema Specifications & Models

## Operational & Reliability Models
- `BackgroundJob`: Background job queue records (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `DEAD_LETTER`) with retry counters (`attempts`), scheduled timestamps, processing durations, and error logs.
