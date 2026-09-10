
import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import {
  calculateCriticalPath,
  detectCircularDependency,
  calculatePERT,
  evaluateResourceAllocations,
  calculateProjectPricing,
  calculateProjectVariance,
  CPMTask,
  CPMDependency,
} from '../services/planningService.js';
import { emitAutomationEvent } from '../services/automationEngine.js';

// Helper to check financial RBAC
export const canViewFinancials = (role?: string): boolean => {
  return role === 'OWNER' || role === 'ADMIN' || role === 'PROJECT_MANAGER';
};

/**
 * 1. Project Timeline & Gantt with CPM
 */
export const getProjectTimeline = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { id: projectId } = req.params;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const project = await prisma.project.findFirst({
      where: {
        OR: [{ id: projectId }, { key: projectId }],
        organizationId: orgId,
      },
      include: {
        milestones: {
          include: { owner: { select: { id: true, fullName: true, avatarUrl: true } } },
          orderBy: { targetDate: 'asc' },
        },
        sprints: {
          orderBy: { startDate: 'asc' },
        },
      },
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Fetch all work items for this project
    const workItems = await prisma.workItem.findMany({
      where: { projectId: project.id },
      include: {
        assignee: { select: { id: true, fullName: true, avatarUrl: true } },
        blockingItems: true, // Dependencies where this item is blocked by another
        blockedByItems: true, // Dependencies where this item blocks another
      },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
    });

    // Fetch all dependencies in this project
    const workItemIds = workItems.map((w) => w.id);
    const dependencies = await prisma.workItemDependency.findMany({
      where: {
        OR: [
          { blockingWorkItemId: { in: workItemIds } },
          { blockedWorkItemId: { in: workItemIds } },
        ],
      },
    });

    // Prepare CPM tasks
    const cpmTasks: CPMTask[] = workItems.map((w) => {
      let durationHours = w.estimatedHours && w.estimatedHours > 0 ? w.estimatedHours : 8;
      if (w.startDate && w.dueDate) {
        const diffMs = new Date(w.dueDate).getTime() - new Date(w.startDate).getTime();
        const diffHours = Math.max(8, Math.round(diffMs / (1000 * 60 * 60)));
        if (!w.estimatedHours || w.estimatedHours === 0) {
          durationHours = diffHours;
        }
      }

      return {
        id: w.id,
        humanId: w.humanId,
        title: w.title,
        durationHours,
        startDate: w.startDate,
        dueDate: w.dueDate,
      };
    });

    const cpmDependencies: CPMDependency[] = dependencies.map((d) => ({
      id: d.id,
      blockingWorkItemId: d.blockingWorkItemId,
      blockedWorkItemId: d.blockedWorkItemId,
      type: (d as any).type || 'FINISH_TO_START',
      lagHours: (d as any).lagHours || 0,
    }));

    // Run Critical Path Method calculation
    const cpm = calculateCriticalPath(cpmTasks, cpmDependencies);

    return res.json({
      project: {
        id: project.id,
        key: project.key,
        name: project.name,
        startDate: project.startDate || project.plannedStartDate,
        targetDate: project.targetDate || project.plannedEndDate,
        plannedStartDate: project.plannedStartDate,
        plannedEndDate: project.plannedEndDate,
        actualStartDate: project.actualStartDate,
        actualEndDate: project.actualEndDate,
      },
      workItems: workItems.map((w) => {
        const cpmData = cpm.tasks[w.id];
        return {
          id: w.id,
          humanId: w.humanId,
          title: w.title,
          type: w.type,
          status: w.status,
          priority: w.priority,
          storyPoints: w.storyPoints,
          estimatedHours: w.estimatedHours,
          actualHours: w.actualHours,
          remainingHours: w.remainingHours,
          startDate: w.startDate,
          dueDate: w.dueDate,
          assignee: w.assignee,
          earliestStart: cpmData?.earliestStart,
          earliestFinish: cpmData?.earliestFinish,
          latestStart: cpmData?.latestStart,
          latestFinish: cpmData?.latestFinish,
          slackHours: cpmData?.slack,
          isCritical: cpmData?.isCritical || false,
        };
      }),
      milestones: project.milestones,
      sprints: project.sprints,
      dependencies,
      criticalPath: cpm.criticalPath,
      projectDurationHours: cpm.projectDurationHours,
      hasCycle: cpm.hasCycle,
      cyclePath: cpm.cyclePath,
    });
  } catch (error: any) {
    console.error('Error fetching project timeline:', error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * 2. Add Project Work Item Dependency (with cycle prevention)
 */
export const addProjectDependency = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { id: projectId } = req.params;
    const { blockingWorkItemId, blockedWorkItemId, type = 'FINISH_TO_START', lagHours = 0 } = req.body;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });

    if (!blockingWorkItemId || !blockedWorkItemId) {
      return res.status(400).json({ message: 'Both blockingWorkItemId and blockedWorkItemId are required' });
    }

    if (blockingWorkItemId === blockedWorkItemId) {
      return res.status(400).json({ message: 'A work item cannot depend on itself' });
    }

    // Verify both items belong to this project
    const items = await prisma.workItem.findMany({
      where: {
        id: { in: [blockingWorkItemId, blockedWorkItemId] },
        project: {
          OR: [{ id: projectId }, { key: projectId }],
          organizationId: orgId,
        },
      },
    });

    if (items.length !== 2) {
      return res.status(404).json({ message: 'One or both work items were not found in this project' });
    }

    // Existing dependencies in project
    const existingDeps = await prisma.workItemDependency.findMany({
      where: {
        blockingItem: { projectId: items[0].projectId },
      },
    });

    // Check circular dependency
    const allTasks = await prisma.workItem.findMany({
      where: { projectId: items[0].projectId },
      select: { id: true },
    });

    const simulatedDeps = [
      ...existingDeps.map((d) => ({
        blockingWorkItemId: d.blockingWorkItemId,
        blockedWorkItemId: d.blockedWorkItemId,
      })),
      { blockingWorkItemId, blockedWorkItemId },
    ];

    const cycleCheck = detectCircularDependency(allTasks, simulatedDeps);
    if (cycleCheck.hasCycle) {
      return res.status(400).json({
        message: 'Circular dependency detected. This dependency cannot be added.',
        cyclePath: cycleCheck.cyclePath,
      });
    }

    const dependency = await prisma.workItemDependency.create({
      data: {
        blockingWorkItemId,
        blockedWorkItemId,
        type,
        lagHours: Number(lagHours) || 0,
      },
    });

    // Audit log
    await prisma.planningAudit.create({
      data: {
        organizationId: orgId,
        projectId: items[0].projectId,
        userId,
        action: 'TIMELINE_CHANGED',
        entityType: 'DEPENDENCY',
        entityId: dependency.id,
        newValue: `${blockingWorkItemId} -> ${blockedWorkItemId} (${type})`,
      },
    });

    return res.status(201).json(dependency);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Dependency already exists between these work items' });
    }
    return res.status(500).json({ message: error.message });
  }
};

export const deleteProjectDependency = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { dependencyId } = req.params;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const dep = await prisma.workItemDependency.findFirst({
      where: {
        id: dependencyId,
        blockingItem: { project: { organizationId: orgId } },
      },
    });

    if (!dep) return res.status(404).json({ message: 'Dependency not found' });

    await prisma.workItemDependency.delete({ where: { id: dependencyId } });

    return res.json({ message: 'Dependency removed successfully' });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * 3. Project Milestones Lifecycle
 */
export const getProjectMilestones = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { id: projectId } = req.params;

    const project = await prisma.project.findFirst({
      where: {
        OR: [{ id: projectId }, { key: projectId }],
        organizationId: orgId,
      },
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });

    const milestones = await prisma.milestone.findMany({
      where: { projectId: project.id },
      include: {
        owner: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { targetDate: 'asc' },
    });

    return res.json(milestones);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createProjectMilestone = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { id: projectId } = req.params;
    const { name, description, targetDate, plannedDate, ownerId } = req.body;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!name || !targetDate) return res.status(400).json({ message: 'Milestone name and target date are required' });

    const project = await prisma.project.findFirst({
      where: {
        OR: [{ id: projectId }, { key: projectId }],
        organizationId: orgId,
      },
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });

    const milestone = await prisma.milestone.create({
      data: {
        projectId: project.id,
        name: name.trim(),
        description: description?.trim() || null,
        targetDate: new Date(targetDate),
        plannedDate: plannedDate ? new Date(plannedDate) : new Date(targetDate),
        ownerId: ownerId || userId,
        status: 'UPCOMING',
      },
    });

    await prisma.planningAudit.create({
      data: {
        organizationId: orgId,
        projectId: project.id,
        userId,
        action: 'MILESTONE_CHANGED',
        entityType: 'MILESTONE',
        entityId: milestone.id,
        newValue: `Created milestone ${milestone.name}`,
      },
    });

    return res.status(201).json(milestone);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateProjectMilestone = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { milestoneId } = req.params;
    const { name, description, targetDate, plannedDate, actualDate, status, ownerId } = req.body;

    const existing = await prisma.milestone.findFirst({
      where: {
        id: milestoneId,
        project: { organizationId: orgId },
      },
    });

    if (!existing) return res.status(404).json({ message: 'Milestone not found' });

    const updated = await prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description : undefined,
        targetDate: targetDate ? new Date(targetDate) : undefined,
        plannedDate: plannedDate ? new Date(plannedDate) : undefined,
        actualDate: actualDate ? new Date(actualDate) : undefined,
        status: status || undefined,
        ownerId: ownerId !== undefined ? ownerId : undefined,
      },
    });

    await prisma.planningAudit.create({
      data: {
        organizationId: orgId!,
        projectId: existing.projectId,
        userId: userId!,
        action: 'MILESTONE_CHANGED',
        entityType: 'MILESTONE',
        entityId: milestoneId,
        oldValue: existing.status,
        newValue: updated.status,
      },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteProjectMilestone = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { milestoneId } = req.params;

    const existing = await prisma.milestone.findFirst({
      where: {
        id: milestoneId,
        project: { organizationId: orgId },
      },
    });

    if (!existing) return res.status(404).json({ message: 'Milestone not found' });

    await prisma.milestone.delete({ where: { id: milestoneId } });

    return res.json({ message: 'Milestone deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * 4. Software Estimation & Three-Point PERT
 */
export const updateWorkItemEstimate = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { workItemId } = req.params;
    const {
      method = 'HOURS', // STORY_POINTS, HOURS, PERSON_DAYS, THREE_POINT
      value,
      storyPoints,
      estimatedHours,
      optimisticHours,
      mostLikelyHours,
      pessimisticHours,
      personDays,
      reason,
    } = req.body;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });

    const workItem = await prisma.workItem.findFirst({
      where: { id: workItemId, project: { organizationId: orgId } },
    });

    if (!workItem) return res.status(404).json({ message: 'Work item not found' });

    let finalStoryPoints = workItem.storyPoints;
    let finalEstimatedHours = workItem.estimatedHours;
    let finalPersonDays = workItem.personDays;
    let finalOptimistic = workItem.optimisticHours;
    let finalMostLikely = workItem.mostLikelyHours;
    let finalPessimistic = workItem.pessimisticHours;
    let previousLoggedValue = workItem.estimatedHours || 0;
    let newLoggedValue = 0;
    let unit = 'HOURS';

    if (method === 'THREE_POINT') {
      const opt = Number(optimisticHours) || 0;
      const ml = Number(mostLikelyHours) || 0;
      const pess = Number(pessimisticHours) || 0;
      const pert = calculatePERT(opt, ml, pess);

      finalOptimistic = opt;
      finalMostLikely = ml;
      finalPessimistic = pess;
      finalEstimatedHours = pert.expected;
      finalPersonDays = Math.round((pert.expected / 8) * 100) / 100;
      newLoggedValue = pert.expected;
      unit = 'THREE_POINT';
    } else if (method === 'STORY_POINTS') {
      const sp = Math.max(0, Number(storyPoints ?? value) || 0);
      finalStoryPoints = sp;
      newLoggedValue = sp;
      unit = 'STORY_POINTS';
      previousLoggedValue = workItem.storyPoints || 0;
    } else if (method === 'PERSON_DAYS') {
      const pd = Math.max(0, Number(personDays ?? value) || 0);
      finalPersonDays = pd;
      finalEstimatedHours = pd * 8;
      newLoggedValue = pd;
      unit = 'PERSON_DAYS';
      previousLoggedValue = workItem.personDays || 0;
    } else {
      // HOURS
      const hrs = Math.max(0, Number(estimatedHours ?? value) || 0);
      finalEstimatedHours = hrs;
      finalPersonDays = Math.round((hrs / 8) * 100) / 100;
      newLoggedValue = hrs;
      unit = 'HOURS';
    }

    const updated = await prisma.workItem.update({
      where: { id: workItemId },
      data: {
        storyPoints: finalStoryPoints,
        estimatedHours: finalEstimatedHours,
        personDays: finalPersonDays,
        optimisticHours: finalOptimistic,
        mostLikelyHours: finalMostLikely,
        pessimisticHours: finalPessimistic,
      },
    });

    // Create estimate history audit
    await prisma.workItemEstimateHistory.create({
      data: {
        workItemId,
        previousValue: previousLoggedValue,
        newValue: newLoggedValue,
        unit,
        method,
        reason: reason?.trim() || null,
        estimatedById: userId,
      },
    });

    return res.json({
      workItem: updated,
      pert:
        method === 'THREE_POINT' && finalOptimistic && finalMostLikely && finalPessimistic
          ? calculatePERT(finalOptimistic, finalMostLikely, finalPessimistic)
          : null,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getEstimateHistory = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { workItemId } = req.params;

    const history = await prisma.workItemEstimateHistory.findMany({
      where: {
        workItemId,
        workItem: { project: { organizationId: orgId } },
      },
      include: {
        estimatedBy: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { estimatedAt: 'desc' },
    });

    return res.json(history);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * 5. Resource Allocation & Multi-Project Capacity
 */
export const getProjectResourceAllocations = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userRole = req.user?.role;
    const { id: projectId } = req.params;

    const project = await prisma.project.findFirst({
      where: {
        OR: [{ id: projectId }, { key: projectId }],
        organizationId: orgId,
      },
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });

    const allocations = await prisma.resourceAllocation.findMany({
      where: { projectId: project.id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
            role: true,
            skills: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    // Mask financial costRate for normal team members
    const canSeeCost = canViewFinancials(userRole);
    const sanitized = allocations.map((a) => ({
      ...a,
      costRate: canSeeCost ? a.costRate : null,
    }));

    return res.json(sanitized);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const allocateProjectResource = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const currentUserId = req.user?.id;
    const userRole = req.user?.role;
    const { id: projectId } = req.params;
    const {
      userId,
      role,
      skill,
      allocationPercentage = 100,
      allocatedHours = 160,
      costRate,
      billingRate,
      startDate,
      endDate,
    } = req.body;

    if (!orgId || !currentUserId) return res.status(401).json({ message: 'Unauthorized' });
    if (!userId || !startDate || !endDate) {
      return res.status(400).json({ message: 'User, start date, and end date are required' });
    }

    const project = await prisma.project.findFirst({
      where: {
        OR: [{ id: projectId }, { key: projectId }],
        organizationId: orgId,
      },
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Validate user belongs to org and is active
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, isActive: true },
    });
    if (!targetUser) return res.status(404).json({ message: 'Active user not found in organization' });

    // Multi-project check: evaluate all existing allocations for this user across all projects
    const allUserAllocations = await prisma.resourceAllocation.findMany({
      where: {
        userId,
        organizationId: orgId,
      },
      include: { project: { select: { id: true, key: true, name: true } } },
    });

    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);
    if (parsedEnd < parsedStart) {
      return res.status(400).json({ message: 'End date cannot be earlier than start date' });
    }

    // Duplicate check: Check if identical allocation already exists for this project and user
    const existingDuplicate = allUserAllocations.find(
      (a) =>
        a.projectId === project.id &&
        (a.role || '').toLowerCase() === (role || '').trim().toLowerCase() &&
        (a.skill || '').toLowerCase() === (skill || '').trim().toLowerCase()
    );

    if (existingDuplicate) {
      return res.status(409).json({
        message: `Existing allocation found for ${targetUser.fullName} on ${project.name} with role "${role}" and skill "${skill}". Edit the existing allocation instead.`,
        existingAllocationId: existingDuplicate.id,
      });
    }

    const newAlloc = await prisma.resourceAllocation.create({
      data: {
        organizationId: orgId,
        projectId: project.id,
        userId,
        role: role?.trim() || null,
        skill: skill?.trim() || null,
        allocationPercentage: Math.max(0, Number(allocationPercentage) || 0),
        allocatedHours: Math.max(0, Number(allocatedHours) || 0),
        costRate: canViewFinancials(userRole) && costRate !== undefined ? Number(costRate) : null,
        billingRate: billingRate !== undefined ? Number(billingRate) : null,
        startDate: parsedStart,
        endDate: parsedEnd,
      },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
      },
    });

    // Check if user is now over-allocated
    const updatedUserAllocations = [
      ...allUserAllocations.map((a) => ({
        id: a.id,
        projectId: a.projectId,
        projectKey: a.project.key,
        projectName: a.project.name,
        role: a.role,
        allocationPercentage: a.allocationPercentage,
        allocatedHours: a.allocatedHours,
        startDate: a.startDate,
        endDate: a.endDate,
      })),
      {
        id: newAlloc.id,
        projectId: project.id,
        projectKey: project.key,
        projectName: project.name,
        role: newAlloc.role,
        allocationPercentage: newAlloc.allocationPercentage,
        allocatedHours: newAlloc.allocatedHours,
        startDate: newAlloc.startDate,
        endDate: newAlloc.endDate,
      },
    ];

    const workloadEvaluation = evaluateResourceAllocations(userId, updatedUserAllocations);

    // Trigger CAPACITY_OVER_ALLOCATED Automation if user is over-allocated (> 100% allocation or > capacity)
    if (workloadEvaluation.isOverAllocated) {
      emitAutomationEvent({
        organizationId: orgId,
        trigger: 'CAPACITY_OVER_ALLOCATED',
        projectId: project.id,
        userId,
        actorId: currentUserId,
        source: 'CAPACITY',
        eventId: `capacity-${userId}-${Date.now()}`,
        data: {
          userId,
          fullName: targetUser.fullName,
          totalAllocationPercentage: workloadEvaluation.totalAllocationPercentage,
          totalAllocatedHours: workloadEvaluation.totalAllocatedHours,
          capacityHours: workloadEvaluation.capacityHours,
          projectName: project.name,
        },
      }).catch((err) => console.error('[Automation] Capacity over-allocation event error:', err));
    }

    await prisma.planningAudit.create({
      data: {
        organizationId: orgId,
        projectId: project.id,
        userId: currentUserId,
        action: 'RESOURCE_ALLOCATED',
        entityType: 'RESOURCE_ALLOCATION',
        entityId: newAlloc.id,
        newValue: `${targetUser.fullName} allocated ${newAlloc.allocationPercentage}% (${newAlloc.allocatedHours}h) to ${project.name}`,
      },
    });

    return res.status(201).json({
      allocation: newAlloc,
      workloadEvaluation,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteResourceAllocation = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { allocationId } = req.params;

    const alloc = await prisma.resourceAllocation.findFirst({
      where: { id: allocationId, organizationId: orgId },
    });

    if (!alloc) return res.status(404).json({ message: 'Resource allocation not found' });

    await prisma.resourceAllocation.delete({ where: { id: allocationId } });

    await prisma.planningAudit.create({
      data: {
        organizationId: orgId!,
        projectId: alloc.projectId,
        userId: userId!,
        action: 'RESOURCE_REMOVED',
        entityType: 'RESOURCE_ALLOCATION',
        entityId: allocationId,
      },
    });

    return res.json({ message: 'Resource allocation removed successfully' });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * 6. Capacity Planning (Organization, Team, and User view)
 */
export const getCapacityPlanning = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { teamId, projectId } = req.query;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    // Fetch members
    const users = await prisma.user.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        fullName: true,
        email: true,
        avatarUrl: true,
        role: true,
        skills: true,
      },
    });

    // Fetch all active allocations in organization
    const allocations = await prisma.resourceAllocation.findMany({
      where: { organizationId: orgId },
      include: {
        project: { select: { id: true, key: true, name: true } },
      },
    });

    // Group by user
    const capacityByUser = users.map((u) => {
      const userAllocs = allocations
        .filter((a) => a.userId === u.id)
        .map((a) => ({
          id: a.id,
          projectId: a.projectId,
          projectKey: a.project.key,
          projectName: a.project.name,
          role: a.role,
          allocationPercentage: a.allocationPercentage,
          allocatedHours: a.allocatedHours,
          startDate: a.startDate,
          endDate: a.endDate,
        }));

      return {
        user: u,
        evaluation: evaluateResourceAllocations(u.id, userAllocs),
      };
    });

    // Overall Organization metrics
    const totalCapacityHours = capacityByUser.length * 160;
    const totalAllocatedHours = capacityByUser.reduce((sum, c) => sum + c.evaluation.totalAllocatedHours, 0);
    const overallUtilization = totalCapacityHours > 0 ? Math.round((totalAllocatedHours / totalCapacityHours) * 100) : 0;
    const overAllocatedCount = capacityByUser.filter((c) => c.evaluation.isOverAllocated).length;

    return res.json({
      summary: {
        totalTeamMembers: capacityByUser.length,
        totalCapacityHours,
        totalAllocatedHours,
        availableCapacityHours: Math.max(0, totalCapacityHours - totalAllocatedHours),
        overallUtilization,
        overAllocatedCount,
      },
      capacityByUser,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * 7. Project Pricing & Commercial Model
 */
export const getProjectPricing = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userRole = req.user?.role;
    const { id: projectId } = req.params;

    const project = await prisma.project.findFirst({
      where: {
        OR: [{ id: projectId }, { key: projectId }],
        organizationId: orgId,
      },
      include: {
        pricing: true,
        resourceAllocations: true,
      },
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Financial RBAC
    const canSeeFin = canViewFinancials(userRole);
    if (!canSeeFin) {
      return res.status(403).json({ message: 'Access denied: Viewing financial pricing requires Project Manager or Admin permissions' });
    }

    let pricing = project.pricing;
    if (!pricing) {
      // Calculate defaults based on current allocations
      const roleAllocations = project.resourceAllocations.map((a) => ({
        role: a.role || 'Engineer',
        hours: a.allocatedHours || 0,
        costRate: a.costRate || 1000,
        billingRate: a.billingRate || 2500,
      }));

      const calc = calculateProjectPricing({ roleAllocations });
      pricing = await prisma.projectPricing.create({
        data: {
          projectId: project.id,
          organizationId: orgId!,
          pricingModel: 'FIXED_PRICE',
          estimatedInternalCost: calc.estimatedInternalCost,
          contingencyPercentage: calc.contingencyPercentage,
          markupPercentage: calc.markupPercentage,
          discountPercentage: calc.discountPercentage,
          taxPercentage: calc.taxPercentage,
          grossPrice: calc.grossPrice,
          subtotal: calc.subtotal,
          taxAmount: calc.taxAmount,
          finalPrice: calc.finalPrice,
          currency: 'INR',
        },
      });
    }

    return res.json(pricing);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateProjectPricing = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const { id: projectId } = req.params;
    const {
      pricingModel = 'FIXED_PRICE',
      contingencyPercentage = 10,
      markupPercentage = 25,
      discountPercentage = 0,
      taxPercentage = 18,
      currency = 'INR',
      notes,
    } = req.body;

    if (!canViewFinancials(userRole)) {
      return res.status(403).json({ message: 'Access denied: Modifying pricing requires Project Manager or Admin permissions' });
    }

    const project = await prisma.project.findFirst({
      where: {
        OR: [{ id: projectId }, { key: projectId }],
        organizationId: orgId,
      },
      include: { resourceAllocations: true },
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });

    const roleAllocations = project.resourceAllocations.map((a) => ({
      role: a.role || 'Engineer',
      hours: a.allocatedHours || 0,
      costRate: a.costRate || 1000,
      billingRate: a.billingRate || 2500,
    }));

    const calc = calculateProjectPricing({
      roleAllocations,
      pricingModel,
      contingencyPercentage: Number(contingencyPercentage),
      markupPercentage: Number(markupPercentage),
      discountPercentage: Number(discountPercentage),
      taxPercentage: Number(taxPercentage),
    });

    const updated = await prisma.projectPricing.upsert({
      where: { projectId: project.id },
      create: {
        projectId: project.id,
        organizationId: orgId!,
        pricingModel,
        estimatedInternalCost: calc.estimatedInternalCost,
        contingencyPercentage: calc.contingencyPercentage,
        markupPercentage: calc.markupPercentage,
        discountPercentage: calc.discountPercentage,
        taxPercentage: calc.taxPercentage,
        grossPrice: calc.grossPrice,
        subtotal: calc.subtotal,
        taxAmount: calc.taxAmount,
        finalPrice: calc.finalPrice,
        currency,
        notes: notes?.trim() || null,
      },
      update: {
        pricingModel,
        estimatedInternalCost: calc.estimatedInternalCost,
        contingencyPercentage: calc.contingencyPercentage,
        markupPercentage: calc.markupPercentage,
        discountPercentage: calc.discountPercentage,
        taxPercentage: calc.taxPercentage,
        grossPrice: calc.grossPrice,
        subtotal: calc.subtotal,
        taxAmount: calc.taxAmount,
        finalPrice: calc.finalPrice,
        currency,
        notes: notes?.trim() || null,
      },
    });

    await prisma.planningAudit.create({
      data: {
        organizationId: orgId!,
        projectId: project.id,
        userId: userId!,
        action: 'PRICING_UPDATED',
        entityType: 'PROJECT_PRICING',
        entityId: updated.id,
        newValue: `Final Price: ${currency} ${calc.finalPrice} (${pricingModel})`,
      },
    });

    return res.json({ pricing: updated, calculation: calc });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * 8. Rate Cards
 */
export const getRateCards = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userRole = req.user?.role;

    if (!canViewFinancials(userRole)) {
      return res.status(403).json({ message: 'Access denied: Rate cards require Project Manager or Admin permissions' });
    }

    const rateCards = await prisma.rateCard.findMany({
      where: { organizationId: orgId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(rateCards);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createRateCard = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userRole = req.user?.role;
    const { name, currency = 'INR', isDefault = false, items = [] } = req.body;

    if (!canViewFinancials(userRole)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const card = await prisma.rateCard.create({
      data: {
        organizationId: orgId!,
        name: name.trim(),
        currency,
        isDefault: Boolean(isDefault),
        items: {
          create: items.map((i: any) => ({
            role: i.role,
            seniority: i.seniority || null,
            costRate: Number(i.costRate) || 0,
            billingRate: Number(i.billingRate) || 0,
            rateType: i.rateType || 'HOURLY',
          })),
        },
      },
      include: { items: true },
    });

    return res.status(201).json(card);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * 9. What-If Scenario Modeling
 */
export const getProjectScenarios = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { id: projectId } = req.params;

    const scenarios = await prisma.estimateScenario.findMany({
      where: {
        project: {
          OR: [{ id: projectId }, { key: projectId }],
          organizationId: orgId,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(scenarios);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createProjectScenario = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { id: projectId } = req.params;
    const { name, description, scenarioData } = req.body;

    if (!name || !scenarioData) {
      return res.status(400).json({ message: 'Scenario name and data are required' });
    }

    const project = await prisma.project.findFirst({
      where: {
        OR: [{ id: projectId }, { key: projectId }],
        organizationId: orgId,
      },
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });

    const scenario = await prisma.estimateScenario.create({
      data: {
        projectId: project.id,
        organizationId: orgId!,
        name: name.trim(),
        description: description?.trim() || null,
        scenarioData: typeof scenarioData === 'string' ? scenarioData : JSON.stringify(scenarioData),
      },
    });

    return res.status(201).json(scenario);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const applyProjectScenario = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { scenarioId } = req.params;

    const scenario = await prisma.estimateScenario.findFirst({
      where: { id: scenarioId, organizationId: orgId },
      include: { project: true },
    });

    if (!scenario) return res.status(404).json({ message: 'Scenario not found' });

    const parsed = JSON.parse(scenario.scenarioData);

    // Apply simulated duration/dates if present
    if (parsed.plannedStartDate || parsed.plannedEndDate) {
      await prisma.project.update({
        where: { id: scenario.projectId },
        data: {
          plannedStartDate: parsed.plannedStartDate ? new Date(parsed.plannedStartDate) : undefined,
          plannedEndDate: parsed.plannedEndDate ? new Date(parsed.plannedEndDate) : undefined,
        },
      });
    }

    await prisma.estimateScenario.update({
      where: { id: scenarioId },
      data: { isApplied: true },
    });

    await prisma.planningAudit.create({
      data: {
        organizationId: orgId!,
        projectId: scenario.projectId,
        userId: userId!,
        action: 'SCENARIO_APPLIED',
        entityType: 'ESTIMATE_SCENARIO',
        entityId: scenario.id,
        newValue: `Applied scenario ${scenario.name}`,
      },
    });

    return res.json({ message: `Scenario '${scenario.name}' applied successfully` });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * 10. Project Variance & Financial Progress Dashboard
 */
export const getProjectVariance = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userRole = req.user?.role;
    const { id: projectId } = req.params;

    const project = await prisma.project.findFirst({
      where: {
        OR: [{ id: projectId }, { key: projectId }],
        organizationId: orgId,
      },
      include: {
        workItems: {
          select: {
            id: true,
            humanId: true,
            title: true,
            type: true,
            status: true,
            estimatedHours: true,
            actualHours: true,
            remainingHours: true,
          },
        },
        pricing: true,
        resourceAllocations: true,
      },
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });

    const variance = calculateProjectVariance(project.workItems);
    const canSeeCost = canViewFinancials(userRole);

    return res.json({
      project: {
        id: project.id,
        key: project.key,
        name: project.name,
      },
      variance,
      pricing: canSeeCost ? project.pricing : null,
      allocationsCount: project.resourceAllocations.length,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
