import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../prisma.js';
import { evaluateTrigger, emitAutomationEvent } from '../services/automationEngine.js';
import { extractWorkItemHumanIds } from '../services/githubService.js';
import { getGitHubAppConfigForOrg } from '../services/githubConfigService.js';

export const handleGitHubWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const event = req.headers['x-github-event'] as string;
    const deliveryId = req.headers['x-github-delivery'] as string;

    const payload = req.body;
    if (!payload) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PAYLOAD', message: 'Payload is empty' } });
    }

    // Idempotency: Process each delivery ID only once
    if (deliveryId) {
      const existingLog = await prisma.integrationEventLog.findFirst({
        where: { id: `delivery-${deliveryId}` },
      });
      if (existingLog) {
        return res.json({ success: true, duplicate: true, message: 'Webhook event already processed' });
      }
    }

    // Find active GitHub integration
    const integration = await prisma.integration.findFirst({
      where: { provider: 'GITHUB', status: 'CONNECTED' },
    });

    const orgId = integration?.organizationId || '';
    const config = await getGitHubAppConfigForOrg(orgId);
    const webhookSecret = config.webhookSecret || process.env.GITHUB_WEBHOOK_SECRET;

    // Verify HMAC SHA256 Signature
    if (webhookSecret && signature) {
      const hmac = crypto.createHmac('sha256', webhookSecret);
      const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');
      if (signature !== digest) {
        return res.status(401).json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' } });
      }
    }

    const repoData = payload.repository;
    let repoRecord = null;
    if (repoData && integration) {
      repoRecord = await prisma.repository.upsert({
        where: { id: `repo-${repoData.id}` },
        update: {
          name: repoData.name,
          fullName: repoData.full_name,
          url: repoData.html_url,
          defaultBranch: repoData.default_branch || 'main',
        },
        create: {
          id: `repo-${repoData.id}`,
          integrationId: integration.id,
          name: repoData.name,
          fullName: repoData.full_name,
          url: repoData.html_url,
          defaultBranch: repoData.default_branch || 'main',
        },
      });
    }

    const linkedWorkItemIds: string[] = [];

    // ==========================================
    // EVENT 1: PULL REQUEST
    // ==========================================
    if (event === 'pull_request') {
      const prData = payload.pull_request;
      const action = payload.action; // opened, closed, reopened, synchronize, edited

      if (prData && repoData) {
        // Extract all work item IDs from PR title, branch, and body
        const textToSearch = `${prData.title} ${prData.head?.ref || ''} ${prData.body || ''}`;
        const humanIds = extractWorkItemHumanIds(textToSearch);

        for (const humanId of humanIds) {
          const item = await prisma.workItem.findFirst({
            where: { humanId, project: { organizationId: orgId } },
            include: { project: true },
          });

          if (item) {
            linkedWorkItemIds.push(item.id);

            // Upsert WorkItemGitHubLink
            const existingLink = await prisma.workItemGitHubLink.findFirst({
              where: {
                workItemId: item.id,
                repositoryFullName: repoData.full_name,
                pullRequestNumber: prData.number,
              },
            });

            if (!existingLink) {
              await prisma.workItemGitHubLink.create({
                data: {
                  organizationId: orgId,
                  workItemId: item.id,
                  repositoryFullName: repoData.full_name,
                  repositoryUrl: repoData.html_url,
                  branchName: prData.head?.ref || null,
                  pullRequestNumber: prData.number,
                  pullRequestTitle: prData.title,
                  pullRequestUrl: prData.html_url,
                  relationshipType: 'PULL_REQUEST',
                },
              });
            }

            // Upsert PullRequest model
            if (repoRecord) {
              const prStatus = prData.merged ? 'MERGED' : prData.state.toUpperCase();
              await prisma.pullRequest.upsert({
                where: { id: `pr-${repoRecord.id}-${prData.number}` },
                update: {
                  title: prData.title,
                  status: prStatus,
                  reviewStatus: prData.requested_reviewers?.length > 0 ? 'PENDING' : 'APPROVED',
                  mergedAt: prData.merged_at ? new Date(prData.merged_at) : null,
                  workItemId: item.id,
                },
                create: {
                  id: `pr-${repoRecord.id}-${prData.number}`,
                  repositoryId: repoRecord.id,
                  workItemId: item.id,
                  number: prData.number,
                  title: prData.title,
                  author: prData.user?.login || 'unknown',
                  status: prStatus,
                  reviewStatus: 'PENDING',
                  headBranch: prData.head?.ref || 'main',
                  baseBranch: prData.base?.ref || 'main',
                  url: prData.html_url,
                  mergedAt: prData.merged_at ? new Date(prData.merged_at) : null,
                },
              });
            }

            // State Transitions
            if (action === 'opened' || action === 'reopened') {
              if (item.status === 'TO_DO' || item.status === 'IN_PROGRESS') {
                await prisma.workItem.update({
                  where: { id: item.id },
                  data: { status: 'CODE_REVIEW' },
                });
                await prisma.workItemStatusHistory.create({
                  data: {
                    workItemId: item.id,
                    oldStatus: item.status,
                    newStatus: 'CODE_REVIEW',
                    changedById: item.reporterId,
                  },
                });
              }

              // Post chat notice if project channel exists
              const channel = await prisma.channel.findFirst({
                where: { projectId: item.projectId, organizationId: orgId },
              });
              if (channel) {
                await prisma.message.create({
                  data: {
                    channelId: channel.id,
                    senderId: item.reporterId,
                    content: `🚀 **Pull Request Opened:** [#${prData.number} ${prData.title}](${prData.html_url})\n` +
                      `Linked to Work Item: **${item.humanId} - ${item.title}**`,
                    messageType: 'SYSTEM',
                    workItemId: item.id,
                  },
                });
              }
            } else if (action === 'closed' && prData.merged) {
              // PR MERGED -> Move WorkItem to DONE
              await prisma.workItem.update({
                where: { id: item.id },
                data: { status: 'DONE' },
              });
              await prisma.workItemStatusHistory.create({
                data: {
                  workItemId: item.id,
                  oldStatus: item.status,
                  newStatus: 'DONE',
                  changedById: item.reporterId,
                },
              });

              // Add comment
              await prisma.workItemComment.create({
                data: {
                  workItemId: item.id,
                  authorId: item.reporterId,
                  content: `🎉 Pull Request [#${prData.number} ${prData.title}](${prData.html_url}) merged into \`${prData.base?.ref}\`. Work Item marked as **DONE**.`,
                },
              });

              // Post channel announcement
              const channel = await prisma.channel.findFirst({
                where: { projectId: item.projectId, organizationId: orgId },
              });
              if (channel) {
                await prisma.message.create({
                  data: {
                    channelId: channel.id,
                    senderId: item.reporterId,
                    content: `🎉 **Pull Request Merged:** [#${prData.number} ${prData.title}](${prData.html_url})\n` +
                      `Work Item **${item.humanId}** is now **DONE**.`,
                    messageType: 'SYSTEM',
                    workItemId: item.id,
                  },
                });
              }

              // Notify Assignee
              if (item.assigneeId) {
                await prisma.notification.create({
                  data: {
                    userId: item.assigneeId,
                    type: 'STATUS_CHANGE',
                    title: `PR Merged: ${item.humanId}`,
                    body: `Pull Request #${prData.number} was merged. ${item.humanId} moved to DONE.`,
                    link: `/projects/${item.project.key}`,
                  },
                });
              }
            } else if (action === 'closed' && !prData.merged) {
              await prisma.workItemComment.create({
                data: {
                  workItemId: item.id,
                  authorId: item.reporterId,
                  content: `⚠️ Pull Request [#${prData.number} ${prData.title}](${prData.html_url}) was closed without merge.`,
                },
              });
            }
          }
        }

        // Trigger Automation Rules with idempotency delivery key
        if (integration) {
          const triggerType = prData.merged ? 'GITHUB_PR_MERGED' : 'GITHUB_PR_OPENED';
          await emitAutomationEvent({
            organizationId: integration.organizationId,
            trigger: triggerType,
            workItemId: linkedWorkItemIds[0],
            eventId: deliveryId || `pr-${prData.id}-${prData.updated_at || Date.now()}`,
            source: 'GITHUB_WEBHOOK',
            data: {
              prNumber: prData.number,
              prTitle: prData.title,
              prUrl: prData.html_url,
              merged: prData.merged,
              repositoryFullName: repoData.full_name,
            },
          });
        }
      }
    }

    // ==========================================
    // EVENT 2: PUSH (COMMITS)
    // ==========================================
    if (event === 'push') {
      const commits = payload.commits || [];
      const refBranch = payload.ref ? payload.ref.replace('refs/heads/', '') : '';

      for (const commit of commits) {
        const textToSearch = `${commit.message} ${refBranch}`;
        const humanIds = extractWorkItemHumanIds(textToSearch);

        for (const humanId of humanIds) {
          const item = await prisma.workItem.findFirst({
            where: { humanId, project: { organizationId: orgId } },
          });

          if (item) {
            linkedWorkItemIds.push(item.id);

            const existingLink = await prisma.workItemGitHubLink.findFirst({
              where: {
                workItemId: item.id,
                commitSha: commit.id,
              },
            });

            if (!existingLink) {
              await prisma.workItemGitHubLink.create({
                data: {
                  organizationId: orgId,
                  workItemId: item.id,
                  repositoryFullName: repoData?.full_name || '',
                  repositoryUrl: repoData?.html_url || '',
                  branchName: refBranch,
                  commitSha: commit.id,
                  commitMessage: commit.message,
                  relationshipType: 'COMMIT',
                },
              });
            }
          }
        }
      }
    }

    // Log Integration Event for audit & idempotency
    if (integration) {
      await prisma.integrationEventLog.create({
        data: {
          id: deliveryId ? `delivery-${deliveryId}` : undefined,
          integrationId: integration.id,
          provider: 'GITHUB',
          eventType: event || 'unknown',
          payload: JSON.stringify(payload),
          status: 'SUCCESS',
        },
      });
    }

    return res.json({
      success: true,
      event,
      deliveryId,
      linkedWorkItemsCount: linkedWorkItemIds.length,
      linkedWorkItemIds,
    });
  } catch (error: any) {
    console.error('[Webhook Controller Error]', error);
    return res.status(500).json({ success: false, error: { code: 'WEBHOOK_ERROR', message: error.message } });
  }
};
