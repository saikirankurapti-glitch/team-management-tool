# GitHub Engineering Workflow

This document details the end-to-end engineering workflow connecting **Projects**, **Work Items** (Epics, Features, User Stories, Tasks, Bugs), and **GitHub** (Branches, Commits, Pull Requests, Reviews, CI/CD).

---

## 1. High-Level Engineering Lifecycle

```text
Project
   ↓
Work Item (Task, Bug, Feature, Story)
   ↓
Create Branch: {type}/{humanId}-{slug}
   ↓
Developer Works & Commits to GitHub
   ↓
Create Pull Request: [{humanId}] {Title}
   ↓
Automated CI / Reviews (`APPROVED`, `CHANGES_REQUESTED`)
   ↓
Webhook: Transition to CODE_REVIEW
   ↓
Merge Pull Request
   ↓
Webhook: Auto-transition Work Item to DONE
   ↓
Project Chat Notification & Assignee Alert
```

---

## 2. Work Item Branch Creation

Developers can generate a sanitized, standardized Git branch directly from any work item side drawer.

### Branch Naming Convention

| Work Item Type | Prefix | Default Format | Example |
| :--- | :--- | :--- | :--- |
| `BUG` | `fix` | `fix/{humanId}-{slug}` | `fix/PROJ-101-fix-login-crash` |
| `FEATURE` | `feat` | `feat/{humanId}-{slug}` | `feat/PROJ-102-add-github-ci` |
| `USER_STORY` | `story` | `story/{humanId}-{slug}` | `story/PROJ-103-dark-mode-toggle` |
| `TASK` | `task` | `task/{humanId}-{slug}` | `task/PROJ-104-update-docs` |
| `EPIC` | `epic` | `epic/{humanId}-{slug}` | `epic/PROJ-105-core-infrastructure` |

### Sanitization Rules

1. Strips illegal Git characters (`~^:?*[\ `).
2. Collapses consecutive slashes (`//`) and dots (`..`).
3. Trims leading/trailing hyphens and dots.
4. Normalizes all characters to lowercase.

---

## 3. Pull Request Creation & Linking

- Pull Requests created via the UI or linked automatically from GitHub will:
  - Populate the title with `[{humanId}] {title}`.
  - Insert markdown closing tags: `Closes {humanId}`.
  - Create a bi-directional link in `WorkItemGitHubLink`.
  - Add a work item comment linking directly to the PR URL on GitHub.

---

## 4. Work Item Development Section

The work item drawer includes a dedicated **DEVELOPMENT** panel:
- **Linked Branches**: Shows branch name, repository, creation date, link to GitHub tree, and a 1-click **Open PR** button.
- **Linked Pull Requests**: Live PR status (`OPEN`, `MERGED`, `CLOSED`), review state (`APPROVED`, `CHANGES_REQUESTED`, `PENDING`), and CI check runs (`SUCCESS`, `FAILURE`, `RUNNING`).
- **Linked Commits**: Commit SHA (short 7-char), commit message, author, and timestamp.

---

## 5. Security & Multi-Tenancy

- All GitHub API queries are scoped strictly to the authenticated user's organization (`project.organizationId === req.user.organizationId`).
- Tokens are encrypted at rest with AES-256-GCM.
- Access tokens and client secrets are never returned in client API responses.
