import { prisma } from '../prisma.js';

export interface CreateNotificationInput {
  userId: string;
  type: 'ASSIGNMENT' | 'MENTION' | 'COMMENT' | 'STATUS_CHANGE' | 'OVERDUE' | 'SPRINT' | 'PROJECT' | 'CHAT' | 'FILE';
  title: string;
  body: string;
  link?: string;
  io?: any;
}

export const createAndPushNotification = async (input: CreateNotificationInput) => {
  try {
    const { userId, type, title, body, link, io } = input;

    // Check user preferences
    const pref = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (pref) {
      if (type === 'ASSIGNMENT' && !pref.taskAssignments) return null;
      if (type === 'MENTION' && !pref.mentions) return null;
      if (type === 'COMMENT' && !pref.comments) return null;
      if (type === 'STATUS_CHANGE' && !pref.statusChanges) return null;
      if (type === 'SPRINT' && !pref.sprintNotifications) return null;
      if (type === 'PROJECT' && !pref.projectNotifications) return null;
      if (type === 'CHAT' && !pref.chatNotifications) return null;
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        link: link || null,
        isRead: false,
      },
    });

    // Real-time WebSocket push if Socket server provided
    if (io) {
      io.to(`user:${userId}`).emit('new_notification', notification);
    }

    return notification;
  } catch (error) {
    console.error('[NotificationService] Error creating notification', error);
    return null;
  }
};
