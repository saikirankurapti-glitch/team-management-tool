import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const createSupportTicket = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { category, subject, description } = req.body;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!subject || !description) return res.status(400).json({ message: 'Subject and description are required' });

    const ticket = await prisma.customerSupportTicket.create({
      data: {
        organizationId: orgId,
        createdById: userId,
        category: category || 'TECHNICAL',
        subject,
        description,
        status: 'OPEN',
      },
    });

    return res.status(201).json(ticket);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getSupportTickets = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const tickets = await prisma.customerSupportTicket.findMany({
      where: { organizationId: orgId },
      include: { createdBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(tickets);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
