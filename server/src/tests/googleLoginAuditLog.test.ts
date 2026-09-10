import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../prisma';
import { checkGoogleAllowlist } from '../services/allowlistService';

describe('Phase 37: Google Login AuditLog & Organization Relation Regression Test', () => {
  let mainOrgId: string = '';
  let saiKiranUser: any = null;

  beforeAll(async () => {
    await prisma.$connect();
    const demoOrg = await prisma.organization.findFirst({
      where: { slug: 'demo-startup' },
    });
    mainOrgId = demoOrg?.id || '';

    saiKiranUser = await prisma.user.findFirst({
      where: { fullName: 'Sai Kiran', organizationId: mainOrgId },
    });
  });

  it('should verify Google login identity resolution maps to existing user and org without creating duplicates', async () => {
    const email = 'saikirankurapti@gmail.com';
    const allowlistCheck = await checkGoogleAllowlist(mainOrgId, email);

    expect(allowlistCheck.allowed).toBe(true);
    expect(allowlistCheck.user).not.toBeNull();
    expect(allowlistCheck.user.id).toBe(saiKiranUser.id);
    expect(allowlistCheck.user.fullName).toBe('Sai Kiran');

    // Count users with this name
    const count = await prisma.user.count({
      where: { fullName: 'Sai Kiran', organizationId: mainOrgId },
    });
    expect(count).toBe(1);
  });

  it('should successfully create USER_LOGIN_GOOGLE AuditLog using organization and actor connect relations', async () => {
    const email = 'saikirankurapti@gmail.com';
    const allowlistEntry = await (prisma as any).organizationAuthAllowlist.findFirst({
      where: { normalizedEmail: email },
    });

    expect(allowlistEntry).not.toBeNull();

    // Perform the exact AuditLog invocation used in Google Callback
    const auditRecord = await prisma.auditLog.create({
      data: {
        organization: {
          connect: { id: mainOrgId },
        },
        actor: {
          connect: { id: saiKiranUser.id },
        },
        action: 'USER_LOGIN_GOOGLE',
        entityType: 'AUTHENTICATION',
        entityId: allowlistEntry.id,
        details: JSON.stringify({
          email,
          provider: 'GOOGLE',
          ip: '127.0.0.1',
          timestamp: new Date().toISOString(),
        }),
      },
      include: {
        organization: true,
        actor: true,
      },
    });

    expect(auditRecord).toBeDefined();
    expect(auditRecord.action).toBe('USER_LOGIN_GOOGLE');
    expect(auditRecord.organizationId).toBe(mainOrgId);
    expect(auditRecord.organization.name).toBe('Demo Startup Inc.');
    expect(auditRecord.actorId).toBe(saiKiranUser.id);
    expect(auditRecord.actor.fullName).toBe('Sai Kiran');

    // Clean up test audit record
    await prisma.auditLog.delete({ where: { id: auditRecord.id } });
  });

  it('should verify Shashi and Ammar Raza login identities map cleanly to the same existing organization', async () => {
    const shashiCheck = await checkGoogleAllowlist(mainOrgId, 'shashi.zerokost@gmail.com');
    expect(shashiCheck.allowed).toBe(true);
    expect(shashiCheck.user.fullName).toBe('Shashi');
    expect(shashiCheck.user.organizationId).toBe(mainOrgId);

    const ammarCheck = await checkGoogleAllowlist(mainOrgId, 'ammarraza.zerokost@gmail.com');
    expect(ammarCheck.allowed).toBe(true);
    expect(ammarCheck.user.fullName).toBe('Ammar Raza');
    expect(ammarCheck.user.organizationId).toBe(mainOrgId);
  });
});
