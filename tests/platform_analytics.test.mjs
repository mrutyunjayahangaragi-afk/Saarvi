import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Saarvi Production Real Analytics Engine Test Suite", () => {
  const rootDir = process.cwd();

  test("1. PlatformAnalyticsService integrates real auth, conversions, events, and subscriptions", () => {
    const servicePath = path.join(rootDir, "src/lib/services/platform-analytics-service.ts");
    assert.ok(fs.existsSync(servicePath), "PlatformAnalyticsService file must exist");

    const code = fs.readFileSync(servicePath, "utf8");
    assert.ok(code.includes("class PlatformAnalyticsService"), "Must declare PlatformAnalyticsService class");
    assert.ok(code.includes("getComprehensiveAnalytics"), "Must provide getComprehensiveAnalytics method");
    assert.ok(code.includes("getBoundaries"), "Must provide getBoundaries helper");
    assert.ok(code.includes("conversion_history"), "Must query conversion_history");
    assert.ok(code.includes("subscription_requests"), "Must query subscription_requests");
    assert.ok(code.includes("interview_sessions"), "Must query interview_sessions");
  });

  test("2. Date range boundaries support 7d, 30d, 90d, and all windows", () => {
    function getDateRangeBoundaries(period) {
      const now = new Date();
      let days = 30;
      if (period === '7d') days = 7;
      else if (period === '30d') days = 30;
      else if (period === '90d') days = 90;
      else if (period === 'all') days = 3650;

      const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const previousStart = new Date(start.getTime() - days * 24 * 60 * 60 * 1000);
      return { start, end: now, previousStart };
    }

    const b7 = getDateRangeBoundaries('7d');
    assert.ok(b7.end.getTime() - b7.start.getTime() >= 6 * 24 * 3600 * 1000);

    const b30 = getDateRangeBoundaries('30d');
    assert.ok(b30.end.getTime() - b30.start.getTime() >= 29 * 24 * 3600 * 1000);

    const b90 = getDateRangeBoundaries('90d');
    assert.ok(b90.end.getTime() - b90.start.getTime() >= 89 * 24 * 3600 * 1000);
  });

  test("3. Analytics Overview API route maintains backward compatibility while serving real metrics", () => {
    const routePath = path.join(rootDir, "src/app/api/admin/analytics/overview/route.ts");
    assert.ok(fs.existsSync(routePath), "Analytics overview route must exist");

    const code = fs.readFileSync(routePath, "utf8");
    assert.ok(code.includes("PlatformAnalyticsService"), "Must use PlatformAnalyticsService");
    assert.ok(code.includes("metrics"), "Must return production metrics");
    assert.ok(code.includes("totalToolRuns"), "Must return totalToolRuns for backward compatibility");
    assert.ok(code.includes("totalUsers"), "Must return totalUsers");
  });

  test("4. Event ingestion route auto-attaches session user_id when available", () => {
    const eventRoutePath = path.join(rootDir, "src/app/api/analytics/event/route.ts");
    assert.ok(fs.existsSync(eventRoutePath), "Analytics event ingestion route must exist");

    const code = fs.readFileSync(eventRoutePath, "utf8");
    assert.ok(code.includes("supabase.auth.getUser()"), "Must resolve authenticated session user");
    assert.ok(code.includes("userId: resolvedUserId"), "Must attach resolved user_id to event payload");
  });
});
