import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getDailyDigest = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const workItems = await prisma.workItem.findMany({
      where: { project: { organizationId: orgId } },
      include: {
        project: { select: { key: true, name: true } },
        assignee: { select: { fullName: true } },
      },
    });

    const completedYesterday = workItems.filter(
      (i) => i.status === 'DONE' && new Date(i.updatedAt) >= yesterday
    );
    const overdueItems = workItems.filter(
      (i) => i.status !== 'DONE' && i.dueDate && new Date(i.dueDate) < now
    );
    const blockedItems = workItems.filter((i) => i.status === 'BLOCKED');

    const recentPullRequests = await prisma.pullRequest.findMany({
      where: { repository: { integration: { organizationId: orgId } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return res.json({
      date: now.toISOString().split('T')[0],
      summary: {
        completedYesterdayCount: completedYesterday.length,
        overdueCount: overdueItems.length,
        blockedCount: blockedItems.length,
      },
      completedYesterday: completedYesterday.map((i) => ({
        humanId: i.humanId,
        title: i.title,
        project: i.project.name,
        assignee: i.assignee?.fullName || 'Unassigned',
      })),
      overdueItems: overdueItems.map((i) => ({
        humanId: i.humanId,
        title: i.title,
        project: i.project.name,
        dueDate: i.dueDate,
        assignee: i.assignee?.fullName || 'Unassigned',
      })),
      blockedItems: blockedItems.map((i) => ({
        humanId: i.humanId,
        title: i.title,
        reason: i.blockedReason || 'No reason provided',
        assignee: i.assignee?.fullName || 'Unassigned',
      })),
      recentPullRequests,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
