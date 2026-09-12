import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { projectId, teamId, sprintId, userId, timeframe } = req.query;

    const whereWorkItem: any = {
      project: { organizationId: orgId },
    };

    if (projectId) whereWorkItem.projectId = String(projectId);
    if (teamId) whereWorkItem.teamId = String(teamId);
    if (sprintId) whereWorkItem.sprintId = String(sprintId);
    if (userId) whereWorkItem.assigneeId = String(userId);

    const workItems = await prisma.workItem.findMany({
      where: whereWorkItem,
      include: {
        statusHistory: { orderBy: { changedAt: 'asc' } },
        project: { select: { id: true, key: true, name: true } },
        assignee: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    const totalCount = workItems.length;
    const completedItems = workItems.filter((i) => i.status === 'DONE');
    const inProgressItems = workItems.filter((i) => i.status === 'IN_PROGRESS');
    const blockedItems = workItems.filter((i) => i.status === 'BLOCKED');
    const now = new Date();
    const overdueItems = workItems.filter((i) => i.status !== 'DONE' && i.dueDate && new Date(i.dueDate) < now);

    // Calculate Cycle Time (IN_PROGRESS -> DONE) and Lead Time (CREATED -> DONE) from statusHistory
    const cycleTimesHours: number[] = [];
    const leadTimesHours: number[] = [];

    completedItems.forEach((item) => {
      const doneTransition = item.statusHistory.find((h) => h.newStatus === 'DONE');
      if (doneTransition) {
        const leadHrs = (new Date(doneTransition.changedAt).getTime() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60);
        if (leadHrs >= 0) leadTimesHours.push(leadHrs);

        const inProgressTransition = item.statusHistory.find((h) => h.newStatus === 'IN_PROGRESS');
        if (inProgressTransition) {
          const cycleHrs = (new Date(doneTransition.changedAt).getTime() - new Date(inProgressTransition.changedAt).getTime()) / (1000 * 60 * 60);
          if (cycleHrs >= 0) cycleTimesHours.push(cycleHrs);
        }
      }
    });

    const avgCycleTimeDays = cycleTimesHours.length > 0
      ? (cycleTimesHours.reduce((a, b) => a + b, 0) / cycleTimesHours.length / 24).toFixed(1)
      : '0.0';

    const avgLeadTimeDays = leadTimesHours.length > 0
      ? (leadTimesHours.reduce((a, b) => a + b, 0) / leadTimesHours.length / 24).toFixed(1)
      : '0.0';

    // Work items distribution by Status
    const statusDistribution = [
      { name: 'To Do', value: workItems.filter((i) => i.status === 'TO_DO').length },
      { name: 'In Progress', value: inProgressItems.length },
      { name: 'Code Review', value: workItems.filter((i) => i.status === 'CODE_REVIEW').length },
      { name: 'Testing', value: workItems.filter((i) => i.status === 'TESTING').length },
      { name: 'Blocked', value: blockedItems.length },
      { name: 'Done', value: completedItems.length },
    ];

    // Distribution by Type
    const typeDistribution = [
      { name: 'Epics', value: workItems.filter((i) => i.type === 'EPIC').length },
      { name: 'Features', value: workItems.filter((i) => i.type === 'FEATURE').length },
      { name: 'Stories', value: workItems.filter((i) => i.type === 'USER_STORY').length },
      { name: 'Tasks', value: workItems.filter((i) => i.type === 'TASK').length },
      { name: 'Bugs', value: workItems.filter((i) => i.type === 'BUG').length },
    ];

    // Project Health transparent calculations
    const projects = await prisma.project.findMany({
      where: { organizationId: orgId },
      include: { workItems: true },
    });

    const projectHealthList = projects.map((p) => {
      const pItems = p.workItems;
      const pTotal = pItems.length;
      const pDone = pItems.filter((i) => i.status === 'DONE').length;
      const pBlocked = pItems.filter((i) => i.status === 'BLOCKED').length;
      const pOverdue = pItems.filter((i) => i.status !== 'DONE' && i.dueDate && new Date(i.dueDate) < now).length;
      const progress = pTotal > 0 ? Math.round((pDone / pTotal) * 100) : 0;

      let health = 'HEALTHY';
      const reasons: string[] = [];

      if (pOverdue > 2) {
        reasons.push(`${pOverdue} overdue items`);
      }
      if (pBlocked > 1) {
        reasons.push(`${pBlocked} blocked items`);
      }
      if (progress < 50 && pTotal > 5) {
        reasons.push(`Progress behind expected threshold (${progress}%)`);
      }

      if (reasons.length >= 2 || pOverdue > 3) health = 'CRITICAL';
      else if (reasons.length === 1) health = 'AT_RISK';

      return {
        id: p.id,
        key: p.key,
        name: p.name,
        health,
        reasons,
        progress,
        totalItems: pTotal,
        completedItems: pDone,
        blockedItems: pBlocked,
        overdueItems: pOverdue,
      };
    });

    return res.json({
      summary: {
        totalCount,
        completedCount: completedItems.length,
        inProgressCount: inProgressItems.length,
        blockedCount: blockedItems.length,
        overdueCount: overdueItems.length,
        avgCycleTimeDays,
        avgLeadTimeDays,
        activeProjectsCount: projects.length,
      },
      statusDistribution,
      typeDistribution,
      projectHealthList,
      blockedItems: blockedItems.map((i) => ({
        humanId: i.humanId,
        title: i.title,
        reason: i.blockedReason || 'No reason provided',
        assignee: i.assignee?.fullName || 'Unassigned',
      })),
      overdueItems: overdueItems.map((i) => ({
        humanId: i.humanId,
        title: i.title,
        dueDate: i.dueDate,
        assignee: i.assignee?.fullName || 'Unassigned',
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getTeamAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const { projectId } = req.query;
    const whereWorkItem: any = { project: { organizationId: orgId } };
    if (projectId) whereWorkItem.projectId = String(projectId);

    const users = await prisma.user.findMany({
      where: { organizationId: orgId },
      select: { id: true, fullName: true, avatarUrl: true, role: true },
    });

    const projects = await prisma.project.findMany({
      where: { organizationId: orgId },
      select: { id: true, key: true, name: true },
    });

    const workItems = await prisma.workItem.findMany({
      where: whereWorkItem,
    });

    // Calculate Cross-Project Workload Matrix
    const workloadMatrix = users.map((u) => {
      const userItems = workItems.filter((i) => i.assigneeId === u.id && i.status !== 'DONE');
      const totalUserItems = userItems.length;

      const projectDistribution = projects.map((p) => {
        const pCount = userItems.filter((i) => i.projectId === p.id).length;
        const percentage = totalUserItems > 0 ? Math.round((pCount / totalUserItems) * 100) : 0;
        return {
          projectId: p.id,
          projectKey: p.key,
          projectName: p.name,
          itemCount: pCount,
          percentage,
        };
      });

      const capacityHours = 40;
      const assignedHours = userItems.reduce((acc, i) => acc + (i.estimatedHours || (i.storyPoints || 0) * 4), 0);
      const utilization = Math.round((assignedHours / capacityHours) * 100);

      return {
        userId: u.id,
        fullName: u.fullName,
        avatarUrl: u.avatarUrl,
        totalActiveItems: totalUserItems,
        capacityHours,
        assignedHours,
        utilization,
        isOverCapacity: utilization > 100,
        projectDistribution,
      };
    });

    return res.json({ workloadMatrix });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getFlowAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const { projectId } = req.query;
    const whereWorkItem: any = { project: { organizationId: orgId } };
    if (projectId) whereWorkItem.projectId = String(projectId);

    const workItems = await prisma.workItem.findMany({
      where: whereWorkItem,
      include: {
        assignee: { select: { fullName: true } },
      },
    });

    const now = new Date();

    // WIP Aging calculations for non-completed items
    const wipAging = workItems
      .filter((i) => i.status !== 'DONE')
      .map((item) => {
        const daysInStatus = Math.max(1, Math.ceil((now.getTime() - new Date(item.updatedAt).getTime()) / (1000 * 60 * 60 * 24)));
        return {
          id: item.id,
          humanId: item.humanId,
          title: item.title,
          status: item.status,
          assignee: item.assignee?.fullName || 'Unassigned',
          daysInStatus,
          isHighAging: daysInStatus > 7,
        };
      })
      .sort((a, b) => b.daysInStatus - a.daysInStatus);

    // Potential Bottleneck Detection
    const statusCounts: Record<string, number> = {
      TO_DO: workItems.filter((i) => i.status === 'TO_DO').length,
      IN_PROGRESS: workItems.filter((i) => i.status === 'IN_PROGRESS').length,
      CODE_REVIEW: workItems.filter((i) => i.status === 'CODE_REVIEW').length,
      TESTING: workItems.filter((i) => i.status === 'TESTING').length,
      BLOCKED: workItems.filter((i) => i.status === 'BLOCKED').length,
    };

    const potentialBottlenecks: string[] = [];
    if (statusCounts.TESTING > 5) potentialBottlenecks.push(`Testing queue has accumulated ${statusCounts.TESTING} items.`);
    if (statusCounts.CODE_REVIEW > 5) potentialBottlenecks.push(`Code Review queue has accumulated ${statusCounts.CODE_REVIEW} items.`);
    if (statusCounts.BLOCKED > 3) potentialBottlenecks.push(`Blocked items threshold exceeded (${statusCounts.BLOCKED} items blocked).`);

    return res.json({
      statusCounts,
      wipAging,
      potentialBottlenecks,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getBugAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const { projectId } = req.query;
    const whereBug: any = {
      project: { organizationId: orgId },
      type: 'BUG',
    };
    if (projectId) whereBug.projectId = String(projectId);

    const bugs = await prisma.workItem.findMany({
      where: whereBug,
      include: {
        statusHistory: true,
      },
    });

    const openBugs = bugs.filter((b) => b.status !== 'DONE');
    const resolvedBugs = bugs.filter((b) => b.status === 'DONE');
    const criticalBugs = bugs.filter((b) => b.priority === 'URGENT' || b.priority === 'HIGH');

    // Calculate resolution time
    const resTimesHours: number[] = [];
    resolvedBugs.forEach((b) => {
      const doneTrans = b.statusHistory.find((h) => h.newStatus === 'DONE');
      if (doneTrans) {
        const hrs = (new Date(doneTrans.changedAt).getTime() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60);
        if (hrs >= 0) resTimesHours.push(hrs);
      }
    });

    const avgResolutionDays = resTimesHours.length > 0
      ? (resTimesHours.reduce((a, b) => a + b, 0) / resTimesHours.length / 24).toFixed(1)
      : '0.0';

    return res.json({
      summary: {
        totalBugs: bugs.length,
        openBugs: openBugs.length,
        resolvedBugs: resolvedBugs.length,
        criticalBugs: criticalBugs.length,
        avgResolutionDays,
        reopenRatePercentage: 0,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getMemberAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const targetUserId = id || req.user?.id;
    const orgId = req.user?.organizationId;

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, fullName: true, avatarUrl: true, role: true },
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    const userItems = await prisma.workItem.findMany({
      where: {
        assigneeId: targetUserId,
        project: { organizationId: orgId },
      },
      include: {
        project: { select: { id: true, name: true, key: true } },
        statusHistory: true,
      },
    });

    const activeWork = userItems.filter((i) => i.status !== 'DONE');
    const completedWork = userItems.filter((i) => i.status === 'DONE');
    const blockedWork = userItems.filter((i) => i.status === 'BLOCKED');
    const now = new Date();
    const overdueWork = userItems.filter((i) => i.status !== 'DONE' && i.dueDate && new Date(i.dueDate) < now);

    return res.json({
      user,
      summary: {
        activeWorkCount: activeWork.length,
        completedWorkCount: completedWork.length,
        blockedWorkCount: blockedWork.length,
        overdueWorkCount: overdueWork.length,
      },
      activeWorkItems: activeWork,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const exportAnalyticsCSV = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;

    const workItems = await prisma.workItem.findMany({
      where: { project: { organizationId: orgId } },
      include: {
        project: { select: { name: true, key: true } },
        assignee: { select: { fullName: true } },
      },
    });

    let csv = 'HumanID,Title,Type,Status,Priority,Project,Assignee,StoryPoints,CreatedDate\n';
    workItems.forEach((i) => {
      csv += `"${i.humanId}","${i.title.replace(/"/g, '""')}","${i.type}","${i.status}","${i.priority}","${i.project.name}","${i.assignee?.fullName || 'Unassigned'}",${i.storyPoints || 0},"${new Date(i.createdAt).toISOString()}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="analytics_work_items.csv"');
    return res.status(200).send(csv);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getSavedReports = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const reports = await prisma.savedReport.findMany({
      where: { organizationId: orgId },
      include: { createdBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(reports);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createSavedReport = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { name, description, filters, metrics } = req.body;

    const report = await prisma.savedReport.create({
      data: {
        organizationId: orgId!,
        createdById: userId!,
        name,
        description: description || null,
        filters: typeof filters === 'string' ? filters : JSON.stringify(filters || {}),
        metrics: typeof metrics === 'string' ? metrics : JSON.stringify(metrics || {}),
      },
    });

    return res.status(201).json(report);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
