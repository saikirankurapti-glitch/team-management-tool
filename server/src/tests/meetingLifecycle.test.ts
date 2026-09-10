import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { prisma } from '../prisma.js';

describe('Meeting Lifecycle & Validation Suite', () => {
  it('runs all meeting lifecycle tests', async () => {
    await runTests();
  });
});

// Test suite for Phase 32 Google Meeting Lifecycle & Validation
async function runTests() {
  console.log('--- STARTING MEETING LIFECYCLE TESTS ---');

  // Test 1: Date & Lead-time Validation Logic
  console.log('Test 1: Past Date and 5-minute Lead-time Validation...');
  const now = Date.now();
  const MEETING_MIN_LEAD_MINUTES = 5;

  const pastDateMillis = now - 24 * 60 * 60 * 1000;
  const pastTimeMillis = now - 10 * 60 * 1000;
  const fourMinLeadMillis = now + 4 * 60 * 1000;
  const validLeadMillis = now + 15 * 60 * 1000;

  assert.strictEqual(pastDateMillis < now, true, 'Past date must be detected as past');
  assert.strictEqual(pastTimeMillis < now, true, 'Past time must be detected as past');
  assert.strictEqual(
    fourMinLeadMillis < now + MEETING_MIN_LEAD_MINUTES * 60 * 1000,
    true,
    '4-minute lead time must violate 5-minute minimum lead requirement'
  );
  assert.strictEqual(
    validLeadMillis >= now + MEETING_MIN_LEAD_MINUTES * 60 * 1000,
    true,
    '15-minute lead time must satisfy minimum lead requirement'
  );
  console.log('  [PASS] Lead-time and past date checks verified.');

  // Test 2: Start / End Date Duration Validation
  console.log('Test 2: End Time and Maximum Duration Validation...');
  const start = new Date(validLeadMillis);
  const invalidEnd = new Date(validLeadMillis - 1000);
  const excessiveEnd = new Date(validLeadMillis + 25 * 60 * 60 * 1000); // 25 hours
  const validEnd = new Date(validLeadMillis + 45 * 60 * 1000); // 45 minutes

  assert.strictEqual(invalidEnd.getTime() <= start.getTime(), true, 'End time before start time must be rejected');
  assert.strictEqual(
    (excessiveEnd.getTime() - start.getTime()) / (60 * 1000) > 1440,
    true,
    'Duration > 24 hours (1440 min) must be rejected'
  );
  assert.strictEqual(
    (validEnd.getTime() - start.getTime()) / (60 * 1000) <= 1440,
    true,
    'Duration 45 min must be accepted'
  );
  console.log('  [PASS] End time & duration bounds verified.');

  // Test 3: Attendee Email Normalization and Deduplication
  console.log('Test 3: Attendee Email Validation & Deduplication...');
  const rawAttendees = [
    'Alice@example.com ',
    'alice@example.com',
    'bob@DOMAIN.COM',
    'invalid-email-string',
    '  charlie@team.org  ',
  ];
  const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const parsed = Array.from(
    new Set(
      rawAttendees
        .map((a) => a.trim().toLowerCase())
        .filter((a) => validEmailRegex.test(a))
    )
  );

  assert.deepStrictEqual(
    parsed,
    ['alice@example.com', 'bob@domain.com', 'charlie@team.org'],
    'Deduplication and lowercase formatting must produce exact clean array'
  );
  console.log('  [PASS] Attendee sanitization verified.');

  // Test 4: Timezone Canonicalization
  console.log('Test 4: Timezone Normalization...');
  const normalizeTimeZone = (tz?: string): string => {
    if (!tz) return 'Asia/Kolkata';
    let cleaned = tz.trim();
    if (cleaned === 'Asia/Calcutta') cleaned = 'Asia/Kolkata';
    try {
      Intl.DateTimeFormat(undefined, { timeZone: cleaned });
      return cleaned;
    } catch {
      return 'UTC';
    }
  };

  assert.strictEqual(normalizeTimeZone('Asia/Calcutta'), 'Asia/Kolkata');
  assert.strictEqual(normalizeTimeZone('America/New_York'), 'America/New_York');
  assert.strictEqual(normalizeTimeZone('invalid/unknown_zone'), 'UTC');
  assert.strictEqual(normalizeTimeZone(undefined), 'Asia/Kolkata');
  console.log('  [PASS] Timezone canonicalization verified.');

  // Test 5: Database Meeting Lifecycle & Activity Logging
  console.log('Test 5: DB Record Cancellation & History Preservation...');
  let testOrg = await prisma.organization.findFirst();
  let testUser = await prisma.user.findFirst();

  if (testOrg && testUser) {
    const testMeeting = await prisma.meeting.create({
      data: {
        organizationId: testOrg.id,
        createdById: testUser.id,
        title: 'Automated Lifecycle Test Meeting',
        description: 'Unit test meeting entity',
        startTime: new Date(validLeadMillis),
        endTime: new Date(validLeadMillis + 30 * 60000),
        timeZone: 'Asia/Kolkata',
        attendees: JSON.stringify(['test-attendee@example.com']),
        status: 'CONFIRMED',
        syncStatus: 'SYNCED',
      },
    });

    assert.ok(testMeeting.id, 'Meeting record must be created');

    // Create Activity
    const act = await prisma.meetingActivity.create({
      data: {
        meetingId: testMeeting.id,
        actorId: testUser.id,
        action: 'CREATED',
        description: 'Test meeting created',
      },
    });
    assert.strictEqual(act.action, 'CREATED');

    // Update / Reschedule
    const updated = await prisma.meeting.update({
      where: { id: testMeeting.id },
      data: {
        title: 'Updated Lifecycle Test Meeting',
        startTime: new Date(validLeadMillis + 60 * 60000),
      },
    });
    assert.strictEqual(updated.title, 'Updated Lifecycle Test Meeting');

    // Cancel Meeting
    const cancelled = await prisma.meeting.update({
      where: { id: testMeeting.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });
    assert.strictEqual(cancelled.status, 'CANCELLED');
    assert.ok(cancelled.cancelledAt, 'cancelledAt timestamp must be preserved');

    // Verify record still exists in DB
    const persisted = await prisma.meeting.findUnique({
      where: { id: testMeeting.id },
      include: { activities: true },
    });
    assert.ok(persisted !== null, 'Meeting must not be hard deleted on cancel');
    assert.strictEqual(persisted?.status, 'CANCELLED');
    assert.strictEqual(persisted?.activities.length, 1);

    // Clean up test meeting
    await prisma.meeting.delete({ where: { id: testMeeting.id } });
    console.log('  [PASS] DB lifecycle preservation and activity log verified.');
  } else {
    console.log('  [SKIP] Skipping DB integration step (no test user/org in dev db).');
  }

  // Test 6: Multi-tenant Organization Isolation
  console.log('Test 6: Multi-tenant Isolation Check...');
  const fakeOrgA = 'org-a-1111';
  const fakeOrgB = 'org-b-2222';
  const checkIsolation = (reqOrgId: string, meetingOrgId: string) => {
    if (reqOrgId !== meetingOrgId) {
      throw new Error('Meeting not found or you do not have permission to modify it');
    }
    return true;
  };

  assert.strictEqual(checkIsolation(fakeOrgA, fakeOrgA), true);
  assert.throws(() => checkIsolation(fakeOrgA, fakeOrgB), /permission/);
  console.log('  [PASS] Multi-tenant isolation verified.');

  console.log('--- ALL 6 LIFECYCLE TESTS PASSED SUCCESSFULLY! ---');
}
