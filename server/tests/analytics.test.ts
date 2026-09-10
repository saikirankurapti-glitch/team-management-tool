import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Phase 6 - Analytics & Reporting Integration Tests', () => {
  let token: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sai@demostartup.com', password: 'Password123!' });

    token = loginRes.body.token;
  });

  it('Fetch Executive Analytics Overview and Project Health list', async () => {
    const res = await request(app)
      .get('/api/analytics')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.avgCycleTimeDays).toBeDefined();
    expect(Array.isArray(res.body.projectHealthList)).toBe(true);
  });

  it('Fetch Team Workload & Cross-Project Workload Matrix', async () => {
    const res = await request(app)
      .get('/api/analytics/team')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.workloadMatrix)).toBe(true);
    expect(res.body.workloadMatrix[0].capacityHours).toBe(40);
  });

  it('Fetch Kanban Flow Analytics & WIP Aging', async () => {
    const res = await request(app)
      .get('/api/analytics/flow')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.statusCounts).toBeDefined();
    expect(Array.isArray(res.body.wipAging)).toBe(true);
  });

  it('Fetch Bug Quality Metrics & Resolution Times', async () => {
    const res = await request(app)
      .get('/api/analytics/bugs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.totalBugs).toBeDefined();
    expect(res.body.summary.avgResolutionDays).toBeDefined();
  });

  it('Fetch Individual Member Analytics', async () => {
    const res = await request(app)
      .get('/api/analytics/members')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.summary.activeWorkCount).toBeDefined();
  });

  it('Export Analytics CSV', async () => {
    const res = await request(app)
      .get('/api/analytics/export')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });

  it('Create and Fetch Saved Reports', async () => {
    const createRes = await request(app)
      .post('/api/analytics/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Engineering Monthly Delivery Report',
        description: 'Monthly throughput and cycle time trends for engineering team',
        filters: { team: 'engineering' },
        metrics: { cycleTime: true, throughput: true },
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe('Engineering Monthly Delivery Report');

    const getRes = await request(app)
      .get('/api/analytics/reports')
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.body)).toBe(true);
  });
});
