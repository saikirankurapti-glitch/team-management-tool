import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getApprovalRequests = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const requests = await prisma.approvalRequest.findMany({
      where: { organizationId: orgId },
      include: {
        requester: { select: { fullName: true, email: true } },
        approver: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(requests);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createApprovalRequest = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { title, entityType, entityId, approverId } = req.body;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!title || !entityType || !entityId) {
      return res.status(400).json({ message: 'Title, entityType, and entityId are required' });
    }

    const request = await prisma.approvalRequest.create({
      data: {
        organizationId: orgId,
        requesterId: userId,
        approverId: approverId || null,
        title,
        entityType,
        entityId,
        status: 'PENDING',
      },
      include: { requester: { select: { fullName: true } } },
    });

    return res.status(201).json(request);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const respondToApproval = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    const { status, comment } = req.body;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });
    if (status !== 'APPROVED' && status !== 'REJECTED') {
      return res.status(400).json({ message: 'Status must be APPROVED or REJECTED' });
    }

    const existing = await prisma.approvalRequest.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) return res.status(404).json({ message: 'Approval request not found' });

    const updated = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status,
        approverId: userId,
        comment: comment || null,
      },
    });

    return res.json({ success: true, approval: updated });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
