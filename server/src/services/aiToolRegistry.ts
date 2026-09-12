import { prisma } from '../prisma.js';
import { decryptToken, fetchFromGitHubApi } from './githubService.js';

export interface ToolContext {
  userId: string;
  organizationId: string;
  userRole?: string;
}

// ─── Role Weights ─────────────────────────────────────────────────────────────
const ROLE_WEIGHTS: Record<string, number> = {
  OWNER: 50, ADMIN: 40, PROJECT_MANAGER: 30, TEAM_MEMBER: 20, VIEWER: 10,
};
const roleWeight = (role?: string) => ROLE_WEIGHTS[role || 'TEAM_MEMBER'] || 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const findUser = async (identifier: string, orgId: string) => {
  if (!identifier) return null;
  return prisma.user.findFirst({
    where: {
      organizationId: orgId,
      OR: [
        { fullName: { contains: identifier } },
        { email: { contains: identifier } },
      ],
    },
  });
};

const findProject = async (identifier: string, orgId: string) => {
  if (!identifier) return null;
  return prisma.project.findFirst({
    where: {
      organizationId: orgId,
      OR: [
        { name: { contains: identifier } },
        { key: { contains: identifier } },
      ],
    },
  });
};

/**
 * Calculate workload for a set of work items.
 * Uses estimatedHours if set; defaults to 4h per item.
 * Weekly capacity default = 40h.
 */
const calculateWorkload = (items: any[]) => {
  const activeItems = items.filter((i: any) => i.status !== 'DONE' && i.status !== 'ARCHIVED');
  const estimatedHours = activeItems.reduce((acc: number, i: any) => acc + (i.estimatedHours || 4), 0);
  const capacity = 40;
  const utilization = Math.round((estimatedHours / capacity) * 100);
  return {
    activeWorkCount: activeItems.length,
    allocatedHours: estimatedHours,
    weeklyCapacityHours: capacity,
    utilization: `${utilization}%`,
    utilizationPct: utilization,
    status: utilization > 100 ? 'OVERLOADED' : utilization < 20 ? 'UNDERUTILIZED' : 'HEALTHY',
  };
};

// ─── Tool Registry ────────────────────────────────────────────────────────────
export const aiToolRegistry = {

  // ═══════════════════════════════════════════════════════════════
  // TEAM TOOLS
  // ═══════════════════════════════════════════════════════════════

  /** List all active team members. */
  getTeamMembers: async (_args: Record<string, never>, ctx: ToolContext) => {
    const users = await prisma.user.findMany({
      where: { organizationId: ctx.organizationId, isActive: true },
      select: { fullName: true, role: true, department: true, jobTitle: true, status: true },
      orderBy: { fullName: 'asc' },
    });
    return { members: users, totalCount: users.length, source: 'TMP Team Members' };
  },

  /** Calculate active workload and utilization for every team member. */
  getTeamWorkload: async (_args: Record<string, never>, ctx: ToolContext) => {
    const users = await prisma.user.findMany({
      where: { organizationId: ctx.organizationId, isActive: true },
      include: {
        assignedItems: { where: { status: { not: 'DONE' } }, select: { status: true, estimatedHours: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    const workloadData = users.map(u => ({
      member: u.fullName,
      role: u.role,
      ...calculateWorkload(u.assignedItems),
    })).sort((a, b) => b.utilizationPct - a.utilizationPct);

    return { workload: workloadData, source: 'TMP Work Items + Resource Allocation' };
  },

  /** Alias for getTeamWorkload — returns capacity framing. */
  getTeamCapacity: async (_args: Record<string, never>, ctx: ToolContext) => {
    return aiToolRegistry.getTeamWorkload({} as any, ctx);
  },

  /** Members with available (low utilization) capacity. */
  getTeamAvailability: async (_args: Record<string, never>, ctx: ToolContext) => {
    const workloadResult = await aiToolRegistry.getTeamWorkload({} as any, ctx);
    const available = (workloadResult as any).workload.filter((m: any) =>
      m.utilizationPct < 60
    );
    return { availableMembers: available, source: 'TMP Work Items' };
  },

  /** All active work items assigned to a specific member. */
  getMemberAssignments: async (args: { memberIdentifier: string }, ctx: ToolContext) => {
    const user = await findUser(args.memberIdentifier, ctx.organizationId);
    if (!user) return { error: `No team member matching '${args.memberIdentifier}' found in TMP.` };

    const items = await prisma.workItem.findMany({
      where: { assigneeId: user.id, status: { not: 'DONE' } },
      include: { project: { select: { name: true, key: true } } },
      orderBy: { priority: 'asc' },
      take: 30,
    });

    const workload = calculateWorkload(items);
    return {
      member: user.fullName,
      role: user.role,
      workload,
      assignments: items.map(i => ({
        id: i.humanId,
        title: i.title,
        type: i.type,
        status: i.status,
        priority: i.priority,
        project: i.project.name,
        dueDate: i.dueDate,
      })),
      source: 'TMP Work Items',
    };
  },

  /** Projects a specific team member is allocated to. */
  getMemberProjects: async (args: { memberIdentifier: string }, ctx: ToolContext) => {
    const user = await findUser(args.memberIdentifier, ctx.organizationId);
    if (!user) return { error: `No team member matching '${args.memberIdentifier}' found in TMP.` };

    const memberships = await prisma.projectMember.findMany({
      where: { userId: user.id },
      include: { project: { select: { name: true, key: true, status: true, health: true } } },
    });

    // Also check resource allocations
    const allocations = await prisma.resourceAllocation.findMany({
      where: { userId: user.id, organizationId: ctx.organizationId },
      include: { project: { select: { name: true, key: true, status: true } } },
    });

    const projectsViaAlloc = allocations.map(a => ({
      name: a.project.name, key: a.project.key, status: a.project.status,
      allocationPct: a.allocationPercentage, via: 'resource_allocation',
    }));

    return {
      member: user.fullName,
      projectMemberships: memberships.map(m => ({ name: m.project.name, key: m.project.key, status: m.project.status, health: m.project.health })),
      resourceAllocations: projectsViaAlloc,
      source: 'TMP Project Members + Resource Allocation',
    };
  },

  /** Overdue work items for a specific member. */
  getMemberOverdueWork: async (args: { memberIdentifier: string }, ctx: ToolContext) => {
    const user = await findUser(args.memberIdentifier, ctx.organizationId);
    if (!user) return { error: `No team member matching '${args.memberIdentifier}' found in TMP.` };

    const items = await prisma.workItem.findMany({
      where: {
        assigneeId: user.id,
        status: { notIn: ['DONE', 'ARCHIVED'] },
        dueDate: { lt: new Date() },
      },
      include: { project: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
    });

    return {
      member: user.fullName,
      overdueCount: items.length,
      overdueItems: items.map(i => ({
        id: i.humanId,
        title: i.title,
        status: i.status,
        priority: i.priority,
        dueDate: i.dueDate,
        project: i.project.name,
      })),
      source: 'TMP Work Items',
    };
  },

  /** Blocked work items for a specific member. */
  getMemberBlockedWork: async (args: { memberIdentifier: string }, ctx: ToolContext) => {
    const user = await findUser(args.memberIdentifier, ctx.organizationId);
    if (!user) return { error: `No team member matching '${args.memberIdentifier}' found in TMP.` };

    const items = await prisma.workItem.findMany({
      where: { assigneeId: user.id, status: 'BLOCKED' },
      include: { project: { select: { name: true } } },
    });

    return {
      member: user.fullName,
      blockedCount: items.length,
      blockedItems: items.map(i => ({
        id: i.humanId,
        title: i.title,
        blockedReason: i.blockedReason,
        project: i.project.name,
      })),
      source: 'TMP Work Items',
    };
  },

  // ═══════════════════════════════════════════════════════════════
  // PROJECT TOOLS
  // ═══════════════════════════════════════════════════════════════

  /** List all non-archived projects. */
  getProjects: async (_args: Record<string, never>, ctx: ToolContext) => {
    const projects = await prisma.project.findMany({
      where: { organizationId: ctx.organizationId, status: { not: 'ARCHIVED' } },
      select: { key: true, name: true, status: true, health: true, targetDate: true },
      orderBy: { name: 'asc' },
    });
    return { projects, totalCount: projects.length, source: 'TMP Projects' };
  },

  /** High-level summary of all active projects. */
  getProjectSummary: async (_args: Record<string, never>, ctx: ToolContext) => {
    const projects = await prisma.project.findMany({
      where: { organizationId: ctx.organizationId, status: { not: 'ARCHIVED' } },
      include: { workItems: { select: { status: true, dueDate: true } } },
      orderBy: { name: 'asc' },
    });

    const now = new Date();
    const summary = projects.map(p => {
      const open = p.workItems.filter(i => !['DONE', 'ARCHIVED'].includes(i.status)).length;
      const overdue = p.workItems.filter(i => !['DONE', 'ARCHIVED'].includes(i.status) && i.dueDate && new Date(i.dueDate) < now).length;
      const blocked = p.workItems.filter(i => i.status === 'BLOCKED').length;
      const total = p.workItems.length;
      const done = p.workItems.filter(i => i.status === 'DONE').length;
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;
      return {
        project: p.name,
        key: p.key,
        status: p.status,
        health: p.health,
        progress: `${progress}%`,
        openWorkItems: open,
        overdueItems: overdue,
        blockedItems: blocked,
        targetDate: p.targetDate,
      };
    });

    return { projects: summary, totalActiveProjects: summary.length, source: 'TMP Projects + Work Items' };
  },

  /** Full details for a specific project. */
  getProjectDetails: async (args: { projectIdentifier: string }, ctx: ToolContext) => {
    const project = await findProject(args.projectIdentifier, ctx.organizationId);
    if (!project) return { error: `Project '${args.projectIdentifier}' not found in TMP.` };

    const details = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        owner: { select: { fullName: true, role: true } },
        members: { include: { user: { select: { fullName: true, role: true } } } },
        workItems: { select: { status: true, type: true, dueDate: true, estimatedHours: true } },
        milestones: { orderBy: { targetDate: 'asc' } },
        riskObservations: { where: { status: 'ACTIVE' }, select: { title: true, severity: true } },
      },
    });
    if (!details) return { error: 'Project details not found.' };

    const now = new Date();
    const allItems = details.workItems;
    const openItems = allItems.filter(i => !['DONE', 'ARCHIVED'].includes(i.status));
    const done = allItems.filter(i => i.status === 'DONE').length;
    const blocked = allItems.filter(i => i.status === 'BLOCKED').length;
    const overdue = openItems.filter(i => i.dueDate && new Date(i.dueDate) < now).length;
    const totalHours = openItems.reduce((s, i) => s + (i.estimatedHours || 0), 0);
    const progress = allItems.length > 0 ? Math.round((done / allItems.length) * 100) : 0;

    return {
      name: details.name,
      key: details.key,
      description: details.description,
      status: details.status,
      health: details.health,
      owner: details.owner.fullName,
      startDate: details.startDate,
      targetDate: details.targetDate,
      plannedStartDate: details.plannedStartDate,
      plannedEndDate: details.plannedEndDate,
      progress: `${progress}%`,
      teamMembers: details.members.map(m => ({ name: m.user.fullName, role: m.user.role })),
      workItemSummary: {
        total: allItems.length,
        open: openItems.length,
        done,
        blocked,
        overdue,
        estimatedRemainingHours: totalHours,
      },
      milestones: details.milestones.map(m => ({
        name: m.name,
        status: m.status,
        targetDate: m.targetDate,
        description: m.description,
      })),
      activeRisks: details.riskObservations.map(r => ({ title: r.title, severity: r.severity })),
      source: 'TMP Projects',
    };
  },

  /** Members assigned to a specific project. */
  getProjectMembers: async (args: { projectIdentifier: string }, ctx: ToolContext) => {
    const project = await findProject(args.projectIdentifier, ctx.organizationId);
    if (!project) return { error: `Project '${args.projectIdentifier}' not found in TMP.` };

    const members = await prisma.projectMember.findMany({
      where: { projectId: project.id },
      include: { user: { select: { fullName: true, role: true, department: true, jobTitle: true } } },
    });

    // Also include resource allocations for this project
    const allocations = await prisma.resourceAllocation.findMany({
      where: { projectId: project.id, organizationId: ctx.organizationId },
      include: { user: { select: { fullName: true } } },
    });

    return {
      project: project.name,
      memberCount: members.length,
      members: members.map(m => ({
        name: m.user.fullName,
        role: m.user.role,
        department: m.user.department,
        jobTitle: m.user.jobTitle,
      })),
      resourceAllocations: allocations.map(a => ({
        name: a.user.fullName,
        projectRole: a.role,
        skill: a.skill,
        allocationPct: a.allocationPercentage,
        allocatedHours: a.allocatedHours,
        startDate: a.startDate,
        endDate: a.endDate,
      })),
      source: 'TMP Project Members + Resource Allocation',
    };
  },

  /** Workload distribution within a specific project. */
  getProjectWorkload: async (args: { projectIdentifier: string }, ctx: ToolContext) => {
    const project = await findProject(args.projectIdentifier, ctx.organizationId);
    if (!project) return { error: `Project '${args.projectIdentifier}' not found in TMP.` };

    const items = await prisma.workItem.findMany({
      where: { projectId: project.id, status: { not: 'DONE' } },
      include: { assignee: { select: { fullName: true } } },
    });

    // Group by assignee
    const byAssignee: Record<string, any[]> = {};
    for (const item of items) {
      const name = item.assignee?.fullName || 'Unassigned';
      if (!byAssignee[name]) byAssignee[name] = [];
      byAssignee[name].push(item);
    }

    const workload = Object.entries(byAssignee).map(([member, memberItems]) => ({
      member,
      ...calculateWorkload(memberItems),
    })).sort((a, b) => b.utilizationPct - a.utilizationPct);

    return { project: project.name, workload, source: 'TMP Work Items' };
  },

  /** Milestones for a specific project. */
  getProjectMilestones: async (args: { projectIdentifier: string }, ctx: ToolContext) => {
    const project = await findProject(args.projectIdentifier, ctx.organizationId);
    if (!project) return { error: `Project '${args.projectIdentifier}' not found in TMP.` };

    const milestones = await prisma.milestone.findMany({
      where: { projectId: project.id },
      include: { owner: { select: { fullName: true } } },
      orderBy: { targetDate: 'asc' },
    });

    return {
      project: project.name,
      milestoneCount: milestones.length,
      milestones: milestones.map(m => ({
        name: m.name,
        status: m.status,
        targetDate: m.targetDate,
        plannedDate: m.plannedDate,
        actualDate: m.actualDate,
        description: m.description,
        owner: m.owner?.fullName,
      })),
      source: 'TMP Milestones',
    };
  },

  /** Dependency work items for a specific project. */
  getProjectDependencies: async (args: { projectIdentifier: string }, ctx: ToolContext) => {
    const project = await findProject(args.projectIdentifier, ctx.organizationId);
    if (!project) return { error: `Project '${args.projectIdentifier}' not found in TMP.` };

    const items = await prisma.workItem.findMany({
      where: { projectId: project.id },
      include: {
        blockingItems: {
          include: { blockedItem: { select: { humanId: true, title: true, status: true } } },
        },
        blockedByItems: {
          include: { blockingItem: { select: { humanId: true, title: true, status: true } } },
        },
      },
      take: 30,
    });

    const withDeps = items.filter(i => i.blockingItems.length > 0 || i.blockedByItems.length > 0);
    return {
      project: project.name,
      dependencyCount: withDeps.length,
      dependencies: withDeps.map(i => ({
        item: i.humanId,
        title: i.title,
        status: i.status,
        blocks: i.blockingItems.map(d => ({ id: d.blockedItem.humanId, title: d.blockedItem.title, status: d.blockedItem.status })),
        blockedBy: i.blockedByItems.map(d => ({ id: d.blockingItem.humanId, title: d.blockingItem.title, status: d.blockingItem.status })),
      })),
      source: 'TMP Work Item Dependencies',
    };
  },

  /** Timeline information for a specific project. */
  getProjectTimeline: async (args: { projectIdentifier: string }, ctx: ToolContext) => {
    const project = await findProject(args.projectIdentifier, ctx.organizationId);
    if (!project) return { error: `Project '${args.projectIdentifier}' not found in TMP.` };

    const details = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        milestones: { orderBy: { targetDate: 'asc' } },
        sprints: { where: { status: { in: ['ACTIVE', 'COMPLETED'] } }, orderBy: { endDate: 'desc' }, take: 5 },
      },
    });
    if (!details) return { error: 'Project not found.' };

    return {
      project: project.name,
      status: details.status,
      startDate: details.startDate,
      targetDate: details.targetDate,
      plannedStartDate: details.plannedStartDate,
      plannedEndDate: details.plannedEndDate,
      actualStartDate: details.actualStartDate,
      actualEndDate: details.actualEndDate,
      milestones: details.milestones.map(m => ({
        name: m.name, status: m.status, targetDate: m.targetDate,
      })),
      recentSprints: details.sprints.map(s => ({
        name: s.name, status: s.status, startDate: s.startDate, endDate: s.endDate,
      })),
      source: 'TMP Projects + Milestones + Sprints',
    };
  },

  /** Resource allocations for a project. RBAC: PROJECT_MANAGER+ only. */
  getProjectResourceAllocation: async (args: { projectIdentifier: string }, ctx: ToolContext) => {
    if (roleWeight(ctx.userRole) < ROLE_WEIGHTS.PROJECT_MANAGER) {
      return { error: 'Access Denied: Resource allocation data is restricted to Project Managers and Administrators.' };
    }

    const project = await findProject(args.projectIdentifier, ctx.organizationId);
    if (!project) return { error: `Project '${args.projectIdentifier}' not found in TMP.` };

    const allocations = await prisma.resourceAllocation.findMany({
      where: { projectId: project.id, organizationId: ctx.organizationId },
      include: { user: { select: { fullName: true, role: true } } },
      orderBy: { allocationPercentage: 'desc' },
    });

    return {
      project: project.name,
      allocationCount: allocations.length,
      totalAllocatedHours: allocations.reduce((s, a) => s + a.allocatedHours, 0),
      allocations: allocations.map(a => ({
        member: a.user.fullName,
        role: a.role,
        skill: a.skill,
        allocationPct: a.allocationPercentage,
        allocatedHours: a.allocatedHours,
        startDate: a.startDate,
        endDate: a.endDate,
      })),
      source: 'TMP Resource Allocation',
    };
  },

  /** Pricing/budget data for a project. RBAC: PROJECT_MANAGER+ only. */
  getProjectPricing: async (args: { projectIdentifier: string }, ctx: ToolContext) => {
    if (roleWeight(ctx.userRole) < ROLE_WEIGHTS.PROJECT_MANAGER) {
      return { error: 'Access Denied: Pricing and commercial information is restricted to Project Managers and Administrators.' };
    }

    const project = await findProject(args.projectIdentifier, ctx.organizationId);
    if (!project) return { error: `Project '${args.projectIdentifier}' not found in TMP.` };

    const pricing = await prisma.projectPricing.findUnique({ where: { projectId: project.id } });
    if (!pricing) return { project: project.name, message: 'No pricing data configured for this project.', source: 'TMP Project Pricing' };

    return {
      project: project.name,
      pricingModel: pricing.pricingModel,
      currency: pricing.currency,
      estimatedInternalCost: pricing.estimatedInternalCost,
      grossPrice: pricing.grossPrice,
      finalPrice: pricing.finalPrice,
      markupPercentage: pricing.markupPercentage,
      contingencyPercentage: pricing.contingencyPercentage,
      notes: pricing.notes,
      source: 'TMP Project Pricing',
    };
  },

  /** Risks and blocked items for a project. */
  getProjectRisks: async (args: { projectIdentifier: string }, ctx: ToolContext) => {
    const project = await findProject(args.projectIdentifier, ctx.organizationId);
    if (!project) return { error: `Project '${args.projectIdentifier}' not found in TMP.` };

    const risks = await prisma.riskObservation.findMany({
      where: { projectId: project.id, status: 'ACTIVE' },
      orderBy: { severity: 'asc' },
    });

    const blockedItems = await prisma.workItem.findMany({
      where: { projectId: project.id, status: 'BLOCKED' },
      select: { humanId: true, title: true, blockedReason: true, assignee: { select: { fullName: true } } },
    });

    return {
      project: project.name,
      recordedRisks: risks.map(r => ({
        title: r.title,
        severity: r.severity,
        reason: r.reason,
        source: r.sourceMetric,
        detectedAt: r.detectedAt,
      })),
      blockedWorkItems: blockedItems.map(i => ({
        id: i.humanId,
        title: i.title,
        blockedReason: i.blockedReason,
        assignee: (i as any).assignee?.fullName || 'Unassigned',
      })),
      source: 'TMP Risk Engine + Work Items',
    };
  },

  /** Knowledge pages and decisions for a specific project. */
  getProjectDocumentation: async (args: { projectIdentifier: string }, ctx: ToolContext) => {
    const project = await findProject(args.projectIdentifier, ctx.organizationId);
    if (!project) return { error: `Project '${args.projectIdentifier}' not found in TMP.` };

    const [pages, decisions] = await Promise.all([
      prisma.knowledgePage.findMany({
        where: { projectId: project.id, organizationId: ctx.organizationId },
        select: { title: true, category: true, updatedAt: true, content: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      prisma.decisionRecord.findMany({
        where: { projectId: project.id, organizationId: ctx.organizationId },
        select: { title: true, status: true, decision: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      project: project.name,
      knowledgePages: pages.map(p => ({
        title: p.title,
        category: p.category,
        lastUpdated: p.updatedAt,
        snippet: p.content?.substring(0, 200),
      })),
      decisions: decisions.map(d => ({
        title: d.title,
        status: d.status,
        decision: d.decision?.substring(0, 200),
        createdAt: d.createdAt,
      })),
      source: 'TMP Knowledge Hub + Decision Log',
    };
  },

  /** List knowledge pages for a project. */
  listProjectDocuments: async (args: { projectIdentifier: string }, ctx: ToolContext) => {
    return aiToolRegistry.getProjectDocumentation(args, ctx);
  },

  /** Comprehensive management summary across the whole organization. */
  getManagementSummary: async (_args: Record<string, never>, ctx: ToolContext) => {
    const [userCount, workloadResult, projectSummaryResult, activeSprints] = await Promise.all([
      prisma.user.count({ where: { organizationId: ctx.organizationId, isActive: true } }),
      aiToolRegistry.getTeamWorkload({} as any, ctx),
      aiToolRegistry.getProjectSummary({} as any, ctx),
      prisma.sprint.findMany({
        where: { project: { organizationId: ctx.organizationId }, status: 'ACTIVE' },
        include: { workItems: { select: { status: true, storyPoints: true } } },
        take: 10,
      }),
    ]);

    const workload = (workloadResult as any).workload || [];
    const projects = (projectSummaryResult as any).projects || [];

    const sprintData = activeSprints.map(s => {
      const total = s.workItems.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
      const done = s.workItems.filter(i => i.status === 'DONE').reduce((sum, i) => sum + (i.storyPoints || 0), 0);
      return {
        name: s.name,
        completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
        totalItems: s.workItems.length,
        doneItems: s.workItems.filter(i => i.status === 'DONE').length,
      };
    });

    return {
      team: {
        totalMembers: userCount,
        overloaded: workload.filter((w: any) => w.status === 'OVERLOADED').map((w: any) => w.member),
        underutilized: workload.filter((w: any) => w.status === 'UNDERUTILIZED').map((w: any) => w.member),
        healthy: workload.filter((w: any) => w.status === 'HEALTHY').length,
      },
      projects: {
        total: projects.length,
        atRisk: projects.filter((p: any) => p.health === 'AT_RISK').map((p: any) => p.project),
        critical: projects.filter((p: any) => p.health === 'CRITICAL').map((p: any) => p.project),
        withBlockers: projects.filter((p: any) => p.blockedItems > 0).map((p: any) => p.project),
        withOverdue: projects.filter((p: any) => p.overdueItems > 0).map((p: any) => p.project),
        totalBlockedItems: projects.reduce((acc: number, p: any) => acc + p.blockedItems, 0),
        totalOverdueItems: projects.reduce((acc: number, p: any) => acc + p.overdueItems, 0),
      },
      delivery: {
        activeSprints: sprintData,
        avgSprintCompletion: sprintData.length > 0
          ? Math.round(sprintData.reduce((s, d) => s + d.completionPct, 0) / sprintData.length)
          : null,
      },
      source: 'TMP Projects + Team + Sprints',
    };
  },

  // ═══════════════════════════════════════════════════════════════
  // WORK ITEM TOOLS
  // ═══════════════════════════════════════════════════════════════

  /** Generic work item query with filters. */
  getWorkItems: async (args: { type?: string; statusCategory?: string; limit?: number }, ctx: ToolContext) => {
    const where: any = { project: { organizationId: ctx.organizationId } };
    if (args.type) where.type = args.type.toUpperCase();

    const now = new Date();
    if (args.statusCategory === 'OVERDUE') {
      where.status = { notIn: ['DONE', 'ARCHIVED'] };
      where.dueDate = { lt: now };
    } else if (args.statusCategory === 'BLOCKED') {
      where.status = 'BLOCKED';
    } else if (args.statusCategory === 'DONE') {
      where.status = 'DONE';
    } else if (args.statusCategory === 'ACTIVE') {
      where.status = { notIn: ['DONE', 'BACKLOG', 'ARCHIVED'] };
    }

    const items = await prisma.workItem.findMany({
      where,
      include: {
        assignee: { select: { fullName: true } },
        project: { select: { key: true, name: true } },
      },
      take: args.limit || 25,
      orderBy: { updatedAt: 'desc' },
    });

    return {
      totalCount: items.length,
      items: items.map(i => ({
        id: i.humanId,
        title: i.title,
        type: i.type,
        status: i.status,
        priority: i.priority,
        assignee: i.assignee?.fullName || 'Unassigned',
        project: i.project.name,
        dueDate: i.dueDate,
      })),
      source: 'TMP Work Items',
    };
  },

  /** All open bugs. */
  getBugs: async (args: { limit?: number }, ctx: ToolContext) => {
    return aiToolRegistry.getWorkItems({ type: 'BUG', ...args }, ctx);
  },

  /** All blocked work items. */
  getBlockedItems: async (args: { limit?: number }, ctx: ToolContext) => {
    return aiToolRegistry.getWorkItems({ statusCategory: 'BLOCKED', ...args }, ctx);
  },

  /** All overdue work items. */
  getOverdueItems: async (args: { limit?: number }, ctx: ToolContext) => {
    return aiToolRegistry.getWorkItems({ statusCategory: 'OVERDUE', ...args }, ctx);
  },

  /** Work items assigned to a specific member. */
  getWorkItemsByAssignee: async (args: { memberIdentifier: string; limit?: number }, ctx: ToolContext) => {
    const user = await findUser(args.memberIdentifier, ctx.organizationId);
    if (!user) return { error: `No team member matching '${args.memberIdentifier}' found in TMP.` };

    const items = await prisma.workItem.findMany({
      where: { assigneeId: user.id, status: { not: 'DONE' } },
      include: { project: { select: { name: true, key: true } } },
      take: args.limit || 25,
      orderBy: { priority: 'asc' },
    });

    return {
      member: user.fullName,
      totalCount: items.length,
      items: items.map(i => ({
        id: i.humanId, title: i.title, type: i.type, status: i.status,
        priority: i.priority, project: i.project.name, dueDate: i.dueDate,
      })),
      source: 'TMP Work Items',
    };
  },

  /** Work items for a specific project. */
  getWorkItemsByProject: async (args: { projectIdentifier: string; statusCategory?: string; limit?: number }, ctx: ToolContext) => {
    const project = await findProject(args.projectIdentifier, ctx.organizationId);
    if (!project) return { error: `Project '${args.projectIdentifier}' not found in TMP.` };

    const where: any = { projectId: project.id };
    if (args.statusCategory === 'ACTIVE') where.status = { notIn: ['DONE', 'ARCHIVED', 'BACKLOG'] };
    else if (args.statusCategory === 'BLOCKED') where.status = 'BLOCKED';
    else if (args.statusCategory === 'OVERDUE') {
      where.status = { notIn: ['DONE', 'ARCHIVED'] };
      where.dueDate = { lt: new Date() };
    }

    const items = await prisma.workItem.findMany({
      where,
      include: { assignee: { select: { fullName: true } } },
      take: args.limit || 30,
      orderBy: { priority: 'asc' },
    });

    return {
      project: project.name,
      totalCount: items.length,
      items: items.map(i => ({
        id: i.humanId, title: i.title, type: i.type, status: i.status,
        priority: i.priority, assignee: i.assignee?.fullName || 'Unassigned', dueDate: i.dueDate,
      })),
      source: 'TMP Work Items',
    };
  },

  // ═══════════════════════════════════════════════════════════════
  // SPRINT TOOLS
  // ═══════════════════════════════════════════════════════════════

  /** Currently active sprints. */
  getCurrentSprint: async (args: { projectIdentifier?: string }, ctx: ToolContext) => {
    const where: any = { project: { organizationId: ctx.organizationId }, status: 'ACTIVE' };
    if (args.projectIdentifier) {
      const p = await findProject(args.projectIdentifier, ctx.organizationId);
      if (p) where.projectId = p.id;
    }

    const sprints = await prisma.sprint.findMany({
      where,
      include: {
        project: { select: { name: true, key: true } },
        workItems: { select: { status: true, storyPoints: true, type: true } },
      },
    });

    if (sprints.length === 0) return { message: 'No active sprints found.', source: 'TMP Sprints' };

    return {
      activeSprints: sprints.map(s => {
        const total = s.workItems.length;
        const done = s.workItems.filter(i => i.status === 'DONE').length;
        const blocked = s.workItems.filter(i => i.status === 'BLOCKED').length;
        const totalPts = s.workItems.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
        const donePts = s.workItems.filter(i => i.status === 'DONE').reduce((sum, i) => sum + (i.storyPoints || 0), 0);
        return {
          project: s.project.name,
          sprintName: s.name,
          goal: s.goal,
          startDate: s.startDate,
          endDate: s.endDate,
          totalItems: total,
          completedItems: done,
          blockedItems: blocked,
          remainingItems: total - done,
          totalStoryPoints: totalPts,
          completedStoryPoints: donePts,
          completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
          pointsCompletionPct: totalPts > 0 ? Math.round((donePts / totalPts) * 100) : 0,
        };
      }),
      source: 'TMP Sprints',
    };
  },

  /** Alias for getCurrentSprint. */
  getSprintProgress: async (args: { projectIdentifier?: string }, ctx: ToolContext) => {
    return aiToolRegistry.getCurrentSprint(args, ctx);
  },

  /** Sprint capacity information. */
  getSprintCapacity: async (args: { projectIdentifier?: string }, ctx: ToolContext) => {
    const sprint = await aiToolRegistry.getCurrentSprint(args, ctx);
    return { ...sprint, source: 'TMP Sprint Capacity' };
  },

  /** Velocity comparison — current vs. previous sprint. */
  getSprintVelocity: async (args: { projectIdentifier?: string }, ctx: ToolContext) => {
    const where: any = { project: { organizationId: ctx.organizationId } };
    if (args.projectIdentifier) {
      const p = await findProject(args.projectIdentifier, ctx.organizationId);
      if (p) where.projectId = p.id;
    }

    const sprints = await prisma.sprint.findMany({
      where: { ...where, status: { in: ['ACTIVE', 'COMPLETED'] } },
      include: {
        project: { select: { name: true } },
        workItems: { select: { status: true, storyPoints: true } },
      },
      orderBy: { endDate: 'desc' },
      take: 4,
    });

    const velocityData = sprints.map(s => ({
      project: s.project.name,
      sprint: s.name,
      status: s.status,
      committedPoints: s.committedPoints,
      completedPoints: s.workItems.filter(i => i.status === 'DONE').reduce((sum, i) => sum + (i.storyPoints || 0), 0),
      totalItems: s.workItems.length,
      doneItems: s.workItems.filter(i => i.status === 'DONE').length,
    }));

    return { velocity: velocityData, source: 'TMP Sprints' };
  },

  /** Items that were in the previous sprint but not completed (carried over). */
  getSprintCarryOver: async (args: { projectIdentifier?: string }, ctx: ToolContext) => {
    const where: any = { project: { organizationId: ctx.organizationId } };
    if (args.projectIdentifier) {
      const p = await findProject(args.projectIdentifier, ctx.organizationId);
      if (p) where.projectId = p.id;
    }

    // Find the most recently completed sprint
    const lastSprint = await prisma.sprint.findFirst({
      where: { ...where, status: 'COMPLETED' },
      orderBy: { endDate: 'desc' },
      include: {
        project: { select: { name: true } },
        workItems: {
          where: { status: { not: 'DONE' } },
          include: { assignee: { select: { fullName: true } } },
          select: {
            humanId: true, title: true, status: true, storyPoints: true,
            assignee: true,
          },
        },
      },
    });

    if (!lastSprint) return { message: 'No completed sprints found.', source: 'TMP Sprints' };

    return {
      project: lastSprint.project.name,
      lastSprint: lastSprint.name,
      carryOverCount: lastSprint.workItems.length,
      carryOverItems: lastSprint.workItems.map(i => ({
        id: i.humanId,
        title: i.title,
        status: i.status,
        storyPoints: i.storyPoints,
        assignee: (i as any).assignee?.fullName || 'Unassigned',
      })),
      source: 'TMP Sprints',
    };
  },

  // ═══════════════════════════════════════════════════════════════
  // DOCUMENTATION TOOLS
  // ═══════════════════════════════════════════════════════════════

  /** Search org knowledge pages. */
  searchKnowledgePages: async (args: { query: string }, ctx: ToolContext) => {
    const pages = await prisma.knowledgePage.findMany({
      where: {
        organizationId: ctx.organizationId,
        OR: [
          { title: { contains: args.query } },
          { content: { contains: args.query } },
          { category: { contains: args.query } },
        ],
      },
      select: { title: true, category: true, updatedAt: true, content: true, projectId: true },
      take: 8,
      orderBy: { updatedAt: 'desc' },
    });

    return {
      query: args.query,
      resultCount: pages.length,
      results: pages.map(p => ({
        title: p.title,
        category: p.category,
        lastUpdated: p.updatedAt,
        snippet: p.content?.substring(0, 300),
      })),
      source: 'TMP Knowledge Hub',
    };
  },

  // ═══════════════════════════════════════════════════════════════
  // GITHUB TOOLS
  // ═══════════════════════════════════════════════════════════════

  /** Open PRs from connected GitHub account (user-level). */
  listPullRequests: async (_args: Record<string, never>, ctx: ToolContext) => {
    const connection = await prisma.gitHubConnection.findFirst({
      where: { userId: ctx.userId, organizationId: ctx.organizationId, status: 'CONNECTED' },
    });

    if (!connection) return { connected: false, message: 'No GitHub connection found. Connect GitHub in Integrations settings.' };

    const token = decryptToken(connection.accessTokenEncrypted);
    try {
      const pulls = await fetchFromGitHubApi(
        `/search/issues?q=is:pr+author:${connection.githubLogin}+state:open`,
        token,
      );
      if (pulls?.items) {
        return {
          githubLogin: connection.githubLogin,
          openPRCount: pulls.items.length,
          pullRequests: pulls.items.map((p: any) => ({
            title: p.title,
            url: p.html_url,
            repository: p.repository_url?.split('/').pop(),
            state: p.state,
            createdAt: p.created_at,
          })),
          source: 'GitHub API',
        };
      }
      return { message: 'No open pull requests found.', source: 'GitHub API' };
    } catch (e: any) {
      return { error: `GitHub API error: ${e.message}` };
    }
  },

  /** PRs linked to a project's work items via TMP GitHub links. */
  getProjectPullRequests: async (args: { projectIdentifier: string }, ctx: ToolContext) => {
    const project = await findProject(args.projectIdentifier, ctx.organizationId);
    if (!project) return { error: `Project '${args.projectIdentifier}' not found in TMP.` };

    const links = await prisma.workItemGitHubLink.findMany({
      where: {
        organizationId: ctx.organizationId,
        workItem: { projectId: project.id },
        relationshipType: 'PULL_REQUEST',
      },
      select: {
        pullRequestNumber: true,
        pullRequestTitle: true,
        pullRequestUrl: true,
        repositoryFullName: true,
        branchName: true,
        workItem: { select: { humanId: true, title: true, status: true } },
      },
      take: 20,
    });

    return {
      project: project.name,
      pullRequestCount: links.length,
      pullRequests: links.map(l => ({
        prNumber: l.pullRequestNumber,
        title: l.pullRequestTitle,
        url: l.pullRequestUrl,
        repo: l.repositoryFullName,
        branch: l.branchName,
        linkedWorkItem: l.workItem ? { id: (l.workItem as any).humanId, title: (l.workItem as any).title, status: (l.workItem as any).status } : null,
      })),
      source: 'TMP GitHub Links',
    };
  },

  /** Recent commits linked to a project's work items. */
  getRecentCommits: async (args: { projectIdentifier: string }, ctx: ToolContext) => {
    const project = await findProject(args.projectIdentifier, ctx.organizationId);
    if (!project) return { error: `Project '${args.projectIdentifier}' not found in TMP.` };

    const links = await prisma.workItemGitHubLink.findMany({
      where: {
        organizationId: ctx.organizationId,
        workItem: { projectId: project.id },
        relationshipType: 'COMMIT',
      },
      select: {
        commitSha: true,
        commitMessage: true,
        branchName: true,
        repositoryFullName: true,
        createdAt: true,
        workItem: { select: { humanId: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    return {
      project: project.name,
      recentCommitCount: links.length,
      commits: links.map(l => ({
        sha: l.commitSha?.substring(0, 8),
        message: l.commitMessage,
        branch: l.branchName,
        repo: l.repositoryFullName,
        linkedWorkItem: l.workItem ? (l.workItem as any).humanId : null,
        createdAt: l.createdAt,
      })),
      source: 'TMP GitHub Links',
    };
  },

};
