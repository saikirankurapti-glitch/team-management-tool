# Controlled AI Tool Registry Specifications

## Registered AI Tools Matrix

| Tool Name | Input Schema | Purpose | Output Structure |
|---|---|---|---|
| `search_work_items` | `{ query, priority, status }` | Natural-language work item search | Matching work item list |
| `get_project_health` | `{ key }` | Project health & transparent reasons | Project health status & reasons |
| `get_team_capacity` | `{}` | Member capacity & overload warnings | Capacity utilization list |
| `get_risks` | `{}` | Early warning risk observations | Top 5 active risks |
| `create_work_item_draft` | `{ title, type, priority }` | Draft work item proposal | Draft proposal requiring confirmation |
| `update_work_item_status` | `{ humanId, targetStatus }` | Draft status change proposal | Status proposal requiring confirmation |
