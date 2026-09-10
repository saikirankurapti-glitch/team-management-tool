import { Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getApiKeys = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const keys = await prisma.apiKey.findMany({
      where: { organizationId: orgId },
      include: { createdBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(keys);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createApiKey = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { name, scopes } = req.body;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!name) return res.status(400).json({ message: 'API Key name is required' });

    // Generate secure secret and hash
    const secret = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(secret).digest('hex');
    const keyPrefix = secret.substring(0, 12);

    const apiKey = await prisma.apiKey.create({
      data: {
        organizationId: orgId,
        createdById: userId,
        name,
        keyHash,
        keyPrefix: `${keyPrefix}...`,
        scopes: JSON.stringify(scopes || ['projects:read', 'work_items:read']),
        status: 'ACTIVE',
      },
    });

    // Return plaintext secret ONLY ONCE upon creation
    return res.status(201).json({
      ...apiKey,
      secret,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const revokeApiKey = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;

    await prisma.apiKey.updateMany({
      where: { id, organizationId: orgId },
      data: { status: 'REVOKED' },
    });

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
