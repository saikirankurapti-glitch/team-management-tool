import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Phase 11 - AI Copilot & Natural-Language Operations Integration Tests', () => {
  let token: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sai@demostartup.com', password: 'Password123!' });

    token = loginRes.body.token;
  });

  it('Copilot query for project risk explanations', async () => {
    const res = await request(app)
      .post('/api/copilot/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'Which projects are at risk and why?' });

    expect(res.status).toBe(200);
    expect(res.body.response).toBeDefined();
    expect(res.body.toolInvoked).toBe('get_risks');
    expect(Array.isArray(res.body.sources)).toBe(true);
  });

  it('Copilot query for team capacity allocation', async () => {
    const res = await request(app)
      .post('/api/copilot/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'Who is overloaded this sprint?' });

    expect(res.status).toBe(200);
    expect(res.body.response).toBeDefined();
    expect(res.body.toolInvoked).toBe('get_team_capacity');
  });

  it('Propose work item draft creation with Human Confirmation Gate', async () => {
    const askRes = await request(app)
      .post('/api/copilot/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'Create bug for payment API timeout' });

    expect(askRes.status).toBe(200);
    expect(askRes.body.proposal).toBeDefined();
    expect(askRes.body.proposal.requiresConfirmation).toBe(true);

    const confirmRes = await request(app)
      .post('/api/copilot/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ proposal: askRes.body.proposal });

    expect(confirmRes.status).toBe(201);
    expect(confirmRes.body.success).toBe(true);
    expect(confirmRes.body.workItem.humanId).toBeDefined();
  });

  it('Propose work item status update with Human Confirmation Gate', async () => {
    const askRes = await request(app)
      .post('/api/copilot/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'Move PROJ-101 to Testing' });

    expect(askRes.status).toBe(200);
    expect(askRes.body.proposal).toBeDefined();
    expect(askRes.body.proposal.requiresConfirmation).toBe(true);
  });

  it('Fetch AI Audit Logs & Governance Settings', async () => {
    const logRes = await request(app)
      .get('/api/copilot/logs')
      .set('Authorization', `Bearer ${token}`);

    expect(logRes.status).toBe(200);
    expect(Array.isArray(logRes.body)).toBe(true);

    const setRes = await request(app)
      .get('/api/copilot/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(setRes.status).toBe(200);
    expect(setRes.body.monthlyUsageLimit).toBeDefined();
  });
});
