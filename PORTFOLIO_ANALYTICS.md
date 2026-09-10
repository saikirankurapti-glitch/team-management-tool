# Portfolio Analytics & Project Health Intelligence

## 1. Portfolio Overview
The Portfolio Intelligence layer (`/analytics/portfolio`) provides executive management with a real-time cross-project matrix evaluating progress, health, risk level, target deadlines, and workload distribution.

```text
Project Name         Progress %    Health Status    Risk Level    Target Date    Active Items
─────────────────────────────────────────────────────────────────────────────────────────────
Customer Platform    78%           Healthy          Low           Oct 20, 2026   14 Items
Internal Tool        48%           At Risk          Medium        Nov 15, 2026   12 Items
Client Project       31%           Critical         High          Dec 05, 2026   18 Items
```

## 2. Transparent Health Calculation Rules
- **Healthy**: Progress on track, 0–2 overdue items, 0–1 blocked items.
- **At Risk**: 3–5 overdue items OR 2 blocked items OR cycle time increase > 20%.
- **Critical**: > 5 overdue items OR > 2 blocked items OR progress < 40% near target deadline.
- **Human-Readable Explanations**: Every non-healthy project outputs explicit risk reasons (e.g. *"4 overdue items"*, *"2 blocked items"*).
