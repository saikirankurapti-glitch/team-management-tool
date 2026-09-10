import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { prisma } from '../../src/prisma.js';

describe('Live Integration - AI Copilot Tools & Security Scoping', () => {
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

  it.runIf(isLive)('Queries DB projects via Copilot ask endpoint', async () => {
    if (!token) return;
    const res = await request(app)
      .post('/api/copilot/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'What projects do I currently have access to?' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('response');
    expect(res.body).toHaveProperty('conversationId');
  });

  it.runIf(isLive)('Produces Action Proposal Preview for write action request', async () => {
    if (!token) return;
    const res = await request(app)
      .post('/api/copilot/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'Create task called Integration Test Task' });

    expect(res.status).toBe(200);
    expect(res.body.proposal).not.toBeNull();
    expect(res.body.proposal.requiresConfirmation).toBe(true);
  });
});
