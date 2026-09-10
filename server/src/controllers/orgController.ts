import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getOrganization = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ message: 'Organization ID missing' });

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            fullName: true,
            avatarUrl: true,
            role: true,
            status: true,
          },
        },
        teams: true,
        projects: true,
      },
    });

    if (!org) return res.status(404).json({ message: 'Organization not found' });
    return res.json(org);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getMembers = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const includeInactive = req.query.includeInactive === 'true';
    const members = await prisma.user.findMany({
      where: {
        organizationId: orgId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        jobTitle: true,
        department: true,
        role: true,
        status: true,
        isActive: true,
        createdAt: true,
        googleConnections: {
          select: {
            id: true,
            googleEmail: true,
            googleUserId: true,
            createdAt: true,
          },
        },
        authAllowlists: {
          select: {
            id: true,
            email: true,
            provider: true,
            status: true,
            externalIdentityId: true,
          },
        },
        skills: {
          select: {
            id: true,
            skillName: true,
            proficiency: true,
            yearsExperience: true,
          },
        },
        teamMemberships: { include: { team: { select: { id: true, name: true } } } },
        projectMemberships: { include: { project: { select: { id: true, name: true, key: true } } } },
        resourceAllocations: {
          select: {
            id: true,
            projectId: true,
            role: true,
            skill: true,
            allocationPercentage: true,
            allocatedHours: true,
            startDate: true,
            endDate: true,
            project: { select: { id: true, key: true, name: true } },
          },
        },
        assignedItems: {
          where: { status: { not: 'DONE' } },
          select: {
            id: true,
            humanId: true,
            title: true,
            status: true,
            priority: true,
            type: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });
    return res.json(members);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateMember = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const currentUserId = req.user?.id;
    const currentUserRole = req.user?.role;
    const { id } = req.params;
    const { fullName, jobTitle, department, role, status, avatarUrl, skills, projectIds } = req.body;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    // Validate target user belongs to org
    const targetUser = await prisma.user.findFirst({
      where: { id, organizationId: orgId },
      include: { skills: true, projectMemberships: true },
    });
    if (!targetUser) return res.status(404).json({ message: 'User not found in organization' });

    // RBAC: Only OWNER, ADMIN, or PROJECT_MANAGER can edit other users
    const isSelf = currentUserId === id;
    const isManager = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN' || currentUserRole === 'PROJECT_MANAGER';
    if (!isSelf && !isManager) {
      return res.status(403).json({ message: 'Insufficient permissions to edit this team member' });
    }

    // Role editing restricted strictly to OWNER / ADMIN
    const updateData: any = {};
    if (fullName !== undefined) updateData.fullName = fullName.trim();
    if (jobTitle !== undefined) updateData.jobTitle = jobTitle.trim();
    if (department !== undefined) updateData.department = department.trim();
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl.trim();
    if (status !== undefined) updateData.status = status;

    let roleChanged = false;
    let oldRole = targetUser.role;

    if (role !== undefined && role !== targetUser.role) {
      if (currentUserRole !== 'OWNER' && currentUserRole !== 'ADMIN') {
        return res.status(403).json({ message: 'Only an Administrator can change roles.' });
      }

      // ADMIN PROTECTION INVARIANT:
      // Prevent demoting the primary Admin (saikirankurapti@gmail.com) if they are the only Admin
      if (targetUser.role === 'ADMIN' && role !== 'ADMIN') {
        const adminCount = await prisma.user.count({
          where: { organizationId: orgId, role: 'ADMIN', isActive: true },
        });
        if (adminCount <= 1) {
          return res.status(400).json({
            message: 'Cannot demote the sole Administrator of the organization. An organization must have at least one active Administrator.',
          });
        }
      }

      // Ashwin Protection: ensure no accidental promotion without explicit deliberate intent
      updateData.role = role;
      roleChanged = true;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    // Update skills if provided
    if (Array.isArray(skills)) {
      await prisma.userSkill.deleteMany({ where: { userId: id } });
      for (const sk of skills) {
        const skillName = typeof sk === 'string' ? sk : sk.skillName;
        const proficiency = typeof sk === 'object' && sk.proficiency ? sk.proficiency : 'INTERMEDIATE';
        if (!skillName) continue;

        await prisma.skillCatalog.upsert({
          where: {
            organizationId_name: {
              organizationId: orgId,
              name: skillName.trim(),
            },
          },
          create: {
            organizationId: orgId,
            name: skillName.trim(),
            category: 'ENGINEERING',
          },
          update: {},
        });

        await prisma.userSkill.create({
          data: {
            organizationId: orgId,
            userId: id,
            skillName: skillName.trim(),
            proficiency,
          },
        });
      }
    }

    // Update project memberships if provided
    if (Array.isArray(projectIds) && (currentUserRole === 'ADMIN' || currentUserRole === 'OWNER' || currentUserRole === 'PROJECT_MANAGER')) {
      const currentProjects = targetUser.projectMemberships.map((pm: any) => pm.projectId);
      const toAdd = projectIds.filter((pid: string) => !currentProjects.includes(pid));
      const toRemove = currentProjects.filter((pid: string) => !projectIds.includes(pid));

      if (toRemove.length > 0) {
        await prisma.projectMember.deleteMany({
          where: {
            userId: id,
            projectId: { in: toRemove },
          },
        });
        for (const pid of toRemove) {
          try {
            await prisma.auditLog.create({
              data: {
                organizationId: orgId,
                actorId: currentUserId || id,
                action: 'PROJECT_ACCESS_REMOVED',
                entityType: 'ProjectMember',
                entityId: pid,
                details: JSON.stringify({ userId: id, projectId: pid }),
              },
            });
          } catch (e) {}
        }
      }

      for (const pid of toAdd) {
        await prisma.projectMember.create({
          data: {
            userId: id,
            projectId: pid,
          },
        });
        try {
          await prisma.auditLog.create({
            data: {
              organizationId: orgId,
              actorId: currentUserId || id,
              action: 'PROJECT_ACCESS_GRANTED',
              entityType: 'ProjectMember',
              entityId: pid,
              details: JSON.stringify({ userId: id, projectId: pid }),
            },
          });
        } catch (e) {}
      }
    }

    // Audit logs
    if (orgId && currentUserId) {
      try {
        if (roleChanged) {
          await prisma.auditLog.create({
            data: {
              organizationId: orgId,
              actorId: currentUserId,
              action: 'ROLE_CHANGED',
              entityType: 'User',
              entityId: id,
              details: JSON.stringify({
                targetEmail: targetUser.email,
                targetName: targetUser.fullName,
                previousState: { role: oldRole },
                newState: { role: updateData.role },
              }),
            },
          });
        }

        await prisma.auditLog.create({
          data: {
            organizationId: orgId,
            actorId: currentUserId,
            action: 'TEAM_MEMBER_UPDATED',
            entityType: 'User',
            entityId: id,
            details: JSON.stringify({
              updatedBy: currentUserId,
              changes: updateData,
            }),
          },
        });
      } catch (auditErr) {
        console.warn('[OrgController] Non-blocking auditLog error:', auditErr);
      }
    }

    // Return refreshed user
    const finalUser = await prisma.user.findUnique({
      where: { id },
      include: {
        skills: true,
        teamMemberships: { include: { team: true } },
        projectMemberships: { include: { project: true } },
      },
    });

    return res.json(finalUser);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const deactivateMember = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const currentUserId = req.user?.id;
    const currentUserRole = req.user?.role;
    const { id } = req.params;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    if (currentUserRole !== 'OWNER' && currentUserRole !== 'ADMIN') {
      return res.status(403).json({ message: 'Only OWNER and ADMIN can deactivate team members' });
    }

    if (id === currentUserId) {
      return res.status(400).json({ message: 'Cannot deactivate yourself' });
    }

    const user = await prisma.user.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!user) return res.status(404).json({ message: 'User not found in organization' });

    // ADMIN & KEY LEAD PROTECTION INVARIANT:
    // Prevent accidental deactivation of the primary Admin (saikirankurapti@gmail.com)
    if (user.role === 'ADMIN') {
      const activeAdminCount = await prisma.user.count({
        where: { organizationId: orgId, role: 'ADMIN', isActive: true },
      });
      if (activeAdminCount <= 1) {
        return res.status(400).json({
          message: 'Cannot deactivate the sole Administrator of the organization.',
        });
      }
    }

    // Deactivation strictly sets isActive = false, status = 'OFFLINE'
    // Preserves work items, comments, chat messages, meetings, and identity records
    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: false, status: 'OFFLINE' },
    });

    // Also suspend any linked allowlist entries so new logins are prevented
    await (prisma as any).organizationAuthAllowlist.updateMany({
      where: { userId: id, organizationId: orgId },
      data: { status: 'SUSPENDED' },
    });

    if (orgId && currentUserId) {
      try {
        await prisma.auditLog.create({
          data: {
            organizationId: orgId,
            actorId: currentUserId,
            action: 'USER_DEACTIVATED',
            entityType: 'User',
            entityId: id,
            details: JSON.stringify({
              deactivatedBy: currentUserId,
              targetEmail: user.email,
              targetName: user.fullName,
              previousState: { isActive: true, status: user.status },
              newState: { isActive: false, status: 'OFFLINE' },
            }),
          },
        });
      } catch (auditErr) {
        console.warn('[OrgController] Non-blocking auditLog error:', auditErr);
      }
    }

    return res.json({ message: `Team member ${user.fullName} deactivated successfully`, user: updated });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const reactivateMember = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const currentUserId = req.user?.id;
    const currentUserRole = req.user?.role;
    const { id } = req.params;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    if (currentUserRole !== 'OWNER' && currentUserRole !== 'ADMIN') {
      return res.status(403).json({ message: 'Only OWNER and ADMIN can reactivate team members' });
    }

    const user = await prisma.user.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!user) return res.status(404).json({ message: 'User not found in organization' });

    // Reactivation restores access, retains existing identity mappings, projects, role, and work history
    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: true, status: 'OFFLINE' },
    });

    // Reactivate allowlist entry
    await (prisma as any).organizationAuthAllowlist.updateMany({
      where: { userId: id, organizationId: orgId },
      data: { status: 'ACTIVE' },
    });

    if (orgId && currentUserId) {
      try {
        await prisma.auditLog.create({
          data: {
            organizationId: orgId,
            actorId: currentUserId,
            action: 'USER_REACTIVATED',
            entityType: 'User',
            entityId: id,
            details: JSON.stringify({
              reactivatedBy: currentUserId,
              targetEmail: user.email,
              targetName: user.fullName,
              previousState: { isActive: false },
              newState: { isActive: true },
            }),
          },
        });
      } catch (auditErr) {
        console.warn('[OrgController] Non-blocking auditLog error:', auditErr);
      }
    }

    return res.json({ message: `Team member ${user.fullName} reactivated successfully`, user: updated });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

