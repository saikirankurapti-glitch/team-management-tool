import { prisma } from '../prisma.js';
import { normalizeEmail } from '../services/allowlistService.js';

async function main() {
  const email = 'saikirankurapati04@gmail.com';
  const normEmail = normalizeEmail(email);

  const org = await prisma.organization.findFirst({
    where: { slug: 'demo-startup' },
  });
  if (!org) {
    console.error('Demo startup org not found');
    return;
  }

  const saiKiran = await prisma.user.findFirst({
    where: { fullName: 'Sai Kiran', organizationId: org.id },
  });
  if (!saiKiran) {
    console.error('Sai Kiran user not found');
    return;
  }

  // Find or approve the pending access request
  const pendingReq = await (prisma as any).authAccessRequest.findFirst({
    where: {
      organizationId: org.id,
      email: normEmail,
    },
  });

  if (pendingReq) {
    await (prisma as any).authAccessRequest.update({
      where: { id: pendingReq.id },
      data: {
        status: 'APPROVED',
        reviewedById: saiKiran.id,
        reviewedAt: new Date(),
      },
    });
    console.log(`Updated pending request ${pendingReq.id} to APPROVED`);
  }

  // Create or update OrganizationAuthAllowlist
  const allowlistEntry = await (prisma as any).organizationAuthAllowlist.upsert({
    where: {
      organizationId_provider_normalizedEmail: {
        organizationId: org.id,
        provider: 'GOOGLE',
        normalizedEmail: normEmail,
      },
    },
    update: {
      status: 'ACTIVE',
      userId: saiKiran.id,
      displayName: 'Sai Kiran',
    },
    create: {
      organizationId: org.id,
      provider: 'GOOGLE',
      email: email,
      normalizedEmail: normEmail,
      status: 'ACTIVE',
      userId: saiKiran.id,
      displayName: 'Sai Kiran',
      createdBy: 'ADMIN',
    },
  });

  console.log('Allowlist entry upserted:', allowlistEntry);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
