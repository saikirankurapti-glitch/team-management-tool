import { prisma } from '../prisma.js';

export const checkEntitlement = async (organizationId: string, limitType: 'MEMBERS' | 'PROJECTS' | 'AI_USAGE') => {
  let sub = await prisma.subscription.findUnique({
    where: { organizationId },
  });

  if (!sub) {
    sub = await prisma.subscription.create({
      data: {
        organizationId,
        plan: 'TEAM',
        status: 'ACTIVE',
        maxMembers: 25,
        maxProjects: 20,
      },
    });
  }

  if (limitType === 'MEMBERS') {
    const currentMembers = await prisma.user.count({ where: { organizationId } });
    if (currentMembers >= sub.maxMembers) {
      throw new Error(`Organization member limit reached (${sub.maxMembers} max on ${sub.plan} plan).`);
    }
  }

  if (limitType === 'PROJECTS') {
    const currentProjects = await prisma.project.count({ where: { organizationId } });
    if (currentProjects >= sub.maxProjects) {
      throw new Error(`Organization project limit reached (${sub.maxProjects} max on ${sub.plan} plan).`);
    }
  }

  return { allowed: true, plan: sub.plan };
};
