# Software Developer Quick Reference Guide

## 1. Branch Naming Conventions
Include the Work Item Human ID (`PROJ-102`, `CUST-104`, `BUG-101`) in your git branch name:
- Features: `feature/PROJ-102-user-auth`
- Bugs: `bugfix/CUST-104-api-timeout`

## 2. Commit & Pull Request Reference Syntax
Reference work item IDs in commit messages and PR titles:
- Commit: `git commit -m "fix(billing): resolve timeout bug [CUST-104]"`
- PR Title: `[CUST-104] Add timeout retry handler`

When a PR is opened or merged, the platform automatically links the PR to the work item and triggers automated column transitions (e.g. `In Progress` ➔ `Code Review` ➔ `Testing`).
