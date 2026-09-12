import { aiToolRegistry, ToolContext } from './aiToolRegistry.js';
import { GEMINI_TOOLS, TOOL_STATUS_LABELS } from './aiToolDefinitions.js';
import { prisma } from '../prisma.js';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';

export interface CopilotRequest {
  prompt: string;
  contextPage?: string;
  conversationId?: string;
}

export const processCopilotQueryStream = async function* (req: CopilotRequest, ctx: ToolContext) {
  const startTime = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
    throw new Error('Gemini AI is not configured. Please add a valid GEMINI_API_KEY to server/.env');
  }

  // RBAC gate: prevent prompt-level access before hitting Gemini
  const ROLE_WEIGHTS: Record<string, number> = {
    OWNER: 50, ADMIN: 40, PROJECT_MANAGER: 30, TEAM_MEMBER: 20, VIEWER: 10,
  };
  const userWeight = ROLE_WEIGHTS[ctx.userRole || 'TEAM_MEMBER'] || 20;

  const promptLower = req.prompt.toLowerCase();
  const isSecurityPrompt = /(?:security|credential|password|allowlist|access request|api key|webhook secret|audit log)/i.test(promptLower);
  const isFinancialPrompt = /(?:pricing|commercial|rate card|cost rate|billing rate|salary|internal cost|margin)/i.test(promptLower);

  if (isSecurityPrompt && userWeight < ROLE_WEIGHTS.ADMIN) {
    throw new Error('Access Denied: You do not have administrator permissions to view security credentials or audit logs.');
  }
  if (isFinancialPrompt && userWeight < ROLE_WEIGHTS.PROJECT_MANAGER) {
    throw new Error('Access Denied: Commercial pricing and financial data are restricted to Project Managers and Administrators.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // NEVER hardcode a model name — always read from environment
  const modelName = process.env.AI_MODEL || 'gemini-3.5-flash-lite';

  // Load conversation history
  let conversationId = req.conversationId;
  const history: Content[] = [];

  if (conversationId) {
    const pastMessages = await prisma.aIMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    for (const msg of pastMessages) {
      history.push({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }
  }

  const systemInstruction = `You are the TMP Management Intelligence Copilot — an intelligent management analyst embedded in the TMP project management platform.

Your primary role is to answer management, project, team, sprint, workload, and delivery questions using REAL data from TMP's database.

STRICT RULES:
1. NEVER invent or hallucinate: project names, member names, task counts, workloads, dates, velocities, budgets, or GitHub activity.
2. If data is unavailable or empty, respond: "I don't have that information in TMP right now."
3. If data is incomplete, explicitly state what is missing.
4. ALWAYS use the provided tools to retrieve data — never guess or assume.
5. For tabular data (workload, project status, sprint progress), use concise markdown tables.
6. Indicate data source where useful (e.g. "Source: TMP Resource Allocation").
7. Keep responses clear and actionable — not long paragraphs.
8. You are READ-ONLY. Do not offer to create, update, or delete TMP data.

USER CONTEXT:
- Role: ${ctx.userRole || 'TEAM_MEMBER'}
- Page: ${req.contextPage || 'N/A'}
- Timestamp: ${new Date().toISOString()}`;

  let toolNameInvoked: string | null = null;
  let toolArgsUsed: any = null;
  let finalSources: any = null;
  let fullResponseText = '';

  // Helper for resilient Gemini API calls (retries 503/429 transient errors with rate limit backoff)
  const sendWithRetry = async (chatSession: any, messagePayload: any, retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await chatSession.sendMessage(messagePayload);
      } catch (err: any) {
        const isTransient = err.message?.includes('503') || err.message?.includes('429') || err.message?.includes('Service Unavailable') || err.message?.includes('high demand') || err.message?.includes('Quota');
        if (isTransient && attempt < retries) {
          const waitTime = err.message?.includes('429') || err.message?.includes('Quota') ? 12000 : 3000 * attempt;
          console.warn(`[AIGateway] Transient Gemini API error (attempt ${attempt}/${retries}): ${err.message?.substring(0, 100)}. Retrying in ${waitTime}ms...`);
          await new Promise((res) => setTimeout(res, waitTime));
        } else {
          throw err;
        }
      }
    }
  };

  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      tools: GEMINI_TOOLS,
      systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] },
    });

    const chat = model.startChat({ history });

    // --- TURN 1: Send user prompt ---
    const result: any = await sendWithRetry(chat, req.prompt);
    const response = result.response;

    // Check if Gemini wants to call a function
    const functionCalls = response.functionCalls();

    if (functionCalls && functionCalls.length > 0) {
      const allToolResults: Record<string, any> = {};
      const allInvokedNames: string[] = [];

      for (const call of functionCalls) {
        const { name: functionName, args } = call;

        // Emit a user-friendly status message (not the raw tool name)
        const statusLabel = TOOL_STATUS_LABELS[functionName] || `Retrieving ${functionName.replace(/([A-Z])/g, ' $1').toLowerCase()}...`;
        yield { type: 'status', content: statusLabel };

        allInvokedNames.push(functionName);
        toolArgsUsed = args || {};

        const toolFn = aiToolRegistry[functionName as keyof typeof aiToolRegistry];
        let toolResult: any;

        if (toolFn) {
          try {
            toolResult = await (toolFn as any)(args || {}, ctx);
          } catch (e: any) {
            toolResult = { error: `Tool execution failed: ${e.message}` };
          }
        } else {
          toolResult = { error: `Tool '${functionName}' is not available.` };
        }

        allToolResults[functionName] = toolResult;
      }

      toolNameInvoked = allInvokedNames.join(', ');
      finalSources = functionCalls.length === 1 ? Object.values(allToolResults)[0] : allToolResults;

      // Emit sources to frontend for display
      yield { type: 'sources', content: finalSources };

      // --- TURN 2: Send all function results back to Gemini ---
      const toolPayloadText = `[TMP System Data Results for ${toolNameInvoked}]:\n${JSON.stringify(allToolResults, null, 2)}`;
      const secondResult: any = await sendWithRetry(chat, toolPayloadText);
      const secondResponse = secondResult.response;

      // Stream the final text response
      const finalText = secondResponse.text();
      if (finalText) {
        fullResponseText = finalText;
        // Stream in chunks for progressive display
        const chunks = finalText.match(/.{1,80}/gs) || [finalText];
        for (const chunk of chunks) {
          yield { type: 'text', content: chunk };
        }
      }
    } else {
      // No tool call — direct text response (e.g. "Hi", general questions)
      const text = response.text();
      if (text) {
        fullResponseText = text;
        const chunks = text.match(/.{1,80}/gs) || [text];
        for (const chunk of chunks) {
          yield { type: 'text', content: chunk };
        }
      }
    }

    const durationMs = Date.now() - startTime;

    // Persist conversation
    if (!conversationId) {
      const conv = await prisma.aIConversation.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          title: req.prompt.substring(0, 60),
          contextPage: req.contextPage,
        },
      });
      conversationId = conv.id;
    } else {
      // Update updatedAt on existing conversation
      await prisma.aIConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    }

    await prisma.aIMessage.create({
      data: { conversationId, sender: 'user', content: req.prompt },
    });

    await prisma.aIMessage.create({
      data: {
        conversationId,
        sender: 'copilot',
        content: fullResponseText,
        toolCalls: toolNameInvoked ? JSON.stringify({ name: toolNameInvoked, args: toolArgsUsed }) : null,
        toolResults: finalSources ? JSON.stringify(finalSources) : null,
        sources: finalSources ? JSON.stringify(finalSources) : null,
      },
    });

    // Audit log (no secrets, no raw data — just metadata)
    await prisma.aiAuditLog.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        prompt: req.prompt,
        toolInvoked: toolNameInvoked,
        parameters: JSON.stringify(toolArgsUsed || {}),
        response: fullResponseText.substring(0, 500), // Truncate for log
        status: 'SUCCESS',
        durationMs,
      },
    });

    yield { type: 'done', conversationId };

  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.error('[AIGateway Error]:', error.message || error);

    // Log failure (without sensitive data)
    try {
      await prisma.aiAuditLog.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          prompt: req.prompt.substring(0, 200),
          toolInvoked: toolNameInvoked,
          parameters: JSON.stringify(toolArgsUsed || {}),
          response: error.message?.substring(0, 200) || 'Unknown error',
          status: 'FAILED',
          durationMs,
        },
      });
    } catch (_) { /* swallow audit log failure */ }

    const msg = error.message || '';
    let userFriendlyError = 'Gemini Copilot is temporarily unavailable. Please try again.';

    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
      userFriendlyError = 'Gemini API key is missing. Please configure GEMINI_API_KEY in server/.env.';
    } else if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID') || msg.includes('401')) {
      userFriendlyError = 'Gemini authentication failed. Please verify your GEMINI_API_KEY.';
    } else if (msg.includes('404') || msg.includes('not found') || msg.includes('is no longer available')) {
      userFriendlyError = `Gemini model '${process.env.AI_MODEL || 'gemini-3.5-flash-lite'}' is unavailable or not found. Please check AI_MODEL in server/.env.`;
    } else if (msg.includes('429') || msg.includes('Quota exceeded') || msg.includes('Too Many Requests')) {
      userFriendlyError = 'Gemini API rate limit or quota exceeded. Please wait a moment before trying again.';
    } else if (msg.includes('503') || msg.includes('Service Unavailable') || msg.includes('high demand')) {
      userFriendlyError = 'Gemini service is experiencing high demand. Please retry in a few seconds.';
    } else if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      userFriendlyError = 'Network failure connecting to Gemini services. Please check server internet connectivity.';
    } else if (msg.includes('Access Denied')) {
      userFriendlyError = msg;
    }

    yield { type: 'error', message: userFriendlyError };
  }
};
