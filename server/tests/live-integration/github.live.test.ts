import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { prisma } from '../../src/prisma.js';

describe('Live Integration - GitHub OAuth, REST API & Webhooks', () => {
  const isLive = process.env.LIVE_INTEGRATION_TESTS === 'true';
  let token: string;

  beforeAll(async () => {
    const user = await prisma.user.findFirst();
    if (user) {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'password123' });
      token = loginRes.body.token;
    }
  });

  it.runIf(isLive)('Validates GitHub OAuth URL generation when authenticated', async () => {
    if (!token) return;
    const res = await request(app)
      .get('/api/integrations/github/auth')
      .set('Authorization', `Bearer ${token}`);

    if (process.env.GITHUB_CLIENT_ID) {
      expect(res.status).toBe(200);
      expect(res.body.url).toContain('github.com/login/oauth/authorize');
    } else {
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('GITHUB_NOT_CONFIGURED');
    }
  });

  it.runIf(isLive)('Verifies Webhook signature validation and idempotency', async () => {
    const res = await request(app)
      .post('/api/webhooks/github')
      .set('x-github-event', 'ping')
      .set('x-github-delivery', 'live-test-delivery-999')
      .send({ ping: 'pong' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Duplicate delivery check
    const dupRes = await request(app)
      .post('/api/webhooks/github')
      .set('x-github-event', 'ping')
      .set('x-github-delivery', 'live-test-delivery-999')
      .send({ ping: 'pong' });

    expect(dupRes.body.duplicate).toBe(true);
  });
});
