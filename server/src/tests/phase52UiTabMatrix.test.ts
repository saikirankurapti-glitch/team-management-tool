import { describe, it, expect } from 'vitest';
import {
  canAccessAdmin,
  canAccessManagement,
  canAccessFinancials,
  canAccessPriceAllocation,
  canAccessRestrictedManagement,
} from '../client/src/utils/rbac';

describe('Phase 52 Final UI Tab Matrix Verification', () => {
  const SAI_ADMIN = 'ADMIN';
  const ASHWIN_CTO_MGR = 'PROJECT_MANAGER';
  const TEAM_MEMBER = 'TEAM_MEMBER';

  function getVisibleProjectTabs(role: string) {
    const canSeePriceAllocation = canAccessPriceAllocation(role);
    const canSeeRestrictedTabs = canAccessRestrictedManagement(role);

    const tabs = [
      { id: 'overview', visible: true },
      { id: 'timeline', visible: canSeeRestrictedTabs },
      { id: 'estimation', visible: canSeeRestrictedTabs },
      { id: 'wbs', visible: canSeeRestrictedTabs },
      { id: 'resources', visible: canSeePriceAllocation },
      { id: 'pricing', visible: canSeeRestrictedTabs },
      { id: 'scenarios', visible: canSeeRestrictedTabs },
      { id: 'variance', visible: canSeeRestrictedTabs },
      { id: 'development', visible: true },
    ];

    return tabs.filter((t) => t.visible).map((t) => t.id);
  }

  function getSidebarManagementLinks(role: string) {
    const isAdmin = canAccessAdmin(role);
    const isManager = canAccessManagement(role);

    const delivery = isManager ? ['Capacity'] : [];
    const engineering = isAdmin ? ['Developer Apps'] : [];
    const intelligence = isAdmin ? ['Governance', 'Ops Dashboard'] : [];
    const admin = isAdmin ? ['Security & Access', 'Billing & Plans', 'AI Configuration'] : [];

    return { delivery, engineering, intelligence, admin };
  }

  describe('1. Sai Kiran (ADMIN - saikirankurapti@gmail.com)', () => {
    it('sees ALL authorized project tabs', () => {
      const visibleTabs = getVisibleProjectTabs(SAI_ADMIN);
      expect(visibleTabs).toEqual([
        'overview',
        'timeline',
        'estimation',
        'wbs',
        'resources',
        'pricing',
        'scenarios',
        'variance',
        'development',
      ]);
    });

    it('sees ALL administration and management sidebar groups', () => {
      const sidebar = getSidebarManagementLinks(SAI_ADMIN);
      expect(sidebar.admin).toContain('Security & Access');
      expect(sidebar.admin).toContain('Billing & Plans');
      expect(sidebar.intelligence).toContain('Governance');
      expect(sidebar.intelligence).toContain('Ops Dashboard');
      expect(sidebar.delivery).toContain('Capacity');
    });
  });

  describe('2. Ashwin T (CTO + MANAGER - ashwin.zerokost@gmail.com)', () => {
    it('sees ONLY Price Allocation from restricted management tabs', () => {
      const visibleTabs = getVisibleProjectTabs(ASHWIN_CTO_MGR);
      expect(visibleTabs).toEqual(['overview', 'resources', 'development']);

      // Specifically verify that other restricted tabs are NOT visible
      expect(visibleTabs).not.toContain('timeline');
      expect(visibleTabs).not.toContain('estimation');
      expect(visibleTabs).not.toContain('wbs');
      expect(visibleTabs).not.toContain('pricing');
      expect(visibleTabs).not.toContain('scenarios');
      expect(visibleTabs).not.toContain('variance');
    });

    it('does NOT see Administration, Security, Billing, Governance, or Ops in Sidebar', () => {
      const sidebar = getSidebarManagementLinks(ASHWIN_CTO_MGR);
      expect(sidebar.admin).toHaveLength(0);
      expect(sidebar.intelligence).toHaveLength(0);
      expect(sidebar.engineering).toHaveLength(0);
      // But has delivery capacity
      expect(sidebar.delivery).toContain('Capacity');
    });
  });

  describe('3. Regular Team Members (e.g. saikirankurapati04@gmail.com, Raj Mange, Shashi)', () => {
    it('sees ONLY standard execution tabs (overview & development)', () => {
      const visibleTabs = getVisibleProjectTabs(TEAM_MEMBER);
      expect(visibleTabs).toEqual(['overview', 'development']);

      expect(visibleTabs).not.toContain('resources');
      expect(visibleTabs).not.toContain('pricing');
      expect(visibleTabs).not.toContain('timeline');
      expect(visibleTabs).not.toContain('estimation');
      expect(visibleTabs).not.toContain('wbs');
      expect(visibleTabs).not.toContain('scenarios');
      expect(visibleTabs).not.toContain('variance');
    });

    it('does NOT see Capacity, Administration, Security, Billing, Governance, or Ops in Sidebar', () => {
      const sidebar = getSidebarManagementLinks(TEAM_MEMBER);
      expect(sidebar.delivery).toHaveLength(0);
      expect(sidebar.admin).toHaveLength(0);
      expect(sidebar.intelligence).toHaveLength(0);
      expect(sidebar.engineering).toHaveLength(0);
    });
  });
});
