import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { filter = 'all' } = req.query;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const where: any = { userId };
    if (filter === 'unread') where.isRead = false;
    if (filter === 'read') where.isRead = true;

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    return res.json({ notifications, unreadCount });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const updated = await prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getNotificationPreferences = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    let pref = await prisma.notificationPreference.findFirst({
      where: { userId },
    });

    if (!pref) {
      pref = await prisma.notificationPreference.create({
        data: {
          userId,
          taskAssignments: true,
          mentions: true,
          comments: true,
          statusChanges: true,
          sprintNotifications: true,
          projectNotifications: true,
          chatNotifications: true,
        },
      });
    }

    return res.json(pref);
  } catch (error: any) {
    console.error('[getNotificationPreferences error]:', error);
    return res.status(500).json({ message: error.message });
  }
};

export const updateNotificationPreferences = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { taskAssignments, mentions, comments, statusChanges, sprintNotifications, projectNotifications, chatNotifications } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const updated = await prisma.notificationPreference.upsert({
      where: { userId },
      update: {
        taskAssignments,
        mentions,
        comments,
        statusChanges,
        sprintNotifications,
        projectNotifications,
        chatNotifications,
      },
      create: {
        userId,
        taskAssignments,
        mentions,
        comments,
        statusChanges,
        sprintNotifications,
        projectNotifications,
        chatNotifications,
      },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
