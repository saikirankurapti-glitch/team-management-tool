import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import {
  encryptToken,
  decryptToken,
  fetchFromGitHubApi,
  getValidGitHubTokenForUser,
  sanitizeBranchName,
  generateBranchName,
} from '../services/githubService.js';
import { getGitHubAppConfigForOrg } from '../services/githubConfigService.js';
import { oauthStateManager } from '../services/oauthStateManager.js';
import {
  checkGitHubAllowlist,
  logSecurityEventAndAlertAdmin,
} from '../services/allowlistService.js';

export const initiateGitHubOAuth = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const config = await getGitHubAppConfigForOrg(orgId || '');
    const redirectUri = config.callbackUrl || `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/auth/github/callback`;

    if (!config.configured || !config.clientId) {
      return res.json({
        success: false,
        configured: false,
        message: 'GitHub connection is temporarily unavailable. Please contact your administrator.',
        adminMessage: 'Missing GitHub configuration. Configure Client ID & Secret in Settings -> Integrations -> GitHub.',
        missingEnvVars: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
        error: {
          code: 'GITHUB_NOT_CONFIGURED',
          message: 'GitHub connection is temporarily unavailable. Please contact your administrator.',
          adminMessage: 'Missing GitHub configuration. Configure Client ID & Secret in Settings -> Integrations -> GitHub.',
          missingEnvVars: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
        },
      });
    }

    const state = oauthStateManager.generateState();
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=read:user%20user:email%20repo&state=${state}`;

    return res.json({ success: true, url: authUrl, state });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { code: 'OAUTH_ERROR', message: error.message } });
  }
};

export const handleGitHubOAuthCallback = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    const { code, state } = req.body;

    if (!userId || !orgId) return res.status(401).json({ message: 'Unauthorized' });

    if (state) {
      const stateValidation = oauthStateManager.validateState(state);
      if (!stateValidation.valid) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STATE',
            message: 'OAuth state parameter is invalid or expired. Please try connecting again.',
          },
        });
      }
    }

    if (!code) return res.status(400).json({ message: 'Authorization code is required' });

    const config = await getGitHubAppConfigForOrg(orgId);

    if (!config.configured || !config.clientId || !config.clientSecret) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'GITHUB_CREDENTIALS_MISSING',
          message: 'GitHub connection is temporarily unavailable. Please contact your administrator.',
          adminMessage: 'Missing GitHub configuration. Configure Client ID & Secret in Settings -> Integrations -> GitHub.',
          missingEnvVars: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
        },
      });
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
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

    const tokenData = await tokenResponse.json();

    if (tokenData.error || !tokenData.access_token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'GITHUB_TOKEN_EXCHANGE_FAILED',
          message: tokenData.error_description || 'Failed to exchange authorization code for token.',
        },
      });
    }

    const accessToken = tokenData.access_token;
    const scope = tokenData.scope || 'read:user,user:email,repo';

    // Fetch GitHub User identity
    const githubUser = await fetchFromGitHubApi('/user', accessToken);
    const encryptedToken = encryptToken(accessToken);
    const githubUserIdStr = String(githubUser.id);

    // Verify GitHub authorization policy against OrganizationAuthAllowlist
    const allowlistCheck = await checkGitHubAllowlist(orgId, githubUserIdStr, githubUser.email);
    if (!allowlistCheck.allowed) {
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';

      await logSecurityEventAndAlertAdmin(
        orgId,
        {
          eventType: 'UNAUTHORIZED_GITHUB_CONNECTION_ATTEMPT',
          provider: 'GITHUB',
          email: githubUser.email,
          externalIdentityId: githubUserIdStr,
          ip: clientIp,
          userAgent,
          details: {
            githubLogin: githubUser.login,
            githubUserId: githubUserIdStr,
            userId,
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

    // Update allowlist entry if found
    if (allowlistCheck.entry) {
      await (prisma as any).organizationAuthAllowlist.update({
        where: { id: allowlistCheck.entry.id },
        data: {
          lastLoginAt: new Date(),
          externalIdentityId: githubUserIdStr,
          userId,
        },
      });
    }

    const connection = await prisma.gitHubConnection.upsert({
      where: {
        userId_githubUserId: {
          userId,
          githubUserId: githubUserIdStr,
        },
      },
      update: {
        organizationId: orgId,
        githubLogin: githubUser.login,
        accessTokenEncrypted: encryptedToken,
        scope,
        status: 'CONNECTED',
        lastValidatedAt: new Date(),
      },
      create: {
        userId,
        organizationId: orgId,
        githubUserId: String(githubUser.id),
        githubLogin: githubUser.login,
        accessTokenEncrypted: encryptedToken,
        scope,
        status: 'CONNECTED',
        lastValidatedAt: new Date(),
      },
    });

    // Also update/create Integration record for organization level tracking
    await prisma.integration.upsert({
      where: { id: `github-${orgId}` },
      update: {
        status: 'CONNECTED',
        accountName: githubUser.login,
        accessToken: encryptedToken,
        lastSyncAt: new Date(),
      },
      create: {
        id: `github-${orgId}`,
        organizationId: orgId,
        provider: 'GITHUB',
        name: 'GitHub Organization Integration',
        accountName: githubUser.login,
        accessToken: encryptedToken,
        webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || 'secret_webhook_signature',
        status: 'CONNECTED',
        lastSyncAt: new Date(),
      },
    });

    return res.json({
      success: true,
      connection: {
        id: connection.id,
        githubLogin: connection.githubLogin,
        status: connection.status,
        scope: connection.scope,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { code: 'CALLBACK_ERROR', message: error.message } });
  }
};

export const getGitHubConnectionStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    if (!userId || !orgId) return res.status(401).json({ message: 'Unauthorized' });

    const connection = await prisma.gitHubConnection.findFirst({
      where: { userId, organizationId: orgId },
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection) {
      return res.json({
        connected: false,
        status: 'DISCONNECTED',
        message: 'GitHub is not connected for this user account.',
      });
    }

    try {
      const token = decryptToken(connection.accessTokenEncrypted);
      const user = await fetchFromGitHubApi('/user', token);

      await prisma.gitHubConnection.update({
        where: { id: connection.id },
        data: { status: 'CONNECTED', lastValidatedAt: new Date() },
      });

      return res.json({
        connected: true,
        status: 'CONNECTED',
        githubLogin: user.login,
        avatarUrl: user.avatar_url,
        lastValidatedAt: connection.lastValidatedAt,
      });
    } catch (err: any) {
      if (err.isRateLimit) {
        return res.json({
          connected: true,
          status: 'RATE_LIMITED',
          githubLogin: connection.githubLogin,
          message: err.message || 'GitHub API rate limit reached. Try again later.',
        });
      }

      const newStatus = err.status === 401 ? 'AUTHENTICATION_REQUIRED' : err.status === 403 ? 'FORBIDDEN' : 'ERROR';
      await prisma.gitHubConnection.update({
        where: { id: connection.id },
        data: { status: newStatus },
      });

      return res.json({
        connected: false,
        status: newStatus,
        githubLogin: connection.githubLogin,
        message: err.message || 'GitHub connection token expired or revoked.',
      });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { code: 'STATUS_ERROR', message: error.message } });
  }
};

export const disconnectGitHub = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    if (!userId || !orgId) return res.status(401).json({ message: 'Unauthorized' });

    await prisma.gitHubConnection.deleteMany({
      where: { userId, organizationId: orgId },
    });

    return res.json({ success: true, message: 'GitHub connection removed successfully.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { code: 'DISCONNECT_ERROR', message: error.message } });
  }
};

export const getGitHubRepositories = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    if (!userId || !orgId) return res.status(401).json({ message: 'Unauthorized' });

    const token = await getValidGitHubTokenForUser(userId, orgId);
    if (!token) {
      return res.status(400).json({
        success: false,
        error: { code: 'GITHUB_NOT_CONNECTED', message: 'GitHub account is not connected. Connect in Integrations.' },
      });
    }

    const repos = await fetchFromGitHubApi('/user/repos?sort=updated&per_page=50', token);

    const formattedRepos = (Array.isArray(repos) ? repos : []).map((r: any) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      owner: r.owner?.login,
      url: r.html_url,
      defaultBranch: r.default_branch || 'main',
      isPrivate: r.private,
      updatedAt: r.updated_at,
    }));

    return res.json(formattedRepos);
  } catch (error: any) {
    return res.status(error.status || 500).json({
      success: false,
      error: { code: 'GITHUB_API_ERROR', message: error.message },
    });
  }
};

export const getGitHubBranches = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    const { owner, repo } = req.params;

    if (!userId || !orgId) return res.status(401).json({ message: 'Unauthorized' });

    const token = await getValidGitHubTokenForUser(userId, orgId);
    if (!token) {
      return res.status(400).json({
        success: false,
        error: { code: 'GITHUB_NOT_CONNECTED', message: 'GitHub account is not connected.' },
      });
    }

    const branches = await fetchFromGitHubApi(`/repos/${owner}/${repo}/branches?per_page=100`, token);

    const formattedBranches = (Array.isArray(branches) ? branches : []).map((b: any) => ({
      name: b.name,
      commitSha: b.commit?.sha,
      protected: b.protected,
    }));

    return res.json(formattedBranches);
  } catch (error: any) {
    return res.status(error.status || 500).json({
      success: false,
      error: { code: 'GITHUB_API_ERROR', message: error.message },
    });
  }
};

export const getGitHubCommits = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    const { owner, repo } = req.params;
    const { branch, sha } = req.query;

    if (!userId || !orgId) return res.status(401).json({ message: 'Unauthorized' });

    const token = await getValidGitHubTokenForUser(userId, orgId);
    if (!token) {
      return res.status(400).json({
        success: false,
        error: { code: 'GITHUB_NOT_CONNECTED', message: 'GitHub account is not connected.' },
      });
    }

    const ref = sha || branch || '';
    const query = ref ? `?sha=${encodeURIComponent(String(ref))}&per_page=30` : '?per_page=30';
    const commits = await fetchFromGitHubApi(`/repos/${owner}/${repo}/commits${query}`, token);

    const formattedCommits = (Array.isArray(commits) ? commits : []).map((c: any) => ({
      sha: c.sha,
      shortSha: c.sha ? c.sha.substring(0, 7) : '',
      message: c.commit?.message || '',
      author: c.commit?.author?.name || c.author?.login || 'Developer',
      timestamp: c.commit?.author?.date || c.commit?.committer?.date,
      url: c.html_url,
    }));

    return res.json(formattedCommits);
  } catch (error: any) {
    return res.status(error.status || 500).json({
      success: false,
      error: { code: 'GITHUB_API_ERROR', message: error.message },
    });
  }
};

export const getGitHubPullRequests = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    const { owner, repo } = req.params;
    const { state = 'all' } = req.query;

    if (!userId || !orgId) return res.status(401).json({ message: 'Unauthorized' });

    const token = await getValidGitHubTokenForUser(userId, orgId);
    if (!token) {
      return res.status(400).json({
        success: false,
        error: { code: 'GITHUB_NOT_CONNECTED', message: 'GitHub account is not connected.' },
      });
    }

    const pulls = await fetchFromGitHubApi(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=50`, token);

    const formattedPulls = (Array.isArray(pulls) ? pulls : []).map((p: any) => ({
      number: p.number,
      title: p.title,
      author: p.user?.login || 'unknown',
      state: p.merged_at ? 'MERGED' : p.state.toUpperCase(),
      draft: p.draft,
      headBranch: p.head?.ref,
      baseBranch: p.base?.ref,
      url: p.html_url,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      mergedAt: p.merged_at,
    }));

    return res.json(formattedPulls);
  } catch (error: any) {
    return res.status(error.status || 500).json({
      success: false,
      error: { code: 'GITHUB_API_ERROR', message: error.message },
    });
  }
};

export const getGitHubPullRequestReviews = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    const { owner, repo, pullNumber } = req.params;

    if (!userId || !orgId) return res.status(401).json({ message: 'Unauthorized' });

    const token = await getValidGitHubTokenForUser(userId, orgId);
    if (!token) {
      return res.status(400).json({ error: 'GitHub not connected' });
    }

    const reviews = await fetchFromGitHubApi(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, token);

    const formatted = (Array.isArray(reviews) ? reviews : []).map((r: any) => ({
      id: r.id,
      user: r.user?.login,
      state: r.state,
      submittedAt: r.submitted_at,
    }));

    return res.json(formatted);
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

export const getGitHubCommitCheckRuns = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    const { owner, repo, ref } = req.params;

    if (!userId || !orgId) return res.status(401).json({ message: 'Unauthorized' });

    const token = await getValidGitHubTokenForUser(userId, orgId);
    if (!token) {
      return res.status(400).json({ error: 'GitHub not connected' });
    }

    const checkData = await fetchFromGitHubApi(`/repos/${owner}/${repo}/commits/${ref}/check-runs`, token);

    const checkRuns = (checkData?.check_runs || []).map((cr: any) => ({
      id: cr.id,
      name: cr.name,
      status: cr.status,
      conclusion: cr.conclusion,
      startedAt: cr.started_at,
      completedAt: cr.completed_at,
      htmlUrl: cr.html_url,
    }));

    return res.json({
      totalCount: checkData?.total_count || 0,
      checkRuns,
    });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

export const createGitHubBranch = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    const { owner, repo } = req.params;
    const { branchName, baseBranch = 'main' } = req.body;

    if (!userId || !orgId) return res.status(401).json({ message: 'Unauthorized' });
    if (!branchName) return res.status(400).json({ message: 'branchName is required' });

    const token = await getValidGitHubTokenForUser(userId, orgId);
    if (!token) {
      return res.status(400).json({
        success: false,
        error: { code: 'GITHUB_NOT_CONNECTED', message: 'GitHub account is not connected.' },
      });
    }

    const baseRef = await fetchFromGitHubApi(`/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`, token);
    const sha = baseRef.object.sha;

    const createdRef = await fetchFromGitHubApi(`/repos/${owner}/${repo}/git/refs`, token, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha,
      }),
    });

    return res.status(201).json({
      success: true,
      ref: createdRef.ref,
      branchName,
      sha,
    });
  } catch (error: any) {
    return res.status(error.status || 500).json({
      success: false,
      error: { code: 'GITHUB_BRANCH_CREATION_FAILED', message: error.message },
    });
  }
};

export const debugTestGitHubUserToken = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    if (!userId || !orgId) return res.status(401).json({ message: 'Unauthorized' });

    const connection = await prisma.gitHubConnection.findFirst({
      where: { userId, organizationId: orgId },
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection || !connection.accessTokenEncrypted) {
      return res.status(400).json({
        status: 'NO_TOKEN',
        hasAccessToken: false,
        tokenPrefix: 'none',
        message: 'No GitHub user access token exists in DB for this user.',
      });
    }

    const token = decryptToken(connection.accessTokenEncrypted);
    const tokenPrefix = token ? token.substring(0, 4) : 'none';

    try {
      const githubUser = await fetchFromGitHubApi('/user', token);
      return res.json({
        status: 'SUCCESS',
        httpStatus: 200,
        hasAccessToken: true,
        tokenPrefix,
        githubUserId: githubUser.id,
        githubLogin: githubUser.login,
      });
    } catch (apiErr: any) {
      return res.status(apiErr.status || 400).json({
        status: 'ERROR',
        httpStatus: apiErr.status || 400,
        hasAccessToken: true,
        tokenPrefix,
        message: apiErr.message,
        rateLimitRemaining: apiErr.rateLimitRemaining || 'N/A',
        rateLimitReset: apiErr.rateLimitReset || 'N/A',
        rawResponseBody: apiErr.rawResponseBody ? apiErr.rawResponseBody.substring(0, 300) : null,
      });
    }
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// ==========================================
// WORK ITEM ↔ GITHUB ENGINEERING WORKFLOW
// ==========================================

export const createWorkItemBranch = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    const { workItemId } = req.params;
    const { repositoryFullName, baseBranch = 'main', customBranchName } = req.body;

    if (!userId || !orgId) return res.status(401).json({ message: 'Unauthorized' });
    if (!repositoryFullName) return res.status(400).json({ message: 'repositoryFullName is required (e.g. owner/repo)' });

    const workItem = await prisma.workItem.findFirst({
      where: { id: workItemId, project: { organizationId: orgId } },
      include: { project: true },
    });

    if (!workItem) {
      return res.status(404).json({ message: 'Work item not found or unauthorized' });
    }

    const token = await getValidGitHubTokenForUser(userId, orgId);
    if (!token) {
      return res.status(400).json({
        success: false,
        error: { code: 'GITHUB_NOT_CONNECTED', message: 'GitHub account is not connected.' },
      });
    }

    const [owner, repo] = repositoryFullName.split('/');
    if (!owner || !repo) {
      return res.status(400).json({ message: 'Invalid repository format. Expected "owner/repo"' });
    }

    const branchName = customBranchName
      ? sanitizeBranchName(customBranchName)
      : generateBranchName(workItem.project.branchNamingPattern, workItem.type, workItem.humanId, workItem.title);

    if (!branchName) {
      return res.status(400).json({ message: 'Invalid branch name generated' });
    }

    const baseRef = await fetchFromGitHubApi(`/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`, token);
    const sha = baseRef.object.sha;

    const createdRef = await fetchFromGitHubApi(`/repos/${owner}/${repo}/git/refs`, token, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha,
      }),
    });

    const repoUrl = `https://github.com/${repositoryFullName}`;
    const branchUrl = `https://github.com/${repositoryFullName}/tree/${branchName}`;

    const link = await prisma.workItemGitHubLink.create({
      data: {
        organizationId: orgId,
        workItemId: workItem.id,
        repositoryFullName,
        repositoryUrl: repoUrl,
        branchName,
        commitSha: sha,
        relationshipType: 'BRANCH',
        createdById: userId,
      },
    });

    await prisma.workItemComment.create({
      data: {
        workItemId: workItem.id,
        authorId: userId,
        content: `🌿 Created GitHub branch [${branchName}](${branchUrl}) from \`${baseBranch}\` in [${repositoryFullName}](${repoUrl})`,
      },
    });

    return res.status(201).json({
      success: true,
      branchName,
      repository: repositoryFullName,
      branchUrl,
      baseSha: sha,
      ref: createdRef.ref,
      link,
    });
  } catch (error: any) {
    return res.status(error.status || 500).json({
      success: false,
      error: { code: 'BRANCH_CREATION_FAILED', message: error.message },
    });
  }
};

export const createWorkItemPullRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    const { workItemId } = req.params;
    const { repositoryFullName, headBranch, baseBranch = 'main', title, description, draft = false } = req.body;

    if (!userId || !orgId) return res.status(401).json({ message: 'Unauthorized' });
    if (!repositoryFullName || !headBranch) {
      return res.status(400).json({ message: 'repositoryFullName and headBranch are required' });
    }

    const workItem = await prisma.workItem.findFirst({
      where: { id: workItemId, project: { organizationId: orgId } },
      include: { project: true },
    });

    if (!workItem) {
      return res.status(404).json({ message: 'Work item not found or unauthorized' });
    }

    const token = await getValidGitHubTokenForUser(userId, orgId);
    if (!token) {
      return res.status(400).json({
        success: false,
        error: { code: 'GITHUB_NOT_CONNECTED', message: 'GitHub account is not connected.' },
      });
    }

    const [owner, repo] = repositoryFullName.split('/');
    if (!owner || !repo) {
      return res.status(400).json({ message: 'Invalid repository format. Expected "owner/repo"' });
    }

    const finalTitle = title ? title.trim() : `[${workItem.humanId}] ${workItem.title}`;
    const finalDescription = description
      ? description.trim()
      : `### Work Item: [${workItem.humanId}] - ${workItem.title}\n\n` +
        `**Type**: ${workItem.type}\n` +
        `**Priority**: ${workItem.priority}\n\n` +
        `#### Summary:\n${workItem.description || 'No description provided.'}\n\n` +
        `---\n*Created via Antigravity Engineering Workflow*`;

    const createdPR = await fetchFromGitHubApi(`/repos/${owner}/${repo}/pulls`, token, {
      method: 'POST',
      body: JSON.stringify({
        title: finalTitle,
        head: headBranch,
        base: baseBranch,
        body: finalDescription,
        draft: Boolean(draft),
      }),
    });

    const repoUrl = `https://github.com/${repositoryFullName}`;
    const prUrl = createdPR.html_url;

    const link = await prisma.workItemGitHubLink.create({
      data: {
        organizationId: orgId,
        workItemId: workItem.id,
        repositoryFullName,
        repositoryUrl: repoUrl,
        branchName: headBranch,
        pullRequestNumber: createdPR.number,
        pullRequestTitle: createdPR.title,
        pullRequestUrl: prUrl,
        relationshipType: 'PULL_REQUEST',
        createdById: userId,
      },
    });

    let repoRecord = await prisma.repository.findFirst({
      where: { fullName: repositoryFullName },
    });
    if (repoRecord) {
      await prisma.pullRequest.upsert({
        where: { id: `pr-${repoRecord.id}-${createdPR.number}` },
        update: {
          title: createdPR.title,
          status: 'OPEN',
          reviewStatus: 'PENDING',
          workItemId: workItem.id,
        },
        create: {
          id: `pr-${repoRecord.id}-${createdPR.number}`,
          repositoryId: repoRecord.id,
          workItemId: workItem.id,
          number: createdPR.number,
          title: createdPR.title,
          author: createdPR.user?.login || 'unknown',
          status: 'OPEN',
          reviewStatus: 'PENDING',
          headBranch,
          baseBranch,
          url: prUrl,
        },
      });
    }

    if (workItem.status === 'TO_DO' || workItem.status === 'IN_PROGRESS') {
      await prisma.workItem.update({
        where: { id: workItem.id },
        data: { status: 'CODE_REVIEW' },
      });
      await prisma.workItemStatusHistory.create({
        data: {
          workItemId: workItem.id,
          oldStatus: workItem.status,
          newStatus: 'CODE_REVIEW',
          changedById: userId,
        },
      });
    }

    await prisma.workItemComment.create({
      data: {
        workItemId: workItem.id,
        authorId: userId,
        content: `🚀 Opened GitHub Pull Request [#${createdPR.number} ${createdPR.title}](${prUrl}) for \`${headBranch}\` → \`${baseBranch}\``,
      },
    });

    return res.status(201).json({
      success: true,
      pullRequest: {
        number: createdPR.number,
        title: createdPR.title,
        url: prUrl,
        state: createdPR.state,
        draft: createdPR.draft,
      },
      link,
    });
  } catch (error: any) {
    return res.status(error.status || 500).json({
      success: false,
      error: { code: 'PR_CREATION_FAILED', message: error.message },
    });
  }
};

export const getWorkItemDevelopmentSummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    const { workItemId } = req.params;

    if (!userId || !orgId) return res.status(401).json({ message: 'Unauthorized' });

    const workItem = await prisma.workItem.findFirst({
      where: { id: workItemId, project: { organizationId: orgId } },
      include: {
        githubLinks: {
          orderBy: { createdAt: 'desc' },
        },
        pullRequests: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!workItem) {
      return res.status(404).json({ message: 'Work item not found' });
    }

    const token = await getValidGitHubTokenForUser(userId, orgId);

    const branchLinks = workItem.githubLinks.filter((l) => l.relationshipType === 'BRANCH' || (l.branchName && !l.pullRequestNumber));
    const prLinks = workItem.githubLinks.filter((l) => l.relationshipType === 'PULL_REQUEST' || l.pullRequestNumber);
    const commitLinks = workItem.githubLinks.filter((l) => l.relationshipType === 'COMMIT' || l.commitSha);

    const repoFullName = workItem.githubLinks[0]?.repositoryFullName || null;

    // Fetch live PR details, reviews, and check-runs sequentially
    const livePRs: any[] = [];
    if (token && prLinks.length > 0) {
      for (const pr of prLinks) {
        if (!pr.repositoryFullName || !pr.pullRequestNumber) continue;
        const [owner, repo] = pr.repositoryFullName.split('/');
        if (!owner || !repo) continue;

        try {
          const ghPr = await fetchFromGitHubApi(`/repos/${owner}/${repo}/pulls/${pr.pullRequestNumber}`, token).catch(() => null);
          if (ghPr) {
            const reviews = await fetchFromGitHubApi(`/repos/${owner}/${repo}/pulls/${pr.pullRequestNumber}/reviews`, token).catch(() => []);
            let checkData: any = null;
            if (ghPr.head?.sha) {
              checkData = await fetchFromGitHubApi(`/repos/${owner}/${repo}/commits/${ghPr.head.sha}/check-runs`, token).catch(() => null);
            }

            const checks = (checkData?.check_runs || []).map((cr: any) => ({
              id: cr.id,
              name: cr.name,
              status: cr.status,
              conclusion: cr.conclusion,
            }));

            const checkSummary =
              checks.length === 0
                ? 'NONE'
                : checks.some((c: any) => c.conclusion === 'failure')
                ? 'FAILURE'
                : checks.every((c: any) => c.conclusion === 'success')
                ? 'SUCCESS'
                : 'PENDING';

            const reviewStates = (reviews || []).map((r: any) => r.state);
            const reviewState = reviewStates.includes('CHANGES_REQUESTED')
              ? 'CHANGES_REQUESTED'
              : reviewStates.includes('APPROVED')
              ? 'APPROVED'
              : 'PENDING';

            livePRs.push({
              id: pr.id,
              prNumber: ghPr.number,
              title: ghPr.title,
              status: ghPr.merged_at ? 'MERGED' : ghPr.state === 'closed' ? 'CLOSED' : 'OPEN',
              draft: ghPr.draft,
              author: ghPr.user?.login,
              url: ghPr.html_url,
              headBranch: ghPr.head?.ref,
              baseBranch: ghPr.base?.ref,
              headSha: ghPr.head?.sha,
              repositoryName: repo,
              repositoryFullName: pr.repositoryFullName,
              reviewState,
              ciStatus: checkSummary,
              reviews: (reviews || []).map((r: any) => ({
                user: r.user?.login,
                state: r.state,
              })),
              checks,
            });
          }
        } catch (prErr) {
          console.warn('Failed to fetch live PR detail:', prErr);
        }
      }
    }

    return res.json({
      repositoryFullName: repoFullName,
      branches: branchLinks.map((b) => ({
        id: b.id,
        branchName: b.branchName,
        repositoryName: b.repositoryFullName?.split('/')[1] || b.repositoryFullName,
        repositoryFullName: b.repositoryFullName,
        url: b.repositoryUrl ? `${b.repositoryUrl}/tree/${b.branchName}` : null,
        createdAt: b.createdAt,
      })),
      pullRequests:
        livePRs.length > 0
          ? livePRs
          : prLinks.map((p) => ({
              id: p.id,
              prNumber: p.pullRequestNumber,
              title: p.pullRequestTitle,
              status: 'OPEN',
              repositoryName: p.repositoryFullName?.split('/')[1] || p.repositoryFullName,
              repositoryFullName: p.repositoryFullName,
              url: p.pullRequestUrl,
              reviewState: 'PENDING',
              ciStatus: 'NONE',
            })),
      commits: commitLinks.map((c) => ({
        id: c.id,
        commitSha: c.commitSha,
        title: c.commitMessage,
        authorName: null,
        url: c.repositoryUrl && c.commitSha ? `${c.repositoryUrl}/commit/${c.commitSha}` : null,
        createdAt: c.createdAt,
      })),
      hasGitHubConnected: !!token,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getProjectDevelopmentView = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    const { projectId } = req.params;

    if (!userId || !orgId) return res.status(401).json({ message: 'Unauthorized' });

    const project = await prisma.project.findFirst({
      where: {
        OR: [{ id: projectId }, { key: projectId }],
        organizationId: orgId,
      },
      include: {
        repositories: true,
        workItems: {
          select: {
            id: true,
            humanId: true,
            title: true,
            status: true,
            type: true,
            githubLinks: true,
            pullRequests: true,
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const allLinks = project.workItems.flatMap((w) =>
      w.githubLinks.map((l) => ({ ...l, workItemHumanId: w.humanId, workItemTitle: w.title }))
    );

    const allPRs = project.workItems.flatMap((w) =>
      w.pullRequests.map((p) => ({ ...p, workItemHumanId: w.humanId, workItemTitle: w.title }))
    );

    const repoNames = Array.from(
      new Set([
        ...project.repositories.map((r) => r.fullName),
        ...allLinks.map((l) => l.repositoryFullName).filter(Boolean),
      ])
    );

    return res.json({
      projectKey: project.key,
      projectName: project.name,
      repositories: repoNames,
      branches: allLinks.filter((l) => l.relationshipType === 'BRANCH'),
      pullRequests: allPRs,
      totalLinkedItems: project.workItems.filter((w) => w.githubLinks.length > 0).length,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getGitHubConnectionHealth = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    if (!userId || !orgId) return res.status(401).json({ message: 'Unauthorized' });

    const connection = await prisma.gitHubConnection.findFirst({
      where: { userId, organizationId: orgId },
      orderBy: { updatedAt: 'desc' },
    });

    const integration = await prisma.integration.findFirst({
      where: { organizationId: orgId, provider: 'GITHUB' },
    });

    const lastLog = await prisma.integrationEventLog.findFirst({
      where: { provider: 'GITHUB' },
      orderBy: { createdAt: 'desc' },
    });

    if (!connection) {
      return res.json({
        connected: false,
        status: 'DISCONNECTED',
        apiHealth: 'UNAVAILABLE',
        account: null,
        repositoriesCount: 0,
        lastSuccessfulApi: null,
        webhookConfigured: false,
        lastWebhookAt: lastLog?.createdAt || null,
      });
    }

    try {
      const token = decryptToken(connection.accessTokenEncrypted);
      const user = await fetchFromGitHubApi('/user', token);

      return res.json({
        connected: true,
        status: 'CONNECTED',
        apiHealth: 'HEALTHY',
        account: user.login,
        avatarUrl: user.avatar_url,
        repositoriesCount: user.public_repos + (user.total_private_repos || 0),
        lastSuccessfulApi: new Date(),
        webhookConfigured: Boolean(integration?.webhookSecret),
        lastWebhookAt: lastLog?.createdAt || null,
      });
    } catch (apiErr: any) {
      return res.json({
        connected: false,
        status: 'ERROR',
        apiHealth: 'DEGRADED',
        account: connection.githubLogin,
        error: apiErr.message,
        repositoriesCount: 0,
        lastSuccessfulApi: connection.lastValidatedAt,
        webhookConfigured: Boolean(integration?.webhookSecret),
        lastWebhookAt: lastLog?.createdAt || null,
      });
    }
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
