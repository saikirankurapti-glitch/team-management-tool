import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getDecisions = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const decisions = await prisma.decisionRecord.findMany({
      where: { organizationId: orgId },
      include: {
        owner: { select: { fullName: true, email: true } },
        project: { select: { name: true, key: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(decisions);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createDecision = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { title, context, decision, reason, alternatives, projectId } = req.body;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!title || !decision) return res.status(400).json({ message: 'Title and decision statement are required' });

    const record = await prisma.decisionRecord.create({
      data: {
        organizationId: orgId,
        ownerId: userId,
        title,
        context: context || 'Decision record created',
        decision,
        reason: reason || null,
        alternatives: alternatives || null,
        projectId: projectId || null,
        status: 'ACCEPTED',
      },
      include: { owner: { select: { fullName: true } } },
    });

    return res.status(201).json(record);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const supersedeDecision = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const { title, decision, reason } = req.body;

    const oldRecord = await prisma.decisionRecord.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!oldRecord) return res.status(404).json({ message: 'Decision record not found' });

    // Create new superseding decision
    const newRecord = await prisma.decisionRecord.create({
      data: {
        organizationId: orgId,
        ownerId: userId!,
        title: title || `Supersedes: ${oldRecord.title}`,
        context: `Supersedes previous decision [${oldRecord.title}]`,
        decision,
        reason,
        projectId: oldRecord.projectId,
        status: 'ACCEPTED',
      },
    });

    // Mark old record as SUPERSEDED
    await prisma.decisionRecord.update({
      where: { id },
      data: {
        status: 'SUPERSEDED',
        supersededById: newRecord.id,
      },
    });

    return res.json({
      success: true,
      message: 'Decision superseded successfully',
      newDecision: newRecord,
      oldDecisionId: id,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
