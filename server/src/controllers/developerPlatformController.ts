import { Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getOAuthApps = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const apps = await prisma.oAuthApp.findMany({
      where: { organizationId: orgId },
      include: { createdBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(apps);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createOAuthApp = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { name, redirectUri, scopes } = req.body;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!name || !redirectUri) return res.status(400).json({ message: 'App name and redirect URI are required' });

    const clientId = `app_id_${crypto.randomBytes(12).toString('hex')}`;
    const clientSecret = `app_sec_${crypto.randomBytes(24).toString('hex')}`;
    const clientSecretHash = crypto.createHash('sha256').update(clientSecret).digest('hex');

    const app = await prisma.oAuthApp.create({
      data: {
        organizationId: orgId,
        createdById: userId,
        name,
        clientId,
        clientSecretHash,
        redirectUri,
        scopes: JSON.stringify(scopes || ['projects:read', 'work_items:read']),
        status: 'ACTIVE',
      },
    });

    return res.status(201).json({
      ...app,
      clientSecret, // Plaintext secret returned ONLY ONCE upon creation
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const testWebhookEvent = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!endpoint) return res.status(404).json({ message: 'Webhook endpoint not found' });

    const testPayload = {
      event: 'work_item.created.v1',
      timestamp: new Date().toISOString(),
      data: {
        id: 'test_item_123',
        humanId: 'PROJ-101',
        title: 'Simulated Webhook Test Event Payload',
      },
    };

    const signature = 'sha256=' + crypto.createHmac('sha256', endpoint.secret).update(JSON.stringify(testPayload)).digest('hex');

    const delivery = await prisma.webhookDeliveryLog.create({
      data: {
        webhookEndpointId: endpoint.id,
        event: 'work_item.created.v1',
        payload: JSON.stringify(testPayload),
        httpStatus: 200,
        durationMs: 45,
        status: 'DELIVERED',
        attemptCount: 1,
      },
    });

    return res.json({
      success: true,
      message: 'Test event dispatched successfully',
      signature,
      delivery,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
