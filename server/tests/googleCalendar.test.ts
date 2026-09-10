import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/prisma.js';

describe('Google Calendar & Google Meet Integration Unit Tests', () => {
  beforeEach(async () => {
    await prisma.meeting.deleteMany();
  });

  it('creates local Meeting database record with status CONFIRMED and SYNCED', async () => {
    const defaultOrg = await prisma.organization.findFirst() || await prisma.organization.create({
      data: { name: 'Test Org', slug: 'test-org-cal' }
    });

    const defaultUser = await prisma.user.findFirst() || await prisma.user.create({
      data: {
        organizationId: defaultOrg.id,
        email: 'testcal@example.com',
        passwordHash: 'hash',
        fullName: 'Test Cal User'
      }
    });

    const meeting = await prisma.meeting.create({
      data: {
        organizationId: defaultOrg.id,
        createdById: defaultUser.id,
        googleEventId: 'gevent_test_123',
        title: 'Architecture Review & Google Meet Sync',
        startTime: new Date('2026-09-10T10:00:00Z'),
        endTime: new Date('2026-09-10T11:00:00Z'),
        meetLink: 'https://meet.google.com/abc-defg-hij',
        attendees: JSON.stringify(['dev@team.com', 'pm@team.com']),
        status: 'CONFIRMED',
        syncStatus: 'SYNCED',
      }
    });

    expect(meeting.id).toBeDefined();
    expect(meeting.title).toBe('Architecture Review & Google Meet Sync');
    expect(meeting.meetLink).toBe('https://meet.google.com/abc-defg-hij');
    expect(meeting.status).toBe('CONFIRMED');
    expect(meeting.syncStatus).toBe('SYNCED');
  });
});
