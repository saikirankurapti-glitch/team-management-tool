import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getProjectUpdates = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const updates = await prisma.projectUpdate.findMany({
      where: { organizationId: orgId },
      include: {
        author: { select: { fullName: true, email: true } },
        project: { select: { name: true, key: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(updates);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createProjectUpdate = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { projectId, title, healthStatus, summary, completedItems, nextSteps, risks } = req.body;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!projectId || !title || !summary) {
      return res.status(400).json({ message: 'Project, title, and summary are required' });
    }

    const update = await prisma.projectUpdate.create({
      data: {
        organizationId: orgId,
        authorId: userId,
        projectId,
        title,
        healthStatus: healthStatus || 'ON_TRACK',
        summary,
        completedItems: completedItems || null,
        nextSteps: nextSteps || null,
        risks: risks || null,
      },
      include: { author: { select: { fullName: true } } },
    });

    return res.status(201).json(update);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const aiDraftProjectUpdate = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { projectId } = req.body;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    let project = projectId ? await prisma.project.findUnique({ where: { id: projectId } }) : null;
    if (!project) {
      project = await prisma.project.findFirst({ where: { organizationId: orgId! } });
    }
    if (!project) return res.status(400).json({ message: 'No active project found' });

    const doneCount = await prisma.workItem.count({ where: { projectId: project.id, status: 'DONE' } });
    const inProgressCount = await prisma.workItem.count({ where: { projectId: project.id, status: 'IN_PROGRESS' } });

    const draft = {
      isAiDraft: true,
      title: `${project.name} Weekly Progress Update`,
      healthStatus: project.health || 'ON_TRACK',
      summary: `AI Draft for ${project.name}: Team completed ${doneCount} items with ${inProgressCount} active work items in progress.`,
      completedItems: `${doneCount} Work Items completed`,
      nextSteps: `Finalize remaining ${inProgressCount} active work items`,
      risks: 'No major blockers detected',
    };

    return res.json(draft);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
