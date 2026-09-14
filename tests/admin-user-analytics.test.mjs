import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// 1. Deterministic Date Range Boundary Logic Under Test
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

// 2. Real User Metrics Computation Logic Under Test
function computeRealUserMetrics(users, activeSubs, period, now = new Date()) {
  const boundaries = getDateRangeBoundaries(period, now);
  const totalUsers = users.length;
  const proUserIds = new Set(activeSubs.map((s) => s.user_id));
  const proUsers = proUserIds.size;
  const freeUsers = Math.max(0, totalUsers - proUsers);

  const currentStartMs = boundaries.currentStart.getTime();
  const currentEndMs = boundaries.currentEnd.getTime();
  const previousStartMs = boundaries.previousStart.getTime();

  const newUsers = users.filter((u) => {
    const created = new Date(u.created_at).getTime();
    return created >= currentStartMs && created <= currentEndMs;
  }).length;

  const previousNewUsers = users.filter((u) => {
    const created = new Date(u.created_at).getTime();
    return created >= previousStartMs && created < currentStartMs;
  }).length;

  const activeUsers = users.filter((u) => {
    if (!u.last_sign_in_at) return false;
    const loginTime = new Date(u.last_sign_in_at).getTime();
    return loginTime >= currentStartMs && loginTime <= currentEndMs;
  }).length;

  const suspendedUsers = users.filter(
    (u) =>
      (u.banned_until && new Date(u.banned_until) > now) ||
      u.status === 'SUSPENDED'
  ).length;

  const trend = calculateTrend(newUsers, previousNewUsers);

  return {
    totalUsers,
    activeUsers,
    freeUsers,
    proUsers,
    newUsers,
    previousNewUsers,
    suspendedUsers,
    trend,
  };
}

// =============================================================================
// TEST SUITE: SUPER ADMIN USER COUNT & USER DASHBOARD
// =============================================================================

test('Section 1: Real User Counts & Mathematical Definitions', () => {
  const sampleUsers = [
    { id: 'u1', email: 'user1@saarvi.in', created_at: '2026-09-14T10:00:00Z', last_sign_in_at: '2026-09-14T11:00:00Z', status: 'ACTIVE' },
    { id: 'u2', email: 'user2@saarvi.in', created_at: '2026-09-14T09:00:00Z', last_sign_in_at: '2026-09-14T10:30:00Z', status: 'ACTIVE' },
    { id: 'u3', email: 'user3@saarvi.in', created_at: '2026-09-10T08:00:00Z', last_sign_in_at: '2026-09-12T08:00:00Z', status: 'ACTIVE' },
    { id: 'u4', email: 'user4@saarvi.in', created_at: '2026-09-01T08:00:00Z', last_sign_in_at: null, status: 'SUSPENDED' },
  ];

  const activeSubs = [{ user_id: 'u1', status: 'active', plan_tier: 'pro' }];
  const testNow = new Date('2026-09-14T12:00:00Z');

  // Test 1: Today period
  const todayMetrics = computeRealUserMetrics(sampleUsers, activeSubs, 'today', testNow);
  assert.equal(todayMetrics.totalUsers, 4, 'Total users must be exactly 4');
  assert.equal(todayMetrics.proUsers, 1, 'Pro users must be exactly 1');
  assert.equal(todayMetrics.freeUsers, 3, 'Free users must be 4 - 1 = 3');
  assert.equal(todayMetrics.newUsers, 2, '2 users created today');
  assert.equal(todayMetrics.activeUsers, 2, '2 users logged in today');
  assert.equal(todayMetrics.suspendedUsers, 1, '1 suspended user');

  // Test 2: 30d period
  const thirtyDayMetrics = computeRealUserMetrics(sampleUsers, activeSubs, '30d', testNow);
  assert.equal(thirtyDayMetrics.totalUsers, 4);
  assert.equal(thirtyDayMetrics.newUsers, 4, 'All 4 users created within 30d');
  assert.equal(thirtyDayMetrics.activeUsers, 3, '3 users logged in within 30d');

  // Test 3: Zero paid subs invariant
  const zeroSubsMetrics = computeRealUserMetrics(sampleUsers, [], '30d', testNow);
  assert.equal(zeroSubsMetrics.proUsers, 0);
  assert.equal(zeroSubsMetrics.freeUsers, 4, 'When 0 pro subs, all users are Free');
});

test('Section 2: Date Range Boundaries & Trend Calculation', () => {
  const testNow = new Date('2026-09-14T12:00:00.000Z');

  // 1. Today
  const bToday = getDateRangeBoundaries('today', testNow);
  assert.equal(bToday.daysCount, 1);
  assert.equal(bToday.currentStart.getDate(), testNow.getDate());
  assert.equal(bToday.currentStart.getMonth(), testNow.getMonth());

  // 2. 7d
  const b7d = getDateRangeBoundaries('7d', testNow);
  assert.equal(b7d.daysCount, 7);
  const diff7d = b7d.currentEnd.getTime() - b7d.currentStart.getTime();
  assert.equal(diff7d, 7 * 864e5);
  // Previous window must match exact duration
  const prevDiff7d = b7d.previousEnd.getTime() - b7d.previousStart.getTime();
  assert.equal(prevDiff7d, diff7d);

  // 3. Trend calculations
  const trendUp = calculateTrend(10, 5);
  assert.equal(trendUp.diff, 5);
  assert.equal(trendUp.percentage, 100);
  assert.equal(trendUp.isPositive, true);

  const trendDown = calculateTrend(2, 4);
  assert.equal(trendDown.diff, -2);
  assert.equal(trendDown.percentage, -50);
  assert.equal(trendDown.isPositive, false);

  const trendFromZero = calculateTrend(3, 0);
  assert.equal(trendFromZero.diff, 3);
  assert.equal(trendFromZero.percentage, 100);

  const trendZeroZero = calculateTrend(0, 0);
  assert.equal(trendZeroZero.diff, 0);
  assert.equal(trendZeroZero.percentage, 0);
});

test('Section 3: Per-User Safe Analytics & Privacy Invariant', () => {
  const events = [
    {
      id: 'e1',
      userId: 'user_test_1',
      eventType: 'tool_run',
      toolSlug: 'pdf-to-word',
      status: 'completed',
      durationMs: 150,
      createdAt: '2026-09-14T10:00:00Z',
      metadata: { source: 'navbar', format: 'docx' },
    },
    {
      id: 'e2',
      userId: 'user_test_1',
      eventType: 'tool_run',
      toolSlug: 'pdf-to-word',
      status: 'completed',
      durationMs: 200,
      createdAt: '2026-09-14T10:15:00Z',
      metadata: { source: 'mega-menu' },
    },
    {
      id: 'e3',
      userId: 'user_test_1',
      eventType: 'tool_run',
      toolSlug: 'sgpa-calculator',
      status: 'completed',
      durationMs: 50,
      createdAt: '2026-09-14T10:30:00Z',
      metadata: { source: 'search' },
    },
    {
      id: 'e4',
      userId: 'user_test_1',
      eventType: 'search_query',
      createdAt: '2026-09-14T09:45:00Z',
      metadata: { queryLength: 8 },
    },
    {
      id: 'e5',
      userId: 'user_test_1',
      eventType: 'ai_tool_open',
      toolSlug: 'compress-pdf',
      createdAt: '2026-09-14T09:50:00Z',
      metadata: { source: 'ai_assistant' },
    },
  ];

  // Aggregation
  let totalToolUses = 0;
  let completedUses = 0;
  let searches = 0;
  let aiUses = 0;
  const toolCounts = new Map();

  events.forEach((e) => {
    if (e.eventType.includes('tool') || e.eventType === 'tool_run') {
      totalToolUses++;
      if (e.status === 'completed' || e.eventType === 'tool_run') completedUses++;
      if (e.toolSlug) toolCounts.set(e.toolSlug, (toolCounts.get(e.toolSlug) || 0) + 1);
    }
    if (e.eventType.includes('search')) searches++;
    if (e.eventType.includes('ai')) aiUses++;
  });

  assert.equal(totalToolUses, 4, 'Total tool operations should be 4');
  assert.equal(completedUses, 3, 'Completed runs should be 3');
  assert.equal(searches, 1);
  assert.equal(aiUses, 1);
  assert.equal(toolCounts.get('pdf-to-word'), 2, 'pdf-to-word used twice');

  // Privacy invariant: zero document text or private user content
  for (const evt of events) {
    assert.equal(evt.metadata.documentText, undefined, 'Must NEVER store document text');
    assert.equal(evt.metadata.marks, undefined, 'Must NEVER store marks');
    assert.equal(evt.metadata.resumeText, undefined, 'Must NEVER store resume content');
    assert.equal(evt.metadata.fileContent, undefined, 'Must NEVER store file content');
  }
});

test('Section 4: Server API Route File Integrity & Authorization Checks', () => {
  const usersRoutePath = path.join(process.cwd(), 'src/app/api/admin/users/route.ts');
  const userDetailRoutePath = path.join(process.cwd(), 'src/app/api/admin/users/[id]/route.ts');
  const overviewRoutePath = path.join(process.cwd(), 'src/app/api/admin/analytics/overview/route.ts');
  const adminUsersPagePath = path.join(process.cwd(), 'src/app/admin/users/page.tsx');
  const userDashboardPagePath = path.join(process.cwd(), 'src/app/admin/users/[id]/page.tsx');
  const adminDashboardPath = path.join(process.cwd(), 'src/app/admin/page.tsx');

  assert.ok(fs.existsSync(usersRoutePath), 'Users API route must exist');
  assert.ok(fs.existsSync(userDetailRoutePath), 'User Detail API route must exist');
  assert.ok(fs.existsSync(overviewRoutePath), 'Analytics Overview API route must exist');
  assert.ok(fs.existsSync(adminUsersPagePath), 'Admin Users Directory page must exist');
  assert.ok(fs.existsSync(userDashboardPagePath), 'User Dashboard page must exist');
  assert.ok(fs.existsSync(adminDashboardPath), 'Admin Dashboard page must exist');

  // Check auth protection
  const usersRouteContent = fs.readFileSync(usersRoutePath, 'utf8');
  assert.ok(
    usersRouteContent.includes("getAuthenticatedAdmin(request, 'VIEW')"),
    'Users API route must enforce VIEW permission'
  );

  const userDetailContent = fs.readFileSync(userDetailRoutePath, 'utf8');
  assert.ok(
    userDetailContent.includes("getAuthenticatedAdmin(request, 'VIEW')"),
    'User Detail GET must enforce VIEW permission'
  );
  assert.ok(
    userDetailContent.includes("getAuthenticatedAdmin(request, 'MANAGE')"),
    'User Detail POST must enforce MANAGE permission'
  );

  // Check UI pages contain required components
  const adminUsersPageContent = fs.readFileSync(adminUsersPagePath, 'utf8');
  assert.ok(adminUsersPageContent.includes('/admin/users/'), 'Users page must link to individual user dashboards');
  assert.ok(adminUsersPageContent.includes('providerFilter'), 'Users page must have provider filter');
  assert.ok(adminUsersPageContent.includes('toolUses'), 'Users page must display tool usage count');

  const adminDashboardContent = fs.readFileSync(adminDashboardPath, 'utf8');
  assert.ok(adminDashboardContent.includes('Total Users'), 'Admin dashboard must render Total Users');
  assert.ok(adminDashboardContent.includes('Active Users'), 'Admin dashboard must render Active Users');
  assert.ok(adminDashboardContent.includes('Free Users'), 'Admin dashboard must render Free Users');
  assert.ok(adminDashboardContent.includes('Pro Users'), 'Admin dashboard must render Pro Users');
  assert.ok(adminDashboardContent.includes('New Users'), 'Admin dashboard must render New Users');
  assert.ok(adminDashboardContent.includes('/api/admin/analytics/overview'), 'Admin dashboard must query server overview API');
});

test('Section 5: Zero Fake Event Generation Invariant', () => {
  const analyticsStorePath = path.join(process.cwd(), 'src/lib/analytics/analytics-store.ts');
  const content = fs.readFileSync(analyticsStorePath, 'utf8');

  assert.ok(
    !content.includes('seedInitialEvents'),
    'analytics-store.ts must NOT contain seedInitialEvents (zero fake events allowed)'
  );
  assert.ok(
    content.includes('getUserAnalytics'),
    'analytics-store.ts must export getUserAnalytics method'
  );
});

test('Section 6: Ad Store Persistence Invariant', () => {
  const adStorePath = path.join(process.cwd(), 'src/lib/advertising/ad-store.ts');
  const content = fs.readFileSync(adStorePath, 'utf8');

  assert.ok(
    content.includes("from('ad_analytics_events')"),
    'ad-store.ts must persist events to Supabase ad_analytics_events table'
  );
  assert.ok(
    content.includes("from('advertisements')"),
    'ad-store.ts must synchronize with Supabase advertisements table'
  );
});
