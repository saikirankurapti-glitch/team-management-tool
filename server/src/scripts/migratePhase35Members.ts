import { PrismaClient } from '../../prisma/client/index.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[Migration] Starting Phase 35 Member & Resource Model Migration...');

  // 1. Fetch organization
  const org = await prisma.organization.findFirst();
  if (!org) {
    console.error('[Migration] No organization found!');
    return;
  }
  console.log('[Migration] Target Organization:', org.name, `(${org.id})`);

  // Target 6 Real Members Configuration
  const targetMembers = [
    {
      fullName: 'Raj Mange',
      jobTitle: 'AI/ML Developer · Agentic AI Developer',
      role: 'TEAM_MEMBER',
      department: 'Engineering',
      skills: [
        { skillName: 'AI/ML Development', proficiency: 'EXPERT' },
        { skillName: 'Agentic AI', proficiency: 'EXPERT' },
        { skillName: 'Python', proficiency: 'EXPERT' },
        { skillName: 'LangChain', proficiency: 'ADVANCED' },
      ],
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    },
    {
      fullName: 'Sai Kiran',
      jobTitle: 'Cloud Engineer · DevOps · Team Lead',
      role: 'PROJECT_MANAGER',
      department: 'Engineering',
      skills: [
        { skillName: 'Cloud Engineering', proficiency: 'EXPERT' },
        { skillName: 'DevOps', proficiency: 'EXPERT' },
        { skillName: 'Kubernetes', proficiency: 'EXPERT' },
        { skillName: 'Team Leadership', proficiency: 'ADVANCED' },
      ],
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
    },
    {
      fullName: 'Ammar Raza',
      jobTitle: 'AI/ML Developer',
      role: 'TEAM_MEMBER',
      department: 'Engineering',
      skills: [
        { skillName: 'AI/ML Development', proficiency: 'ADVANCED' },
        { skillName: 'PyTorch', proficiency: 'ADVANCED' },
        { skillName: 'Deep Learning', proficiency: 'ADVANCED' },
      ],
      avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop&q=80',
    },
    {
      fullName: 'Ashwin T',
      jobTitle: 'CEO · CTO · Manager',
      role: 'OWNER',
      department: 'Leadership',
      skills: [
        { skillName: 'Executive Leadership', proficiency: 'EXPERT' },
        { skillName: 'Product Strategy', proficiency: 'EXPERT' },
        { skillName: 'System Architecture', proficiency: 'EXPERT' },
      ],
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    },
    {
      fullName: 'Shashi',
      jobTitle: 'Digital Marketing Professional',
      role: 'TEAM_MEMBER',
      department: 'Growth & Marketing',
      skills: [
        { skillName: 'Digital Marketing', proficiency: 'EXPERT' },
        { skillName: 'SEO & Content', proficiency: 'ADVANCED' },
        { skillName: 'Growth Strategy', proficiency: 'ADVANCED' },
      ],
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
    },
    {
      fullName: 'Navya Sri',
      jobTitle: 'Full Stack Developer',
      role: 'TEAM_MEMBER',
      department: 'Engineering',
      skills: [
        { skillName: 'Full Stack Development', proficiency: 'EXPERT' },
        { skillName: 'React & TypeScript', proficiency: 'EXPERT' },
        { skillName: 'Node.js & Express', proficiency: 'ADVANCED' },
      ],
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&auto=format&fit=crop&q=80',
    },
  ];

  // Map existing demo users in order to preserve all FKs
  const existingUsers = await prisma.user.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: 'asc' },
  });

  console.log('[Migration] Existing Users Count:', existingUsers.length);
  existingUsers.forEach((u, i) => console.log(`  [${i}] ${u.fullName} (${u.email})`));

  const slotMapping = [
    { targetIndex: 3, fakeName: 'Sai Kumar' },    // Ashwin T
    { targetIndex: 0, fakeName: 'Ravi Verma' },   // Raj Mange
    { targetIndex: 1, fakeName: 'Kiran Rao' },    // Sai Kiran
    { targetIndex: 4, fakeName: 'Priya Sharma' }, // Shashi
    { targetIndex: 2, fakeName: 'Arun Patel' },   // Ammar Raza
    { targetIndex: 5, fakeName: 'Naveen Reddy' }, // Navya Sri
  ];

  const defaultPassword = await bcrypt.hash('Password123!', 10);
  const realUserRecords: any[] = [];

  for (let i = 0; i < slotMapping.length; i++) {
    const { targetIndex, fakeName } = slotMapping[i];
    const targetConfig = targetMembers[targetIndex];

    let userRecord = existingUsers.find((u) => u.fullName.toLowerCase() === fakeName.toLowerCase());
    if (!userRecord && existingUsers[i]) {
      userRecord = existingUsers[i];
    }

    if (userRecord) {
      console.log(`[Migration] Migrating User [${userRecord.id}]: "${userRecord.fullName}" -> "${targetConfig.fullName}"`);
      const updated = await prisma.user.update({
        where: { id: userRecord.id },
        data: {
          fullName: targetConfig.fullName,
          jobTitle: targetConfig.jobTitle,
          role: targetConfig.role,
          department: targetConfig.department,
          avatarUrl: targetConfig.avatarUrl,
          isActive: true,
        },
      });
      realUserRecords[targetIndex] = updated;
    } else {
      console.log(`[Migration] Creating User: "${targetConfig.fullName}"`);
      const emailSlug = targetConfig.fullName.toLowerCase().replace(/\s+/g, '.');
      const created = await prisma.user.create({
        data: {
          organizationId: org.id,
          fullName: targetConfig.fullName,
          email: `${emailSlug}@enterprise.local`,
          passwordHash: defaultPassword,
          jobTitle: targetConfig.jobTitle,
          role: targetConfig.role,
          department: targetConfig.department,
          avatarUrl: targetConfig.avatarUrl,
          isActive: true,
          status: 'ONLINE',
        },
      });
      realUserRecords[targetIndex] = created;
    }
  }

  // Deactivate or remove any other fake / orphaned users that are not Jordan Lee or the 6 members
  const allowedUserIds = new Set(realUserRecords.map((u) => u.id));
  const otherUsers = await prisma.user.findMany({
    where: {
      organizationId: org.id,
      id: { notIn: Array.from(allowedUserIds) },
    },
  });

  for (const ou of otherUsers) {
    if (ou.email.startsWith('jordan_') || ou.fullName === 'Jordan Lee') {
      console.log('[Migration] Preserving authenticated dev user Jordan Lee as inactive/separate.');
      await prisma.user.update({
        where: { id: ou.id },
        data: { isActive: false },
      });
    } else {
      console.log(`[Migration] Removing stray user "${ou.fullName}" (${ou.email})`);
      try {
        await prisma.user.delete({ where: { id: ou.id } });
      } catch (err: any) {
        console.warn(`  Could not hard-delete ${ou.fullName}, deactivating: ${err.message}`);
        await prisma.user.update({
          where: { id: ou.id },
          data: { isActive: false },
        });
      }
    }
  }

  // 2. Populate Skills for all 6 members
  console.log('[Migration] Seeding Skills for 6 Real Members...');
  for (let i = 0; i < targetMembers.length; i++) {
    const config = targetMembers[i];
    const user = realUserRecords[i];
    if (!user) continue;

    for (const sk of config.skills) {
      await prisma.skillCatalog.upsert({
        where: {
          organizationId_name: {
            organizationId: org.id,
            name: sk.skillName,
          },
        },
        create: {
          organizationId: org.id,
          name: sk.skillName,
          category: config.department === 'Growth & Marketing' ? 'DESIGN' : 'ENGINEERING',
        },
        update: {},
      });

      await prisma.userSkill.upsert({
        where: {
          userId_skillName: {
            userId: user.id,
            skillName: sk.skillName,
          },
        },
        create: {
          organizationId: org.id,
          userId: user.id,
          skillName: sk.skillName,
          proficiency: sk.proficiency,
        },
        update: {
          proficiency: sk.proficiency,
        },
      });
    }
  }

  // 3. Ensure Teams & Team Leadership
  console.log('[Migration] Updating Team Memberships...');
  const teams = await prisma.team.findMany({ where: { organizationId: org.id } });
  const engTeam = teams.find((t) => t.name.toLowerCase().includes('engine')) || teams[0];
  const mktTeam = teams.find((t) => t.name.toLowerCase().includes('market')) || teams[1];

  const raj = realUserRecords[0];
  const sai = realUserRecords[1];
  const ammar = realUserRecords[2];
  const ashwin = realUserRecords[3];
  const shashi = realUserRecords[4];
  const navya = realUserRecords[5];

  if (engTeam && sai) {
    await prisma.team.update({
      where: { id: engTeam.id },
      data: { teamLeadId: sai.id },
    });
    for (const u of [raj, sai, ammar, navya, ashwin]) {
      if (!u) continue;
      await prisma.teamMember.upsert({
        where: {
          teamId_userId: { teamId: engTeam.id, userId: u.id },
        },
        create: { teamId: engTeam.id, userId: u.id, role: u.id === sai.id ? 'LEAD' : 'MEMBER' },
        update: { role: u.id === sai.id ? 'LEAD' : 'MEMBER' },
      });
    }
  }

  if (mktTeam && shashi) {
    await prisma.team.update({
      where: { id: mktTeam.id },
      data: { teamLeadId: shashi.id },
    });
    for (const u of [shashi, ashwin]) {
      if (!u) continue;
      await prisma.teamMember.upsert({
        where: {
          teamId_userId: { teamId: mktTeam.id, userId: u.id },
        },
        create: { teamId: mktTeam.id, userId: u.id, role: u.id === shashi.id ? 'LEAD' : 'MEMBER' },
        update: { role: u.id === shashi.id ? 'LEAD' : 'MEMBER' },
      });
    }
  }

  // 4. Ensure Project Memberships
  console.log('[Migration] Updating Project Memberships...');
  const projects = await prisma.project.findMany({ where: { organizationId: org.id } });
  for (const proj of projects) {
    for (const u of realUserRecords) {
      if (!u) continue;
      await prisma.projectMember.upsert({
        where: {
          projectId_userId: { projectId: proj.id, userId: u.id },
        },
        create: { projectId: proj.id, userId: u.id },
        update: {},
      });
    }
  }

  // 5. Clean up duplicate / orphan Resource Allocations
  console.log('[Migration] Cleaning and Updating Resource Allocations...');
  const activeAllocations = await prisma.resourceAllocation.findMany({
    where: { organizationId: org.id },
  });

  for (const alloc of activeAllocations) {
    if (!allowedUserIds.has(alloc.userId)) {
      console.log('[Migration] Removing allocation for removed user:', alloc.id);
      await prisma.resourceAllocation.delete({ where: { id: alloc.id } });
    }
  }

  console.log('[Migration] Phase 35 Migration Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('[Migration Error]', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
