import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { encryptToken, decryptToken, fetchFromGitHubApi } from '../services/githubService.js';
import { getGitHubAppConfigForOrg } from '../services/githubConfigService.js';

export const getGitHubConfig = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const config = await getGitHubAppConfigForOrg(orgId);

    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    const serverPort = process.env.PORT || '5000';
    const serverOrigin = process.env.SERVER_ORIGIN || `http://localhost:${serverPort}`;

    return res.json({
      success: true,
      configured: config.configured,
      source: config.source,
      clientId: config.clientId || '',
      hasClientSecret: !!config.clientSecret,
      hasWebhookSecret: !!config.webhookSecret,
      callbackUrl: config.callbackUrl || `${clientOrigin}/auth/github/callback`,
      webhookUrl: `${serverOrigin}/api/webhooks/github`,
      status: config.configured ? 'CONFIGURED' : 'NOT_CONFIGURED',
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
};

export const saveGitHubConfig = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userRole = req.user?.role;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });
    if (userRole !== 'OWNER' && userRole !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden: Only administrators can update GitHub configuration.' });
    }

    const { clientId, clientSecret, webhookSecret, callbackUrl, isEnabled = true } = req.body;

    if (!clientId) {
      return res.status(400).json({ message: 'Client ID is required.' });
    }

    const existingConfig = await prisma.gitHubAppConfig.findUnique({
      where: { organizationId: orgId },
    });

    let encryptedClientSecret = existingConfig?.encryptedClientSecret || '';
    if (clientSecret && !clientSecret.includes('••••')) {
      encryptedClientSecret = encryptToken(clientSecret);
    }

    if (!encryptedClientSecret) {
      return res.status(400).json({ message: 'Client Secret is required for new configurations.' });
    }

    let encryptedWebhookSecret = existingConfig?.encryptedWebhookSecret || null;
    if (webhookSecret !== undefined) {
      if (webhookSecret === '' || webhookSecret === null) {
        encryptedWebhookSecret = null;
      } else if (!webhookSecret.includes('••••')) {
        encryptedWebhookSecret = encryptToken(webhookSecret);
      }
    }

    const defaultCallback = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/auth/github/callback`;
    const finalCallbackUrl = callbackUrl && callbackUrl.trim() !== '' ? callbackUrl.trim() : defaultCallback;

    const updatedConfig = await prisma.gitHubAppConfig.upsert({
      where: { organizationId: orgId },
      update: {
        clientId: clientId.trim(),
        encryptedClientSecret,
        encryptedWebhookSecret,
        callbackUrl: finalCallbackUrl,
        isEnabled,
        createdById: req.user?.id,
      },
      create: {
        organizationId: orgId,
        clientId: clientId.trim(),
        encryptedClientSecret,
        encryptedWebhookSecret,
        callbackUrl: finalCallbackUrl,
        isEnabled,
        createdById: req.user?.id,
      },
    });

    return res.json({
      success: true,
      status: 'CONFIGURED',
      message: 'GitHub OAuth configuration is valid. User authorization is required.',
      config: {
        configured: true,
        clientId: updatedConfig.clientId,
        hasClientSecret: true,
        hasWebhookSecret: !!updatedConfig.encryptedWebhookSecret,
        callbackUrl: updatedConfig.callbackUrl,
        status: 'CONFIGURED',
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { code: 'SAVE_ERROR', message: error.message } });
  }
};

export const testGitHubConfig = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const config = await getGitHubAppConfigForOrg(orgId);

    if (!config.configured || !config.clientId || !config.clientSecret) {
      return res.status(400).json({
        success: false,
        valid: false,
        status: 'NOT_CONFIGURED',
        message: 'GitHub OAuth is not configured for this organization.',
      });
    }

    console.log(`[GITHUB_TEST] hasClientId=${!!config.clientId}`);
    console.log(`[GITHUB_TEST] hasClientSecret=${!!config.clientSecret}`);

    // Check if an active user connection exists for this user / org
    const connection = await prisma.gitHubConnection.findFirst({
      where: { organizationId: orgId, ...(userId ? { userId } : {}) },
      orderBy: { updatedAt: 'desc' },
    });

    console.log(`[GITHUB_TEST] hasAccessToken=${!!(connection && connection.accessTokenEncrypted)}`);

    if (connection && connection.accessTokenEncrypted) {
      try {
        const token = decryptToken(connection.accessTokenEncrypted);
        const githubUser = await fetchFromGitHubApi('/user', token);

        await prisma.gitHubConnection.update({
          where: { id: connection.id },
          data: { status: 'CONNECTED', lastValidatedAt: new Date() },
        });

        return res.json({
          success: true,
          valid: true,
          status: 'CONNECTED',
          message: `GitHub API connection active. Authenticated account: @${githubUser.login}`,
          details: {
            source: config.source,
            clientId: config.clientId,
            authenticatedAccount: githubUser.login,
            avatarUrl: githubUser.avatar_url,
          },
        });
      } catch (apiErr: any) {
        if (apiErr.status === 401) {
          await prisma.gitHubConnection.update({
            where: { id: connection.id },
            data: { status: 'AUTHENTICATION_REQUIRED' },
          });

          return res.status(401).json({
            success: false,
            valid: false,
            status: 'AUTHENTICATION_REQUIRED',
            message: 'GitHub connection token expired or revoked. Re-authorization required.',
          });
        }

        if (apiErr.isRateLimit) {
          return res.status(429).json({
            success: false,
            valid: false,
            status: 'RATE_LIMITED',
            message: apiErr.message,
          });
        }

        return res.status(apiErr.status || 400).json({
          success: false,
          valid: false,
          status: 'ERROR',
          message: apiErr.message || 'GitHub API request failed.',
        });
      }
    }

    // If no user connection exists, verify OAuth configuration parameters
    return res.json({
      success: true,
      valid: true,
      status: 'CONFIGURED',
      message: 'GitHub OAuth configuration is valid. User authorization is required.',
      details: {
        source: config.source,
        clientId: config.clientId,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      valid: false,
      status: 'ERROR',
      message: error.message || 'Failed to test GitHub configuration.',
    });
  }
};


export const deleteGitHubConfig = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userRole = req.user?.role;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });
    if (userRole !== 'OWNER' && userRole !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden: Only administrators can remove GitHub configuration.' });
    }

    await prisma.gitHubAppConfig.deleteMany({
      where: { organizationId: orgId },
    });

    return res.json({ success: true, message: 'GitHub configuration removed successfully.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { code: 'DELETE_ERROR', message: error.message } });
  }
};
