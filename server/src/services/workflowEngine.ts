import { prisma } from '../prisma.js';

export interface TransitionContext {
  organizationId: string;
  userId: string;
  userRole: string;
  workItemId: string;
  targetStatus: string;
  payload?: Record<string, any>;
}

export const executeWorkflowTransition = async (ctx: TransitionContext) => {
  const { organizationId, userId, userRole, workItemId, targetStatus, payload } = ctx;

  const workItem = await prisma.workItem.findUnique({
    where: { id: workItemId },
    include: { project: true },
  });

  if (!workItem) throw new Error('Work item not found');
  if (workItem.project.organizationId !== organizationId) throw new Error('Unauthorized project access');

  // Resolve workflow (Project specific or Organization default)
  let workflow = workItem.project.workflowId
    ? await prisma.workflow.findUnique({
        where: { id: workItem.project.workflowId },
        include: { statuses: true, transitions: true },
      })
    : null;

  if (!workflow) {
    workflow = await prisma.workflow.findFirst({
      where: { organizationId, isDefault: true },
      include: { statuses: true, transitions: true },
    });
  }

  // If custom workflow exists, enforce explicit transitions and required fields
  if (workflow) {
    const transitionRule = workflow.transitions.find(
      (t) => t.fromStatus === workItem.status && t.toStatus === targetStatus
    );

    if (!transitionRule) {
      throw new Error(`Transition from "${workItem.status}" to "${targetStatus}" is not allowed in workflow "${workflow.name}"`);
    }

    // Role check
    if (transitionRule.allowedRoles) {
      try {
        const allowed: string[] = JSON.parse(transitionRule.allowedRoles);
        if (allowed.length > 0 && !allowed.includes(userRole) && userRole !== 'ADMIN' && userRole !== 'OWNER') {
          throw new Error(`User role "${userRole}" is not authorized for transition "${workItem.status} -> ${targetStatus}"`);
        }
      } catch (e: any) {
        if (e.message.includes('not authorized')) throw e;
      }
    }

    // Required fields check
    if (transitionRule.requiredFields) {
      try {
        const required: string[] = JSON.parse(transitionRule.requiredFields);
        for (const field of required) {
          const val = payload ? payload[field] : (workItem as any)[field];
          if (!val) {
            throw new Error(`Field "${field}" is required to transition to "${targetStatus}"`);
          }
        }
      } catch (e: any) {
        if (e.message.includes('is required')) throw e;
      }
    }
  }

  // Update status & record history
  const updatedItem = await prisma.workItem.update({
    where: { id: workItemId },
    data: {
      status: targetStatus,
      ...(payload?.blockedReason ? { blockedReason: payload.blockedReason } : {}),
    },
  });

  await prisma.workItemStatusHistory.create({
    data: {
      workItemId,
      oldStatus: workItem.status,
      newStatus: targetStatus,
      changedById: userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      actorId: userId,
      action: 'WORK_ITEM_TRANSITION',
      entityType: 'WORK_ITEM',
      entityId: workItemId,
      details: JSON.stringify({ fromStatus: workItem.status, toStatus: targetStatus }),
    },
  });

  return updatedItem;
};
