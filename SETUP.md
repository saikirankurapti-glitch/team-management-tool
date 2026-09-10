# Setup & Development Guide

## Environment Setup

Ensure environment variables are configured in `server/.env`:

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=super-secret-jwt-token-key-change-in-production-12345
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL="file:./dev.db"
```

## Setup Commands

```bash
# 1. Install workspace dependencies
npm run install:server
npm run install:client

# 2. Synchronize database and seed demo data
npm run db:setup

# 3. Run automated test suite
npm run test

# 4. Start concurrent development servers
npm run dev
```
