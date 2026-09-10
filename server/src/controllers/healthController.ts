import { Request, Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { isGoogleDriveConfigured } from '../services/googleDriveService.js';

export const getLiveness = (_req: Request, res: Response) => {
  return res.json({ status: 'UP', timestamp: new Date().toISOString() });
};

export const getReadiness = async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: 'READY', database: 'CONNECTED', timestamp: new Date().toISOString() });
  } catch (error: any) {
    return res.status(503).json({ status: 'NOT_READY', database: 'DISCONNECTED', error: error.message });
  }
};

export const getDependencyHealth = async (_req: Request, res: Response) => {
  try {
    const dbCheck = await prisma.$queryRaw`SELECT 1`.then(() => 'UP').catch(() => 'DOWN');
    const jobCheck = await prisma.backgroundJob.count().then(() => 'UP').catch(() => 'DOWN');

    const isHealthy = dbCheck === 'UP' && jobCheck === 'UP';

    return res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'HEALTHY' : 'DEGRADED',
      dependencies: {
        database: dbCheck,
        backgroundQueue: jobCheck,
        socketServer: 'UP',
        fileStorage: isGoogleDriveConfigured() ? 'GOOGLE_DRIVE' : 'LOCAL',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getIntegrationHealthDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    // 1. DB check
    let dbStatus = 'HEALTHY';
    let dbError = null;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (e: any) {
      dbStatus = 'CRITICAL';
      dbError = e.message;
    }

    // 2. GitHub check
    const ghConnection = await prisma.gitHubConnection.findFirst({
      where: { organizationId: orgId },
      orderBy: { updatedAt: 'desc' },
    });
    const ghStatus = ghConnection ? ghConnection.status : 'DISCONNECTED';

    // 3. Google Drive check
    const driveStatus = isGoogleDriveConfigured() ? 'CONFIGURED' : 'UNCONFIGURED_LOCAL';

    // 4. AI Provider check
    const aiConfigured = !!process.env.AI_API_KEY;
    const aiStatus = aiConfigured ? 'HEALTHY' : 'UNCONFIGURED';

    return res.json({
      timestamp: new Date().toISOString(),
      organizationId: orgId,
      integrations: {
        database: { status: dbStatus, error: dbError },
        authentication: { status: 'HEALTHY' },
        github: {
          status: ghStatus,
          account: ghConnection?.githubLogin || null,
          lastValidated: ghConnection?.lastValidatedAt || null,
        },
        googleDrive: {
          status: driveStatus,
          configured: isGoogleDriveConfigured(),
        },
        aiProvider: {
          status: aiStatus,
          provider: process.env.AI_PROVIDER || 'openai',
          configured: aiConfigured,
        },
        webSockets: { status: 'HEALTHY' },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
