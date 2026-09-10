import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getSecurityCenterOverview = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const activeKeys = await prisma.apiKey.count({
      where: { organizationId: orgId, status: 'ACTIVE' },
    });

    const activeWebhooks = await prisma.webhookEndpoint.count({
      where: { organizationId: orgId, status: 'ACTIVE' },
    });

    const activeIntegrations = await prisma.integration.count({
      where: { organizationId: orgId, status: 'CONNECTED' },
    });

    const recentAuditLogs = await prisma.auditLog.findMany({
      where: { organizationId: orgId },
      include: { actor: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    return res.json({
      securityOverview: {
        ssoStatus: 'OIDC_CONFIGURED',
        activeApiKeysCount: activeKeys,
        activeWebhooksCount: activeWebhooks,
        activeIntegrationsCount: activeIntegrations,
        mfaRequirement: 'ENFORCED_FOR_ADMINS',
      },
      recentSecurityEvents: recentAuditLogs,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
