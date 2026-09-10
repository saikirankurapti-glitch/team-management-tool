import { prisma } from '../prisma.js';
import { createAndPushNotification } from './notificationService.js';

// Predefined Supported Trigger Registry
export const SUPPORTED_TRIGGERS = [
  // Work Item Triggers
  'WORK_ITEM_CREATED',
  'WORK_ITEM_UPDATED',
  'WORK_ITEM_STATUS_CHANGED',
  'WORK_ITEM_PRIORITY_CHANGED',
  'WORK_ITEM_ASSIGNEE_CHANGED',
  'WORK_ITEM_DUE_DATE_APPROACHING',
  'WORK_ITEM_DUE_DATE_PASSED',
  'WORK_ITEM_BLOCKED',
  'WORK_ITEM_UNBLOCKED',
  'WORK_ITEM_COMPLETED',
  'WORK_ITEM_REOPENED',
  // Sprint Triggers
  'SPRINT_STARTED',
  'SPRINT_ENDING',
  'SPRINT_COMPLETED',
  'SPRINT_SCOPE_CHANGED',
  // Project Triggers
  'PROJECT_CREATED',
  'PROJECT_STATUS_CHANGED',
  'PROJECT_HEALTH_CHANGED',
  'MILESTONE_APPROACHING',
  'MILESTONE_DELAYED',
  'PROJECT_OVERDUE',
  // GitHub Triggers (maps from normalized webhook events)
  'GITHUB_BRANCH_CREATED',
  'GITHUB_COMMIT_PUSHED',
  'GITHUB_PR_OPENED',
  'GITHUB_PR_UPDATED',
  'GITHUB_PR_APPROVED',
  'GITHUB_PR_MERGED',
  'GITHUB_PR_CLOSED',
  'GITHUB_CHECK_FAILED',
  'GITHUB_CHECK_PASSED',
  'GITHUB_WORKFLOW_FAILED',
  'GITHUB_WORKFLOW_COMPLETED',
  // Capacity & Calendar Triggers
  'CAPACITY_OVER_ALLOCATED',
  'MEETING_CREATED',
  'MEETING_UPDATED',
  'MEETING_CANCELLED',
] as const;

export type SupportedTrigger = (typeof SUPPORTED_TRIGGERS)[number];

// Structured Condition AST Definition (Strictly Whitelisted Operators - NO eval)
export type ConditionOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'IN'
  | 'NOT_IN'
  | 'CONTAINS'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'GREATER_EQUAL'
  | 'LESS_EQUAL'
  | 'IS_EMPTY'
  | 'IS_NOT_EMPTY';

export interface ConditionRule {
  field: string; // e.g. "status", "priority", "projectId", "allocationPercentage", "dueDateDays"
  operator: ConditionOperator;
  value?: any;
}

export interface StructuredConditions {
  logicalOperator?: 'AND' | 'OR';
  rules?: ConditionRule[];
  // Backwards-compat simple dictionary support: { status: "BLOCKED", projectId: "..." }
  [key: string]: any;
}

// Structured Whitelisted Action Definition
export type SupportedActionType =
  | 'CHANGE_WORK_ITEM_STATUS'
  | 'ASSIGN_WORK_ITEM'
  | 'CHANGE_WORK_ITEM_PRIORITY'
  | 'ADD_WORK_ITEM_COMMENT'
  | 'CHANGE_DUE_DATE'
  | 'MOVE_TO_SPRINT'
  | 'SEND_NOTIFICATION'
  | 'NOTIFY_ASSIGNEE'
  | 'NOTIFY_PROJECT_MEMBERS'
  | 'NOTIFY_MANAGERS'
  | 'SEND_PROJECT_CHAT';

export interface StructuredAction {
  type: SupportedActionType;
  targetStatus?: string;
  userId?: string;
  targetPriority?: string;
  comment?: string;
  dueDateDaysDelta?: number;
  targetSprintId?: string;
  title?: string;
  message?: string;
  link?: string;
}

export interface AutomationEvent {
  organizationId: string;
  trigger: SupportedTrigger | string;
  projectId?: string;
  workItemId?: string;
  sprintId?: string;
  userId?: string;
  actorId?: string;
  eventId?: string; // Idempotency delivery / unique event ID
  source?: 'WORK_ITEM' | 'GITHUB_WEBHOOK' | 'SPRINT' | 'CAPACITY' | 'CALENDAR' | 'MANUAL';
  data?: Record<string, any>;
  depth?: number;
  correlationId?: string;
  io?: any;
}

// In-memory idempotency cache for recent event processing (TTL 10 minutes)
const processedEventCache = new Map<string, number>();
const CACHE_TTL_MS = 10 * 60 * 1000;

const cleanupCache = () => {
  const now = Date.now();
  for (const [key, timestamp] of processedEventCache.entries()) {
    if (now - timestamp > CACHE_TTL_MS) {
      processedEventCache.delete(key);
    }
  }
};

/**
 * Evaluates safe structured conditions against event data context
 */
export const evaluateSafeCondition = (conditions: StructuredConditions | any, contextData: Record<string, any>): boolean => {
  if (!conditions || (typeof conditions === 'object' && Object.keys(conditions).length === 0)) {
    return true; // Empty conditions match everything
  }

  // Support structured rules array with logical AND/OR
  if (Array.isArray(conditions.rules) && conditions.rules.length > 0) {
    const logicalOp = (conditions.logicalOperator || 'AND').toUpperCase();
    const results = conditions.rules.map((rule: ConditionRule) => {
      const actualVal = contextData[rule.field];
      const targetVal = rule.value;

      switch (rule.operator) {
        case 'EQUALS':
          return String(actualVal ?? '').toUpperCase() === String(targetVal ?? '').toUpperCase();
        case 'NOT_EQUALS':
          return String(actualVal ?? '').toUpperCase() !== String(targetVal ?? '').toUpperCase();
        case 'IN':
          if (Array.isArray(targetVal)) {
            return targetVal.map(v => String(v).toUpperCase()).includes(String(actualVal ?? '').toUpperCase());
          }
          return false;
        case 'NOT_IN':
          if (Array.isArray(targetVal)) {
            return !targetVal.map(v => String(v).toUpperCase()).includes(String(actualVal ?? '').toUpperCase());
          }
          return true;
        case 'CONTAINS':
          return String(actualVal ?? '').toLowerCase().includes(String(targetVal ?? '').toLowerCase());
        case 'GREATER_THAN':
          return Number(actualVal) > Number(targetVal);
        case 'LESS_THAN':
          return Number(actualVal) < Number(targetVal);
        case 'GREATER_EQUAL':
          return Number(actualVal) >= Number(targetVal);
        case 'LESS_EQUAL':
          return Number(actualVal) <= Number(targetVal);
        case 'IS_EMPTY':
          return actualVal === null || actualVal === undefined || actualVal === '';
        case 'IS_NOT_EMPTY':
          return actualVal !== null && actualVal !== undefined && actualVal !== '';
        default:
          return true;
      }
    });

    if (logicalOp === 'OR') {
      return results.some(Boolean);
    }
    return results.every(Boolean);
  }

  // Fallback: Legacy flat object matching (e.g. { status: "BLOCKED", projectId: "xyz" })
  for (const [key, val] of Object.entries(conditions)) {
    if (key === 'logicalOperator' || key === 'rules') continue;
    if (val === undefined || val === null || val === '') continue;

    const actualVal = contextData[key];
    if (String(actualVal ?? '').toUpperCase() !== String(val).toUpperCase()) {
      return false;
    }
  }

  return true;
};

/**
 * Execute automation actions safely in sequence
 */
export const executeActions = async (
  actions: StructuredAction[],
  context: {
    rule: any;
    event: AutomationEvent;
    contextData: Record<string, any>;
    workItem?: any;
    project?: any;
  }
): Promise<{ executed: string[]; errors: string[] }> => {
  const { rule, event, contextData, workItem, project } = context;
  const executed: string[] = [];
  const errors: string[] = [];

  for (const act of actions) {
    try {
      switch (act.type) {
        case 'CHANGE_WORK_ITEM_STATUS': {
          const targetStatus = act.targetStatus;
          if (workItem && targetStatus && workItem.status !== targetStatus) {
            const oldStatus = workItem.status;
            await prisma.workItem.update({
              where: { id: workItem.id },
              data: { status: targetStatus },
            });

            await prisma.workItemStatusHistory.create({
              data: {
                workItemId: workItem.id,
                oldStatus,
                newStatus: targetStatus,
                changedById: rule.createdById || workItem.reporterId,
              },
            });

            executed.push(`Changed status from ${oldStatus} to ${targetStatus}`);

            // Trigger downstream status changed automation with incremented depth
            if ((event.depth || 0) < 4) {
              await emitAutomationEvent({
                organizationId: event.organizationId,
                trigger: 'WORK_ITEM_STATUS_CHANGED',
                workItemId: workItem.id,
                projectId: workItem.projectId,
                depth: (event.depth || 0) + 1,
                correlationId: event.correlationId || event.eventId,
                data: {
                  ...contextData,
                  status: targetStatus,
                  previousStatus: oldStatus,
                },
                io: event.io,
              });
            }
          }
          break;
        }

        case 'ASSIGN_WORK_ITEM': {
          const targetUserId = act.userId;
          if (workItem && targetUserId && workItem.assigneeId !== targetUserId) {
            await prisma.workItem.update({
              where: { id: workItem.id },
              data: { assigneeId: targetUserId },
            });
            executed.push(`Assigned work item to user ${targetUserId}`);
          }
          break;
        }

        case 'CHANGE_WORK_ITEM_PRIORITY': {
          const targetPriority = act.targetPriority;
          if (workItem && targetPriority && workItem.priority !== targetPriority) {
            await prisma.workItem.update({
              where: { id: workItem.id },
              data: { priority: targetPriority },
            });
            executed.push(`Changed priority to ${targetPriority}`);
          }
          break;
        }

        case 'ADD_WORK_ITEM_COMMENT': {
          const content = act.comment || act.message;
          if (workItem && content) {
            await prisma.workItemComment.create({
              data: {
                workItemId: workItem.id,
                authorId: rule.createdById || workItem.reporterId,
                content: `🤖 **[Automation: ${rule.name}]**\n${content}`,
              },
            });
            executed.push(`Added comment to work item`);
          }
          break;
        }

        case 'MOVE_TO_SPRINT': {
          const targetSprintId = act.targetSprintId;
          if (workItem && targetSprintId) {
            await prisma.workItem.update({
              where: { id: workItem.id },
              data: { sprintId: targetSprintId },
            });
            executed.push(`Moved work item to sprint ${targetSprintId}`);
          }
          break;
        }

        case 'SEND_NOTIFICATION':
        case 'NOTIFY_ASSIGNEE': {
          let recipientId = act.userId;
          if (act.type === 'NOTIFY_ASSIGNEE' || !recipientId) {
            recipientId = workItem?.assigneeId || contextData.assigneeId || contextData.userId;
          }

          if (recipientId) {
            await createAndPushNotification({
              userId: recipientId,
              type: 'STATUS_CHANGE',
              title: act.title || `🤖 Automation: ${rule.name}`,
              body: act.message || `Rule '${rule.name}' triggered for ${workItem?.humanId || 'your item'}.`,
              link: act.link || (project?.key ? `/projects/${project.key}` : '/automations'),
              io: event.io,
            });
            executed.push(`Sent notification to user ${recipientId}`);
          }
          break;
        }

        case 'NOTIFY_MANAGERS': {
          // Find Project Owner or Admins/Project Managers in organization
          const managers = await prisma.user.findMany({
            where: {
              organizationId: event.organizationId,
              role: { in: ['ADMIN', 'PROJECT_MANAGER'] },
              isActive: true,
            },
            select: { id: true },
          });

          for (const m of managers) {
            await createAndPushNotification({
              userId: m.id,
              type: 'PROJECT',
              title: act.title || `⚠️ Automation Alert: ${rule.name}`,
              body: act.message || `Automation '${rule.name}' requires manager attention.`,
              link: act.link || (project?.key ? `/projects/${project.key}` : '/capacity'),
              io: event.io,
            });
          }
          executed.push(`Notified ${managers.length} managers`);
          break;
        }

        case 'SEND_PROJECT_CHAT': {
          const targetProjectId = event.projectId || workItem?.projectId;
          if (targetProjectId) {
            const channel = await prisma.channel.findFirst({
              where: { projectId: targetProjectId, organizationId: event.organizationId },
            });

            if (channel) {
              const senderId = rule.createdById || workItem?.reporterId;
              if (senderId) {
                await prisma.message.create({
                  data: {
                    channelId: channel.id,
                    senderId,
                    content: `🤖 **[Automation Notice: ${rule.name}]**\n${act.message || 'Trigger action completed.'}`,
                    messageType: 'SYSTEM',
                    workItemId: workItem?.id,
                  },
                });
                executed.push(`Posted message to project chat channel`);
              }
            }
          }
          break;
        }

        default:
          executed.push(`Unknown action type: ${(act as any).type}`);
      }
    } catch (actErr: any) {
      console.error(`[AutomationEngine] Error executing action ${(act as any).type}:`, actErr);
      errors.push(`${(act as any).type}: ${actErr.message}`);
    }
  }

  return { executed, errors };
};

/**
 * Main Central Event Bus Dispatcher
 */
export const emitAutomationEvent = async (event: AutomationEvent) => {
  const { organizationId, trigger, eventId, depth = 0 } = event;

  // 1. Loop and Depth Protection
  if (depth > 4) {
    console.warn(`[AutomationEngine] Loop detected! Terminating execution at depth ${depth} for org ${organizationId}`);
    return { status: 'SKIPPED_LOOP', reason: 'Execution depth limit exceeded' };
  }

  // 2. Idempotency Guard: Deduplicate exact duplicate deliveries
  if (eventId) {
    cleanupCache();
    const cacheKey = `${organizationId}:${eventId}:${trigger}`;
    if (processedEventCache.has(cacheKey)) {
      console.log(`[AutomationEngine] Idempotent duplicate event skipped: ${cacheKey}`);
      return { status: 'SKIPPED_IDEMPOTENT', duplicate: true };
    }
    processedEventCache.set(cacheKey, Date.now());
  }

  try {
    // 3. Find matching rules (Scoping: org-wide or matching project)
    const rules = await prisma.automationRule.findMany({
      where: {
        organizationId,
        isEnabled: true,
        trigger: {
          in: [
            trigger,
            // Backwards compatibility mappings
            trigger === 'GITHUB_PR_OPENED' ? 'PR_OPENED' : trigger,
            trigger === 'GITHUB_PR_MERGED' ? 'PR_MERGED' : trigger,
            trigger === 'WORK_ITEM_STATUS_CHANGED' ? 'WORK_ITEM_STATUS_CHANGED' : trigger,
            trigger === 'WORK_ITEM_BLOCKED' ? 'WORK_ITEM_BLOCKED' : trigger,
          ],
        },
        OR: [
          { projectId: null },
          ...(event.projectId ? [{ projectId: event.projectId }] : []),
        ],
      },
    });

    if (rules.length === 0) {
      return { status: 'NO_RULES_MATCHED', rulesEvaluated: 0 };
    }

    // 4. Resolve Context Entities
    let workItem: any = null;
    let project: any = null;

    if (event.workItemId) {
      workItem = await prisma.workItem.findUnique({
        where: { id: event.workItemId },
        include: { project: true, sprint: true, assignee: true },
      });
      if (workItem && !event.projectId) {
        project = workItem.project;
      }
    }

    if (!project && event.projectId) {
      project = await prisma.project.findUnique({
        where: { id: event.projectId },
      });
    }

    // Build context data for condition evaluation
    const contextData: Record<string, any> = {
      ...(event.data || {}),
      organizationId,
      trigger,
      projectId: project?.id || event.projectId,
      projectKey: project?.key,
      projectName: project?.name,
      workItemId: workItem?.id,
      humanId: workItem?.humanId,
      status: workItem?.status,
      priority: workItem?.priority,
      type: workItem?.type,
      assigneeId: workItem?.assigneeId,
      sprintId: workItem?.sprintId,
      dueDate: workItem?.dueDate,
    };

    if (workItem?.dueDate) {
      const now = new Date();
      const diffMs = new Date(workItem.dueDate).getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      contextData.dueDateDays = diffDays;
    }

    // 5. Evaluate and Execute each rule
    for (const rule of rules) {
      const startTime = Date.now();

      // Spam Throttling Protection
      if (rule.throttleMinutes && rule.throttleMinutes > 0 && rule.lastExecutedAt) {
        const msSinceLast = Date.now() - new Date(rule.lastExecutedAt).getTime();
        const minutesSinceLast = msSinceLast / (1000 * 60);
        if (minutesSinceLast < rule.throttleMinutes) {
          await prisma.automationLog.create({
            data: {
              automationRuleId: rule.id,
              organizationId,
              projectId: rule.projectId,
              eventId: eventId || null,
              source: event.source || 'WORK_ITEM',
              actorId: event.actorId || null,
              triggerEvent: trigger,
              matchedConditions: true,
              actionsExecuted: JSON.stringify([]),
              status: 'THROTTLED',
              error: `Throttled: Rule configured to run at most once every ${rule.throttleMinutes} minutes.`,
              durationMs: Date.now() - startTime,
            },
          });
          continue;
        }
      }

      // Parse conditions & actions safely
      let parsedConditions: StructuredConditions = {};
      let parsedActions: StructuredAction[] = [];
      try {
        parsedConditions = typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions;
        parsedActions = typeof rule.actions === 'string' ? JSON.parse(rule.actions) : rule.actions;
      } catch (err: any) {
        console.error(`[AutomationEngine] Failed to parse rule configs for rule ${rule.id}:`, err);
      }

      // Evaluate Conditions
      const isMatched = evaluateSafeCondition(parsedConditions, contextData);

      if (!isMatched) {
        continue;
      }

      // Execute Actions
      const { executed, errors } = await executeActions(parsedActions, {
        rule,
        event,
        contextData,
        workItem,
        project,
      });

      const durationMs = Date.now() - startTime;
      const executionStatus = errors.length > 0 ? (executed.length > 0 ? 'PARTIAL_SUCCESS' : 'FAILED') : 'SUCCESS';

      // Record Execution Log
      await prisma.automationLog.create({
        data: {
          automationRuleId: rule.id,
          organizationId,
          projectId: rule.projectId || project?.id || null,
          eventId: eventId || null,
          source: event.source || 'WORK_ITEM',
          actorId: event.actorId || null,
          triggerEvent: trigger,
          matchedConditions: true,
          actionsExecuted: JSON.stringify(executed),
          status: executionStatus === 'PARTIAL_SUCCESS' ? 'SUCCESS' : executionStatus,
          errorCode: errors.length > 0 ? 'ACTION_EXECUTION_ERROR' : null,
          error: errors.length > 0 ? errors.join('; ') : null,
          durationMs,
        },
      });

      // Update rule metrics
      await prisma.automationRule.update({
        where: { id: rule.id },
        data: {
          executionCount: { increment: 1 },
          lastExecutedAt: new Date(),
          ...(errors.length > 0 ? { failureCount: { increment: 1 } } : {}),
        },
      });
    }

    return { status: 'COMPLETED', rulesEvaluated: rules.length };
  } catch (error: any) {
    console.error('[AutomationEngine] Unexpected error executing event:', error);
    return { status: 'ERROR', message: error.message };
  }
};

/**
 * Dry-Run / Test Rule Evaluator (Does not perform any mutations)
 */
export const dryRunAutomationRule = async (
  params: {
    organizationId: string;
    projectId?: string;
    trigger: string;
    conditions: StructuredConditions | any;
    actions: StructuredAction[];
  }
) => {
  const { organizationId, projectId, trigger, conditions, actions } = params;

  // Retrieve candidate items based on trigger type to simulate evaluation
  let matchCount = 0;
  const sampleMatches: any[] = [];

  if (trigger.startsWith('WORK_ITEM') || trigger.startsWith('GITHUB_PR')) {
    const candidateItems = await prisma.workItem.findMany({
      where: {
        project: {
          organizationId,
          ...(projectId ? { id: projectId } : {}),
        },
      },
      take: 25,
      include: { project: true, assignee: true },
    });

    for (const item of candidateItems) {
      const now = new Date();
      const diffMs = item.dueDate ? new Date(item.dueDate).getTime() - now.getTime() : 0;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      const mockContext = {
        organizationId,
        trigger,
        projectId: item.projectId,
        projectKey: item.project.key,
        status: item.status,
        priority: item.priority,
        assigneeId: item.assigneeId,
        humanId: item.humanId,
        dueDateDays: diffDays,
      };

      if (evaluateSafeCondition(conditions, mockContext)) {
        matchCount++;
        if (sampleMatches.length < 5) {
          sampleMatches.push({
            humanId: item.humanId,
            title: item.title,
            status: item.status,
            priority: item.priority,
          });
        }
      }
    }
  }

  // Format proposed simulated actions
  const wouldExecute = (actions || []).map((act) => {
    switch (act.type) {
      case 'CHANGE_WORK_ITEM_STATUS':
        return `Move work item to ${act.targetStatus}`;
      case 'ASSIGN_WORK_ITEM':
        return `Assign work item to user ${act.userId || 'configured assignee'}`;
      case 'CHANGE_WORK_ITEM_PRIORITY':
        return `Change priority to ${act.targetPriority}`;
      case 'SEND_NOTIFICATION':
      case 'NOTIFY_ASSIGNEE':
        return `Send notification: "${act.title || 'Automation notice'}"`;
      case 'NOTIFY_MANAGERS':
        return `Notify project manager / admins`;
      case 'SEND_PROJECT_CHAT':
        return `Post system message to project chat channel`;
      default:
        return `Execute ${(act as any).type}`;
    }
  });

  return {
    trigger,
    matchedConditionsCount: matchCount,
    sampleMatches,
    wouldExecute,
    safeValidation: true,
  };
};

/**
 * Backwards-compatible evaluateTrigger wrapper
 */
export const evaluateTrigger = async (context: {
  organizationId: string;
  trigger: any;
  workItemId?: string;
  projectId?: string;
  repositoryId?: string;
  io?: any;
  depth?: number;
}) => {
  return emitAutomationEvent({
    organizationId: context.organizationId,
    trigger: context.trigger,
    workItemId: context.workItemId,
    projectId: context.projectId,
    depth: context.depth,
    io: context.io,
    source: 'WORK_ITEM',
  });
};

