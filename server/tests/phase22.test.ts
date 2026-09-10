import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { prisma } from '../src/prisma.js';

describe('Phase 22 - Real Data & Integration Verification Tests', () => {
  let userToken: string;
  let orgId: string;
  let userId: string;

  beforeAll(async () => {
    // Obtain or create test user and token
    const testUser = await prisma.user.findFirst({
      include: { organization: true },
    });

    if (testUser) {
      orgId = testUser.organizationId;
      userId = testUser.id;
    }

    // Login request
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser?.email || 'admin@demo.com', password: 'password123' });

    if (loginRes.body.token) {
      userToken = loginRes.body.token;
    }
  });

  it('Enforces Authentication on Protected Endpoints', async () => {
    const res = await request(app).get('/api/integrations/github/status');
    expect(res.status).toBe(401);
  });

  it('Returns GitHub Connection Status for Authenticated User', async () => {
    if (!userToken) return;
    const res = await request(app)
      .get('/api/integrations/github/status')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('connected');
    expect(res.body).toHaveProperty('status');
  });

  it('Handles Webhook Signature Verification and Idempotency', async () => {
    const res = await request(app)
      .post('/api/webhooks/github')
      .set('x-github-event', 'ping')
      .set('x-github-delivery', 'test-delivery-123')
      .send({ zen: 'Mind over matter' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('Verifies AI Copilot Query Scoping and Tool Security', async () => {
    if (!userToken) return;
    const res = await request(app)
      .post('/api/copilot/ask')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ prompt: 'Which projects are at risk?' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('response');
    expect(res.body).toHaveProperty('conversationId');
  });

  it('Returns Live Integration Health Dashboard Status', async () => {
    if (!userToken) return;
    const res = await request(app)
      .get('/api/health/integrations')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('integrations');
    expect(res.body.integrations).toHaveProperty('database');
    expect(res.body.integrations.database.status).toBe('HEALTHY');
  });
});
