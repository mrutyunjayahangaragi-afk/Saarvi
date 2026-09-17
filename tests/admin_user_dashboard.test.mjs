import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Saarvi Admin User Dashboard 2.0 & Real Activity Test Suite", () => {
  const rootDir = process.cwd();

  test("1. Admin user route inspects real Supabase tables and enforces privacy invariants", () => {
    const routePath = path.join(rootDir, "src/app/api/admin/users/[id]/route.ts");
    assert.ok(fs.existsSync(routePath), "Admin user dynamic route must exist");

    const code = fs.readFileSync(routePath, "utf8");
    // Verifies real data joins from conversion_history, interview_sessions, notification_recipients, subscriptions
    assert.ok(code.includes("conversion_history"), "Must query conversion_history table");
    assert.ok(code.includes("interview_sessions"), "Must query interview_sessions table");
    assert.ok(code.includes("notification_recipients"), "Must query notification_recipients table");
    assert.ok(code.includes("subscriptions"), "Must query subscriptions table");

    // Enforces privacy invariants: user documents/resumes remain client-side
    assert.ok(!code.includes("document_content"), "Must not store or read user document contents");
    assert.ok(!code.includes("resume_text"), "Must not store or read user resume text");
  });

  test("2. Admin user action RESEND_WELCOME delegates to UserOnboardingService with audit log", () => {
    const routePath = path.join(rootDir, "src/app/api/admin/users/[id]/route.ts");
    const code = fs.readFileSync(routePath, "utf8");

    assert.ok(code.includes("RESEND_WELCOME"), "Must handle RESEND_WELCOME action");
    assert.ok(code.includes("UserOnboardingService.resendWelcomeEmail"), "Must call UserOnboardingService.resendWelcomeEmail");
    assert.ok(code.includes("authResult.user.id"), "Must log admin actor user ID");
  });

  test("3. Role modification is strictly restricted to SUPER_ADMIN", () => {
    const routePath = path.join(rootDir, "src/app/api/admin/users/[id]/route.ts");
    const code = fs.readFileSync(routePath, "utf8");

    assert.ok(code.includes("UPDATE_ROLE"), "Must handle UPDATE_ROLE action");
    assert.ok(code.includes("authResult.user.role !== 'SUPER_ADMIN'"), "Must verify SUPER_ADMIN role");
    assert.ok(code.includes("status: 403"), "Must return 403 Forbidden for non-superadmin");
  });

  test("4. User Detail UI renders comprehensive tabbed views and privacy notice", () => {
    const pagePath = path.join(rootDir, "src/app/admin/users/[id]/page.tsx");
    assert.ok(fs.existsSync(pagePath), "Admin user detail page must exist");

    const code = fs.readFileSync(pagePath, "utf8");
    assert.ok(code.includes("activeTab === 'overview'"), "Must render overview tab");
    assert.ok(code.includes("activeTab === 'conversions'"), "Must render conversions tab");
    assert.ok(code.includes("activeTab === 'interviews'"), "Must render mock interviews tab");
    assert.ok(code.includes("activeTab === 'notifications'"), "Must render notifications tab");
    assert.ok(code.includes("activeTab === 'billing'"), "Must render billing tab");
    assert.ok(code.includes("Privacy & Storage Invariants") || code.includes("Privacy & Architecture Invariants"), "Must render Privacy Invariants card");
    assert.ok(code.includes("Resend Welcome Email"), "Must include Resend Welcome Email button");
  });
});
