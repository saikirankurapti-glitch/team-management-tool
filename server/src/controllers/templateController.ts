import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const BUILTIN_TEMPLATES = [
  {
    id: 'agile-software',
    name: 'Agile Software Development',
    category: 'SOFTWARE',
    description: 'Comprehensive DevOps setup with Epics, Stories, Tasks, Bugs, Kanban WIP limits, and Sprint cycles.',
    version: '1.0.0',
    isPublic: true,
  },
  {
    id: 'scrum-framework',
    name: 'Scrum Framework',
    category: 'SOFTWARE',
    description: 'Product backlog management, sprint planning, sprint reviews, and sprint retrospectives.',
    version: '1.0.0',
    isPublic: true,
  },
  {
    id: 'kanban-workflow',
    name: 'Kanban Workflow',
    category: 'OPERATIONS',
    description: 'Continuous flow board with To Do, In Progress, Review, and Done columns.',
    version: '1.0.0',
    isPublic: true,
  },
  {
    id: 'product-launch',
    name: 'Product Launch',
    category: 'PRODUCT',
    description: 'Structured product rollout pipeline: Discovery ➔ Planning ➔ QA ➔ Launch.',
    version: '1.0.0',
    isPublic: true,
  },
];

export const getProjectTemplates = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const customTemplates = await prisma.projectTemplate.findMany({
      where: { OR: [{ organizationId: orgId }, { isPublic: true }] },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      builtinTemplates: BUILTIN_TEMPLATES,
      customTemplates,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createProjectTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { name, category, description, config } = req.body;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });
    if (!name) return res.status(400).json({ message: 'Template name is required' });

    const template = await prisma.projectTemplate.create({
      data: {
        organizationId: orgId,
        name,
        category: category || 'SOFTWARE',
        description,
        config: JSON.stringify(config || { itemTypes: ['STORY', 'TASK', 'BUG'], statuses: ['TO_DO', 'IN_PROGRESS', 'DONE'] }),
        isPublic: false,
      },
    });

    return res.status(201).json(template);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createProjectFromTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { templateId, projectName, projectKey } = req.body;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!projectName) return res.status(400).json({ message: 'Project name is required' });

    const rawKey = (projectKey || projectName.toUpperCase().replace(/[^A-Z]/g, '') || 'PROJ').substring(0, 4);
    const key = `${rawKey}${Math.floor(Math.random() * 900) + 100}`;
    const resolvedName = projectName.replace('{{PROJECT_NAME}}', projectName);

    const project = await prisma.project.create({
      data: {
        organizationId: orgId,
        key,
        name: resolvedName,
        ownerId: userId,
        status: 'ACTIVE',
        health: 'HEALTHY',
      },
    });

    return res.status(201).json({
      success: true,
      message: `Project created from template successfully`,
      project,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
