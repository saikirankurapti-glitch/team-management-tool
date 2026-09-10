import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-token-key-change-in-production-12345';

describe('Database and Identity Regression Tests', () => {
  let saiUser: any;
  let ashwinUser: any;
  let rajUser: any;

  beforeAll(async () => {
    saiUser = await prisma.user.findFirst({ where: { fullName: 'Sai Kiran' } });
    ashwinUser = await prisma.user.findFirst({ where: { fullName: 'Ashwin T' } });
    rajUser = await prisma.user.findFirst({ where: { fullName: 'Raj Mange' } });
  });

  it('verifies Sai Kiran is the sole ADMIN in the organization', async () => {
    expect(saiUser).toBeDefined();
    expect(saiUser.role).toBe('ADMIN');

    const adminCount = await prisma.user.count({
      where: { organizationId: saiUser.organizationId, role: 'ADMIN' }
    });
    expect(adminCount).toBe(1);
  });

  it('verifies Ashwin T is PROJECT_MANAGER (CTO/Manager tier)', async () => {
    expect(ashwinUser).toBeDefined();
    expect(ashwinUser.role).toBe('PROJECT_MANAGER');
  });

  it('verifies saikirankurapati04@gmail.com is NOT mapped to Sai Kiran or any Admin user', async () => {
    const allow04 = await prisma.organizationAuthAllowlist.findFirst({
      where: { normalizedEmail: 'saikirankurapati04@gmail.com' },
      include: { user: true }
    });
    expect(allow04).toBeDefined();
    // Must NOT be mapped to Sai Kiran or an Admin
    expect(allow04.userId).not.toBe(saiUser.id);
    if (allow04.user) {
      expect(allow04.user.role).not.toBe('ADMIN');
    }
  });

  it('verifies saikirankurapti@gmail.com is mapped exclusively to Sai Kiran', async () => {
    const allowSai = await prisma.organizationAuthAllowlist.findFirst({
      where: { normalizedEmail: 'saikirankurapti@gmail.com' }
    });
    expect(allowSai).toBeDefined();
    expect(allowSai.userId).toBe(saiUser.id);
  });

  it('verifies ashwin.zerokost@gmail.com is mapped exclusively to Ashwin T', async () => {
    const allowAshwin = await prisma.organizationAuthAllowlist.findFirst({
      where: { normalizedEmail: 'ashwin.zerokost@gmail.com' }
    });
    expect(allowAshwin).toBeDefined();
    expect(allowAshwin.userId).toBe(ashwinUser.id);
  });

  it('verifies JWT created for Sai Kiran has role ADMIN', () => {
    const token = jwt.sign(
      { id: saiUser.id, email: saiUser.email, role: saiUser.role, organizationId: saiUser.organizationId },
      JWT_SECRET
    );
    const decoded: any = jwt.verify(token, JWT_SECRET);
    expect(decoded.role).toBe('ADMIN');
  });

  it('verifies JWT created for Ashwin has role PROJECT_MANAGER', () => {
    const token = jwt.sign(
      { id: ashwinUser.id, email: ashwinUser.email, role: ashwinUser.role, organizationId: ashwinUser.organizationId },
      JWT_SECRET
    );
    const decoded: any = jwt.verify(token, JWT_SECRET);
    expect(decoded.role).toBe('PROJECT_MANAGER');
  });

  it('verifies JWT created for other team members has role TEAM_MEMBER', () => {
    const token = jwt.sign(
      { id: rajUser.id, email: rajUser.email, role: rajUser.role, organizationId: rajUser.organizationId },
      JWT_SECRET
    );
    const decoded: any = jwt.verify(token, JWT_SECRET);
    expect(decoded.role).toBe('TEAM_MEMBER');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
