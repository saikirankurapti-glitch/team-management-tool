import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getBillingOverview = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    let sub = await prisma.subscription.findUnique({
      where: { organizationId: orgId },
    });

    const now = new Date();

    if (!sub) {
      const trialEnds = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      sub = await prisma.subscription.create({
        data: {
          organizationId: orgId,
          plan: 'TEAM',
          status: 'TRIALING',
          trialEndsAt: trialEnds,
          maxMembers: 25,
          maxProjects: 20,
        },
      });
    }

    const memberCount = await prisma.user.count({ where: { organizationId: orgId } });
    const projectCount = await prisma.project.count({ where: { organizationId: orgId } });
    const aiSettings = await prisma.aiSettings.findUnique({ where: { organizationId: orgId } });

    const trialDaysRemaining = sub.trialEndsAt
      ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 14;

    return res.json({
      subscription: {
        plan: sub.plan,
        status: sub.status,
        trialDaysRemaining,
        maxMembers: sub.maxMembers,
        maxProjects: sub.maxProjects,
      },
      usage: {
        members: { current: memberCount, max: sub.maxMembers, percentage: Math.round((memberCount / sub.maxMembers) * 100) },
        projects: { current: projectCount, max: sub.maxProjects, percentage: Math.round((projectCount / sub.maxProjects) * 100) },
        aiTokens: { current: aiSettings?.currentUsage || 450, max: aiSettings?.monthlyUsageLimit || 10000 },
        storageGb: { current: 4.2, max: 10.0 },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const upgradeSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { plan } = req.body; // TEAM | BUSINESS | ENTERPRISE

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    let maxMembers = 25;
    let maxProjects = 20;

    if (plan === 'BUSINESS') {
      maxMembers = 100;
      maxProjects = 50;
    } else if (plan === 'ENTERPRISE') {
      maxMembers = 1000;
      maxProjects = 500;
    }

    const sub = await prisma.subscription.upsert({
      where: { organizationId: orgId },
      update: {
        plan,
        status: 'ACTIVE',
        maxMembers,
        maxProjects,
      },
      create: {
        organizationId: orgId,
        plan,
        status: 'ACTIVE',
        maxMembers,
        maxProjects,
      },
    });

    return res.json({
      success: true,
      message: `Successfully upgraded to ${plan} plan.`,
      subscription: sub,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
