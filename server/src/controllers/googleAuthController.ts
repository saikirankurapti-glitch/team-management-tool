import { Request, Response } from 'express';
import { prisma } from '../prisma.js';
import { getGoogleAppConfigForOrg } from '../services/googleConfigService.js';
import {
  generateGoogleAuthUrl,
  exchangeCodeForTokens,
  getGoogleUserInfo,
  createOrUpdateGoogleConnection,
} from '../services/googleAuthService.js';
import {
  checkGoogleAllowlist,
  logSecurityEventAndAlertAdmin,
} from '../services/allowlistService.js';

export const getAuthUrlHandler = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId;

    const authUrl = await generateGoogleAuthUrl(orgId, { userId: user.id });
    return res.json({ authUrl });
  } catch (error: any) {
    console.error('[GoogleAuthController] Get auth URL error:', error);
    return res.status(400).json({ error: error.message || 'Failed to generate Google auth URL' });
  }
};

export const handleGoogleCallbackHandler = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { code, state } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    let parsedState: any = {};
    if (state) {
      try {
        parsedState = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
      } catch (e) {
        console.warn('[GoogleAuthController] Failed to parse state parameter');
      }
    }

    const orgId = parsedState.orgId || user?.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Organization context missing' });
    }

    const config = await getGoogleAppConfigForOrg(orgId);
    if (!config.configured || !config.clientId || !config.clientSecret || !config.redirectUri) {
      return res.status(400).json({ error: 'Google OAuth configuration is missing on server' });
    }

    const tokenRes = await exchangeCodeForTokens(code, config.redirectUri, config.clientId, config.clientSecret);
    const gUser = await getGoogleUserInfo(tokenRes.access_token);

    // Verify against OrganizationAuthAllowlist
    const allowlistCheck = await checkGoogleAllowlist(orgId, gUser.email);
    if (!allowlistCheck.allowed) {
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';

      await logSecurityEventAndAlertAdmin(
        orgId,
        {
          eventType: 'UNAUTHORIZED_GOOGLE_CONNECTION_ATTEMPT',
          provider: 'GOOGLE',
          email: gUser.email,
          ip: clientIp,
          userAgent,
          details: {
            googleSub: gUser.sub,
            userId: user.id,
            reason: allowlistCheck.reason,
          },
          status: 'BLOCKED',
        },
        (req as any).io
      );

      return res.status(403).json({
        error:
          'Access Restricted: This Google account is not authorized for this organization. Your attempt has been recorded and the administrator has been notified.',
      });
    }

    const connection = await createOrUpdateGoogleConnection(
      user.id,
      orgId,
      gUser.email,
      gUser.sub,
      tokenRes.access_token,
      tokenRes.refresh_token || null,
      tokenRes.expires_in,
      tokenRes.scope || ''
    );

    return res.json({
      success: true,
      message: `Successfully connected Google account (${gUser.email})`,
      connection: {
        id: connection.id,
        googleEmail: connection.googleEmail,
        status: connection.status,
        scope: connection.scope,
        lastValidatedAt: connection.lastValidatedAt,
      },
    });
  } catch (error: any) {
    console.error('[GoogleAuthController] Callback handler error:', error);
    return res.status(500).json({ error: error.message || 'Google authentication failed' });
  }
};

export const getConnectionStatusHandler = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId;

    const connection = await prisma.googleConnection.findFirst({
      where: {
        userId: user.id,
        ...(orgId ? { organizationId: orgId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection) {
      return res.json({
        connected: false,
        status: 'DISCONNECTED',
      });
    }

    return res.json({
      connected: connection.status === 'CONNECTED',
      id: connection.id,
      googleEmail: connection.googleEmail,
      googleUserId: connection.googleUserId,
      status: connection.status,
      scope: connection.scope,
      lastValidatedAt: connection.lastValidatedAt,
      tokenExpiry: connection.tokenExpiry,
    });
  } catch (error: any) {
    console.error('[GoogleAuthController] Connection status error:', error);
    return res.status(500).json({ error: error.message || 'Failed to check connection status' });
  }
};

export const disconnectGoogleHandler = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    await prisma.googleConnection.deleteMany({
      where: { userId: user.id },
    });

    return res.json({ success: true, message: 'Google account disconnected successfully' });
  } catch (error: any) {
    console.error('[GoogleAuthController] Disconnect error:', error);
    return res.status(500).json({ error: error.message || 'Failed to disconnect Google account' });
  }
};
