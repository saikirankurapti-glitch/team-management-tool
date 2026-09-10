import crypto from 'crypto';
import { prisma } from '../prisma.js';

const ALGORITHM = 'aes-256-cbc';

export const encryptToken = (token: string): string => {
  const secretKey = process.env.JWT_SECRET || 'fallback_secret_key_32_bytes_len';
  const key = crypto.createHash('sha256').update(secretKey).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

export const decryptToken = (encryptedToken: string): string => {
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

export const sanitizeBranchName = (rawName: string): string => {
  return rawName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]/g, '-') // Replace illegal Git ref characters with '-'
    .replace(/\.{2,}/g, '.') // No consecutive dots
    .replace(/\/{2,}/g, '/') // No consecutive slashes
    .replace(/-{2,}/g, '-') // No consecutive dashes
    .replace(/^[./-]+|[./-]+$/g, ''); // Trim leading/trailing separators
};

export const generateBranchName = (
  patternOrOptions?: string | null | { pattern?: string | null; type: string; humanId: string; title: string },
  type?: string,
  humanId?: string,
  title?: string
): string => {
  let activePattern: string | null | undefined = null;
  let activeType = 'FEATURE';
  let activeHumanId = 'TASK-1';
  let activeTitle = 'work-item';

  if (typeof patternOrOptions === 'object' && patternOrOptions !== null) {
    activePattern = patternOrOptions.pattern;
    activeType = patternOrOptions.type || 'FEATURE';
    activeHumanId = patternOrOptions.humanId || 'TASK-1';
    activeTitle = patternOrOptions.title || 'work-item';
  } else {
    activePattern = patternOrOptions;
    activeType = type || 'FEATURE';
    activeHumanId = humanId || 'TASK-1';
    activeTitle = title || 'work-item';
  }

  const typePrefixMap: Record<string, string> = {
    BUG: 'fix',
    FEATURE: 'feat',
    TASK: 'task',
    USER_STORY: 'story',
    EPIC: 'epic',
    SUBTASK: 'subtask',
  };

  const typeSlug = typePrefixMap[activeType.toUpperCase()] || 'feat';
  const titleSlug = sanitizeBranchName(activeTitle.substring(0, 40));
  const patternTemplate = activePattern || '{type}/{humanId}-{slug}';

  const formatted = patternTemplate
    .replace('{type}', typeSlug)
    .replace('{humanId}', activeHumanId)
    .replace('{slug}', titleSlug);

  return sanitizeBranchName(formatted);
};

export const extractWorkItemHumanIds = (text: string): string[] => {
  if (!text) return [];
  const matches = text.match(/\b([A-Z0-9]+-\d+)\b/gi) || [];
  return Array.from(new Set(matches.map((m) => m.toUpperCase())));
};

export const fetchFromGitHubApi = async (endpoint: string, accessToken: string, options: RequestInit = {}) => {
  const method = options.method || 'GET';
  console.log(`[GITHUB_API] endpoint=${endpoint} method=${method} hasToken=${!!accessToken}`);

  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Antigravity-Team-Management',
      ...(options.headers as Record<string, string>),
    },
  });

  const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
  const rateLimitLimit = response.headers.get('x-ratelimit-limit');
  const rateLimitReset = response.headers.get('x-ratelimit-reset');

  if (!response.ok) {
    const errText = await response.text();
    let message = `GitHub API Error (${response.status})`;
    try {
      const parsed = JSON.parse(errText);
      if (parsed.message) message = parsed.message;
    } catch {}

    const error = new Error(message) as any;
    error.status = response.status;
    error.rateLimitRemaining = rateLimitRemaining;
    error.rateLimitLimit = rateLimitLimit;
    error.rateLimitReset = rateLimitReset;
    error.rawResponseBody = errText;

    if (response.status === 429 || (response.status === 403 && rateLimitRemaining === '0')) {
      error.isRateLimit = true;
      const resetDate = rateLimitReset ? new Date(parseInt(rateLimitReset, 10) * 1000) : null;
      error.resetTime = resetDate ? resetDate.toLocaleTimeString() : 'later';
      error.message = `GitHub API rate limit reached. Reset at ${error.resetTime}.`;
    } else if (response.status === 403) {
      error.isForbidden = true;
    } else if (response.status === 401) {
      error.isAuthError = true;
    }

    throw error;
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  return response.json();
};

export const getValidGitHubTokenForUser = async (userId: string, orgId: string): Promise<string | null> => {
  const connection = await prisma.gitHubConnection.findFirst({
    where: { userId, organizationId: orgId, status: 'CONNECTED' },
    orderBy: { updatedAt: 'desc' },
  });

  if (!connection) return null;
  return decryptToken(connection.accessTokenEncrypted);
};
