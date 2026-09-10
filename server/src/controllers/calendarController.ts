import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getCalendarEvents = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { projectId, teamId, assigneeId, type } = req.query;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    // Fetch Work Items with due dates
    const workItemWhere: any = {
      project: { organizationId: orgId },
      dueDate: { not: null },
    };
    if (projectId) workItemWhere.projectId = String(projectId);
    if (assigneeId) workItemWhere.assigneeId = String(assigneeId);
    if (type) workItemWhere.type = String(type);

    const workItems = await prisma.workItem.findMany({
      where: workItemWhere,
      include: {
        project: { select: { id: true, key: true, name: true } },
        assignee: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    // Fetch Sprints
    const sprintWhere: any = {
      project: { organizationId: orgId },
    };
    if (projectId) sprintWhere.projectId = String(projectId);

    const sprints = await prisma.sprint.findMany({
      where: sprintWhere,
      include: {
        project: { select: { key: true, name: true } },
      },
    });

    // Fetch Projects
    const projects = await prisma.project.findMany({
      where: { organizationId: orgId },
    });

    const now = new Date();

    const workItemEvents = workItems.map((item) => {
      const isOverdue = item.dueDate ? new Date(item.dueDate) < now && item.status !== 'DONE' : false;
      return {
        id: `workitem-${item.id}`,
        entityId: item.id,
        entityType: 'WORK_ITEM',
        title: `[${item.humanId}] ${item.title}`,
        date: item.dueDate,
        status: item.status,
        priority: item.priority,
        type: item.type,
        projectKey: item.project.key,
        projectName: item.project.name,
        assignee: item.assignee,
        isOverdue,
      };
    });

    const sprintEvents = sprints.flatMap((s) => [
      {
        id: `sprint-start-${s.id}`,
        entityId: s.id,
        entityType: 'SPRINT_START',
        title: `⚡ Start: ${s.name}`,
        date: s.startDate,
        status: s.status,
        projectName: s.project.name,
      },
      {
        id: `sprint-end-${s.id}`,
        entityId: s.id,
        entityType: 'SPRINT_END',
        title: `🏁 End: ${s.name}`,
        date: s.endDate,
        status: s.status,
        projectName: s.project.name,
      },
    ]);

    const projectEvents = projects
      .filter((p) => p.targetDate)
      .map((p) => ({
        id: `project-${p.id}`,
        entityId: p.id,
        entityType: 'PROJECT_TARGET',
        title: `🎯 Target Date: ${p.name}`,
        date: p.targetDate,
        status: p.status,
      }));

    return res.json({
      events: [...workItemEvents, ...sprintEvents, ...projectEvents],
      summary: {
        totalEvents: workItemEvents.length + sprintEvents.length + projectEvents.length,
        overdueCount: workItemEvents.filter((e) => e.isOverdue).length,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateDueDate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    const { dueDate } = req.body;

    const updated = await prisma.workItem.update({
      where: { id },
      data: { dueDate: dueDate ? new Date(dueDate) : null },
    });

    if (orgId && userId) {
      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          actorId: userId,
          action: 'UPDATE_WORK_ITEM_DUE_DATE',
          entityType: 'WorkItem',
          entityId: id,
          details: JSON.stringify({ dueDate }),
        },
      });
    }

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
