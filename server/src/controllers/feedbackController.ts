import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const submitFeedback = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { category, type, description, message, pageUrl } = req.body;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });
    const content = description || message;
    if (!content) return res.status(400).json({ message: 'Feedback description is required' });

    const feedback = await prisma.feedback.create({
      data: {
        organizationId: orgId,
        userId,
        category: category || type || 'UX_ISSUE',
        description: content,
        pageUrl: pageUrl || null,
      },
      include: {
        user: { select: { fullName: true, email: true } },
      },
    });

    return res.status(201).json(feedback);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getActivationScore = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const userCount = await prisma.user.count({ where: { organizationId: orgId } });
    const projectCount = await prisma.project.count({ where: { organizationId: orgId } });
    const workItemCount = await prisma.workItem.count({ where: { project: { organizationId: orgId } } });
    const completedCount = await prisma.workItem.count({
      where: { project: { organizationId: orgId }, status: 'DONE' },
    });

    const isActivated = userCount >= 2 && projectCount >= 1 && workItemCount >= 5 && completedCount >= 1;
    const score = Math.min(100, Math.round(((userCount >= 2 ? 25 : 10) + (projectCount >= 1 ? 25 : 0) + (workItemCount >= 5 ? 25 : 10) + (completedCount >= 1 ? 25 : 0))));

    return res.json({
      activation: {
        isActivated,
        score,
        status: isActivated ? 'ACTIVATED' : 'ONBOARDING_IN_PROGRESS',
        metrics: {
          users: { current: userCount, target: 2 },
          projects: { current: projectCount, target: 1 },
          workItems: { current: workItemCount, target: 5 },
          completedItems: { current: completedCount, target: 1 },
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getFeedbacks = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const feedbacks = await prisma.feedback.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(feedbacks);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
