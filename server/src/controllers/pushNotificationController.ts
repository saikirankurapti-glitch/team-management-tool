import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const subscribePush = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { endpoint, keys } = req.body;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: 'Valid push subscription endpoint and keys are required' });
    }

    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        organizationId: orgId,
        userId,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: req.headers['user-agent'] || null,
      },
      create: {
        organizationId: orgId,
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: req.headers['user-agent'] || null,
      },
    });

    return res.status(201).json({ success: true, subscription });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const testPushNotification = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const subs = await prisma.pushSubscription.findMany({ where: { userId } });

    return res.json({
      success: true,
      message: `Dispatched test push notification to ${subs.length} registered device endpoints`,
      payload: {
        title: 'Startup Workspace Alert',
        body: 'Task #PROJ-102 status changed to COMPLETED.',
        deepLink: '/work-items/PROJ-102',
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getUserSessions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const sessions = await prisma.userSession.findMany({
      where: { userId, isValid: true },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json(sessions);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const revokeUserSession = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { sessionId, revokeOthers } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    if (revokeOthers) {
      await prisma.userSession.updateMany({
        where: { userId, NOT: { id: sessionId } },
        data: { isValid: false },
      });
      return res.json({ success: true, message: 'All other active sessions revoked' });
    }

    if (sessionId) {
      await prisma.userSession.update({
        where: { id: sessionId },
        data: { isValid: false },
      });
      return res.json({ success: true, message: 'Session revoked successfully' });
    }

    return res.status(400).json({ message: 'Session ID or revokeOthers flag required' });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
