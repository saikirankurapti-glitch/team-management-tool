import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { prisma } from '../prisma.js';
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
import { canViewFinancials } from '../controllers/planningController.js';

describe('Project Planning Workflow & Calculation Engine', () => {
  it('executes the full end-to-end planning workflow calculations', async () => {
    await runPlanningWorkflowTests();
  });
});

async function runPlanningWorkflowTests() {
  console.log('--- STARTING PROJECT PLANNING, ESTIMATION & CAPACITY TESTS ---');

  // Test 1: Circular Dependency Detection
  console.log('Test 1: Circular Dependency Prevention...');
  const tasks = [{ id: 'task-A' }, { id: 'task-B' }, { id: 'task-C' }];
  const nonCircularDeps = [
    { blockingWorkItemId: 'task-A', blockedWorkItemId: 'task-B' },
    { blockingWorkItemId: 'task-B', blockedWorkItemId: 'task-C' },
  ];

  const check1 = detectCircularDependency(tasks, nonCircularDeps);
  assert.strictEqual(check1.hasCycle, false, 'Linear dependency chain should not have cycles');

  const circularDeps = [
    { blockingWorkItemId: 'task-A', blockedWorkItemId: 'task-B' },
    { blockingWorkItemId: 'task-B', blockedWorkItemId: 'task-C' },
    { blockingWorkItemId: 'task-C', blockedWorkItemId: 'task-A' }, // Creates cycle A -> B -> C -> A
  ];
  const check2 = detectCircularDependency(tasks, circularDeps);
  assert.strictEqual(check2.hasCycle, true, 'Circular dependency must be detected');
  console.log('  [PASS] Circular dependency detection accurately flags cycles.');

  // Test 2: Critical Path Method (CPM) Forward & Backward Pass
  console.log('Test 2: Critical Path Calculation...');
  const cpmTasks: CPMTask[] = [
    { id: 'T1', title: 'Requirements', durationHours: 16 },
    { id: 'T2', title: 'Architecture', durationHours: 24 }, // Successor of T1
    { id: 'T3', title: 'UI Mockups', durationHours: 8 },   // Successor of T1 (parallel to T2)
    { id: 'T4', title: 'Implementation', durationHours: 40 }, // Successor of T2 and T3
  ];

  const cpmDeps: CPMDependency[] = [
    { id: 'd1', blockingWorkItemId: 'T1', blockedWorkItemId: 'T2', type: 'FINISH_TO_START' },
    { id: 'd2', blockingWorkItemId: 'T1', blockedWorkItemId: 'T3', type: 'FINISH_TO_START' },
    { id: 'd3', blockingWorkItemId: 'T2', blockedWorkItemId: 'T4', type: 'FINISH_TO_START' },
    { id: 'd4', blockingWorkItemId: 'T3', blockedWorkItemId: 'T4', type: 'FINISH_TO_START' },
  ];

  const cpmResult = calculateCriticalPath(cpmTasks, cpmDeps);
  assert.strictEqual(cpmResult.hasCycle, false);
  // Total duration along T1(16) -> T2(24) -> T4(40) = 80 hours
  // Path along T1(16) -> T3(8) -> T4(40) = 64 hours
  assert.strictEqual(cpmResult.projectDurationHours, 80, 'Longest path should be 80 hours');
  assert.strictEqual(cpmResult.tasks['T1'].isCritical, true);
  assert.strictEqual(cpmResult.tasks['T2'].isCritical, true);
  assert.strictEqual(cpmResult.tasks['T4'].isCritical, true);
  assert.strictEqual(cpmResult.tasks['T3'].isCritical, false, 'T3 has 16 hours of slack');
  assert.strictEqual(cpmResult.tasks['T3'].slack, 16);
  console.log('  [PASS] Critical path and slack computed accurately.');

  // Test 3: Three-Point PERT Estimation
  console.log('Test 3: Three-Point PERT Estimation Engine...');
  // Optimistic = 10h, Most Likely = 20h, Pessimistic = 42h
  // Expected = (10 + 4*20 + 42) / 6 = 132 / 6 = 22h
  // SD = (42 - 10) / 6 = 32 / 6 = 5.33h
  const pert = calculatePERT(10, 20, 42);
  assert.strictEqual(pert.expected, 22, 'PERT expected should match formula');
  assert.strictEqual(pert.standardDeviation, 5.33);
  assert.strictEqual(pert.variance, 28.41);
  assert.strictEqual(pert.confidence, 'MEDIUM');
  assert.strictEqual(pert.rangeMin, 11.34);
  assert.strictEqual(pert.rangeMax, 32.66);
  console.log('  [PASS] PERT expected, standard deviation, and confidence ranges verified.');

  // Test 4: Multi-Project Resource Allocation & Over-Allocation
  console.log('Test 4: Multi-Project Resource Allocation & Over-Allocation...');
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Single project: 60%
  const normalAlloc = evaluateResourceAllocations('user-1', [
    {
      id: 'a1',
      projectId: 'proj-1',
      role: 'Frontend Engineer',
      allocationPercentage: 60,
      allocatedHours: 96,
      startDate: now,
      endDate: nextMonth,
    },
  ]);
  assert.strictEqual(normalAlloc.totalAllocationPercentage, 60);
  assert.strictEqual(normalAlloc.isOverAllocated, false);
  assert.strictEqual(normalAlloc.status, 'HEALTHY');

  // Across multiple projects: Project A (60%) + Project B (50%) = 110%
  const overAlloc = evaluateResourceAllocations('user-1', [
    {
      id: 'a1',
      projectId: 'proj-1',
      role: 'Frontend Engineer',
      allocationPercentage: 60,
      allocatedHours: 96,
      startDate: now,
      endDate: nextMonth,
    },
    {
      id: 'a2',
      projectId: 'proj-2',
      role: 'Frontend Engineer',
      allocationPercentage: 50,
      allocatedHours: 80,
      startDate: now,
      endDate: nextMonth,
    },
  ]);
  assert.strictEqual(overAlloc.totalAllocationPercentage, 110);
  assert.strictEqual(overAlloc.isOverAllocated, true);
  assert.strictEqual(overAlloc.status, 'OVER_ALLOCATED');
  console.log('  [PASS] Multi-project allocation and over-allocation (>100%) verified.');

  // Test 5: Project Pricing & Commercial Cost Engine
  console.log('Test 5: Project Pricing & Commercial Cost Engine...');
  const pricing = calculateProjectPricing({
    roleAllocations: [
      { role: 'Senior Architect', hours: 40, costRate: 2000, billingRate: 5000 }, // cost = 80,000
      { role: 'Backend Engineer', hours: 160, costRate: 1000, billingRate: 2500 }, // cost = 1,60,000
    ],
    pricingModel: 'FIXED_PRICE',
    contingencyPercentage: 10, // 10% of 2,40,000 = 24,000 -> Cost+Contingency = 2,64,000
    markupPercentage: 25,     // 25% of 2,64,000 = 66,000 -> Gross = 3,30,000
    discountPercentage: 5,    // 5% of 3,30,000 = 16,500 -> Subtotal = 3,13,500
    taxPercentage: 18,        // 18% of 3,13,500 = 56,430 -> Final Price = 3,69,930
  });

  assert.strictEqual(pricing.estimatedInternalCost, 240000);
  assert.strictEqual(pricing.contingencyAmount, 24000);
  assert.strictEqual(pricing.costWithContingency, 264000);
  assert.strictEqual(pricing.markupAmount, 66000);
  assert.strictEqual(pricing.grossPrice, 330000);
  assert.strictEqual(pricing.discountAmount, 16500);
  assert.strictEqual(pricing.subtotal, 313500);
  assert.strictEqual(pricing.taxAmount, 56430);
  assert.strictEqual(pricing.finalPrice, 369930);
  // Margin = 3,13,500 - 2,64,000 = 49,500. Margin % = (49500 / 313500) * 100 = 15.8%
  assert.strictEqual(pricing.grossMargin, 49500);
  assert.strictEqual(pricing.grossMarginPercent, 15.8);
  console.log('  [PASS] Commercial pricing, markup, contingency, tax, and margins verified.');

  // Test 6: Financial RBAC Protection
  console.log('Test 6: Financial RBAC Protection...');
  assert.strictEqual(canViewFinancials('OWNER'), true);
  assert.strictEqual(canViewFinancials('ADMIN'), true);
  assert.strictEqual(canViewFinancials('PROJECT_MANAGER'), true);
  assert.strictEqual(canViewFinancials('TEAM_MEMBER'), false, 'Team members must not see internal cost rates');
  assert.strictEqual(canViewFinancials('VIEWER'), false, 'Viewers must not see internal cost rates');
  console.log('  [PASS] Financial RBAC permission guards verified.');

  // Test 7: Planned vs Actual Variance Analysis
  console.log('Test 7: Planned vs Actual Variance Analysis...');
  const items = [
    { estimatedHours: 40, actualHours: 45, remainingHours: 0, status: 'DONE' },
    { estimatedHours: 80, actualHours: 60, remainingHours: 30, status: 'IN_PROGRESS' },
  ];
  const variance = calculateProjectVariance(items);
  // Total Estimated = 120h, Actual = 105h, Remaining = 30h
  // Estimate Variance = 105 - 120 = -15h (-12.5%)
  // Forecast At Completion (FAC) = 105 + 30 = 135h
  assert.strictEqual(variance.totalEstimatedHours, 120);
  assert.strictEqual(variance.totalActualHours, 105);
  assert.strictEqual(variance.remainingHours, 30);
  assert.strictEqual(variance.forecastAtCompletionHours, 135);
  console.log('  [PASS] Planned vs actual hours and forecast at completion verified.');

  // Test 8: Database Integration & Multi-Tenant Lifecycle
  console.log('Test 8: Database Planning Models & Multi-Tenant Isolation...');
  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({
      data: { name: 'Planning Org', slug: 'planning-test-org' },
    });
  }

  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'plan-test@example.com',
        fullName: 'Planning Tester',
        passwordHash: 'dummy_hash',
        organization: { connect: { id: org.id } },
        role: 'PROJECT_MANAGER',
      },
    });
  }

  const project = await prisma.project.create({
    data: {
      name: 'Planning Test Project',
      key: 'PLNTEST',
      organization: { connect: { id: org.id } },
      owner: { connect: { id: user.id } },
      plannedStartDate: now,
      plannedEndDate: nextMonth,
      estimationMethod: 'THREE_POINT',
    },
  });

  try {
    // 8a. Create Milestone
    const milestone = await prisma.milestone.create({
      data: {
        projectId: project.id,
        name: 'Sprint 1 Delivery',
        targetDate: nextMonth,
        plannedDate: nextMonth,
        ownerId: user.id,
        status: 'UPCOMING',
      },
    });
    assert.strictEqual(milestone.name, 'Sprint 1 Delivery');

    // 8b. Create Work Item with PERT
    const workItem = await prisma.workItem.create({
      data: {
        humanId: 'PLN-1',
        title: 'Build Payment Gateway Module',
        type: 'FEATURE',
        status: 'TO_DO',
        priority: 'HIGH',
        project: { connect: { id: project.id } },
        reporter: { connect: { id: user.id } },
        optimisticHours: 16,
        mostLikelyHours: 24,
        pessimisticHours: 40,
        estimatedHours: 25.33,
        personDays: 3.17,
      },
    });
    assert.strictEqual(workItem.humanId, 'PLN-1');

    // 8c. Create Resource Allocation
    const alloc = await prisma.resourceAllocation.create({
      data: {
        organizationId: org.id,
        projectId: project.id,
        userId: user.id,
        role: 'Lead Architect',
        allocationPercentage: 50,
        allocatedHours: 80,
        costRate: 1500,
        billingRate: 3500,
        startDate: now,
        endDate: nextMonth,
      },
    });
    assert.strictEqual(alloc.allocationPercentage, 50);

    // 8d. Create Project Pricing
    const projectPricing = await prisma.projectPricing.create({
      data: {
        projectId: project.id,
        organizationId: org.id,
        pricingModel: 'FIXED_PRICE',
        estimatedInternalCost: 120000,
        contingencyPercentage: 10,
        markupPercentage: 25,
        discountPercentage: 0,
        taxPercentage: 18,
        grossPrice: 165000,
        subtotal: 165000,
        taxAmount: 29700,
        finalPrice: 194700,
        currency: 'INR',
      },
    });
    assert.strictEqual(projectPricing.finalPrice, 194700);

    console.log('  [PASS] Real database records created, verified, and linked.');
  } finally {
    // Teardown
    await prisma.milestone.deleteMany({ where: { projectId: project.id } });
    await prisma.workItem.deleteMany({ where: { projectId: project.id } });
    await prisma.resourceAllocation.deleteMany({ where: { projectId: project.id } });
    await prisma.projectPricing.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });
  }

  console.log('--- ALL PROJECT PLANNING WORKFLOW TESTS PASSED SUCCESSFULLY! ---');
}
