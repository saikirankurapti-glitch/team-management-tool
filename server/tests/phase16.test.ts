import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Phase 16 - Mobile, PWA & Cross-Platform Experience Tests', () => {
  let token: string;
  let workItemId: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sai@demostartup.com', password: 'Password123!' });

    token = loginRes.body.token;

    // Get an active work item for offline mutation tests
    const itemRes = await request(app)
      .get('/api/work-items')
      .set('Authorization', `Bearer ${token}`);

    workItemId = itemRes.body[0]?.id;
  });

  it('Subscribe Web Push Device Endpoint & Dispatch Test Notification', async () => {
    const subRes = await request(app)
      .post('/api/v1/push/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({
        endpoint: 'https://fcm.googleapis.com/fcm/send/test_device_token_123',
        keys: {
          p256dh: 'BIP256_TEST_PUBLIC_KEY',
          auth: 'AUTH_SECRET_KEY_123',
        },
      });

    expect(subRes.status).toBe(201);
    expect(subRes.body.success).toBe(true);
    expect(subRes.body.subscription.endpoint).toBeDefined();

    const testRes = await request(app)
      .post('/api/v1/push/test')
      .set('Authorization', `Bearer ${token}`);

    expect(testRes.status).toBe(200);
    expect(testRes.body.success).toBe(true);
    expect(testRes.body.payload.deepLink).toBeDefined();
  });

  it('Fetch Active User Sessions & Revoke Session Security Controls', async () => {
    const listRes = await request(app)
      .get('/api/v1/sessions')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);

    const revokeRes = await request(app)
      .post('/api/v1/sessions/revoke')
      .set('Authorization', `Bearer ${token}`)
      .send({ revokeOthers: true });

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.success).toBe(true);
  });

  it('Process Idempotent Offline Mutation Sync Queue', async () => {
    if (!workItemId) return;

    const mutations = [
      {
        idempotencyKey: `mut_off_${Date.now()}_1`,
        action: 'UPDATE_WORK_ITEM_STATUS',
        entityId: workItemId,
        payload: { status: 'IN_PROGRESS' },
      },
      {
        idempotencyKey: `mut_off_${Date.now()}_2`,
        action: 'ADD_COMMENT',
        entityId: workItemId,
        payload: { content: 'Offline queued comment applied upon network recovery' },
      },
    ];

    const syncRes = await request(app)
      .post('/api/v1/offline/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ mutations });

    expect(syncRes.status).toBe(200);
    expect(syncRes.body.success).toBe(true);
    expect(syncRes.body.summary.processed).toBe(2);
    expect(syncRes.body.summary.applied).toBe(2);
  });
});
