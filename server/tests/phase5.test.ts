import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Phase 5 - Notifications, Files, Global Search & Calendar Integration Tests', () => {
  let token: string;
  let notificationId: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sai@demostartup.com', password: 'Password123!' });

    token = loginRes.body.token;
  });

  it('Fetch Notifications and unread counter', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toBeDefined();
    expect(Array.isArray(res.body.notifications)).toBe(true);
    if (res.body.notifications.length > 0) {
      notificationId = res.body.notifications[0].id;
    }
  });

  it('Mark notification as read', async () => {
    if (!notificationId) return;

    const res = await request(app)
      .patch(`/api/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('Fetch & Update Notification Preferences', async () => {
    const getRes = await request(app)
      .get('/api/notifications/preferences')
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.taskAssignments).toBeDefined();

    const putRes = await request(app)
      .put('/api/notifications/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        taskAssignments: true,
        mentions: true,
        comments: false,
      });

    expect(putRes.status).toBe(200);
    expect(putRes.body.comments).toBe(false);
  });

  it('Fetch Calendar events (Work items, Sprints, Projects)', async () => {
    const res = await request(app)
      .get('/api/calendar/events')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.events).toBeDefined();
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  it('Global Search across Work Items, Messages, and Projects', async () => {
    const res = await request(app)
      .get('/api/search?query=Customer')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.projects).toBeDefined();
  });

  it('Fetch Centralized Project Files list', async () => {
    const res = await request(app)
      .get('/api/files')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
