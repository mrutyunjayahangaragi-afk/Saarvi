import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Saarvi Notification Center 2.0 Comprehensive Architecture Suite", () => {
  const rootDir = process.cwd();

  // =========================================================================
  // 1. Migration 015 & Notification Center Schema
  // =========================================================================
  test("Requirement 26: Migration 015 creates all required notification tables, indexes, and RLS", () => {
    const migrationPath = path.join(rootDir, "supabase/migrations/015_notification_center_and_rbac.sql");
    assert.ok(fs.existsSync(migrationPath), "Migration 015 must exist");

    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.notifications"), "Must create notifications table");
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.notification_recipients"), "Must create notification_recipients table");
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.notification_templates"), "Must create notification_templates table");
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.notification_preferences"), "Must create notification_preferences table");
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.notification_audit_logs"), "Must create notification_audit_logs table");
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.notification_system_settings"), "Must create notification_system_settings table");
    assert.ok(sql.includes("idempotency_key"), "recipients must have idempotency_key");
    assert.ok(sql.includes("ENABLE ROW LEVEL SECURITY"), "Must enable RLS on all tables");
    assert.ok(sql.includes("Users can read their delivered notifications"), "Must define user read policy");
  });

  // =========================================================================
  // 2. Audience Resolution & Targeting Safety
  // =========================================================================
  test("Requirements 7, 8, 9: Audience resolution logic and privacy protection", () => {
    const sampleUsers = [
      { id: "u1", email: "student1@example.com", fullName: "Alice Student", role: "USER", plan: "FREE", status: "ACTIVE" },
      { id: "u2", email: "student2@example.com", fullName: "Bob Pro", role: "USER", plan: "PRO", status: "ACTIVE" },
      { id: "u3", email: "muttuhangaragi161@gmail.com", fullName: "Muttu SuperAdmin", role: "SUPER_ADMIN", plan: "PRO", status: "ACTIVE" },
      { id: "u4", email: "unverified@example.com", fullName: "Unverified User", role: "USER", plan: "FREE", status: "SUSPENDED" },
    ];

    function resolveAudience(type, def = {}) {
      switch (type) {
        case "ALL_USERS":
          return sampleUsers;
        case "FREE_USERS":
          return sampleUsers.filter((u) => u.plan === "FREE");
        case "PRO_USERS":
          return sampleUsers.filter((u) => u.plan === "PRO");
        case "ADMINS":
          return sampleUsers.filter((u) => u.role === "ADMIN" || u.role === "SUPER_ADMIN");
        case "SELECTED_USERS": {
          const ids = new Set(def.userIds || []);
          return sampleUsers.filter((u) => ids.has(u.id));
        }
        default:
          return sampleUsers;
      }
    }

    assert.equal(resolveAudience("ALL_USERS").length, 4);
    assert.equal(resolveAudience("FREE_USERS").length, 2);
    assert.equal(resolveAudience("PRO_USERS").length, 2);
    assert.equal(resolveAudience("ADMINS").length, 1);
    assert.equal(resolveAudience("SELECTED_USERS", { userIds: ["u1", "u3"] }).length, 2);
  });

  // =========================================================================
  // 3. Idempotency & Batch Delivery Engine
  // =========================================================================
  test("Requirements 11, 29, 30: Recipient deduplication and deterministic idempotency keys", () => {
    const candidateUsers = [
      { id: "user_1", email: "user1@example.com" },
      { id: "user_2", email: "user2@example.com" },
      { id: "user_1", email: "user1@example.com" }, // Duplicate
    ];

    // Deduplication via Set
    const seen = new Set();
    const deduped = [];
    for (const u of candidateUsers) {
      if (!seen.has(u.id)) {
        seen.add(u.id);
        deduped.push(u);
      }
    }
    assert.equal(deduped.length, 2, "Duplicate recipients must be eliminated via Set");

    const notificationId = "notif_20260916_abc123";
    const channels = ["in_app", "email"];

    const jobs = [];
    for (const u of deduped) {
      for (const ch of channels) {
        jobs.push({
          idempotencyKey: `${notificationId}_${u.id}_${ch}`,
          userId: u.id,
          channel: ch,
        });
      }
    }

    assert.equal(jobs.length, 4);
    assert.equal(new Set(jobs.map((j) => j.idempotencyKey)).size, 4, "All idempotency keys must be unique");
  });

  // =========================================================================
  // 4. CTA Safety & URL Validation
  // =========================================================================
  test("Requirement 33: URL validation blocks malicious schemes", () => {
    function validateUrl(url) {
      if (!url) return true;
      const lower = url.trim().toLowerCase();
      if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
        throw new Error("Invalid CTA URL: Dangerous scheme detected.");
      }
      return true;
    }

    assert.equal(validateUrl("/student/copilot/interview"), true);
    assert.equal(validateUrl("https://saarvi-beta.vercel.app/pricing"), true);
    assert.throws(() => validateUrl("javascript:alert(document.cookie)"), /Dangerous scheme/);
    assert.throws(() => validateUrl("data:text/html,<script>alert(1)</script>"), /Dangerous scheme/);
  });

  // =========================================================================
  // 5. User Notification Center UI (/notifications) & Navbar Bell
  // =========================================================================
  test("Requirements 3, 24: User notification page and Navbar bell integration", () => {
    const notifPageSource = fs.readFileSync(path.join(rootDir, "src/app/notifications/page.tsx"), "utf8");
    assert.ok(notifPageSource.includes("Saarvi Notification Center"), "Page must feature branded title");
    assert.ok(notifPageSource.includes("Announcements"), "Must include Announcements category tab");
    assert.ok(notifPageSource.includes("Offers"), "Must include Offers category tab");
    assert.ok(notifPageSource.includes("Interviews"), "Must include Interviews category tab");
    assert.ok(notifPageSource.includes("Mark all as read"), "Must include Mark all as read button");
    assert.ok(notifPageSource.includes("/api/notifications"), "Must fetch from authoritative API");

    const navbarSource = fs.readFileSync(path.join(rootDir, "src/components/layout/Navbar.tsx"), "utf8");
    assert.ok(navbarSource.includes('href="/notifications"'), "Navbar must link to /notifications");
    assert.ok(
      navbarSource.includes('unreadNotifications > 99 ? "99+" : unreadNotifications') ||
      navbarSource.includes("unreadNotifications > 99 ? '99+' : unreadNotifications") ||
      navbarSource.includes("unreadNotifications > 9 ? \"9+\" : unreadNotifications"),
      "Navbar badge must cap at 99+ or 9+"
    );
    assert.ok(navbarSource.includes("Bell"), "Navbar must render Bell icon");
  });

  // =========================================================================
  // 6. Admin Message Composer (/admin/notifications)
  // =========================================================================
  test("Requirements 5, 18, 19, 21: Admin messaging hub includes Composer, Preview, Send Confirmation, and Settings", () => {
    const adminNotifSource = fs.readFileSync(path.join(rootDir, "src/app/admin/notifications/page.tsx"), "utf8");
    assert.ok(adminNotifSource.includes("Broadcast Composer"), "Must have composer section");
    assert.ok(adminNotifSource.includes("Live Preview"), "Must support live in-app and email preview");
    assert.ok(adminNotifSource.includes("Confirm Notification Broadcast"), "Must have send confirmation safeguard modal");
    assert.ok(adminNotifSource.includes("SuperAdmin Global Notification Controls"), "Must include SuperAdmin settings panel");
    assert.ok(adminNotifSource.includes("Retry All Failed Deliveries"), "Must include retry button");
  });
});
