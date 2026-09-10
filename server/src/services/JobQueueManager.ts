import { prisma } from '../prisma.js';

export interface JobOptions {
  organizationId: string;
  jobType: 'NOTIFICATION' | 'WEBHOOK' | 'AUTOMATION' | 'SEARCH_INDEX' | 'AI_TASK';
  payload: Record<string, any>;
  maxAttempts?: number;
}

export const enqueueJob = async (opts: JobOptions) => {
  const { organizationId, jobType, payload, maxAttempts = 5 } = opts;

  return await prisma.backgroundJob.create({
    data: {
      organizationId,
      jobType,
      payload: JSON.stringify(payload),
      maxAttempts,
      status: 'PENDING',
    },
  });
};

export const processPendingJobs = async () => {
  const pendingJobs = await prisma.backgroundJob.findMany({
    where: { status: 'PENDING' },
    take: 10,
  });

  for (const job of pendingJobs) {
    const start = Date.now();
    try {
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: 'PROCESSING', processedAt: new Date(), attempts: { increment: 1 } },
      });

      // Execute simulated worker execution based on jobType
      const durationMs = Date.now() - start;

      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          durationMs,
        },
      });
    } catch (err: any) {
      const isDeadLetter = job.attempts + 1 >= job.maxAttempts;
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: isDeadLetter ? 'DEAD_LETTER' : 'FAILED',
          lastError: err.message,
        },
      });
    }
  }
};
