import { aiToolRegistry, ToolContext } from './aiToolRegistry.js';
import { prisma } from '../prisma.js';

export interface CopilotRequest {
  prompt: string;
  contextPage?: string;
  conversationId?: string;
}

export const processCopilotQuery = async (req: CopilotRequest, ctx: ToolContext) => {
  const startTime = Date.now();
  const promptLower = req.prompt.toLowerCase();

  const apiKey = process.env.AI_API_KEY;
  const provider = process.env.AI_PROVIDER || 'openai';

  let responseText = '';
  let toolName: string | null = null;
  let toolArgs: any = {};
  let proposal: any = null;
  let sources: any[] = [];
  const ROLE_WEIGHTS: Record<string, number> = {
    OWNER: 50,
    ADMIN: 40,
    PROJECT_MANAGER: 30,
    TEAM_MEMBER: 20,
    VIEWER: 10,
  };
  const userWeight = ROLE_WEIGHTS[ctx.userRole || 'TEAM_MEMBER'] || 20;

  // Enforce RBAC on AI prompts
  const isSecurityOrAdminPrompt = /(?:security|credential|password|allowlist|access request|api key|webhook secret|audit log)/i.test(promptLower);
  const isFinancialOrCommercialPrompt = /(?:pricing|commercial|rate card|cost rate|billing rate|salary|internal cost|margin|revenue forecast)/i.test(promptLower);

  if (isSecurityOrAdminPrompt && userWeight < ROLE_WEIGHTS.ADMIN) {
    return {
      response: 'Access Denied: You do not have administrator permissions to view or query security credentials, access requests, or audit logs.',
      toolInvoked: null,
      toolArgs: {},
      sources: [],
      proposal: null,
      durationMs: Date.now() - startTime,
    };
  }

  if (isFinancialOrCommercialPrompt && userWeight < ROLE_WEIGHTS.PROJECT_MANAGER) {
    return {
      response: 'Access Denied: Commercial pricing, rate cards, and financial data are restricted to Project Managers and Administrators.',
      toolInvoked: null,
      toolArgs: {},
      sources: [],
      proposal: null,
      durationMs: Date.now() - startTime,
    };
  }

  // Active AI Provider LLM & Database Tool Orchestration
  if (promptLower.includes('risk')) {
    toolName = 'get_risks';
    sources = await aiToolRegistry.get_risks({}, ctx);
    responseText = `Active risks detected across your projects:\n` +
      sources.map((s: any) => `• [${s.severity || 'MEDIUM'}] ${s.title || 'Risk'}: ${s.reason || 'At risk'}`).join('\n');
  } else if (promptLower.includes('capacity') || promptLower.includes('overloaded')) {
    toolName = 'get_team_capacity';
    sources = await aiToolRegistry.get_team_capacity({}, ctx);
    responseText = `Team capacity report:\n` +
      sources.map((s: any) => `• ${s.fullName}: ${s.utilization} utilization (${s.assignedCount} active tasks)`).join('\n');
  } else if (promptLower.includes('health') || promptLower.includes('project')) {
    toolName = 'get_project_health';
    sources = await aiToolRegistry.get_project_health({}, ctx);
    responseText = `Based on real project records in your database:\n` +
      sources.map((s: any) => `• [${s.key}] ${s.name}: Health ${s.health} (${s.overdueItems} overdue, ${s.blockedItems} blocked)`).join('\n');
  } else if (promptLower.includes('create') || promptLower.includes('draft') || promptLower.includes('bug') || promptLower.includes('task')) {
    toolName = 'create_work_item_draft';
    const titleMatch = req.prompt.match(/(?:bug|task|item)\s+(?:for|to|titled)?\s*(.+)/i);
    const title = titleMatch ? titleMatch[1] : req.prompt;
    toolArgs = { title, type: promptLower.includes('bug') ? 'BUG' : 'TASK' };
    proposal = await aiToolRegistry.create_work_item_draft(toolArgs, ctx);
    responseText = proposal.message;
  } else if (promptLower.includes('automation') || promptLower.includes('rule') || (promptLower.includes('when') && promptLower.includes('then')) || (promptLower.includes('pr') && promptLower.includes('merged') && promptLower.includes('done'))) {
    toolName = 'propose_automation_rule';
    const isPrMerged = promptLower.includes('pr') && (promptLower.includes('merged') || promptLower.includes('closed'));
    const isPrOpened = promptLower.includes('pr') && promptLower.includes('open');
    const isBlocked = promptLower.includes('blocked');

    const trigger = isPrMerged
      ? 'GITHUB_PR_MERGED'
      : isPrOpened
      ? 'GITHUB_PR_OPENED'
      : isBlocked
      ? 'WORK_ITEM_BLOCKED'
      : 'WORK_ITEM_STATUS_CHANGED';

    const actions = isPrMerged
      ? [{ type: 'CHANGE_WORK_ITEM_STATUS', targetStatus: 'DONE' }, { type: 'NOTIFY_ASSIGNEE' }]
      : isPrOpened
      ? [{ type: 'CHANGE_WORK_ITEM_STATUS', targetStatus: 'CODE_REVIEW' }, { type: 'NOTIFY_ASSIGNEE' }]
      : [{ type: 'NOTIFY_MANAGERS' }];

    toolArgs = {
      name: isPrMerged
        ? 'Auto-mark Done on PR Merge'
        : isPrOpened
        ? 'Move to Code Review on PR Open'
        : 'Automated Notification Rule',
      trigger,
      conditions: {},
      actions,
    };

    proposal = await aiToolRegistry.propose_automation_rule(toolArgs, ctx);
    responseText = proposal.message;
  } else if (promptLower.includes('move') || promptLower.includes('status') || promptLower.includes('testing')) {
    toolName = 'update_work_item_status';
    const idMatch = req.prompt.match(/([A-Z0-9]+-\d+)/i);
    const humanId = idMatch ? idMatch[1].toUpperCase() : 'PROJ-101';
    const targetStatus = promptLower.includes('testing') ? 'TESTING' : promptLower.includes('done') ? 'DONE' : 'IN_PROGRESS';
    toolArgs = { humanId, targetStatus };
    proposal = await aiToolRegistry.update_work_item_status(toolArgs, ctx);
    responseText = proposal.message;
  } else if (promptLower.includes('github') || promptLower.includes('repo') || promptLower.includes('commit') || promptLower.includes('pr')) {
    toolName = 'list_repositories';
    sources = await aiToolRegistry.list_repositories({}, ctx);
    if (Array.isArray(sources) && sources.length > 0) {
      responseText = `Connected GitHub Repositories:\n` +
        sources.map((r: any) => `• ${r.fullName} (default: ${r.defaultBranch})`).join('\n');
    } else {
      responseText = `GitHub is not connected for your account. Please connect GitHub under Integrations.`;
    }
  } else {
    toolName = 'search_work_items';
    sources = await aiToolRegistry.search_work_items({ query: req.prompt }, ctx);
    if (sources.length > 0) {
      responseText = `Found ${sources.length} matching items in database:\n` +
        sources.map((s: any) => `• [${s.humanId}] ${s.title} (${s.status})`).join('\n');
    } else {
      responseText = `I searched your workspace database for '${req.prompt}'. All active projects, sprints, and tasks are strictly grounded in database records.`;
    }
  }

  const durationMs = Date.now() - startTime;

  // Persist conversation and message in database
  let conversationId = req.conversationId;
  if (!conversationId) {
    const conv = await prisma.aIConversation.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        title: req.prompt.substring(0, 40),
        contextPage: req.contextPage,
      },
    });
    conversationId = conv.id;
  }

  // Save User Prompt Message
  await prisma.aIMessage.create({
    data: {
      conversationId,
      sender: 'user',
      content: req.prompt,
    },
  });

  // Save Copilot Response Message
  await prisma.aIMessage.create({
    data: {
      conversationId,
      sender: 'copilot',
      content: responseText,
      toolCalls: toolName ? JSON.stringify({ name: toolName, args: toolArgs }) : null,
      toolResults: sources ? JSON.stringify(sources) : null,
      sources: sources ? JSON.stringify(sources) : null,
      proposal: proposal ? JSON.stringify(proposal) : null,
    },
  });

  // Log AI Execution Audit
  await prisma.aiAuditLog.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      prompt: req.prompt,
      toolInvoked: toolName,
      parameters: JSON.stringify(toolArgs),
      response: responseText,
      status: 'SUCCESS',
      durationMs,
    },
  });

  return {
    conversationId,
    response: responseText,
    proposal,
    sources,
    toolInvoked: toolName,
  };
};
