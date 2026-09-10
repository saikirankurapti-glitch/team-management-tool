# Resource Allocation & Capacity Planning

## Allocation Constraints
1. **Multi-Project Workload Aggregation**:
   - For any user $u$ and time window $[t_{start}, t_{end}]$, total commitment is:
     $$C_u = \sum_{p \in \text{Projects}} \text{AllocationPercentage}(u, p)$$
   - If $C_u > 100\%$, user is flagged as `OVER_ALLOCATED`.
   - Alert notifications are displayed across both project-level resource views and global `/capacity`.

2. **Availability Calculation**:
   - Standard working hours: 160 hours/month (8 hours/day).
   - Monthly allocated hours: $160 \times \frac{C_u}{100}$.
   - Available capacity: $160 - \text{Monthly allocated hours}$.

3. **Financial Role-Based Masking**:
   - `costRate` is nullified for users without `OWNER`, `ADMIN`, or `PROJECT_MANAGER` role.
   - Team members cannot see internal billing or margin calculations.
