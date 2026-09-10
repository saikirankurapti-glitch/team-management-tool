import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { emitAutomationEvent } from '../services/automationEngine.js';

export const getSprints = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { projectId } = req.query;

    const where: any = {
      project: { organizationId: orgId },
    };
    if (projectId) where.projectId = String(projectId);

    const sprints = await prisma.sprint.findMany({
      where,
      include: {
        project: { select: { key: true, name: true } },
        team: { select: { id: true, name: true } },
        workItems: {
          select: {
            id: true,
            humanId: true,
            title: true,
            type: true,
            status: true,
            priority: true,
            storyPoints: true,
            estimatedHours: true,
            assigneeId: true,
            assignee: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    const enrichedSprints = sprints.map((s) => {
      const totalPoints = s.workItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
      const completedPoints = s.workItems
        .filter((item) => item.status === 'DONE')
        .reduce((sum, item) => sum + (item.storyPoints || 0), 0);
      const remainingPoints = totalPoints - completedPoints;
      const completionPercentage = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;
      const openCount = s.workItems.filter((item) => item.status !== 'DONE').length;
      const blockedCount = s.workItems.filter((item) => item.status === 'BLOCKED').length;

      return {
        ...s,
        metrics: {
          committedPoints: totalPoints,
          completedPoints,
          remainingPoints,
          completionPercentage,
          totalItems: s.workItems.length,
          openCount,
          blockedCount,
        },
      };
    });

    return res.json(enrichedSprints);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createSprint = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { projectId, name, goal, startDate, endDate, teamId } = req.body;

    if (!projectId || !name || !startDate || !endDate) {
      return res.status(400).json({ message: 'Project, Name, Start Date, and End Date are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      return res.status(400).json({ message: 'End date must be strictly after start date' });
    }

    const sprint = await prisma.sprint.create({
      data: {
        projectId,
        teamId: teamId || null,
        name,
        goal: goal || null,
        startDate: start,
        endDate: end,
        status: 'PLANNED',
        createdById: userId || null,
      },
    });

    if (orgId && userId) {
      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          actorId: userId,
          action: 'CREATE_SPRINT',
          entityType: 'Sprint',
          entityId: sprint.id,
          details: JSON.stringify({ name: sprint.name, startDate, endDate }),
        },
      });
    }

    return res.status(201).json(sprint);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const startSprint = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;

    const existing = await prisma.sprint.findUnique({
      where: { id },
      include: { workItems: true },
    });

    if (!existing) return res.status(404).json({ message: 'Sprint not found' });

    const totalCommittedPoints = existing.workItems.reduce((acc, item) => acc + (item.storyPoints || 0), 0);

    const updated = await prisma.sprint.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        committedPoints: totalCommittedPoints,
      },
    });

    if (orgId && userId) {
      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          actorId: userId,
          action: 'START_SPRINT',
          entityType: 'Sprint',
          entityId: id,
          details: JSON.stringify({ name: existing.name, committedPoints: totalCommittedPoints }),
        },
      });
    }

    // Trigger SPRINT_STARTED Automation
    if (orgId) {
      emitAutomationEvent({
        organizationId: orgId,
        trigger: 'SPRINT_STARTED',
        sprintId: updated.id,
        projectId: existing.projectId,
        actorId: userId,
        source: 'SPRINT',
        data: {
          sprintName: updated.name,
          committedPoints: totalCommittedPoints,
        },
      }).catch((err) => console.error('[Automation] Sprint started event error:', err));
    }

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const completeSprint = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    const { carryOverOption, targetSprintId } = req.body;
    // carryOverOption: 'NEXT_SPRINT' | 'BACKLOG'

    const sprint = await prisma.sprint.findUnique({
      where: { id },
      include: { workItems: true },
    });

    if (!sprint) return res.status(404).json({ message: 'Sprint not found' });

    const completedItems = sprint.workItems.filter((item) => item.status === 'DONE');
    const unfinishedItems = sprint.workItems.filter((item) => item.status !== 'DONE');

    const completedPoints = completedItems.reduce((acc, item) => acc + (item.storyPoints || 0), 0);

    // Update Sprint Status to COMPLETED
    const updatedSprint = await prisma.sprint.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedPoints,
      },
    });

    // Carry-Over Unfinished Items Workflow
    if (unfinishedItems.length > 0) {
      const destinationSprintId = carryOverOption === 'NEXT_SPRINT' ? targetSprintId : null;

      for (const item of unfinishedItems) {
        await prisma.workItem.update({
          where: { id: item.id },
          data: { sprintId: destinationSprintId || null },
        });

        // Record Audit Log for carry-over
        if (orgId && userId) {
          await prisma.auditLog.create({
            data: {
              organizationId: orgId,
              actorId: userId,
              action: 'CARRY_OVER_WORK_ITEM',
              entityType: 'WorkItem',
              entityId: item.id,
              details: JSON.stringify({
                humanId: item.humanId,
                fromSprintId: id,
                toSprintId: destinationSprintId || 'BACKLOG',
                reason: 'Sprint completion carry-over',
              }),
            },
          });
        }
      }
    }

    // Trigger SPRINT_COMPLETED Automation
    if (orgId) {
      emitAutomationEvent({
        organizationId: orgId,
        trigger: 'SPRINT_COMPLETED',
        sprintId: id,
        projectId: sprint.projectId,
        actorId: userId,
        source: 'SPRINT',
        data: {
          sprintName: updatedSprint.name,
          completedPoints,
          unfinishedCount: unfinishedItems.length,
          completedCount: completedItems.length,
        },
      }).catch((err) => console.error('[Automation] Sprint completed event error:', err));
    }

    return res.json({
      sprint: updatedSprint,
      completedPoints,
      unfinishedCount: unfinishedItems.length,
      carryOverOption: carryOverOption || 'BACKLOG',
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getSprintCapacity = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const sprint = await prisma.sprint.findUnique({
      where: { id },
      include: {
        workItems: {
          select: {
            id: true,
            humanId: true,
            title: true,
            storyPoints: true,
            estimatedHours: true,
            status: true,
            assigneeId: true,
            assignee: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!sprint) return res.status(404).json({ message: 'Sprint not found' });

    // Fetch all users in organization to calculate capacity
    const users = await prisma.user.findMany({
      where: { organizationId: req.user?.organizationId },
      select: { id: true, fullName: true, avatarUrl: true, role: true },
    });

    const baselineCapacityHours = 40; // 40 hours standard per sprint window

    const capacityData = users.map((u) => {
      const assignedWork = sprint.workItems.filter((i) => i.assigneeId === u.id);
      const assignedHours = assignedWork.reduce((sum, item) => sum + (item.estimatedHours || (item.storyPoints || 0) * 4), 0);
      const remainingHours = baselineCapacityHours - assignedHours;
      const isOverCapacity = assignedHours > baselineCapacityHours;

      return {
        userId: u.id,
        fullName: u.fullName,
        avatarUrl: u.avatarUrl,
        role: u.role,
        capacityHours: baselineCapacityHours,
        assignedHours,
        remainingHours,
        isOverCapacity,
        assignedItemCount: assignedWork.length,
      };
    });

    return res.json(capacityData);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getTeamVelocity = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { projectId } = req.query;

    const where: any = {
      project: { organizationId: orgId },
      status: 'COMPLETED',
    };
    if (projectId) where.projectId = String(projectId);

    const completedSprints = await prisma.sprint.findMany({
      where,
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        completedPoints: true,
        committedPoints: true,
      },
      orderBy: { endDate: 'asc' },
      take: 10,
    });

    const pointsArray = completedSprints.map((s) => s.completedPoints);
    const avgVelocity = pointsArray.length > 0 ? Math.round(pointsArray.reduce((a, b) => a + b, 0) / pointsArray.length) : 0;
    const last3Sprints = pointsArray.slice(-3);
    const last3Avg = last3Sprints.length > 0 ? Math.round(last3Sprints.reduce((a, b) => a + b, 0) / last3Sprints.length) : 0;

    return res.json({
      velocityHistory: completedSprints.map((s) => ({
        sprintName: s.name,
        committedPoints: s.committedPoints,
        completedPoints: s.completedPoints,
      })),
      avgVelocity,
      last3Avg,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getSprintMetrics = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const sprint = await prisma.sprint.findUnique({
      where: { id },
      include: {
        workItems: {
          include: {
            statusHistory: true,
          },
        },
      },
    });

    if (!sprint) return res.status(404).json({ message: 'Sprint not found' });

    const totalPoints = sprint.workItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
    const completedItems = sprint.workItems.filter((item) => item.status === 'DONE');
    const completedPoints = completedItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
    const remainingPoints = totalPoints - completedPoints;

    // Generate Burndown Chart Data (Day by day between startDate and endDate)
    const startDate = new Date(sprint.startDate);
    const endDate = new Date(sprint.endDate);
    const daysTotal = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    const burndownData: Array<{ day: string; ideal: number; actual: number }> = [];

    let current = new Date(startDate);
    let dayIndex = 0;
    const today = new Date();

    while (current <= endDate && current <= today) {
      const dayStr = current.toISOString().split('T')[0];
      const ideal = Math.max(0, Math.round(totalPoints - (totalPoints / daysTotal) * dayIndex));

      const pointsDoneByDay = sprint.workItems.reduce((acc, item) => {
        const doneTransition = item.statusHistory.find((h) => h.newStatus === 'DONE');
        if (doneTransition && new Date(doneTransition.changedAt) <= current) {
          return acc + (item.storyPoints || 0);
        }
        return acc;
      }, 0);

      const actual = Math.max(0, totalPoints - pointsDoneByDay);

      burndownData.push({
        day: dayStr,
        ideal,
        actual,
      });

      current.setDate(current.getDate() + 1);
      dayIndex++;
    }

    return res.json({
      sprintId: sprint.id,
      sprintName: sprint.name,
      committedPoints: totalPoints,
      completedPoints,
      remainingPoints,
      completionPercentage: totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0,
      burndownData,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
