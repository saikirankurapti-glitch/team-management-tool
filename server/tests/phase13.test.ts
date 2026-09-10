import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Phase 13 - Public SaaS Launch, Customer Lifecycle & Commercial Experience Tests', () => {
  let newOwnerToken: string;
  let newOrgId: string;

  beforeAll(async () => {
    const signupRes = await request(app)
      .post('/api/auth/public-signup')
      .send({
        fullName: 'Jordan Lee',
        email: `jordan_${Date.now()}@acmestartup.io`,
        password: 'Password123!',
        organizationName: 'Acme Growth Org',
      });

    newOwnerToken = signupRes.body.token;
    newOrgId = signupRes.body.organization.id;
  });

  it('Public Signup & Workspace Onboarding Wizard', async () => {
    expect(newOwnerToken).toBeDefined();
    expect(newOrgId).toBeDefined();
  });

  it('14-Day Trial Initialization & Usage Metering Overview', async () => {
    const res = await request(app)
      .get('/api/v1/billing')
      .set('Authorization', `Bearer ${newOwnerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.subscription.status).toBe('TRIALING');
    expect(res.body.subscription.trialDaysRemaining).toBeGreaterThanOrEqual(13);
    expect(res.body.usage.members.max).toBe(25);
  });

  it('Upgrade Subscription Plan to BUSINESS', async () => {
    const res = await request(app)
      .post('/api/v1/billing/upgrade')
      .set('Authorization', `Bearer ${newOwnerToken}`)
      .send({ plan: 'BUSINESS' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.subscription.plan).toBe('BUSINESS');
    expect(res.body.subscription.maxMembers).toBe(100);
  });

  it('Submit and Fetch Customer Support Ticket', async () => {
    const createRes = await request(app)
      .post('/api/v1/support')
      .set('Authorization', `Bearer ${newOwnerToken}`)
      .send({
        category: 'TECHNICAL',
        subject: 'Webhook delivery inquiry',
        description: 'Testing HMAC signature validation for outbound webhooks.',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.subject).toBe('Webhook delivery inquiry');

    const getRes = await request(app)
      .get('/api/v1/support')
      .set('Authorization', `Bearer ${newOwnerToken}`);

    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.body)).toBe(true);
  });

  it('Verify existing 6-member startup organization retains full functionality', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sai@demostartup.com', password: 'Password123!' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();

    const workItemRes = await request(app)
      .get('/api/work-items')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(workItemRes.status).toBe(200);
    expect(Array.isArray(workItemRes.body)).toBe(true);
  });
});
