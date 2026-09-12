# Development Login — Local Test Account

> [!WARNING]
> **DEVELOPMENT ONLY** — This account and all information on this page is for local development use only.
> The credentials below are **LOCAL DEVELOPMENT TEST CREDENTIALS** and must **never** be used in, or enabled for, production.

---

## Why This Account Exists

The TMP platform normally uses Google OAuth or GitHub OAuth for authentication. On a fresh development laptop, configuring these OAuth apps requires:
- A registered Google Cloud project with OAuth consent screen
- A registered GitHub OAuth App

To allow developers to immediately test the application without setting up OAuth credentials, a single **local development test account** (`test@tmp.local`) is provided. This account:

- Is created by the seed script **only when `NODE_ENV=development`**
- Uses the **same** bcrypt + JWT authentication as all other users
- Goes through the **same** RBAC middleware as a normal `TEAM_MEMBER`
- Has **no** elevated privileges

---

## LOCAL DEVELOPMENT TEST CREDENTIALS

```
Email:    test@tmp.local
Password: TmpTest@12345
Role:     TEAM_MEMBER
```

> [!CAUTION]
> These are **LOCAL DEVELOPMENT TEST CREDENTIALS**.
> Do **not** commit real secrets, do **not** use in staging or production,
> and do **not** share outside the development team.

---

## What the Account Can Access

As a `TEAM_MEMBER`, the dev account:

| Access | Result |
|--------|--------|
| Login, view profile | ✅ Allowed |
| View projects, work items, sprints | ✅ Allowed |
| Post comments, update work items | ✅ Allowed |
| Chat channels (#general, #announcements) | ✅ Allowed |
| Deactivate / reactivate members | ❌ Forbidden (ADMIN+) |
| Price Allocation / Rate Card APIs | ❌ Forbidden (PROJECT_MANAGER+) |
| Organization admin settings | ❌ Forbidden (ADMIN+) |
| Security Center | ❌ Forbidden (ADMIN+) |
| Billing | ❌ Forbidden (OWNER only) |

---

## How to Use It

### 1. Run the Seed

```bash
# From the server directory:
cd team-management-tool/server

NODE_ENV=development npx tsx seed.ts
```

The seed is **idempotent** — running it multiple times will not create duplicate users.

### 2. Start the Application

```bash
# Terminal 1 — Backend
cd team-management-tool/server
npm run dev

# Terminal 2 — Frontend
cd team-management-tool/client
npm run dev
```

### 3. Log In

Navigate to [http://localhost:5173](http://localhost:5173).

You will see a **"Development Login"** section (amber/yellow panel) at the bottom of the Sign In card. Click **Sign In (Dev)** to authenticate immediately.

Alternatively, use the main form with:
- **Email:** `test@tmp.local`
- **Password:** `TmpTest@12345`

---

## Production Safety

The development account is protected by multiple independent layers:

1. **Seed guard** — The `test@tmp.local` user is only created when `NODE_ENV=development`. It will not exist in a production database that was seeded with `NODE_ENV=production`.

2. **Backend route guard** — The `/api/auth/dev-login` route is **conditionally registered** only when `NODE_ENV=development` in `src/routes/index.ts`.

3. **Controller guard** — `devAuthController.ts` checks `NODE_ENV !== 'development'` as its **first instruction** and returns `403 FORBIDDEN` if the environment is anything other than development.

4. **Frontend tree-shaking** — The "Development Login" UI section is gated on `import.meta.env.DEV` (Vite compile-time constant). In a production build (`npm run build`), this evaluates to `false` and the entire section is **completely removed** from the output bundle.

---

## Security Checklist

- [x] Dev user has `TEAM_MEMBER` role — not ADMIN, OWNER, PROJECT_MANAGER
- [x] Dev user is scoped to the development organization
- [x] Password stored as bcrypt hash (salt rounds = 10), never as plaintext
- [x] No plaintext password in logs, API responses, or DB
- [x] `DEMO_MODE` remains `false`
- [x] Seed is idempotent (upsert by email, never creates duplicates)
- [x] Backend guard is independent of frontend — cannot be bypassed by disabling JS
- [x] Production OAuth (Google, GitHub) is completely unmodified
- [x] Automated tests verify RBAC, production rejection, and idempotency

---

## Removing the Dev Account

If you ever need to remove the dev account from a local database:

```sql
-- SQLite
DELETE FROM User WHERE email = 'test@tmp.local';
```

Or simply re-seed with `NODE_ENV=production` — the upsert block will be skipped.
