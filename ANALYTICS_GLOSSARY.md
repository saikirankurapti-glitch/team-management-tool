# Analytics Metric Glossary & Formulas

## Core Metrics Definitions
1. **Cycle Time**: Time elapsed from when a work item enters an `IN_PROGRESS` status category until it reaches a `COMPLETED` status category. Calculated from `WorkItemStatusHistory` records.
2. **Lead Time**: Total time elapsed from work item creation (`createdAt`) to completion (`COMPLETED` category status).
3. **Throughput**: Count of work items completed (`COMPLETED` status) within a specified time window.
4. **WIP (Work In Progress)**: Total active work items currently assigned to `IN_PROGRESS` status categories.
5. **Sprint Velocity**: Sum of completed story points across consecutive closed sprints.
6. **Burndown**: Ideal vs. actual story points remaining per day in an active sprint cycle.
7. **Risk Score**: Formula evaluating overdue items, WIP limit breaches, and blocked dependencies.
