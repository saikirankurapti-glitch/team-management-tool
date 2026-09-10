import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getRiskObservations = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    let risks = await prisma.riskObservation.findMany({
      where: { organizationId: orgId },
      include: { project: { select: { key: true, name: true } } },
      orderBy: { detectedAt: 'desc' },
    });

    // If no risk observations exist in DB, create initial observations from empirical state
    if (risks.length === 0) {
      const now = new Date();
      const overdueItems = await prisma.workItem.count({
        where: { project: { organizationId: orgId }, status: { not: 'DONE' }, dueDate: { lt: now } },
      });

      if (overdueItems > 0) {
        await prisma.riskObservation.create({
          data: {
            organizationId: orgId,
            severity: overdueItems > 3 ? 'CRITICAL' : 'HIGH',
            sourceMetric: 'OVERDUE',
            title: 'Elevated Overdue Work Items',
            reason: `${overdueItems} work items breached target due dates across active projects.`,
            status: 'ACTIVE',
          },
        });

        risks = await prisma.riskObservation.findMany({
          where: { organizationId: orgId },
          include: { project: { select: { key: true, name: true } } },
          orderBy: { detectedAt: 'desc' },
        });
      }
    }

    return res.json(risks);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createRiskObservation = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { projectId, severity, sourceMetric, title, reason } = req.body;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });
    if (!title || !reason) return res.status(400).json({ message: 'Title and reason are required' });

    const risk = await prisma.riskObservation.create({
      data: {
        organizationId: orgId,
        projectId: projectId || null,
        severity: severity || 'HIGH',
        sourceMetric: sourceMetric || 'CUSTOM',
        title,
        reason,
        status: 'ACTIVE',
      },
    });

    return res.status(201).json(risk);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const resolveRiskObservation = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;

    const updated = await prisma.riskObservation.updateMany({
      where: { id, organizationId: orgId },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
