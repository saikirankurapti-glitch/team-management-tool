import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as authCtrl from '../controllers/authController.js';
import * as orgCtrl from '../controllers/orgController.js';
import * as teamCtrl from '../controllers/teamController.js';
import * as projCtrl from '../controllers/projectController.js';
import * as workItemCtrl from '../controllers/workItemController.js';
import * as sprintCtrl from '../controllers/sprintController.js';
import * as chatCtrl from '../controllers/chatController.js';
import * as analyticsCtrl from '../controllers/analyticsController.js';
import * as notifCtrl from '../controllers/notificationController.js';
import * as searchCtrl from '../controllers/searchController.js';
import * as fileCtrl from '../controllers/fileController.js';
import * as calendarCtrl from '../controllers/calendarController.js';
import * as feedbackCtrl from '../controllers/feedbackController.js';
import * as integrationCtrl from '../controllers/integrationController.js';
import * as githubCtrl from '../controllers/githubController.js';
import * as githubConfigCtrl from '../controllers/githubConfigController.js';
import * as webhookCtrl from '../controllers/webhookController.js';
import * as automationCtrl from '../controllers/automationController.js';
import * as digestCtrl from '../controllers/digestController.js';
import * as portfolioCtrl from '../controllers/portfolioController.js';
import * as riskCtrl from '../controllers/riskController.js';
import * as reportBuilderCtrl from '../controllers/reportBuilderController.js';
import * as copilotCtrl from '../controllers/copilotController.js';
import * as apiKeyCtrl from '../controllers/apiKeyController.js';
import * as customerWebhookCtrl from '../controllers/customerWebhookController.js';
import * as securityCenterCtrl from '../controllers/securityCenterController.js';
import * as billingCtrl from '../controllers/billingController.js';
import * as supportCtrl from '../controllers/supportController.js';
import * as saasOnboardCtrl from '../controllers/saasOnboardingController.js';
import * as templateCtrl from '../controllers/templateController.js';
import * as devPlatformCtrl from '../controllers/developerPlatformController.js';
import * as knowledgeCtrl from '../controllers/knowledgeController.js';
import * as decisionCtrl from '../controllers/decisionController.js';
import * as meetingCtrl from '../controllers/meetingController.js';
import * as projectUpdateCtrl from '../controllers/projectUpdateController.js';
import * as collabSearchCtrl from '../controllers/collaborationSearchController.js';
import * as pushCtrl from '../controllers/pushNotificationController.js';
import * as offlineSyncCtrl from '../controllers/offlineSyncController.js';
import * as workflowCtrl from '../controllers/workflowController.js';
import * as customFieldCtrl from '../controllers/customFieldController.js';
import * as approvalCtrl from '../controllers/approvalController.js';
import * as governanceCtrl from '../controllers/governanceController.js';
import * as healthCtrl from '../controllers/healthController.js';
import * as opsCtrl from '../controllers/opsController.js';
import * as googleConfigCtrl from '../controllers/googleConfigController.js';
import * as googleAuthCtrl from '../controllers/googleAuthController.js';
import * as googleMeetingCtrl from '../controllers/meetingController.js';
import * as googleDriveCtrl from '../controllers/driveController.js';
import * as planningCtrl from '../controllers/planningController.js';
import * as allowlistCtrl from '../controllers/allowlistController.js';
// DEVELOPMENT ONLY — never import for production use
import * as devAuthCtrl from '../controllers/devAuthController.js';

const router = Router();

// Auth Routes
router.post('/auth/login', authCtrl.login);
router.get('/auth/github/url', authCtrl.getGitHubAuthUrl);
router.post('/auth/github/callback', authCtrl.handleGitHubCallback);
router.get('/auth/google/url', authCtrl.getGoogleAuthUrl);
router.post('/auth/google/callback', authCtrl.handleGoogleCallback);
router.post('/auth/request-access', allowlistCtrl.submitAccessRequest);
router.post('/auth/logout', authenticate, authCtrl.logout);
router.get('/auth/me', authenticate, authCtrl.getCurrentUser);

// ── DEVELOPMENT-ONLY route ─────────────────────────────────────────────────
// This route is conditionally registered only when NODE_ENV=development.
// The handler itself also independently guards against non-development envs.
// This double-guard (route registration + handler guard) ensures the endpoint
// cannot be accidentally exposed in production.
// NEVER add this route outside of this conditional block.
if (process.env.NODE_ENV === 'development') {
  router.post('/auth/dev-login', devAuthCtrl.devLogin);
}

// Organization & Members
router.get('/organization', authenticate, orgCtrl.getOrganization);
router.get('/organization/members', authenticate, orgCtrl.getMembers);
router.put('/organization/members/:id', authenticate, orgCtrl.updateMember);
router.post('/organization/members/:id/deactivate', authenticate, requireRole('ADMIN'), orgCtrl.deactivateMember);
router.post('/organization/members/:id/reactivate', authenticate, requireRole('ADMIN'), orgCtrl.reactivateMember);

// Teams & Workload
router.get('/teams', authenticate, teamCtrl.getTeams);
router.get('/teams/workload', authenticate, teamCtrl.getTeamWorkload);

// Projects
router.get('/projects', authenticate, projCtrl.getProjects);
router.get('/projects/:key', authenticate, projCtrl.getProjectByKey);
router.post('/projects', authenticate, projCtrl.createProject);

// Work Items & Kanban
router.get('/work-items', authenticate, workItemCtrl.getWorkItems);
router.post('/work-items', authenticate, workItemCtrl.createWorkItem);
router.patch('/work-items/:id', authenticate, workItemCtrl.updateWorkItem);
router.put('/work-items/:id', authenticate, workItemCtrl.updateWorkItem);
router.delete('/work-items/:id', authenticate, workItemCtrl.deleteWorkItem);
router.get('/work-items/:id/history', authenticate, workItemCtrl.getWorkItemHistory);
router.post('/work-items/:id/comments', authenticate, workItemCtrl.addComment);
router.post('/work-items/dependencies', authenticate, workItemCtrl.addDependency);

// Sprints
router.get('/sprints', authenticate, sprintCtrl.getSprints);
router.get('/sprints/velocity', authenticate, sprintCtrl.getTeamVelocity);
router.post('/sprints', authenticate, requireRole('PROJECT_MANAGER'), sprintCtrl.createSprint);
router.post('/sprints/:id/start', authenticate, requireRole('PROJECT_MANAGER'), sprintCtrl.startSprint);
router.post('/sprints/:id/complete', authenticate, requireRole('PROJECT_MANAGER'), sprintCtrl.completeSprint);
router.get('/sprints/:id/capacity', authenticate, sprintCtrl.getSprintCapacity);
router.get('/sprints/:id/metrics', authenticate, sprintCtrl.getSprintMetrics);

// Chat & Messaging
router.get('/chat/channels', authenticate, chatCtrl.getChannels);
router.post('/chat/channels', authenticate, chatCtrl.createChannel);
router.get('/chat/conversations', authenticate, chatCtrl.getConversations);
router.post('/chat/conversations/dm', authenticate, chatCtrl.getOrCreateDM);
router.get('/chat/messages', authenticate, chatCtrl.getMessages);
router.post('/chat/messages', authenticate, chatCtrl.sendMessage);
router.patch('/chat/messages/:id', authenticate, chatCtrl.editMessage);
router.delete('/chat/messages/:id', authenticate, chatCtrl.deleteMessage);
router.post('/chat/messages/:id/reactions', authenticate, chatCtrl.toggleReaction);
router.post('/chat/messages/:id/create-task', authenticate, chatCtrl.createTaskFromMessage);
router.post('/chat/share-work-item', authenticate, chatCtrl.shareWorkItemToChat);
router.get('/chat/search', authenticate, chatCtrl.searchChat);
router.post('/chat/read', authenticate, chatCtrl.markReadState);

// Analytics & Reporting
router.get('/analytics', authenticate, analyticsCtrl.getAnalytics);
router.get('/analytics/team', authenticate, analyticsCtrl.getTeamAnalytics);
router.get('/analytics/flow', authenticate, analyticsCtrl.getFlowAnalytics);
router.get('/analytics/bugs', authenticate, analyticsCtrl.getBugAnalytics);
router.get('/analytics/members/:id?', authenticate, analyticsCtrl.getMemberAnalytics);
router.get('/analytics/export', authenticate, analyticsCtrl.exportAnalyticsCSV);
router.get('/analytics/reports', authenticate, requireRole('PROJECT_MANAGER'), analyticsCtrl.getSavedReports);
router.post('/analytics/reports', authenticate, requireRole('PROJECT_MANAGER'), analyticsCtrl.createSavedReport);

// Portfolio & Forecasting
router.get('/analytics/portfolio', authenticate, requireRole('PROJECT_MANAGER'), portfolioCtrl.getPortfolioAnalytics);
router.get('/v1/portfolio/intelligence', authenticate, requireRole('PROJECT_MANAGER'), portfolioCtrl.getPortfolioAnalytics);

// Risk Engine
router.get('/analytics/risks', authenticate, riskCtrl.getRiskObservations);
router.post('/analytics/risks', authenticate, riskCtrl.createRiskObservation);
router.patch('/analytics/risks/:id/resolve', authenticate, riskCtrl.resolveRiskObservation);

// Executive Dashboard & Schedules
router.get('/analytics/executive', authenticate, requireRole('PROJECT_MANAGER'), reportBuilderCtrl.getExecutiveDashboard);
router.get('/v1/executive/reports', authenticate, requireRole('PROJECT_MANAGER'), reportBuilderCtrl.getExecutiveDashboard);
router.get('/analytics/schedules', authenticate, requireRole('PROJECT_MANAGER'), reportBuilderCtrl.getScheduledReports);
router.post('/analytics/schedules', authenticate, requireRole('PROJECT_MANAGER'), reportBuilderCtrl.createScheduledReport);

// Notifications
router.get('/notifications', authenticate, notifCtrl.getNotifications);
router.patch('/notifications/mark-all-read', authenticate, notifCtrl.markAllAsRead);
router.patch('/notifications/:id/read', authenticate, notifCtrl.markAsRead);
router.get('/notifications/preferences', authenticate, notifCtrl.getNotificationPreferences);
router.put('/notifications/preferences', authenticate, notifCtrl.updateNotificationPreferences);

// Calendar
router.get('/calendar/events', authenticate, calendarCtrl.getCalendarEvents);
router.patch('/calendar/work-items/:id/due-date', authenticate, calendarCtrl.updateDueDate);

// Global Search
router.get('/search', authenticate, searchCtrl.globalSearch);

// Files
router.get('/files', authenticate, fileCtrl.getFiles);
router.post('/files', authenticate, fileCtrl.uploadMiddleware.single('file'), fileCtrl.uploadFile);

// Feedback
router.post('/feedback', authenticate, feedbackCtrl.submitFeedback);
router.get('/feedback', authenticate, feedbackCtrl.getFeedbacks);

// Integrations & Development
router.get('/integrations', authenticate, integrationCtrl.getIntegrations);
router.post('/integrations', authenticate, integrationCtrl.createIntegration);
router.get('/integrations/logs', authenticate, integrationCtrl.getIntegrationEventLogs);
router.get('/work-items/:id/development', authenticate, integrationCtrl.getWorkItemDevelopmentActivity);

// GitHub UI Configuration
router.get('/integrations/github/config', authenticate, requireRole('ADMIN'), githubConfigCtrl.getGitHubConfig);
router.post('/integrations/github/config', authenticate, requireRole('ADMIN'), githubConfigCtrl.saveGitHubConfig);
router.post('/integrations/github/config/test', authenticate, requireRole('ADMIN'), githubConfigCtrl.testGitHubConfig);
router.delete('/integrations/github/config', authenticate, requireRole('ADMIN'), githubConfigCtrl.deleteGitHubConfig);

// Google Workspace Configuration & Auth
router.get('/integrations/google/config', authenticate, requireRole('ADMIN'), googleConfigCtrl.getGoogleConfigHandler);
router.post('/integrations/google/config', authenticate, requireRole('ADMIN'), googleConfigCtrl.updateGoogleConfigHandler);
router.post('/integrations/google/config/test', authenticate, requireRole('ADMIN'), googleConfigCtrl.testGoogleConnectionHandler);
router.delete('/integrations/google/config', authenticate, requireRole('ADMIN'), googleConfigCtrl.deleteGoogleConfigHandler);

router.get('/integrations/google/auth', authenticate, googleAuthCtrl.getAuthUrlHandler);
router.post('/integrations/google/callback', authenticate, googleAuthCtrl.handleGoogleCallbackHandler);
router.get('/integrations/google/status', authenticate, googleAuthCtrl.getConnectionStatusHandler);
router.delete('/integrations/google/disconnect', authenticate, googleAuthCtrl.disconnectGoogleHandler);

// Google Calendar & Meet APIs
router.post('/google/meetings', authenticate, googleMeetingCtrl.createMeetingHandler);
router.get('/google/meetings', authenticate, googleMeetingCtrl.listMeetingsHandler);
router.get('/google/meetings/:id', authenticate, googleMeetingCtrl.getMeetingDetailsHandler);
router.patch('/google/meetings/:id', authenticate, googleMeetingCtrl.updateMeetingHandler);
router.delete('/google/meetings/:id', authenticate, googleMeetingCtrl.deleteMeetingHandler);
router.post('/google/meetings/sync', authenticate, googleMeetingCtrl.syncMeetingsHandler);
router.post('/google/meetings/freebusy', authenticate, googleMeetingCtrl.checkFreeBusyHandler);
router.get('/integrations/google/events', authenticate, googleMeetingCtrl.listMeetingsHandler);
router.post('/integrations/google/events', authenticate, googleMeetingCtrl.createMeetingHandler);

// Google Drive APIs
router.post('/google/drive/upload', authenticate, googleDriveCtrl.uploadDriveMiddleware, googleDriveCtrl.uploadDriveFileHandler);
router.get('/google/drive/files', authenticate, googleDriveCtrl.listDriveFilesHandler);
router.get('/google/drive/files/:id/download', authenticate, googleDriveCtrl.downloadDriveFileHandler);
router.delete('/google/drive/files/:id', authenticate, googleDriveCtrl.deleteDriveFileHandler);

// GitHub OAuth & REST APIs
router.get('/integrations/github/auth', authenticate, githubCtrl.initiateGitHubOAuth);
router.post('/integrations/github/callback', authenticate, githubCtrl.handleGitHubOAuthCallback);
router.get('/integrations/github/status', authenticate, githubCtrl.getGitHubConnectionStatus);
router.get('/integrations/github/health', authenticate, githubCtrl.getGitHubConnectionHealth);
router.delete('/integrations/github/disconnect', authenticate, githubCtrl.disconnectGitHub);
router.get('/integrations/github/debug-test', authenticate, githubCtrl.debugTestGitHubUserToken);
router.get('/integrations/github/repos', authenticate, githubCtrl.getGitHubRepositories);
router.get('/integrations/github/repos/:owner/:repo/branches', authenticate, githubCtrl.getGitHubBranches);
router.get('/integrations/github/repos/:owner/:repo/commits', authenticate, githubCtrl.getGitHubCommits);
router.get('/integrations/github/repos/:owner/:repo/pulls', authenticate, githubCtrl.getGitHubPullRequests);
router.get('/integrations/github/repos/:owner/:repo/pulls/:pullNumber/reviews', authenticate, githubCtrl.getGitHubPullRequestReviews);
router.get('/integrations/github/repos/:owner/:repo/commits/:ref/check-runs', authenticate, githubCtrl.getGitHubCommitCheckRuns);
router.post('/integrations/github/repos/:owner/:repo/branches', authenticate, githubCtrl.createGitHubBranch);

// Work Item ↔ GitHub Engineering Workflow APIs
router.post('/github/work-items/:workItemId/branches', authenticate, githubCtrl.createWorkItemBranch);
router.post('/github/work-items/:workItemId/pulls', authenticate, githubCtrl.createWorkItemPullRequest);
router.get('/github/work-items/:workItemId/development', authenticate, githubCtrl.getWorkItemDevelopmentSummary);
router.get('/github/projects/:projectId/development', authenticate, githubCtrl.getProjectDevelopmentView);

// Webhooks
router.post('/webhooks/github', webhookCtrl.handleGitHubWebhook);

// Automations Engine (Phase 53 Enterprise Rules Engine)
router.get('/automations', authenticate, automationCtrl.getAutomationRules);
router.get('/automations/metrics', authenticate, automationCtrl.getAutomationMetrics);
router.get('/automations/logs', authenticate, automationCtrl.getAutomationLogs);
router.post('/automations/test', authenticate, automationCtrl.testAutomationRule);
router.post('/automations/logs/:logId/retry', authenticate, automationCtrl.retryAutomationExecution);
router.get('/automations/:id', authenticate, automationCtrl.getAutomationRuleById);
router.post('/automations', authenticate, automationCtrl.createAutomationRule);
router.patch('/automations/:id', authenticate, automationCtrl.updateAutomationRule);
router.patch('/automations/:id/toggle', authenticate, automationCtrl.toggleAutomationRule);
router.delete('/automations/:id', authenticate, automationCtrl.deleteAutomationRule);

// Daily Team Digest
router.get('/digest', authenticate, digestCtrl.getDailyDigest);

// AI Copilot & Natural-Language Operations
router.get('/copilot/health', authenticate, copilotCtrl.healthCheck);
router.post('/copilot/ask', authenticate, copilotCtrl.askCopilot);
router.post('/ai/query', authenticate, copilotCtrl.askCopilot);
router.get('/copilot/stream', authenticate, copilotCtrl.streamCopilot);
router.post('/copilot/stream', authenticate, copilotCtrl.streamCopilot);
router.post('/copilot/confirm', authenticate, copilotCtrl.confirmCopilotMutation);
router.get('/copilot/conversations', authenticate, copilotCtrl.getAiConversations);
router.get('/copilot/conversations/:id', authenticate, copilotCtrl.getAiConversationMessages);
router.get('/copilot/logs', authenticate, requireRole('ADMIN'), copilotCtrl.getAiAuditLogs);
router.get('/copilot/settings', authenticate, requireRole('ADMIN'), copilotCtrl.getAiSettings);

// Enterprise v1 Platform APIs
router.get('/v1/keys', authenticate, requireRole('ADMIN'), apiKeyCtrl.getApiKeys);
router.post('/v1/keys', authenticate, requireRole('ADMIN'), apiKeyCtrl.createApiKey);
router.delete('/v1/keys/:id', authenticate, requireRole('ADMIN'), apiKeyCtrl.revokeApiKey);

router.get('/v1/webhooks', authenticate, requireRole('ADMIN'), customerWebhookCtrl.getCustomerWebhooks);
router.post('/v1/webhooks', authenticate, requireRole('ADMIN'), customerWebhookCtrl.createCustomerWebhook);

router.get('/v1/security', authenticate, requireRole('ADMIN'), securityCenterCtrl.getSecurityCenterOverview);
router.get('/security/allowlist', authenticate, requireRole('ADMIN'), allowlistCtrl.getAllowlistAccounts);
router.post('/security/allowlist', authenticate, requireRole('ADMIN'), allowlistCtrl.addAllowlistAccount);
router.patch('/security/allowlist/:id', authenticate, requireRole('ADMIN'), allowlistCtrl.updateAllowlistAccount);
router.delete('/security/allowlist/:id', authenticate, requireRole('ADMIN'), allowlistCtrl.deleteAllowlistAccount);
router.get('/security/access-requests', authenticate, requireRole('ADMIN'), allowlistCtrl.getAccessRequests);
router.post('/security/access-requests/:id/review', authenticate, requireRole('ADMIN'), allowlistCtrl.reviewAccessRequest);
router.get('/security/overview', authenticate, requireRole('ADMIN'), allowlistCtrl.getSecurityOverview);

// Standard Admin Auth-Allowlist & Security API endpoints
router.get('/admin/auth-allowlist', authenticate, requireRole('ADMIN'), allowlistCtrl.getAllowlistAccounts);
router.post('/admin/auth-allowlist', authenticate, requireRole('ADMIN'), allowlistCtrl.addAllowlistAccount);
router.patch('/admin/auth-allowlist/:id', authenticate, requireRole('ADMIN'), allowlistCtrl.updateAllowlistAccount);
router.delete('/admin/auth-allowlist/:id', authenticate, requireRole('ADMIN'), allowlistCtrl.deleteAllowlistAccount);

router.get('/access-requests', authenticate, requireRole('ADMIN'), allowlistCtrl.getAccessRequests);
router.post('/access-requests/:id/review', authenticate, requireRole('ADMIN'), allowlistCtrl.reviewAccessRequest);
router.get('/auth/allowlist', authenticate, requireRole('ADMIN'), allowlistCtrl.getAllowlistAccounts);
router.get('/credentials', authenticate, requireRole('ADMIN'), apiKeyCtrl.getApiKeys);

// Commercial Billing & Support
router.get('/v1/billing', authenticate, requireRole('ADMIN'), billingCtrl.getBillingOverview);
router.post('/v1/billing/upgrade', authenticate, requireRole('ADMIN'), billingCtrl.upgradeSubscription);
router.post('/v1/support', authenticate, supportCtrl.createSupportTicket);
router.get('/v1/support', authenticate, supportCtrl.getSupportTickets);

// Public SaaS Onboarding & Signup
router.post('/auth/public-signup', saasOnboardCtrl.publicSignupAndOnboard);

// Product Templates & Extensibility
router.get('/v1/templates', authenticate, templateCtrl.getProjectTemplates);
router.post('/v1/templates', authenticate, templateCtrl.createProjectTemplate);
router.post('/v1/templates/instantiate', authenticate, templateCtrl.createProjectFromTemplate);

// Developer Platform & Webhook Testing
router.get('/v1/oauth/apps', authenticate, requireRole('ADMIN'), devPlatformCtrl.getOAuthApps);
router.post('/v1/oauth/apps', authenticate, requireRole('ADMIN'), devPlatformCtrl.createOAuthApp);
router.post('/v1/webhooks/:id/test', authenticate, requireRole('ADMIN'), devPlatformCtrl.testWebhookEvent);

// Feedback & Product Activation Telemetry
router.post('/v1/feedback', authenticate, feedbackCtrl.submitFeedback);
router.get('/v1/activation', authenticate, feedbackCtrl.getActivationScore);

// Knowledge Hub & Internal Wiki
router.get('/v1/knowledge', authenticate, knowledgeCtrl.getKnowledgePages);
router.post('/v1/knowledge', authenticate, knowledgeCtrl.createKnowledgePage);
router.put('/v1/knowledge/:id', authenticate, knowledgeCtrl.updateKnowledgePage);
router.post('/v1/knowledge/:id/convert', authenticate, knowledgeCtrl.convertPageToWorkItem);

// Decision Log
router.get('/v1/decisions', authenticate, decisionCtrl.getDecisions);
router.post('/v1/decisions', authenticate, decisionCtrl.createDecision);
router.post('/v1/decisions/:id/supersede', authenticate, decisionCtrl.supersedeDecision);

// Meeting Workspace
router.get('/v1/meetings', authenticate, meetingCtrl.getMeetings);
router.post('/v1/meetings', authenticate, meetingCtrl.createMeeting);
router.post('/v1/meetings/:id/convert-action', authenticate, meetingCtrl.convertActionItemToTask);

// Project Updates
router.get('/v1/updates', authenticate, projectUpdateCtrl.getProjectUpdates);
router.post('/v1/updates', authenticate, projectUpdateCtrl.createProjectUpdate);
router.post('/v1/updates/ai-draft', authenticate, projectUpdateCtrl.aiDraftProjectUpdate);

// Unified Collaboration Search & AI Q&A
router.get('/v1/collaboration/search', authenticate, collabSearchCtrl.globalCollaborationSearch);
router.post('/v1/collaboration/ai-search', authenticate, collabSearchCtrl.aiCollaborationSearch);

// Mobile & PWA Push Notifications & Session Security
router.post('/v1/push/subscribe', authenticate, pushCtrl.subscribePush);
router.post('/v1/push/test', authenticate, pushCtrl.testPushNotification);
router.get('/v1/sessions', authenticate, pushCtrl.getUserSessions);
router.post('/v1/sessions/revoke', authenticate, pushCtrl.revokeUserSession);

// Offline Mutation Sync Queue
router.post('/v1/offline/sync', authenticate, offlineSyncCtrl.processOfflineSyncQueue);

// Enterprise Workflows & State Transitions
router.get('/v1/workflows', authenticate, workflowCtrl.getWorkflows);
router.post('/v1/workflows', authenticate, workflowCtrl.createWorkflow);
router.post('/v1/workflows/assign', authenticate, workflowCtrl.assignProjectWorkflow);
router.post('/v1/work-items/:id/transition', authenticate, workflowCtrl.transitionWorkItem);

// Custom Work Item Types & Custom Fields Framework
router.get('/v1/custom-fields', authenticate, customFieldCtrl.getCustomFields);
router.post('/v1/custom-fields', authenticate, customFieldCtrl.createCustomField);
router.post('/v1/custom-types', authenticate, customFieldCtrl.createCustomWorkItemType);
router.post('/v1/custom-values', authenticate, customFieldCtrl.saveCustomFieldValues);

// Generic Approval Framework
router.get('/v1/approvals', authenticate, approvalCtrl.getApprovalRequests);
router.post('/v1/approvals', authenticate, approvalCtrl.createApprovalRequest);
router.post('/v1/approvals/:id/respond', authenticate, approvalCtrl.respondToApproval);

// Governance Center & Policy Engine
router.get('/v1/governance/policies', authenticate, requireRole('ADMIN'), governanceCtrl.getOrganizationPolicies);
router.post('/v1/governance/policies', authenticate, requireRole('ADMIN'), governanceCtrl.updateOrganizationPolicy);
router.get('/v1/governance/health', authenticate, requireRole('ADMIN'), governanceCtrl.checkConfigurationHealth);

// Operational Excellence & Health Check Endpoints
router.get('/health/live', healthCtrl.getLiveness);
router.get('/health/ready', healthCtrl.getReadiness);
router.get('/health/deps', healthCtrl.getDependencyHealth);
router.get('/health/integrations', authenticate, healthCtrl.getIntegrationHealthDashboard);
router.get('/v1/ops/metrics', authenticate, requireRole('ADMIN'), opsCtrl.getOpsMetrics);
router.post('/v1/ops/jobs/enqueue', authenticate, requireRole('ADMIN'), opsCtrl.enqueueTestJob);
router.post('/v1/ops/webhooks/replay', authenticate, requireRole('ADMIN'), opsCtrl.replayWebhookEvent);

// Phase 34: Project Planning, Estimation, Pricing, Resource Allocation & Capacity Planning
router.get('/projects/:id/timeline', authenticate, requireRole('ADMIN'), planningCtrl.getProjectTimeline);
router.post('/projects/:id/dependencies', authenticate, requireRole('ADMIN'), planningCtrl.addProjectDependency);
router.delete('/projects/:id/dependencies/:dependencyId', authenticate, requireRole('ADMIN'), planningCtrl.deleteProjectDependency);

router.get('/projects/:id/milestones', authenticate, requireRole('ADMIN'), planningCtrl.getProjectMilestones);
router.post('/projects/:id/milestones', authenticate, requireRole('ADMIN'), planningCtrl.createProjectMilestone);
router.patch('/milestones/:milestoneId', authenticate, requireRole('ADMIN'), planningCtrl.updateProjectMilestone);
router.delete('/milestones/:milestoneId', authenticate, requireRole('ADMIN'), planningCtrl.deleteProjectMilestone);

router.patch('/work-items/:workItemId/estimate', authenticate, requireRole('ADMIN'), planningCtrl.updateWorkItemEstimate);
router.get('/work-items/:workItemId/estimate-history', authenticate, requireRole('ADMIN'), planningCtrl.getEstimateHistory);

router.get('/projects/:id/resources', authenticate, requireRole('PROJECT_MANAGER'), planningCtrl.getProjectResourceAllocations);
router.get('/projects/:id/price-allocation', authenticate, requireRole('PROJECT_MANAGER'), planningCtrl.getProjectResourceAllocations);
router.post('/projects/:id/resources/allocate', authenticate, requireRole('PROJECT_MANAGER'), planningCtrl.allocateProjectResource);
router.delete('/resource-allocations/:allocationId', authenticate, requireRole('PROJECT_MANAGER'), planningCtrl.deleteResourceAllocation);

router.get('/capacity', authenticate, requireRole('PROJECT_MANAGER'), planningCtrl.getCapacityPlanning);

// Pricing, Rate Cards, Scenarios, and Variance: Strictly ADMIN only
router.get('/projects/:id/pricing', authenticate, requireRole('ADMIN'), planningCtrl.getProjectPricing);
router.put('/projects/:id/pricing', authenticate, requireRole('ADMIN'), planningCtrl.updateProjectPricing);

router.get('/rate-cards', authenticate, requireRole('ADMIN'), planningCtrl.getRateCards);
router.post('/rate-cards', authenticate, requireRole('ADMIN'), planningCtrl.createRateCard);

router.get('/projects/:id/scenarios', authenticate, requireRole('ADMIN'), planningCtrl.getProjectScenarios);
router.post('/projects/:id/scenarios', authenticate, requireRole('ADMIN'), planningCtrl.createProjectScenario);
router.post('/scenarios/:scenarioId/apply', authenticate, requireRole('ADMIN'), planningCtrl.applyProjectScenario);

router.get('/projects/:id/variance', authenticate, requireRole('ADMIN'), planningCtrl.getProjectVariance);

export default router;
