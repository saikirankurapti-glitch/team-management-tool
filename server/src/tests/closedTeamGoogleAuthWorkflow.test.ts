import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../prisma.js';
import {
  checkGoogleAllowlist,
  normalizeEmail,
  createAccessRequest,
  logSecurityEventAndAlertAdmin,
} from '../services/allowlistService.js';

describe('Closed-Team Google Authentication Workflow (Tests A through J)', () => {
  let mainOrgId: string = '';
  let otherOrgId: string = '';
  let saiKiranUser: any = null;
  let ammarUser: any = null;
  let rajMangeUser: any = null;

  const testNewUserEmail = 'new.closedteam.candidate@gmail.com';
  const testRejectedEmail = 'rejected.applicant@gmail.com';
  const testRevokedEmail = 'revoked.contractor@gmail.com';

  beforeAll(async () => {
    await prisma.$connect();
    const demoOrg = await prisma.organization.findFirst({
      where: { slug: 'demo-startup' },
    });
    mainOrgId = demoOrg?.id || '';

    let otherOrg = await prisma.organization.findFirst({
      where: { slug: 'other-test-org' },
    });
    if (!otherOrg) {
      otherOrg = await prisma.organization.create({
        data: {
          name: 'Other Isolation Test Organization',
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

    rajMangeUser = await prisma.user.findFirst({
      where: { fullName: 'Raj Mange', organizationId: mainOrgId },
    });

    // Cleanup any lingering test records
    await (prisma as any).authAccessRequest.deleteMany({
      where: {
        email: {
          in: [
            normalizeEmail(testNewUserEmail),
            normalizeEmail(testRejectedEmail),
            normalizeEmail(testRevokedEmail),
          ],
        },
      },
    });

    await (prisma as any).organizationAuthAllowlist.deleteMany({
      where: {
        normalizedEmail: {
          in: [
            normalizeEmail(testNewUserEmail),
            normalizeEmail(testRejectedEmail),
            normalizeEmail(testRevokedEmail),
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await (prisma as any).authAccessRequest.deleteMany({
      where: {
        email: {
          in: [
            normalizeEmail(testNewUserEmail),
            normalizeEmail(testRejectedEmail),
            normalizeEmail(testRevokedEmail),
          ],
        },
      },
    });

    await (prisma as any).organizationAuthAllowlist.deleteMany({
      where: {
        normalizedEmail: {
          in: [
            normalizeEmail(testNewUserEmail),
            normalizeEmail(testRejectedEmail),
            normalizeEmail(testRevokedEmail),
          ],
        },
      },
    });
  });

  // TEST A: New Google account authenticates -> TMP creates AccessRequest, Admin notification appears, Access Pending
  it('TEST A: New Google account creates AccessRequest, admin notification, and Access Pending status', async () => {
    // 1. Google OAuth identity arrives at TMP, TMP checks allowlist
    const check = await checkGoogleAllowlist(mainOrgId, testNewUserEmail);
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('NOT_IN_ALLOWLIST');

    // 2. TMP creates AccessRequest and admin notification
    const accessReq = await createAccessRequest(
      mainOrgId,
      'GOOGLE',
      testNewUserEmail,
      'Test Candidate',
      '192.168.1.50',
      'Mozilla/5.0 TestBrowser'
    );

    expect(accessReq).toBeDefined();
    expect(accessReq.status).toBe('PENDING');
    expect(accessReq.email).toBe(normalizeEmail(testNewUserEmail));
    expect(accessReq.organizationId).toBe(mainOrgId);

    // 3. Security event logged
    const secEvent = await logSecurityEventAndAlertAdmin(mainOrgId, {
      eventType: 'UNAUTHORIZED_LOGIN_ATTEMPT',
      provider: 'GOOGLE',
      email: testNewUserEmail,
      ip: '192.168.1.50',
      status: 'BLOCKED',
    });
    expect(secEvent).toBeDefined();
    expect(secEvent?.status).toBe('BLOCKED');

    // 4. Verify admin notification exists
    const adminNotif = await prisma.notification.findFirst({
      where: {
        userId: saiKiranUser.id,
        link: '/settings/security',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(adminNotif).not.toBeNull();
    expect(adminNotif?.body).toContain(testNewUserEmail);
  });

  // TEST B: Admin opens notification -> Link points to /settings/security
  it('TEST B: Admin notification contains direct link to security settings', async () => {
    const adminNotif = await prisma.notification.findFirst({
      where: {
        userId: saiKiranUser.id,
        link: '/settings/security',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(adminNotif).toBeDefined();
    expect(adminNotif?.link).toBe('/settings/security');
  });

  // TEST C: Admin approves and maps user to existing TMP member
  it('TEST C: Admin approves request and maps Google identity to existing TMP member (No duplicate User)', async () => {
    const pendingReq = await (prisma as any).authAccessRequest.findFirst({
      where: {
        organizationId: mainOrgId,
        email: normalizeEmail(testNewUserEmail),
        status: 'PENDING',
      },
    });
    expect(pendingReq).not.toBeNull();

    // Perform approval transaction: map to Ammar Raza
    await prisma.$transaction(async (tx: any) => {
      // 1. Re-check request is PENDING
      const currentReq = await tx.authAccessRequest.findUnique({
        where: { id: pendingReq.id },
      });
      expect(currentReq.status).toBe('PENDING');

      // 2. Upsert allowlist entry mapped to existing user Ammar Raza
      const allowEntry = await tx.organizationAuthAllowlist.upsert({
        where: {
          organizationId_provider_normalizedEmail: {
            organizationId: mainOrgId,
            provider: 'GOOGLE',
            normalizedEmail: normalizeEmail(testNewUserEmail),
          },
        },
        update: {
          status: 'ACTIVE',
          userId: ammarUser.id,
          displayName: 'Ammar Raza (Secondary)',
        },
        create: {
          organizationId: mainOrgId,
          provider: 'GOOGLE',
          email: testNewUserEmail,
          normalizedEmail: normalizeEmail(testNewUserEmail),
          status: 'ACTIVE',
          userId: ammarUser.id,
          displayName: 'Ammar Raza (Secondary)',
          createdBy: saiKiranUser.email,
        },
      });

      // 3. Mark AccessRequest as APPROVED
      await tx.authAccessRequest.update({
        where: { id: pendingReq.id },
        data: {
          status: 'APPROVED',
          reviewedById: saiKiranUser.id,
          reviewedAt: new Date(),
        },
      });

      // 4. Create AuditLog with required Prisma relations
      await tx.auditLog.create({
        data: {
          organization: { connect: { id: mainOrgId } },
          actor: { connect: { id: saiKiranUser.id } },
          action: 'ACCESS_REQUEST_APPROVED',
          entityType: 'AUTHENTICATION',
          entityId: allowEntry.id,
          details: JSON.stringify({
            email: testNewUserEmail,
            provider: 'GOOGLE',
            targetUser: ammarUser.fullName,
            targetUserId: ammarUser.id,
            requestId: pendingReq.id,
          }),
        },
      });
    });

    // Verification: Request status is APPROVED
    const updatedReq = await (prisma as any).authAccessRequest.findUnique({
      where: { id: pendingReq.id },
    });
    expect(updatedReq.status).toBe('APPROVED');
    expect(updatedReq.reviewedById).toBe(saiKiranUser.id);

    // Verification: OrganizationAuthAllowlist is ACTIVE
    const allowlistEntry = await (prisma as any).organizationAuthAllowlist.findFirst({
      where: {
        organizationId: mainOrgId,
        normalizedEmail: normalizeEmail(testNewUserEmail),
      },
    });
    expect(allowlistEntry).not.toBeNull();
    expect(allowlistEntry.status).toBe('ACTIVE');
    expect(allowlistEntry.userId).toBe(ammarUser.id);

    // Verification: No new User record was created
    const ammarCount = await prisma.user.count({
      where: { fullName: 'Ammar Raza', organizationId: mainOrgId },
    });
    expect(ammarCount).toBe(1);
  });

  // TEST D: Same Google user logs in again -> Dashboard access granted
  it('TEST D: Approved Google user logs in again and successfully resolves to mapped TMP member', async () => {
    const check = await checkGoogleAllowlist(mainOrgId, testNewUserEmail);
    expect(check.allowed).toBe(true);
    expect(check.reason).toBe('APPROVED');
    expect(check.entry?.status).toBe('ACTIVE');
    expect(check.user?.id).toBe(ammarUser.id);
    expect(check.user?.fullName).toBe('Ammar Raza');
  });

  // TEST E: Admin rejects new account -> Access denied, status REJECTED, reason stored
  it('TEST E: Admin rejects access request with reason, preserving audit history', async () => {
    // 1. Create access request for rejected applicant
    const rejReq = await createAccessRequest(
      mainOrgId,
      'GOOGLE',
      testRejectedEmail,
      'Rejected Candidate',
      '192.168.1.51'
    );
    expect(rejReq.status).toBe('PENDING');

    // 2. Reject request in database transaction
    await prisma.$transaction(async (tx: any) => {
      await tx.authAccessRequest.update({
        where: { id: rejReq.id },
        data: {
          status: 'REJECTED',
          reviewedById: saiKiranUser.id,
          reviewedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          organization: { connect: { id: mainOrgId } },
          actor: { connect: { id: saiKiranUser.id } },
          action: 'ACCESS_REQUEST_REJECTED',
          entityType: 'AUTHENTICATION',
          entityId: rejReq.id,
          details: JSON.stringify({
            email: testRejectedEmail,
            provider: 'GOOGLE',
            reason: 'Applicant identity could not be verified by team lead.',
            requestId: rejReq.id,
          }),
        },
      });
    });

    const updated = await (prisma as any).authAccessRequest.findUnique({
      where: { id: rejReq.id },
    });
    expect(updated.status).toBe('REJECTED');
    expect(updated.reviewedById).toBe(saiKiranUser.id);
  });

  // TEST F: Rejected user tries again -> Still denied
  it('TEST F: Rejected user attempting login is still denied access', async () => {
    const check = await checkGoogleAllowlist(mainOrgId, testRejectedEmail);
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('NOT_IN_ALLOWLIST');
  });

  // TEST G: Admin revokes previously approved identity -> Future login denied
  it('TEST G: Admin revokes previously approved identity, blocking subsequent logins', async () => {
    // 1. Create an active entry
    await (prisma as any).organizationAuthAllowlist.upsert({
      where: {
        organizationId_provider_normalizedEmail: {
          organizationId: mainOrgId,
          provider: 'GOOGLE',
          normalizedEmail: normalizeEmail(testRevokedEmail),
        },
      },
      update: { status: 'ACTIVE' },
      create: {
        organizationId: mainOrgId,
        provider: 'GOOGLE',
        email: testRevokedEmail,
        normalizedEmail: normalizeEmail(testRevokedEmail),
        status: 'ACTIVE',
        userId: rajMangeUser.id,
      },
    });

    // Verify it is active
    let check = await checkGoogleAllowlist(mainOrgId, testRevokedEmail);
    expect(check.allowed).toBe(true);

    // 2. Admin revokes identity
    await (prisma as any).organizationAuthAllowlist.update({
      where: {
        organizationId_provider_normalizedEmail: {
          organizationId: mainOrgId,
          provider: 'GOOGLE',
          normalizedEmail: normalizeEmail(testRevokedEmail),
        },
      },
      data: { status: 'REVOKED' },
    });

    // 3. Login attempt now fails with REVOKED
    check = await checkGoogleAllowlist(mainOrgId, testRevokedEmail);
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('REVOKED');
  });

  // TEST H: Same Google account tries another organization -> Isolated
  it('TEST H: Google identity authorization is strictly isolated per organization', async () => {
    // Authorized in mainOrgId
    const checkMain = await checkGoogleAllowlist(mainOrgId, testNewUserEmail);
    expect(checkMain.allowed).toBe(true);

    // NOT authorized in otherOrgId
    const checkOther = await checkGoogleAllowlist(otherOrgId, testNewUserEmail);
    expect(checkOther.allowed).toBe(false);
    expect(checkOther.reason).toBe('NOT_IN_ALLOWLIST');
  });

  // TEST I: Existing approved user logs in -> No new access request created
  it('TEST I: Existing approved user login does not generate duplicate access requests', async () => {
    const existingApprovedEmail = 'saikirankurapti@gmail.com';
    const beforeCount = await (prisma as any).authAccessRequest.count({
      where: {
        organizationId: mainOrgId,
        email: normalizeEmail(existingApprovedEmail),
      },
    });

    const check = await checkGoogleAllowlist(mainOrgId, existingApprovedEmail);
    expect(check.allowed).toBe(true);
    expect(check.reason).toBe('APPROVED');

    const afterCount = await (prisma as any).authAccessRequest.count({
      where: {
        organizationId: mainOrgId,
        email: normalizeEmail(existingApprovedEmail),
      },
    });

    expect(afterCount).toBe(beforeCount);
  });

  // TEST J: Existing user identity approved twice -> Idempotent, no duplicates
  it('TEST J: Repeated approvals are idempotent without duplicate allowlist or user records', async () => {
    const norm = normalizeEmail(testNewUserEmail);

    // Second approval upsert
    await (prisma as any).organizationAuthAllowlist.upsert({
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
        email: testNewUserEmail,
        normalizedEmail: norm,
        status: 'ACTIVE',
        userId: ammarUser.id,
      },
    });

    const allowlistCount = await (prisma as any).organizationAuthAllowlist.count({
      where: {
        organizationId: mainOrgId,
        provider: 'GOOGLE',
        normalizedEmail: norm,
      },
    });
    expect(allowlistCount).toBe(1);

    const userCount = await prisma.user.count({
      where: { id: ammarUser.id, organizationId: mainOrgId },
    });
    expect(userCount).toBe(1);
  });
  // TEST K: Duplicate login attempts don't create duplicate AccessRequests
  it('TEST K: Duplicate Google login attempts for same unauthorized account deduplicate AccessRequests', async () => {
    const dupeEmail = 'duplicate.attempt@gmail.com';
    const normDupe = normalizeEmail(dupeEmail);

    // Clean up any prior record
    await (prisma as any).authAccessRequest.deleteMany({
      where: { organizationId: mainOrgId, email: normDupe },
    });

    // First login attempt
    const req1 = await createAccessRequest(mainOrgId, 'GOOGLE', dupeEmail, 'Duplicate Tester', '10.0.0.1');
    expect(req1.status).toBe('PENDING');

    // Second login attempt (should return the same record, not create a new one)
    const req2 = await createAccessRequest(mainOrgId, 'GOOGLE', dupeEmail, 'Duplicate Tester', '10.0.0.2');
    expect(req2.id).toBe(req1.id);
    expect(req2.status).toBe('PENDING');

    // Confirm only one record in DB
    const count = await (prisma as any).authAccessRequest.count({
      where: { organizationId: mainOrgId, email: normDupe, status: 'PENDING' },
    });
    expect(count).toBe(1);

    // Cleanup
    await (prisma as any).authAccessRequest.deleteMany({
      where: { organizationId: mainOrgId, email: normDupe },
    });
  });

  // TEST L: Rich Google metadata (Google sub, display name, given/family name, avatar) is saved
  it('TEST L: AccessRequest captures verified Google identity metadata and increments attemptCount', async () => {
    const richEmail = 'rich.candidate@gmail.com';
    const normRich = normalizeEmail(richEmail);

    await (prisma as any).authAccessRequest.deleteMany({
      where: { organizationId: mainOrgId, email: normRich },
    });

    const req1 = await createAccessRequest(mainOrgId, 'GOOGLE', richEmail, {
      name: 'John Doe',
      displayName: 'John Doe',
      givenName: 'John',
      familyName: 'Doe',
      profileImageUrl: 'https://lh3.googleusercontent.com/a/test-avatar',
      externalIdentityId: 'google-sub-9988776655',
      ip: '203.0.113.195',
      userAgent: 'Mozilla/5.0 ProductionClient',
    });

    expect(req1).toBeDefined();
    expect(req1.displayName).toBe('John Doe');
    expect(req1.givenName).toBe('John');
    expect(req1.familyName).toBe('Doe');
    expect(req1.externalIdentityId).toBe('google-sub-9988776655');
    expect(req1.profileImageUrl).toBe('https://lh3.googleusercontent.com/a/test-avatar');
    expect(req1.attemptCount).toBe(1);

    // Attempt login second time with same identity -> updates attemptCount and lastSeenAt
    const req2 = await createAccessRequest(mainOrgId, 'GOOGLE', richEmail, {
      displayName: 'John Doe',
      externalIdentityId: 'google-sub-9988776655',
      ip: '203.0.113.196',
    });

    expect(req2.id).toBe(req1.id);
    expect(req2.attemptCount).toBe(2);
    expect(req2.lastSeenAt).toBeDefined();

    // Cleanup
    await (prisma as any).authAccessRequest.deleteMany({
      where: { organizationId: mainOrgId, email: normRich },
    });
  });

  // TEST M: Google OAuth environment validation
  it('TEST M: Production OAuth environment validator flags missing configuration or localhost redirect', async () => {
    const { validateGoogleOAuthEnvironment } = await import('../services/googleConfigService.js');

    // Test with missing config in simulated production
    const prevEnv = process.env.GOOGLE_OAUTH_ENV;
    process.env.GOOGLE_OAUTH_ENV = 'production';

    const unconfigured = validateGoogleOAuthEnvironment({
      clientId: null,
      clientSecret: null,
      redirectUri: null,
      source: 'NONE',
      configured: false,
      environment: 'production',
    });
    expect(unconfigured.valid).toBe(false);
    expect(unconfigured.warnings.length).toBeGreaterThan(0);

    const localhostWarning = validateGoogleOAuthEnvironment({
      clientId: 'prod-client-id.apps.googleusercontent.com',
      clientSecret: 'prod-secret',
      redirectUri: 'http://localhost:5173/auth/google/callback',
      source: 'ENVIRONMENT',
      configured: true,
      environment: 'production',
    });
    expect(localhostWarning.valid).toBe(false);
    expect(localhostWarning.warnings.some((w: string) => w.includes('localhost'))).toBe(true);

    const validProd = validateGoogleOAuthEnvironment({
      clientId: 'prod-client-id.apps.googleusercontent.com',
      clientSecret: 'prod-secret',
      redirectUri: 'https://tmp.company.com/auth/google/callback',
      source: 'ENVIRONMENT',
      configured: true,
      environment: 'production',
    });
    expect(validProd.valid).toBe(true);
    expect(validProd.warnings.length).toBe(0);

    process.env.GOOGLE_OAUTH_ENV = prevEnv;
  });
});
