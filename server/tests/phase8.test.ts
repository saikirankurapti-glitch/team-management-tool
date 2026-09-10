import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Phase 8 - Pilot Readiness & Multi-Project Regression Tests', () => {
  let token: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sai@demostartup.com', password: 'Password123!' });

    token = loginRes.body.token;
  });

  it('Verify 6-member startup team & multi-project setup', async () => {
    const projRes = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`);

    expect(projRes.status).toBe(200);
    expect(projRes.body.length).toBeGreaterThanOrEqual(3);

    const memberRes = await request(app)
      .get('/api/organization/members')
      .set('Authorization', `Bearer ${token}`);

    expect(memberRes.status).toBe(200);
    expect(memberRes.body.length).toBe(6);
  });

  it('Submit pilot user feedback via POST /api/feedback', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'UX_ISSUE',
        pageUrl: '/analytics',
        description: 'Kanban drag-and-drop touch response is smooth. Would love auto-scroll during drag.',
      });

    expect(res.status).toBe(201);
    expect(res.body.category).toBe('UX_ISSUE');
    expect(res.body.user.email).toBe('sai@demostartup.com');
  });

  it('Fetch pilot feedbacks list via GET /api/feedback', async () => {
    const res = await request(app)
      .get('/api/feedback')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('Verify cross-project My Work unified list', async () => {
    const res = await request(app)
      .get('/api/work-items?assigneeId=me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
