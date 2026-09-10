import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getTeams = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const teams = await prisma.team.findMany({
      where: { organizationId: orgId },
      include: {
        teamLead: { select: { id: true, fullName: true, avatarUrl: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true, email: true, role: true } },
          },
        },
      },
    });

    return res.json(teams);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getTeamWorkload = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const users = await prisma.user.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        email: true,
        role: true,
        teamMemberships: { include: { team: { select: { name: true } } } },
        projectMemberships: { include: { project: { select: { key: true, name: true } } } },
        assignedItems: {
          select: {
            id: true,
            status: true,
            priority: true,
            dueDate: true,
            estimatedHours: true,
            storyPoints: true,
            projectId: true,
          },
        },
      },
    });

    const now = new Date();

    const workloadData = users.map((u) => {
      const activeTasks = u.assignedItems.filter((i) => i.status !== 'DONE');
      const completedTasks = u.assignedItems.filter((i) => i.status === 'DONE');
      const highPriorityTasks = activeTasks.filter((i) => i.priority === 'HIGH' || i.priority === 'URGENT');
      const overdueTasks = activeTasks.filter((i) => i.dueDate && new Date(i.dueDate) < now);
      const blockedTasks = activeTasks.filter((i) => i.status === 'BLOCKED');

      const totalActivePoints = activeTasks.reduce((acc, curr) => acc + (curr.storyPoints || 1), 0);
      // Assume baseline capacity of 20 points / 40 hrs per week per team member
      const capacityPoints = 20;
      const workloadPercentage = Math.min(Math.round((totalActivePoints / capacityPoints) * 100), 120);

      return {
        userId: u.id,
        fullName: u.fullName,
        avatarUrl: u.avatarUrl,
        email: u.email,
        role: u.role,
        teams: u.teamMemberships.map((tm) => tm.team.name),
        projects: u.projectMemberships.map((pm) => pm.project.name),
        activeCount: activeTasks.length,
        completedCount: completedTasks.length,
        highPriorityCount: highPriorityTasks.length,
        overdueCount: overdueTasks.length,
        blockedCount: blockedTasks.length,
        totalActivePoints,
        workloadPercentage,
      };
    });

    return res.json(workloadData);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
