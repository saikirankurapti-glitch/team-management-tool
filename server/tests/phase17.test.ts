import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';
import { prisma } from '../src/prisma';

describe('Phase 17 - Enterprise Workflow, Governance & Advanced Extensibility Tests', () => {
  let token: string;
  let workItemId: string;
  let workflowId: string;
  let fieldId: string;
  let approvalId: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sai@demostartup.com', password: 'Password123!' });

    token = loginRes.body.token;

    const itemRes = await request(app)
      .get('/api/work-items')
      .set('Authorization', `Bearer ${token}`);

    workItemId = itemRes.body[0]?.id;
  });

  it('Create Custom Workflow, Assign to Project & Validate Server-Side Transition', async () => {
    const wfRes = await request(app)
      .post('/api/v1/workflows')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Enterprise Quality Gate Workflow',
        description: 'Requires Code Review and QA verification',
        statuses: [
          { name: 'BACKLOG', category: 'BACKLOG', order: 0 },
          { name: 'IN_DEVELOPMENT', category: 'IN_PROGRESS', order: 1 },
          { name: 'QA_VERIFICATION', category: 'IN_PROGRESS', order: 2 },
          { name: 'DONE', category: 'COMPLETED', order: 3 },
        ],
        transitions: [
          { fromStatus: 'BACKLOG', toStatus: 'IN_DEVELOPMENT' },
          { fromStatus: 'TO_DO', toStatus: 'IN_DEVELOPMENT' },
          { fromStatus: 'IN_PROGRESS', toStatus: 'IN_DEVELOPMENT' },
          { fromStatus: 'IN_DEVELOPMENT', toStatus: 'QA_VERIFICATION', allowedRoles: ['ADMIN', 'DEVELOPER'] },
          { fromStatus: 'QA_VERIFICATION', toStatus: 'DONE' },
        ],
      });

    expect(wfRes.status).toBe(201);
    expect(wfRes.body.name).toBe('Enterprise Quality Gate Workflow');
    expect(wfRes.body.statuses.length).toBe(4);
    workflowId = wfRes.body.id;

    const itemDetails = await request(app)
      .get(`/api/work-items/${workItemId}`)
      .set('Authorization', `Bearer ${token}`);

    const projectId = itemDetails.body?.projectId;
    if (projectId) {
      const assignRes = await request(app)
        .post('/api/v1/workflows/assign')
        .set('Authorization', `Bearer ${token}`)
        .send({ projectId, workflowId });

      expect(assignRes.status).toBe(200);
      expect(assignRes.body.success).toBe(true);
    }

    if (workItemId) {
      const currentItem = await request(app).get(`/api/work-items/${workItemId}`).set('Authorization', `Bearer ${token}`);
      const currStatus = currentItem.body?.status || 'BACKLOG';

      // Ensure transition rule from current status exists
      await prisma.workflowTransition.create({
        data: {
          workflowId,
          fromStatus: currStatus,
          toStatus: 'IN_DEVELOPMENT',
        },
      });

      const transRes = await request(app)
        .post(`/api/v1/work-items/${workItemId}/transition`)
        .set('Authorization', `Bearer ${token}`)
        .send({ targetStatus: 'IN_DEVELOPMENT' });

      if (transRes.status !== 200) console.error('Transition error:', transRes.body);
      expect(transRes.status).toBe(200);
      expect(transRes.body.workItem.status).toBe('IN_DEVELOPMENT');
    }
  });

  it('Create Custom Work Item Type & Typed Custom Field Values', async () => {
    const typeRes = await request(app)
      .post('/api/v1/custom-types')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Compliance Requirement', icon: 'Shield', color: '#ec4899' });

    expect(typeRes.status).toBe(201);
    expect(typeRes.body.name).toBe('Compliance Requirement');

    const fieldRes = await request(app)
      .post('/api/v1/custom-fields')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Target Environment',
        fieldKey: 'targetEnv',
        fieldType: 'SINGLE_SELECT',
        options: ['Staging', 'Production', 'EU-DC'],
        isRequired: true,
      });

    expect(fieldRes.status).toBe(201);
    expect(fieldRes.body.fieldKey).toBe('targetEnv');
    fieldId = fieldRes.body.id;

    if (workItemId) {
      const valRes = await request(app)
        .post('/api/v1/custom-values')
        .set('Authorization', `Bearer ${token}`)
        .send({
          workItemId,
          fieldValues: { [fieldId]: 'Production' },
        });

      expect(valRes.status).toBe(200);
      expect(valRes.body.success).toBe(true);
    }
  });

  it('Create Generic Approval Request & Process Response', async () => {
    if (!workItemId) return;

    const appRes = await request(app)
      .post('/api/v1/approvals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Production Change Request Approval',
        entityType: 'WORK_ITEM',
        entityId: workItemId,
      });

    expect(appRes.status).toBe(201);
    expect(appRes.body.status).toBe('PENDING');
    approvalId = appRes.body.id;

    const respRes = await request(app)
      .post(`/api/v1/approvals/${approvalId}/respond`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'APPROVED', comment: 'Security review completed' });

    expect(respRes.status).toBe(200);
    expect(respRes.body.approval.status).toBe('APPROVED');
  });

  it('Update Organization Policies, Record Version Snapshot & Check Config Health', async () => {
    const polRes = await request(app)
      .post('/api/v1/governance/policies')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'SECURITY',
        policyKey: 'requireMfaForAdmins',
        value: true,
      });

    expect(polRes.status).toBe(200);
    expect(polRes.body.success).toBe(true);

    const healthRes = await request(app)
      .get('/api/v1/governance/health')
      .set('Authorization', `Bearer ${token}`);

    expect(healthRes.status).toBe(200);
    expect(healthRes.body.health).toBeDefined();
  });
});
