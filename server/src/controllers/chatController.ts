import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getChannels = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });

    // Fetch channels where user is a member or channel is PUBLIC
    const channels = await prisma.channel.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { type: 'PUBLIC' },
          { members: { some: { userId } } },
        ],
      },
      include: {
        project: { select: { id: true, name: true, key: true } },
        team: { select: { id: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Fetch user read states for unread calculations
    const readStates = await prisma.userReadState.findMany({
      where: { userId },
    });

    const enrichedChannels = await Promise.all(
      channels.map(async (c) => {
        const readState = readStates.find((rs) => rs.channelId === c.id);
        const unreadCount = await prisma.message.count({
          where: {
            channelId: c.id,
            createdAt: { gt: readState?.lastReadAt || new Date(0) },
            senderId: { not: userId },
          },
        });

        return {
          ...c,
          unreadCount,
        };
      })
    );

    return res.json(enrichedChannels);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createChannel = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { name, description, type, projectId, teamId } = req.body;

    if (!name) return res.status(400).json({ message: 'Channel name is required' });

    let channelName = name.toLowerCase().trim().replace(/\s+/g, '-');

    const existing = await prisma.channel.findFirst({
      where: { organizationId: orgId!, name: channelName },
      include: {
        members: {
          include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
        },
      },
    });

    if (existing) return res.json(existing);

    const channel = await prisma.channel.create({
      data: {
        organizationId: orgId!,
        name: channelName,
        description: description || null,
        type: type || 'PUBLIC',
        projectId: projectId || null,
        teamId: teamId || null,
        createdById: userId,
        members: {
          create: { userId: userId!, role: 'OWNER' },
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
        },
      },
    });

    return res.status(201).json(channel);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getConversations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const conversations = await prisma.conversation.findMany({
      where: {
        organizationId: orgId!,
        members: { some: { userId } },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { sender: { select: { fullName: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const readStates = await prisma.userReadState.findMany({
      where: { userId },
    });

    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const readState = readStates.find((rs) => rs.conversationId === conv.id);
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conv.id,
            createdAt: { gt: readState?.lastReadAt || new Date(0) },
            senderId: { not: userId },
          },
        });

        const otherMember = conv.members.find((m) => m.userId !== userId)?.user;

        return {
          ...conv,
          otherUser: otherMember,
          lastMessage: conv.messages[0] || null,
          unreadCount,
        };
      })
    );

    return res.json(enriched);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getOrCreateDM = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    const { targetUserId } = req.body;

    if (!userId || !targetUserId) return res.status(400).json({ message: 'Target user required' });

    // Check existing DM
    const existing = await prisma.conversation.findFirst({
      where: {
        organizationId: orgId!,
        type: 'DIRECT',
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: targetUserId } } },
        ],
      },
      include: {
        members: { include: { user: true } },
      },
    });

    if (existing) return res.json(existing);

    const conv = await prisma.conversation.create({
      data: {
        organizationId: orgId!,
        type: 'DIRECT',
        members: {
          create: [{ userId }, { userId: targetUserId }],
        },
      },
      include: {
        members: { include: { user: true } },
      },
    });

    return res.status(201).json(conv);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { channelId, conversationId, limit = '50', before } = req.query;

    const where: any = {};
    if (channelId) where.channelId = String(channelId);
    if (conversationId) where.conversationId = String(conversationId);
    if (before) where.createdAt = { lt: new Date(String(before)) };

    const messages = await prisma.message.findMany({
      where,
      take: parseInt(String(limit), 10),
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
        reactions: {
          include: { user: { select: { id: true, fullName: true } } },
        },
        workItem: {
          select: {
            id: true,
            humanId: true,
            title: true,
            status: true,
            priority: true,
            assignee: { select: { fullName: true } },
          },
        },
        parentMessage: {
          select: {
            id: true,
            content: true,
            sender: { select: { fullName: true } },
          },
        },
        attachments: true,
      },
    });

    return res.json(messages);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const senderId = req.user?.id;
    const { channelId, conversationId, content, messageType, workItemId, parentMessageId } = req.body;

    if (!senderId || (!channelId && !conversationId) || !content?.trim()) {
      return res.status(400).json({ message: 'Channel or Conversation and Content are required' });
    }

    const message = await prisma.message.create({
      data: {
        channelId: channelId || null,
        conversationId: conversationId || null,
        senderId,
        content: content.trim(),
        messageType: messageType || 'TEXT',
        workItemId: workItemId || null,
        parentMessageId: parentMessageId || null,
      },
      include: {
        sender: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
        reactions: true,
        workItem: {
          select: {
            id: true,
            humanId: true,
            title: true,
            status: true,
            priority: true,
            assignee: { select: { fullName: true } },
          },
        },
        parentMessage: {
          select: {
            id: true,
            content: true,
            sender: { select: { fullName: true } },
          },
        },
      },
    });

    // Extract @mentions e.g. @Sai or @Ravi
    const mentions = content.match(/@([A-Za-z0-9_]+)/g);
    if (mentions) {
      const users = await prisma.user.findMany({
        where: { organizationId: req.user?.organizationId },
      });
      for (const m of mentions) {
        const namePart = m.substring(1).toLowerCase();
        const targetUser = users.find((u) => u.fullName.toLowerCase().includes(namePart));
        if (targetUser && targetUser.id !== senderId) {
          await prisma.notification.create({
            data: {
              userId: targetUser.id,
              type: 'MENTION',
              title: `Mentioned in ${channelId ? 'channel' : 'chat'}`,
              body: `${req.user?.fullName}: "${content.substring(0, 60)}"`,
              link: channelId ? `/chat?channelId=${channelId}` : `/chat?conversationId=${conversationId}`,
            },
          });
        }
      }
    }

    // Update conversation updatedAt
    if (conversationId) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    }

    return res.status(201).json(message);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const editMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { content } = req.body;

    const existing = await prisma.message.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Message not found' });
    if (existing.senderId !== userId) return res.status(403).json({ message: 'Cannot edit message from another user' });

    const updated = await prisma.message.update({
      where: { id },
      data: {
        content: content.trim(),
        editedAt: new Date(),
      },
      include: {
        sender: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const existing = await prisma.message.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Message not found' });
    if (existing.senderId !== userId && req.user?.role !== 'OWNER' && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const updated = await prisma.message.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        content: 'This message was deleted.',
      },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const toggleReaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { emoji } = req.body;

    if (!userId || !emoji) return res.status(400).json({ message: 'Emoji required' });

    const existing = await prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId: id,
          userId,
          emoji,
        },
      },
    });

    if (existing) {
      await prisma.messageReaction.delete({ where: { id: existing.id } });
      return res.json({ action: 'REMOVED', messageId: id, emoji });
    } else {
      const created = await prisma.messageReaction.create({
        data: {
          messageId: id,
          userId,
          emoji,
        },
      });
      return res.status(201).json({ action: 'ADDED', reaction: created });
    }
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createTaskFromMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    const { projectId, type, priority, assigneeId, sprintId } = req.body;

    const msg = await prisma.message.findUnique({ where: { id } });
    if (!msg) return res.status(404).json({ message: 'Message not found' });

    let project = projectId ? await prisma.project.findUnique({ where: { id: projectId } }) : null;
    if (!project) {
      project = await prisma.project.findFirst({ where: { organizationId: orgId! } });
    }
    if (!project) return res.status(404).json({ message: 'No active project found' });

    const targetProjectId = project.id;
    const count = await prisma.workItem.count({ where: { projectId: targetProjectId } });
    const humanId = `${project.key || 'TASK'}-${100 + count + 1}`;

    const workItem = await prisma.workItem.create({
      data: {
        projectId: targetProjectId,
        humanId,
        title: msg.content.substring(0, 80),
        description: `Created from chat message by ${req.user?.fullName}:\n\n"${msg.content}"`,
        type: type || 'BUG',
        status: 'TO_DO',
        priority: priority || 'HIGH',
        reporterId: userId!,
        assigneeId: assigneeId || userId,
        sprintId: sprintId || null,
      },
    });

    // Update message to link work item
    await prisma.message.update({
      where: { id },
      data: {
        workItemId: workItem.id,
        messageType: 'WORK_ITEM_REFERENCE',
      },
    });

    const effectiveOrgId = req.user?.organizationId || project.organizationId;

    if (effectiveOrgId && userId) {
      try {
        await prisma.auditLog.create({
          data: {
            organizationId: effectiveOrgId,
            actorId: userId,
            action: 'CREATE_WORK_ITEM_FROM_CHAT',
            entityType: 'WorkItem',
            entityId: workItem.id,
            details: JSON.stringify({ humanId: workItem.humanId, fromMessageId: id }),
          },
        });
      } catch (auditErr) {
        // Audit log failed gracefully
      }
    }

    return res.status(201).json(workItem);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const shareWorkItemToChat = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { workItemId, channelId, conversationId } = req.body;

    const workItem = await prisma.workItem.findUnique({
      where: { id: workItemId },
      include: { assignee: true, project: true },
    });

    if (!workItem) return res.status(404).json({ message: 'Work Item not found' });

    const content = `Shared Work Item: **${workItem.humanId}** - ${workItem.title}`;

    const message = await prisma.message.create({
      data: {
        channelId: channelId || null,
        conversationId: conversationId || null,
        senderId: userId!,
        content,
        messageType: 'WORK_ITEM_REFERENCE',
        workItemId: workItem.id,
      },
      include: {
        sender: { select: { id: true, fullName: true, avatarUrl: true } },
        workItem: {
          select: {
            id: true,
            humanId: true,
            title: true,
            status: true,
            priority: true,
            assignee: { select: { fullName: true } },
          },
        },
      },
    });

    return res.status(201).json(message);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const searchChat = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { query } = req.query;

    if (!query || String(query).trim().length < 2) {
      return res.json({ messages: [], workItems: [] });
    }

    const q = String(query).trim();

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { channel: { organizationId: orgId! } },
          { conversation: { organizationId: orgId! } },
        ],
        content: { contains: q },
      },
      take: 20,
      include: {
        sender: { select: { fullName: true, avatarUrl: true } },
        channel: { select: { name: true } },
      },
    });

    const workItems = await prisma.workItem.findMany({
      where: {
        project: { organizationId: orgId! },
        OR: [
          { humanId: { contains: q } },
          { title: { contains: q } },
        ],
      },
      take: 10,
    });

    return res.json({ messages, workItems });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const markReadState = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { channelId, conversationId, lastReadMessageId } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    if (channelId) {
      await prisma.userReadState.upsert({
        where: { userId_channelId: { userId, channelId } },
        update: { lastReadMessageId, lastReadAt: new Date() },
        create: { userId, channelId, lastReadMessageId, lastReadAt: new Date() },
      });
    } else if (conversationId) {
      await prisma.userReadState.upsert({
        where: { userId_conversationId: { userId, conversationId } },
        update: { lastReadMessageId, lastReadAt: new Date() },
        create: { userId, conversationId, lastReadMessageId, lastReadAt: new Date() },
      });
    }

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
