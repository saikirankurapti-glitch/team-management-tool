import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { prisma } from '../../src/prisma.js';

describe('Live Integration - Multi-Tenant Organization & RBAC Isolation', () => {
  const isLive = process.env.LIVE_INTEGRATION_TESTS === 'true';
  let tokenOrgA: string;
  let tokenOrgB: string;

  beforeAll(async () => {
    const users = await prisma.user.findMany({ take: 5, include: { organization: true } });
    if (users.length >= 2) {
      const uA = users[0];
      const uB = users.find((u) => u.organizationId !== uA.organizationId);

      const loginA = await request(app).post('/api/auth/login').send({ email: uA.email, password: 'password123' });
      tokenOrgA = loginA.body.token;

      if (uB) {
        const loginB = await request(app).post('/api/auth/login').send({ email: uB.email, password: 'password123' });
        tokenOrgB = loginB.body.token;
      }
    }
  });

  it.runIf(isLive)('Enforces Tenant Organization Isolation on Work Items API', async () => {
    if (!tokenOrgA || !tokenOrgB) return;

    const resA = await request(app).get('/api/work-items').set('Authorization', `Bearer ${tokenOrgA}`);
    const resB = await request(app).get('/api/work-items').set('Authorization', `Bearer ${tokenOrgB}`);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const itemsA = resA.body.map((i: any) => i.id);
    const itemsB = resB.body.map((i: any) => i.id);

    // Organization A items must not overlap with Organization B items
    const overlap = itemsA.filter((id: string) => itemsB.includes(id));
    expect(overlap.length).toBe(0);
  });
});
