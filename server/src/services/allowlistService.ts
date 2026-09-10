import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma.js';
import { createAndPushNotification } from './notificationService.js';

export interface SecurityAlertPayload {
  eventType: string;
  provider: string; // GOOGLE, GITHUB
  email?: string;
  externalIdentityId?: string;
  ip?: string;
  userAgent?: string;
  details?: Record<string, any>;
  status?: string;
}

/**
 * Normalizes email address by trimming whitespace and converting to lowercase.
 */
export const normalizeEmail = (email: string): string => {
  if (!email) return '';
  return email.trim().toLowerCase();
};

/**
 * Validates Google account against OrganizationAuthAllowlist.
 * Returns { allowed: boolean, entry?: any, reason?: string, user?: any }
 */
export const checkGoogleAllowlist = async (orgId: string, email: string) => {
  const normEmail = normalizeEmail(email);

  const entry = await (prisma as any).organizationAuthAllowlist.findFirst({
    where: {
      organizationId: orgId,
      provider: 'GOOGLE',
      normalizedEmail: normEmail,
    },
    include: {
      user: true,
    },
  });

  if (!entry) {
    return {
      allowed: false,
      reason: 'NOT_IN_ALLOWLIST',
      entry: null,
      user: null,
    };
  }

  if (entry.status === 'SUSPENDED') {
    return {
      allowed: false,
      reason: 'SUSPENDED',
      entry,
      user: entry.user,
    };
  }

  if (entry.status === 'REVOKED') {
    return {
      allowed: false,
      reason: 'REVOKED',
      entry,
      user: entry.user,
    };
  }

  if (entry.status !== 'ACTIVE') {
    return {
      allowed: false,
      reason: 'INACTIVE',
      entry,
      user: entry.user,
    };
  }

  // If entry has a linked user, verify that user is active
  let targetUser = entry.user;
  if (!targetUser) {
    // If not explicitly mapped yet, try finding active user in the organization with this email
    targetUser = await prisma.user.findFirst({
      where: {
        organizationId: orgId,
        email: normEmail,
        isActive: true,
      },
    });
  }

  return {
    allowed: true,
    reason: 'APPROVED',
    entry,
    user: targetUser,
  };
};

/**
 * Validates GitHub account against OrganizationAuthAllowlist using immutable githubUserId or email.
 */
export const checkGitHubAllowlist = async (
  orgId: string,
  githubUserId: string,
  email?: string
) => {
  const normEmail = email ? normalizeEmail(email) : '';

  // Look for match by immutable externalIdentityId first, then by normalized email
  let entry = await (prisma as any).organizationAuthAllowlist.findFirst({
    where: {
      organizationId: orgId,
      provider: 'GITHUB',
      OR: [
        { externalIdentityId: String(githubUserId) },
        ...(normEmail ? [{ normalizedEmail: normEmail }] : []),
      ],
    },
    include: {
      user: true,
    },
  });

  if (!entry) {
    return {
      allowed: false,
      reason: 'NOT_IN_ALLOWLIST',
      entry: null,
      user: null,
    };
  }

  if (entry.status === 'SUSPENDED') {
    return {
      allowed: false,
      reason: 'SUSPENDED',
      entry,
      user: entry.user,
    };
  }

  if (entry.status === 'REVOKED') {
    return {
      allowed: false,
      reason: 'REVOKED',
      entry,
      user: entry.user,
    };
  }

  if (entry.status !== 'ACTIVE') {
    return {
      allowed: false,
      reason: 'INACTIVE',
      entry,
      user: entry.user,
    };
  }

  let targetUser = entry.user;
  if (!targetUser && normEmail) {
    targetUser = await prisma.user.findFirst({
      where: {
        organizationId: orgId,
        email: normEmail,
        isActive: true,
      },
    });
  }

  return {
    allowed: true,
    reason: 'APPROVED',
    entry,
    user: targetUser,
  };
};

/**
 * Logs a security event into the database and immediately alerts all Organization Admins (in-app notifications).
 */
export const logSecurityEventAndAlertAdmin = async (
  orgId: string,
  payload: SecurityAlertPayload,
  io?: any
) => {
  try {
    const {
      eventType,
      provider,
      email,
      ip,
      userAgent,
      details,
      status = 'BLOCKED',
    } = payload;

    // 1. Record SecurityEvent
    const secEvent = await (prisma as any).securityEvent.create({
      data: {
        organizationId: orgId,
        eventType,
        provider: provider.toUpperCase(),
        email: email ? normalizeEmail(email) : null,
        ip: ip || null,
        userAgent: userAgent || null,
        details: details ? JSON.stringify(details) : null,
        status,
      },
    });

    // 2. Find Organization Admins & Owners (specifically Sai Kiran / saikirankurapti@gmail.com)
    const admins = await prisma.user.findMany({
      where: {
        organizationId: orgId,
        role: { in: ['ADMIN', 'OWNER'] },
        isActive: true,
      },
    });

    const defaultActorId = admins[0]?.id;
    if (defaultActorId) {
      try {
        await prisma.auditLog.create({
          data: {
            organizationId: orgId,
            actorId: defaultActorId,
            action: `SECURITY_${eventType}`,
            entityType: 'AUTHENTICATION',
            entityId: secEvent.id,
            details: JSON.stringify({
              provider,
              email,
              status,
              ip,
              timestamp: new Date().toISOString(),
            }),
          },
        });
      } catch (auditErr) {
        // Continue if optional audit log write fails
      }
    }

    const formattedTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const alertTitle = `Unauthorized Login Attempt [${provider}]`;
    const alertBody = `${provider} account ${email || 'unknown'} attempted login at ${formattedTime}. Attempt was BLOCKED by Closed Team Allowlist policy.`;

    // 4. Send high-priority alert notification to admins
    for (const admin of admins) {
      await createAndPushNotification({
        userId: admin.id,
        type: 'STATUS_CHANGE', // Supported notification type
        title: alertTitle,
        body: alertBody,
        link: '/settings/security',
        io,
      });
    }

    console.warn(`[SECURITY ALERT] ${eventType}: Provider=${provider}, Email=${email}, IP=${ip}`);
    return secEvent;
  } catch (error) {
    console.error('[AllowlistService] Error logging security event:', error);
    return null;
  }
};

export interface CreateAccessRequestOptions {
  name?: string;
  displayName?: string;
  givenName?: string;
  familyName?: string;
  profileImageUrl?: string;
  externalIdentityId?: string;
  ip?: string;
  userAgent?: string;
  io?: any;
}

/**
 * Creates an access request when an unauthorized user requests access.
 * Deduplicates against existing PENDING requests by org+provider+email/externalIdentityId.
 * On duplicate attempts: updates lastSeenAt and increments attemptCount.
 * Throttles admin notifications to avoid notification spam.
 */
export const createAccessRequest = async (
  orgId: string,
  provider: string,
  email: string,
  optionsOrName?: string | CreateAccessRequestOptions,
  legacyIp?: string,
  legacyUserAgent?: string,
  legacyIo?: any
) => {
  const normEmail = normalizeEmail(email);
  const provUpper = provider.toUpperCase();

  let options: CreateAccessRequestOptions = {};
  if (typeof optionsOrName === 'string') {
    options = {
      name: optionsOrName,
      displayName: optionsOrName,
      ip: legacyIp,
      userAgent: legacyUserAgent,
      io: legacyIo,
    };
  } else if (optionsOrName && typeof optionsOrName === 'object') {
    options = optionsOrName;
  }

  const {
    name,
    displayName,
    givenName,
    familyName,
    profileImageUrl,
    externalIdentityId,
    ip,
    userAgent,
    io,
  } = options;

  // Deduplicate: if a PENDING request already exists, update lastSeenAt & attemptCount and return it
  const existing = await (prisma as any).authAccessRequest.findFirst({
    where: {
      organizationId: orgId,
      provider: provUpper,
      OR: [
        { email: normEmail },
        { normalizedEmail: normEmail },
        ...(externalIdentityId ? [{ externalIdentityId }] : []),
      ],
      status: 'PENDING',
    },
  });

  if (existing) {
    const updated = await (prisma as any).authAccessRequest.update({
      where: { id: existing.id },
      data: {
        lastSeenAt: new Date(),
        attemptCount: (existing.attemptCount || 1) + 1,
        ip: ip || existing.ip,
        userAgent: userAgent || existing.userAgent,
        ...(externalIdentityId && !existing.externalIdentityId ? { externalIdentityId } : {}),
        ...(displayName && !existing.displayName ? { displayName } : {}),
        ...(givenName && !existing.givenName ? { givenName } : {}),
        ...(familyName && !existing.familyName ? { familyName } : {}),
        ...(profileImageUrl && !existing.profileImageUrl ? { profileImageUrl } : {}),
      },
    });

    console.log(
      `[AllowlistService] Repeated access request attempt for ${normEmail} (id=${existing.id}, count=${updated.attemptCount}) - notification throttled.`
    );
    return updated;
  }

  const effectiveDisplayName = displayName || name || (givenName ? `${givenName} ${familyName || ''}`.trim() : null) || email;

  const reqRecord = await (prisma as any).authAccessRequest.create({
    data: {
      organizationId: orgId,
      provider: provUpper,
      email: normEmail,
      normalizedEmail: normEmail,
      externalIdentityId: externalIdentityId || null,
      name: name || effectiveDisplayName,
      displayName: effectiveDisplayName,
      givenName: givenName || null,
      familyName: familyName || null,
      profileImageUrl: profileImageUrl || null,
      status: 'PENDING',
      attemptCount: 1,
      lastSeenAt: new Date(),
      ip: ip || null,
      userAgent: userAgent || null,
    },
  });

  console.log(`[AllowlistService] AccessRequest CREATED id=${reqRecord.id} provider=${provider} email=${normEmail}`);

  // Alert all organization admins
  const admins = await prisma.user.findMany({
    where: {
      organizationId: orgId,
      role: { in: ['ADMIN', 'OWNER'] },
      isActive: true,
    },
  });

  const providerLabel = provUpper === 'GOOGLE' ? 'Google' : provUpper === 'GITHUB' ? 'GitHub' : provider;

  for (const admin of admins) {
    try {
      await createAndPushNotification({
        userId: admin.id,
        type: 'STATUS_CHANGE',
        title: `New Access Request — ${providerLabel}`,
        body: `${effectiveDisplayName} (${normEmail}) has requested access to the organization via ${providerLabel}. Review in Settings → Security → Access Requests.`,
        link: '/settings/security',
        io,
      });
    } catch (notifErr: any) {
      console.warn(`[AllowlistService] Non-blocking notification error for admin ${admin.id}:`, notifErr?.message);
    }
  }

  return reqRecord;
};

/**
 * Phase 49: Ensures that an active allowlisted account has a corresponding User and Team Member profile.
 * If missing:
 * 1. Finds existing user by email or creates a new User with role 'TEAM_MEMBER'.
 * 2. Connects or ensures membership in the organization's default/primary Team and Project.
 * 3. Links the allowlist entry to the user.
 * Returns the resolved and active User.
 */
export const ensureTeamMemberForAllowlistEntry = async (
  allowlistEntryId: string,
  googleProfile?: {
    name?: string;
    email: string;
    picture?: string;
    given_name?: string;
    family_name?: string;
  }
) => {
  const allowlistEntry = await (prisma as any).organizationAuthAllowlist.findUnique({
    where: { id: allowlistEntryId },
    include: { user: { include: { organization: true } } },
  });

  if (!allowlistEntry) {
    throw new Error('Allowlist entry not found');
  }

  const orgId = allowlistEntry.organizationId;
  const normEmail = normalizeEmail(allowlistEntry.email || googleProfile?.email || '');

  let user = allowlistEntry.user;

  // If allowlist entry is not linked to a user, check if a user already exists with this email in the organization
  if (!user) {
    user = await prisma.user.findFirst({
      where: {
        organizationId: orgId,
        email: normEmail,
        isActive: true,
      },
      include: { organization: true },
    });
  }

  // If user still does not exist, automatically create a Team Member profile
  if (!user) {
    const rawPassword = crypto.randomBytes(16).toString('hex');
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const resolvedName =
      googleProfile?.name ||
      allowlistEntry.displayName ||
      (googleProfile?.given_name ? `${googleProfile.given_name} ${googleProfile.family_name || ''}`.trim() : null) ||
      normEmail.split('@')[0];

    user = await prisma.user.create({
      data: {
        organizationId: orgId,
        email: normEmail,
        fullName: resolvedName,
        passwordHash,
        avatarUrl: googleProfile?.picture || null,
        role: 'TEAM_MEMBER',
        jobTitle: 'Team Member',
        status: 'ONLINE',
        isActive: true,
      },
      include: { organization: true },
    });

    console.log(`[AllowlistService] Auto-created Team Member User for authorized email ${normEmail} (id=${user.id}, role=${user.role})`);
  }

  // Always link allowlist entry to this User if not yet linked
  if (allowlistEntry.userId !== user.id) {
    await (prisma as any).organizationAuthAllowlist.update({
      where: { id: allowlistEntry.id },
      data: { userId: user.id },
    });
  }

  // Ensure user is enrolled in at least one default Team in this organization
  try {
    const defaultTeam = await prisma.team.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
    });

    if (defaultTeam) {
      const existingTeamMember = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: defaultTeam.id,
            userId: user.id,
          },
        },
      });

      if (!existingTeamMember) {
        await prisma.teamMember.create({
          data: {
            teamId: defaultTeam.id,
            userId: user.id,
            role: 'MEMBER',
          },
        });
        console.log(`[AllowlistService] Added user ${user.id} to Team ${defaultTeam.name}`);
      }
    }

    // Ensure user is enrolled in default Project
    const defaultProject = await prisma.project.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
    });

    if (defaultProject) {
      const existingProjMember = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: defaultProject.id,
            userId: user.id,
          },
        },
      });

      if (!existingProjMember) {
        await prisma.projectMember.create({
          data: {
            projectId: defaultProject.id,
            userId: user.id,
          },
        });
        console.log(`[AllowlistService] Added user ${user.id} to Project ${defaultProject.name}`);
      }
    }
  } catch (membershipErr: any) {
    console.warn('[AllowlistService] Non-blocking membership enrollment warning:', membershipErr?.message);
  }

  return user;
};
