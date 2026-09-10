import { describe, it, expect } from 'vitest';
import { canAccessAdmin, canAccessManagement, canAccessFinancials, canAccessPriceAllocation, canAccessRestrictedManagement, hasMinRole } from '../../../client/src/utils/rbac';

describe('Phase 48 Regression: Unauthorized Admin and Price Visibility', () => {
  // Identities:
  // 1. saikirankurapti@gmail.com -> Sai Kiran -> ADMIN ONLY
  // 2. ashwin.zerokost@gmail.com -> Ashwin T -> CTO + MANAGER (PROJECT_MANAGER)
  // 3. saikirankurapati04@gmail.com -> NOT ADMIN, NOT CTO, NOT MANAGER -> TEAM_MEMBER / UNAUTHORIZED
  // 4. Other team members -> TEAM_MEMBER

  const IDENTITY_ROLES: Record<string, string> = {
    'saikirankurapti@gmail.com': 'ADMIN',
    'ashwin.zerokost@gmail.com': 'PROJECT_MANAGER',
    'saikirankurapati04@gmail.com': 'TEAM_MEMBER',
    'raj.mange@demostartup.com': 'TEAM_MEMBER',
    'shashi.zerokost@gmail.com': 'TEAM_MEMBER',
  };

  describe('Primary Admin: saikirankurapti@gmail.com', () => {
    const role = IDENTITY_ROLES['saikirankurapti@gmail.com'];

    it('→ ADMIN = true', () => {
      expect(canAccessAdmin(role)).toBe(true);
      expect(hasMinRole(role, 'ADMIN')).toBe(true);
    });

    it('→ CTO/Manager = true (inherited by Admin weight)', () => {
      expect(canAccessManagement(role)).toBe(true);
    });

    it('→ Price Allocation = true', () => {
      expect(canAccessPriceAllocation(role)).toBe(true);
    });

    it('→ Commercial Pricing & Financials = true', () => {
      expect(canAccessFinancials(role)).toBe(true);
      expect(canAccessRestrictedManagement(role)).toBe(true);
    });
  });

  describe('CTO + Manager: ashwin.zerokost@gmail.com', () => {
    const role = IDENTITY_ROLES['ashwin.zerokost@gmail.com'];

    it('→ ADMIN = false', () => {
      expect(canAccessAdmin(role)).toBe(false);
      expect(hasMinRole(role, 'ADMIN')).toBe(false);
    });

    it('→ CTO = true & MANAGER = true (PROJECT_MANAGER)', () => {
      expect(canAccessManagement(role)).toBe(true);
      expect(hasMinRole(role, 'PROJECT_MANAGER')).toBe(true);
    });

    it('→ Price Allocation = true', () => {
      expect(canAccessPriceAllocation(role)).toBe(true);
    });

    it('→ Commercial Pricing & Restricted Admin Tabs = false', () => {
      expect(canAccessFinancials(role)).toBe(false);
      expect(canAccessRestrictedManagement(role)).toBe(false);
    });
  });

  describe('Non-Admin Identity: saikirankurapati04@gmail.com', () => {
    const role = IDENTITY_ROLES['saikirankurapati04@gmail.com'];

    it('→ ADMIN = false', () => {
      expect(canAccessAdmin(role)).toBe(false);
      expect(hasMinRole(role, 'ADMIN')).toBe(false);
    });

    it('→ CTO = false', () => {
      expect(canAccessManagement(role)).toBe(false);
    });

    it('→ MANAGER = false', () => {
      expect(hasMinRole(role, 'PROJECT_MANAGER')).toBe(false);
    });

    it('→ Price Allocation = false', () => {
      expect(canAccessPriceAllocation(role)).toBe(false);
    });

    it('→ Commercial Pricing & Restricted Tabs = false', () => {
      expect(canAccessFinancials(role)).toBe(false);
      expect(canAccessRestrictedManagement(role)).toBe(false);
    });
  });

  describe('Other Normal Team Members (e.g. Raj Mange, Shashi)', () => {
    const roles = [
      IDENTITY_ROLES['raj.mange@demostartup.com'],
      IDENTITY_ROLES['shashi.zerokost@gmail.com'],
    ];

    roles.forEach((role) => {
      it(`role ${role} → ADMIN = false, Price Allocation = false`, () => {
        expect(canAccessAdmin(role)).toBe(false);
        expect(canAccessManagement(role)).toBe(false);
        expect(canAccessPriceAllocation(role)).toBe(false);
        expect(canAccessFinancials(role)).toBe(false);
        expect(canAccessRestrictedManagement(role)).toBe(false);
      });
    });
  });

  describe('Fail-Closed Authorization Behavior', () => {
    it('null or undefined role produces NO access to any privileged feature', () => {
      expect(canAccessAdmin(null)).toBe(false);
      expect(canAccessAdmin(undefined)).toBe(false);
      expect(canAccessManagement(null)).toBe(false);
      expect(canAccessManagement(undefined)).toBe(false);
      expect(canAccessPriceAllocation(null)).toBe(false);
      expect(canAccessPriceAllocation(undefined)).toBe(false);
      expect(canAccessFinancials(null)).toBe(false);
      expect(canAccessFinancials(undefined)).toBe(false);
      expect(canAccessRestrictedManagement(null)).toBe(false);
      expect(canAccessRestrictedManagement(undefined)).toBe(false);
    });
  });
});
