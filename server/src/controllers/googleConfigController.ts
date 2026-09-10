import { Request, Response } from 'express';
import { prisma } from '../prisma.js';
import { getGoogleAppConfigForOrg } from '../services/googleConfigService.js';
import { encryptToken, generateGoogleAuthUrl } from '../services/googleAuthService.js';

export const getGoogleConfigHandler = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    const config = await getGoogleAppConfigForOrg(orgId);
    const dbConfig = await prisma.googleAppConfig.findUnique({
      where: { organizationId: orgId },
    });

    return res.json({
      configured: config.configured,
      source: config.source,
      clientId: config.clientId || '',
      hasClientSecret: !!config.clientSecret,
      redirectUri: config.redirectUri || `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/auth/google/callback`,
      isEnabled: dbConfig ? dbConfig.isEnabled : true,
    });
  } catch (error: any) {
    console.error('[GoogleConfigController] Get config error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch Google configuration' });
  }
};

export const updateGoogleConfigHandler = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only organization administrators can modify Google OAuth settings' });
    }

    const { clientId, clientSecret, redirectUri, isEnabled } = req.body;

    if (!clientId || typeof clientId !== 'string' || !clientId.trim()) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    let encryptedSecretToSave: string | undefined = undefined;
    if (clientSecret && typeof clientSecret === 'string' && clientSecret.trim()) {
      encryptedSecretToSave = encryptToken(clientSecret.trim());
    }

    const existing = await prisma.googleAppConfig.findUnique({
      where: { organizationId: orgId },
    });

    if (!encryptedSecretToSave && (!existing || !existing.encryptedClientSecret)) {
      return res.status(400).json({ error: 'Client Secret is required for initial configuration' });
    }

    const defaultRedirect = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/auth/google/callback`;

    const updated = await prisma.googleAppConfig.upsert({
      where: { organizationId: orgId },
      update: {
        clientId: clientId.trim(),
        ...(encryptedSecretToSave ? { encryptedClientSecret: encryptedSecretToSave } : {}),
        redirectUri: redirectUri?.trim() || defaultRedirect,
        isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : true,
      },
      create: {
        organizationId: orgId,
        clientId: clientId.trim(),
        encryptedClientSecret: encryptedSecretToSave || '',
        redirectUri: redirectUri?.trim() || defaultRedirect,
        isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : true,
        createdById: user.id,
      },
    });

    return res.json({
      message: 'Google Workspace integration configuration saved successfully',
      configured: true,
      source: 'DATABASE',
      clientId: updated.clientId,
      hasClientSecret: true,
      redirectUri: updated.redirectUri,
      isEnabled: updated.isEnabled,
    });
  } catch (error: any) {
    console.error('[GoogleConfigController] Update config error:', error);
    return res.status(500).json({ error: error.message || 'Failed to save Google configuration' });
  }
};

export const deleteGoogleConfigHandler = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only organization administrators can delete Google OAuth settings' });
    }

    await prisma.googleAppConfig.deleteMany({
      where: { organizationId: orgId },
    });

    return res.json({ message: 'Google Workspace configuration deleted successfully' });
  } catch (error: any) {
    console.error('[GoogleConfigController] Delete config error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete Google configuration' });
  }
};

export const testGoogleConnectionHandler = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId;
    const config = await getGoogleAppConfigForOrg(orgId);

    if (!config.configured || !config.clientId || !config.clientSecret) {
      return res.status(400).json({
        success: false,
        error: 'Google OAuth integration is not configured. Please save valid Client ID and Client Secret.',
      });
    }

    const testUrl = await generateGoogleAuthUrl(orgId, { test: 'true' });

    return res.json({
      success: true,
      message: 'Google Workspace OAuth configuration is valid and ready for connections.',
      authUrl: testUrl,
      source: config.source,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to test Google Workspace connection',
    });
  }
};
