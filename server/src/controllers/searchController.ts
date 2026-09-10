import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const globalSearch = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { q } = req.query;

    if (!q || String(q).trim().length < 2) {
      return res.json({ projects: [], workItems: [], messages: [], users: [] });
    }

    const queryStr = String(q).toLowerCase();

    const [projects, workItems, messages, users] = await Promise.all([
      prisma.project.findMany({
        where: {
          organizationId: orgId,
          OR: [
            { name: { contains: queryStr } },
            { key: { contains: queryStr } },
            { description: { contains: queryStr } },
          ],
        },
        take: 5,
      }),
      prisma.workItem.findMany({
        where: {
          project: { organizationId: orgId },
          OR: [
            { title: { contains: queryStr } },
            { humanId: { contains: queryStr } },
            { description: { contains: queryStr } },
          ],
        },
        include: { project: { select: { key: true } } },
        take: 10,
      }),
      prisma.message.findMany({
        where: {
          content: { contains: queryStr },
        },
        include: { sender: { select: { fullName: true } } },
        take: 10,
      }),
      prisma.user.findMany({
        where: {
          organizationId: orgId,
          OR: [
            { fullName: { contains: queryStr } },
            { email: { contains: queryStr } },
          ],
        },
        select: { id: true, fullName: true, avatarUrl: true, email: true, role: true },
        take: 5,
      }),
    ]);

    return res.json({
      projects,
      workItems,
      messages,
      users,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
