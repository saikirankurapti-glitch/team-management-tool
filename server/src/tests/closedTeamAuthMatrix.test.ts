import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../prisma';
import {
  checkGoogleAllowlist,
  checkGitHubAllowlist,
  normalizeEmail,
  createAccessRequest,
  logSecurityEventAndAlertAdmin,
} from '../services/allowlistService';

describe('Closed Team Authentication & Authorization 12-Point Test Matrix', () => {
  let mainOrgId: string = '';
  let otherOrgId: string = '';
  let saiKiranUser: any = null;
  let ammarUser: any = null;

  beforeAll(async () => {
    await prisma.$connect();
    const demoOrg = await prisma.organization.findFirst({
      where: { slug: 'demo-startup' },
    });
    mainOrgId = demoOrg?.id || '';

    // Find or create a second organization for cross-org testing
    let otherOrg = await prisma.organization.findFirst({
      where: { slug: 'other-test-org' },
    });
    if (!otherOrg) {
      otherOrg = await prisma.organization.create({
        data: {
          name: 'Other Test Organization',
          slug: 'other-test-org',
        },
      });
    }
    otherOrgId = otherOrg.id;

    saiKiranUser = await prisma.user.findFirst({
      where: { fullName: 'Sai Kiran', organizationId: mainOrgId },
    });

    ammarUser = await prisma.user.findFirst({
      where: { fullName: 'Ammar Raza', organizationId: mainOrgId },
    });
  });

  // TEST 1: Approved Google identity -> Login succeeds
  it('TEST 1: Approved Google identity allows login and maps to existing user', async () => {
    const email = 'saikirankurapti@gmail.com';
    const check = await checkGoogleAllowlist(mainOrgId, email);

    expect(check.allowed).toBe(true);
    expect(check.reason).toBe('APPROVED');
    expect(check.entry).not.toBeNull();
    expect(check.user).not.toBeNull();
    expect(check.user.id).toBe(saiKiranUser.id);
    expect(check.user.fullName).toBe('Sai Kiran');
  });

  // TEST 2: Google Test User but NOT TMP allowlist -> Access denied
  it('TEST 2: Google authenticated account not in TMP allowlist is denied access', async () => {
    const unapprovedEmail = 'random_tester_unapproved@gmail.com';
    const check = await checkGoogleAllowlist(mainOrgId, unapprovedEmail);

    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('NOT_IN_ALLOWLIST');
    expect(check.entry).toBeNull();
  });

  // TEST 3: TMP allowlist ACTIVE -> Login succeeds
  it('TEST 3: Allowlist entry with ACTIVE status succeeds', async () => {
    const email = 'saikirankurapti@gmail.com';
    const check = await checkGoogleAllowlist(mainOrgId, email);

    expect(check.allowed).toBe(true);
    expect(check.entry?.status).toBe('ACTIVE');
    expect(check.user?.fullName).toBe('Sai Kiran');
  });

  // TEST 4: TMP allowlist REVOKED -> Login denied
  it('TEST 4: Allowlist entry with REVOKED status is denied', async () => {
    const testRevokedEmail = 'revoked_member_test@example.com';
    const norm = normalizeEmail(testRevokedEmail);

    await (prisma as any).organizationAuthAllowlist.upsert({
      where: {
        organizationId_provider_normalizedEmail: {
          organizationId: mainOrgId,
          provider: 'GOOGLE',
          normalizedEmail: norm,
        },
      },
      update: { status: 'REVOKED' },
      create: {
        organizationId: mainOrgId,
        provider: 'GOOGLE',
        email: testRevokedEmail,
        normalizedEmail: norm,
        status: 'REVOKED',
        createdBy: 'ADMIN',
      },
    });

    const check = await checkGoogleAllowlist(mainOrgId, testRevokedEmail);
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('REVOKED');

    // Clean up
    await (prisma as any).organizationAuthAllowlist.deleteMany({
      where: { organizationId: mainOrgId, normalizedEmail: norm },
    });
  });

  // TEST 5: Unknown Google account -> Access request created, audit event created
  it('TEST 5: Unknown account creates access request and logs security event', async () => {
    const unknownEmail = 'unknown_visitor_42@example.com';
    const norm = normalizeEmail(unknownEmail);

    // 1. Create access request
    const reqRecord = await createAccessRequest(
      mainOrgId,
      'GOOGLE',
      unknownEmail,
      'Unknown Visitor',
      '127.0.0.1',
      'TestRunner/1.0'
    );
    expect(reqRecord).toBeDefined();
    expect(reqRecord.status).toBe('PENDING');
    expect(reqRecord.email).toBe(norm);

    // 2. Log security alert
    const secEvent = await logSecurityEventAndAlertAdmin(mainOrgId, {
      eventType: 'UNAUTHORIZED_LOGIN_ATTEMPT',
      provider: 'GOOGLE',
      email: unknownEmail,
      ip: '127.0.0.1',
      userAgent: 'TestRunner/1.0',
      details: { test: true },
      status: 'BLOCKED',
    });
    expect(secEvent).toBeDefined();
    expect(secEvent.eventType).toBe('UNAUTHORIZED_LOGIN_ATTEMPT');

    // Clean up
    await (prisma as any).authAccessRequest.deleteMany({
      where: { id: reqRecord.id },
    });
    if (secEvent?.id) {
      await (prisma as any).securityEvent.deleteMany({
        where: { id: secEvent.id },
      });
    }
  });

  // TEST 6: Duplicate access request -> No duplicate pending request
  it('TEST 6: Submitting duplicate access request does not create duplicates', async () => {
    const testEmail = 'duplicate_check_test@example.com';
    const norm = normalizeEmail(testEmail);

    const req1 = await createAccessRequest(mainOrgId, 'GOOGLE', testEmail);
    const req2 = await createAccessRequest(mainOrgId, 'GOOGLE', testEmail);

    expect(req1.id).toBe(req2.id);

    const pendingCount = await (prisma as any).authAccessRequest.count({
      where: { organizationId: mainOrgId, email: norm, status: 'PENDING' },
    });
    expect(pendingCount).toBe(1);

    // Clean up
    await (prisma as any).authAccessRequest.deleteMany({
      where: { id: req1.id },
    });
  });

  // TEST 7: Duplicate Google identity -> No duplicate user created
  it('TEST 7: Authorizing an account maps to existing User without creating a new user record', async () => {
    const userCountBefore = await prisma.user.count({
      where: { organizationId: mainOrgId },
    });

    const check = await checkGoogleAllowlist(mainOrgId, 'saikirankurapti@gmail.com');
    expect(check.allowed).toBe(true);
    expect(check.user.id).toBe(saiKiranUser.id);

    const userCountAfter = await prisma.user.count({
      where: { organizationId: mainOrgId },
    });
    expect(userCountAfter).toBe(userCountBefore);
  });

  // TEST 8: Same email with different provider -> Identities remain provider-specific
  it('TEST 8: Same email across different providers maintains separate provider records', async () => {
    const sharedEmail = 'shared_identity@example.com';
    const norm = normalizeEmail(sharedEmail);

    const googleEntry = await (prisma as any).organizationAuthAllowlist.create({
      data: {
        organizationId: mainOrgId,
        provider: 'GOOGLE',
        email: sharedEmail,
        normalizedEmail: norm,
        status: 'ACTIVE',
      },
    });

    const githubEntry = await (prisma as any).organizationAuthAllowlist.create({
      data: {
        organizationId: mainOrgId,
        provider: 'GITHUB',
        email: sharedEmail,
        normalizedEmail: norm,
        externalIdentityId: 'gh_999999',
        status: 'ACTIVE',
      },
    });

    expect(googleEntry.provider).toBe('GOOGLE');
    expect(githubEntry.provider).toBe('GITHUB');
    expect(googleEntry.id).not.toBe(githubEntry.id);

    // Verify lookup by provider
    const checkGoogle = await checkGoogleAllowlist(mainOrgId, sharedEmail);
    const checkGitHub = await checkGitHubAllowlist(mainOrgId, 'gh_999999', sharedEmail);

    expect(checkGoogle.allowed).toBe(true);
    expect(checkGoogle.entry.provider).toBe('GOOGLE');
    expect(checkGitHub.allowed).toBe(true);
    expect(checkGitHub.entry.provider).toBe('GITHUB');

    // Clean up
    await (prisma as any).organizationAuthAllowlist.deleteMany({
      where: { id: { in: [googleEntry.id, githubEntry.id] } },
    });
  });

  // TEST 9: Cross-organization attempt -> Access denied
  it('TEST 9: Account authorized in Org A cannot access Org B', async () => {
    // saikirankurapati04@gmail.com is authorized in mainOrgId, NOT in otherOrgId
    const checkOther = await checkGoogleAllowlist(otherOrgId, 'saikirankurapati04@gmail.com');
    expect(checkOther.allowed).toBe(false);
    expect(checkOther.reason).toBe('NOT_IN_ALLOWLIST');
  });

  // TEST 10: Admin approves request -> Identity becomes ACTIVE and mapped to existing user
  it('TEST 10: Admin approving an access request activates allowlist and links user', async () => {
    const requestEmail = 'new_member_candidate@example.com';
    const norm = normalizeEmail(requestEmail);

    const accessReq = await (prisma as any).authAccessRequest.create({
      data: {
        organizationId: mainOrgId,
        provider: 'GOOGLE',
        email: norm,
        name: 'Ammar Raza Candidate',
        status: 'PENDING',
      },
    });

    // Simulate Admin approval action
    const allowlistEntry = await (prisma as any).organizationAuthAllowlist.upsert({
      where: {
        organizationId_provider_normalizedEmail: {
          organizationId: mainOrgId,
          provider: 'GOOGLE',
          normalizedEmail: norm,
        },
      },
      update: {
        status: 'ACTIVE',
        userId: ammarUser.id,
      },
      create: {
        organizationId: mainOrgId,
        provider: 'GOOGLE',
        email: requestEmail,
        normalizedEmail: norm,
        status: 'ACTIVE',
        userId: ammarUser.id,
        displayName: 'Ammar Raza',
        createdBy: 'ADMIN',
      },
    });

    await (prisma as any).authAccessRequest.update({
      where: { id: accessReq.id },
      data: {
        status: 'APPROVED',
        reviewedById: saiKiranUser.id,
        reviewedAt: new Date(),
      },
    });

    // Verification
    const check = await checkGoogleAllowlist(mainOrgId, requestEmail);
    expect(check.allowed).toBe(true);
    expect(check.user?.id).toBe(ammarUser.id);
    expect(check.user?.fullName).toBe('Ammar Raza');

    // Clean up
    await (prisma as any).organizationAuthAllowlist.deleteMany({
      where: { id: allowlistEntry.id },
    });
    await (prisma as any).authAccessRequest.deleteMany({
      where: { id: accessReq.id },
    });
  });

  // TEST 11: Admin revokes identity -> Future login denied
  it('TEST 11: Revoking an allowlist entry immediately prevents future login', async () => {
    const testEmail = 'temporary_consultant@example.com';
    const norm = normalizeEmail(testEmail);

    const entry = await (prisma as any).organizationAuthAllowlist.create({
      data: {
        organizationId: mainOrgId,
        provider: 'GOOGLE',
        email: testEmail,
        normalizedEmail: norm,
        status: 'ACTIVE',
      },
    });

    // Initially active
    let check = await checkGoogleAllowlist(mainOrgId, testEmail);
    expect(check.allowed).toBe(true);

    // Admin revokes
    await (prisma as any).organizationAuthAllowlist.update({
      where: { id: entry.id },
      data: { status: 'REVOKED' },
    });

    // Login denied
    check = await checkGoogleAllowlist(mainOrgId, testEmail);
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('REVOKED');

    // Clean up
    await (prisma as any).organizationAuthAllowlist.deleteMany({
      where: { id: entry.id },
    });
  });

  // TEST 12: Previously existing user -> No duplicate User record
  it('TEST 12: Verifying existing 6 real team members remain intact without duplicates', async () => {
    const expectedMembers = [
      'Raj Mange',
      'Sai Kiran',
      'Ammar Raza',
      'Ashwin T',
      'Shashi',
      'Navya Sri',
    ];

    const users = await prisma.user.findMany({
      where: { organizationId: mainOrgId },
    });

    const userNames = users.map((u) => u.fullName);
    for (const member of expectedMembers) {
      expect(userNames).toContain(member);
      const occurrences = userNames.filter((n) => n === member).length;
      expect(occurrences).toBe(1);
    }

    // No demo/fake users
    expect(userNames).not.toContain('Ravi Verma');
    expect(userNames).not.toContain('Priya Sharma');
  });
});
