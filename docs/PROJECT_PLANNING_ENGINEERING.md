# Phase 34: Project Planning, Estimation, Pricing, Resource Allocation & Capacity Planning

## Overview
Phase 34 delivers an enterprise-grade Project Planning, Software Estimation, Commercial Pricing, Resource Allocation, and Multi-Project Capacity Planning engine integrated into the existing Organization, Project, WorkItem, Team, and User data models.

## Core Pillars

### 1. Critical Path Method (CPM) & Timeline / Gantt
- **Forward Pass**: Calculates Earliest Start ($ES$) and Earliest Finish ($EF$) for all work items based on dependencies.
- **Backward Pass**: Calculates Latest Finish ($LF$) and Latest Start ($LS$) for all work items.
- **Slack (Total Float)**: $Slack = LS - ES = LF - EF$.
- **Critical Path**: Identified where $Slack = 0$. Critical tasks highlighted in red/amber with priority treatment.
- **Cycle Prevention**: Tarjan's DFS cycle detection stops circular dependencies before saving.
- **Zoom Levels**: Day, Week, Month, and Quarter timescales with milestone markers and dependency creation modal.

### 2. Software Estimation Engine
- **Three-Point PERT**:
  - Expected Hours: $\mu = \frac{O + 4M + P}{6}$
  - Standard Deviation: $\sigma = \frac{P - O}{6}$
  - Variance: $\sigma^2 = \left(\frac{P - O}{6}\right)^2$
  - Confidence Score based on spread: $\max(10\%, 100\% - \frac{P - O}{M} \times 25\%)$
- **Estimation Units**: Story Points, Estimated Hours, Person Days (converted at standard 8 hrs/day).
- **Estimation Audit Trail**: Tracks who changed estimates, reason, old/new values, and timestamp.

### 3. Multi-Project Capacity & Resource Allocation
- **Allocation Rules**: Calculates cross-project commitment percentages for users across overlapping date ranges.
- **Over-Allocation Alerts**:
  - $\sum \% > 100\%$: Flagged as `OVER_ALLOCATED` with visual warning banners.
  - $85\% - 100\%$: `HIGH_UTILIZATION`.
  - $50\% - 85\%$: `HEALTHY`.
  - $< 50\%$: `UNDERUTILIZED`.
- **Org-Level Workload Heatmap**: Global capacity dashboard displaying team availability and hours.

### 4. Commercial Pricing Models
- **Pricing Modes**: Time & Materials (T&M), Fixed Price, Milestone-based, Retainer.
- **Ledger Computations**:
  - Direct Cost: Hours $\times$ Cost Rate
  - Contingency: Direct Cost $\times$ Contingency %
  - Markup: Subtotal $\times$ Markup %
  - Discount: Target Price $\times$ Discount %
  - Tax: Net Price $\times$ Tax %
  - Gross Margin: $\frac{\text{Price} - \text{Cost}}{\text{Price}} \times 100$
- **Financial RBAC**: Cost rates and gross margins are strictly restricted to `OWNER`, `ADMIN`, and `PROJECT_MANAGER`. Standard team members receive masked/null financial fields.

### 5. What-If Scenario Modeling
- Clone baselines and simulate optimistic, realistic, or aggressive schedule/budget variations.
- Adjust buffer %, hourly multiplier, and team size.
- 1-click apply to active project plan.

### 6. Planned vs Actual Variance
- **Schedule Variance (SV)**: Planned Hours - Actual Hours.
- **Cost Variance (CV)**: Planned Cost - Actual Cost.
- **Forecast at Completion (FAC)**: Estimates total cost based on current burn rate.
