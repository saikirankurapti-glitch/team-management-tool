/**
 * Centralized RBAC utilities for TMP
 * Role hierarchy and weights mirror server/src/middleware/auth.ts
 */

export type UserRole = 'OWNER' | 'ADMIN' | 'PROJECT_MANAGER' | 'TEAM_MEMBER' | 'VIEWER';

export const ROLE_WEIGHTS: Record<string, number> = {
  OWNER: 50,
  ADMIN: 40,
  PROJECT_MANAGER: 30,
  TEAM_MEMBER: 20,
  VIEWER: 10,
};

/**
 * Checks whether userRole has at least minRole weight
 */
export const hasMinRole = (userRole?: string | null, minRole: UserRole = 'TEAM_MEMBER'): boolean => {
  if (!userRole) return false;
  const userWeight = ROLE_WEIGHTS[userRole.toUpperCase()] || 0;
  const requiredWeight = ROLE_WEIGHTS[minRole] || 0;
  return userWeight >= requiredWeight;
};

/**
 * Full Organization Administration (Security, Allowlists, Billing, Developer Apps, Governance, Ops)
 */
export const canAccessAdmin = (userRole?: string | null): boolean => {
  return hasMinRole(userRole, 'ADMIN');
};

/**
 * Management Tier Access (Capacity Planning, Portfolio, Resource Planning, Team Workload management)
 */
export const canAccessManagement = (userRole?: string | null): boolean => {
  return hasMinRole(userRole, 'PROJECT_MANAGER');
};

/**
 * Commercial & Financial Access (Pricing models, rate cards, margins, scenarios, variance)
 * Restricted strictly to ADMIN
 */
export const canAccessFinancials = (userRole?: string | null): boolean => {
  return hasMinRole(userRole, 'ADMIN');
};

/**
 * Price Allocation / Resource Allocation with rates
 * Accessible to Management tier (ADMIN and PROJECT_MANAGER: Sai Kiran & Ashwin T)
 */
export const canAccessPriceAllocation = (userRole?: string | null): boolean => {
  return hasMinRole(userRole, 'PROJECT_MANAGER');
};

/**
 * Restricted Management tabs (Timeline, Estimation, WBS, Commercial Pricing, Scenarios, Planned vs Actual)
 * Restricted strictly to ADMIN
 */
export const canAccessRestrictedManagement = (userRole?: string | null): boolean => {
  return hasMinRole(userRole, 'ADMIN');
};
