import { prisma } from '../prisma.js';
import { normalizeEmail } from '../services/allowlistService.js';

/**
 * Seeds the approved Google accounts into OrganizationAuthAllowlist
 * according to Phase 36 requirements.
 */
export async function seedPhase36Allowlist() {
  console.log('[SeedPhase36] Seeding closed team authentication allowlist...');

  const mainOrg = await prisma.organization.findFirst({
    where: { slug: 'demo-startup' },
  });

  if (!mainOrg) {
    console.warn('[SeedPhase36] demo-startup organization not found.');
    return;
  }

  const orgId = mainOrg.id;

  // Retrieve current active team members
  const saiKiran = await prisma.user.findFirst({
    where: { fullName: 'Sai Kiran', organizationId: orgId },
  });
  const shashi = await prisma.user.findFirst({
    where: { fullName: 'Shashi', organizationId: orgId },
  });
  const ammarRaza = await prisma.user.findFirst({
    where: { fullName: 'Ammar Raza', organizationId: orgId },
  });

  const approvedAccounts = [
    {
      email: 'saikirankurapti@gmail.com',
      provider: 'GOOGLE',
      userId: saiKiran?.id || null,
      displayName: 'Sai Kiran (Admin Primary)',
      status: 'ACTIVE',
    },
    {
      email: 'saikiran.zerokost@gmail.com',
      provider: 'GOOGLE',
      userId: saiKiran?.id || null,
      displayName: 'Sai Kiran (Secondary)',
      status: 'ACTIVE',
    },
    {
      email: 'everythingdata789@gmail.com',
      provider: 'GOOGLE',
      userId: null, // Pending explicit member mapping by administrator
      displayName: 'Authorized Google Identity',
      status: 'ACTIVE',
    },
    {
      email: 'shashi.zerokost@gmail.com',
      provider: 'GOOGLE',
      userId: shashi?.id || null,
      displayName: 'Shashi',
      status: 'ACTIVE',
    },
    {
      email: 'ammarraza.zerokost@gmail.com',
      provider: 'GOOGLE',
      userId: ammarRaza?.id || null,
      displayName: 'Ammar Raza',
      status: 'ACTIVE',
    },
  ];

  for (const acct of approvedAccounts) {
    const norm = normalizeEmail(acct.email);
    await (prisma as any).organizationAuthAllowlist.upsert({
      where: {
        organizationId_provider_normalizedEmail: {
          organizationId: orgId,
          provider: acct.provider,
          normalizedEmail: norm,
        },
      },
      update: {
        userId: acct.userId,
        displayName: acct.displayName,
        status: acct.status,
      },
      create: {
        organizationId: orgId,
        provider: acct.provider,
        email: acct.email,
        normalizedEmail: norm,
        userId: acct.userId,
        displayName: acct.displayName,
        status: acct.status,
        createdBy: 'SYSTEM_SEED',
      },
    });
  }

  console.log(`[SeedPhase36] Successfully seeded ${approvedAccounts.length} approved authentication accounts.`);
}

if (process.argv[1] && process.argv[1].endsWith('seedPhase36Allowlist.ts')) {
  seedPhase36Allowlist()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[SeedPhase36] Failed:', err);
      process.exit(1);
    });
}
