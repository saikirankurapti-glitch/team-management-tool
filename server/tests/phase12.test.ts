import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';
import { checkEntitlement } from '../src/services/entitlementEngine';

describe('Phase 12 - Enterprise Readiness, Multi-Tenancy & SaaS Platform Tests', () => {
  let token: string;
  let orgId: string;
  let keyId: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sai@demostartup.com', password: 'Password123!' });

    token = loginRes.body.token;
    orgId = loginRes.body.user.organizationId;
  });

  it('Health & Readiness endpoints return proper operational status', async () => {
    const healthRes = await request(app).get('/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('healthy');

    const readyRes = await request(app).get('/ready');
    expect(readyRes.status).toBe(200);
    expect(readyRes.body.status).toBe('ready');
    expect(readyRes.headers['x-correlation-id']).toBeDefined();
  });

  it('Create and Revoke Enterprise API Key with Scopes', async () => {
    const createRes = await request(app)
      .post('/api/v1/keys')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'CI/CD Pipeline Key',
        scopes: ['projects:read', 'work_items:write'],
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.secret).toBeDefined();
    expect(createRes.body.keyPrefix).toBeDefined();
    keyId = createRes.body.id;

    const listRes = await request(app)
      .get('/api/v1/keys')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);

    const revokeRes = await request(app)
      .delete(`/api/v1/keys/${keyId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.success).toBe(true);
  });

  it('Register Customer Outbound Webhook Endpoint', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        url: 'https://clientapp.com/webhooks/receiver',
        events: ['work_item.completed', 'bug.created'],
      });

    expect(res.status).toBe(201);
    expect(res.body.secret).toBeDefined();
    expect(res.body.status).toBe('ACTIVE');
  });

  it('Fetch Security Center Overview', async () => {
    const res = await request(app)
      .get('/api/v1/security')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.securityOverview.ssoStatus).toBeDefined();
    expect(Array.isArray(res.body.recentSecurityEvents)).toBe(true);
  });

  it('SaaS Entitlement Engine enforces tenant resource limits', async () => {
    const result = await checkEntitlement(orgId, 'PROJECTS');
    expect(result.allowed).toBe(true);
    expect(result.plan).toBeDefined();
  });
});
