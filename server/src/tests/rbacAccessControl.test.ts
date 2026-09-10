import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';
import router from '../routes/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-token-key-change-in-production-12345';

describe('Phase 45 — Strict RBAC & API Route Protection Test Suite', () => {
  let app: express.Express;
  let adminToken: string;
  let pmToken: string;
  let teamMemberToken: string;
  let testProjectId: string;

  beforeAll(async () => {
    await prisma.$connect();

    app = express();
    app.use(express.json());
    app.use('/api', router);

    // Get real users
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN', isActive: true },
    });
    const ownerUser = await prisma.user.findFirst({
      where: { role: 'OWNER', isActive: true },
    });
    const teamMemberUser = await prisma.user.findFirst({
      where: { role: 'TEAM_MEMBER', isActive: true },
    });

    if (!adminUser || !teamMemberUser) {
      throw new Error('Required test users not found in database');
    }

    const testProject = await prisma.project.findFirst();
    testProjectId = testProject?.key || testProject?.id || 'PROJ';

    // Generate valid tokens
    adminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: adminUser.role, organizationId: adminUser.organizationId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create a temporary PM payload for testing PM level
    pmToken = jwt.sign(
      { id: teamMemberUser.id, email: teamMemberUser.email, role: 'PROJECT_MANAGER', organizationId: teamMemberUser.organizationId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    teamMemberToken = jwt.sign(
      { id: teamMemberUser.id, email: teamMemberUser.email, role: 'TEAM_MEMBER', organizationId: teamMemberUser.organizationId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  describe('1. TEAM_MEMBER Role Restrictions (Strict 403 Tests)', () => {
    it('denies TEAM_MEMBER from viewing security allowlist (403)', async () => {
      const res = await request(app)
        .get('/api/security/allowlist')
        .set('Authorization', `Bearer ${teamMemberToken}`);
      expect(res.status).toBe(403);
    });

    it('denies TEAM_MEMBER from viewing access requests (403)', async () => {
      const res = await request(app)
        .get('/api/security/access-requests')
        .set('Authorization', `Bearer ${teamMemberToken}`);
      expect(res.status).toBe(403);
    });

    it('denies TEAM_MEMBER from viewing billing overview (403)', async () => {
      const res = await request(app)
        .get('/api/v1/billing')
        .set('Authorization', `Bearer ${teamMemberToken}`);
      expect(res.status).toBe(403);
    });

    it('denies TEAM_MEMBER from viewing API keys (403)', async () => {
      const res = await request(app)
        .get('/api/v1/keys')
        .set('Authorization', `Bearer ${teamMemberToken}`);
      expect(res.status).toBe(403);
    });

    it('denies TEAM_MEMBER from viewing developer webhooks (403)', async () => {
      const res = await request(app)
        .get('/api/v1/webhooks')
        .set('Authorization', `Bearer ${teamMemberToken}`);
      expect(res.status).toBe(403);
    });

    it('denies TEAM_MEMBER from viewing governance policies (403)', async () => {
      const res = await request(app)
        .get('/api/v1/governance/policies')
        .set('Authorization', `Bearer ${teamMemberToken}`);
      expect(res.status).toBe(403);
    });

    it('denies TEAM_MEMBER from viewing governance configuration health (403)', async () => {
      const res = await request(app)
        .get('/api/v1/governance/health')
        .set('Authorization', `Bearer ${teamMemberToken}`);
      expect(res.status).toBe(403);
    });

    it('denies TEAM_MEMBER from viewing operational metrics (403)', async () => {
      const res = await request(app)
        .get('/api/v1/ops/metrics')
        .set('Authorization', `Bearer ${teamMemberToken}`);
      expect(res.status).toBe(403);
    });

    it('denies TEAM_MEMBER from viewing commercial project pricing (403)', async () => {
      const res = await request(app)
        .get(`/api/projects/${testProjectId}/pricing`)
        .set('Authorization', `Bearer ${teamMemberToken}`);
      expect(res.status).toBe(403);
    });

    it('denies TEAM_MEMBER from viewing commercial rate cards (403)', async () => {
      const res = await request(app)
        .get('/api/rate-cards')
        .set('Authorization', `Bearer ${teamMemberToken}`);
      expect(res.status).toBe(403);
    });

    it('denies TEAM_MEMBER from viewing executive dashboard analytics (403)', async () => {
      const res = await request(app)
        .get('/api/analytics/executive')
        .set('Authorization', `Bearer ${teamMemberToken}`);
      expect(res.status).toBe(403);
    });

    it('denies TEAM_MEMBER from viewing portfolio intelligence (403)', async () => {
      const res = await request(app)
        .get('/api/v1/portfolio/intelligence')
        .set('Authorization', `Bearer ${teamMemberToken}`);
      expect(res.status).toBe(403);
    });

    it('denies TEAM_MEMBER from viewing capacity planning (403)', async () => {
      const res = await request(app)
        .get('/api/capacity')
        .set('Authorization', `Bearer ${teamMemberToken}`);
      expect(res.status).toBe(403);
    });

    it('denies TEAM_MEMBER from allocating resources (403)', async () => {
      const res = await request(app)
        .post(`/api/projects/${testProjectId}/resources/allocate`)
        .set('Authorization', `Bearer ${teamMemberToken}`)
        .send({ userId: 'dummy', startDate: '2026-09-01', endDate: '2026-09-30' });
      expect(res.status).toBe(403);
    });

    it('denies TEAM_MEMBER from viewing GitHub integration secret config (403)', async () => {
      const res = await request(app)
        .get('/api/integrations/github/config')
        .set('Authorization', `Bearer ${teamMemberToken}`);
      expect(res.status).toBe(403);
    });

    it('denies TEAM_MEMBER from viewing Google integration secret config (403)', async () => {
      const res = await request(app)
        .get('/api/integrations/google/config')
        .set('Authorization', `Bearer ${teamMemberToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('2. ADMIN Role Access (Full Allowed Tests)', () => {
    it('allows ADMIN to access security allowlist (200)', async () => {
      const res = await request(app)
        .get('/api/security/allowlist')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('allows ADMIN to access security access requests (200)', async () => {
      const res = await request(app)
        .get('/api/security/access-requests')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('allows ADMIN to access billing overview (200)', async () => {
      const res = await request(app)
        .get('/api/v1/billing')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('allows ADMIN to access governance policies (200)', async () => {
      const res = await request(app)
        .get('/api/v1/governance/policies')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('allows ADMIN to access commercial project pricing (200)', async () => {
      const res = await request(app)
        .get(`/api/projects/${testProjectId}/pricing`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('allows ADMIN to access rate cards (200)', async () => {
      const res = await request(app)
        .get('/api/rate-cards')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('allows ADMIN to access capacity planning (200)', async () => {
      const res = await request(app)
        .get('/api/capacity')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('3. Sensitive Data Masking & Endpoint Protection for Regular Members', () => {
    it('blocks resource allocations / price allocation endpoint for regular team members with 403', async () => {
      const res = await request(app)
        .get(`/api/projects/${testProjectId}/resources`)
        .set('Authorization', `Bearer ${teamMemberToken}`);
      expect(res.status).toBe(403);
    });

    it('allows normal team member to access permitted everyday work items and projects', async () => {
      const resProj = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${teamMemberToken}`);
      expect(resProj.status).toBe(200);

      const resWork = await request(app)
        .get('/api/work-items')
        .set('Authorization', `Bearer ${teamMemberToken}`);
      expect(resWork.status).toBe(200);
    });
  });
});
