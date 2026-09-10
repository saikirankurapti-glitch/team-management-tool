# Custom Report Builder Specifications

## 1. Report Components & Layout
The Report Builder (`SavedReport` model) allows users to construct custom analytics views using configurable widgets:
- `KPI`: Summary metric cards.
- `TABLE`: Detailed work item or project data tables.
- `BAR_CHART`: Status or throughput bar charts.
- `PIE_CHART`: Work item type distribution pie charts.
- `RISK_LIST`: Active early warning risk cards.

## 2. Permissions & Visibility
Saved reports support visibility settings (`PRIVATE`, `TEAM`, `PROJECT`, `ORGANIZATION`). All query aggregations respect server-side RBAC and tenant isolation.
