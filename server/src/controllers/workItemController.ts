import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { emitAutomationEvent } from '../services/automationEngine.js';

// Get work items with filtering
export const getWorkItems = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const {
      projectId,
      sprintId,
      assigneeId,
      type,
      status,
      priority,
      search,
      parentId,
      isMyWork,
    } = req.query;

    const where: any = {
      project: { organizationId: orgId },
    };

    if (projectId) where.projectId = String(projectId);
    if (sprintId === 'unassigned') {
      where.sprintId = null;
    } else if (sprintId) {
      where.sprintId = String(sprintId);
    }

    if (assigneeId) where.assigneeId = String(assigneeId);
    if (type) where.type = String(type);
    if (status) where.status = String(status);
    if (priority) where.priority = String(priority);
    if (parentId) where.parentId = String(parentId);

    if (isMyWork === 'true' && req.user) {
      where.assigneeId = req.user.id;
    }

    if (search) {
      const searchStr = String(search).toLowerCase();
      where.OR = [
        { title: { contains: searchStr } },
        { humanId: { contains: searchStr } },
        { description: { contains: searchStr } },
      ];
    }

    const items = await prisma.workItem.findMany({
      where,
      include: {
        project: { select: { key: true, name: true } },
        assignee: { select: { id: true, fullName: true, avatarUrl: true, email: true } },
        reporter: { select: { id: true, fullName: true, avatarUrl: true } },
        sprint: { select: { id: true, name: true } },
        parent: { select: { id: true, humanId: true, title: true, type: true } },
        children: { select: { id: true, humanId: true, title: true, type: true, status: true } },
        comments: {
          include: { author: { select: { id: true, fullName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
        },
        tags: true,
        blockingItems: { include: { blockedItem: { select: { id: true, humanId: true, title: true } } } },
        blockedByItems: { include: { blockingItem: { select: { id: true, humanId: true, title: true } } } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return res.json(items);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// Create a new work item with human readable ID
export const createWorkItem = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });

    const {
      projectId,
      title,
      description,
      type,
      priority,
      severity,
      status,
      assigneeId,
      sprintId,
      parentId,
      storyPoints,
      estimatedHours,
      dueDate,
      tags,
      environment,
      stepsToReproduce,
      expectedResult,
      actualResult,
    } = req.body;

    if (!projectId || !title) {
      return res.status(400).json({ message: 'Project ID and Title are required' });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
    });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Generate human ID (e.g., PROJ-101 or BUG-101)
    const prefix = type === 'BUG' ? 'BUG' : project.key;
    const count = await prisma.workItem.count({ where: { projectId } });
    const humanId = `${prefix}-${count + 101}`;

    const initialStatus = status || 'TO_DO';

    const workItem = await prisma.workItem.create({
      data: {
        projectId,
        humanId,
        title,
        description,
        type: type || 'TASK',
        status: initialStatus,
        priority: priority || 'MEDIUM',
        severity: severity || null,
        assigneeId: assigneeId || null,
        reporterId: userId,
        sprintId: sprintId || null,
        parentId: parentId || null,
        storyPoints: storyPoints ? parseInt(storyPoints, 10) : 0,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : 0,
        dueDate: dueDate ? new Date(dueDate) : null,
        environment: environment || null,
        stepsToReproduce: stepsToReproduce || null,
        expectedResult: expectedResult || null,
        actualResult: actualResult || null,
        tags: tags && Array.isArray(tags) ? { create: tags.map((t: any) => ({ name: t.name, color: t.color || '#6366f1' })) } : undefined,
      },
      include: {
        assignee: { select: { id: true, fullName: true, avatarUrl: true } },
        project: { select: { key: true, name: true } },
      },
    });

    // Record status transition in history
    await prisma.workItemStatusHistory.create({
      data: {
        workItemId: workItem.id,
        oldStatus: 'CREATED',
        newStatus: initialStatus,
        changedById: userId,
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: userId,
        action: 'CREATE_WORK_ITEM',
        entityType: 'WorkItem',
        entityId: workItem.id,
        details: JSON.stringify({ humanId, title, type: workItem.type }),
      },
    });

    // Notification if assigned
    if (assigneeId && assigneeId !== userId) {
      await prisma.notification.create({
        data: {
          userId: assigneeId,
          type: 'ASSIGNMENT',
          title: `Assigned to ${humanId}`,
          body: `${req.user?.fullName} assigned "${title}" to you.`,
          link: `/boards?item=${humanId}`,
        },
      });
    }

    // Trigger Workflow Automation Engine (WORK_ITEM_CREATED)
    emitAutomationEvent({
      organizationId: orgId,
      trigger: 'WORK_ITEM_CREATED',
      workItemId: workItem.id,
      projectId,
      actorId: userId,
      source: 'WORK_ITEM',
      data: {
        title,
        status: initialStatus,
        priority: priority || 'MEDIUM',
        assigneeId: assigneeId || null,
      },
    }).catch((err) => console.error('[Automation] Trigger WORK_ITEM_CREATED error:', err));

    return res.status(201).json(workItem);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// Update work item & track status transition
export const updateWorkItem = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });

    const existing = await prisma.workItem.findFirst({
      where: {
        OR: [{ id }, { humanId: id.toUpperCase() }],
        project: { organizationId: orgId },
      },
      include: { project: true },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Work item not found' });
    }

    const {
      title,
      description,
      type,
      status,
      priority,
      severity,
      assigneeId,
      sprintId,
      parentId,
      storyPoints,
      estimatedHours,
      actualHours,
      dueDate,
      blockedReason,
    } = req.body;

    const dataToUpdate: any = {};
    if (title !== undefined) dataToUpdate.title = title;
    if (description !== undefined) dataToUpdate.description = description;
    if (type !== undefined) dataToUpdate.type = type;
    if (priority !== undefined) dataToUpdate.priority = priority;
    if (severity !== undefined) dataToUpdate.severity = severity;
    if (assigneeId !== undefined) dataToUpdate.assigneeId = assigneeId || null;
    if (sprintId !== undefined) dataToUpdate.sprintId = sprintId || null;
    if (parentId !== undefined) dataToUpdate.parentId = parentId || null;
    if (storyPoints !== undefined) dataToUpdate.storyPoints = parseInt(storyPoints, 10);
    if (estimatedHours !== undefined) dataToUpdate.estimatedHours = parseFloat(estimatedHours);
    if (actualHours !== undefined) dataToUpdate.actualHours = parseFloat(actualHours);
    if (dueDate !== undefined) dataToUpdate.dueDate = dueDate ? new Date(dueDate) : null;
    if (blockedReason !== undefined) dataToUpdate.blockedReason = blockedReason;

    // Handle status change
    let statusChanged = false;
    if (status !== undefined && status !== existing.status) {
      dataToUpdate.status = status;
      statusChanged = true;
    }

    const updated = await prisma.workItem.update({
      where: { id: existing.id },
      data: dataToUpdate,
      include: {
        assignee: { select: { id: true, fullName: true, avatarUrl: true } },
        project: { select: { key: true, name: true } },
        sprint: { select: { id: true, name: true } },
      },
    });

    if (statusChanged) {
      await prisma.workItemStatusHistory.create({
        data: {
          workItemId: existing.id,
          oldStatus: existing.status,
          newStatus: status,
          changedById: userId,
        },
      });

      // Audit Log for status change
      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          actorId: userId,
          action: 'WORK_ITEM_STATUS_CHANGE',
          entityType: 'WorkItem',
          entityId: id,
          details: JSON.stringify({ humanId: existing.humanId, oldStatus: existing.status, newStatus: status }),
        },
      });

      // Notify Assignee if different from actor
      if (existing.assigneeId && existing.assigneeId !== userId) {
        await prisma.notification.create({
          data: {
            userId: existing.assigneeId,
            type: 'STATUS_CHANGE',
            title: `Status update: ${existing.humanId}`,
            body: `Moved from ${existing.status} to ${status} by ${req.user?.fullName}`,
            link: `/boards?item=${existing.humanId}`,
          },
        });
      }
    }

    // Trigger Workflow Automations
    if (statusChanged) {
      // 1. General status changed trigger
      emitAutomationEvent({
        organizationId: orgId,
        trigger: 'WORK_ITEM_STATUS_CHANGED',
        workItemId: updated.id,
        projectId: existing.projectId,
        actorId: userId,
        source: 'WORK_ITEM',
        data: {
          previousStatus: existing.status,
          status,
          humanId: existing.humanId,
          assigneeId: updated.assigneeId,
        },
      }).catch((err) => console.error('[Automation] Status changed error:', err));

      // 2. Work Item Blocked trigger (Automation 3 requirement)
      if (status === 'BLOCKED') {
        emitAutomationEvent({
          organizationId: orgId,
          trigger: 'WORK_ITEM_BLOCKED',
          workItemId: updated.id,
          projectId: existing.projectId,
          actorId: userId,
          source: 'WORK_ITEM',
          data: {
            status: 'BLOCKED',
            blockedReason: updated.blockedReason,
            humanId: existing.humanId,
            assigneeId: updated.assigneeId,
          },
        }).catch((err) => console.error('[Automation] Blocked trigger error:', err));
      }

      // 3. Work Item Completed trigger
      if (status === 'DONE') {
        emitAutomationEvent({
          organizationId: orgId,
          trigger: 'WORK_ITEM_COMPLETED',
          workItemId: updated.id,
          projectId: existing.projectId,
          actorId: userId,
          source: 'WORK_ITEM',
          data: {
            status: 'DONE',
            humanId: existing.humanId,
            assigneeId: updated.assigneeId,
          },
        }).catch((err) => console.error('[Automation] Completed trigger error:', err));
      }
    }

    // Assignee changed trigger
    if (assigneeId !== undefined && assigneeId !== existing.assigneeId) {
      emitAutomationEvent({
        organizationId: orgId,
        trigger: 'WORK_ITEM_ASSIGNEE_CHANGED',
        workItemId: updated.id,
        projectId: existing.projectId,
        actorId: userId,
        source: 'WORK_ITEM',
        data: {
          previousAssigneeId: existing.assigneeId,
          assigneeId: updated.assigneeId,
          humanId: existing.humanId,
        },
      }).catch((err) => console.error('[Automation] Assignee changed error:', err));
    }

    // Priority changed trigger
    if (priority !== undefined && priority !== existing.priority) {
      emitAutomationEvent({
        organizationId: orgId,
        trigger: 'WORK_ITEM_PRIORITY_CHANGED',
        workItemId: updated.id,
        projectId: existing.projectId,
        actorId: userId,
        source: 'WORK_ITEM',
        data: {
          previousPriority: existing.priority,
          priority: updated.priority,
          humanId: existing.humanId,
        },
      }).catch((err) => console.error('[Automation] Priority changed error:', err));
    }

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// Add comment to work item
export const addComment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { content } = req.body;

    if (!userId || !content) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const comment = await prisma.workItemComment.create({
      data: {
        workItemId: id,
        authorId: userId,
        content,
      },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    return res.status(201).json(comment);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// Delete work item
export const deleteWorkItem = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });

    const existing = await prisma.workItem.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!existing || existing.project.organizationId !== orgId) {
      return res.status(404).json({ message: 'Work item not found' });
    }

    await prisma.workItem.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: userId,
        action: 'DELETE_WORK_ITEM',
        entityType: 'WorkItem',
        entityId: id,
        details: JSON.stringify({ humanId: existing.humanId, title: existing.title }),
      },
    });

    return res.json({ message: 'Work item deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// Get work item status history and activity timeline
export const getWorkItemHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const history = await prisma.workItemStatusHistory.findMany({
      where: { workItemId: id },
      include: {
        changedBy: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { changedAt: 'desc' },
    });

    return res.json(history);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// Add dependency relationship
export const addDependency = async (req: AuthRequest, res: Response) => {
  try {
    const { blockingWorkItemId, blockedWorkItemId } = req.body;
    if (!blockingWorkItemId || !blockedWorkItemId) {
      return res.status(400).json({ message: 'blockingWorkItemId and blockedWorkItemId are required' });
    }

    const dependency = await prisma.workItemDependency.create({
      data: {
        blockingWorkItemId,
        blockedWorkItemId,
      },
      include: {
        blockingItem: { select: { humanId: true, title: true } },
        blockedItem: { select: { humanId: true, title: true } },
      },
    });

    return res.status(201).json(dependency);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

