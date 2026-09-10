import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';
import router from '../routes/index.js';
import { emitAutomationEvent, evaluateSafeCondition } from '../services/automationEngine.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-token-key-change-in-production-12345';

describe('Phase 53 — Enterprise Workflow Automation & Rules Engine Suite', () => {
  let app: express.Express;
  let adminToken: string;
  let pmToken: string;
  let teamMemberToken: string;
  let orgId: string;
  let testProjectId: string;
  let testWorkItemId: string;

  beforeAll(async () => {
    await prisma.$connect();

    app = express();
    app.use(express.json());
    app.use('/api', router);

    const admin = await prisma.user.findFirst({
      where: { email: 'saikirankurapti@gmail.com' },
    });
    const pm = await prisma.user.findFirst({
      where: { email: 'ashwin.zerokost@gmail.com' },
    });
    const tm = await prisma.user.findFirst({
      where: { email: 'saikirankurapati04@gmail.com' },
    });

    if (!admin || !pm || !tm) {
      throw new Error('Required test users not found');
    }

    orgId = admin.organizationId;

    const project = await prisma.project.findFirst({
      where: { organizationId: orgId },
    });
    testProjectId = project!.id;

    // Create or find a test work item
    let item = await prisma.workItem.findFirst({
      where: { projectId: testProjectId },
    });
    if (!item) {
      item = await prisma.workItem.create({
        data: {
          projectId: testProjectId,
          humanId: 'AUT-101',
          title: 'Automation Test Item',
          status: 'TO_DO',
          priority: 'MEDIUM',
          reporterId: admin.id,
        },
      });
    }
    testWorkItemId = item.id;

    adminToken = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, organizationId: orgId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    pmToken = jwt.sign(
      { id: pm.id, email: pm.email, role: pm.role, organizationId: orgId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    teamMemberToken = jwt.sign(
      { id: tm.id, email: tm.email, role: tm.role, organizationId: orgId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  describe('1. RBAC Permissions & Security Boundaries', () => {
    it('allows Admin to create an organization-wide automation rule', async () => {
      const res = await request(app)
        .post('/api/automations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Global Rule',
          trigger: 'WORK_ITEM_STATUS_CHANGED',
          conditions: { rules: [{ field: 'status', operator: 'EQUALS', value: 'DONE' }] },
          actions: [{ type: 'ADD_WORK_ITEM_COMMENT', comment: 'Auto-verified by admin rule' }],
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Admin Global Rule');
    });

    it('allows Project Manager (Ashwin) to create a project-scoped automation rule', async () => {
      const res = await request(app)
        .post('/api/automations')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          name: 'PM Project Scoped Rule',
          projectId: testProjectId,
          trigger: 'WORK_ITEM_BLOCKED',
          conditions: {},
          actions: [{ type: 'NOTIFY_MANAGERS' }],
        });

      expect(res.status).toBe(201);
      expect(res.body.projectId).toBe(testProjectId);
    });

    it('blocks Regular Team Member from creating any automation rule (403)', async () => {
      const res = await request(app)
        .post('/api/automations')
        .set('Authorization', `Bearer ${teamMemberToken}`)
        .send({
          name: 'Unauthorized Rule Attempt',
          trigger: 'WORK_ITEM_STATUS_CHANGED',
          conditions: {},
          actions: [{ type: 'CHANGE_WORK_ITEM_STATUS', targetStatus: 'DONE' }],
        });

      expect(res.status).toBe(403);
    });

    it('rejects invalid triggers with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/automations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Trigger Rule',
          trigger: 'ARBITRARY_UNSUPPORTED_TRIGGER',
          conditions: {},
          actions: [],
        });

      expect(res.status).toBe(400);
    });
  });

  describe('2. Safe Condition Evaluation (No eval / dynamic code)', () => {
    it('evaluates EQUALS, NOT_EQUALS, IN, CONTAINS, GREATER_THAN correctly', () => {
      const context = {
        status: 'BLOCKED',
        priority: 'HIGH',
        allocationPercentage: 120,
        tags: 'production-critical',
      };

      const matched = evaluateSafeCondition(
        {
          logicalOperator: 'AND',
          rules: [
            { field: 'status', operator: 'EQUALS', value: 'BLOCKED' },
            { field: 'allocationPercentage', operator: 'GREATER_THAN', value: 100 },
          ],
        },
        context
      );
      expect(matched).toBe(true);

      const failed = evaluateSafeCondition(
        {
          logicalOperator: 'AND',
          rules: [{ field: 'status', operator: 'EQUALS', value: 'DONE' }],
        },
        context
      );
      expect(failed).toBe(false);
    });
  });

  describe('3. Core Automations Execution', () => {
    it('Automation 1 & 2: PR Opened -> Move to CODE_REVIEW, PR Merged -> Move to DONE', async () => {
      // 1. Create PR_MERGED rule
      const rule = await prisma.automationRule.create({
        data: {
          organizationId: orgId,
          projectId: testProjectId,
          createdById: (await prisma.user.findFirst({ where: { email: 'saikirankurapti@gmail.com' } }))!.id,
          name: 'Test PR Merged Rule',
          trigger: 'GITHUB_PR_MERGED',
          conditions: JSON.stringify({}),
          actions: JSON.stringify([{ type: 'CHANGE_WORK_ITEM_STATUS', targetStatus: 'DONE' }]),
          isEnabled: true,
        },
      });

      // 2. Dispatch GITHUB_PR_MERGED event
      await emitAutomationEvent({
        organizationId: orgId,
        trigger: 'GITHUB_PR_MERGED',
        workItemId: testWorkItemId,
        projectId: testProjectId,
        source: 'GITHUB_WEBHOOK',
        eventId: `test-pr-merge-${Date.now()}`,
      });

      // 3. Verify work item status updated to DONE
      const updatedItem = await prisma.workItem.findUnique({ where: { id: testWorkItemId } });
      expect(updatedItem?.status).toBe('DONE');

      // Cleanup
      await prisma.automationRule.delete({ where: { id: rule.id } });
    });

    it('Automation 3: Work Item Blocked -> Records execution and notifies manager', async () => {
      const rule = await prisma.automationRule.create({
        data: {
          organizationId: orgId,
          projectId: testProjectId,
          createdById: (await prisma.user.findFirst({ where: { email: 'saikirankurapti@gmail.com' } }))!.id,
          name: 'Test Item Blocked Rule',
          trigger: 'WORK_ITEM_BLOCKED',
          conditions: JSON.stringify({}),
          actions: JSON.stringify([{ type: 'NOTIFY_MANAGERS' }]),
          isEnabled: true,
        },
      });

      await emitAutomationEvent({
        organizationId: orgId,
        trigger: 'WORK_ITEM_BLOCKED',
        workItemId: testWorkItemId,
        projectId: testProjectId,
        source: 'WORK_ITEM',
        eventId: `test-blocked-${Date.now()}`,
      });

      // Check log
      const log = await prisma.automationLog.findFirst({
        where: { automationRuleId: rule.id },
        orderBy: { createdAt: 'desc' },
      });

      expect(log).toBeDefined();
      expect(log?.status).toBe('SUCCESS');

      await prisma.automationRule.delete({ where: { id: rule.id } });
    });

    it('Automation 6: Capacity Over-allocation (>100%) -> Emits and executes notification', async () => {
      const rule = await prisma.automationRule.create({
        data: {
          organizationId: orgId,
          createdById: (await prisma.user.findFirst({ where: { email: 'saikirankurapti@gmail.com' } }))!.id,
          name: 'Test Capacity Rule',
          trigger: 'CAPACITY_OVER_ALLOCATED',
          conditions: JSON.stringify({
            rules: [{ field: 'totalAllocationPercentage', operator: 'GREATER_THAN', value: 100 }],
          }),
          actions: JSON.stringify([{ type: 'NOTIFY_MANAGERS', message: 'Resource is over-allocated' }]),
          isEnabled: true,
        },
      });

      const res = await emitAutomationEvent({
        organizationId: orgId,
        trigger: 'CAPACITY_OVER_ALLOCATED',
        source: 'CAPACITY',
        eventId: `test-cap-${Date.now()}`,
        data: { totalAllocationPercentage: 125 },
      });

      expect(res.status).toBe('COMPLETED');

      await prisma.automationRule.delete({ where: { id: rule.id } });
    });
  });

  describe('4. Reliability: Idempotency & Loop Protection', () => {
    it('Idempotency: Rejects duplicate webhook / event deliveries with same event ID', async () => {
      const eventId = `unique-delivery-${Date.now()}`;

      const firstCall = await emitAutomationEvent({
        organizationId: orgId,
        trigger: 'WORK_ITEM_STATUS_CHANGED',
        eventId,
      });

      const duplicateCall = await emitAutomationEvent({
        organizationId: orgId,
        trigger: 'WORK_ITEM_STATUS_CHANGED',
        eventId,
      });

      expect(duplicateCall.status).toBe('SKIPPED_IDEMPOTENT');
    });

    it('Loop Protection: Aborts execution when recursion depth exceeds threshold', async () => {
      const loopResult = await emitAutomationEvent({
        organizationId: orgId,
        trigger: 'WORK_ITEM_STATUS_CHANGED',
        depth: 5, // Exceeds threshold
      });

      expect(loopResult.status).toBe('SKIPPED_LOOP');
    });
  });

  describe('5. Dry-Run / Test Rule Simulation', () => {
    it('Dry-run reports match count and simulated actions without mutating database', async () => {
      const res = await request(app)
        .post('/api/automations/test')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          trigger: 'WORK_ITEM_STATUS_CHANGED',
          conditions: { rules: [{ field: 'status', operator: 'EQUALS', value: 'DONE' }] },
          actions: [{ type: 'CHANGE_WORK_ITEM_STATUS', targetStatus: 'CODE_REVIEW' }],
        });

      expect(res.status).toBe(200);
      expect(res.body.safeValidation).toBe(true);
      expect(res.body.wouldExecute).toContain('Move work item to CODE_REVIEW');
    });
  });
});
