# End-to-End Multi-Project Pilot Regression Test Plan

## 1. Test Scenario Execution Steps

```text
Step  Action Description                                    Target Component             Expected Result
───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
1.    Admin logs in (sai@demostartup.com)                   Authentication / JWT         Tokens issued, redirected to Dashboard
2.    Verify 6-member startup seed profile                  Organization & Users         6 users present across 2 teams
3.    Navigate to Projects page                             Projects Overview            3 projects visible (CUST, INT, CLNT)
4.    Open "Customer Platform" project                      Project Detail Hub           Kanban board, Backlog, Sprints, Files
5.    Create new Bug ("API Timeout in Billing Service")     Work Item Modal              Bug created with ID CUST-104
6.    Assign Bug to Ravi, set Priority Urgent               Work Item Drawer             Assignee & Priority updated, audit logged
7.    Navigate to Sprint Planning                           Sprint Management            Move CUST-104 to Active Sprint
8.    Drag CUST-104 on Kanban Board to "In Progress"        Kanban Board DnD             Status updated, WorkItemStatusHistory recorded
9.    Switch to Chat page, enter #customer-platform         Real-Time Chat               Message list loads, WebSocket room joined
10.   Type message: "We need to fix API timeout issue"      Chat Input                   Message broadcasted in real-time
11.   Click "+ Create Task" on message                      Chat-to-Task Bridge          New Bug created with message context
12.   Switch to "My Work" page                              Cross-Project View           Unified list displays all assigned tasks
13.   Open Analytics page, check Team Workload              Empirical Analytics          Workload Matrix shows member allocation
14.   Click Header Feedback button, submit UX report        User Feedback Modal          Feedback stored via POST /api/feedback
```
