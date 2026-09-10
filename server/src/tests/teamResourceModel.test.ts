import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../prisma';

describe('Phase 35: Team Members & Resource Allocation Model Verification', () => {
  let mainOrgId = '';

  beforeAll(async () => {
    await prisma.$connect();
    const demoOrg = await prisma.organization.findFirst({
      where: { slug: 'demo-startup' }
    });
    mainOrgId = demoOrg?.id || '';
  });

  it('should have exactly the 6 real team members in the main organization', async () => {
    const expectedNames = [
      'Ammar Raza',
      'Ashwin T',
      'Navya Sri',
      'Raj Mange',
      'Sai Kiran',
      'Shashi'
    ].sort();

    const activeUsers = await prisma.user.findMany({
      where: {
        organizationId: mainOrgId,
        isActive: true,
        fullName: { in: expectedNames }
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        jobTitle: true,
        department: true,
        skills: true
      },
      orderBy: { fullName: 'asc' }
    });

    expect(activeUsers.length).toBe(6);

    const names = activeUsers.map(u => u.fullName).sort();
    expect(names).toEqual(expectedNames);
  });

  it('should ensure fake/demo users are NOT present in active users', async () => {
    const fakeNames = [
      'Ravi Verma',
      'Priya Sharma',
      'Kiran Rao',
      'Arun Patel',
      'Naveen Reddy',
      'Sai Kumar'
    ];

    const foundFakeUsers = await prisma.user.findMany({
      where: {
        fullName: { in: fakeNames },
        isActive: true
      }
    });

    expect(foundFakeUsers.length).toBe(0);
  });

  it('should verify real members have their specific skills and roles assigned', async () => {
    // 1. Raj Mange: AI/ML Developer, Agentic AI Developer
    const raj = await prisma.user.findFirst({
      where: { fullName: 'Raj Mange', organizationId: mainOrgId, isActive: true },
      include: { skills: true }
    });
    expect(raj).not.toBeNull();
    const rajSkills = raj!.skills.map(s => s.skillName);
    expect(rajSkills).toContain('AI/ML Development');
    expect(rajSkills).toContain('Agentic AI');

    // 2. Sai Kiran: Cloud Engineer, DevOps, Team Lead
    const sai = await prisma.user.findFirst({
      where: { fullName: 'Sai Kiran', organizationId: mainOrgId, isActive: true },
      include: { skills: true }
    });
    expect(sai).not.toBeNull();
    const saiSkills = sai!.skills.map(s => s.skillName);
    expect(saiSkills).toContain('DevOps');
    expect(saiSkills).toContain('Cloud Engineering');

    // 3. Ammar Raza: AI/ML Developer
    const ammar = await prisma.user.findFirst({
      where: { fullName: 'Ammar Raza', organizationId: mainOrgId, isActive: true },
      include: { skills: true }
    });
    expect(ammar).not.toBeNull();
    const ammarSkills = ammar!.skills.map(s => s.skillName);
    expect(ammarSkills).toContain('AI/ML Development');

    // 4. Ashwin T: CEO / CTO / Manager
    const ashwin = await prisma.user.findFirst({
      where: { fullName: 'Ashwin T', organizationId: mainOrgId, isActive: true }
    });
    expect(ashwin).not.toBeNull();
    expect(ashwin!.jobTitle).toContain('CEO');

    // 5. Shashi: Digital Marketing Professional
    const shashi = await prisma.user.findFirst({
      where: { fullName: 'Shashi', organizationId: mainOrgId, isActive: true },
      include: { skills: true }
    });
    expect(shashi).not.toBeNull();
    const shashiSkills = shashi!.skills.map(s => s.skillName);
    expect(shashiSkills).toContain('Digital Marketing');

    // 6. Navya Sri: Full Stack Developer
    const navya = await prisma.user.findFirst({
      where: { fullName: 'Navya Sri', organizationId: mainOrgId, isActive: true },
      include: { skills: true }
    });
    expect(navya).not.toBeNull();
    const navyaSkills = navya!.skills.map(s => s.skillName);
    expect(navyaSkills).toContain('Full Stack Development');
  });

  it('should verify resource allocations link to existing active users without duplicating users', async () => {
    const allocations = await prisma.resourceAllocation.findMany({
      where: {
        user: { organizationId: mainOrgId }
      },
      include: {
        user: true
      }
    });

    for (const alloc of allocations) {
      expect(alloc.user).toBeDefined();
      expect(alloc.user.isActive).toBe(true);
      expect(['Ammar Raza', 'Ashwin T', 'Navya Sri', 'Raj Mange', 'Sai Kiran', 'Shashi']).toContain(alloc.user.fullName);
    }

    // Check distinct allocated users count
    const allocatedUserIds = new Set(allocations.map(a => a.userId));
    expect(allocatedUserIds.size).toBeLessThanOrEqual(6);
  });

  it('should confirm updating member profile persists correctly in database', async () => {
    const navya = await prisma.user.findFirst({
      where: { fullName: 'Navya Sri', organizationId: mainOrgId }
    });
    expect(navya).not.toBeNull();

    const originalTitle = navya!.jobTitle;
    const testTitle = 'Lead Full Stack Engineer';

    // Update
    await prisma.user.update({
      where: { id: navya!.id },
      data: { jobTitle: testTitle }
    });

    const updated = await prisma.user.findUnique({
      where: { id: navya!.id }
    });
    expect(updated?.jobTitle).toBe(testTitle);

    // Revert back
    await prisma.user.update({
      where: { id: navya!.id },
      data: { jobTitle: originalTitle }
    });
  });
});
