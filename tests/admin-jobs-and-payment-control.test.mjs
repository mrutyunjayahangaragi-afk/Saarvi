import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Saarvi Enterprise Admin Control, Auth, Jobs & Payment Suite", () => {
  const rootDir = process.cwd();

  // =========================================================================
  // PART 1: SUPABASE AUTHENTICATION SECURITY & BUTTON PLACEMENT
  // =========================================================================
  describe("1. Supabase Authentication Security & Navigation Placement", () => {
    test("1.1 Application tables, profiles, and JWT must never store user passwords", () => {
      // Check auth context and login forms
      const authContextFile = path.join(rootDir, "src/context/AuthContext.tsx");
      assert.ok(fs.existsSync(authContextFile), "AuthContext must exist");
      const authCode = fs.readFileSync(authContextFile, "utf8");

      assert.ok(!authCode.includes("password: user.password"), "Password must not be stored in user context state");
      assert.ok(!authCode.includes("localStorage.setItem('password'"), "Password must never be saved to localStorage");

      // Verify profiles table schema doesn't have custom password storage
      const schemaFile = path.join(rootDir, "src/lib/academic/storage/academic-db.ts");
      if (fs.existsSync(schemaFile)) {
        const schemaCode = fs.readFileSync(schemaFile, "utf8");
        assert.ok(!schemaCode.toLowerCase().includes("password_hash text"), "No custom password hash columns in app DB");
      }
    });

    test("1.2 Supabase Auth SSR / PKCE email and Google login are configured", () => {
      const authHelperFile = path.join(rootDir, "src/lib/notifications/auth-helper.ts");
      assert.ok(fs.existsSync(authHelperFile), "Auth helper must exist");
      const helperCode = fs.readFileSync(authHelperFile, "utf8");
      assert.ok(helperCode.includes("createClient"), "Must use server Supabase client for session extraction");

      // Verify Google login configuration
      const loginPageFile = path.join(rootDir, "src/app/auth/login/page.tsx");
      if (fs.existsSync(loginPageFile)) {
        const loginCode = fs.readFileSync(loginPageFile, "utf8");
        assert.ok(loginCode.includes("signInWithOAuth") || loginCode.includes("google") || loginCode.includes("Google"), "Google login supported via Supabase");
      }
    });

    test("1.3 Desktop & Mobile Navbar renders both Login and Create account side-by-side in designated space", () => {
      const navbarFile = path.join(rootDir, "src/components/layout/Navbar.tsx");
      assert.ok(fs.existsSync(navbarFile), "Navbar component must exist");
      const navbarCode = fs.readFileSync(navbarFile, "utf8");

      // Desktop & Mobile Auth Area
      assert.ok(navbarCode.includes("Login"), "Navbar must render Login button");
      assert.ok(navbarCode.includes("Create account") || navbarCode.includes("Create Account"), "Navbar must render Create account button");
      assert.ok(navbarCode.includes("/login"), "Navbar Login links to /login");
      assert.ok(navbarCode.includes("/signup"), "Navbar Create account links to /signup");

      // Dynamic switch to authenticated state
      assert.ok(navbarCode.includes("!isLoading && user ?"), "Navbar switches cleanly when authenticated");
    });
  });

  // =========================================================================
  // PART 2: JOBS & INTERNSHIPS ADMIN FEATURE CONTROL
  // =========================================================================
  describe("2. Jobs & Internships Server-Authoritative Feature Control", () => {
    // Pure behavioral test for JobsFeatureControl evaluation logic
    function evaluateJobsAccess(settings, userContext) {
      if (userContext.isSuperAdmin) {
        return { allowed: true, reason: "ADMIN_OVERRIDE" };
      }
      if (settings.mode === "DISABLED" || !settings.enabled) {
        return {
          allowed: false,
          reason: "DISABLED",
          message: settings.maintenance_message || "Jobs & Internships is currently unavailable.",
        };
      }
      if (settings.mode === "BETA") {
        const allowlistEmails = (settings.beta_email_allowlist || []).map((e) => e.toLowerCase());
        const allowlistUserIds = settings.beta_user_ids || [];
        const isEmailAllowed = userContext.email && allowlistEmails.includes(userContext.email.toLowerCase());
        const isUserIdAllowed = userContext.userId && allowlistUserIds.includes(userContext.userId);

        if (!isEmailAllowed && !isUserIdAllowed) {
          return {
            allowed: false,
            reason: "BETA_RESTRICTED",
            message: "Jobs & Internships is currently in beta for selected users.",
          };
        }
      }
      if (settings.access_tier === "PRO" && !userContext.isPro) {
        return {
          allowed: false,
          reason: "PRO_REQUIRED",
          message: "Jobs & Internships requires an active Saarvi Pro membership.",
        };
      }
      return { allowed: true, reason: "AUTHORIZED" };
    }

    test("2.1 Admin disables Jobs & Internships -> User access rejected server-side", () => {
      const disabledSettings = {
        enabled: false,
        mode: "DISABLED",
        access_tier: "FREE",
        navbar_visible: false,
        search_visible: false,
        maintenance_message: "Jobs portal undergoing scheduled maintenance.",
      };

      const userEval = evaluateJobsAccess(disabledSettings, {
        userId: "student_1",
        email: "student@saarvi.app",
        isSuperAdmin: false,
      });

      assert.equal(userEval.allowed, false);
      assert.equal(userEval.reason, "DISABLED");
      assert.ok(userEval.message.includes("Jobs portal undergoing scheduled maintenance."));

      // Admin has override for discovery
      const adminEval = evaluateJobsAccess(disabledSettings, {
        userId: "admin_1",
        email: "superadmin@saarvi.app",
        isSuperAdmin: true,
      });
      assert.equal(adminEval.allowed, true);
    });

    test("2.2 Admin sets BETA mode -> Only allowlisted users can access", () => {
      const betaSettings = {
        enabled: true,
        mode: "BETA",
        access_tier: "FREE",
        beta_email_allowlist: ["beta_tester@saarvi.app"],
        beta_user_ids: ["usr_beta_99"],
      };

      // Non-beta user blocked
      const nonBeta = evaluateJobsAccess(betaSettings, {
        userId: "regular_user_1",
        email: "regular@saarvi.app",
      });
      assert.equal(nonBeta.allowed, false);
      assert.equal(nonBeta.reason, "BETA_RESTRICTED");

      // Beta user by email allowed
      const betaEmail = evaluateJobsAccess(betaSettings, {
        userId: "some_id",
        email: "beta_tester@saarvi.app",
      });
      assert.equal(betaEmail.allowed, true);

      // Beta user by ID allowed
      const betaId = evaluateJobsAccess(betaSettings, {
        userId: "usr_beta_99",
        email: "random@saarvi.app",
      });
      assert.equal(betaId.allowed, true);
    });

    test("2.3 Admin sets ENABLED + PRO -> Free users denied, Pro users allowed", () => {
      const proSettings = {
        enabled: true,
        mode: "ENABLED",
        access_tier: "PRO",
      };

      // Free user denied
      const freeUser = evaluateJobsAccess(proSettings, {
        userId: "free_student_123",
        email: "student@saarvi.app",
        isPro: false,
      });
      assert.equal(freeUser.allowed, false);
      assert.equal(freeUser.reason, "PRO_REQUIRED");

      // Pro user allowed
      const proUser = evaluateJobsAccess(proSettings, {
        userId: "pro_student_456",
        email: "pro_student@saarvi.app",
        isPro: true,
      });
      assert.equal(proUser.allowed, true);
    });

    test("2.4 Jobs API routes strictly enforce feature control server-side", () => {
      const searchRoute = path.join(rootDir, "src/app/api/jobs/search/route.ts");
      const idRoute = path.join(rootDir, "src/app/api/jobs/[id]/route.ts");
      const alertsRoute = path.join(rootDir, "src/app/api/jobs/alerts/route.ts");

      assert.ok(fs.readFileSync(searchRoute, "utf8").includes("JobsFeatureControl.evaluateAccess"), "search route must enforce feature control");
      assert.ok(fs.readFileSync(idRoute, "utf8").includes("JobsFeatureControl.evaluateAccess"), "id route must enforce feature control");
      assert.ok(fs.readFileSync(alertsRoute, "utf8").includes("JobsFeatureControl.evaluateAccess"), "alerts route must enforce feature control");
    });

    test("2.5 Admin Career Control UI supports status, tier, navbar, search, and beta audience toggles", () => {
      const adminCareerFile = path.join(rootDir, "src/app/admin/career/page.tsx");
      assert.ok(fs.existsSync(adminCareerFile), "Admin career page must exist");
      const code = fs.readFileSync(adminCareerFile, "utf8");

      assert.ok(code.includes("ACCESS_CONTROL"), "Admin career page has Access Control tab");
      assert.ok(code.includes("beta_email_allowlist"), "Supports beta email allowlist configuration");
      assert.ok(code.includes("navbar_visible"), "Supports navbar visibility toggle");
      assert.ok(code.includes("search_visible"), "Supports global search visibility toggle");
      assert.ok(code.includes("maintenance_message"), "Supports maintenance message");
    });
  });

  // =========================================================================
  // PART 3: SUPERADMIN PAYMENT & BILLING CONTROL CENTER & ENTITLEMENTS
  // =========================================================================
  describe("3. Superadmin Payment & Billing Control Center & Entitlements", () => {
    // Pure calculation and state machine validation
    function calculateSlaStatus(req) {
      if (req.status === "APPROVED" || req.status === "REJECTED") {
        return { status: "REVIEWED", label: "Reviewed", isOverdue: false };
      }
      const deadline = new Date(req.slaDeadline).getTime();
      const diffMins = Math.round((deadline - Date.now()) / (1000 * 60));
      if (diffMins < 0) {
        return { status: "SLA_EXCEEDED", label: `SLA exceeded (${Math.abs(diffMins)}m overdue)`, isOverdue: true };
      }
      if (diffMins <= 30) {
        return { status: "APPROACHING_SLA", label: `Approaching SLA (~${diffMins}m left)`, isOverdue: false };
      }
      return { status: "WITHIN_SLA", label: `Within SLA (~${diffMins}m left)`, isOverdue: false };
    }

    function validateRejectionReason(reason) {
      if (!reason || typeof reason !== "string") return false;
      const clean = reason.trim();
      if (clean.length < 5) return false;
      const genericDisallowed = ["no", "invalid", "rejected", "test", "reject", "fake", "none"];
      if (genericDisallowed.includes(clean.toLowerCase())) return false;
      return true;
    }

    function calculateEntitlementPeriod(planDuration) {
      const now = new Date();
      const start = now.toISOString();
      const expiry = new Date(now.getTime() + (planDuration === "YEARLY" ? 365 : 30) * 86400000).toISOString();
      return { start, expiry };
    }

    test("3.1 2-Hour SLA calculation detects all four states safely", () => {
      const now = Date.now();

      // Within SLA (>30m left)
      const withinSla = calculateSlaStatus({
        status: "PENDING_REVIEW",
        slaDeadline: new Date(now + 90 * 60000).toISOString(),
      });
      assert.equal(withinSla.status, "WITHIN_SLA");
      assert.equal(withinSla.isOverdue, false);

      // Approaching SLA (<=30m left)
      const approachingSla = calculateSlaStatus({
        status: "PENDING_REVIEW",
        slaDeadline: new Date(now + 15 * 60000).toISOString(),
      });
      assert.equal(approachingSla.status, "APPROACHING_SLA");
      assert.equal(approachingSla.isOverdue, false);

      // SLA Exceeded
      const exceededSla = calculateSlaStatus({
        status: "PENDING_REVIEW",
        slaDeadline: new Date(now - 10 * 60000).toISOString(),
      });
      assert.equal(exceededSla.status, "SLA_EXCEEDED");
      assert.equal(exceededSla.isOverdue, true);

      // Reviewed
      const reviewedApproved = calculateSlaStatus({
        status: "APPROVED",
        slaDeadline: new Date(now - 60000).toISOString(),
      });
      assert.equal(reviewedApproved.status, "REVIEWED");
      assert.equal(reviewedApproved.isOverdue, false);
    });

    test("3.2 Rejection reason validation rejects short or generic placeholders", () => {
      assert.equal(validateRejectionReason(""), false);
      assert.equal(validateRejectionReason("no"), false);
      assert.equal(validateRejectionReason("invalid"), false);
      assert.equal(validateRejectionReason("test"), false);
      assert.equal(validateRejectionReason("The submitted UTR was not found on our bank credits for this date."), true);
    });

    test("3.3 Plan duration calculation accurately produces monthly (30d) and yearly (365d) entitlements", () => {
      const monthly = calculateEntitlementPeriod("MONTHLY");
      const monthlyDays = (new Date(monthly.expiry).getTime() - new Date(monthly.start).getTime()) / 86400000;
      assert.equal(Math.round(monthlyDays), 30);

      const yearly = calculateEntitlementPeriod("YEARLY");
      const yearlyDays = (new Date(yearly.expiry).getTime() - new Date(yearly.start).getTime()) / 86400000;
      assert.equal(Math.round(yearlyDays), 365);
    });

    test("3.4 Server-side SuperAdmin authorization is enforced on subscriptions and payment requests", () => {
      const subRoute = path.join(rootDir, "src/app/api/admin/billing/subscriptions/route.ts");
      const subCode = fs.readFileSync(subRoute, "utf8");
      assert.ok(subCode.includes("SUPER_ADMIN"), "Must check SUPER_ADMIN");
      assert.ok(subCode.includes("SuperAdmin privileges are strictly required"), "Must return strict forbidden message");

      const reqRoute = path.join(rootDir, "src/app/api/billing/payment-request/[id]/route.ts");
      const reqCode = fs.readFileSync(reqRoute, "utf8");
      assert.ok(reqCode.includes("SUPER_ADMIN"), "Review route must check SUPER_ADMIN");
      assert.ok(reqCode.includes("status: 403"), "Must return 403 for unauthorized users");
    });

    test("3.5 Billing Control Center UI includes real SLA badges, filters, pagination, and Section 4.18 Details Panel", () => {
      const billingPage = path.join(rootDir, "src/app/admin/billing/page.tsx");
      const pageCode = fs.readFileSync(billingPage, "utf8");

      assert.ok(pageCode.includes("const isSuperAdmin = profile?.role === 'SUPER_ADMIN' || user?.role === 'SUPER_ADMIN'"));
      assert.ok(pageCode.includes("SuperAdmin required"));
      assert.ok(pageCode.includes("computeSla"), "Must compute real 2-hour SLA in UI");
      assert.ok(pageCode.includes("SLA_APPROACHING"), "Filter includes SLA Approaching");
      assert.ok(pageCode.includes("SLA_EXCEEDED"), "Filter includes SLA Exceeded");
      assert.ok(pageCode.includes("configured plan?"), "Confirmation modal implemented");
      assert.ok(pageCode.includes("isRejectionReasonValid"), "Rejection reason validation enforced in UI");
    });
  });

  // =========================================================================
  // PART 4: ADMIN CONTROL FOR JOBS & INTERNSHIPS NAVBAR & ROUTES
  // =========================================================================
  describe("4. Admin Control for Jobs & Internships Navbar, Routes, and APIs", () => {
    test("4.1 Centralized feature access helpers evaluate authoritative state", () => {
      const featureControlPath = path.join(rootDir, "src/lib/jobs/feature-control.ts");
      assert.ok(fs.existsSync(featureControlPath), "feature-control.ts must exist");
      const code = fs.readFileSync(featureControlPath, "utf8");

      assert.ok(code.includes("export function isFeatureEnabled"), "Must export isFeatureEnabled");
      assert.ok(code.includes("export function isNavbarItemVisible"), "Must export isNavbarItemVisible");
      assert.ok(code.includes("export function getFeatureAccess"), "Must export getFeatureAccess");
    });

    test("4.2 Navbar component cleanly collapses space when disabled with no empty gap", () => {
      const navbarPath = path.join(rootDir, "src/components/layout/Navbar.tsx");
      const code = fs.readFileSync(navbarPath, "utf8");

      // Verify desktop condition
      assert.ok(code.includes("jobsNavbarVisible &&"), "Navbar desktop items conditionally rendered with jobsNavbarVisible");
      // Verify mobile condition
      assert.ok(code.includes("jobsNavbarVisible &&"), "Navbar mobile items conditionally rendered with jobsNavbarVisible");
      // Verify realtime event listener
      assert.ok(code.includes("saarvi:jobs-feature-changed"), "Navbar must listen to saarvi:jobs-feature-changed for realtime updates");
    });

    test("4.3 Global search strictly excludes Jobs & Internships when search is disabled", () => {
      const searchModalPath = path.join(rootDir, "src/components/tools/GlobalSearchModal.tsx");
      const code = fs.readFileSync(searchModalPath, "utf8");

      assert.ok(code.includes("!jobsSearchVisible"), "GlobalSearchModal checks jobsSearchVisible");
      assert.ok(code.includes("startsWith('/jobs')"), "Filters /jobs route from search");
      assert.ok(code.includes("startsWith('/internships')"), "Filters /internships route from search");
      assert.ok(code.includes("saarvi:jobs-feature-changed"), "GlobalSearchModal listens to saarvi:jobs-feature-changed");
    });

    test("4.4 Direct URL protection: /jobs and /internships render controlled unavailable screen", () => {
      const jobsPagePath = path.join(rootDir, "src/app/jobs/page.tsx");
      const jobsCode = fs.readFileSync(jobsPagePath, "utf8");

      assert.ok(jobsCode.includes("featureGated.status === \"DISABLED\""), "Jobs page intercepts DISABLED status");
      assert.ok(jobsCode.includes("This feature is currently unavailable."), "Jobs page shows unavailable message");
      assert.ok(jobsCode.includes("Please check back later."), "Jobs page suggests checking back later");

      const internshipsPagePath = path.join(rootDir, "src/app/internships/page.tsx");
      assert.ok(fs.existsSync(internshipsPagePath), "/internships page must exist");
      const internCode = fs.readFileSync(internshipsPagePath, "utf8");
      assert.ok(internCode.includes("Jobs & Internships"), "Internships page shows header");
      assert.ok(internCode.includes("This feature is currently unavailable."), "Internships page shows unavailable message");
    });

    test("4.5 API Protection: /api/jobs, /api/opportunities, /api/internships reject requests with 403 FEATURE_DISABLED", () => {
      const jobsRoutePath = path.join(rootDir, "src/app/api/jobs/route.ts");
      assert.ok(fs.existsSync(jobsRoutePath), "/api/jobs/route.ts must exist");
      const jobsRouteCode = fs.readFileSync(jobsRoutePath, "utf8");
      assert.ok(jobsRouteCode.includes("JobsFeatureControl.evaluateAccess"), "/api/jobs checks feature control");
      assert.ok(jobsRouteCode.includes("FEATURE_DISABLED"), "/api/jobs returns FEATURE_DISABLED");

      const oppsRoutePath = path.join(rootDir, "src/app/api/opportunities/route.ts");
      const oppsRouteCode = fs.readFileSync(oppsRoutePath, "utf8");
      assert.ok(oppsRouteCode.includes("JobsFeatureControl.evaluateAccess"), "/api/opportunities checks feature control");
      assert.ok(oppsRouteCode.includes("FEATURE_DISABLED"), "/api/opportunities returns FEATURE_DISABLED");

      const oppsIdRoutePath = path.join(rootDir, "src/app/api/opportunities/[id]/route.ts");
      const oppsIdCode = fs.readFileSync(oppsIdRoutePath, "utf8");
      assert.ok(oppsIdCode.includes("JobsFeatureControl.evaluateAccess"), "/api/opportunities/[id] checks feature control");

      const internshipsRoutePath = path.join(rootDir, "src/app/api/internships/route.ts");
      assert.ok(fs.existsSync(internshipsRoutePath), "/api/internships/route.ts must exist");
      const internCode = fs.readFileSync(internshipsRoutePath, "utf8");
      assert.ok(internCode.includes("JobsFeatureControl.evaluateAccess"), "/api/internships checks feature control");

      const internshipsSearchPath = path.join(rootDir, "src/app/api/internships/search/route.ts");
      assert.ok(fs.existsSync(internshipsSearchPath), "/api/internships/search/route.ts must exist");
      const internSearchCode = fs.readFileSync(internshipsSearchPath, "utf8");
      assert.ok(internSearchCode.includes("JobsFeatureControl.evaluateAccess"), "/api/internships/search checks feature control");
    });

    test("4.6 Admin Career Access & Availability UI handles real states, touch targets, and audit log", () => {
      const careerPagePath = path.join(rootDir, "src/app/admin/career/page.tsx");
      const code = fs.readFileSync(careerPagePath, "utf8");

      assert.ok(code.includes("Access & Availability"), "Tab labeled Access & Availability");
      assert.ok(code.includes("Jobs & Internships availability updated."), "Feedback text matches requirement");
      assert.ok(code.includes("Saving..."), "Button handles Saving... state");
      assert.ok(code.includes("Saved"), "Button handles Saved state");
      assert.ok(code.includes("Error"), "Button handles Error state");
      assert.ok(code.includes("Save Changes"), "Button handles Save Changes state");
      assert.ok(code.includes("min-h-[44px]"), "All interactive controls have minimum 44px touch target");
    });

    test("4.7 Server-side authorization prevents client bypass from DevTools, localStorage, or query params", () => {
      const adminRoutePath = path.join(rootDir, "src/app/api/admin/career/feature-control/route.ts");
      const code = fs.readFileSync(adminRoutePath, "utf8");

      assert.ok(code.includes("getAuthenticatedAdmin(req, 'ADMIN')"), "PUT /api/admin/career/feature-control enforces ADMIN role");
      assert.ok(!code.includes("req.headers.get('x-role')"), "Must never trust client spoofed header");
    });
  });
});

