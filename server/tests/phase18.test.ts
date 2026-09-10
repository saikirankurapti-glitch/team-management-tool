import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';
import { AiCircuitBreaker } from '../src/services/AiCircuitBreaker';

describe('Phase 18 - Enterprise Scale, Reliability & Operational Excellence Tests', () => {
  let token: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sai@demostartup.com', password: 'Password123!' });

    token = loginRes.body.token;
  });

  it('Validate Liveness, Readiness, and Dependency Health Endpoints', async () => {
    const liveRes = await request(app).get('/health/live');
    expect(liveRes.status).toBe(200);
    expect(liveRes.body.status).toBe('UP');

    const readyRes = await request(app).get('/health/ready');
    expect(readyRes.status).toBe(200);
    expect(readyRes.body.status).toBe('READY');

    const depsRes = await request(app).get('/health/deps');
    expect(depsRes.status).toBe(200);
    expect(depsRes.body.status).toBe('HEALTHY');
  });

  it('Enqueue Background Job & Process Queue Execution', async () => {
    const jobRes = await request(app)
      .post('/api/v1/ops/jobs/enqueue')
      .set('Authorization', `Bearer ${token}`)
      .send({ jobType: 'NOTIFICATION', payload: { userId: '123', event: 'TASK_ASSIGNED' } });

    expect(jobRes.status).toBe(201);
    expect(jobRes.body.success).toBe(true);
    expect(jobRes.body.job.jobType).toBe('NOTIFICATION');
  });

  it('Execute Webhook Event Replay Simulator', async () => {
    const replayRes = await request(app)
      .post('/api/v1/ops/webhooks/replay')
      .set('Authorization', `Bearer ${token}`)
      .send({ webhookId: 'wh-101', eventType: 'work_item.created.v1' });

    expect(replayRes.status).toBe(200);
    expect(replayRes.body.success).toBe(true);
  });

  it('Fetch Operational Metrics Telemetry', async () => {
    const opsRes = await request(app)
      .get('/api/v1/ops/metrics')
      .set('Authorization', `Bearer ${token}`);

    expect(opsRes.status).toBe(200);
    expect(opsRes.body.metrics).toBeDefined();
    expect(opsRes.body.jobs).toBeDefined();
  });

  it('Verify AI Circuit Breaker Fault Isolation', async () => {
    // Simulate AI provider failures
    const failingTask = async () => {
      throw new Error('AI Provider Unavailable');
    };

    const fallbackResult = await AiCircuitBreaker.execute(failingTask, () => ({
      reply: 'AI is temporarily offline. Core work management remains unaffected.',
    }));

    expect(fallbackResult.reply).toContain('temporarily offline');
  });
});
