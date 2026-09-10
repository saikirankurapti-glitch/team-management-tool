import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { encryptToken } from '../services/githubService.js';
import { getGitHubAppConfigForLogin } from '../services/githubConfigService.js';
import { getGoogleAppConfigForLogin } from '../services/googleConfigService.js';
import {
  generateGoogleAuthUrl,
  exchangeCodeForTokens,
  getGoogleUserInfo,
  createOrUpdateGoogleConnection,
} from '../services/googleAuthService.js';
import { oauthStateManager } from '../services/oauthStateManager.js';
import {
  checkGoogleAllowlist,
  checkGitHubAllowlist,
  logSecurityEventAndAlertAdmin,
  createAccessRequest,
  ensureTeamMemberForAllowlistEntry,
} from '../services/allowlistService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-token-key-change-in-production-12345';

export const login = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { organization: true },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Set user online
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'ONLINE' },
    });

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organizationId: user.organizationId,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: 'ONLINE',
        organizationId: user.organizationId,
        organizationName: user.organization.name,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Login failed' });
  }
};

export const getGitHubAuthUrl = async (_req: AuthRequest, res: Response) => {
  const config = await getGitHubAppConfigForLogin();

  if (!config.configured || !config.clientId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'GITHUB_NOT_CONFIGURED',
        message: 'GitHub sign-in is temporarily unavailable. Please contact your administrator.',
        adminMessage: 'Missing GitHub configuration. Configure Client ID & Secret in Settings -> Integrations -> GitHub.',
        missingEnvVars: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
      },
    });
  }

  const state = oauthStateManager.generateState();
  const url = `https://github.com/login/oauth/authorize?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(
    config.callbackUrl!
  )}&scope=read:user%20user:email&state=${state}`;

  return res.json({ success: true, url, state });
};

export const handleGitHubCallback = async (req: AuthRequest, res: Response) => {
  const correlationId = crypto.randomBytes(8).toString('hex');
  const logStage = (stage: string, details?: any) => {
    console.log(`[GITHUB_OAUTH] correlation_id=${correlationId} stage=${stage}`, details ? JSON.stringify(details) : '');
  };

  try {
    const { code, state } = req.body;
    logStage('callback_received', { code_present: !!code, state_present: !!state });

    // Validate OAuth State parameter (Single-use, 10 min TTL)
    const stateValidation = oauthStateManager.validateState(state);
    if (!stateValidation.valid) {
      logStage('state_validation_failed', { state_present: !!state });
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: 'OAuth state parameter is invalid, expired, or already used. Please try signing in again.',
        },
      });
    }
    logStage('state_validated');

    const config = await getGitHubAppConfigForLogin();

    if (!config.configured || !config.clientId || !config.clientSecret) {
      logStage('config_missing', { source: config.source });
      return res.status(400).json({
        success: false,
        error: {
          code: 'GITHUB_CREDENTIALS_MISSING',
          message: 'GitHub sign-in is temporarily unavailable. Please contact your administrator.',
          adminMessage: 'Missing GitHub configuration. Configure Client ID & Secret in Settings -> Integrations -> GitHub.',
          missingEnvVars: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
        },
      });
    }
    logStage('config_loaded', { source: config.source, clientIdPrefix: config.clientId.substring(0, 6) + '...' });

    if (!code) {
      logStage('code_missing');
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CODE', message: 'Authorization code is required.' },
      });
    }

    // Exchange authorization code for GitHub access token
    logStage('exchanging_code_for_token');
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.callbackUrl,
      }),
    });

    const tokenData = await tokenRes.json();
    console.log(`[GITHUB_OAUTH] tokenExchangeStatus=${tokenRes.status}`);
    console.log(`[GITHUB_OAUTH] accessTokenReceived=${!!tokenData.access_token}`);
    console.log(`[GITHUB_OAUTH] scope=${tokenData.scope || 'N/A'}`);
    console.log(`[GITHUB_OAUTH] tokenType=${tokenData.token_type || 'N/A'}`);

    if (!tokenRes.ok || !tokenData.access_token || tokenData.error) {
      logStage('token_exchange_failed', { error: tokenData.error, description: tokenData.error_description });
      return res.status(400).json({

        success: false,
        error: {
          code: 'GITHUB_TOKEN_EXCHANGE_FAILED',
          message: tokenData.error_description || 'Failed to exchange GitHub authorization code.',
        },
      });
    }

    const accessToken = tokenData.access_token;
    logStage('token_exchanged');

    // Fetch user profile from GitHub API
    logStage('fetching_github_profile');
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Antigravity-Team-Management',
      },
    });

    if (!userRes.ok) {
      logStage('profile_fetch_failed', { http_status: userRes.status });
      return res.status(400).json({
        success: false,
        error: { code: 'GITHUB_PROFILE_FETCH_FAILED', message: 'Failed to retrieve user profile from GitHub.' },
      });
    }

    const githubUser = await userRes.json();
    logStage('profile_fetched', { github_id: githubUser.id, github_login: githubUser.login });
    let email = githubUser.email;

    // If primary email is missing/private on public profile, fetch user emails list
    if (!email) {
      logStage('fetching_github_emails');
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Antigravity-Team-Management',
        },
      });

      if (emailsRes.ok) {
        const emails: any[] = await emailsRes.json();
        const primaryEmail = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified) || emails[0];
        if (primaryEmail) {
          email = primaryEmail.email;
        }
      }
    }

    if (!email) {
      logStage('no_verified_email');
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_VERIFIED_EMAIL',
          message: 'Could not retrieve a verified email address from your GitHub account.',
        },
      });
    }

    const normalizedEmail = email.toLowerCase();
    const githubUserIdStr = String(githubUser.id);

    const mainOrg = await prisma.organization.findFirst();
    const orgId = mainOrg?.id || '';

    // Verify GitHub authorization against OrganizationAuthAllowlist
    const allowlistCheck = await checkGitHubAllowlist(orgId, githubUserIdStr, normalizedEmail);

    if (!allowlistCheck.allowed) {
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';

      await logSecurityEventAndAlertAdmin(
        orgId,
        {
          eventType: 'UNAUTHORIZED_GITHUB_CONNECTION_ATTEMPT',
          provider: 'GITHUB',
          email: normalizedEmail,
          externalIdentityId: githubUserIdStr,
          ip: clientIp,
          userAgent,
          details: {
            githubLogin: githubUser.login,
            githubUserId: githubUserIdStr,
            reason: allowlistCheck.reason,
          },
          status: 'BLOCKED',
        },
        (req as any).io
      );

      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED_GITHUB_ACCOUNT',
          message:
            'Access Restricted: This GitHub account is not authorized for this organization. Your attempt has been recorded and the administrator has been notified.',
        },
      });
    }

    // Allowlisted! Find the linked team member without creating duplicate users
    let user = allowlistCheck.user;

    if (!user) {
      // Check existing user by email or linked connection
      user = await prisma.user.findFirst({
        where: {
          organizationId: orgId,
          OR: [
            { githubConnections: { some: { githubUserId: githubUserIdStr } } },
            { email: normalizedEmail },
          ],
          isActive: true,
        },
        include: { organization: true },
      });
    }

    if (!user && allowlistCheck.entry) {
      user = await ensureTeamMemberForAllowlistEntry(allowlistCheck.entry.id, {
        name: githubUser.name || githubUser.login,
        email: normalizedEmail,
        picture: githubUser.avatar_url,
      });
    }

    if (!user) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'USER_NOT_LINKED',
          message:
            'Authorized GitHub identity found, but no active team member profile is linked to this account. Contact your administrator.',
        },
      });
    }

    // Ensure user organization is included
    if (!user.organization) {
      user = await prisma.user.findUnique({
        where: { id: user.id },
        include: { organization: true },
      });
    }

    // Update allowlist entry
    if (allowlistCheck.entry) {
      await (prisma as any).organizationAuthAllowlist.update({
        where: { id: allowlistCheck.entry.id },
        data: {
          lastLoginAt: new Date(),
          lastLoginIp: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '',
          lastLoginUserAgent: req.headers['user-agent'] || '',
          externalIdentityId: githubUserIdStr,
          userId: user.id,
        },
      });
    }

    // Update online status and avatar if needed
    await prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'ONLINE',
        avatarUrl: user.avatarUrl || githubUser.avatar_url || null,
      },
    });
    logStage('user_matched', { userId: user.id, email: user.email });

    // Safely link/upsert GitHubConnection record
    const encryptedToken = encryptToken(accessToken);
    const connection = await prisma.gitHubConnection.upsert({
      where: {
        userId_githubUserId: {
          userId: user.id,
          githubUserId: githubUserIdStr,
        },
      },
      update: {
        organizationId: user.organizationId,
        githubLogin: githubUser.login,
        accessTokenEncrypted: encryptedToken,
        scope: tokenData.scope || 'read:user,user:email',
        status: 'CONNECTED',
        lastValidatedAt: new Date(),
      },
      create: {
        userId: user.id,
        organizationId: user.organizationId,
        githubUserId: githubUserIdStr,
        githubLogin: githubUser.login,
        accessTokenEncrypted: encryptedToken,
        scope: tokenData.scope || 'read:user,user:email',
        status: 'CONNECTED',
        lastValidatedAt: new Date(),
      },
    });
    logStage('connection_linked', { connectionId: connection.id, githubLogin: githubUser.login });

    // Sync organization Integration record for system telemetry / status checks
    try {
      await prisma.integration.upsert({
        where: { id: `github-${user.organizationId}` },
        update: {
          provider: 'GITHUB',
          name: 'GitHub Integration',
          accountName: githubUser.login,
          accessToken: encryptedToken,
          status: 'CONNECTED',
          lastSyncAt: new Date(),
        },
        create: {
          id: `github-${user.organizationId}`,
          organizationId: user.organizationId,
          provider: 'GITHUB',
          name: 'GitHub Integration',
          accountName: githubUser.login,
          accessToken: encryptedToken,
          status: 'CONNECTED',
          lastSyncAt: new Date(),
        },
      });
      logStage('integration_synced', { organizationId: user.organizationId });
    } catch (integrationErr: any) {
      logStage('integration_sync_warning', { error: integrationErr.message });
    }

    // Create session JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organizationId: user.organizationId,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    logStage('session_created', { userId: user.id });

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: 'ONLINE',
        organizationId: user.organizationId,
        organizationName: user.organization.name,
      },
    });
  } catch (error: any) {
    logStage('fatal_error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message || 'GitHub authentication failed' },
    });
  }
};

export const getGoogleAuthUrl = async (_req: AuthRequest, res: Response) => {
  try {
    const config = await getGoogleAppConfigForLogin();

    if (!config.configured || !config.clientId || !config.redirectUri) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'GOOGLE_NOT_CONFIGURED',
          message: 'Google OAuth is not configured. Configure Client ID and Client Secret in Settings -> Integrations -> Google Workspace.',
        },
      });
    }

    const authUrl = await generateGoogleAuthUrl();
    return res.json({ success: true, url: authUrl });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { message: err.message } });
  }
};

export const handleGoogleCallback = async (req: AuthRequest, res: Response) => {
  const correlationId = crypto.randomBytes(8).toString('hex');
  const logStage = (stage: string, details?: Record<string, any>) => {
    // NEVER log: access_token, refresh_token, client_secret, authorization_code
    const safeLogs: Record<string, any> = {};
    if (details) {
      for (const [k, v] of Object.entries(details)) {
        if (!['access_token', 'refresh_token', 'client_secret', 'code', 'authorization_code'].includes(k)) {
          safeLogs[k] = v;
        }
      }
    }
    console.log(`[GOOGLE_CALLBACK] correlation_id=${correlationId} stage=${stage}`, Object.keys(safeLogs).length ? JSON.stringify(safeLogs) : '');
  };

  try {
    const { code } = req.body;
    logStage('callback_received', { code_present: !!code });

    const config = await getGoogleAppConfigForLogin();
    logStage('config_loaded', { source: config.source, configured: config.configured });

    if (!config.configured || !config.clientId || !config.clientSecret || !config.redirectUri) {
      logStage('config_missing');
      return res.status(400).json({
        success: false,
        error: {
          code: 'GOOGLE_CREDENTIALS_MISSING',
          message: 'Google OAuth credentials missing on server. Configure in Settings -> Integrations -> Google Workspace.',
          // ERROR TYPE A: Server configuration problem (not a user issue)
        },
      });
    }

    if (!code) {
      logStage('code_missing');
      return res.status(400).json({ message: 'Authorization code is required' });
    }

    // Exchange code for tokens (if this fails, it means Google blocked the user - Testing Mode)
    let tokenData: any;
    try {
      tokenData = await exchangeCodeForTokens(code, config.redirectUri, config.clientId, config.clientSecret);
      logStage('token_exchanged', { has_access_token: !!tokenData?.access_token, has_refresh_token: !!tokenData?.refresh_token });
    } catch (tokenErr: any) {
      logStage('token_exchange_failed', { error: tokenErr.message });
      return res.status(400).json({
        success: false,
        error: {
          // ERROR TYPE A: Google OAuth blocked this user (Testing Mode / invalid code)
          code: 'GOOGLE_TOKEN_EXCHANGE_FAILED',
          message: 'Google authentication failed. If this application is in development/testing mode, ensure your Google account is added as a Test User in the Google Cloud Console for this OAuth project.',
          detail: tokenErr.message,
        },
      });
    }

    let googleUser: any;
    try {
      googleUser = await getGoogleUserInfo(tokenData.access_token);
      logStage('google_identity_received', { email: googleUser.email, sub_hash: googleUser.sub ? googleUser.sub.slice(0, 8) + '***' : 'missing', email_verified: googleUser.email_verified });
    } catch (profileErr: any) {
      logStage('google_profile_fetch_failed', { error: profileErr.message });
      return res.status(400).json({
        success: false,
        error: { code: 'GOOGLE_PROFILE_FETCH_FAILED', message: 'Failed to retrieve profile from Google.' },
      });
    }

    if (!googleUser.email) {
      logStage('no_email_from_google');
      return res.status(400).json({ success: false, error: { code: 'NO_EMAIL', message: 'Failed to retrieve email from Google profile.' } });
    }

    // TMP Authorization check (Layer 2 - organization allowlist)
    const org = await prisma.organization.findFirst();
    const orgId = org?.id || '';
    logStage('org_resolved', { orgId: orgId ? orgId.slice(0, 8) + '...' : 'MISSING', orgName: org?.name });

    const allowlistCheck = await checkGoogleAllowlist(orgId, googleUser.email);
    logStage('allowlist_checked', { allowed: allowlistCheck.allowed, reason: allowlistCheck.reason, hasEntry: !!allowlistCheck.entry });

    if (!allowlistCheck.allowed) {
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';

      // Determine event type based on denial reason
      const eventType =
        allowlistCheck.reason === 'SUSPENDED'
          ? 'BLOCKED_SUSPENDED_LOGIN'
          : allowlistCheck.reason === 'REVOKED'
          ? 'BLOCKED_REVOKED_LOGIN'
          : 'UNAUTHORIZED_LOGIN_ATTEMPT';

      await logSecurityEventAndAlertAdmin(
        orgId,
        {
          eventType,
          provider: 'GOOGLE',
          email: googleUser.email,
          ip: clientIp,
          userAgent,
          details: {
            googleSub: googleUser.sub ? googleUser.sub.slice(0, 8) + '***' : null,
            googleName: googleUser.name,
            reason: allowlistCheck.reason,
            correlationId,
          },
          status: 'BLOCKED',
        },
        (req as any).io
      );

      // ERROR TYPE B: Google auth succeeded, TMP suspended
      if (allowlistCheck.reason === 'SUSPENDED') {
        logStage('result_suspended', { email: googleUser.email });
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCOUNT_SUSPENDED',
            message: 'Access Denied: Your Google account access has been suspended by the administrator.',
          },
        });
      }

      // ERROR TYPE B: Google auth succeeded, TMP revoked
      if (allowlistCheck.reason === 'REVOKED') {
        logStage('result_revoked', { email: googleUser.email });
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCOUNT_REVOKED',
            message: 'Access Denied: Your Google account access has been revoked by the administrator.',
          },
        });
      }

      // ERROR TYPE C: Google auth succeeded, TMP unauthorized -> create AccessRequest
      let accessRequestRecord = null;
      try {
        accessRequestRecord = await createAccessRequest(
          orgId,
          'GOOGLE',
          googleUser.email,
          {
            name: googleUser.name,
            displayName: googleUser.name,
            givenName: googleUser.given_name,
            familyName: googleUser.family_name,
            profileImageUrl: googleUser.picture,
            externalIdentityId: googleUser.sub,
            ip: clientIp,
            userAgent,
            io: (req as any).io,
          }
        );
        logStage('access_request_created', {
          requestId: accessRequestRecord?.id ? accessRequestRecord.id.slice(0, 8) + '...' : null,
          isNew: accessRequestRecord?.status === 'PENDING',
          email: googleUser.email,
          sub: googleUser.sub ? googleUser.sub.slice(0, 8) + '***' : undefined,
          attemptCount: accessRequestRecord?.attemptCount,
        });
      } catch (reqErr: any) {
        console.warn(`[GOOGLE_CALLBACK] correlation_id=${correlationId} Non-blocking createAccessRequest error:`, reqErr?.message);
      }

      const finalResult = accessRequestRecord?.status === 'APPROVED' ? 'ACCESS_ALREADY_APPROVED' : 'ACCESS_PENDING';
      logStage('result', { result: finalResult, email: googleUser.email });
      console.log(
        `[GOOGLE_CALLBACK] SUMMARY correlation_id=${correlationId} email=${googleUser.email} googleIdentity=FOUND tmpUser=NOT_FOUND allowlist=NOT_FOUND accessRequest=${accessRequestRecord ? 'CREATED' : 'FAILED'} result=${finalResult}`
      );

      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED_GOOGLE_ACCOUNT',
          message:
            'Access Request Pending: Your Google account has been authenticated successfully, but you are not yet authorized to access this organization. Your access request has been sent to the organization administrator.',
          email: googleUser.email,
          organizationName: org?.name || 'TMP Organization',
          requestedAt: accessRequestRecord?.createdAt || new Date().toISOString(),
          requestStatus: accessRequestRecord?.status || 'PENDING',
        },
      });
    }

    // Allowlist entry is ACTIVE!
    const allowlistEntry = allowlistCheck.entry;
    let user = allowlistCheck.user;

    // Phase 49: If allowlist entry doesn't have a linked user yet, automatically ensure or create Team Member profile
    if (!user) {
      user = await ensureTeamMemberForAllowlistEntry(allowlistEntry.id, {
        name: googleUser.name,
        email: googleUser.email,
        picture: googleUser.picture,
        given_name: googleUser.given_name,
        family_name: googleUser.family_name,
      });
    }

    // Ensure user object has organization
    if (!user.organization) {
      user = await prisma.user.findUnique({
        where: { id: user.id },
        include: { organization: true },
      });
    }

    // Update allowlist entry telemetry
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    await (prisma as any).organizationAuthAllowlist.update({
      where: { id: allowlistEntry.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: clientIp,
        lastLoginUserAgent: userAgent,
        externalIdentityId: googleUser.sub,
        userId: user.id, // Ensure identity is linked
      },
    });

    // Ensure organization is resolved from the existing user
    const resolvedOrgId = user.organizationId || allowlistEntry.organizationId;
    if (!resolvedOrgId) {
      logStage('org_resolution_failed', { userId: user.id });
      return res.status(500).json({
        success: false,
        error: {
          code: 'ORGANIZATION_RESOLUTION_FAILED',
          message:
            'Authentication configuration error. Your account is authorized, but its organization could not be resolved. Contact the administrator.',
        },
      });
    }

    // ERROR TYPE D: Approved - login succeeds
    logStage('allowlist_active', { email: googleUser.email, userId: user.id ? user.id.slice(0, 8) + '...' : null });
    console.log(
      `[GOOGLE_CALLBACK] SUMMARY correlation_id=${correlationId} email=${googleUser.email} googleIdentity=FOUND tmpUser=FOUND allowlist=ACTIVE accessRequest=N/A result=LOGIN_SUCCESS`
    );

    // Record successful login audit log with valid actorId and organization relation
    try {
      await prisma.auditLog.create({
        data: {
          organization: {
            connect: { id: resolvedOrgId },
          },
          actor: {
            connect: { id: user.id },
          },
          action: 'USER_LOGIN_GOOGLE',
          entityType: 'AUTHENTICATION',
          entityId: allowlistEntry.id,
          details: JSON.stringify({
            email: googleUser.email,
            provider: 'GOOGLE',
            ip: clientIp,
            timestamp: new Date().toISOString(),
          }),
        },
      });
    } catch (auditErr: any) {
      console.error('[GoogleAuth] Non-blocking AuditLog create error:', auditErr.message);
    }

    // Persist or update GoogleConnection record with tokens
    await createOrUpdateGoogleConnection(
      user.id,
      user.organizationId,
      googleUser.email,
      googleUser.sub,
      tokenData.access_token,
      tokenData.refresh_token || null,
      tokenData.expires_in,
      tokenData.scope || ''
    );

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organizationId: user.organizationId,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl || googleUser.picture,
        role: user.role,
        status: 'ONLINE',
        organizationId: user.organizationId,
        organizationName: user.organization.name,
      },
    });
  } catch (error: any) {
    const errMsg = error?.message || 'Unknown error';
    console.error(`[GOOGLE_CALLBACK] FATAL correlation_id=${correlationId} error=${errMsg}`);
    return res.status(500).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: 'Authentication could not be completed. Please try again. If the problem continues, contact the administrator.',
      },
    });
  }
};

export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        organization: true,
        teamMemberships: { include: { team: true } },
        projectMemberships: { include: { project: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      organizationId: user.organizationId,
      organization: user.organization,
      teams: user.teamMemberships.map((tm) => tm.team),
      projects: user.projectMemberships.map((pm) => pm.project),
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const logout = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { status: 'OFFLINE' },
      });
    }
    return res.json({ message: 'Logged out successfully' });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
