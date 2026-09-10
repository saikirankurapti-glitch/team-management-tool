import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import app from '../src/index';

describe('Phase 9 - Engineering Integrations & Automation Integration Tests', () => {
  let token: string;
  let integrationId: string;
  let workItemId: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sai@demostartup.com', password: 'Password123!' });

    token = loginRes.body.token;

    // Fetch a work item for testing
    const itemRes = await request(app)
      .get('/api/work-items')
      .set('Authorization', `Bearer ${token}`);

    if (itemRes.body.length > 0) {
      workItemId = itemRes.body[0].id;
    }
  });

  it('Create GitHub Integration connection', async () => {
    const res = await request(app)
      .post('/api/integrations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        provider: 'GITHUB',
        name: 'GitHub Production Org',
        accountName: 'demostartup-inc',
        webhookSecret: 'test_webhook_secret_key',
      });

    expect(res.status).toBe(201);
    expect(res.body.provider).toBe('GITHUB');
    expect(res.body.status).toBe('CONNECTED');
    integrationId = res.body.id;
  });

  it('Fetch Integrations list and event logs', async () => {
    const res = await request(app)
      .get('/api/integrations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('Process GitHub Webhook with HMAC signature & auto-reference detection', async () => {
    const payload = {
      action: 'opened',
      pull_request: {
        number: 481,
        title: 'Fix API timeout issue [CUST-104]',
        state: 'open',
        head: { ref: 'bugfix/CUST-104-api-timeout' },
        base: { ref: 'main' },
        html_url: 'https://github.com/demostartup-inc/api/pull/481',
      },
      repository: {
        name: 'api-service',
        full_name: 'demostartup-inc/api-service',
        html_url: 'https://github.com/demostartup-inc/api-service',
      },
    };

    const secret = 'test_webhook_secret_key';
    process.env.GITHUB_WEBHOOK_SECRET = secret;
    const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');

    const res = await request(app)
      .post('/api/webhooks/github')
      .set('x-github-event', 'pull_request')
      .set('x-hub-signature-256', signature)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('Create Automation Rule and toggle status', async () => {
    const createRes = await request(app)
      .post('/api/automations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Auto-move to Testing on PR Merge',
        trigger: 'PR_MERGED',
        conditions: { projectId: 'test-project' },
        actions: [{ type: 'CHANGE_WORK_ITEM_STATUS', targetStatus: 'TESTING' }],
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe('Auto-move to Testing on PR Merge');

    const ruleId = createRes.body.id;
    const toggleRes = await request(app)
      .patch(`/api/automations/${ruleId}/toggle`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: false });

    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.success).toBe(true);
  });

  it('Fetch Work Item Development Activity and Delivery Timeline', async () => {
    if (!workItemId) return;

    const res = await request(app)
      .get(`/api/work-items/${workItemId}/development`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.suggestedBranch).toBeDefined();
    expect(Array.isArray(res.body.deliveryTimeline)).toBe(true);
  });

  it('Fetch Daily Team Digest', async () => {
    const res = await request(app)
      .get('/api/digest')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(Array.isArray(res.body.completedYesterday)).toBe(true);
  });
});
