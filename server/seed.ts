import { PrismaClient } from '../client/prisma/client/index.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();


async function main() {
  console.log('[Seed] Cleaning existing database...');
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.fileAttachment.deleteMany({});
  await prisma.messageReaction.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.conversationMember.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.channelMember.deleteMany({});
  await prisma.channel.deleteMany({});
  await prisma.workItemTag.deleteMany({});
  await prisma.workItemComment.deleteMany({});
  await prisma.workItemDependency.deleteMany({});
  await prisma.workItemStatusHistory.deleteMany({});
  await prisma.workItem.deleteMany({});
  await prisma.sprint.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.teamMember.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organization.deleteMany({});

  console.log('[Seed] Creating Organization...');
  const org = await prisma.organization.create({
    data: {
      name: 'Demo Startup Inc.',
      slug: 'demo-startup',
      logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=60',
    },
  });

  const passwordHash = await bcrypt.hash('Password123!', 10);

  console.log('[Seed] Creating 6 Real Team Members...');
  const ashwin = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'ashwin.t@enterprise.local',
      fullName: 'Ashwin T',
      passwordHash,
      jobTitle: 'CEO · CTO · Manager',
      department: 'Leadership',
      role: 'OWNER',
      status: 'ONLINE',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    },
  });

  const raj = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'raj.mange@enterprise.local',
      fullName: 'Raj Mange',
      passwordHash,
      jobTitle: 'AI/ML Developer · Agentic AI Developer',
      department: 'Engineering',
      role: 'TEAM_MEMBER',
      status: 'ONLINE',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    },
  });

  const sai = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'sai.kiran@enterprise.local',
      fullName: 'Sai Kiran',
      passwordHash,
      jobTitle: 'Cloud Engineer · DevOps · Team Lead',
      department: 'Engineering',
      role: 'PROJECT_MANAGER',
      status: 'ONLINE',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
    },
  });

  const shashi = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'shashi@enterprise.local',
      fullName: 'Shashi',
      passwordHash,
      jobTitle: 'Digital Marketing Professional',
      department: 'Growth & Marketing',
      role: 'TEAM_MEMBER',
      status: 'ONLINE',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
    },
  });

  const ammar = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'ammar.raza@enterprise.local',
      fullName: 'Ammar Raza',
      passwordHash,
      jobTitle: 'AI/ML Developer',
      department: 'Engineering',
      role: 'TEAM_MEMBER',
      status: 'AWAY',
      avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop&q=80',
    },
  });

  const navya = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'navya.sri@enterprise.local',
      fullName: 'Navya Sri',
      passwordHash,
      jobTitle: 'Full Stack Developer',
      department: 'Engineering',
      role: 'TEAM_MEMBER',
      status: 'ONLINE',
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&auto=format&fit=crop&q=80',
    },
  });

  const users = [ashwin, raj, sai, shashi, ammar, navya];

  console.log('[Seed] Creating Teams...');
  const engTeam = await prisma.team.create({
    data: {
      organizationId: org.id,
      name: 'Engineering Team',
      description: 'Core backend, frontend, and infrastructure engineers.',
      teamLeadId: sai.id,
      capacityHours: 160,
      members: {
        create: [
          { userId: sai.id, role: 'LEAD' },
          { userId: raj.id, role: 'MEMBER' },
          { userId: ammar.id, role: 'MEMBER' },
          { userId: navya.id, role: 'MEMBER' },
        ],
      },
    },
  });

  const mktTeam = await prisma.team.create({
    data: {
      organizationId: org.id,
      name: 'Marketing & Design Team',
      description: 'UI/UX design, user acquisition, and branding.',
      teamLeadId: shashi.id,
      capacityHours: 80,
      members: {
        create: [
          { userId: shashi.id, role: 'LEAD' },
          { userId: ashwin.id, role: 'MEMBER' },
        ],
      },
    },
  });

  console.log('[Seed] Creating Projects...');
  const customerProj = await prisma.project.create({
    data: {
      organizationId: org.id,
      key: 'PROJ',
      name: 'Customer Platform',
      description: 'Main SaaS customer portal and dashboard experience.',
      ownerId: sai.id,
      status: 'ACTIVE',
      health: 'HEALTHY',
      startDate: new Date('2026-08-01'),
      targetDate: new Date('2026-10-31'),
      members: {
        create: users.map((u) => ({ userId: u.id })),
      },
    },
  });

  const internalProj = await prisma.project.create({
    data: {
      organizationId: org.id,
      key: 'INT',
      name: 'Internal Tool',
      description: 'Automated data pipeline, telemetry, and analytics dashboard.',
      ownerId: raj.id,
      status: 'ACTIVE',
      health: 'AT_RISK',
      startDate: new Date('2026-08-15'),
      targetDate: new Date('2026-11-15'),
      members: {
        create: [
          { userId: sai.id },
          { userId: raj.id },
          { userId: navya.id },
        ],
      },
    },
  });

  const clientProj = await prisma.project.create({
    data: {
      organizationId: org.id,
      key: 'CLI',
      name: 'Client Project',
      description: 'Custom API integrations and enterprise partner portal.',
      ownerId: ashwin.id,
      status: 'PLANNING',
      health: 'HEALTHY',
      startDate: new Date('2026-09-01'),
      targetDate: new Date('2026-12-01'),
      members: {
        create: [
          { userId: ashwin.id },
          { userId: shashi.id },
          { userId: ammar.id },
        ],
      },
    },
  });

  console.log('[Seed] Creating Sprints...');
  const sprint1 = await prisma.sprint.create({
    data: {
      projectId: customerProj.id,
      teamId: engTeam.id,
      name: 'Sprint 14 - Foundation & Auth',
      goal: 'Complete authentication system, registration API, and design system.',
      startDate: new Date('2026-08-25'),
      endDate: new Date('2026-09-08'),
      status: 'ACTIVE',
      committedPoints: 34,
      completedPoints: 24,
    },
  });

  const sprint2 = await prisma.sprint.create({
    data: {
      projectId: customerProj.id,
      teamId: engTeam.id,
      name: 'Sprint 15 - Payments & Workflows',
      goal: 'Stripe subscription checkout, billing portal, and email templates.',
      startDate: new Date('2026-09-09'),
      endDate: new Date('2026-09-23'),
      status: 'FUTURE',
      committedPoints: 28,
      completedPoints: 0,
    },
  });

  console.log('[Seed] Creating DevOps Work Items & Hierarchy...');

  // Epic 1
  const epic1 = await prisma.workItem.create({
    data: {
      projectId: customerProj.id,
      humanId: 'PROJ-101',
      title: 'Customer Onboarding & Identity System',
      description: 'Comprehensive epic for authentication, organization multi-tenancy, and security.',
      type: 'EPIC',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      reporterId: sai.id,
      assigneeId: sai.id,
      storyPoints: 21,
    },
  });

  // Feature 1 under Epic 1
  const feat1 = await prisma.workItem.create({
    data: {
      projectId: customerProj.id,
      humanId: 'PROJ-102',
      title: 'User Registration & Auth Flow',
      description: 'JWT token management, login UI, and signup validation.',
      type: 'FEATURE',
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      reporterId: sai.id,
      assigneeId: raj.id,
      parentId: epic1.id,
      sprintId: sprint1.id,
      storyPoints: 13,
      dueDate: new Date('2026-09-05'),
    },
  });

  // Stories & Tasks under Feature 1
  const story1 = await prisma.workItem.create({
    data: {
      projectId: customerProj.id,
      humanId: 'PROJ-103',
      title: 'User registration with email & password',
      description: 'Form with email, password validation, and bcrypt hashing.',
      type: 'USER_STORY',
      status: 'DONE',
      priority: 'HIGH',
      reporterId: sai.id,
      assigneeId: raj.id,
      parentId: feat1.id,
      sprintId: sprint1.id,
      storyPoints: 8,
      estimatedHours: 12,
      actualHours: 10,
    },
  });

  const task1 = await prisma.workItem.create({
    data: {
      projectId: customerProj.id,
      humanId: 'PROJ-104',
      title: 'Build Registration Express API endpoint',
      description: 'Implement `/api/auth/register` with Zod validation.',
      type: 'TASK',
      status: 'DONE',
      priority: 'HIGH',
      reporterId: raj.id,
      assigneeId: raj.id,
      parentId: story1.id,
      sprintId: sprint1.id,
      storyPoints: 5,
    },
  });

  const task2 = await prisma.workItem.create({
    data: {
      projectId: customerProj.id,
      humanId: 'PROJ-105',
      title: 'Build Registration React Form with Tailwind CSS',
      description: 'Responsive login and signup forms with toast alerts.',
      type: 'TASK',
      status: 'CODE_REVIEW',
      priority: 'MEDIUM',
      reporterId: raj.id,
      assigneeId: navya.id,
      parentId: story1.id,
      sprintId: sprint1.id,
      storyPoints: 5,
    },
  });

  const bug1 = await prisma.workItem.create({
    data: {
      projectId: customerProj.id,
      humanId: 'BUG-101',
      title: 'Registration fails when entering special characters in password',
      description: 'Password containing & or % throws 500 error in auth middleware.',
      type: 'BUG',
      status: 'BLOCKED',
      priority: 'URGENT',
      severity: 'CRITICAL',
      reporterId: navya.id,
      assigneeId: navya.id,
      sprintId: sprint1.id,
      storyPoints: 3,
      blockedReason: 'Waiting for regex decoder fix in shared utility library.',
      environment: 'Staging / Chrome 128',
      stepsToReproduce: '1. Go to /signup\n2. Enter password "P@ss%word&1"\n3. Click Submit',
      expectedResult: 'Account created successfully.',
      actualResult: 'HTTP 500 Internal Server Error returned.',
    },
  });

  const task3 = await prisma.workItem.create({
    data: {
      projectId: customerProj.id,
      humanId: 'PROJ-106',
      title: 'Implement RBAC Middleware for Organization Roles',
      description: 'Protect routes based on OWNER, ADMIN, MEMBER, VIEWER.',
      type: 'TASK',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      reporterId: sai.id,
      assigneeId: sai.id,
      sprintId: sprint1.id,
      storyPoints: 5,
      dueDate: new Date('2026-09-04'),
    },
  });

  // Internal Tool Items
  const intTask1 = await prisma.workItem.create({
    data: {
      projectId: internalProj.id,
      humanId: 'INT-101',
      title: 'Build Data Telemetry Pipeline for Analytics',
      description: 'Aggregate system activity log metrics into summary tables.',
      type: 'TASK',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      reporterId: raj.id,
      assigneeId: sai.id,
      storyPoints: 8,
    },
  });

  // Seed Status History for realistic Cycle & Lead time metrics
  console.log('[Seed] Generating Historical Status Transitions...');
  const pastDates = [
    new Date('2026-08-26T09:00:00Z'),
    new Date('2026-08-27T14:30:00Z'),
    new Date('2026-08-29T11:15:00Z'),
    new Date('2026-08-31T16:00:00Z'),
  ];

  await prisma.workItemStatusHistory.createMany({
    data: [
      { workItemId: story1.id, oldStatus: 'CREATED', newStatus: 'TO_DO', changedById: sai.id, changedAt: pastDates[0] },
      { workItemId: story1.id, oldStatus: 'TO_DO', newStatus: 'IN_PROGRESS', changedById: raj.id, changedAt: pastDates[1] },
      { workItemId: story1.id, oldStatus: 'IN_PROGRESS', newStatus: 'DONE', changedById: raj.id, changedAt: pastDates[3] },
      { workItemId: task1.id, oldStatus: 'CREATED', newStatus: 'IN_PROGRESS', changedById: raj.id, changedAt: pastDates[1] },
      { workItemId: task1.id, oldStatus: 'IN_PROGRESS', newStatus: 'DONE', changedById: raj.id, changedAt: pastDates[2] },
      { workItemId: task2.id, oldStatus: 'CREATED', newStatus: 'IN_PROGRESS', changedById: navya.id, changedAt: pastDates[1] },
      { workItemId: task2.id, oldStatus: 'IN_PROGRESS', newStatus: 'CODE_REVIEW', changedById: navya.id, changedAt: pastDates[3] },
    ],
  });

  // Comments
  console.log('[Seed] Creating Work Item Discussions & Comments...');
  await prisma.workItemComment.createMany({
    data: [
      { workItemId: feat1.id, authorId: sai.id, content: 'API implementation looks solid. Please make sure special chars are escaped.' },
      { workItemId: feat1.id, authorId: raj.id, content: 'Will check validation. Adding unit test suite for auth controller today.' },
      { workItemId: bug1.id, authorId: navya.id, content: 'Logged bug details. Reproduction steps attached.' },
    ],
  });

  // Channels & Chat Messages
  console.log('[Seed] Creating Channels & Chat Messages...');
  const genChannel = await prisma.channel.create({
    data: {
      organizationId: org.id,
      name: 'general',
      description: 'Startup team announcements and general discussions',
      type: 'PUBLIC',
      members: { create: users.map((u) => ({ userId: u.id, role: 'MEMBER' })) },
    },
  });

  const annChannel = await prisma.channel.create({
    data: {
      organizationId: org.id,
      name: 'announcements',
      description: 'Official company-wide announcements',
      type: 'PUBLIC',
      members: { create: users.map((u) => ({ userId: u.id, role: 'MEMBER' })) },
    },
  });

  const engChannel = await prisma.channel.create({
    data: {
      organizationId: org.id,
      teamId: engTeam.id,
      name: 'engineering',
      description: 'Technical discussions & architecture',
      type: 'TEAM',
      members: { create: [sai, raj, ammar, navya].map((u) => ({ userId: u.id, role: 'MEMBER' })) },
    },
  });

  const mktChannel = await prisma.channel.create({
    data: {
      organizationId: org.id,
      teamId: mktTeam.id,
      name: 'marketing',
      description: 'Design system, Figma assets, and launch marketing',
      type: 'TEAM',
      members: { create: [shashi, ashwin].map((u) => ({ userId: u.id, role: 'MEMBER' })) },
    },
  });

  const randChannel = await prisma.channel.create({
    data: {
      organizationId: org.id,
      name: 'random',
      description: 'Watercooler, links, and casual banter',
      type: 'PUBLIC',
      members: { create: users.map((u) => ({ userId: u.id, role: 'MEMBER' })) },
    },
  });

  // Project Specific Channels
  const customerChannel = await prisma.channel.create({
    data: {
      organizationId: org.id,
      projectId: customerProj.id,
      name: 'customer-platform',
      description: 'Project discussions for Customer Platform',
      type: 'PROJECT',
      members: { create: [sai, raj, shashi, navya].map((u) => ({ userId: u.id, role: 'MEMBER' })) },
    },
  });

  await prisma.message.createMany({
    data: [
      { channelId: genChannel.id, senderId: sai.id, content: 'Welcome team! All 6 members are set up on the platform.' },
      { channelId: genChannel.id, senderId: shashi.id, content: 'Awesome! Sprint 14 marketing and design plans are ready.' },
      { channelId: engChannel.id, senderId: raj.id, content: 'Working on Agentic AI framework and core authentication.' },
      { channelId: engChannel.id, senderId: sai.id, content: 'Great job @Raj! DevOps pipeline is set up.' },
      { channelId: engChannel.id, senderId: navya.id, content: 'Frontend workstation updated with React 18 and clean design tokens.' },
      { channelId: customerChannel.id, senderId: ashwin.id, content: 'Kickoff meeting for Customer Platform sprint is complete.' },
    ],
  });

  // Direct Message Conversation
  const dmConv = await prisma.conversation.create({
    data: {
      organizationId: org.id,
      type: 'DIRECT',
      members: { create: [{ userId: sai.id }, { userId: raj.id }] },
    },
  });

  await prisma.message.createMany({
    data: [
      { conversationId: dmConv.id, senderId: sai.id, content: 'Hey Raj, how is the AI model coming along?' },
      { conversationId: dmConv.id, senderId: raj.id, content: 'Hi Sai! Model endpoints are built and tested. Pushing code now.' },
    ],
  });

  // Notifications
  console.log('[Seed] Creating Seed Notifications...');
  await prisma.notification.createMany({
    data: [
      { userId: raj.id, type: 'ASSIGNMENT', title: 'Assigned to PROJ-102', body: 'Sai assigned task to you.', link: '/boards?item=PROJ-102', isRead: false },
      { userId: sai.id, type: 'MENTION', title: 'Task Mentioned in Chat', body: 'Raj mentioned PROJ-102 in #engineering.', link: '/chat?channel=' + engChannel.id, isRead: false },
      { userId: navya.id, type: 'STATUS_CHANGE', title: 'Status update: BUG-101', body: 'Item moved to BLOCKED.', link: '/boards?item=BUG-101', isRead: true },
    ],
  });

  // Seed Phase 36 Closed Team Auth Allowlist
  console.log('[Seed] Seeding Phase 36 Closed Team Auth Allowlist...');
  const approvedAccounts = [
    { email: 'saikirankurapti@gmail.com', provider: 'GOOGLE', userId: sai.id, displayName: 'Sai Kiran (Admin Primary)', status: 'ACTIVE' },
    { email: 'saikiran.zerokost@gmail.com', provider: 'GOOGLE', userId: sai.id, displayName: 'Sai Kiran (Secondary)', status: 'ACTIVE' },
    { email: 'everythingdata789@gmail.com', provider: 'GOOGLE', userId: null, displayName: 'Authorized Google Identity', status: 'ACTIVE' },
    { email: 'shashi.zerokost@gmail.com', provider: 'GOOGLE', userId: shashi.id, displayName: 'Shashi', status: 'ACTIVE' },
    { email: 'ammarraza.zerokost@gmail.com', provider: 'GOOGLE', userId: ammar.id, displayName: 'Ammar Raza', status: 'ACTIVE' },
  ];

  for (const acct of approvedAccounts) {
    const norm = acct.email.trim().toLowerCase();
    await (prisma as any).organizationAuthAllowlist.upsert({
      where: {
        organizationId_provider_normalizedEmail: {
          organizationId: org.id,
          provider: acct.provider,
          normalizedEmail: norm,
        },
      },
      update: {
        userId: acct.userId,
        displayName: acct.displayName,
        status: acct.status,
      },
      create: {
        organizationId: org.id,
        provider: acct.provider,
        email: acct.email,
        normalizedEmail: norm,
        userId: acct.userId,
        displayName: acct.displayName,
        status: acct.status,
        createdBy: 'SYSTEM_SEED',
      },
    });
  }

  // ============================================================
  // DEVELOPMENT-ONLY: Local test account
  // This block runs ONLY when NODE_ENV=development.
  // The account (test@tmp.local) is never created in production.
  // Never expose these credentials outside local development.
  // ============================================================
  if (process.env.NODE_ENV === 'development') {
    console.log('[Seed] [DEV ONLY] Upserting development test account...');

    const devPasswordHash = await bcrypt.hash('TmpTest@12345', 10);

    const devUser = await prisma.user.upsert({
      where: { email: 'test@tmp.local' },
      update: {
        // Keep password fresh on every seed run but do NOT change role/org
        passwordHash: devPasswordHash,
        fullName: 'Dev Test Account',
        jobTitle: 'Development Test User',
        department: 'Engineering',
        role: 'TEAM_MEMBER',
        isActive: true,
        status: 'ONLINE',
      },
      create: {
        organizationId: org.id,
        email: 'test@tmp.local',
        passwordHash: devPasswordHash,
        fullName: 'Dev Test Account',
        jobTitle: 'Development Test User',
        department: 'Engineering',
        role: 'TEAM_MEMBER',
        isActive: true,
        status: 'ONLINE',
        avatarUrl: null,
      },
    });

    // Add dev user to Customer Platform project (ProjectMember) — idempotent
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: customerProj.id,
          userId: devUser.id,
        },
      },
      update: {},
      create: {
        projectId: customerProj.id,
        userId: devUser.id,
      },
    });

    // Add dev user to #general channel — idempotent
    await prisma.channelMember.upsert({
      where: {
        channelId_userId: {
          channelId: genChannel.id,
          userId: devUser.id,
        },
      },
      update: {},
      create: {
        channelId: genChannel.id,
        userId: devUser.id,
        role: 'MEMBER',
      },
    });

    // Add dev user to #announcements channel — idempotent
    await prisma.channelMember.upsert({
      where: {
        channelId_userId: {
          channelId: annChannel.id,
          userId: devUser.id,
        },
      },
      update: {},
      create: {
        channelId: annChannel.id,
        userId: devUser.id,
        role: 'MEMBER',
      },
    });

    console.log('[Seed] [DEV ONLY] Development test account ready:');
    console.log('[Seed] [DEV ONLY]   Email:    test@tmp.local');
    console.log('[Seed] [DEV ONLY]   Password: TmpTest@12345   (LOCAL DEVELOPMENT TEST CREDENTIALS)');
    console.log('[Seed] [DEV ONLY]   Role:     TEAM_MEMBER');
    console.log('[Seed] [DEV ONLY] WARNING: This account must NEVER be used in production.');
  }

  console.log('[Seed] Database successfully seeded! Demo startup ready.');
}

main()
  .catch((e) => {
    console.error('[Seed Error]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
