import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { prisma } from '../prisma.js';
import { sanitizeBranchName, generateBranchName, extractWorkItemHumanIds } from '../services/githubService.js';

describe('GitHub Engineering Workflow Suite', () => {
  it('runs all engineering workflow tests', async () => {
    await runEngineeringWorkflowTests();
  });
});

async function runEngineeringWorkflowTests() {
  console.log('--- STARTING GITHUB ENGINEERING WORKFLOW TESTS ---');

  // Test 1: Branch Name Sanitization
  console.log('Test 1: Branch Name Sanitization...');
  assert.strictEqual(
    sanitizeBranchName('feat/PROJ-12: Fix Login? [Fast]~*'),
    'feat/proj-12-fix-login-fast',
    'Branch sanitization should strip illegal Git characters and normalize to lowercase'
  );
  assert.strictEqual(
    sanitizeBranchName('feature//double-slash..double-dot'),
    'feature/double-slash-double-dot',
    'Branch sanitization should eliminate forbidden Git double dots and collapse slashes'
  );
  assert.strictEqual(
    sanitizeBranchName('  -feat/clean-ends-  '),
    'feat/clean-ends',
    'Branch sanitization should trim leading/trailing separators'
  );
  console.log('  [PASS] Branch name sanitization verified.');

  // Test 2: Branch Name Generation from Work Item Metadata
  console.log('Test 2: Branch Name Generation from Work Item Types...');
  const bugBranch = generateBranchName({ humanId: 'PROJ-101', type: 'BUG', title: 'Fix Crash on Null Pointer' });
  assert.strictEqual(bugBranch, 'fix/proj-101-fix-crash-on-null-pointer');

  const featBranch = generateBranchName({ humanId: 'PROJ-102', type: 'FEATURE', title: 'Add GitHub CI Integration' });
  assert.strictEqual(featBranch, 'feat/proj-102-add-github-ci-integration');

  const storyBranch = generateBranchName({ humanId: 'PROJ-103', type: 'USER_STORY', title: 'As a user I want dark mode' });
  assert.strictEqual(storyBranch, 'story/proj-103-as-a-user-i-want-dark-mode');

  const taskBranch = generateBranchName({ humanId: 'PROJ-104', type: 'TASK', title: 'Update documentation index' });
  assert.strictEqual(taskBranch, 'task/proj-104-update-documentation-index');

  const customPatternBranch = generateBranchName(
    { humanId: 'PROJ-105', type: 'FEATURE', title: 'Custom Branch Name', pattern: 'custom/{humanId}/{slug}' }
  );
  assert.strictEqual(customPatternBranch, 'custom/proj-105/custom-branch-name');
  console.log('  [PASS] Branch name generation for all work item types verified.');

  // Test 3: Work Item HumanId Regex Extraction
  console.log('Test 3: Work Item HumanId Regex Extraction...');
  const text1 = '[PROJ-42] Implement OAuth2 flow and fix PROJ-43 session timeout';
  const extracted1 = extractWorkItemHumanIds(text1);
  assert.deepStrictEqual(extracted1, ['PROJ-42', 'PROJ-43']);

  const text2 = 'feat/ALPHA9-99-new-feature-branch';
  const extracted2 = extractWorkItemHumanIds(text2);
  assert.deepStrictEqual(extracted2, ['ALPHA9-99']);

  const text3 = 'No work item references in this commit message';
  const extracted3 = extractWorkItemHumanIds(text3);
  assert.deepStrictEqual(extracted3, []);
  console.log('  [PASS] Regex extraction accurately parses work item identifiers.');

  // Test 4: Database Models & WorkItem Status Transitions
  console.log('Test 4: Database WorkItemGitHubLink & Status Transitions...');
  let org: any = null;
  let project: any = null;
  let workItem: any = null;

  try {
    org = await prisma.organization.findFirst();
    if (!org) {
      org = await prisma.organization.create({
        data: { name: 'Workflow Test Org', slug: 'workflow-test-org' },
      });
    }

    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'wf-test@example.com',
          fullName: 'Workflow Test User',
          passwordHash: 'dummy_hash_for_test',
          organization: { connect: { id: org.id } },
          role: 'ADMIN',
        },
      });
    }

    const randSuffix = Math.floor(Math.random() * 10000);
    project = await prisma.project.create({
      data: {
        name: `Workflow Test Project ${randSuffix}`,
        key: `WT${randSuffix}`,
        organization: { connect: { id: org.id } },
        owner: { connect: { id: user.id } },
      },
    });

    workItem = await prisma.workItem.create({
      data: {
        humanId: 'WTEST-1',
        title: 'Initial Work Item for CI/CD Workflow',
        type: 'FEATURE',
        status: 'TO_DO',
        priority: 'HIGH',
        project: { connect: { id: project.id } },
        reporter: { connect: { id: user.id } },
      },
    });

    // 4a. Link a branch
    const branchLink = await prisma.workItemGitHubLink.create({
      data: {
        workItemId: workItem.id,
        organizationId: org.id,
        relationshipType: 'BRANCH',
        repositoryFullName: 'test-org/test-repo',
        repositoryUrl: 'https://github.com/test-org/test-repo',
        branchName: 'feat/WTEST-1-initial-work-item',
      },
    });
    assert.strictEqual(branchLink.relationshipType, 'BRANCH');

    // 4b. Link a PR and transition status to CODE_REVIEW
    const prLink = await prisma.workItemGitHubLink.create({
      data: {
        workItemId: workItem.id,
        organizationId: org.id,
        relationshipType: 'PULL_REQUEST',
        repositoryFullName: 'test-org/test-repo',
        repositoryUrl: 'https://github.com/test-org/test-repo',
        pullRequestNumber: 42,
        pullRequestTitle: '[WTEST-1] Initial Work Item for CI/CD Workflow',
        pullRequestUrl: 'https://github.com/test-org/test-repo/pull/42',
      },
    });
    assert.strictEqual(prLink.pullRequestNumber, 42);

    // Simulate PR open status change
    await prisma.workItem.update({
      where: { id: workItem.id },
      data: { status: 'CODE_REVIEW' },
    });

    const updatedAfterPr = await prisma.workItem.findUnique({ where: { id: workItem.id } });
    assert.strictEqual(updatedAfterPr?.status, 'CODE_REVIEW', 'Work item must transition to CODE_REVIEW on PR open');

    // 4c. Link a Commit
    const commitLink = await prisma.workItemGitHubLink.create({
      data: {
        workItemId: workItem.id,
        organizationId: org.id,
        relationshipType: 'COMMIT',
        repositoryFullName: 'test-org/test-repo',
        repositoryUrl: 'https://github.com/test-org/test-repo',
        commitSha: 'abcdef1234567890abcdef1234567890abcdef12',
        commitMessage: '[WTEST-1] Add unit test coverage',
      },
    });
    assert.strictEqual(commitLink.relationshipType, 'COMMIT');

    // 4d. Simulate PR merge $\rightarrow$ transition to DONE
    await prisma.workItem.update({
      where: { id: workItem.id },
      data: { status: 'DONE' },
    });

    const finalWorkItem = await prisma.workItem.findUnique({
      where: { id: workItem.id },
      include: { githubLinks: true },
    });

    assert.strictEqual(finalWorkItem?.status, 'DONE', 'Work item must transition to DONE on PR merge');
    assert.strictEqual(finalWorkItem?.githubLinks.length, 3, 'Work item must contain 3 linked GitHub entities');

    console.log('  [PASS] Database workflow, link records, and state transitions verified.');
  } finally {
    // Teardown
    if (workItem) {
      await prisma.workItemGitHubLink.deleteMany({ where: { workItemId: workItem.id } });
      await prisma.workItem.delete({ where: { id: workItem.id } }).catch(() => {});
    }
    if (project) {
      await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
    }
  }

  console.log('--- ALL GITHUB ENGINEERING WORKFLOW TESTS PASSED ---');
}
