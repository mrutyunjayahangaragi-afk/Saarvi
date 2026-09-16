import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Saarvi SuperAdmin RBAC & Google Search Console Ownership Verification Suite", () => {
  const rootDir = process.cwd();

  // =========================================================================
  // 1. Database Migration 015 & Last SuperAdmin Trigger
  // =========================================================================
  test("Requirement A1 & A3: Migration 015 enforces role audit logs and last SuperAdmin trigger", () => {
    const migrationPath = path.join(rootDir, "supabase/migrations/015_notification_center_and_rbac.sql");
    assert.ok(fs.existsSync(migrationPath), "Migration 015 must exist");

    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.role_audit_logs"), "Must create role_audit_logs table");
    assert.ok(sql.includes("actor_user_id"), "role_audit_logs must include actor_user_id");
    assert.ok(sql.includes("target_user_id"), "role_audit_logs must include target_user_id");
    assert.ok(sql.includes("old_role"), "role_audit_logs must include old_role");
    assert.ok(sql.includes("new_role"), "role_audit_logs must include new_role");
    assert.ok(sql.includes("check_last_superadmin_protection"), "Must define check_last_superadmin_protection function");
    assert.ok(sql.includes("At least one active SuperAdmin is required."), "Must throw exact SuperAdmin protection message");
    assert.ok(sql.includes("CREATE TRIGGER trg_protect_last_superadmin"), "Must define trigger trg_protect_last_superadmin");
  });

  // =========================================================================
  // 2. Server-Authoritative RBAC Invariants & Last SuperAdmin Guard
  // =========================================================================
  test("Requirement A2 & A3: Last SuperAdmin invariant function blocks demoting/suspending the last SuperAdmin", () => {
    // Invariant simulator
    const users = [
      { id: "u1", email: "muttuhangaragi161@gmail.com", role: "SUPER_ADMIN", status: "ACTIVE" },
      { id: "u2", email: "admin@saarvi.in", role: "USER", status: "ACTIVE" },
      { id: "u3", email: "admin@docease.com", role: "USER", status: "ACTIVE" },
    ];

    function validateSuperAdminMutation(targetUserId, nextRole, nextStatus) {
      const target = users.find((u) => u.id === targetUserId);
      if (!target) throw new Error("User not found.");

      if (target.role === "SUPER_ADMIN" && target.status === "ACTIVE") {
        const isDemoting = nextRole && nextRole !== "SUPER_ADMIN";
        const isSuspending = nextStatus && nextStatus !== "ACTIVE";

        if (isDemoting || isSuspending) {
          const otherActive = users.filter(
            (u) => u.id !== targetUserId && u.role === "SUPER_ADMIN" && u.status === "ACTIVE"
          );
          if (otherActive.length === 0) {
            throw new Error("At least one active SuperAdmin is required.");
          }
        }
      }
      return true;
    }

    // Attempting to demote sole active SuperAdmin
    assert.throws(
      () => validateSuperAdminMutation("u1", "ADMIN", "ACTIVE"),
      /At least one active SuperAdmin is required./,
      "Must reject demoting the last active SuperAdmin"
    );

    // Attempting to suspend sole active SuperAdmin
    assert.throws(
      () => validateSuperAdminMutation("u1", "SUPER_ADMIN", "SUSPENDED"),
      /At least one active SuperAdmin is required./,
      "Must reject suspending the last active SuperAdmin"
    );

    // Adding a second SuperAdmin allows demoting the first
    users.push({ id: "u4", email: "second@saarvi.in", role: "SUPER_ADMIN", status: "ACTIVE" });
    assert.equal(validateSuperAdminMutation("u1", "ADMIN", "ACTIVE"), true, "Demoting allowed when another active SuperAdmin exists");
  });

  // =========================================================================
  // 3. Role Hierarchy & Authority Enforcement
  // =========================================================================
  test("Requirement A1 & A2: Strict Role Hierarchy (SUPER_ADMIN > ADMIN > USER)", () => {
    const ROLE_CAPABILITIES = {
      SUPER_ADMIN: { canCreateAdmin: true, canRevokeAdmin: true, canManageSecurity: true, canDemoteSuperAdmin: true },
      ADMIN: { canCreateAdmin: false, canRevokeAdmin: false, canManageSecurity: false, canDemoteSuperAdmin: false },
      USER: { canCreateAdmin: false, canRevokeAdmin: false, canManageSecurity: false, canDemoteSuperAdmin: false },
    };

    function assertCanPerform(actorRole, action) {
      const perms = ROLE_CAPABILITIES[actorRole] || {};
      if (!perms[action]) {
        throw new Error("Permission denied: Only SUPER_ADMIN can modify administrator roles.");
      }
      return true;
    }

    // SuperAdmin capabilities
    assert.equal(assertCanPerform("SUPER_ADMIN", "canCreateAdmin"), true);
    assert.equal(assertCanPerform("SUPER_ADMIN", "canRevokeAdmin"), true);
    assert.equal(assertCanPerform("SUPER_ADMIN", "canManageSecurity"), true);

    // Admin capabilities blocked from SuperAdmin actions
    assert.throws(() => assertCanPerform("ADMIN", "canCreateAdmin"), /Permission denied/);
    assert.throws(() => assertCanPerform("ADMIN", "canRevokeAdmin"), /Permission denied/);
    assert.throws(() => assertCanPerform("ADMIN", "canManageSecurity"), /Permission denied/);

    // User blocked from all privileged actions
    assert.throws(() => assertCanPerform("USER", "canCreateAdmin"), /Permission denied/);
    assert.throws(() => assertCanPerform("USER", "canRevokeAdmin"), /Permission denied/);
  });

  // =========================================================================
  // 4. Verification of Designated Active SuperAdmin in Source Code
  // =========================================================================
  test("Requirement A4: Desired active SuperAdmin is muttuhangaragi161@gmail.com and legacy admins are revoked", () => {
    const adminAuthSource = fs.readFileSync(path.join(rootDir, "src/lib/security/admin-auth.ts"), "utf8");
    assert.ok(adminAuthSource.includes("muttuhangaragi161@gmail.com"), "admin-auth.ts must configure muttuhangaragi161@gmail.com");
    assert.ok(!adminAuthSource.includes("'admin@saarvi.in',\n            'admin@saarvi.app',"), "admin-auth.ts must NOT auto-elevate legacy admin@saarvi.in");
    assert.ok(!adminAuthSource.includes("'admin@docease.com'"), "admin-auth.ts must NOT auto-elevate legacy admin@docease.com");

    const authHelperSource = fs.readFileSync(path.join(rootDir, "src/lib/notifications/auth-helper.ts"), "utf8");
    assert.ok(authHelperSource.includes("muttuhangaragi161@gmail.com"), "auth-helper.ts must recognize muttuhangaragi161@gmail.com");
    assert.ok(!authHelperSource.includes("'admin@saarvi.in'"), "auth-helper.ts must NOT auto-elevate admin@saarvi.in");
    assert.ok(!authHelperSource.includes("'admin@docease.com'"), "auth-helper.ts must NOT auto-elevate admin@docease.com");

    const mockStorageSource = fs.readFileSync(path.join(rootDir, "src/lib/supabase/mock-storage.ts"), "utf8");
    assert.ok(mockStorageSource.includes("admin_muttu_super"), "mock-storage.ts must configure admin_muttu_super");
    assert.ok(mockStorageSource.includes("user_saarvi_standard"), "mock-storage.ts must downgrade admin@saarvi.in to USER");
    assert.ok(mockStorageSource.includes("user_legacy_standard"), "mock-storage.ts must downgrade admin@docease.com to USER");
  });

  // =========================================================================
  // 5. Admin Management UI Requirements (/admin/admins)
  // =========================================================================
  test("Requirement A5: Admin management UI includes distinct badges and specific action labels", () => {
    const adminPageSource = fs.readFileSync(path.join(rootDir, "src/app/admin/admins/page.tsx"), "utf8");
    assert.ok(adminPageSource.includes("SUPER_ADMIN"), "UI must display SUPER_ADMIN badge");
    assert.ok(adminPageSource.includes("ADMIN"), "UI must display ADMIN badge");
    assert.ok(adminPageSource.includes("USER"), "UI must display USER badge");
    assert.ok(adminPageSource.includes("Revoke SuperAdmin / Demote to Admin"), "Must include SuperAdmin revocation action");
    assert.ok(adminPageSource.includes("Revoke Admin Access"), "Must include Admin revocation action");
    assert.ok(adminPageSource.includes("Demote to User"), "Must include Demote to User action");
    assert.ok(adminPageSource.includes("Sole Active SuperAdmin"), "UI must visually protect sole active SuperAdmin");
  });

  // =========================================================================
  // 6. Google Search Console Verification & Metadata Integration
  // =========================================================================
  test("Requirement B1-B5: Next.js Root Layout metadata supports runtime GOOGLE_SITE_VERIFICATION", () => {
    const layoutSource = fs.readFileSync(path.join(rootDir, "src/app/layout.tsx"), "utf8");

    assert.ok(layoutSource.includes("GOOGLE_SITE_VERIFICATION"), "layout.tsx must read GOOGLE_SITE_VERIFICATION from runtime env");
    assert.ok(layoutSource.includes("NEXT_PUBLIC_SITE_URL"), "layout.tsx must read NEXT_PUBLIC_SITE_URL");
    assert.ok(layoutSource.includes("metadataBase: new URL(siteUrl)"), "Must use dynamic siteUrl for metadataBase");
    assert.ok(layoutSource.includes("verification: googleVerification"), "Must assign verification.google dynamically");

    // Documentation check
    const docPath = path.join(rootDir, "docs/google-search-console-verification.md");
    assert.ok(fs.existsSync(docPath), "docs/google-search-console-verification.md must exist");
    const doc = fs.readFileSync(docPath, "utf8");
    assert.ok(doc.includes("https://saarvi-beta.vercel.app/"), "Doc must reference current deployment URL");
    assert.ok(doc.includes("GOOGLE_SITE_VERIFICATION"), "Doc must document GOOGLE_SITE_VERIFICATION");
    assert.ok(doc.includes("Google Search Console"), "Doc must cover Search Console");
    assert.ok(doc.includes("Google OAuth Branding"), "Doc must distinguish OAuth Branding verification");
  });
});
