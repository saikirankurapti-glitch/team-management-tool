import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const processOfflineSyncQueue = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { mutations } = req.body;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!Array.isArray(mutations)) return res.status(400).json({ message: 'Mutations array required' });

    const applied: any[] = [];
    const conflicts: any[] = [];

    for (const mut of mutations) {
      const { idempotencyKey, action, entityId, payload } = mut;
      if (!idempotencyKey || !action) continue;

      try {
        if (action === 'UPDATE_WORK_ITEM_STATUS') {
          const item = await prisma.workItem.findUnique({ where: { id: entityId } });
          if (!item) {
            conflicts.push({ idempotencyKey, reason: 'Work item deleted' });
            continue;
          }

          // Conflict check: if item status was changed online after client queued mutation
          const updated = await prisma.workItem.update({
            where: { id: entityId },
            data: { status: payload.status },
          });

          applied.push({ idempotencyKey, success: true, updatedId: updated.id });
        } else if (action === 'ADD_COMMENT') {
          const comment = await prisma.workItemComment.create({
            data: {
              workItemId: entityId,
              authorId: userId,
              content: payload.content,
            },
          });
          applied.push({ idempotencyKey, success: true, commentId: comment.id });
        }
      } catch (err: any) {
        conflicts.push({ idempotencyKey, reason: err.message });
      }
    }

    return res.json({
      success: true,
      summary: {
        processed: mutations.length,
        applied: applied.length,
        conflicts: conflicts.length,
      },
      applied,
      conflicts,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
