import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../prisma.js';
import { ensureTeamMemberForAllowlistEntry } from '../services/allowlistService.js';
import { canAccessAdmin, canAccessFinancials, canAccessPriceAllocation } from '../../../client/src/utils/rbac.js';

describe('Phase 49: Auto-provisioning Team Member for Authorized Allowlist Account', () => {
  let orgId: string;
  const testEmail = `phase49_autouser_${Date.now()}@example.com`;
  let createdAllowlistEntryId: string;

  beforeAll(async () => {
    const org = await prisma.organization.findFirst({ where: { slug: 'demo-startup' } });
    if (!org) throw new Error('demo-startup organization not found');
    orgId = org.id;

    // Create an ACTIVE allowlist entry WITHOUT a user
    const entry = await (prisma as any).organizationAuthAllowlist.create({
      data: {
        organizationId: orgId,
        provider: 'GOOGLE',
        email: testEmail,
        normalizedEmail: testEmail.toLowerCase(),
        status: 'ACTIVE',
        displayName: 'Test Phase49 Candidate',
      },
    });
    createdAllowlistEntryId = entry.id;
  });

  afterAll(async () => {
    try {
      const user = await prisma.user.findFirst({ where: { email: testEmail } });
      if (user) {
        await prisma.projectMember.deleteMany({ where: { userId: user.id } });
        await prisma.teamMember.deleteMany({ where: { userId: user.id } });
        await (prisma as any).organizationAuthAllowlist.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
      await (prisma as any).organizationAuthAllowlist.deleteMany({ where: { id: createdAllowlistEntryId } });
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr);
    }
  });

  it('automatically creates a User with role TEAM_MEMBER when missing', async () => {
    const user = await ensureTeamMemberForAllowlistEntry(createdAllowlistEntryId, {
      name: 'Test Phase49 Candidate',
      email: testEmail,
      picture: 'https://example.com/avatar.png',
    });

    expect(user).toBeDefined();
    expect(user.email).toBe(testEmail.toLowerCase());
    expect(user.fullName).toBe('Test Phase49 Candidate');
    expect(user.role).toBe('TEAM_MEMBER');
    expect(user.isActive).toBe(true);
    expect(user.status).toBe('ONLINE');

    const updatedEntry = await (prisma as any).organizationAuthAllowlist.findUnique({
      where: { id: createdAllowlistEntryId },
    });
    expect(updatedEntry.userId).toBe(user.id);
  });

  it('enrolls the auto-created user into default team and project', async () => {
    const user = await prisma.user.findFirst({ where: { email: testEmail } });
    expect(user).toBeDefined();

    const teamMemberships = await prisma.teamMember.findMany({
      where: { userId: user!.id },
      include: { team: true },
    });
    expect(teamMemberships.length).toBeGreaterThanOrEqual(1);

    const projectMemberships = await prisma.projectMember.findMany({
      where: { userId: user!.id },
      include: { project: true },
    });
    expect(projectMemberships.length).toBeGreaterThanOrEqual(1);
  });

  it('is strictly restricted from Admin, Pricing, and Price Allocation', async () => {
    const user = await prisma.user.findFirst({ where: { email: testEmail } });
    expect(user).toBeDefined();

    expect(canAccessAdmin(user!.role)).toBe(false);
    expect(canAccessFinancials(user!.role)).toBe(false);
    expect(canAccessPriceAllocation(user!.role)).toBe(false);
  });

  it('is idempotent and does not create duplicate users or memberships on subsequent calls', async () => {
    const initialUser = await prisma.user.findFirst({ where: { email: testEmail } });
    expect(initialUser).toBeDefined();

    const secondCallUser = await ensureTeamMemberForAllowlistEntry(createdAllowlistEntryId, {
      name: 'Test Phase49 Candidate',
      email: testEmail,
    });

    expect(secondCallUser.id).toBe(initialUser!.id);

    const userCount = await prisma.user.count({ where: { email: testEmail } });
    expect(userCount).toBe(1);
  });
});
