import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Phase 4 - Real-Time Chat & Collaboration Integration Tests', () => {
  let token: string;
  let channelId: string;
  let conversationId: string;
  let messageId: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sai@demostartup.com', password: 'Password123!' });

    token = loginRes.body.token;
  });

  it('Fetch channels list', async () => {
    const res = await request(app)
      .get('/api/chat/channels')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    channelId = res.body[0].id;
  });

  it('Create a new Channel', async () => {
    const res = await request(app)
      .post('/api/chat/channels')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'qa-automation',
        description: 'Automated test suite discussions and bug logs',
        type: 'PUBLIC',
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.name).toBe('qa-automation');
  });

  it('Send a Chat message to Channel with @mention', async () => {
    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        channelId,
        content: 'Hey @Ravi please test authentication flow on PROJ-102.',
      });

    expect(res.status).toBe(201);
    expect(res.body.content).toContain('PROJ-102');
    messageId = res.body.id;
  });

  it('Edit a Chat message', async () => {
    const res = await request(app)
      .patch(`/api/chat/messages/${messageId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'Hey @Ravi please test authentication flow on PROJ-102 (updated).',
      });

    expect(res.status).toBe(200);
    expect(res.body.content).toContain('(updated)');
    expect(res.body.editedAt).toBeDefined();
  });

  it('Toggle emoji reaction on a message', async () => {
    const res = await request(app)
      .post(`/api/chat/messages/${messageId}/reactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ emoji: '🚀' });

    expect(res.status).toBe(201);
    expect(res.body.action).toBe('ADDED');
  });

  it('Create a Work Item from a Chat message', async () => {
    const res = await request(app)
      .post(`/api/chat/messages/${messageId}/create-task`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'BUG',
        priority: 'HIGH',
      });

    expect(res.status).toBe(201);
    expect(res.body.humanId).toBeDefined();
    expect(res.body.type).toBe('BUG');
  });

  it('Soft delete a message', async () => {
    const res = await request(app)
      .delete(`/api/chat/messages/${messageId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.content).toBe('This message was deleted.');
  });

  it('Search Chat messages and work items', async () => {
    const res = await request(app)
      .get('/api/chat/search?query=PROJ')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.workItems).toBeDefined();
  });
});
