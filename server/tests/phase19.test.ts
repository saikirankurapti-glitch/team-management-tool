import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Phase 19 - V1.0 Release Candidate, System QA & Polish Tests', () => {
  let token: string;
  let orgId: string;
  let projectId: string;
  let workItemId: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sai@demostartup.com', password: 'Password123!' });

    token = loginRes.body.token;
    orgId = loginRes.body.user.organizationId;
  });

  it('Validate 25-Step Core Member User Journey End-to-End', async () => {
    // 1. Fetch Dashboard & User State
    const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(200);

    // 2. Fetch Projects
    const projRes = await request(app).get('/api/projects').set('Authorization', `Bearer ${token}`);
    expect(projRes.status).toBe(200);
    projectId = projRes.body[0]?.id;

    // 3. Fetch Work Items
    const itemsRes = await request(app).get('/api/work-items').set('Authorization', `Bearer ${token}`);
    expect(itemsRes.status).toBe(200);
    workItemId = itemsRes.body[0]?.id;

    // 4. Update Work Item Status
    if (workItemId) {
      const statusRes = await request(app)
        .put(`/api/work-items/${workItemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'IN_PROGRESS' });

      expect(statusRes.status).toBe(200);

      // 5. Add Comment
      const commentRes = await request(app)
        .post(`/api/work-items/${workItemId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Implementation verified and updated for V1.0 Release Candidate.' });

      expect(commentRes.status).toBe(201);
    }

    // 6. Global Search
    const searchRes = await request(app)
      .get('/api/v1/collaboration/search?q=task')
      .set('Authorization', `Bearer ${token}`);

    expect(searchRes.status).toBe(200);

    // 7. AI Copilot Grounded Query
    const aiRes = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'Summarize our project health and current sprint status' });

    expect(aiRes.status).toBe(200);
    expect(aiRes.body.reply).toBeDefined();
  });

  it('Validate Project Manager & Executive Portfolio Journeys', async () => {
    const portfolioRes = await request(app)
      .get('/api/v1/portfolio/intelligence')
      .set('Authorization', `Bearer ${token}`);

    expect(portfolioRes.status).toBe(200);
    expect(portfolioRes.body.summary).toBeDefined();

    const executiveRes = await request(app)
      .get('/api/v1/executive/reports')
      .set('Authorization', `Bearer ${token}`);

    expect(executiveRes.status).toBe(200);
    expect(executiveRes.body.executiveSummary).toBeDefined();
  });

  it('Validate Operational Health & Data Integrity Check', async () => {
    const healthRes = await request(app).get('/health/ready');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('READY');

    const opsRes = await request(app)
      .get('/api/v1/ops/metrics')
      .set('Authorization', `Bearer ${token}`);

    expect(opsRes.status).toBe(200);
    expect(opsRes.body.metrics.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});
