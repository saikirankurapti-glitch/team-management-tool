# GitHub Repository Mapping & Multi-Repo Management

This document details how GitHub repositories are mapped to projects and organizations.

---

## 1. Repository Mapping Architecture

```text
Organization
  ├── OrganizationGitHubConfig (OAuth client, encrypted secrets, webhook config)
  ├── GitHubConnection (User-level access token)
  └── Projects
        ├── Project 1 (e.g. "Mobile App", key "MOB")
        │     └── Linked Repositories (e.g. "org/mobile-ios", "org/mobile-android")
        └── Project 2 (e.g. "Backend API", key "API")
              └── Linked Repositories (e.g. "org/backend-api", "org/infra-k8s")
```

---

## 2. Project Repository Settings

- Each project can configure:
  - **Primary Repository**: The default repo for branch and PR creation.
  - **Branch Naming Pattern**: Customizable per-project pattern (e.g., `{type}/{humanId}-{slug}` or `jira/{humanId}/{slug}`).
  - **Default Target Branch**: `main`, `master`, or `develop`.

---

## 3. Project Development View

The **Development** tab in `ProjectDetailPage`:
1. **Overview KPI Cards**:
   - Total linked Repositories
   - Open / Merged Pull Requests
   - Active Branches
   - Linked Commits
2. **Subtabs**:
   - **Pull Requests**: Filterable list with CI status chips, review status, and direct GitHub links.
   - **Branches**: Active branches across all linked repos with humanId indicators.
   - **Commits**: Chronological list of commits mentioning work item IDs.
   - **Repositories**: Repository list with visibility flags, default branch, and telemetry counts.
