import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { prisma } from '../../src/prisma.js';

describe('Live Integration - AI Copilot Tools & Security Scoping', () => {
  let token: string;
  let isAiConfigured = false;

  beforeAll(async () => {
    const user = await prisma.user.findFirst();
    if (user) {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'password123' });
      token = loginRes.body.token;
    }
  });

  it('Rejects unauthenticated Copilot health check', async () => {
    const res = await request(app).get('/api/copilot/health');
    expect(res.status).toBe(401);
  });

  it('Returns Copilot health diagnostics for authenticated user', async () => {
    if (!token) return;
    const res = await request(app)
      .get('/api/copilot/health')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('provider');
    expect(res.body).toHaveProperty('model');
    expect(res.body).toHaveProperty('apiKeyConfigured');
    expect(res.body).toHaveProperty('providerReachable');

    isAiConfigured = res.body.providerReachable;
  });

  it('Fails gracefully when querying Copilot if API key is invalid or missing', async () => {
    if (!token || isAiConfigured) return;
    const res = await request(app)
      .post('/api/copilot/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'Which projects are at risk?' });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Gemini AI is not configured|Gemini authentication failed/i);
  });

  it('Queries DB projects via Copilot ask endpoint (if configured)', async () => {
    if (!token || !isAiConfigured) return;
    const res = await request(app)
      .post('/api/copilot/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'What projects do I currently have access to?' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('response');
    expect(res.body).toHaveProperty('conversationId');
  });

  it('Produces Action Proposal Preview for write action request (if configured)', async () => {
    if (!token || !isAiConfigured) return;
    const res = await request(app)
      .post('/api/copilot/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'Create task called Integration Test Task' });

    expect(res.status).toBe(200);
    expect(res.body.proposal).not.toBeNull();
  });
});
