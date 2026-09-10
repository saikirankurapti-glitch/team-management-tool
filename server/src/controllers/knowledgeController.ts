import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getKnowledgePages = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const pages = await prisma.knowledgePage.findMany({
      where: { organizationId: orgId },
      include: {
        author: { select: { fullName: true, email: true } },
        project: { select: { name: true, key: true } },
        team: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json(pages);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createKnowledgePage = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { title, content, category, visibility, projectId, teamId } = req.body;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!title || !content) return res.status(400).json({ message: 'Title and content are required' });

    const page = await prisma.knowledgePage.create({
      data: {
        organizationId: orgId,
        authorId: userId,
        title,
        content,
        category: category || 'GENERAL',
        visibility: visibility || 'ORGANIZATION',
        projectId: projectId || null,
        teamId: teamId || null,
        version: 1,
      },
      include: { author: { select: { fullName: true } } },
    });

    // Create Version 1 record
    await prisma.knowledgePageVersion.create({
      data: {
        knowledgePageId: page.id,
        version: 1,
        title: page.title,
        content: page.content,
        editedById: userId,
      },
    });

    return res.status(201).json(page);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateKnowledgePage = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    const { title, content } = req.body;

    const existing = await prisma.knowledgePage.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) return res.status(404).json({ message: 'Knowledge page not found' });

    const newVersionNum = existing.version + 1;

    const updated = await prisma.knowledgePage.update({
      where: { id },
      data: {
        title: title || existing.title,
        content: content || existing.content,
        version: newVersionNum,
      },
    });

    await prisma.knowledgePageVersion.create({
      data: {
        knowledgePageId: id,
        version: newVersionNum,
        title: updated.title,
        content: updated.content,
        editedById: userId!,
      },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const convertPageToWorkItem = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    const { type, priority } = req.body;

    const page = await prisma.knowledgePage.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!page) return res.status(404).json({ message: 'Knowledge page not found' });

    let project = page.projectId ? await prisma.project.findUnique({ where: { id: page.projectId } }) : null;
    if (!project) {
      project = await prisma.project.findFirst({ where: { organizationId: orgId! } });
    }
    if (!project) return res.status(400).json({ message: 'No active project found' });

    const count = await prisma.workItem.count({ where: { projectId: project.id } });
    const key = project.key || 'PROJ';
    const humanId = `${key}-${100 + count + Math.floor(Math.random() * 890) + 10}-${Date.now().toString().slice(-3)}`;

    const workItem = await prisma.workItem.create({
      data: {
        projectId: project.id,
        humanId,
        title: page.title,
        description: `Created from Knowledge Page "${page.title}":\n\n${page.content.substring(0, 300)}...`,
        type: type || 'FEATURE',
        status: 'BACKLOG',
        priority: priority || 'MEDIUM',
        reporterId: userId!,
      },
    });

    return res.status(201).json({
      success: true,
      message: `Successfully created work item [${workItem.humanId}] from Knowledge Page`,
      workItem,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
