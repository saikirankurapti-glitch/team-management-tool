import crypto from 'crypto';
import { prisma } from '../prisma.js';
import { getGoogleAppConfigForOrg, getGoogleAppConfigForLogin } from './googleConfigService.js';

const ALGORITHM = 'aes-256-cbc';

export const encryptToken = (token: string): string => {
  if (!token) return '';
  const secretKey = process.env.JWT_SECRET || 'fallback_secret_key_32_bytes_len';
  const key = crypto.createHash('sha256').update(secretKey).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

export const decryptToken = (encryptedToken: string): string => {
  if (!encryptedToken) return '';
  try {
    const secretKey = process.env.JWT_SECRET || 'fallback_secret_key_32_bytes_len';
    const key = crypto.createHash('sha256').update(secretKey).digest();
    const parts = encryptedToken.split(':');
    if (parts.length !== 2) return encryptedToken;
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    return encryptedToken;
  }
};

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.events.freebusy',
  'https://www.googleapis.com/auth/drive.file',
];

export const generateGoogleAuthUrl = async (orgId?: string, extraState: Record<string, string> = {}): Promise<string> => {
  const config = orgId ? await getGoogleAppConfigForOrg(orgId) : await getGoogleAppConfigForLogin();
  if (!config.configured || !config.clientId || !config.redirectUri) {
    throw new Error('Google OAuth is not configured. Please set Client ID and Client Secret in Settings -> Integrations -> Google Workspace.');
  }

  const stateObj = {
    orgId: orgId || '',
    timestamp: Date.now(),
    ...extraState,
  };

  const stateStr = Buffer.from(JSON.stringify(stateObj)).toString('base64');

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: stateStr,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  id_token?: string;
  token_type: string;
}

export const exchangeCodeForTokens = async (
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<GoogleTokenResponse> => {
  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[GoogleAuthService] Token exchange error:', response.status, errText);
    throw new Error(`Google token exchange failed: ${response.status} ${errText}`);
  }

  const data = (await response.json()) as GoogleTokenResponse;
  return data;
};

export interface GoogleUserInfo {
  sub: string;
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email_verified?: boolean;
}

export const getGoogleUserInfo = async (accessToken: string): Promise<GoogleUserInfo> => {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[GoogleAuthService] UserInfo fetch error:', response.status, errText);
    throw new Error(`Failed to fetch Google user profile: ${response.status}`);
  }

  return (await response.json()) as GoogleUserInfo;
};

export const refreshAccessToken = async (
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number; scope?: string }> => {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[GoogleAuthService] Refresh token error:', response.status, errText);
    throw new Error(`Failed to refresh Google token: ${response.status}`);
  }

  return (await response.json()) as { access_token: string; expires_in: number; scope?: string };
};

export const createOrUpdateGoogleConnection = async (
  userId: string,
  orgId: string,
  googleEmail: string,
  googleUserId: string,
  accessToken: string,
  refreshToken: string | null | undefined,
  expiresInSeconds: number,
  scope: string
) => {
  const encryptedAccess = encryptToken(accessToken);
  const encryptedRefresh = refreshToken ? encryptToken(refreshToken) : null;
  const tokenExpiry = new Date(Date.now() + expiresInSeconds * 1000);

  const existing = await prisma.googleConnection.findFirst({
    where: { userId, googleEmail },
  });

  if (existing) {
    return prisma.googleConnection.update({
      where: { id: existing.id },
      data: {
        googleUserId,
        accessTokenEncrypted: encryptedAccess,
        ...(encryptedRefresh ? { refreshTokenEncrypted: encryptedRefresh } : {}),
        tokenExpiry,
        scope,
        status: 'CONNECTED',
        lastValidatedAt: new Date(),
      },
    });
  } else {
    return prisma.googleConnection.create({
      data: {
        userId,
        organizationId: orgId,
        googleEmail,
        googleUserId,
        accessTokenEncrypted: encryptedAccess,
        refreshTokenEncrypted: encryptedRefresh,
        tokenExpiry,
        scope,
        status: 'CONNECTED',
      },
    });
  }
};

export const getValidAccessTokenForUser = async (userId: string, orgId?: string) => {
  const connection = await prisma.googleConnection.findFirst({
    where: {
      userId,
      ...(orgId ? { organizationId: orgId } : {}),
      status: 'CONNECTED',
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!connection) {
    throw new Error('Google Workspace connection not found or disconnected. Please connect your Google account.');
  }

  const now = new Date();
  const expiry = connection.tokenExpiry ? new Date(connection.tokenExpiry) : new Date(0);
  const isExpiringSoon = expiry.getTime() - now.getTime() < 5 * 60 * 1000;

  if (isExpiringSoon && connection.refreshTokenEncrypted) {
    try {
      const config = await getGoogleAppConfigForOrg(connection.organizationId);
      if (!config.configured || !config.clientId || !config.clientSecret) {
        throw new Error('Google OAuth credentials not configured.');
      }

      const decryptedRefresh = decryptToken(connection.refreshTokenEncrypted);
      const refreshResult = await refreshAccessToken(decryptedRefresh, config.clientId, config.clientSecret);

      const newEncryptedAccess = encryptToken(refreshResult.access_token);
      const newExpiry = new Date(Date.now() + refreshResult.expires_in * 1000);

      const updatedConn = await prisma.googleConnection.update({
        where: { id: connection.id },
        data: {
          accessTokenEncrypted: newEncryptedAccess,
          tokenExpiry: newExpiry,
          lastValidatedAt: new Date(),
        },
      });

      return {
        accessToken: refreshResult.access_token,
        connection: updatedConn,
      };
    } catch (err) {
      console.error('[GoogleAuthService] Failed to refresh token:', err);
      await prisma.googleConnection.update({
        where: { id: connection.id },
        data: { status: 'REAUTH_REQUIRED' },
      });
      throw new Error('Google authentication expired. Please re-authenticate your Google account.');
    }
  }

  const accessToken = decryptToken(connection.accessTokenEncrypted);
  return {
    accessToken,
    connection,
  };
};
