import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Phase 15 - Advanced Collaboration, Knowledge Hub & Team Communication Tests', () => {
  let token: string;
  let pageId: string;
  let decisionId: string;
  let meetingId: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sai@demostartup.com', password: 'Password123!' });

    token = loginRes.body.token;
  });

  it('Create Knowledge Page, Versioning & Convert to Work Item', async () => {
    const createRes = await request(app)
      .post('/api/v1/knowledge')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Authentication & Session Architecture',
        content: 'JWT Bearer token specifications and tenantContextMiddleware isolation rules.',
        category: 'ENGINEERING',
        visibility: 'ORGANIZATION',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.title).toBe('Authentication & Session Architecture');
    expect(createRes.body.version).toBe(1);
    pageId = createRes.body.id;

    // Update Knowledge Page to produce Version 2
    const updateRes = await request(app)
      .put(`/api/v1/knowledge/${pageId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Authentication & Session Architecture v2',
        content: 'Updated JWT Bearer token specifications with correlation ID injection.',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.version).toBe(2);

    // Convert Page to Work Item
    const convertRes = await request(app)
      .post(`/api/v1/knowledge/${pageId}/convert`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'FEATURE', priority: 'HIGH' });

    expect(convertRes.status).toBe(201);
    expect(convertRes.body.success).toBe(true);
    expect(convertRes.body.workItem.humanId).toBeDefined();
  });

  it('Create Decision Record & Supersede Decision Lineage', async () => {
    const decRes = await request(app)
      .post('/api/v1/decisions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Use SQLite for Local Dev and PostgreSQL for Prod',
        context: 'Need lightweight setup for local development.',
        decision: 'Use SQLite locally and PostgreSQL on production.',
        reason: 'Zero database daemon overhead for local development.',
      });

    expect(decRes.status).toBe(201);
    expect(decRes.body.status).toBe('ACCEPTED');
    decisionId = decRes.body.id;

    // Supersede Decision
    const superRes = await request(app)
      .post(`/api/v1/decisions/${decisionId}/supersede`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Migrate Local Dev to Containerized PostgreSQL',
        decision: 'Use Dockerized PostgreSQL for both local and production environments.',
        reason: 'Ensure 100% feature parity between local dev and cloud prod.',
      });

    expect(superRes.status).toBe(200);
    expect(superRes.body.success).toBe(true);
    expect(superRes.body.newDecision.status).toBe('ACCEPTED');

    const listRes = await request(app)
      .get('/api/v1/decisions')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    const oldDec = listRes.body.find((d: any) => d.id === decisionId);
    expect(oldDec.status).toBe('SUPERSEDED');
  });

  it('Create Meeting Workspace & Convert Action Item to Task', async () => {
    const mtgRes = await request(app)
      .post('/api/v1/meetings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Sprint 14 Retrospective & Planning',
        meetingType: 'RETROSPECTIVE',
        agenda: 'Review sprint deliverables and team velocity',
        notes: 'Team successfully completed Phase 14 features.',
        actionItems: ['Update deployment documentation', 'Refactor auth middleware'],
      });

    expect(mtgRes.status).toBe(201);
    expect(mtgRes.body.title).toBe('Sprint 14 Retrospective & Planning');
    meetingId = mtgRes.body.id;

    // Convert Action Item to Task
    const actRes = await request(app)
      .post(`/api/v1/meetings/${meetingId}/convert-action`)
      .set('Authorization', `Bearer ${token}`)
      .send({ actionTitle: 'Update deployment documentation' });

    expect(actRes.status).toBe(201);
    expect(actRes.body.success).toBe(true);
    expect(actRes.body.workItem.type).toBe('TASK');
  });

  it('Publish Project Update & Generate AI Draft Update', async () => {
    const draftRes = await request(app)
      .post('/api/v1/updates/ai-draft')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(draftRes.status).toBe(200);
    expect(draftRes.body.isAiDraft).toBe(true);

    const projRes = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`);

    const validProjectId = projRes.body[0]?.id;

    if (validProjectId) {
      const pubRes = await request(app)
        .post('/api/v1/updates')
        .set('Authorization', `Bearer ${token}`)
        .send({
          projectId: validProjectId,
          title: 'Weekly Executive Project Update',
          healthStatus: 'ON_TRACK',
          summary: draftRes.body.summary,
          completedItems: draftRes.body.completedItems,
        });

      expect(pubRes.status).toBe(201);
    }
  });

  it('Execute Unified Collaboration Global Search & AI Grounded Q&A', async () => {
    const searchRes = await request(app)
      .get('/api/v1/collaboration/search?query=Authentication')
      .set('Authorization', `Bearer ${token}`);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.knowledgePages).toBeDefined();

    const aiRes = await request(app)
      .post('/api/v1/collaboration/ai-search')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'Where is authentication documented?' });

    expect(aiRes.status).toBe(200);
    expect(aiRes.body.answer).toBeDefined();
    expect(Array.isArray(aiRes.body.citations)).toBe(true);
  });
});
