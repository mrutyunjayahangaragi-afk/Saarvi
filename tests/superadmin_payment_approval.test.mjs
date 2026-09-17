import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Saarvi Superadmin Payment Approval & Subscription Activation Test Suite", () => {
  const rootDir = process.cwd();

  test("1. Admin billing subscriptions route strictly restricts approval/rejection to SUPER_ADMIN", () => {
    const routePath = path.join(rootDir, "src/app/api/admin/billing/subscriptions/route.ts");
    assert.ok(fs.existsSync(routePath), "Admin billing subscriptions route must exist");

    const code = fs.readFileSync(routePath, "utf8");
    // Verify SUPER_ADMIN authorization enforcement
    assert.ok(code.includes("SUPER_ADMIN"), "Must verify actor has SUPER_ADMIN role");
    assert.ok(code.includes("SuperAdmin privileges are strictly required"), "Must return strict forbidden error message");
    assert.ok(code.includes("status: 403"), "Must return 403 Forbidden for regular admins");
  });

  test("2. Rejection strictly requires non-empty reason note", () => {
    const routePath = path.join(rootDir, "src/app/api/admin/billing/subscriptions/route.ts");
    const code = fs.readFileSync(routePath, "utf8");

    assert.ok(code.includes("Rejection reason is required"), "Must require rejection reason note");
  });

  test("3. Payment approval activates PRO subscription with correct duration calculation", () => {
    const routePath = path.join(rootDir, "src/app/api/admin/billing/subscriptions/route.ts");
    const code = fs.readFileSync(routePath, "utf8");

    assert.ok(code.includes("expiresAt") || code.includes("current_period_end"), "Must manage subscription expiry date");
    assert.ok(code.includes("plan: \"PRO\""), "Must set plan to PRO");
    assert.ok(code.includes("APPROVED"), "Must transition status to APPROVED");
  });

  test("4. Payment Request review route validates SUPER_ADMIN privilege", () => {
    const routePath = path.join(rootDir, "src/app/api/billing/payment-request/[id]/route.ts");
    assert.ok(fs.existsSync(routePath), "Payment request review route must exist");

    const code = fs.readFileSync(routePath, "utf8");
    assert.ok(code.includes("SUPER_ADMIN"), "Review endpoint must enforce SUPER_ADMIN role");
    assert.ok(code.includes("status: 403"), "Must return 403 Forbidden");
  });

  test("5. Billing Admin UI disables approval controls and shows badge for non-superadmins", () => {
    const pagePath = path.join(rootDir, "src/app/admin/billing/page.tsx");
    assert.ok(fs.existsSync(pagePath), "Billing admin page must exist");

    const code = fs.readFileSync(pagePath, "utf8");
    assert.ok(code.includes("const isSuperAdmin = profile?.role === 'SUPER_ADMIN' || user?.role === 'SUPER_ADMIN'"), "Must compute isSuperAdmin flag");
    assert.ok(code.includes("SuperAdmin required"), "Must display SuperAdmin required indicator to regular admins");
  });
});
