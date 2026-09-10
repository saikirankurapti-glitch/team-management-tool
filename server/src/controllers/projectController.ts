import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getProjects = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const projects = await prisma.project.findMany({
      where: { organizationId: orgId },
      include: {
        owner: { select: { id: true, fullName: true, avatarUrl: true } },
        members: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
        workItems: {
          select: {
            id: true,
            status: true,
            priority: true,
            type: true,
            dueDate: true,
          },
        },
        sprints: {
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enrichedProjects = projects.map((p) => {
      const totalItems = p.workItems.length;
      const completedItems = p.workItems.filter((i) => i.status === 'DONE').length;
      const blockedItems = p.workItems.filter((i) => i.status === 'BLOCKED').length;
      const overdueItems = p.workItems.filter(
        (i) => i.status !== 'DONE' && i.dueDate && new Date(i.dueDate) < new Date()
      ).length;
      const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      return {
        ...p,
        stats: {
          totalItems,
          completedItems,
          blockedItems,
          overdueItems,
          progress,
        },
      };
    });

    return res.json(enrichedProjects);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getProjectByKey = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { key } = req.params;

    const project = await prisma.project.findFirst({
      where: { organizationId: orgId, key: key.toUpperCase() },
      include: {
        owner: { select: { id: true, fullName: true, avatarUrl: true, email: true } },
        members: { include: { user: { select: { id: true, fullName: true, avatarUrl: true, role: true } } } },
        sprints: { orderBy: { startDate: 'desc' } },
        channels: true,
      },
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });
    return res.json(project);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });

    const { key, name, description, startDate, targetDate, health } = req.body;
    if (!key || !name) {
      return res.status(400).json({ message: 'Key and Name are required' });
    }

    const uppercaseKey = key.toUpperCase().trim();

    const existing = await prisma.project.findFirst({
      where: { organizationId: orgId, key: uppercaseKey },
    });
    if (existing) {
      return res.status(409).json({ message: `Project key ${uppercaseKey} already exists` });
    }

    const project = await prisma.project.create({
      data: {
        organizationId: orgId,
        key: uppercaseKey,
        name,
        description,
        ownerId: userId,
        health: health || 'HEALTHY',
        startDate: startDate ? new Date(startDate) : null,
        targetDate: targetDate ? new Date(targetDate) : null,
        members: {
          create: { userId },
        },
      },
    });

    // Create a default project chat channel
    await prisma.channel.create({
      data: {
        organizationId: orgId,
        projectId: project.id,
        name: `${uppercaseKey.toLowerCase()}-general`,
        description: `Discussion for ${name}`,
        members: { create: { userId } },
      },
    });

    return res.status(201).json(project);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
