# Early Warning Risk Engine & Risk History Logging

## 1. Risk Signals & Detection Criteria
The Early Warning Risk Engine continuously evaluates metric thresholds:
- `OVERDUE`: Work items breaching target due dates.
- `BLOCKED`: Work items remaining blocked > 48 hours.
- `CYCLE_TIME`: Cycle time increase > 25% period-over-period.
- `CAPACITY`: Team member utilization > 100%.

## 2. Risk History Logging Model
Risk observations are persisted in the `RiskObservation` table with status `ACTIVE` or `RESOLVED`, enabling historical duration tracking (e.g. Risk detected Sep 5, resolved Sep 12 = 7 days duration).
