import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Phase 14 - Product-Led Growth, Ecosystem, Templates & Extensibility Tests', () => {
  let token: string;
  let orgId: string;
  let webhookId: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sai@demostartup.com', password: 'Password123!' });

    token = loginRes.body.token;
    orgId = loginRes.body.user.organizationId;

    // Register a webhook endpoint for test events
    const whRes = await request(app)
      .post('/api/v1/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://testclient.com/hooks', events: ['work_item.created'] });

    webhookId = whRes.body.id;
  });

  it('Fetch Built-in & Custom Project Templates', async () => {
    const res = await request(app)
      .get('/api/v1/templates')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.builtinTemplates)).toBe(true);
    expect(res.body.builtinTemplates.length).toBeGreaterThan(0);
  });

  it('Instantiate Project from Template with Variable Resolution', async () => {
    const res = await request(app)
      .post('/api/v1/templates/instantiate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        templateId: 'agile-software',
        projectName: 'Growth Marketing Project',
        projectKey: 'GKTMP',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.project.name).toBe('Growth Marketing Project');
  });

  it('Register Third-Party Developer OAuth Application', async () => {
    const res = await request(app)
      .post('/api/v1/oauth/apps')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Automated CI Bot',
        redirectUri: 'https://cibot.com/oauth/callback',
        scopes: ['projects:read', 'work_items:write'],
      });

    expect(res.status).toBe(201);
    expect(res.body.clientId).toBeDefined();
    expect(res.body.clientSecret).toBeDefined();

    const listRes = await request(app)
      .get('/api/v1/oauth/apps')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
  });

  it('Dispatch Webhook Test Payload Event', async () => {
    const res = await request(app)
      .post(`/api/v1/webhooks/${webhookId}/test`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.signature).toBeDefined();
  });

  it('Submit In-App Feedback & Calculate Activation Score', async () => {
    const fbRes = await request(app)
      .post('/api/v1/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'FEATURE_REQUEST',
        message: 'Add custom template variables for sprint velocity.',
      });

    expect(fbRes.status).toBe(201);

    const actRes = await request(app)
      .get('/api/v1/activation')
      .set('Authorization', `Bearer ${token}`);

    expect(actRes.status).toBe(200);
    expect(actRes.body.activation.score).toBeGreaterThan(0);
    expect(actRes.body.activation.status).toBeDefined();
  });
});
