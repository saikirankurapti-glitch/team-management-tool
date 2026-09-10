import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../prisma';
import {
  normalizeEmail,
  checkGoogleAllowlist,
  checkGitHubAllowlist,
  logSecurityEventAndAlertAdmin,
  createAccessRequest,
} from '../services/allowlistService';

describe('Phase 36: Closed Team Authentication & Allowlist Security Tests', () => {
  let mainOrgId: string = '';
  let saiKiranUser: any = null;
  let shashiUser: any = null;
  let ammarUser: any = null;

  beforeAll(async () => {
    await prisma.$connect();
    const demoOrg = await prisma.organization.findFirst({
      where: { slug: 'demo-startup' },
    });
    mainOrgId = demoOrg?.id || '';

    saiKiranUser = await prisma.user.findFirst({
      where: { fullName: 'Sai Kiran', organizationId: mainOrgId },
    });
    shashiUser = await prisma.user.findFirst({
      where: { fullName: 'Shashi', organizationId: mainOrgId },
    });
    ammarUser = await prisma.user.findFirst({
      where: { fullName: 'Ammar Raza', organizationId: mainOrgId },
    });
  });

  it('should verify email normalization operates reliably', () => {
    expect(normalizeEmail('  SaiKiranKurapti@Gmail.com ')).toBe('saikirankurapti@gmail.com');
    expect(normalizeEmail('SHASHI.zerokost@GMAIL.COM')).toBe('shashi.zerokost@gmail.com');
  });

  it('should approve the configured Google accounts and map them accurately', async () => {
    // 1. saikirankurapti@gmail.com (Sai Kiran / Admin)
    const check1 = await checkGoogleAllowlist(mainOrgId, 'saikirankurapti@gmail.com');
    expect(check1.allowed).toBe(true);
    expect(check1.user).not.toBeNull();
    expect(check1.user.fullName).toBe('Sai Kiran');

    // 2. saikiran.zerokost@gmail.com (Sai Kiran / Secondary)
    const check2 = await checkGoogleAllowlist(mainOrgId, 'saikiran.zerokost@gmail.com');
    expect(check2.allowed).toBe(true);
    expect(check2.user).not.toBeNull();
    expect(check2.user.fullName).toBe('Sai Kiran');

    // 3. shashi.zerokost@gmail.com (Shashi)
    const check3 = await checkGoogleAllowlist(mainOrgId, 'shashi.zerokost@gmail.com');
    expect(check3.allowed).toBe(true);
    expect(check3.user).not.toBeNull();
    expect(check3.user.fullName).toBe('Shashi');

    // 4. ammarraza.zerokost@gmail.com (Ammar Raza)
    const check4 = await checkGoogleAllowlist(mainOrgId, 'ammarraza.zerokost@gmail.com');
    expect(check4.allowed).toBe(true);
    expect(check4.user).not.toBeNull();
    expect(check4.user.fullName).toBe('Ammar Raza');

    // 5. everythingdata789@gmail.com (Authorized, pending explicit member selection)
    const check5 = await checkGoogleAllowlist(mainOrgId, 'everythingdata789@gmail.com');
    expect(check5.allowed).toBe(true);
    expect(check5.entry.status).toBe('ACTIVE');
  });

  it('should REJECT unknown Google account, log security event, and notify admin', async () => {
    const unknownEmail = 'unauthorized.stranger@gmail.com';
    const check = await checkGoogleAllowlist(mainOrgId, unknownEmail);

    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('NOT_IN_ALLOWLIST');
    expect(check.user).toBeNull();

    // Verify security event logging & admin notification
    const secEvent = await logSecurityEventAndAlertAdmin(mainOrgId, {
      eventType: 'UNAUTHORIZED_LOGIN_ATTEMPT',
      provider: 'GOOGLE',
      email: unknownEmail,
      ip: '198.51.100.25',
      userAgent: 'Mozilla/5.0 Test Suite',
    });

    expect(secEvent).not.toBeNull();
    expect(secEvent.eventType).toBe('UNAUTHORIZED_LOGIN_ATTEMPT');
    expect(secEvent.status).toBe('BLOCKED');

    // Verify admin received notification
    const adminNotification = await prisma.notification.findFirst({
      where: {
        userId: saiKiranUser.id,
        title: { contains: 'Unauthorized Login Attempt' },
        body: { contains: unknownEmail },
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(adminNotification).not.toBeNull();
    expect(adminNotification?.body).toContain(unknownEmail);
  });

  it('should enforce that separate email addresses are not confused with saikirankurapti@gmail.com and both saikirankurapati04@gmail.com and saikirankurapti@gmail.com have explicit allowlist mappings', async () => {
    const authorizedEmail = 'saikirankurapati04@gmail.com';
    const adminEmail = 'saikirankurapti@gmail.com';
    const typoUnapprovedEmail = 'saikirankurapati.fake@gmail.com';

    // Verify admin email is authorized and maps to Sai Kiran
    const adminCheck = await checkGoogleAllowlist(mainOrgId, adminEmail);
    expect(adminCheck.allowed).toBe(true);
    expect(adminCheck.user?.fullName).toBe('Sai Kiran');

    // Verify current test account is explicitly authorized and maps to distinct team member profile
    const testAccountCheck = await checkGoogleAllowlist(mainOrgId, authorizedEmail);
    expect(testAccountCheck.allowed).toBe(true);
    expect(testAccountCheck.user?.email).toBe(authorizedEmail);
    expect(testAccountCheck.user?.role).toBe('TEAM_MEMBER');

    // Verify an unapproved variation remains strictly unauthorized
    const unapprovedCheck = await checkGoogleAllowlist(mainOrgId, typoUnapprovedEmail);
    expect(unapprovedCheck.allowed).toBe(false);
    expect(unapprovedCheck.reason).toBe('NOT_IN_ALLOWLIST');
    expect(unapprovedCheck.user).toBeNull();
  });

  it('should REJECT login for SUSPENDED allowlist entry', async () => {
    // Temporarily create a suspended allowlist entry
    const suspendedEmail = 'suspended.contractor@gmail.com';
    const entry = await (prisma as any).organizationAuthAllowlist.create({
      data: {
        organizationId: mainOrgId,
        provider: 'GOOGLE',
        email: suspendedEmail,
        normalizedEmail: suspendedEmail,
        status: 'SUSPENDED',
      },
    });

    const check = await checkGoogleAllowlist(mainOrgId, suspendedEmail);
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('SUSPENDED');

    // Clean up
    await (prisma as any).organizationAuthAllowlist.delete({ where: { id: entry.id } });
  });

  it('should REJECT login for REVOKED allowlist entry', async () => {
    const revokedEmail = 'former.employee@gmail.com';
    const entry = await (prisma as any).organizationAuthAllowlist.create({
      data: {
        organizationId: mainOrgId,
        provider: 'GOOGLE',
        email: revokedEmail,
        normalizedEmail: revokedEmail,
        status: 'REVOKED',
      },
    });

    const check = await checkGoogleAllowlist(mainOrgId, revokedEmail);
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('REVOKED');

    // Clean up
    await (prisma as any).organizationAuthAllowlist.delete({ where: { id: entry.id } });
  });

  it('should handle access request submission for unauthorized users', async () => {
    const reqEmail = 'applicant.engineer@gmail.com';
    const request = await createAccessRequest(
      mainOrgId,
      'GOOGLE',
      reqEmail,
      'Applicant Engineer',
      '203.0.113.195',
      'Test UserAgent'
    );

    expect(request).not.toBeNull();
    expect(request.status).toBe('PENDING');
    expect(request.email).toBe(reqEmail);

    // Clean up
    await (prisma as any).authAccessRequest.delete({ where: { id: request.id } });
  });

  it('should reject unknown GitHub account and verify allowlist protection', async () => {
    const unknownGithubId = '999999999';
    const unknownGithubEmail = 'stranger.dev@github.example';

    const check = await checkGitHubAllowlist(mainOrgId, unknownGithubId, unknownGithubEmail);
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('NOT_IN_ALLOWLIST');
  });
});
