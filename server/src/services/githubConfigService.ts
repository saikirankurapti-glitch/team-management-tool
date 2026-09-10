import { prisma } from '../prisma.js';
import { decryptToken } from './githubService.js';

export interface ResolvedGitHubConfig {
  clientId: string | null;
  clientSecret: string | null;
  webhookSecret: string | null;
  callbackUrl: string | null;
  source: 'DATABASE' | 'ENVIRONMENT' | 'NONE';
  configured: boolean;
}

export const getGitHubAppConfigForOrg = async (orgId: string): Promise<ResolvedGitHubConfig> => {
  try {
    if (orgId) {
      const dbConfig = await prisma.gitHubAppConfig.findUnique({
        where: { organizationId: orgId },
      });

      if (dbConfig && dbConfig.isEnabled && dbConfig.clientId && dbConfig.encryptedClientSecret) {
        const decryptedClientSecret = decryptToken(dbConfig.encryptedClientSecret);
        const decryptedWebhookSecret = dbConfig.encryptedWebhookSecret
          ? decryptToken(dbConfig.encryptedWebhookSecret)
          : process.env.GITHUB_WEBHOOK_SECRET || null;

        const defaultCallback = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/auth/github/callback`;

        return {
          clientId: dbConfig.clientId,
          clientSecret: decryptedClientSecret,
          webhookSecret: decryptedWebhookSecret,
          callbackUrl: dbConfig.callbackUrl || process.env.GITHUB_CALLBACK_URL || defaultCallback,
          source: 'DATABASE',
          configured: true,
        };
      }
    }
  } catch (error) {
    console.error('[GitHubConfigService] Error reading DB config:', error);
  }

  // Fallback to Server Environment Variables
  const envClientId = process.env.GITHUB_CLIENT_ID;
  const envClientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (envClientId && envClientSecret) {
    const defaultCallback = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/auth/github/callback`;
    return {
      clientId: envClientId,
      clientSecret: envClientSecret,
      webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || null,
      callbackUrl: process.env.GITHUB_CALLBACK_URL || defaultCallback,
      source: 'ENVIRONMENT',
      configured: true,
    };
  }

  return {
    clientId: null,
    clientSecret: null,
    webhookSecret: null,
    callbackUrl: null,
    source: 'NONE',
    configured: false,
  };
};

export const getGitHubAppConfigForLogin = async (): Promise<ResolvedGitHubConfig> => {
  try {
    const dbConfig = await prisma.gitHubAppConfig.findFirst({
      where: { isEnabled: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (dbConfig && dbConfig.clientId && dbConfig.encryptedClientSecret) {
      const decryptedClientSecret = decryptToken(dbConfig.encryptedClientSecret);
      const decryptedWebhookSecret = dbConfig.encryptedWebhookSecret
        ? decryptToken(dbConfig.encryptedWebhookSecret)
        : process.env.GITHUB_WEBHOOK_SECRET || null;

      const defaultCallback = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/auth/github/callback`;

      return {
        clientId: dbConfig.clientId,
        clientSecret: decryptedClientSecret,
        webhookSecret: decryptedWebhookSecret,
        callbackUrl: dbConfig.callbackUrl || process.env.GITHUB_CALLBACK_URL || defaultCallback,
        source: 'DATABASE',
        configured: true,
      };
    }
  } catch (error) {
    console.error('[GitHubConfigService] Error reading DB config for login:', error);
  }

  // Fallback to Server Environment Variables
  const envClientId = process.env.GITHUB_CLIENT_ID;
  const envClientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (envClientId && envClientSecret) {
    const defaultCallback = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/auth/github/callback`;
    return {
      clientId: envClientId,
      clientSecret: envClientSecret,
      webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || null,
      callbackUrl: process.env.GITHUB_CALLBACK_URL || defaultCallback,
      source: 'ENVIRONMENT',
      configured: true,
    };
  }

  return {
    clientId: null,
    clientSecret: null,
    webhookSecret: null,
    callbackUrl: null,
    source: 'NONE',
    configured: false,
  };
};
