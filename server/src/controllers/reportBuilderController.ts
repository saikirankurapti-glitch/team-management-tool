import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getExecutiveDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const projects = await prisma.project.findMany({
      where: { organizationId: orgId },
      include: { workItems: true },
    });

    const workItems = await prisma.workItem.findMany({
      where: { project: { organizationId: orgId } },
    });

    const risks = await prisma.riskObservation.findMany({
      where: { organizationId: orgId, status: 'ACTIVE' },
      take: 5,
    });

    const totalCount = workItems.length;
    const completedCount = workItems.filter((i) => i.status === 'DONE').length;
    const blockedCount = workItems.filter((i) => i.status === 'BLOCKED').length;
    const now = new Date();
    const overdueCount = workItems.filter((i) => i.status !== 'DONE' && i.dueDate && new Date(i.dueDate) < now).length;

    return res.json({
      executiveSummary: {
        activeProjects: projects.length,
        healthyProjects: projects.filter((p) => p.health === 'HEALTHY').length,
        atRiskProjects: projects.filter((p) => p.health === 'AT_RISK').length,
        criticalProjects: projects.filter((p) => p.health === 'CRITICAL').length,
        totalWorkItems: totalCount,
        completionPercentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
        blockedCount,
        overdueCount,
      },
      topRisks: risks,
      projectStatusBreakdown: projects.map((p) => ({
        id: p.id,
        key: p.key,
        name: p.name,
        health: p.health,
        progress: p.workItems.length > 0 ? Math.round((p.workItems.filter((i) => i.status === 'DONE').length / p.workItems.length) * 100) : 0,
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createScheduledReport = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { savedReportId, frequency, recipients } = req.body;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const schedule = await prisma.reportSchedule.create({
      data: {
        organizationId: orgId,
        savedReportId,
        frequency: frequency || 'WEEKLY',
        recipients: typeof recipients === 'string' ? recipients : JSON.stringify(recipients || []),
        isActive: true,
      },
    });

    return res.status(201).json(schedule);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getScheduledReports = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const schedules = await prisma.reportSchedule.findMany({
      where: { organizationId: orgId },
      include: { savedReport: true },
    });

    return res.json(schedules);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
