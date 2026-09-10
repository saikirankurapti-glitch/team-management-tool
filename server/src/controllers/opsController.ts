import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { MetricsRegistry } from '../services/MetricsRegistry.js';
import { AiCircuitBreaker } from '../services/AiCircuitBreaker.js';
import { enqueueJob, processPendingJobs } from '../services/JobQueueManager.js';

export const getOpsMetrics = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const pendingCount = await prisma.backgroundJob.count({ where: { organizationId: orgId, status: 'PENDING' } });
    const completedCount = await prisma.backgroundJob.count({ where: { organizationId: orgId, status: 'COMPLETED' } });
    const failedCount = await prisma.backgroundJob.count({ where: { organizationId: orgId, status: 'FAILED' } });
    const deadLetterCount = await prisma.backgroundJob.count({ where: { organizationId: orgId, status: 'DEAD_LETTER' } });

    const metrics = MetricsRegistry.getMetrics();
    metrics.activeJobsPending = pendingCount;
    metrics.activeJobsFailed = failedCount + deadLetterCount;
    metrics.aiCircuitState = AiCircuitBreaker.getState();

    return res.json({
      metrics,
      jobs: {
        pending: pendingCount,
        completed: completedCount,
        failed: failedCount,
        deadLetter: deadLetterCount,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const enqueueTestJob = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { jobType, payload } = req.body;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const job = await enqueueJob({
      organizationId: orgId,
      jobType: jobType || 'NOTIFICATION',
      payload: payload || { test: true },
    });

    await processPendingJobs();

    return res.status(201).json({ success: true, job });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const replayWebhookEvent = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { webhookId, eventType } = req.body;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const job = await enqueueJob({
      organizationId: orgId,
      jobType: 'WEBHOOK',
      payload: { webhookId, eventType, isReplay: true },
    });

    await processPendingJobs();

    return res.json({ success: true, message: 'Webhook event replayed successfully', job });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
