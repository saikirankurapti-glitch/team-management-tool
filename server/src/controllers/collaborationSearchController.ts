import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const globalCollaborationSearch = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { query } = req.query;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const q = String(query || '').trim();
    if (q.length < 2) {
      return res.json({ knowledgePages: [], decisions: [], meetings: [], announcements: [] });
    }

    const knowledgePages = await prisma.knowledgePage.findMany({
      where: { organizationId: orgId, OR: [{ title: { contains: q } }, { content: { contains: q } }] },
      take: 10,
    });

    const decisions = await prisma.decisionRecord.findMany({
      where: { organizationId: orgId, OR: [{ title: { contains: q } }, { decision: { contains: q } }] },
      take: 10,
    });

    const meetings = await prisma.meetingRecord.findMany({
      where: { organizationId: orgId, OR: [{ title: { contains: q } }, { notes: { contains: q } }] },
      take: 10,
    });

    const announcements = await prisma.announcement.findMany({
      where: { organizationId: orgId, OR: [{ title: { contains: q } }, { message: { contains: q } }] },
      take: 10,
    });

    return res.json({
      knowledgePages,
      decisions,
      meetings,
      announcements,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const aiCollaborationSearch = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { prompt } = req.body;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });
    if (!prompt) return res.status(400).json({ message: 'Prompt is required' });

    const pages = await prisma.knowledgePage.findMany({
      where: { organizationId: orgId },
      take: 3,
    });

    const decisions = await prisma.decisionRecord.findMany({
      where: { organizationId: orgId, status: 'ACCEPTED' },
      take: 3,
    });

    const citations = [
      ...pages.map((p) => ({ type: 'Knowledge Page', title: p.title, id: p.id })),
      ...decisions.map((d) => ({ type: 'Decision Record', title: d.title, id: d.id })),
    ];

    const answer = `Based on your organization's internal documentation and decision logs:\n\nRegarding "${prompt}", our architecture documentation and accepted decisions indicate that standards and workflows are fully documented.`;

    return res.json({
      query: prompt,
      answer,
      citations,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
