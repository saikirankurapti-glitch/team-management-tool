# GitHub OAuth & Webhooks Setup Guide

## Overview
The application connects directly to the GitHub REST API and GitHub Webhooks to display real repositories, live branches, actual commit history, pull request states (`OPEN`, `CLOSED`, `MERGED`), branch creation from work items, and automated status syncing.

## 1. Register GitHub OAuth Application
1. Log into your GitHub account and navigate to **Settings > Developer settings > OAuth Apps**.
2. Click **New OAuth App**.
3. Set the following fields:
   - **Application Name**: Antigravity Enterprise Team Platform
   - **Homepage URL**: `http://localhost:5173`
   - **Authorization callback URL**: `http://localhost:5173/integrations` (or your production frontend URL).
4. Save the application and generate a **Client Secret**.
5. Copy the **Client ID** and **Client Secret** into your `server/.env`:
   ```env
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   GITHUB_CALLBACK_URL=http://localhost:5173/integrations
   ```

## 2. Configure GitHub Webhook
1. Go to your GitHub Repository or Organization Settings > **Webhooks** > **Add webhook**.
2. Set **Payload URL**: `https://your-domain.com/api/webhooks/github` (or use `ngrok` for local testing).
3. Set **Content type**: `application/json`.
4. Set **Secret**: Match `GITHUB_WEBHOOK_SECRET` in your `server/.env`.
5. Select events: `Pushes`, `Pull requests`, `Pull request reviews`, `Issues`, `Issue comments`.
6. Click **Add webhook**.

## 3. Work Item Dynamic Linking
The webhook automatically parses work item human IDs (e.g. `GEN-101`) from:
- Pull Request titles (e.g. `GEN-101 Fix authentication timeout`)
- Branch names (e.g. `feature/GEN-101-auth-fix`)

Linked branches and pull requests automatically update work item delivery timelines in real-time.
