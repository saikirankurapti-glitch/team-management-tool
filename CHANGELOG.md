# Changelog & Product Release Notes

All notable changes to the **Startup Team Management Platform** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v1.0.0-pilot] - 2026-09-03

### Added
- **Work Item Hierarchy & Kanban Boards**: Support for Epics, Features, User Stories, Tasks, Bugs, Subtasks, drag-and-drop Kanban columns, WIP limits, and status history tracking.
- **Sprint Management & Planning**: Sprint creation, drag-and-drop backlog planning, real-time Burndown charts, team velocity history, and carry-over workflow.
- **Real-Time Collaboration**: Public/private channels, direct messages, online presence, Socket.io WebSockets, `@mentions`, work item preview cards, single-click "Create Task from Chat", and "Share Work Item to Chat".
- **Notifications, Files & Search**: Interactive dropdown notification drawer 🔔, centralized project files (`/files`), global search with command palette (`Ctrl+K`), and interactive calendar (`/calendar`).
- **Empirical Analytics Engine**: Executive overview dashboard, transparent project health scoring, cross-project team workload matrix, flow bottleneck detection, WIP aging list, bug quality metrics, and CSV export.
- **Production Hardening & Health Monitoring**: Multi-tenant organization isolation, bcrypt auth, React `ErrorBoundary`, `/health` and `/ready` endpoints, and internal pilot user feedback modal (`/api/feedback`).

### Security
- Server-side multi-tenant `organizationId` query isolation.
- IDOR object access protection.
- RBAC role enforcement across REST controllers.
