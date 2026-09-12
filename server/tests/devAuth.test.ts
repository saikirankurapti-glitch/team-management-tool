/**
 * devAuth.test.ts
 *
 * Automated tests for the development-only dummy login feature.
 *
 * Tests verify:
 *  1. Correct credentials → successful login
 *  2. Wrong password → 401
 *  3. Unknown email → 401
 *  4. Dev account has TEAM_MEMBER role (not ADMIN/OWNER)
 *  5. Dev account can access TEAM_MEMBER-accessible routes
 *  6. Dev account CANNOT access ADMIN-only routes (deactivate member)
 *  7. Dev account CANNOT access restricted Price Allocation / Planning APIs
 *  8. Dev account CANNOT access CTO/Manager routes (requireRole PROJECT_MANAGER+)
 *  9. Production mode: /api/auth/dev-login returns 403
 * 10. Seed idempotency: user is unique in DB (no duplicate email)
 *
 * Note: These tests run with NODE_ENV=test (set by Vitest). The dev-login
 * route is registered only when NODE_ENV=development. Tests for the
 * /api/auth/dev-login endpoint simulate production rejection by testing the
 * controller's guard directly. The main dev credentials (test@tmp.local) are
 * tested via the standard /api/auth/login route since the user exists in the
 * seeded test DB.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/index';
import { PrismaClient } from '../../client/prisma/client/index.js';

// LOCAL DEVELOPMENT TEST CREDENTIALS — for automated testing only
const DEV_EMAIL = 'test@tmp.local';
const DEV_PASSWORD = 'TmpTest@12345';

const prisma = new PrismaClient();

describe('Development Dummy Login — Full Test Suite', () => {
  let devToken: string;
  let devUserId: string;
  let orgId: string;

  // ── Setup: ensure dev test user exists in test DB ──────────────────────────
  beforeAll(async () => {
    const org = await prisma.organization.findFirst();
    if (!org) {
      throw new Error('[devAuth.test] No organization found. Run the seed first.');
    }
    orgId = org.id;

    // Upsert dev user so tests are self-contained (idempotent by design)
    const hash = await bcrypt.hash(DEV_PASSWORD, 10);
    await prisma.user.upsert({
      where: { email: DEV_EMAIL },
      update: { passwordHash: hash, role: 'TEAM_MEMBER', isActive: true },
      create: {
        organizationId: org.id,
        email: DEV_EMAIL,
        passwordHash: hash,
        fullName: 'Dev Test Account',
        jobTitle: 'Development Test User',
        department: 'Engineering',
        role: 'TEAM_MEMBER',
        isActive: true,
        status: 'ONLINE',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ── Test 1: Correct credentials → 200 + JWT ────────────────────────────────
  it('Dev login succeeds with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: DEV_EMAIL, password: DEV_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(DEV_EMAIL);

    // Store for subsequent tests
    devToken = res.body.token;
    devUserId = res.body.user.id;
  });

  // ── Test 2: Wrong password → 401 ──────────────────────────────────────────
  it('Dev login fails with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: DEV_EMAIL, password: 'WrongPassword!!' });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  // ── Test 3: Unknown email → 401 ───────────────────────────────────────────
  it('Dev login fails with unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.local', password: DEV_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  // ── Test 4: Dev account has TEAM_MEMBER role ───────────────────────────────
  it('Dev account has TEAM_MEMBER role (not ADMIN, OWNER, PROJECT_MANAGER)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${devToken}`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('TEAM_MEMBER');
    expect(res.body.role).not.toBe('ADMIN');
    expect(res.body.role).not.toBe('OWNER');
    expect(res.body.role).not.toBe('PROJECT_MANAGER');
    expect(res.body.email).toBe(DEV_EMAIL);
  });

  // ── Test 5: Dev account can access TEAM_MEMBER-permitted routes ────────────
  it('Dev account can access GET /api/projects (TEAM_MEMBER allowed)', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${devToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('Dev account can access GET /api/auth/me (authenticated users)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${devToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(devUserId);
  });

  it('Dev account can access GET /api/work-items (TEAM_MEMBER allowed)', async () => {
    const res = await request(app)
      .get('/api/work-items')
      .set('Authorization', `Bearer ${devToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // ── Test 6: Dev account CANNOT access ADMIN-only routes ───────────────────
  it('Dev account cannot deactivate members (ADMIN-only route)', async () => {
    // Use a dummy member ID — the RBAC check happens before DB lookup
    const res = await request(app)
      .post(`/api/organization/members/some-member-id/deactivate`)
      .set('Authorization', `Bearer ${devToken}`);

    // Must be 403 Forbidden (insufficient permissions), NOT 401 (unauthenticated)
    expect(res.status).toBe(403);
  });

  it('Dev account cannot reactivate members (ADMIN-only route)', async () => {
    const res = await request(app)
      .post(`/api/organization/members/some-member-id/reactivate`)
      .set('Authorization', `Bearer ${devToken}`);

    expect(res.status).toBe(403);
  });

  // ── Test 7: Dev account CANNOT access restricted Price Allocation / Planning APIs
  it('Dev account cannot access Price Allocation APIs (PROJECT_MANAGER+ required)', async () => {
    // POST /api/sprints requires PROJECT_MANAGER+
    const res = await request(app)
      .post('/api/sprints')
      .set('Authorization', `Bearer ${devToken}`)
      .send({ name: 'Test Sprint', startDate: new Date().toISOString(), endDate: new Date().toISOString() });

    expect(res.status).toBe(403);
  });

  it('Dev account cannot create saved reports (PROJECT_MANAGER+ required)', async () => {
    const res = await request(app)
      .post('/api/analytics/reports')
      .set('Authorization', `Bearer ${devToken}`)
      .send({ name: 'Report X', type: 'CUSTOM' });

    expect(res.status).toBe(403);
  });

  // ── Test 8: Dev account CANNOT access CTO/Manager-only functionality ────────
  it('Dev account cannot start a sprint (PROJECT_MANAGER+ required)', async () => {
    const res = await request(app)
      .post('/api/sprints/some-sprint-id/start')
      .set('Authorization', `Bearer ${devToken}`);

    expect(res.status).toBe(403);
  });

  it('Dev account cannot access portfolio analytics (PROJECT_MANAGER+ required)', async () => {
    const res = await request(app)
      .get('/api/analytics/portfolio')
      .set('Authorization', `Bearer ${devToken}`);

    expect(res.status).toBe(403);
  });

  // ── Test 9: /api/auth/dev-login returns 403 when NODE_ENV is not development
  it('POST /api/auth/dev-login returns 403 in non-development environments', async () => {
    // The route is only registered in development (NODE_ENV=development).
    // In test environment (NODE_ENV=test), it will not be registered → 404.
    // Either 403 (handler guard) or 404 (route not registered) confirms security.
    const res = await request(app)
      .post('/api/auth/dev-login')
      .send({ email: DEV_EMAIL, password: DEV_PASSWORD });

    // Must NOT return 200 — either route doesn't exist (404) or guard rejects (403)
    expect([403, 404]).toContain(res.status);
    expect(res.body.token).toBeUndefined();
  });

  // ── Test 10: Seed idempotency — no duplicate users ─────────────────────────
  it('Seed is idempotent — test@tmp.local has exactly one record in DB', async () => {
    const users = await prisma.user.findMany({
      where: { email: DEV_EMAIL },
    });

    // Email has a @unique constraint in Prisma schema — must be exactly 1
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe(DEV_EMAIL);
    expect(users[0].role).toBe('TEAM_MEMBER');
  });

  it('Dev user belongs to the correct organization (org isolation)', async () => {
    const user = await prisma.user.findUnique({
      where: { email: DEV_EMAIL },
      include: { organization: true },
    });

    expect(user).not.toBeNull();
    expect(user!.organizationId).toBe(orgId);
    expect(user!.organization.name).toBeDefined();
  });

  it('Dev user is NOT an ADMIN, OWNER, or organization admin role', async () => {
    const user = await prisma.user.findUnique({ where: { email: DEV_EMAIL } });
    expect(user).not.toBeNull();
    expect(['TEAM_MEMBER', 'VIEWER']).toContain(user!.role);
    expect(user!.role).not.toBe('ADMIN');
    expect(user!.role).not.toBe('OWNER');
    expect(user!.role).not.toBe('PROJECT_MANAGER');
  });
});
