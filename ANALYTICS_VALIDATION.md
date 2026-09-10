# Empirical Analytics Metric Validation Document

## 1. Metric Validation & Verification Matrix

| Metric Name | Formula / Definition | Data Source | Controlled Test Data Input | Expected Result | Actual Empirical Result | Status |
|---|---|---|---|---|---|:---:|
| **Cycle Time** | `Timestamp(DONE) - Timestamp(IN_PROGRESS)` | `WorkItemStatusHistory` | Task created Jan 1, In Progress Jan 2 10:00, Done Jan 5 10:00 | 3.0 Days (72 Hrs) | 3.0 Days | PASSED |
| **Lead Time** | `Timestamp(DONE) - Timestamp(CREATED)` | `WorkItem` & `WorkItemStatusHistory` | Task created Jan 1 10:00, Done Jan 5 10:00 | 4.0 Days (96 Hrs) | 4.0 Days | PASSED |
| **Blocked Duration** | `Sum(Timestamp(BLOCKED_END) - Timestamp(BLOCKED_START))` | `WorkItemStatusHistory` | Blocked Jan 3 10:00, Resumed Jan 4 10:00 | 1.0 Day (24 Hrs) | 1.0 Day | PASSED |
| **Throughput** | `Count(WorkItems where status = DONE in date range)` | `WorkItemStatusHistory` | 14 items completed in selected 30-day window | 14 Completed Items | 14 Completed Items | PASSED |
| **Sprint Velocity** | `Sum(StoryPoints of DONE items in completed sprint)` | `WorkItem` & `Sprint` | Sprint 8: 32 pts, Sprint 9: 37 pts, Sprint 10: 35 pts | Avg 34.7 Points | Avg 34.7 Points | PASSED |
| **Capacity Utilization** | `(Assigned Estimated Hours / Baseline Capacity 40h) * 100` | `WorkItem` & `User` | Kiran assigned 44 hours of active work items | 110% Utilization | 110% Utilization | PASSED |

---

## 2. Analytics Integrity Verification
- **Deleted / Reassigned Entities**: Work items deleted or reassigned preserve their historical `WorkItemStatusHistory` transition records, ensuring historical cycle times and velocity charts remain accurate.
- **Workflow State Category Mapping**: Analytics queries map custom project column names to standardized workflow categories (`BACKLOG`, `ACTIVE`, `BLOCKED`, `COMPLETED`).
