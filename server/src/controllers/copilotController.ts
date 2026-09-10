import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { processCopilotQuery } from '../services/aiGateway.js';

export const askCopilot = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { prompt, contextPage, conversationId } = req.body;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!prompt) return res.status(400).json({ message: 'Prompt is required' });

    const result = await processCopilotQuery(
      { prompt, contextPage, conversationId },
      { userId, organizationId: orgId, userRole: req.user?.role }
    );
    return res.json({
      ...result,
      reply: result.response,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const streamCopilot = async (req: AuthRequest, res: Response) => {
  const orgId = req.user?.organizationId;
  const userId = req.user?.id;
  const prompt = req.query.prompt as string;

  if (!orgId || !userId || !prompt) {
    return res.status(400).send('Prompt and authentication required');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendStep = (step: string, data?: any) => {
    res.write(`data: ${JSON.stringify({ step, data })}\n\n`);
  };

  try {
    sendStep('Thinking', { prompt });
    await new Promise((r) => setTimeout(r, 200));

    sendStep('Querying DB', { organizationId: orgId });
    await new Promise((r) => setTimeout(r, 300));

    sendStep('Executing Tools', { prompt });
    const result = await processCopilotQuery({ prompt }, { userId, organizationId: orgId, userRole: req.user?.role });

    sendStep('Done', result);
    res.end();
  } catch (err: any) {
    sendStep('Error', { message: err.message });
    res.end();
  }
};

export const confirmCopilotMutation = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { proposal } = req.body;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!proposal || !proposal.draft) return res.status(400).json({ message: 'Invalid proposal draft' });

    const { type, draft } = proposal;

    if (type === 'PROPOSAL_CREATE_WORK_ITEM') {
      const defaultProject = await prisma.project.findFirst({
        where: { organizationId: orgId },
      });

      if (!defaultProject) return res.status(400).json({ message: 'No active project found' });

      // Generate human ID strictly via count sequence (NO Math.random)
      const count = await prisma.workItem.count({ where: { projectId: defaultProject.id } });
      const humanId = `${defaultProject.key}-${100 + count + 1}`;

      const created = await prisma.workItem.create({
        data: {
          projectId: defaultProject.id,
          humanId,
          title: draft.title,
          type: draft.type || 'TASK',
          priority: draft.priority || 'MEDIUM',
          description: draft.description || 'Created via AI Copilot',
          reporterId: userId,
          status: 'BACKLOG',
        },
      });

      return res.status(201).json({
        success: true,
        message: `Successfully created work item [${created.humanId}]`,
        workItem: created,
      });
    }

    if (type === 'PROPOSAL_UPDATE_STATUS') {
      const item = await prisma.workItem.findFirst({
        where: { humanId: draft.humanId, project: { organizationId: orgId } },
      });

      if (!item) return res.status(404).json({ message: `Work item ${draft.humanId} not found` });

      const updated = await prisma.workItem.update({
        where: { id: item.id },
        data: { status: draft.targetStatus },
      });

      await prisma.workItemStatusHistory.create({
        data: {
          workItemId: item.id,
          oldStatus: item.status,
          newStatus: draft.targetStatus,
          changedById: userId,
        },
      });

      return res.json({
        success: true,
        message: `Successfully moved ${draft.humanId} to ${draft.targetStatus}`,
        workItem: updated,
      });
    }

    // Copilot Automation Rule Proposal (Requires explicit user confirmation)
    if (type === 'PROPOSAL_CREATE_AUTOMATION_RULE') {
      const userRole = req.user?.role;
      // Enforce RBAC: Regular team member cannot create automation rule
      if (userRole !== 'OWNER' && userRole !== 'ADMIN' && (userRole !== 'PROJECT_MANAGER' || !draft.projectId)) {
        return res.status(403).json({ message: 'Forbidden: You do not have permission to create automation rules.' });
      }

      const createdRule = await prisma.automationRule.create({
        data: {
          organizationId: orgId,
          projectId: draft.projectId || null,
          createdById: userId,
          name: draft.name,
          description: draft.description || 'Created via AI Copilot Proposal',
          trigger: draft.trigger,
          conditions: typeof draft.conditions === 'string' ? draft.conditions : JSON.stringify(draft.conditions || {}),
          actions: typeof draft.actions === 'string' ? draft.actions : JSON.stringify(draft.actions || []),
          isEnabled: draft.isEnabled !== undefined ? Boolean(draft.isEnabled) : true,
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          actorId: userId,
          action: 'AUTOMATION_CREATED',
          entityType: 'AutomationRule',
          entityId: createdRule.id,
          details: JSON.stringify({ name: createdRule.name, source: 'COPILOT_PROPOSAL' }),
        },
      });

      return res.status(201).json({
        success: true,
        message: `Successfully created automation rule '${createdRule.name}'`,
        rule: createdRule,
      });
    }

    return res.status(400).json({ message: 'Unsupported proposal type' });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAiConversations = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });

    const conversations = await prisma.aIConversation.findMany({
      where: { organizationId: orgId, userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    return res.json(conversations);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAiConversationMessages = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });

    const conversation = await prisma.aIConversation.findFirst({
      where: { id, organizationId: orgId, userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    return res.json(conversation.messages);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAiAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const logs = await prisma.aiAuditLog.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.json(logs);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAiSettings = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    let settings = await prisma.aiSettings.findUnique({
      where: { organizationId: orgId },
    });

    if (!settings) {
      settings = await prisma.aiSettings.create({
        data: {
          organizationId: orgId,
          isEnabled: true,
          provider: process.env.AI_PROVIDER || 'OPENAI',
          model: process.env.AI_MODEL || 'gpt-4o',
          monthlyUsageLimit: 10000,
          currentUsage: 0,
        },
      });
    }

    return res.json(settings);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
