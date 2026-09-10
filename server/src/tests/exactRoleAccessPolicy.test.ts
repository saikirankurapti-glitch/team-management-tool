import { describe, it, expect } from 'vitest';
import { canAccessAdmin, canAccessManagement, canAccessFinancials, canAccessPriceAllocation, canAccessRestrictedManagement, hasMinRole } from '../../../client/src/utils/rbac';

describe('Phase 47 Authoritative Access Matrix', () => {
  // Exact matrix specification:
  // Sai Kiran (Admin): Admin Area=YES, Security=YES, Pricing=YES, Price Allocation=YES
  // Ashwin T (CTO / Manager): Admin Area=NO, Security=NO, Pricing=NO, Price Allocation=YES
  // All other users (Team Member): Admin Area=NO, Security=NO, Pricing=NO, Price Allocation=NO

  const ADMIN_ROLE = 'ADMIN';
  const MANAGER_ROLE = 'PROJECT_MANAGER';
  const TEAM_MEMBER_ROLE = 'TEAM_MEMBER';

  describe('Sai Kiran (ADMIN)', () => {
    it('has full Admin Area access', () => {
      expect(canAccessAdmin(ADMIN_ROLE)).toBe(true);
    });

    it('has full Security & Governance access', () => {
      expect(hasMinRole(ADMIN_ROLE, 'ADMIN')).toBe(true);
    });

    it('has Commercial Pricing access', () => {
      expect(canAccessFinancials(ADMIN_ROLE)).toBe(true);
    });

    it('has Price Allocation access', () => {
      expect(canAccessPriceAllocation(ADMIN_ROLE)).toBe(true);
    });

    it('has access to Restricted Management tabs (Timeline, Estimation, WBS, Pricing, Scenarios, Variance)', () => {
      expect(canAccessRestrictedManagement(ADMIN_ROLE)).toBe(true);
    });
  });

  describe('Ashwin T (CTO / MANAGER: PROJECT_MANAGER)', () => {
    it('must NOT have Admin Area access', () => {
      expect(canAccessAdmin(MANAGER_ROLE)).toBe(false);
    });

    it('must NOT have Security & Governance access', () => {
      expect(hasMinRole(MANAGER_ROLE, 'ADMIN')).toBe(false);
    });

    it('must NOT have Commercial Pricing / Rate Cards / Scenarios access', () => {
      expect(canAccessFinancials(MANAGER_ROLE)).toBe(false);
    });

    it('must NOT have access to other Restricted Management tabs', () => {
      expect(canAccessRestrictedManagement(MANAGER_ROLE)).toBe(false);
    });

    it('has access ONLY to Price Allocation among restricted management features', () => {
      expect(canAccessPriceAllocation(MANAGER_ROLE)).toBe(true);
    });
  });

  describe('All other team members (TEAM_MEMBER)', () => {
    it('must NOT have Admin Area access', () => {
      expect(canAccessAdmin(TEAM_MEMBER_ROLE)).toBe(false);
    });

    it('must NOT have Security access', () => {
      expect(hasMinRole(TEAM_MEMBER_ROLE, 'ADMIN')).toBe(false);
    });

    it('must NOT have Pricing access', () => {
      expect(canAccessFinancials(TEAM_MEMBER_ROLE)).toBe(false);
    });

    it('must NOT have Price Allocation access', () => {
      expect(canAccessPriceAllocation(TEAM_MEMBER_ROLE)).toBe(false);
    });

    it('must NOT have Restricted Management access', () => {
      expect(canAccessRestrictedManagement(TEAM_MEMBER_ROLE)).toBe(false);
    });
  });
});
