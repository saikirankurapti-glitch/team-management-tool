export type UserRole = 'OWNER' | 'ADMIN' | 'PROJECT_MANAGER' | 'TEAM_MEMBER' | 'VIEWER';
export type UserStatus = 'ONLINE' | 'OFFLINE' | 'AWAY';

export interface UserSkillItem {
  id?: string;
  skillName: string;
  proficiency?: string;
  yearsExperience?: number;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  jobTitle?: string;
  department?: string;
  isActive?: boolean;
  role: UserRole;
  status: UserStatus;
  organizationId: string;
  skills?: UserSkillItem[];
  googleConnections?: Array<{
    id: string;
    email: string;
    googleSubjectId?: string | null;
    createdAt: string;
  }>;
  authAllowlists?: Array<{
    id: string;
    email: string;
    provider: string;
    status: string;
    externalIdentityId?: string | null;
  }>;
  projectMemberships?: Array<{
    project: {
      id: string;
      name: string;
      key: string;
    };
  }>;
  teamMemberships?: Array<{
    team: {
      id: string;
      name: string;
    };
  }>;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description?: string;
  ownerId: string;
  owner?: User;
  status: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
  health: 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
  startDate?: string;
  targetDate?: string;
  members?: { user: User }[];
  stats?: {
    totalItems: number;
    completedItems: number;
    blockedItems: number;
    overdueItems: number;
    progress: number;
  };
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  teamLeadId?: string;
  teamLead?: User;
  capacityHours: number;
  members?: { user: User; role: string }[];
}

export type WorkItemType = 'EPIC' | 'FEATURE' | 'USER_STORY' | 'TASK' | 'BUG' | 'SUBTASK';
export type WorkItemStatus = 'BACKLOG' | 'TO_DO' | 'IN_PROGRESS' | 'CODE_REVIEW' | 'TESTING' | 'BLOCKED' | 'DONE';
export type WorkItemPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type BugSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface WorkItem {
  id: string;
  projectId: string;
  humanId: string;
  title: string;
  description?: string;
  type: WorkItemType;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  severity?: BugSeverity;
  assigneeId?: string;
  assignee?: User;
  reporterId: string;
  reporter?: User;
  parentId?: string;
  parent?: { id: string; humanId: string; title: string; type: WorkItemType };
  children?: { id: string; humanId: string; title: string; type: WorkItemType; status: WorkItemStatus }[];
  sprintId?: string;
  sprint?: { id: string; name: string };
  storyPoints?: number;
  estimatedHours?: number;
  actualHours?: number;
  dueDate?: string;
  blockedReason?: string;
  environment?: string;
  stepsToReproduce?: string;
  expectedResult?: string;
  actualResult?: string;
  comments?: WorkItemComment[];
  tags?: { id: string; name: string; color: string }[];
  project?: { key: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface WorkItemComment {
  id: string;
  authorId: string;
  author: User;
  content: string;
  createdAt: string;
}

export interface Sprint {
  id: string;
  projectId: string;
  project?: { key: string; name: string };
  teamId?: string;
  name: string;
  goal?: string;
  startDate: string;
  endDate: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'FUTURE' | 'CLOSED';
  committedPoints: number;
  completedPoints: number;
  workItems?: WorkItem[];
  metrics?: {
    committedPoints: number;
    completedPoints: number;
    remainingPoints: number;
    completionPercentage: number;
    totalItems: number;
    openCount: number;
    blockedCount: number;
  };
}

export interface Channel {
  id: string;
  name: string;
  topic?: string;
  isPrivate: boolean;
  projectId?: string;
  project?: { key: string; name: string };
  _count?: { messages: number };
}

export interface Conversation {
  id: string;
  type: 'DIRECT' | 'GROUP';
  members: { user: User }[];
  messages?: Message[];
}

export interface Message {
  id: string;
  channelId?: string;
  conversationId?: string;
  senderId: string;
  sender: User;
  content: string;
  parentMessageId?: string;
  replies?: Message[];
  reactions?: { id: string; emoji: string; user: User }[];
  createdAt: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface TeamWorkloadItem {
  userId: string;
  fullName: string;
  avatarUrl?: string;
  email: string;
  role: UserRole;
  teams: string[];
  projects: string[];
  activeCount: number;
  completedCount: number;
  highPriorityCount: number;
  overdueCount: number;
  blockedCount: number;
  totalActivePoints: number;
  workloadPercentage: number;
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  targetDate: string;
  plannedDate?: string;
  actualDate?: string;
  status: 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED' | 'AT_RISK' | 'DELAYED';
  ownerId?: string;
  owner?: User;
}

export interface WorkItemDependency {
  id: string;
  blockingWorkItemId: string;
  blockedWorkItemId: string;
  type?: 'FINISH_TO_START' | 'START_TO_START' | 'FINISH_TO_FINISH' | 'START_TO_FINISH';
  lagHours?: number;
}

export interface ResourceAllocation {
  id: string;
  organizationId: string;
  projectId: string;
  project?: { id: string; key: string; name: string };
  userId: string;
  user?: User;
  role?: string;
  skill?: string;
  allocationPercentage: number;
  allocatedHours: number;
  costRate?: number | null;
  billingRate?: number | null;
  startDate: string;
  endDate: string;
}

export interface ProjectPricing {
  id: string;
  projectId: string;
  pricingModel: 'FIXED_PRICE' | 'TIME_AND_MATERIAL' | 'MILESTONE_BASED' | 'RETAINER' | 'HYBRID';
  estimatedInternalCost: number;
  contingencyPercentage: number;
  markupPercentage: number;
  discountPercentage: number;
  taxPercentage: number;
  grossPrice: number;
  subtotal: number;
  taxAmount: number;
  finalPrice: number;
  currency: string;
  notes?: string;
}

export interface EstimateScenario {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  isApplied: boolean;
  scenarioData: string;
  createdAt: string;
}

export interface OrganizationAuthAllowlistEntry {
  id: string;
  organizationId: string;
  provider: 'GOOGLE' | 'GITHUB';
  email: string;
  normalizedEmail: string;
  externalIdentityId?: string;
  userId?: string | null;
  user?: User | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'PENDING';
  displayName?: string | null;
  createdBy?: string | null;
  lastLoginAt?: string | null;
  lastLoginIp?: string | null;
  lastLoginUserAgent?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthAccessRequestEntry {
  id: string;
  organizationId: string;
  provider: 'GOOGLE' | 'GITHUB';
  email: string;
  normalizedEmail?: string | null;
  externalIdentityId?: string | null;
  name?: string | null;
  displayName?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  profileImageUrl?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  ip?: string | null;
  userAgent?: string | null;
  attemptCount?: number;
  lastSeenAt?: string | null;
  rejectionReason?: string | null;
  mappedUserId?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface SecurityEventEntry {
  id: string;
  organizationId: string;
  eventType: string;
  provider: string;
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  details?: string | null;
  status: string;
  createdAt: string;
}

export interface SecurityOverviewStats {
  authorizedAccounts: number;
  activeTeamMembers: number;
  pendingAccessRequests: number;
  blockedLoginAttempts: number;
  suspendedAccounts: number;
}


