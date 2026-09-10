/**
 * Enterprise Project Planning, Software Estimation, Resource Allocation & Capacity Service
 */

export interface CPMTask {
  id: string;
  humanId?: string;
  title: string;
  durationHours: number;
  startDate?: Date | null;
  dueDate?: Date | null;
  predecessorIds?: string[];
}

export interface CPMDependency {
  id: string;
  blockingWorkItemId: string; // Predecessor
  blockedWorkItemId: string;  // Successor
  type?: 'FINISH_TO_START' | 'START_TO_START' | 'FINISH_TO_FINISH' | 'START_TO_FINISH';
  lagHours?: number;
}

export interface CPMResult {
  hasCycle: boolean;
  cyclePath?: string[];
  tasks: Record<
    string,
    {
      id: string;
      earliestStart: number;
      earliestFinish: number;
      latestStart: number;
      latestFinish: number;
      slack: number;
      isCritical: boolean;
    }
  >;
  projectDurationHours: number;
  criticalPath: string[]; // Task IDs on critical path in order
}

/**
 * Detect cycles in dependency graph using DFS
 */
export const detectCircularDependency = (
  tasks: { id: string }[],
  dependencies: { blockingWorkItemId: string; blockedWorkItemId: string }[]
): { hasCycle: boolean; cyclePath?: string[] } => {
  const adj = new Map<string, string[]>();
  tasks.forEach((t) => adj.set(t.id, []));
  dependencies.forEach((d) => {
    if (!adj.has(d.blockingWorkItemId)) adj.set(d.blockingWorkItemId, []);
    adj.get(d.blockingWorkItemId)!.push(d.blockedWorkItemId);
  });

  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];

  const dfs = (node: string): boolean => {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        path.push(neighbor);
        return true;
      }
    }

    recStack.delete(node);
    path.pop();
    return false;
  };

  for (const t of tasks) {
    if (!visited.has(t.id)) {
      if (dfs(t.id)) {
        return { hasCycle: true, cyclePath: path };
      }
    }
  }

  return { hasCycle: false };
};

/**
 * Calculate Critical Path Method (CPM)
 */
export const calculateCriticalPath = (
  tasks: CPMTask[],
  dependencies: CPMDependency[]
): CPMResult => {
  const cycleCheck = detectCircularDependency(
    tasks.map((t) => ({ id: t.id })),
    dependencies.map((d) => ({
      blockingWorkItemId: d.blockingWorkItemId,
      blockedWorkItemId: d.blockedWorkItemId,
    }))
  );

  if (cycleCheck.hasCycle) {
    return {
      hasCycle: true,
      cyclePath: cycleCheck.cyclePath,
      tasks: {},
      projectDurationHours: 0,
      criticalPath: [],
    };
  }

  const taskMap = new Map<string, CPMTask>();
  tasks.forEach((t) => taskMap.set(t.id, t));

  // Adjacency lists
  const successors = new Map<string, CPMDependency[]>();
  const predecessors = new Map<string, CPMDependency[]>();
  tasks.forEach((t) => {
    successors.set(t.id, []);
    predecessors.set(t.id, []);
  });

  dependencies.forEach((d) => {
    if (successors.has(d.blockingWorkItemId)) successors.get(d.blockingWorkItemId)!.push(d);
    if (predecessors.has(d.blockedWorkItemId)) predecessors.get(d.blockedWorkItemId)!.push(d);
  });

  // Topological sorting via in-degree (Kahn's Algorithm)
  const inDegree = new Map<string, number>();
  tasks.forEach((t) => inDegree.set(t.id, (predecessors.get(t.id) || []).length));

  const queue: string[] = [];
  tasks.forEach((t) => {
    if ((inDegree.get(t.id) || 0) === 0) queue.push(t.id);
  });

  const sortedOrder: string[] = [];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    sortedOrder.push(curr);
    for (const edge of successors.get(curr) || []) {
      const succ = edge.blockedWorkItemId;
      const deg = (inDegree.get(succ) || 1) - 1;
      inDegree.set(succ, deg);
      if (deg === 0) queue.push(succ);
    }
  }

  // Forward Pass: Earliest Start (ES) & Earliest Finish (EF)
  const es = new Map<string, number>();
  const ef = new Map<string, number>();

  for (const taskId of sortedOrder) {
    const task = taskMap.get(taskId);
    const duration = Math.max(0, task?.durationHours || 0);
    const preds = predecessors.get(taskId) || [];

    let maxEs = 0;
    for (const p of preds) {
      const predEf = ef.get(p.blockingWorkItemId) || 0;
      const predEs = es.get(p.blockingWorkItemId) || 0;
      const lag = p.lagHours || 0;

      if (p.type === 'START_TO_START') {
        maxEs = Math.max(maxEs, predEs + lag);
      } else if (p.type === 'FINISH_TO_FINISH') {
        maxEs = Math.max(maxEs, predEf + lag - duration);
      } else {
        // FINISH_TO_START (default)
        maxEs = Math.max(maxEs, predEf + lag);
      }
    }

    es.set(taskId, maxEs);
    ef.set(taskId, maxEs + duration);
  }

  // Project duration = max EF
  let projectDurationHours = 0;
  ef.forEach((val) => {
    if (val > projectDurationHours) projectDurationHours = val;
  });

  // Backward Pass: Latest Finish (LF) & Latest Start (LS)
  const ls = new Map<string, number>();
  const lf = new Map<string, number>();

  for (let i = sortedOrder.length - 1; i >= 0; i--) {
    const taskId = sortedOrder[i];
    const task = taskMap.get(taskId);
    const duration = Math.max(0, task?.durationHours || 0);
    const succs = successors.get(taskId) || [];

    let minLf = projectDurationHours;
    if (succs.length > 0) {
      minLf = Infinity;
      for (const s of succs) {
        const succLs = ls.get(s.blockedWorkItemId) || projectDurationHours;
        const succLf = lf.get(s.blockedWorkItemId) || projectDurationHours;
        const lag = s.lagHours || 0;

        if (s.type === 'START_TO_START') {
          minLf = Math.min(minLf, succLs - lag + duration);
        } else if (s.type === 'FINISH_TO_FINISH') {
          minLf = Math.min(minLf, succLf - lag);
        } else {
          // FINISH_TO_START
          minLf = Math.min(minLf, succLs - lag);
        }
      }
    }

    lf.set(taskId, minLf);
    ls.set(taskId, minLf - duration);
  }

  // Compute Slack & Identify Critical Path
  const resultTasks: CPMResult['tasks'] = {};
  const criticalTasks: string[] = [];

  for (const taskId of tasks.map((t) => t.id)) {
    const earliestS = es.get(taskId) || 0;
    const earliestF = ef.get(taskId) || 0;
    const latestF = lf.get(taskId) ?? projectDurationHours;
    const latestS = ls.get(taskId) ?? latestF;
    const slack = Math.max(0, Math.round((latestS - earliestS) * 100) / 100);
    const isCritical = slack <= 0.05;

    if (isCritical) criticalTasks.push(taskId);

    resultTasks[taskId] = {
      id: taskId,
      earliestStart: earliestS,
      earliestFinish: earliestF,
      latestStart: latestS,
      latestFinish: latestF,
      slack,
      isCritical,
    };
  }

  return {
    hasCycle: false,
    tasks: resultTasks,
    projectDurationHours,
    criticalPath: criticalTasks,
  };
};

/**
 * Three-Point PERT Estimation Engine
 */
export interface PERTResult {
  expected: number;
  standardDeviation: number;
  variance: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  rangeMin: number;
  rangeMax: number;
}

export const calculatePERT = (
  optimistic: number,
  mostLikely: number,
  pessimistic: number
): PERTResult => {
  const o = Math.max(0, optimistic);
  const m = Math.max(0, mostLikely);
  const p = Math.max(m, pessimistic);

  const expected = Math.round(((o + 4 * m + p) / 6) * 100) / 100;
  const standardDeviation = Math.round(((p - o) / 6) * 100) / 100;
  const variance = Math.round(Math.pow(standardDeviation, 2) * 100) / 100;

  // Confidence determination based on variance-to-mean ratio
  const ratio = expected > 0 ? standardDeviation / expected : 0;
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
  if (ratio > 0.35) confidence = 'LOW';
  else if (ratio > 0.15) confidence = 'MEDIUM';

  // 95% Confidence interval (approx ± 2 sigma)
  const rangeMin = Math.max(0, Math.round((expected - 2 * standardDeviation) * 100) / 100);
  const rangeMax = Math.round((expected + 2 * standardDeviation) * 100) / 100;

  return {
    expected,
    standardDeviation,
    variance,
    confidence,
    rangeMin,
    rangeMax,
  };
};

/**
 * Multi-Project Resource Allocation & Over-Allocation Calculation
 */
export interface AllocationSummary {
  userId: string;
  totalAllocationPercentage: number;
  totalAllocatedHours: number;
  capacityHours: number;
  availableHours: number;
  isOverAllocated: boolean;
  status: 'AVAILABLE' | 'UNDERUTILIZED' | 'HEALTHY' | 'HIGH_UTILIZATION' | 'OVER_ALLOCATED';
  allocations: {
    id: string;
    projectId: string;
    projectKey?: string;
    projectName?: string;
    role?: string | null;
    allocationPercentage: number;
    allocatedHours: number;
    startDate: Date;
    endDate: Date;
  }[];
}

export const evaluateResourceAllocations = (
  userId: string,
  allocations: {
    id: string;
    projectId: string;
    projectKey?: string;
    projectName?: string;
    role?: string | null;
    allocationPercentage: number;
    allocatedHours: number;
    startDate: Date;
    endDate: Date;
  }[],
  standardMonthlyHours: number = 160
): AllocationSummary => {
  const totalAllocationPercentage = allocations.reduce((sum, a) => sum + (a.allocationPercentage || 0), 0);
  const totalAllocatedHours = allocations.reduce((sum, a) => sum + (a.allocatedHours || 0), 0);
  const capacityHours = standardMonthlyHours;
  const availableHours = Math.max(0, capacityHours - totalAllocatedHours);
  const isOverAllocated = totalAllocationPercentage > 100 || totalAllocatedHours > capacityHours;

  let status: AllocationSummary['status'] = 'HEALTHY';
  if (isOverAllocated) status = 'OVER_ALLOCATED';
  else if (totalAllocationPercentage >= 85) status = 'HIGH_UTILIZATION';
  else if (totalAllocationPercentage >= 50) status = 'HEALTHY';
  else if (totalAllocationPercentage > 0) status = 'UNDERUTILIZED';
  else status = 'AVAILABLE';

  return {
    userId,
    totalAllocationPercentage,
    totalAllocatedHours,
    capacityHours,
    availableHours,
    isOverAllocated,
    status,
    allocations,
  };
};

/**
 * Project Pricing & Commercial Cost Engine
 */
export interface PricingInput {
  roleAllocations: {
    role: string;
    hours: number;
    costRate: number;
    billingRate: number;
  }[];
  pricingModel?: string; // FIXED_PRICE, TIME_AND_MATERIAL, MILESTONE_BASED, RETAINER, HYBRID
  contingencyPercentage?: number;
  markupPercentage?: number;
  discountPercentage?: number;
  taxPercentage?: number;
}

export interface PricingResult {
  estimatedInternalCost: number;
  contingencyPercentage: number;
  contingencyAmount: number;
  costWithContingency: number;
  markupPercentage: number;
  markupAmount: number;
  grossPrice: number;
  discountPercentage: number;
  discountAmount: number;
  subtotal: number;
  taxPercentage: number;
  taxAmount: number;
  finalPrice: number;
  grossMargin: number;
  grossMarginPercent: number;
}

export const calculateProjectPricing = (input: PricingInput): PricingResult => {
  const contingencyPercentage = input.contingencyPercentage ?? 10;
  const markupPercentage = input.markupPercentage ?? 25;
  const discountPercentage = input.discountPercentage ?? 0;
  const taxPercentage = input.taxPercentage ?? 18;
  const pricingModel = input.pricingModel || 'FIXED_PRICE';

  let internalCost = 0;
  let tnmBillingTotal = 0;

  for (const item of input.roleAllocations) {
    const hours = Math.max(0, item.hours || 0);
    const costRate = Math.max(0, item.costRate || 0);
    const billingRate = Math.max(0, item.billingRate || 0);

    internalCost += hours * costRate;
    tnmBillingTotal += hours * billingRate;
  }

  internalCost = Math.round(internalCost * 100) / 100;
  const contingencyAmount = Math.round(internalCost * (contingencyPercentage / 100) * 100) / 100;
  const costWithContingency = Math.round((internalCost + contingencyAmount) * 100) / 100;

  let grossPrice = 0;
  let markupAmount = 0;

  if (pricingModel === 'TIME_AND_MATERIAL') {
    grossPrice = Math.round(tnmBillingTotal * 100) / 100;
    markupAmount = Math.max(0, Math.round((grossPrice - costWithContingency) * 100) / 100);
  } else {
    markupAmount = Math.round(costWithContingency * (markupPercentage / 100) * 100) / 100;
    grossPrice = Math.round((costWithContingency + markupAmount) * 100) / 100;
  }

  const discountAmount = Math.round(grossPrice * (discountPercentage / 100) * 100) / 100;
  const subtotal = Math.round((grossPrice - discountAmount) * 100) / 100;
  const taxAmount = Math.round(subtotal * (taxPercentage / 100) * 100) / 100;
  const finalPrice = Math.round((subtotal + taxAmount) * 100) / 100;

  const grossMargin = Math.round((subtotal - costWithContingency) * 100) / 100;
  const grossMarginPercent = subtotal > 0 ? Math.round((grossMargin / subtotal) * 1000) / 10 : 0;

  return {
    estimatedInternalCost: internalCost,
    contingencyPercentage,
    contingencyAmount,
    costWithContingency,
    markupPercentage,
    markupAmount,
    grossPrice,
    discountPercentage,
    discountAmount,
    subtotal,
    taxPercentage,
    taxAmount,
    finalPrice,
    grossMargin,
    grossMarginPercent,
  };
};

/**
 * Planned vs Actual & Variance Analysis
 */
export interface VarianceResult {
  totalEstimatedHours: number;
  totalActualHours: number;
  remainingHours: number;
  estimateVarianceHours: number;
  estimateVariancePercent: number;
  forecastAtCompletionHours: number;
  scheduleVariancePercent: number;
  costVariancePercent: number;
  status: 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
}

export const calculateProjectVariance = (
  items: { estimatedHours?: number | null; actualHours?: number | null; remainingHours?: number | null; status?: string }[]
): VarianceResult => {
  let totalEstimated = 0;
  let totalActual = 0;
  let totalRemaining = 0;
  let completedEstimated = 0;

  for (const item of items) {
    const est = item.estimatedHours || 0;
    const act = item.actualHours || 0;
    const rem = item.remainingHours !== undefined && item.remainingHours !== null ? item.remainingHours : Math.max(0, est - act);

    totalEstimated += est;
    totalActual += act;
    totalRemaining += rem;

    if (item.status === 'DONE') {
      completedEstimated += est;
    }
  }

  const estimateVarianceHours = Math.round((totalActual - totalEstimated) * 100) / 100;
  const estimateVariancePercent = totalEstimated > 0 ? Math.round(((totalActual - totalEstimated) / totalEstimated) * 1000) / 10 : 0;
  const forecastAtCompletionHours = Math.round((totalActual + totalRemaining) * 100) / 100;

  // Schedule variance indicator: progress vs burn
  const progressRatio = totalEstimated > 0 ? completedEstimated / totalEstimated : 0;
  const burnRatio = totalEstimated > 0 ? totalActual / totalEstimated : 0;
  const scheduleVariancePercent = Math.round((progressRatio - burnRatio) * 1000) / 10;
  const costVariancePercent = estimateVariancePercent;

  let status: VarianceResult['status'] = 'HEALTHY';
  if (estimateVariancePercent > 20 || scheduleVariancePercent < -20) {
    status = 'CRITICAL';
  } else if (estimateVariancePercent > 10 || scheduleVariancePercent < -10) {
    status = 'AT_RISK';
  }

  return {
    totalEstimatedHours: Math.round(totalEstimated * 100) / 100,
    totalActualHours: Math.round(totalActual * 100) / 100,
    remainingHours: Math.round(totalRemaining * 100) / 100,
    estimateVarianceHours,
    estimateVariancePercent,
    forecastAtCompletionHours,
    scheduleVariancePercent,
    costVariancePercent,
    status,
  };
};
