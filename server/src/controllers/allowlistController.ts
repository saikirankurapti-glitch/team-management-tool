import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { normalizeEmail, createAccessRequest } from '../services/allowlistService.js';

/**
 * Lists all allowlisted authentication accounts for the organization.
 */
export const getAllowlistAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const accounts = await (prisma as any).organizationAuthAllowlist.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            jobTitle: true,
            avatarUrl: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ provider: 'asc' }, { createdAt: 'desc' }],
    });

    return res.json({ success: true, accounts });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Adds an authorized account to the allowlist.
 */
export const addAllowlistAccount = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const { provider, email, userId, status = 'ACTIVE', displayName } = req.body;

    if (!provider || !email) {
      return res.status(400).json({ success: false, message: 'Provider and Email are required' });
    }

    const normEmail = normalizeEmail(email);
    const provUpper = provider.toUpperCase();

    // Check if duplicate mapping exists for this email & provider
    const existing = await (prisma as any).organizationAuthAllowlist.findFirst({
      where: {
        organizationId: orgId,
        provider: provUpper,
        normalizedEmail: normEmail,
      },
      include: { user: true },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `This ${provUpper} account (${email}) is already configured for this organization (Owner: ${
          existing.user?.fullName || 'Unmapped'
        }).`,
      });
    }

    // If userId provided, check if user exists in the organization
    let linkedUser = null;
    if (userId) {
      linkedUser = await prisma.user.findFirst({
        where: { id: userId, organizationId: orgId },
      });
      if (!linkedUser) {
        return res.status(400).json({ success: false, message: 'Selected team member not found in organization' });
      }
    }

    const newEntry = await (prisma as any).organizationAuthAllowlist.create({
      data: {
        organizationId: orgId,
        provider: provUpper,
        email,
        normalizedEmail: normEmail,
        userId: linkedUser?.id || null,
        displayName: displayName || linkedUser?.fullName || null,
        status: status || 'ACTIVE',
        createdBy: req.user?.fullName || req.user?.email || 'ADMIN',
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            jobTitle: true,
          },
        },
      },
    });

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          organization: { connect: { id: orgId } },
          actor: { connect: { id: req.user!.id } },
          action: 'ALLOWLIST_ACCOUNT_ADDED',
          entityType: 'AUTHENTICATION',
          entityId: newEntry.id,
          details: JSON.stringify({
            provider: provUpper,
            email,
            targetUser: linkedUser?.fullName,
            status,
          }),
        },
      });
    } catch (auditErr) {
      console.warn('[AllowlistController] Non-blocking auditLog error:', auditErr);
    }

    return res.json({ success: true, account: newEntry });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Updates status (ACTIVE, SUSPENDED, REVOKED) or maps team member of an allowlist entry.
 */
export const updateAllowlistAccount = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;
    const { status, userId, displayName } = req.body;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const entry = await (prisma as any).organizationAuthAllowlist.findFirst({
      where: { id, organizationId: orgId },
      include: { user: true },
    });

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Allowlist entry not found' });
    }

    const updateData: any = {};
    if (status) {
      if (!['ACTIVE', 'SUSPENDED', 'REVOKED', 'PENDING'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }
      updateData.status = status;
    }

    if (userId !== undefined) {
      if (userId === null || userId === '') {
        updateData.userId = null;
      } else {
        const targetUser = await prisma.user.findFirst({
          where: { id: userId, organizationId: orgId },
        });
        if (!targetUser) {
          return res.status(400).json({ success: false, message: 'Selected team member not found' });
        }
        updateData.userId = targetUser.id;
      }
    }

    if (displayName !== undefined) {
      updateData.displayName = displayName;
    }

    const updated = await (prisma as any).organizationAuthAllowlist.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            jobTitle: true,
          },
        },
      },
    });

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          organization: { connect: { id: orgId } },
          actor: { connect: { id: req.user!.id } },
          action: `ALLOWLIST_ACCOUNT_${status || 'UPDATED'}`,
          entityType: 'AUTHENTICATION',
          entityId: entry.id,
          details: JSON.stringify({
            email: entry.email,
            provider: entry.provider,
            oldStatus: entry.status,
            newStatus: updated.status,
            userId: updated.userId,
          }),
        },
      });
    } catch (auditErr) {
      console.warn('[AllowlistController] Non-blocking auditLog error:', auditErr);
    }

    return res.json({ success: true, account: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Removes or archives an allowlist entry.
 */
export const deleteAllowlistAccount = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;

    if (!orgId || !req.user?.id) return res.status(401).json({ message: 'Unauthorized' });

    const entry = await (prisma as any).organizationAuthAllowlist.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Allowlist entry not found' });
    }

    await (prisma as any).organizationAuthAllowlist.delete({
      where: { id },
    });

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          organization: { connect: { id: orgId } },
          actor: { connect: { id: req.user.id } },
          action: 'ALLOWLIST_ACCOUNT_DELETED',
          entityType: 'AUTHENTICATION',
          entityId: id,
          details: JSON.stringify({
            email: entry.email,
            provider: entry.provider,
          }),
        },
      });
    } catch (auditErr) {
      console.warn('[AllowlistController] Non-blocking auditLog error:', auditErr);
    }

    return res.json({ success: true, message: 'Account deleted from allowlist' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Lists access requests for the organization.
 */
export const getAccessRequests = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const requests = await (prisma as any).authAccessRequest.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, requests });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Reviews (Approve/Reject) an access request.
 */
export const reviewAccessRequest = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;
    const { decision, userId, displayName, rejectionReason } = req.body; // 'APPROVE' or 'REJECT'

    if (!orgId || !req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    if (!['APPROVE', 'REJECT'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'decision must be APPROVE or REJECT' });
    }

    const request = await (prisma as any).authAccessRequest.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Access request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `This access request has already been ${request.status.toLowerCase()}.`,
      });
    }

    let targetMember: any = null;
    if (decision === 'APPROVE') {
      const { role = 'TEAM_MEMBER', projectIds } = req.body;
      const normEmail = normalizeEmail(request.email);

      // Default role must always be TEAM_MEMBER; never allow unintended privilege escalation
      const assignedRole = role === 'ADMIN' ? 'ADMIN' : role === 'PROJECT_MANAGER' ? 'PROJECT_MANAGER' : 'TEAM_MEMBER';

      if (userId) {
        targetMember = await prisma.user.findFirst({
          where: { id: userId, organizationId: orgId, isActive: true },
        });
        if (!targetMember) {
          return res.status(400).json({
            success: false,
            message: 'Selected team member profile not found in this organization.',
          });
        }
      } else {
        // If no existing member selected, check if user exists by email or auto-provision
        targetMember = await prisma.user.findFirst({
          where: { organizationId: orgId, email: normEmail, isActive: true },
        });

        if (!targetMember) {
          const rawPassword = crypto.randomBytes(16).toString('hex');
          const passwordHash = await bcrypt.hash(rawPassword, 10);
          const fullName = displayName || request.displayName || request.name || normEmail.split('@')[0];

          targetMember = await prisma.user.create({
            data: {
              organizationId: orgId,
              email: normEmail,
              fullName,
              avatarUrl: request.profileImageUrl || null,
              passwordHash,
              role: assignedRole,
              jobTitle: assignedRole === 'ADMIN' ? 'Administrator' : 'Team Member',
              status: 'ONLINE',
              isActive: true,
            },
          });

          // Enroll in default team
          const defaultTeam = await prisma.team.findFirst({
            where: { organizationId: orgId },
            orderBy: { createdAt: 'asc' },
          });
          if (defaultTeam) {
            await prisma.teamMember.create({
              data: { teamId: defaultTeam.id, userId: targetMember.id, role: 'MEMBER' },
            }).catch(() => {});
          }
        }
      }

      // Assign requested projects if provided
      if (Array.isArray(projectIds) && targetMember) {
        for (const pid of projectIds) {
          const exists = await prisma.projectMember.findUnique({
            where: { projectId_userId: { projectId: pid, userId: targetMember.id } },
          });
          if (!exists) {
            await prisma.projectMember.create({
              data: { projectId: pid, userId: targetMember.id },
            }).catch(() => {});
          }
        }
      }

      const effectiveDisplayName = displayName || targetMember?.fullName || request.displayName || request.name || null;

      // Execute approval atomically in transaction
      await prisma.$transaction(async (tx: any) => {
        // Upsert into OrganizationAuthAllowlist
        const allowEntry = await tx.organizationAuthAllowlist.upsert({
          where: {
            organizationId_provider_normalizedEmail: {
              organizationId: orgId,
              provider: request.provider,
              normalizedEmail: normEmail,
            },
          },
          update: {
            status: 'ACTIVE',
            userId: targetMember?.id || null,
            displayName: effectiveDisplayName,
            ...(request.externalIdentityId ? { externalIdentityId: request.externalIdentityId } : {}),
          },
          create: {
            organizationId: orgId,
            provider: request.provider,
            email: request.email,
            normalizedEmail: normEmail,
            externalIdentityId: request.externalIdentityId || null,
            status: 'ACTIVE',
            userId: targetMember?.id || null,
            displayName: effectiveDisplayName,
            createdBy: req.user?.email || 'ADMIN',
          },
        });

        // Mark AccessRequest as APPROVED with mappedUserId
        await tx.authAccessRequest.update({
          where: { id },
          data: {
            status: 'APPROVED',
            mappedUserId: targetMember?.id || null,
            reviewedById: req.user?.id,
            reviewedAt: new Date(),
          },
        });

        // Create AuditLog
        await tx.auditLog.create({
          data: {
            organization: { connect: { id: orgId } },
            actor: { connect: { id: req.user?.id } },
            action: 'USER_APPROVED',
            entityType: 'AUTHENTICATION',
            entityId: allowEntry.id,
            details: JSON.stringify({
              email: request.email,
              provider: request.provider,
              externalIdentityId: request.externalIdentityId || null,
              targetUser: targetMember?.fullName || 'Unmapped',
              targetUserId: targetMember?.id || null,
              assignedRole,
              projectIds: projectIds || [],
              requestId: id,
            }),
          },
        });
      });
    } else {
      // Rejection branch in transaction
      await prisma.$transaction(async (tx: any) => {
        await tx.authAccessRequest.update({
          where: { id },
          data: {
            status: 'REJECTED',
            rejectionReason: rejectionReason || null,
            reviewedById: req.user?.id,
            reviewedAt: new Date(),
          },
        });

        await tx.auditLog.create({
          data: {
            organization: { connect: { id: orgId } },
            actor: { connect: { id: req.user?.id } },
            action: 'USER_REJECTED',
            entityType: 'AUTHENTICATION',
            entityId: id,
            details: JSON.stringify({
              email: request.email,
              provider: request.provider,
              reason: rejectionReason || null,
              requestId: id,
            }),
          },
        });
      });
    }

    return res.json({
      success: true,
      message: `Access request ${decision.toLowerCase()}d successfully`,
      targetUser: targetMember?.fullName,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Public endpoint for an unauthorized user to submit an access request.
 */
export const submitAccessRequest = async (req: any, res: Response) => {
  try {
    const { email, provider = 'GOOGLE', name } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const org = await prisma.organization.findFirst();
    if (!org) {
      return res.status(400).json({ success: false, message: 'No organization available' });
    }

    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    const reqRecord = await createAccessRequest(org.id, provider, email, name, ip, userAgent);

    return res.json({
      success: true,
      message: 'Your access request has been sent to the organization administrator.',
      requestId: reqRecord.id,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Returns security overview statistics and recent authentication events.
 */
export const getSecurityOverview = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const [
      authorizedAccountsCount,
      activeTeamMembersCount,
      pendingRequestsCount,
      blockedAttemptsCount,
      suspendedCount,
      recentEvents,
    ] = await Promise.all([
      (prisma as any).organizationAuthAllowlist.count({
        where: { organizationId: orgId, status: 'ACTIVE' },
      }),
      prisma.user.count({
        where: { organizationId: orgId, isActive: true },
      }),
      (prisma as any).authAccessRequest.count({
        where: { organizationId: orgId, status: 'PENDING' },
      }),
      (prisma as any).securityEvent.count({
        where: { organizationId: orgId, status: 'BLOCKED' },
      }),
      (prisma as any).organizationAuthAllowlist.count({
        where: { organizationId: orgId, status: 'SUSPENDED' },
      }),
      (prisma as any).securityEvent.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return res.json({
      success: true,
      stats: {
        authorizedAccounts: authorizedAccountsCount,
        activeTeamMembers: activeTeamMembersCount,
        pendingAccessRequests: pendingRequestsCount,
        blockedLoginAttempts: blockedAttemptsCount,
        suspendedAccounts: suspendedCount,
      },
      recentEvents,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
