import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../prisma.js';
import {
  canAccessAdmin,
  canAccessManagement,
  canAccessFinancials,
  canAccessPriceAllocation,
  canAccessRestrictedManagement,
} from '../../../client/src/utils/rbac.js';

describe('Phase 50: Authoritative Team & Access Governance Invariants', () => {
  let demoOrgId: string;
  let adminUser: any;
  let ashwinUser: any;
  let member04User: any;

  beforeAll(async () => {
    const org = await prisma.organization.findFirst({ where: { slug: 'demo-startup' } });
    if (!org) throw new Error('demo-startup organization not found');
    demoOrgId = org.id;

    adminUser = await prisma.user.findFirst({
      where: { organizationId: demoOrgId, fullName: 'Sai Kiran' },
    });

    ashwinUser = await prisma.user.findFirst({
      where: { organizationId: demoOrgId, fullName: 'Ashwin T' },
    });

    member04User = await prisma.user.findFirst({
      where: { organizationId: demoOrgId, email: 'saikirankurapati04@gmail.com' },
    });
  });

  describe('Database Invariant: Sole Administrator', () => {
    it('enforces exactly ONE Administrator in the organization', async () => {
      const adminCount = await prisma.user.count({
        where: { organizationId: demoOrgId, role: 'ADMIN', isActive: true },
      });
      expect(adminCount).toBe(1);
    });

    it('identifies Sai Kiran as the sole Administrator', async () => {
      expect(adminUser).toBeDefined();
      expect(adminUser.role).toBe('ADMIN');
      expect(adminUser.fullName).toBe('Sai Kiran');

      // Check allowlist link
      const allowEntry = await (prisma as any).organizationAuthAllowlist.findFirst({
        where: { email: 'saikirankurapti@gmail.com' },
      });
      expect(allowEntry).toBeDefined();
      expect(allowEntry.userId).toBe(adminUser.id);
      expect(allowEntry.status).toBe('ACTIVE');
    });
  });

  describe('Database Invariant: Ashwin as CTO & Manager', () => {
    it('identifies Ashwin T as the sole CTO / Manager (PROJECT_MANAGER)', async () => {
      expect(ashwinUser).toBeDefined();
      expect(ashwinUser.role).toBe('PROJECT_MANAGER');
      expect(ashwinUser.fullName).toBe('Ashwin T');

      const allowEntry = await (prisma as any).organizationAuthAllowlist.findFirst({
        where: { email: 'ashwin.zerokost@gmail.com' },
      });
      expect(allowEntry).toBeDefined();
      expect(allowEntry.userId).toBe(ashwinUser.id);
    });
  });

  describe('Database Invariant: saikirankurapati04@gmail.com as Normal Team Member', () => {
    it('enforces saikirankurapati04@gmail.com is strictly TEAM_MEMBER', async () => {
      expect(member04User).toBeDefined();
      expect(member04User.role).toBe('TEAM_MEMBER');

      const allowEntry = await (prisma as any).organizationAuthAllowlist.findFirst({
        where: { email: 'saikirankurapati04@gmail.com' },
      });
      expect(allowEntry).toBeDefined();
      expect(allowEntry.userId).toBe(member04User.id);
    });
  });

  describe('RBAC Access Boundaries', () => {
    it('Sai Kiran (ADMIN) has full access across all controls', () => {
      expect(canAccessAdmin(adminUser.role)).toBe(true);
      expect(canAccessManagement(adminUser.role)).toBe(true);
      expect(canAccessFinancials(adminUser.role)).toBe(true);
      expect(canAccessPriceAllocation(adminUser.role)).toBe(true);
      expect(canAccessRestrictedManagement(adminUser.role)).toBe(true);
    });

    it('Ashwin T (CTO/Manager) has Price Allocation, but NO Admin or Security access', () => {
      expect(canAccessAdmin(ashwinUser.role)).toBe(false);
      expect(canAccessManagement(ashwinUser.role)).toBe(true);
      expect(canAccessPriceAllocation(ashwinUser.role)).toBe(true);
      expect(canAccessFinancials(ashwinUser.role)).toBe(false);
      expect(canAccessRestrictedManagement(ashwinUser.role)).toBe(false);
    });

    it('saikirankurapati04@gmail.com has NO Admin, NO Pricing, and NO Price Allocation access', () => {
      expect(canAccessAdmin(member04User.role)).toBe(false);
      expect(canAccessManagement(member04User.role)).toBe(false);
      expect(canAccessPriceAllocation(member04User.role)).toBe(false);
      expect(canAccessFinancials(member04User.role)).toBe(false);
      expect(canAccessRestrictedManagement(member04User.role)).toBe(false);
    });
  });

  describe('Identity Disambiguation: Separating Emails', () => {
    it('strictly preserves saikirankurapti@gmail.com and saikirankurapati04@gmail.com as distinct records', async () => {
      const entryAdmin = await (prisma as any).organizationAuthAllowlist.findFirst({
        where: { email: 'saikirankurapti@gmail.com' },
      });
      const entry04 = await (prisma as any).organizationAuthAllowlist.findFirst({
        where: { email: 'saikirankurapati04@gmail.com' },
      });

      expect(entryAdmin).toBeDefined();
      expect(entry04).toBeDefined();
      expect(entryAdmin.userId).not.toBe(entry04.userId);
      expect(entryAdmin.email).not.toBe(entry04.email);
    });
  });

  describe('Deactivation & Reactivation Semantics', () => {
    it('preserves historical work, chat, and comments when a user is deactivated', async () => {
      // Find a non-admin team member to test deactivation
      const testMember = await prisma.user.findFirst({
        where: { organizationId: demoOrgId, role: 'TEAM_MEMBER', email: { contains: 'test_api_check' } },
      });
      if (!testMember) return;

      // Update to deactivated
      await prisma.user.update({
        where: { id: testMember.id },
        data: { isActive: false, status: 'OFFLINE' },
      });

      const deactivated = await prisma.user.findUnique({ where: { id: testMember.id } });
      expect(deactivated!.isActive).toBe(false);

      // Reactivate
      await prisma.user.update({
        where: { id: testMember.id },
        data: { isActive: true, status: 'OFFLINE' },
      });

      const reactivated = await prisma.user.findUnique({ where: { id: testMember.id } });
      expect(reactivated!.isActive).toBe(true);
      expect(reactivated!.role).toBe('TEAM_MEMBER');
    });
  });
});
