import test from 'node:test';
import assert from 'node:assert/strict';

// Analytics calculation logic under test (deterministic mathematical models)
function getDateRangeBoundaries(period, now = new Date()) {
  const currentEnd = new Date(now);
  let daysCount = 30;
  let currentStart = new Date(now);

  switch (period) {
    case 'today':
      daysCount = 1;
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      break;
    case '7d':
      daysCount = 7;
      currentStart = new Date(now.getTime() - 7 * 864e5);
      break;
    case '30d':
      daysCount = 30;
      currentStart = new Date(now.getTime() - 30 * 864e5);
      break;
    case '90d':
      daysCount = 90;
      currentStart = new Date(now.getTime() - 90 * 864e5);
      break;
    case 'all':
      daysCount = 365;
      currentStart = new Date('2025-01-01T00:00:00.000Z');
      break;
  }

  const durationMs = currentEnd.getTime() - currentStart.getTime();
  const previousEnd = new Date(currentStart.getTime());
  const previousStart = new Date(previousEnd.getTime() - durationMs);

  return { currentStart, currentEnd, previousStart, previousEnd, daysCount };
}

function calculateTrend(currentVal, previousVal) {
  const diff = currentVal - previousVal;
  let percentage = null;

  if (previousVal > 0) {
    percentage = Math.round(((currentVal - previousVal) / previousVal) * 1000) / 10;
  } else if (previousVal === 0 && currentVal > 0) {
    percentage = 100;
  } else if (previousVal === 0 && currentVal === 0) {
    percentage = 0;
  }

  return {
    current: currentVal,
    previous: previousVal,
    diff,
    percentage,
    isPositive: diff >= 0,
  };
}

function sanitizePlatformEvent(event) {
  const SENSITIVE_PROPERTIES = [
    'filename',
    'document',
    'content',
    'pdf',
    'image',
    'resume',
    'marks',
    'sgpa',
    'cgpa',
    'password',
    'token',
    'secret',
  ];

  for (const key of Object.keys(event)) {
    if (SENSITIVE_PROPERTIES.some((prop) => key.toLowerCase().includes(prop))) {
      throw new Error(`Privacy Violation: Event payload cannot contain sensitive key "${key}".`);
    }
  }

  return {
    id: event.id,
    eventType: event.eventType,
    targetId: event.targetId,
    category: event.category,
    timestamp: event.timestamp,
  };
}

// =============================================================================
// TESTS
// =============================================================================

test('Section 7 & 48: Date Range Boundaries Calculation', () => {
  const fixedNow = new Date('2026-09-11T12:00:00.000Z');

  // 7 Days
  const b7 = getDateRangeBoundaries('7d', fixedNow);
  assert.equal(b7.daysCount, 7);
  assert.equal(b7.currentEnd.toISOString(), '2026-09-11T12:00:00.000Z');
  assert.equal(b7.currentStart.toISOString(), '2026-09-04T12:00:00.000Z');
  assert.equal(b7.previousEnd.toISOString(), '2026-09-04T12:00:00.000Z');
  assert.equal(b7.previousStart.toISOString(), '2026-08-28T12:00:00.000Z');

  // 30 Days
  const b30 = getDateRangeBoundaries('30d', fixedNow);
  assert.equal(b30.daysCount, 30);
  assert.equal(b30.currentEnd.toISOString(), '2026-09-11T12:00:00.000Z');
  assert.equal(b30.currentStart.toISOString(), '2026-08-12T12:00:00.000Z');
  assert.equal(b30.previousEnd.toISOString(), '2026-08-12T12:00:00.000Z');
  assert.equal(b30.previousStart.toISOString(), '2026-07-13T12:00:00.000Z');
});

test('Section 12 & 51: Trend Comparisons & Zero-Division Safeguards', () => {
  // Standard positive growth
  const trendUp = calculateTrend(50, 40);
  assert.equal(trendUp.diff, 10);
  assert.equal(trendUp.percentage, 25);
  assert.equal(trendUp.isPositive, true);

  // Negative drop
  const trendDown = calculateTrend(30, 40);
  assert.equal(trendDown.diff, -10);
  assert.equal(trendDown.percentage, -25);
  assert.equal(trendDown.isPositive, false);

  // Equal
  const trendFlat = calculateTrend(40, 40);
  assert.equal(trendFlat.diff, 0);
  assert.equal(trendFlat.percentage, 0);
  assert.equal(trendFlat.isPositive, true);

  // Previous was 0, now has 5
  const trendFromZero = calculateTrend(5, 0);
  assert.equal(trendFromZero.diff, 5);
  assert.equal(trendFromZero.percentage, 100);
  assert.equal(trendFromZero.isPositive, true);

  // Both zero: division by zero safeguard
  const trendBothZero = calculateTrend(0, 0);
  assert.equal(trendBothZero.diff, 0);
  assert.equal(trendBothZero.percentage, 0);
  assert.equal(trendBothZero.isPositive, true);
});

test('Section 10 & 11: Real User Aggregations & Time-Series Construction', () => {
  const mockUsers = [
    { id: 'u1', createdAt: '2026-08-01T00:00:00.000Z', lastSignInAt: '2026-09-10T00:00:00.000Z', status: 'ACTIVE' },
    { id: 'u2', createdAt: '2026-08-15T00:00:00.000Z', lastSignInAt: '2026-09-05T00:00:00.000Z', status: 'ACTIVE' },
    { id: 'u3', createdAt: '2026-09-01T00:00:00.000Z', lastSignInAt: '2026-09-11T00:00:00.000Z', status: 'ACTIVE' },
    { id: 'u4', createdAt: '2026-09-10T00:00:00.000Z', status: 'SUSPENDED' },
  ];

  const now = new Date('2026-09-11T12:00:00.000Z');
  const boundaries = getDateRangeBoundaries('7d', now); // 2026-09-04 to 2026-09-11

  // Count new users in 7d
  const newIn7d = mockUsers.filter((u) => {
    const d = new Date(u.createdAt);
    return d >= boundaries.currentStart && d <= boundaries.currentEnd;
  });
  assert.equal(newIn7d.length, 1); // only u4 was created on 2026-09-10

  // Count active users in 7d (based on genuine lastSignInAt)
  const activeIn7d = mockUsers.filter((u) => {
    if (!u.lastSignInAt) return false;
    const d = new Date(u.lastSignInAt);
    return d >= boundaries.currentStart && d <= boundaries.currentEnd;
  });
  assert.equal(activeIn7d.length, 3); // u1 (Sep 10), u2 (Sep 5), u3 (Sep 11)

  // Status breakdown
  const activeCount = mockUsers.filter((u) => u.status === 'ACTIVE').length;
  const suspendedCount = mockUsers.filter((u) => u.status === 'SUSPENDED').length;
  assert.equal(activeCount, 3);
  assert.equal(suspendedCount, 1);
});

test('Section 20 & 23: Privacy-Safe Platform Events Rejection of Sensitive Content', () => {
  // Valid minimal event passes
  const validEvent = {
    id: 'evt_1',
    eventType: 'tool_opened',
    targetId: 'pdf-to-jpg',
    category: 'tool',
    timestamp: '2026-09-11T10:00:00.000Z',
  };
  const sanitized = sanitizePlatformEvent(validEvent);
  assert.equal(sanitized.eventType, 'tool_opened');
  assert.equal(sanitized.targetId, 'pdf-to-jpg');

  // Rejects document filename
  assert.throws(
    () =>
      sanitizePlatformEvent({
        ...validEvent,
        filename: 'My_Confidential_Marksheet.pdf',
      }),
    /Privacy Violation/
  );

  // Rejects document content
  assert.throws(
    () =>
      sanitizePlatformEvent({
        ...validEvent,
        content: 'Candidate Resume text details...',
      }),
    /Privacy Violation/
  );

  // Rejects marks
  assert.throws(
    () =>
      sanitizePlatformEvent({
        ...validEvent,
        sgpa_marks: '9.45',
      }),
    /Privacy Violation/
  );
});

test('Section 52 & 82: Empty Dataset Zero-Fabrication Rule', () => {
  const emptyUsers = [];
  const boundaries = getDateRangeBoundaries('30d', new Date());

  const newUsers = emptyUsers.filter((u) => {
    const d = new Date(u.createdAt);
    return d >= boundaries.currentStart && d <= boundaries.currentEnd;
  });

  assert.equal(newUsers.length, 0);

  const trend = calculateTrend(newUsers.length, 0);
  assert.equal(trend.diff, 0);
  assert.equal(trend.percentage, 0);
  assert.equal(trend.isPositive, true);
});
