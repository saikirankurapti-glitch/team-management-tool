import { prisma } from '../prisma.js';
import { decryptToken, fetchFromGitHubApi } from './githubService.js';

export interface ToolContext {
  userId: string;
  organizationId: string;
  userRole?: string;
}

export const aiToolRegistry: Record<string, (args: any, ctx: ToolContext) => Promise<any>> = {
  // --- PROJECT TOOLS ---
  list_projects: async (_args: {}, ctx: ToolContext) => {
    const projects = await prisma.project.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, key: true, name: true, status: true, health: true },
    });
    return projects;
  },

  get_project: async (args: { key?: string; id?: string }, ctx: ToolContext) => {
    const where: any = { organizationId: ctx.organizationId };
    if (args.id) where.id = args.id;
    if (args.key) where.key = args.key.toUpperCase();

    const project = await prisma.project.findFirst({
      where,
      include: {
        owner: { select: { fullName: true, email: true } },
        _count: { select: { workItems: true, members: true } },
      },
    });
    return project;
  },

  get_project_health: async (_args: {}, ctx: ToolContext) => {
    const projects = await prisma.project.findMany({
      where: { organizationId: ctx.organizationId },
      include: { workItems: true },
    });

    const now = new Date();
    return projects.map((p) => {
      const overdue = p.workItems.filter((i) => i.status !== 'DONE' && i.dueDate && new Date(i.dueDate) < now).length;
      const blocked = p.workItems.filter((i) => i.status === 'BLOCKED').length;

      return {
        key: p.key,
        name: p.name,
        health: p.health,
        overdueItems: overdue,
        blockedItems: blocked,
        status: p.status,
      };
    });
  },

  // --- WORK MANAGEMENT TOOLS ---
  list_work_items: async (args: { status?: string; priority?: string; limit?: number }, ctx: ToolContext) => {
    const where: any = { project: { organizationId: ctx.organizationId } };
    if (args.status) where.status = args.status.toUpperCase();
    if (args.priority) where.priority = args.priority.toUpperCase();

    const items = await prisma.workItem.findMany({
      where,
      include: {
        project: { select: { name: true, key: true } },
        assignee: { select: { fullName: true } },
      },
      take: args.limit || 20,
      orderBy: { updatedAt: 'desc' },
    });

    return items.map((i) => ({
      id: i.id,
      humanId: i.humanId,
      title: i.title,
      type: i.type,
      status: i.status,
      priority: i.priority,
      project: i.project.name,
      assignee: i.assignee?.fullName || 'Unassigned',
    }));
  },

  get_work_item: async (args: { humanId: string }, ctx: ToolContext) => {
    const item = await prisma.workItem.findFirst({
      where: {
        humanId: args.humanId.toUpperCase(),
        project: { organizationId: ctx.organizationId },
      },
      include: {
        project: { select: { key: true, name: true } },
        assignee: { select: { fullName: true, email: true } },
        reporter: { select: { fullName: true } },
        comments: { select: { content: true, createdAt: true } },
        pullRequests: true,
      },
    });
    return item;
  },

  search_work_items: async (args: { query: string }, ctx: ToolContext) => {
    const items = await prisma.workItem.findMany({
      where: {
        project: { organizationId: ctx.organizationId },
        OR: [
          { title: { contains: args.query } },
          { humanId: { contains: args.query } },
          { description: { contains: args.query } },
        ],
      },
      include: { project: { select: { key: true } }, assignee: { select: { fullName: true } } },
      take: 10,
    });

    return items.map((i) => ({
      humanId: i.humanId,
      title: i.title,
      status: i.status,
      priority: i.priority,
      assignee: i.assignee?.fullName || 'Unassigned',
    }));
  },

  // --- SPRINT TOOLS ---
  get_current_sprint: async (args: { projectId?: string }, ctx: ToolContext) => {
    const where: any = {
      project: { organizationId: ctx.organizationId },
      status: 'ACTIVE',
    };
    if (args.projectId) where.projectId = args.projectId;

    const sprint = await prisma.sprint.findFirst({
      where,
      include: {
        project: { select: { name: true, key: true } },
        workItems: { select: { id: true, humanId: true, title: true, status: true, storyPoints: true } },
      },
    });

    return sprint;
  },

  get_sprint_metrics: async (args: { sprintId?: string }, ctx: ToolContext) => {
    const sprint = args.sprintId
      ? await prisma.sprint.findFirst({
          where: { id: args.sprintId, project: { organizationId: ctx.organizationId } },
          include: { workItems: true },
        })
      : await prisma.sprint.findFirst({
          where: { project: { organizationId: ctx.organizationId }, status: 'ACTIVE' },
          include: { workItems: true },
        });

    if (!sprint) return { message: 'No active sprint found' };

    const totalPoints = sprint.workItems.reduce((acc, i) => acc + (i.storyPoints || 0), 0);
    const completedPoints = sprint.workItems
      .filter((i) => i.status === 'DONE')
      .reduce((acc, i) => acc + (i.storyPoints || 0), 0);

    return {
      sprintName: sprint.name,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      totalItems: sprint.workItems.length,
      completedItems: sprint.workItems.filter((i) => i.status === 'DONE').length,
      totalPoints,
      completedPoints,
      completionPercentage: totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0,
    };
  },

  // --- GITHUB TOOLS ---
  get_github_connection: async (_args: {}, ctx: ToolContext) => {
    const connection = await prisma.gitHubConnection.findFirst({
      where: { userId: ctx.userId, organizationId: ctx.organizationId },
    });
    if (!connection) return { connected: false, message: 'GitHub is not connected' };
    return {
      connected: connection.status === 'CONNECTED',
      status: connection.status,
      githubLogin: connection.githubLogin,
      lastValidatedAt: connection.lastValidatedAt,
    };
  },

  list_repositories: async (_args: {}, ctx: ToolContext) => {
    const connection = await prisma.gitHubConnection.findFirst({
      where: { userId: ctx.userId, organizationId: ctx.organizationId, status: 'CONNECTED' },
    });

    if (!connection) return { connected: false, message: 'GitHub connection not found.' };

    const token = decryptToken(connection.accessTokenEncrypted);
    const repos = await fetchFromGitHubApi('/user/repos?sort=updated&per_page=15', token);
    return repos.map((r: any) => ({ name: r.name, fullName: r.full_name, defaultBranch: r.default_branch, url: r.html_url }));
  },

  list_branches: async (args: { owner: string; repo: string }, ctx: ToolContext) => {
    const connection = await prisma.gitHubConnection.findFirst({
      where: { userId: ctx.userId, organizationId: ctx.organizationId, status: 'CONNECTED' },
    });
    if (!connection) return { connected: false };
    const token = decryptToken(connection.accessTokenEncrypted);
    const branches = await fetchFromGitHubApi(`/repos/${args.owner}/${args.repo}/branches`, token);
    return branches.map((b: any) => ({ name: b.name, sha: b.commit.sha }));
  },

  list_commits: async (args: { owner: string; repo: string }, ctx: ToolContext) => {
    const connection = await prisma.gitHubConnection.findFirst({
      where: { userId: ctx.userId, organizationId: ctx.organizationId, status: 'CONNECTED' },
    });
    if (!connection) return { connected: false };
    const token = decryptToken(connection.accessTokenEncrypted);
    const commits = await fetchFromGitHubApi(`/repos/${args.owner}/${args.repo}/commits?per_page=10`, token);
    return commits.map((c: any) => ({
      sha: c.sha.substring(0, 7),
      message: c.commit.message,
      author: c.commit.author.name,
      timestamp: c.commit.author.date,
    }));
  },

  list_pull_requests: async (args: { owner: string; repo: string }, ctx: ToolContext) => {
    const connection = await prisma.gitHubConnection.findFirst({
      where: { userId: ctx.userId, organizationId: ctx.organizationId, status: 'CONNECTED' },
    });
    if (!connection) return { connected: false };
    const token = decryptToken(connection.accessTokenEncrypted);
    const pulls = await fetchFromGitHubApi(`/repos/${args.owner}/${args.repo}/pulls?state=all&per_page=10`, token);
    return pulls.map((p: any) => ({
      number: p.number,
      title: p.title,
      author: p.user.login,
      state: p.merged_at ? 'MERGED' : p.state.toUpperCase(),
      url: p.html_url,
    }));
  },

  // --- TEAM TOOLS ---
  list_team_members: async (_args: {}, ctx: ToolContext) => {
    const users = await prisma.user.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, fullName: true, email: true, role: true, status: true },
    });
    return users;
  },

  get_member_workload: async (_args: {}, ctx: ToolContext) => {
    const users = await prisma.user.findMany({
      where: { organizationId: ctx.organizationId },
      include: { assignedItems: { where: { status: { not: 'DONE' } } } },
    });

    return users.map((u) => {
      const estimated = u.assignedItems.reduce((acc, i) => acc + (i.estimatedHours || 5), 0);
      const utilization = Math.round((estimated / 40) * 100);
      return {
        fullName: u.fullName,
        activeTasks: u.assignedItems.length,
        estimatedHours: estimated,
        utilization: `${utilization}%`,
        status: utilization > 100 ? 'OVER_CAPACITY' : 'HEALTHY',
      };
    });
  },

  get_risks: async (_args: {}, ctx: ToolContext) => {
    const risks = await prisma.riskObservation.findMany({
      where: { organizationId: ctx.organizationId, status: 'ACTIVE' },
    });
    return risks;
  },

  get_team_capacity: async (_args: {}, ctx: ToolContext) => {
    const users = await prisma.user.findMany({
      where: { organizationId: ctx.organizationId },
      include: { assignedItems: { where: { status: { not: 'DONE' } } } },
    });
    return users.map((u) => ({
      fullName: u.fullName,
      assignedCount: u.assignedItems.length,
      utilization: `${Math.round((u.assignedItems.length * 5 / 40) * 100)}%`,
    }));
  },

  // --- MUTATION PROPOSAL DRAFTS (REQUIRE CONFIRMATION) ---
  create_work_item_draft: async (args: { title: string; type?: string; priority?: string; description?: string }, ctx: ToolContext) => {
    return {
      type: 'PROPOSAL_CREATE_WORK_ITEM',
      draft: {
        title: args.title,
        type: args.type || 'TASK',
        priority: args.priority || 'MEDIUM',
        description: args.description || `Task created via AI Copilot`,
      },
      requiresConfirmation: true,
      message: `I can create a work item titled '${args.title}'. Please review and confirm to create.`,
    };
  },

  update_work_item_status: async (args: { humanId: string; targetStatus: string }, ctx: ToolContext) => {
    return {
      type: 'PROPOSAL_UPDATE_STATUS',
      draft: {
        humanId: args.humanId.toUpperCase(),
        targetStatus: args.targetStatus.toUpperCase(),
      },
      requiresConfirmation: true,
      message: `I can update status of ${args.humanId.toUpperCase()} to ${args.targetStatus.toUpperCase()}. Please confirm to apply change.`,
    };
  },

  propose_automation_rule: async (
    args: { name: string; trigger: string; conditions?: any; actions: any[]; projectId?: string },
    ctx: ToolContext
  ) => {
    return {
      type: 'PROPOSAL_CREATE_AUTOMATION_RULE',
      draft: {
        name: args.name,
        trigger: args.trigger,
        conditions: args.conditions || {},
        actions: args.actions || [],
        projectId: args.projectId || null,
        isEnabled: true,
      },
      requiresConfirmation: true,
      message: `🤖 Proposed Automation:\nTrigger: ${args.trigger}\nActions: ${args.actions.map((a: any) => a.type).join(', ')}\n\nReview proposal and confirm to create.`,
    };
  },
};
