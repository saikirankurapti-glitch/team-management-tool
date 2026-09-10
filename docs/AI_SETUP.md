# AI Copilot Setup Guide

## Architecture Overview
The AI Copilot operates via a controlled tool registry executing real database and GitHub REST API queries under strict tenant organization isolation and RBAC user authorization.

```text
Copilot UI
   ↓
AI Gateway (/api/copilot/ask)
   ↓
Authentication & RBAC
   ↓
Controlled Tool Registry (aiToolRegistry.ts)
   ↓
Database / GitHub REST API
   ↓
LLM Provider / Response
```

## Provider Configuration
Supported AI Providers:
- `openai` (`gpt-4o`, `gpt-4o-mini`)
- `gemini` (`gemini-1.5-pro`, `gemini-1.5-flash`)

Add credentials to `server/.env`:
```env
AI_PROVIDER=openai
AI_MODEL=gpt-4o
AI_API_KEY=your_openai_api_key
```

## Controlled Tools & Security Scoping
All tools are scoped strictly by `organizationId`:
1. **Projects**: `list_projects`, `get_project`, `get_project_health`
2. **Work Items**: `list_work_items`, `get_work_item`, `search_work_items`, `create_work_item_draft`, `update_work_item_status`
3. **Sprints**: `get_current_sprint`, `get_sprint_metrics`
4. **GitHub**: `get_github_connection`, `list_repositories`, `list_branches`, `list_commits`, `list_pull_requests`
5. **Team Workload**: `list_team_members`, `get_member_workload`

## Mutation Confirmation Protocol
- **Read Operations**: Executed automatically.
- **Write Operations** (e.g. creating work items or moving task statuses): Return an **Action Proposal Preview**. The mutation is executed only after the user explicitly clicks **Confirm & Execute**.
