import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Startup Platform API Integration Tests', () => {
  let authToken: string;

  it('Health check endpoint returns healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('Login as Sai Kumar (Owner) returns JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sai@demostartup.com', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.fullName).toBe('Sai Kumar');
    authToken = res.body.token;
  });

  it('Get current user profile (/api/auth/me)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('sai@demostartup.com');
  });

  it('Get projects list (/api/projects)', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('Get work items list (/api/work-items)', async () => {
    const res = await request(app)
      .get('/api/work-items')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('Get team workload breakdown (/api/teams/workload)', async () => {
    const res = await request(app)
      .get('/api/teams/workload')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(6); // All 6 team members
  });

  it('Get analytics metrics calculated from status history (/api/analytics)', async () => {
    const res = await request(app)
      .get('/api/analytics')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.avgCycleTimeDays).toBeDefined();
  });
});
