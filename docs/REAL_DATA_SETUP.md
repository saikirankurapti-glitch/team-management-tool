# Real Data System Setup Guide

## Overview
Phase 22 removes all hardcoded production mock data, simulated API fallbacks, and dummy responses across the entire application stack.

This guide outlines how to configure the real database, authentication, external integrations (GitHub, AI Copilot, Google Drive), and health checks.

## Key Principles
1. **Single Source of Truth**: All organization, user, project, work item, sprint, comment, and chat entities originate directly from the database (`server/prisma/dev.db`).
2. **Production Rule**: `DEMO_MODE=false` is enforced by default in server startup (`server/src/index.ts`). Unsafe fallbacks returning hardcoded arrays or `Math.random()` numbers are removed.
3. **Graceful Degraded States**: If an external service (e.g. GitHub or AI Provider) is unconfigured or unavailable, the system renders an informative "Disconnected / Unconfigured" UI state rather than fabricating fake data.

## Server Environment Setup
Ensure `server/.env` contains valid production configuration:

```env
PORT=5000
NODE_ENV=production
DEMO_MODE=false
JWT_SECRET=production_jwt_secret_key_32_bytes
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL="file:./dev.db"

# GitHub
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:5173/integrations
GITHUB_WEBHOOK_SECRET=your_github_webhook_secret

# AI Copilot
AI_PROVIDER=openai
AI_MODEL=gpt-4o
AI_API_KEY=your_openai_api_key

# Google Drive
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REFRESH_TOKEN=your_google_refresh_token
```

## Database Initialization
Run Prisma database sync:
```bash
cd server
npx prisma db push
npx prisma generate
```
