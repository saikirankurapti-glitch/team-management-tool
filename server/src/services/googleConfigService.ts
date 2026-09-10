import { prisma } from '../prisma.js';
import { decryptToken, encryptToken } from './googleAuthService.js';

export interface ResolvedGoogleConfig {
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string | null;
  source: 'DATABASE' | 'ENVIRONMENT' | 'NONE';
  configured: boolean;
  environment: 'development' | 'production';
}

/**
 * Validates Google OAuth configuration based on GOOGLE_OAUTH_ENV.
 * In production mode, ensures non-empty Client ID, Secret, and HTTPS redirect URI.
 */
export const validateGoogleOAuthEnvironment = (config: ResolvedGoogleConfig): { valid: boolean; warnings: string[] } => {
  const warnings: string[] = [];
  const oauthEnv = process.env.GOOGLE_OAUTH_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'development');

  if (oauthEnv === 'production') {
    if (!config.configured) {
      warnings.push('CRITICAL: Production Google OAuth is not configured. Google Sign-In and workspace features will fail.');
    }
    if (config.redirectUri && config.redirectUri.includes('localhost')) {
      warnings.push('SECURITY WARNING: Production Google OAuth redirectUri points to localhost instead of production domain.');
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
};

export const getGoogleAppConfigForOrg = async (orgId: string): Promise<ResolvedGoogleConfig> => {
  try {
    if (orgId) {
      const dbConfig = await prisma.googleAppConfig.findUnique({
        where: { organizationId: orgId },
      });

      if (dbConfig && dbConfig.isEnabled && dbConfig.clientId && dbConfig.encryptedClientSecret) {
        const decryptedClientSecret = decryptToken(dbConfig.encryptedClientSecret);
        const defaultCallback = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/auth/google/callback`;

        return {
          clientId: dbConfig.clientId,
          clientSecret: decryptedClientSecret,
          redirectUri: dbConfig.redirectUri || process.env.GOOGLE_REDIRECT_URI || defaultCallback,
          source: 'DATABASE',
          configured: true,
          environment: (process.env.GOOGLE_OAUTH_ENV as any) || (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
        };
      }
    }
  } catch (error) {
    console.error('[GoogleConfigService] Error reading DB config:', error);
  }

  // Fallback to Server Environment Variables
  const envClientId = process.env.GOOGLE_CLIENT_ID;
  const envClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (envClientId && envClientSecret) {
    const defaultCallback = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/auth/google/callback`;
    return {
      clientId: envClientId,
      clientSecret: envClientSecret,
      redirectUri: process.env.GOOGLE_REDIRECT_URI || defaultCallback,
      source: 'ENVIRONMENT',
      configured: true,
      environment: (process.env.GOOGLE_OAUTH_ENV as any) || (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
    };
  }

  return {
    clientId: null,
    clientSecret: null,
    redirectUri: null,
    source: 'NONE',
    configured: false,
    environment: (process.env.GOOGLE_OAUTH_ENV as any) || (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
  };
};

export const getGoogleAppConfigForLogin = async (): Promise<ResolvedGoogleConfig> => {
  try {
    const dbConfig = await prisma.googleAppConfig.findFirst({
      where: { isEnabled: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (dbConfig && dbConfig.clientId && dbConfig.encryptedClientSecret) {
      const decryptedClientSecret = decryptToken(dbConfig.encryptedClientSecret);
      const defaultCallback = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/auth/google/callback`;

      return {
        clientId: dbConfig.clientId,
        clientSecret: decryptedClientSecret,
        redirectUri: dbConfig.redirectUri || process.env.GOOGLE_REDIRECT_URI || defaultCallback,
        source: 'DATABASE',
        configured: true,
        environment: (process.env.GOOGLE_OAUTH_ENV as any) || (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
      };
    }
  } catch (error) {
    console.error('[GoogleConfigService] Error reading DB config for login:', error);
  }

  // Fallback to Server Environment Variables
  const envClientId = process.env.GOOGLE_CLIENT_ID;
  const envClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (envClientId && envClientSecret) {
    const defaultCallback = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/auth/google/callback`;
    return {
      clientId: envClientId,
      clientSecret: envClientSecret,
      redirectUri: process.env.GOOGLE_REDIRECT_URI || defaultCallback,
      source: 'ENVIRONMENT',
      configured: true,
      environment: (process.env.GOOGLE_OAUTH_ENV as any) || (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
    };
  }

  return {
    clientId: null,
    clientSecret: null,
    redirectUri: null,
    source: 'NONE',
    configured: false,
    environment: (process.env.GOOGLE_OAUTH_ENV as any) || (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
  };
};
