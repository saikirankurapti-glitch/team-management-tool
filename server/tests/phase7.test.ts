import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Phase 7 - Production Hardening, Security & Health Integration Tests', () => {
  let token: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sai@demostartup.com', password: 'Password123!' });

    token = loginRes.body.token;
  });

  it('GET /health returns 200 with status healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /ready returns 200 with database connection verified', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.database).toBe('connected');
  });

  it('Unauthenticated request to protected endpoint returns 401', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });

  it('Sanitized login error does not reveal account existence', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent@startup.com', password: 'WrongPassword123!' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('XSS script injection attempt in work item title is stored safely', async () => {
    const projRes = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`);

    if (projRes.body.length > 0) {
      const projectId = projRes.body[0].id;
      const res = await request(app)
        .post('/api/work-items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          projectId,
          title: '<script>alert("xss")</script> Test Bug',
          type: 'BUG',
          priority: 'HIGH',
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toContain('<script>');
    }
  });
});
