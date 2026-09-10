import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Phase 3 - Sprint Management Integration Tests', () => {
  let token: string;
  let projectId: string;
  let teamId: string;
  let sprintId: string;

  beforeAll(async () => {
    // Login as Sai Kumar (OWNER / PM role)
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sai@demostartup.com', password: 'Password123!' });

    token = loginRes.body.token;

    // Fetch existing projects & teams
    const projRes = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`);
    projectId = projRes.body[0].id;

    const teamRes = await request(app)
      .get('/api/teams')
      .set('Authorization', `Bearer ${token}`);
    teamId = teamRes.body[0].id;
  });

  it('Create Sprint validation (fails when end date is before start date)', async () => {
    const res = await request(app)
      .post('/api/sprints')
      .set('Authorization', `Bearer ${token}`)
      .send({
        projectId,
        teamId,
        name: 'Invalid Date Sprint',
        startDate: '2026-10-15',
        endDate: '2026-10-01',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('End date must be strictly after start date');
  });

  it('Create Sprint successfully with valid parameters', async () => {
    const res = await request(app)
      .post('/api/sprints')
      .set('Authorization', `Bearer ${token}`)
      .send({
        projectId,
        teamId,
        name: 'Sprint 16 - Integration Testing',
        goal: 'Complete Phase 3 automated test suite and velocity metrics.',
        startDate: '2026-10-01',
        endDate: '2026-10-15',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('PLANNED');
    sprintId = res.body.id;
  });

  it('Start Sprint transition status to ACTIVE', async () => {
    const res = await request(app)
      .post(`/api/sprints/${sprintId}/start`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('Get Sprint capacity calculation per team member', async () => {
    const res = await request(app)
      .get(`/api/sprints/${sprintId}/capacity`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].capacityHours).toBeDefined();
  });

  it('Get Team Velocity metrics across completed sprints', async () => {
    const res = await request(app)
      .get('/api/sprints/velocity')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.avgVelocity).toBeDefined();
    expect(Array.isArray(res.body.velocityHistory)).toBe(true);
  });

  it('Complete Sprint and carry over unfinished items to backlog', async () => {
    const res = await request(app)
      .post(`/api/sprints/${sprintId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        carryOverOption: 'BACKLOG',
      });

    expect(res.status).toBe(200);
    expect(res.body.sprint.status).toBe('COMPLETED');
  });
});
