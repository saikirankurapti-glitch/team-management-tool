import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getOrganizationPolicies = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const policies = await prisma.organizationPolicy.findMany({
      where: { organizationId: orgId },
    });

    const versions = await prisma.configurationVersion.findMany({
      where: { organizationId: orgId },
      include: { changedBy: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return res.json({ policies, versions });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateOrganizationPolicy = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { category, policyKey, value } = req.body;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!category || !policyKey || value === undefined) {
      return res.status(400).json({ message: 'Category, policyKey, and value are required' });
    }

    const policy = await prisma.organizationPolicy.upsert({
      where: { organizationId_policyKey: { organizationId: orgId, policyKey } },
      update: {
        category,
        value: typeof value === 'string' ? value : JSON.stringify(value),
      },
      create: {
        organizationId: orgId,
        category,
        policyKey,
        value: typeof value === 'string' ? value : JSON.stringify(value),
      },
    });

    // Create Configuration Version snapshot
    const versionCount = await prisma.configurationVersion.count({ where: { organizationId: orgId } });

    await prisma.configurationVersion.create({
      data: {
        organizationId: orgId,
        configType: 'POLICY',
        version: versionCount + 1,
        changedById: userId,
        snapshot: JSON.stringify(policy),
      },
    });

    return res.json({ success: true, policy });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const checkConfigurationHealth = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const workflows = await prisma.workflow.findMany({
      where: { organizationId: orgId },
      include: { statuses: true, transitions: true },
    });

    const warnings: string[] = [];

    for (const wf of workflows) {
      if (wf.statuses.length < 2) {
        warnings.push(`Workflow "${wf.name}" has fewer than 2 status definitions.`);
      }
      for (const tr of wf.transitions) {
        const hasFrom = wf.statuses.some((s) => s.name === tr.fromStatus);
        const hasTo = wf.statuses.some((s) => s.name === tr.toStatus);
        if (!hasFrom || !hasTo) {
          warnings.push(`Workflow "${wf.name}" transition "${tr.fromStatus} -> ${tr.toStatus}" references undefined status.`);
        }
      }
    }

    return res.json({
      health: warnings.length === 0 ? 'EXCELLENT' : 'WARNINGS_DETECTED',
      warningCount: warnings.length,
      warnings,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
