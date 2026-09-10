import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Phase 10 - Advanced Analytics, Portfolio Intelligence & Executive Reporting Tests', () => {
  let token: string;
  let savedReportId: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sai@demostartup.com', password: 'Password123!' });

    token = loginRes.body.token;

    // Fetch or create a saved report for schedule tests
    const repRes = await request(app)
      .get('/api/analytics/reports')
      .set('Authorization', `Bearer ${token}`);

    if (repRes.body.length > 0) {
      savedReportId = repRes.body[0].id;
    } else {
      const newRep = await request(app)
        .post('/api/analytics/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Portfolio Report', filters: {}, metrics: {} });
      savedReportId = newRep.body.id;
    }
  });

  it('Fetch Portfolio Intelligence & Project Matrix', async () => {
    const res = await request(app)
      .get('/api/analytics/portfolio')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.totalProjects).toBeDefined();
    expect(Array.isArray(res.body.projectMatrix)).toBe(true);
    expect(res.body.monteCarloForecast).toBeDefined();
    expect(res.body.monteCarloForecast.confidence50.date).toBeDefined();
    expect(Array.isArray(res.body.resourceConflicts)).toBe(true);
  });

  it('Fetch Early Warning Risk Observations & Log New Risk', async () => {
    const getRes = await request(app)
      .get('/api/analytics/risks')
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.body)).toBe(true);

    const createRes = await request(app)
      .post('/api/analytics/risks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        severity: 'HIGH',
        sourceMetric: 'CAPACITY',
        title: 'Team Capacity Overload in Sprint 9',
        reason: 'Developer Kiran assigned 44 hours of work exceeding 40h capacity.',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.severity).toBe('HIGH');
  });

  it('Fetch Executive Dashboard Overview', async () => {
    const res = await request(app)
      .get('/api/analytics/executive')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.executiveSummary.activeProjects).toBeDefined();
    expect(Array.isArray(res.body.topRisks)).toBe(true);
    expect(Array.isArray(res.body.projectStatusBreakdown)).toBe(true);
  });

  it('Create and Fetch Scheduled Report', async () => {
    if (!savedReportId) return;

    const createRes = await request(app)
      .post('/api/analytics/schedules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        savedReportId,
        frequency: 'WEEKLY',
        recipients: ['sai@demostartup.com'],
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.frequency).toBe('WEEKLY');

    const getRes = await request(app)
      .get('/api/analytics/schedules')
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.body)).toBe(true);
  });
});
