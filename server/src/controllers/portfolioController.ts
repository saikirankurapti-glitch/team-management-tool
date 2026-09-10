import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getPortfolioAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const projects = await prisma.project.findMany({
      where: { organizationId: orgId },
      include: {
        workItems: {
          include: {
            statusHistory: true,
            assignee: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        },
        sprints: true,
      },
    });

    const now = new Date();

    const projectMatrix = projects.map((p) => {
      const items = p.workItems;
      const totalItems = items.length;
      const doneItems = items.filter((i) => i.status === 'DONE').length;
      const blockedItems = items.filter((i) => i.status === 'BLOCKED').length;
      const overdueItems = items.filter((i) => i.status !== 'DONE' && i.dueDate && new Date(i.dueDate) < now).length;
      const progress = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

      let riskLevel = 'LOW';
      if (overdueItems > 3 || blockedItems > 2) riskLevel = 'HIGH';
      else if (overdueItems > 0 || blockedItems > 0) riskLevel = 'MEDIUM';

      return {
        id: p.id,
        key: p.key,
        name: p.name,
        health: p.health,
        riskLevel,
        progress,
        targetDate: p.targetDate,
        totalItems,
        doneItems,
        blockedItems,
        overdueItems,
        reasons: p.health === 'CRITICAL' ? [`${overdueItems} overdue items`, `${blockedItems} blocked items`] : [],
      };
    });

    // Monte Carlo Delivery Range Forecasting
    const allCompletedItems = await prisma.workItem.findMany({
      where: { project: { organizationId: orgId }, status: 'DONE' },
    });

    const remainingBacklogPoints = await prisma.workItem.aggregate({
      where: { project: { organizationId: orgId }, status: { not: 'DONE' } },
      _sum: { storyPoints: true },
    });

    const totalBacklogPoints = remainingBacklogPoints._sum.storyPoints || 0;
    
    // Compute dynamic velocity from completed sprints/work items
    const activeSprints = await prisma.sprint.findMany({
      where: { project: { organizationId: orgId }, status: 'COMPLETED' },
      take: 5,
      orderBy: { endDate: 'desc' },
    });

    const weeklyVelocitySamples = activeSprints.map((s) => s.completedPoints).filter((p) => p > 0);
    const avgVelocity = weeklyVelocitySamples.length > 0
      ? weeklyVelocitySamples.reduce((a, b) => a + b, 0) / weeklyVelocitySamples.length
      : 20; // Default baseline velocity if no sprints completed yet

    // Estimate completion weeks at 50%, 70%, 85% confidence percentiles
    const weeks50 = totalBacklogPoints > 0 ? Math.ceil(totalBacklogPoints / avgVelocity) : 0;
    const weeks70 = totalBacklogPoints > 0 ? Math.ceil(totalBacklogPoints / (avgVelocity * 0.85)) : 0;
    const weeks85 = totalBacklogPoints > 0 ? Math.ceil(totalBacklogPoints / (avgVelocity * 0.7)) : 0;

    const date50 = new Date(now.getTime() + weeks50 * 7 * 24 * 60 * 60 * 1000);
    const date70 = new Date(now.getTime() + weeks70 * 7 * 24 * 60 * 60 * 1000);
    const date85 = new Date(now.getTime() + weeks85 * 7 * 24 * 60 * 60 * 1000);

    // Cross-Project Resource Conflicts Detection
    const users = await prisma.user.findMany({
      where: { organizationId: orgId },
      include: {
        assignedItems: {
          where: {
            status: { not: 'DONE' },
            priority: { in: ['HIGH', 'URGENT'] },
          },
          include: { project: { select: { key: true, name: true } } },
        },
      },
    });

    const resourceConflicts = users
      .filter((u) => u.assignedItems.length > 1)
      .map((u) => ({
        userId: u.id,
        fullName: u.fullName,
        conflictCount: u.assignedItems.length,
        conflictingItems: u.assignedItems.map((i) => ({
          humanId: i.humanId,
          title: i.title,
          priority: i.priority,
          project: i.project.name,
        })),
        reason: `Assigned to ${u.assignedItems.length} concurrent urgent/high-priority tasks across multiple projects.`,
      }));

    return res.json({
      summary: {
        totalProjects: projects.length,
        healthyProjects: projects.filter((p) => p.health === 'HEALTHY').length,
        atRiskProjects: projects.filter((p) => p.health === 'AT_RISK').length,
        criticalProjects: projects.filter((p) => p.health === 'CRITICAL').length,
      },
      projectMatrix,
      monteCarloForecast: {
        remainingBacklogPoints: totalBacklogPoints,
        hasSufficientData: allCompletedItems.length >= 5,
        confidence50: { date: date50.toISOString().split('T')[0], weeks: weeks50 },
        confidence70: { date: date70.toISOString().split('T')[0], weeks: weeks70 },
        confidence85: { date: date85.toISOString().split('T')[0], weeks: weeks85 },
      },
      resourceConflicts,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
