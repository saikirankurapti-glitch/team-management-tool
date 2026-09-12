import { SchemaType, Tool } from '@google/generative-ai';

/**
 * User-friendly status labels displayed in the Copilot UI while a tool is executing.
 * Keeps internal tool names hidden from users.
 */
export const TOOL_STATUS_LABELS: Record<string, string> = {
  getTeamMembers: 'Looking up team members...',
  getTeamWorkload: 'Calculating team workload...',
  getTeamCapacity: 'Checking team capacity...',
  getTeamAvailability: 'Checking available capacity...',
  getMemberAssignments: 'Fetching member assignments...',
  getMemberProjects: 'Looking up member projects...',
  getMemberOverdueWork: 'Checking overdue work...',
  getMemberBlockedWork: 'Checking blocked work...',
  getProjects: 'Loading project list...',
  getProjectSummary: 'Summarising all projects...',
  getProjectDetails: 'Fetching project details...',
  getProjectMembers: 'Loading project team...',
  getProjectWorkload: 'Calculating project workload...',
  getProjectMilestones: 'Loading milestones...',
  getProjectDependencies: 'Checking dependencies...',
  getProjectTimeline: 'Loading project timeline...',
  getProjectResourceAllocation: 'Loading resource allocations...',
  getProjectPricing: 'Loading pricing data...',
  getProjectRisks: 'Checking project risks...',
  getProjectDocumentation: 'Searching project documentation...',
  listProjectDocuments: 'Listing project documents...',
  getManagementSummary: 'Compiling management summary...',
  getWorkItems: 'Querying work items...',
  getBugs: 'Counting open bugs...',
  getBlockedItems: 'Finding blocked items...',
  getOverdueItems: 'Finding overdue items...',
  getWorkItemsByAssignee: 'Loading work items by assignee...',
  getWorkItemsByProject: 'Loading project work items...',
  getCurrentSprint: 'Loading active sprint...',
  getSprintProgress: 'Checking sprint progress...',
  getSprintCapacity: 'Checking sprint capacity...',
  getSprintVelocity: 'Calculating sprint velocity...',
  getSprintCarryOver: 'Checking sprint carry-over...',
  searchKnowledgePages: 'Searching documentation...',
  listPullRequests: 'Loading pull requests from GitHub...',
  getProjectPullRequests: 'Loading project pull requests...',
  getRecentCommits: 'Loading recent commits...',
};

// Shared parameter schemas
const memberIdentifierParam = {
  memberIdentifier: {
    type: SchemaType.STRING as const,
    description: 'The name (or partial name) of the team member, e.g. "Raj" or "Sarah"',
  },
};

const projectIdentifierParam = {
  projectIdentifier: {
    type: SchemaType.STRING as const,
    description: 'The name or key of the project, e.g. "Growth Marketing" or "GMP"',
  },
};

const optionalProjectParam = {
  projectIdentifier: {
    type: SchemaType.STRING as const,
    description: 'Optional: filter by project name or key',
  },
};

const limitParam = {
  limit: {
    type: SchemaType.NUMBER as const,
    description: 'Maximum number of results to return (default: 25)',
  },
};

export const GEMINI_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      // ─── TEAM TOOLS ─────────────────────────────────────────────────────────
      {
        name: 'getTeamMembers',
        description: 'Returns a list of all active team members in the organization with their roles and departments.',
        parameters: { type: SchemaType.OBJECT, properties: {} },
      },
      {
        name: 'getTeamWorkload',
        description: 'Calculates current workload and utilization percentage for every team member based on their active work items and estimated hours. Use for questions like "who has the highest workload", "who is overloaded", "give me a workload summary".',
        parameters: { type: SchemaType.OBJECT, properties: {} },
      },
      {
        name: 'getTeamCapacity',
        description: 'Returns current capacity utilization for all team members. Shows who has available capacity and who is at or over capacity.',
        parameters: { type: SchemaType.OBJECT, properties: {} },
      },
      {
        name: 'getTeamAvailability',
        description: 'Returns team members who currently have available (unused) capacity — i.e., members who are under-utilized, idle, or have spare time.',
        parameters: { type: SchemaType.OBJECT, properties: {} },
      },
      {
        name: 'getMemberAssignments',
        description: 'Returns all active (non-completed) work items currently assigned to a specific team member, along with their workload metrics.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: memberIdentifierParam,
          required: ['memberIdentifier'],
        },
      },
      {
        name: 'getMemberProjects',
        description: 'Returns all projects a specific team member is assigned to, either via project membership or resource allocations.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: memberIdentifierParam,
          required: ['memberIdentifier'],
        },
      },
      {
        name: 'getMemberOverdueWork',
        description: 'Returns overdue work items (past due date, not completed) for a specific team member.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: memberIdentifierParam,
          required: ['memberIdentifier'],
        },
      },
      {
        name: 'getMemberBlockedWork',
        description: 'Returns work items with BLOCKED status for a specific team member.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: memberIdentifierParam,
          required: ['memberIdentifier'],
        },
      },

      // ─── PROJECT TOOLS ───────────────────────────────────────────────────────
      {
        name: 'getProjects',
        description: 'Returns all active (non-archived) projects in the organization with their status and health.',
        parameters: { type: SchemaType.OBJECT, properties: {} },
      },
      {
        name: 'getProjectSummary',
        description: 'Returns a comprehensive summary of all active projects including health, open work count, blocked items, overdue items, and progress percentage. Use for "give me a summary of all projects", "which projects are at risk", "which project needs attention".',
        parameters: { type: SchemaType.OBJECT, properties: {} },
      },
      {
        name: 'getProjectDetails',
        description: 'Returns full details about a specific project including status, timeline, team members, work item breakdown, milestones, and active risks. Use for "tell me everything about X project".',
        parameters: {
          type: SchemaType.OBJECT,
          properties: projectIdentifierParam,
          required: ['projectIdentifier'],
        },
      },
      {
        name: 'getProjectMembers',
        description: 'Returns all team members assigned to a specific project, including their roles and resource allocation details.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: projectIdentifierParam,
          required: ['projectIdentifier'],
        },
      },
      {
        name: 'getProjectWorkload',
        description: 'Returns workload distribution for members within a specific project.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: projectIdentifierParam,
          required: ['projectIdentifier'],
        },
      },
      {
        name: 'getProjectMilestones',
        description: 'Returns all milestones for a specific project with their status and target dates.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: projectIdentifierParam,
          required: ['projectIdentifier'],
        },
      },
      {
        name: 'getProjectDependencies',
        description: 'Returns work item dependencies (blocking/blocked-by relationships) for a specific project.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: projectIdentifierParam,
          required: ['projectIdentifier'],
        },
      },
      {
        name: 'getProjectTimeline',
        description: 'Returns the timeline information for a specific project including planned start/end dates, milestones, and recent sprint history.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: projectIdentifierParam,
          required: ['projectIdentifier'],
        },
      },
      {
        name: 'getProjectResourceAllocation',
        description: 'Returns resource allocation data for a specific project showing who is allocated, at what percentage, and for how long. RESTRICTED: Requires Project Manager role or higher.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: projectIdentifierParam,
          required: ['projectIdentifier'],
        },
      },
      {
        name: 'getProjectPricing',
        description: 'Returns commercial pricing and budget information for a specific project. RESTRICTED: Requires Project Manager role or higher.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: projectIdentifierParam,
          required: ['projectIdentifier'],
        },
      },
      {
        name: 'getProjectRisks',
        description: 'Returns recorded risks and blocked work items for a specific project.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: projectIdentifierParam,
          required: ['projectIdentifier'],
        },
      },
      {
        name: 'getProjectDocumentation',
        description: 'Returns knowledge pages, wiki documents, and decision records for a specific project.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: projectIdentifierParam,
          required: ['projectIdentifier'],
        },
      },
      {
        name: 'listProjectDocuments',
        description: 'Lists all documentation pages associated with a specific project.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: projectIdentifierParam,
          required: ['projectIdentifier'],
        },
      },
      {
        name: 'getManagementSummary',
        description: 'Compiles a high-level executive management summary covering: team size, overloaded/idle members, project health, blocked/overdue counts, and active sprint status. Use for "give me a management summary" or "what should I know today".',
        parameters: { type: SchemaType.OBJECT, properties: {} },
      },

      // ─── WORK ITEM TOOLS ─────────────────────────────────────────────────────
      {
        name: 'getWorkItems',
        description: 'Returns work items with optional filters for type (BUG, TASK, EPIC, FEATURE, USER_STORY) and status category (ACTIVE, BLOCKED, OVERDUE, DONE).',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            type: { type: SchemaType.STRING, description: 'Filter by type: BUG, TASK, EPIC, FEATURE, USER_STORY, SUBTASK' },
            statusCategory: { type: SchemaType.STRING, description: 'Filter by category: ACTIVE, BLOCKED, OVERDUE, DONE' },
            ...limitParam,
          },
        },
      },
      {
        name: 'getBugs',
        description: 'Returns all open bugs across the organization. Use for "how many bugs are open", "list all bugs".',
        parameters: {
          type: SchemaType.OBJECT,
          properties: { ...limitParam },
        },
      },
      {
        name: 'getBlockedItems',
        description: 'Returns all work items currently in BLOCKED status across the organization.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: { ...limitParam },
        },
      },
      {
        name: 'getOverdueItems',
        description: 'Returns all work items that are past their due date and not yet completed.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: { ...limitParam },
        },
      },
      {
        name: 'getWorkItemsByAssignee',
        description: 'Returns active work items assigned to a specific team member.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: { ...memberIdentifierParam, ...limitParam },
          required: ['memberIdentifier'],
        },
      },
      {
        name: 'getWorkItemsByProject',
        description: 'Returns work items for a specific project, optionally filtered by status.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            ...projectIdentifierParam,
            statusCategory: { type: SchemaType.STRING, description: 'Filter by: ACTIVE, BLOCKED, OVERDUE' },
            ...limitParam,
          },
          required: ['projectIdentifier'],
        },
      },

      // ─── SPRINT TOOLS ────────────────────────────────────────────────────────
      {
        name: 'getCurrentSprint',
        description: 'Returns details about currently active sprints including goal, dates, item counts, and completion percentage.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: { ...optionalProjectParam },
        },
      },
      {
        name: 'getSprintProgress',
        description: 'Returns the current sprint progress including completed vs. total items and story points.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: { ...optionalProjectParam },
        },
      },
      {
        name: 'getSprintCapacity',
        description: 'Returns sprint capacity information showing committed vs. remaining work.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: { ...optionalProjectParam },
        },
      },
      {
        name: 'getSprintVelocity',
        description: 'Returns historical sprint velocity — completed story points per sprint — for the last several sprints.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: { ...optionalProjectParam },
        },
      },
      {
        name: 'getSprintCarryOver',
        description: 'Returns work items that were in the last sprint but were not completed (carried over).',
        parameters: {
          type: SchemaType.OBJECT,
          properties: { ...optionalProjectParam },
        },
      },

      // ─── DOCUMENTATION TOOLS ─────────────────────────────────────────────────
      {
        name: 'searchKnowledgePages',
        description: 'Searches the organization knowledge base and internal documentation for a query. Returns matching pages with snippets.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            query: { type: SchemaType.STRING, description: 'The search query or topic to look for' },
          },
          required: ['query'],
        },
      },

      // ─── GITHUB TOOLS ────────────────────────────────────────────────────────
      {
        name: 'listPullRequests',
        description: 'Returns open pull requests from the connected GitHub account for the current user.',
        parameters: { type: SchemaType.OBJECT, properties: {} },
      },
      {
        name: 'getProjectPullRequests',
        description: 'Returns pull requests linked to work items in a specific project via TMP GitHub integration.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: projectIdentifierParam,
          required: ['projectIdentifier'],
        },
      },
      {
        name: 'getRecentCommits',
        description: 'Returns recent commits linked to work items in a specific project via TMP GitHub integration.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: projectIdentifierParam,
          required: ['projectIdentifier'],
        },
      },
    ],
  },
];
