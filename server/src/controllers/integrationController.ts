import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getIntegrations = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const integrations = await prisma.integration.findMany({
      where: { organizationId: orgId },
      include: {
        repositories: true,
        _count: { select: { eventLogs: true } },
      },
    });

    return res.json(integrations);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createIntegration = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { provider = 'GITHUB', name, accountName, accessToken, webhookSecret } = req.body;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });
    if (!name) return res.status(400).json({ message: 'Name is required' });

    const integration = await prisma.integration.create({
      data: {
        organizationId: orgId,
        provider,
        name,
        accountName: accountName || 'OrganizationAccount',
        accessToken: accessToken || 'token_' + Date.now(),
        webhookSecret: webhookSecret || process.env.GITHUB_WEBHOOK_SECRET || null,
        status: 'CONNECTED',
        lastSyncAt: new Date(),
      },
    });

    return res.status(201).json(integration);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getIntegrationEventLogs = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const logs = await prisma.integrationEventLog.findMany({
      where: { integration: { organizationId: orgId } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.json(logs);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getWorkItemDevelopmentActivity = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const workItem = await prisma.workItem.findUnique({
      where: { id },
      include: {
        pullRequests: {
          include: { repository: true },
        },
      },
    });

    if (!workItem) return res.status(404).json({ message: 'Work item not found' });

    // Generate suggested branch names
    const slug = workItem.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
    const branchPrefix = workItem.type === 'BUG' ? 'bugfix' : 'feature';
    const suggestedBranch = `${branchPrefix}/${workItem.humanId}-${slug}`;

    return res.json({
      workItemId: workItem.id,
      humanId: workItem.humanId,
      suggestedBranch,
      pullRequests: workItem.pullRequests,
      deliveryTimeline: [
        { status: 'CREATED', label: 'Item Created', date: workItem.createdAt, done: true },
        { status: 'ASSIGNED', label: `Assigned`, date: workItem.updatedAt, done: !!workItem.assigneeId },
        { status: 'BRANCH', label: `Branch: ${suggestedBranch}`, done: workItem.pullRequests.length > 0 },
        { status: 'PR', label: 'Pull Request', done: workItem.pullRequests.length > 0 },
        { status: 'MERGE', label: 'PR Merged', done: workItem.pullRequests.some((p) => p.status === 'MERGED') },
        { status: 'DONE', label: 'Completed', done: workItem.status === 'DONE' },
      ],
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
