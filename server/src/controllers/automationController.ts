import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { dryRunAutomationRule, emitAutomationEvent, SUPPORTED_TRIGGERS } from '../services/automationEngine.js';

// Check if user has permission to manage automations:
// Admin has global org-wide automation access.
// Project Manager (CTO/Manager) has project-level automation access.
// Regular Team Members cannot create/edit/delete automation rules.
const canManageAutomation = (role?: string, projectId?: string | null): boolean => {
  if (!role) return false;
  if (role === 'OWNER' || role === 'ADMIN') return true;
  if (role === 'PROJECT_MANAGER' && projectId) return true;
  return false;
};

/**
 * List Automation Rules (Org-wide or scoped to a project)
 */
export const getAutomationRules = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const { projectId } = req.query;

    const where: any = { organizationId: orgId };
    if (projectId) {
      where.OR = [{ projectId: projectId as string }, { projectId: null }];
    }

    const rules = await prisma.automationRule.findMany({
      where,
      include: {
        createdBy: { select: { id: true, fullName: true, email: true } },
        project: { select: { id: true, key: true, name: true } },
        _count: { select: { logs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(rules);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Get Single Automation Rule
 */
export const getAutomationRuleById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const rule = await prisma.automationRule.findFirst({
      where: { id, organizationId: orgId },
      include: {
        createdBy: { select: { id: true, fullName: true, email: true } },
        project: { select: { id: true, key: true, name: true } },
      },
    });

    if (!rule) return res.status(404).json({ message: 'Automation rule not found' });
    return res.json(rule);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Create Automation Rule (Enforces RBAC + Validation)
 */
export const createAutomationRule = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { name, description, trigger, conditions, actions, projectId, throttleMinutes } = req.body;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });

    // Enforce RBAC
    if (!canManageAutomation(userRole, projectId)) {
      return res.status(403).json({
        message: 'Forbidden: Insufficient permissions to create automation rules.',
      });
    }

    if (!name || !trigger) {
      return res.status(400).json({ message: 'Rule name and trigger are required.' });
    }

    // Security: Validate trigger against whitelisted supported triggers
    if (!SUPPORTED_TRIGGERS.includes(trigger as any) && !['PR_OPENED', 'PR_MERGED', 'WORK_ITEM_STATUS_CHANGED', 'WORK_ITEM_BLOCKED', 'WORK_ITEM_OVERDUE'].includes(trigger)) {
      return res.status(400).json({
        message: `Invalid trigger '${trigger}'. Must be one of registered trigger types.`,
      });
    }

    const rule = await prisma.automationRule.create({
      data: {
        organizationId: orgId,
        projectId: projectId || null,
        createdById: userId,
        name,
        description: description || null,
        trigger,
        conditions: typeof conditions === 'string' ? conditions : JSON.stringify(conditions || {}),
        actions: typeof actions === 'string' ? actions : JSON.stringify(actions || []),
        isEnabled: true,
        throttleMinutes: typeof throttleMinutes === 'number' ? throttleMinutes : 0,
      },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        project: { select: { id: true, key: true, name: true } },
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: userId,
        action: 'AUTOMATION_CREATED',
        entityType: 'AutomationRule',
        entityId: rule.id,
        details: JSON.stringify({ name: rule.name, trigger: rule.trigger, projectId: rule.projectId }),
      },
    });

    return res.status(201).json(rule);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Update Automation Rule
 */
export const updateAutomationRule = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });

    const existing = await prisma.automationRule.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) return res.status(404).json({ message: 'Automation rule not found.' });

    // Enforce RBAC
    if (!canManageAutomation(userRole, existing.projectId)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions.' });
    }

    const { name, description, trigger, conditions, actions, projectId, throttleMinutes, isEnabled } = req.body;

    const dataToUpdate: any = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (description !== undefined) dataToUpdate.description = description;
    if (trigger !== undefined) dataToUpdate.trigger = trigger;
    if (conditions !== undefined) {
      dataToUpdate.conditions = typeof conditions === 'string' ? conditions : JSON.stringify(conditions);
    }
    if (actions !== undefined) {
      dataToUpdate.actions = typeof actions === 'string' ? actions : JSON.stringify(actions);
    }
    if (projectId !== undefined) dataToUpdate.projectId = projectId || null;
    if (throttleMinutes !== undefined) dataToUpdate.throttleMinutes = throttleMinutes;
    if (isEnabled !== undefined) dataToUpdate.isEnabled = isEnabled;

    const updated = await prisma.automationRule.update({
      where: { id },
      data: dataToUpdate,
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: userId,
        action: 'AUTOMATION_UPDATED',
        entityType: 'AutomationRule',
        entityId: updated.id,
        details: JSON.stringify({ changes: Object.keys(dataToUpdate) }),
      },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Toggle Automation Rule (Enable / Disable)
 */
export const toggleAutomationRule = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { isEnabled } = req.body;

    const existing = await prisma.automationRule.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) return res.status(404).json({ message: 'Automation rule not found.' });

    if (!canManageAutomation(userRole, existing.projectId)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions.' });
    }

    await prisma.automationRule.update({
      where: { id },
      data: { isEnabled: Boolean(isEnabled) },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: orgId!,
        actorId: userId!,
        action: isEnabled ? 'AUTOMATION_ENABLED' : 'AUTOMATION_DISABLED',
        entityType: 'AutomationRule',
        entityId: id,
        details: JSON.stringify({ isEnabled }),
      },
    });

    return res.json({ success: true, isEnabled });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Delete Automation Rule
 */
export const deleteAutomationRule = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const existing = await prisma.automationRule.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) return res.status(404).json({ message: 'Automation rule not found.' });

    if (!canManageAutomation(userRole, existing.projectId)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions.' });
    }

    await prisma.automationRule.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        organizationId: orgId!,
        actorId: userId!,
        action: 'AUTOMATION_DELETED',
        entityType: 'AutomationRule',
        entityId: id,
        details: JSON.stringify({ name: existing.name }),
      },
    });

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Dry-Run / Test Automation Rule
 * Simulates condition matching against active database records without performing mutations
 */
export const testAutomationRule = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const { trigger, conditions, actions, projectId } = req.body;

    if (!trigger) {
      return res.status(400).json({ message: 'Trigger is required for dry-run testing.' });
    }

    const testResults = await dryRunAutomationRule({
      organizationId: orgId,
      projectId,
      trigger,
      conditions: typeof conditions === 'string' ? JSON.parse(conditions) : conditions || {},
      actions: typeof actions === 'string' ? JSON.parse(actions) : actions || [],
    });

    return res.json(testResults);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Get Automation Logs / Execution History
 */
export const getAutomationLogs = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const { ruleId, projectId, status } = req.query;

    const where: any = {
      automationRule: { organizationId: orgId },
    };

    if (ruleId) where.automationRuleId = ruleId as string;
    if (projectId) where.projectId = projectId as string;
    if (status) where.status = status as string;

    const logs = await prisma.automationLog.findMany({
      where,
      include: {
        automationRule: {
          select: { id: true, name: true, trigger: true, projectId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return res.json(logs);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Manual Retry for Failed Automation Execution
 */
export const retryAutomationExecution = async (req: AuthRequest, res: Response) => {
  try {
    const { logId } = req.params;
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });

    const log = await prisma.automationLog.findFirst({
      where: { id: logId, automationRule: { organizationId: orgId } },
      include: { automationRule: true },
    });

    if (!log) return res.status(404).json({ message: 'Execution log record not found.' });

    if (!canManageAutomation(userRole, log.automationRule.projectId)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions to retry automations.' });
    }

    // Retrying execution through central engine
    const retryResult = await emitAutomationEvent({
      organizationId: orgId,
      trigger: log.triggerEvent,
      projectId: log.projectId || undefined,
      actorId: userId,
      source: 'MANUAL',
      eventId: `retry-${Date.now()}`,
    });

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: userId,
        action: 'AUTOMATION_RETRIED',
        entityType: 'AutomationLog',
        entityId: logId,
        details: JSON.stringify({ originalRule: log.automationRule.name, result: retryResult }),
      },
    });

    return res.json({ success: true, result: retryResult });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Automation Analytics / Metrics Summary
 */
export const getAutomationMetrics = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const totalRules = await prisma.automationRule.count({ where: { organizationId: orgId } });
    const activeRules = await prisma.automationRule.count({ where: { organizationId: orgId, isEnabled: true } });

    const logs = await prisma.automationLog.findMany({
      where: { automationRule: { organizationId: orgId } },
      select: { status: true, durationMs: true },
    });

    const totalExecutions = logs.length;
    const successfulExecutions = logs.filter((l) => l.status === 'SUCCESS').length;
    const failedExecutions = logs.filter((l) => l.status === 'FAILED').length;
    const throttledExecutions = logs.filter((l) => l.status === 'THROTTLED').length;

    const avgDuration = totalExecutions > 0
      ? Math.round(logs.reduce((sum, l) => sum + (l.durationMs || 0), 0) / totalExecutions)
      : 0;

    const successRate = totalExecutions > 0
      ? Math.round((successfulExecutions / totalExecutions) * 100)
      : 100;

    return res.json({
      totalRules,
      activeRules,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      throttledExecutions,
      avgDurationMs: avgDuration,
      successRatePercentage: successRate,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

