# Startup Team Management & Collaboration Platform

A production-grade, highly-aesthetic, scalable web platform combining Azure DevOps Boards, Jira, Slack/Teams Chat, Sprint Burndown tracking, Workload Management, and Real-Time Bottleneck Analytics.

Designed specifically for a 6-member startup team working simultaneously across multiple projects.

---

## Key Features

1. **Executive Dashboard**: KPI overview of active projects, active tasks, completed items, blocked impediments, and overdue deadlines.
2. **"My Work" Dashboard**: Unified cross-project personal view answering *"What do I need to work on today?"* categorized into overdue, in-progress, review queues, and completed tasks.
3. **DevOps Work Item Hierarchy**: Support for Epics, Features, User Stories, Tasks, Bugs, and Subtasks with human-readable IDs (`PROJ-101`, `BUG-203`).
4. **Interactive Kanban Board**: Drag-and-drop workflow (`@hello-pangea/dnd`), Work-In-Progress (WIP) limit visual warnings, filters, search, and story point badges.
5. **Sprint Management & Interactive Burndown**: Sprint planning, velocity metrics, committed vs completed points, and daily ideal vs actual burndown line charts.
6. **Integrated Real-Time Chat**: Socket.io powered channels (#general, #engineering), direct messages (DMs), task mentions (`@PROJ-102`), user mentions (`@Sai`), and embedded work item discussions.
7. **Empirical Analytics Engine**: Accurate Cycle Time (In Progress -> Done) and Lead Time (Created -> Done) calculated directly from historical status transitions (`work_item_status_history`).
8. **Team Workload & Capacity**: Individual capacity bars (Sai 80%, Ravi 60%, Kiran 95%) to prevent team burnout.
9. **Role-Based Access Control (RBAC)**: Enforced permission hierarchy (OWNER, ADMIN, PROJECT_MANAGER, TEAM_MEMBER, VIEWER).
10. **Pre-Seeded Demo Accounts**: Immediate 1-click login for all 6 startup team members.

---

## Quick Start (Local Setup)

### Prerequisites
- Node.js >= v20.0.0
- npm >= v10.0.0

### Installation & Launch
```bash
# 1. Install root dependencies
npm install

# 2. Setup server dependencies & database migration + seed
npm run setup

# 3. Start Client & Server concurrently
npm run dev
```

- **Frontend App**: `http://localhost:5173`
- **Backend REST API**: `http://localhost:5000`

---

## Pre-Seeded 1-Click Demo Accounts

| Name | Role | Email | Password |
|---|---|---|---|
| **Sai Kumar** | OWNER / Architect | `sai@demostartup.com` | `Password123!` |
| **Ravi Verma** | ADMIN / Fullstack Lead | `ravi@demostartup.com` | `Password123!` |
| **Kiran Rao** | PROJECT_MANAGER | `kiran@demostartup.com` | `Password123!` |
| **Priya Sharma** | TEAM_MEMBER (UI/UX) | `priya@demostartup.com` | `Password123!` |
| **Arun Patel** | TEAM_MEMBER (Marketing) | `arun@demostartup.com` | `Password123!` |
| **Naveen Reddy** | TEAM_MEMBER (QA/Backend) | `naveen@demostartup.com` | `Password123!` |
