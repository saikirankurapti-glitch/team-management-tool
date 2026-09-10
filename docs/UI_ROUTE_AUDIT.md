# Complete Frontend UI Route Audit: TMP Platform

This document provides a comprehensive inventory and audit of every frontend route in the TMP application after the Warm Cream + Olive Editorial redesign.

---

## 1. Complete Route Inventory

| # | Route | Page / Component | Current Status | Visual Issues | Responsive Issues | Functional Issues | Priority | Fixed |
| :- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | \/ | HomeDashboard.tsx | Redesigned | None; uses warm cream editorial tokens | Clean flex-wrap & metric cards | Verified with real API data | P2 | Yes |
| 2 | \/my-work\ | MyWorkPage.tsx | Redesigned | None; editorial header and pill filters | Table scrolls horizontally on mobile | Verified side drawer opening | P2 | Yes |
| 3 | \/projects\ | ProjectsPage.tsx | Redesigned | None; flat cards with olive progress meters | 1/2/3 column responsive grid | Real project API integration | P2 | Yes |
| 4 | \/projects/:key\ | ProjectDetailPage.tsx | Redesigned | None; summary cards and pill tabs | Horizontal tab scroll on narrow viewports | Project member & settings tabs active | P2 | Yes |
| 5 | \/boards\ | KanbanBoardPage.tsx | Redesigned | None; compact operational cards with WIP badges | Column scroll on tablet/mobile | Drag-and-drop & filters intact | P1 | Yes |
| 6 | \/backlogs\ | BacklogPage.tsx | Redesigned | None; tree hierarchy with olive tags | Indentation preserved on mobile | Tree expansion/collapse active | P2 | Yes |
| 7 | \/sprints\ | SprintsPage.tsx | Pending Editorial Polish | Legacy blue in burndown chart & tabs | Form controls need warm pill styling | Velocity & burndown API intact | P1 | In Progress |
| 8 | \/chat\ | ChatPage.tsx | Redesigned | None; warm channel list & message cards | Channel drawer toggle on mobile | Real Socket.IO & work item linking | P2 | Yes |
| 9 | \/teams\ | TeamsPage.tsx | Redesigned | None; member cards with skills pills | 1/2/3 column responsive grid | Real 6 team members only | P1 | Yes |
| 10 | \/capacity\ | CapacityPlanningPage.tsx | Needs Brand Polish | Slate/blue cards need .card-cream / .panel-cream | Metric cards stack on mobile | Real 6 members capacity math | P1 | In Progress |
| 11 | \/calendar\ | CalendarPage.tsx | Redesigned | None; pill view switcher & schedule CTA | Grid scroll on mobile | Real Google Calendar API integration | P1 | Yes |
| 12 | \/analytics\ | AnalyticsPage.tsx | Redesigned | None; olive Recharts & workload matrix | Responsive grid on mobile | Empirical throughput & WIP aging | P1 | Yes |
| 13 | \/notifications\ | NotificationsPage.tsx | Needs Brand Polish | Legacy blue icons; needs warm cream panel | Table row spacing on mobile | Mark all read & navigation active | P2 | In Progress |
| 14 | \/files\ | FilesPage.tsx | Needs Brand Polish | Blue upload button; needs .btn-pill-primary | Table row layout on mobile | Real file upload & Google Drive links | P2 | In Progress |
| 15 | \/integrations\ | IntegrationsPage.tsx | Redesigned | None; editorial header and status pills | Grid collapses on mobile | GitHub & Google OAuth verification | P1 | Yes |
| 16 | \/automations\ | AutomationsPage.tsx | Needs Brand Polish | Slate headers; needs .panel-cream | Modal layout on mobile | Real automation rules toggle | P2 | In Progress |
| 17 | \/templates\ | TemplatesPage.tsx | Needs Brand Polish | Blue badge accents; needs warm cream | Card grid on mobile | Project creation from template | P3 | In Progress |
| 18 | \/knowledge\ | KnowledgeHubPage.tsx | Needs Brand Polish | Slate panel; needs warm cream styling | AI search bar responsive width | Real knowledge docs & AI search | P2 | In Progress |
| 19 | \/collaboration\ | Alias to KnowledgeHubPage.tsx | Needs Brand Polish | Inherits Knowledge Hub styling | Same as Knowledge Hub | Unified route alias | P3 | In Progress |
| 20 | \/landing\ | LandingPage.tsx | Redesigned | None; warm cream hero & pill buttons | Responsive nav & flex hero | Navigation links to login/signup | P2 | Yes |
| 21 | \/pricing\ | Alias to LandingPage.tsx | Redesigned | None; editorial pricing tiers | Responsive pricing cards | Links to signup | P2 | Yes |
| 22 | \/signup\ | SignupPage.tsx | Needs Brand Polish | Slate-950 background; needs warm canvas | Card max-width on mobile | Real signup API call | P2 | In Progress |
| 23 | \/login\ | LoginPage.tsx | Redesigned | None; editorial headline and pill auth | 2-column grid collapses to 1 | GitHub & Google OAuth login | P1 | Yes |
| 24 | \/settings/security\ | SecurityCenterPage.tsx | Redesigned | None; warm cream cards and audit log | Table row scroll on mobile | Closed-team approval flow | P1 | Yes |
| 25 | \/settings/billing\ | BillingPage.tsx | Needs Brand Polish | Slate panels; needs warm cream cards | Card grid on mobile | Real billing upgrade API | P2 | In Progress |
| 26 | \/settings/ai\ | AiSettingsPage.tsx | Needs Brand Polish | Slate cards; needs .card-cream | Metric grid on mobile | Real Copilot settings & token budget | P2 | In Progress |
| 27 | \/settings/developer-apps\ | DeveloperAppsPage.tsx | Needs Brand Polish | Blue primary buttons; needs .btn-pill-primary | Form columns on mobile | OAuth app creation & webhook test | P2 | In Progress |
| 28 | \/settings/governance\ | GovernancePage.tsx | Needs Brand Polish | Slate panels; needs .panel-cream | Tab overflow on mobile | Real workflow schemes & health rules | P2 | In Progress |
| 29 | \/governance\ | Alias to GovernancePage.tsx | Needs Brand Polish | Same as Governance | Same as Governance | Unified route alias | P3 | In Progress |
| 30 | \/settings/ops\ | OpsDashboardPage.tsx | Needs Brand Polish | Slate panels; needs .panel-cream | Metric grid on mobile | Real operational telemetry & queues | P2 | In Progress |
| 31 | \/ops\ | Alias to OpsDashboardPage.tsx | Needs Brand Polish | Same as Ops | Same as Ops | Unified route alias | P3 | In Progress |
| 32 | \/settings\ | SettingsPage.tsx | Needs Brand Polish | Left sub-sidebar is slate; needs warm cream | Sub-nav on mobile | Profile & organization settings | P2 | In Progress |
| 33 | \/auth/github/callback\ | GitHubCallbackPage.tsx | Needs Brand Polish | Background slate-950; needs warm cream | Centered card on mobile | Session token parsing & redirect | P1 | In Progress |
| 34 | \/auth/google/callback\ | GoogleCallbackPage.tsx | Needs Brand Polish | Background slate-950; needs warm cream | Centered card on mobile | Access request creation & redirect | P1 | In Progress |
