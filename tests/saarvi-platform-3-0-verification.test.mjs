import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  SAMPLE_COVER_LETTER_DATA,
  isSampleCoverLetter,
  createSampleCoverLetterData,
} from "../src/lib/services/resumeSampleData.ts";

const ROOT_DIR = process.cwd();

// ============================================================================
// 1. BRAND & HEADER LOGO INTEGRITY
// ============================================================================

test("Brand & Logo Integrity: AdminSidebar and AdminHeader use single-asset SaarviNavbarLogo without duplicate text", () => {
  const sidebarContent = fs.readFileSync(
    path.join(ROOT_DIR, "src/components/admin/AdminSidebar.tsx"),
    "utf8"
  );
  const headerContent = fs.readFileSync(
    path.join(ROOT_DIR, "src/components/admin/AdminHeader.tsx"),
    "utf8"
  );

  // Both must import SaarviNavbarLogo
  assert.ok(
    sidebarContent.includes("SaarviNavbarLogo"),
    "AdminSidebar must import SaarviNavbarLogo"
  );
  assert.ok(
    headerContent.includes("SaarviNavbarLogo"),
    "AdminHeader must import SaarviNavbarLogo"
  );

  // Must NOT render duplicate text "Saarvi" next to the logo image
  assert.doesNotMatch(
    sidebarContent,
    /<span[^>]*font-black[^>]*>\s*Saarvi\s*<\/span>/,
    'AdminSidebar must not contain duplicate text "Saarvi" next to the logo'
  );

  // Sidebar must have clean Admin badge
  assert.ok(
    /Admin\s*<\/span>/.test(sidebarContent),
    "AdminSidebar must have an Admin badge"
  );
});

// ============================================================================
// 2. TOOL CONTROL CENTER 3.0: CONCURRENCY, AUDIT & IMPACT
// ============================================================================

test("Tool Control Center 3.0: Service architecture includes Concurrency Conflict, Audit Logging, and Rollback", () => {
  const serviceTs = fs.readFileSync(
    path.join(ROOT_DIR, "src/lib/tools/tool-access-service.ts"),
    "utf8"
  );
  const routeTs = fs.readFileSync(
    path.join(ROOT_DIR, "src/app/api/admin/tools/configure/route.ts"),
    "utf8"
  );
  const adminToolsPage = fs.readFileSync(
    path.join(ROOT_DIR, "src/app/admin/tools/page.tsx"),
    "utf8"
  );

  // 1. Optimistic Concurrency Checking
  assert.ok(
    serviceTs.includes("CONCURRENCY_CONFLICT") || serviceTs.includes("ConcurrencyConflict"),
    "ToolAccessService must implement optimistic concurrency check"
  );
  assert.ok(
    routeTs.includes("CONCURRENCY_CONFLICT") && routeTs.includes("status: isConflict ? 409 : 500"),
    "API configure route must return 409 status on concurrency conflict"
  );

  // 2. Audit Logging & Rollback
  assert.ok(
    serviceTs.includes("getAuditHistory"),
    "ToolAccessService must implement getAuditHistory"
  );
  assert.ok(
    serviceTs.includes("rollbackToolConfig"),
    "ToolAccessService must implement rollbackToolConfig"
  );
  assert.ok(
    adminToolsPage.includes("handleRollback"),
    "Admin tools page must provide 1-click rollback action"
  );

  // 3. Conflict Detection & Impact Summary
  assert.ok(
    serviceTs.includes("detectConfigConflicts"),
    "ToolAccessService must implement detectConfigConflicts"
  );
  assert.ok(
    serviceTs.includes("calculateImpactSummary"),
    "ToolAccessService must implement calculateImpactSummary"
  );

  // 4. Quick Filter Cards & High-Contrast Visual Switches
  assert.ok(
    adminToolsPage.includes("Guest Allowed") && adminToolsPage.includes("Account Required"),
    "Admin tools page must render high-contrast Guest Allowed vs Account Required indicators"
  );
  assert.ok(
    adminToolsPage.includes("quickFilter"),
    "Admin tools page must support quick status filtering"
  );
});

// ============================================================================
// 3. USER FEEDBACK & SENTIMENT CENTER 3.0
// ============================================================================

test("Feedback & Sentiment Center 3.0: Star Rating Distribution and Sentiment Tagging", () => {
  const feedbackPageContent = fs.readFileSync(
    path.join(ROOT_DIR, "src/app/admin/feedback/page.tsx"),
    "utf8"
  );

  // Must include Star Rating Distribution
  assert.ok(
    feedbackPageContent.includes("1-to-5 Star Distribution"),
    "Must render 1-to-5 Star Distribution breakdown"
  );

  // Must include Automated Sentiment classification
  assert.ok(
    feedbackPageContent.includes("getSentiment") || feedbackPageContent.includes("renderSentimentBadge"),
    "Must implement sentiment classification logic"
  );
  assert.ok(
    feedbackPageContent.includes("Positive") && feedbackPageContent.includes("Attention Needed"),
    "Must expose high-contrast sentiment badges"
  );

  // Must link to tool control center
  assert.ok(
    feedbackPageContent.includes("/admin/tools"),
    "Must link feedback items to tool control center"
  );
});

// ============================================================================
// 4. COVER LETTER BUILDER 2.0: TEMPLATE CONFIDENCE & SAFETY
// ============================================================================

test("Cover Letter Builder 2.0: Realistic Demonstration Sample Data & Pre-Export Safety", () => {
  // 1. Sample data completeness
  assert.equal(SAMPLE_COVER_LETTER_DATA.fullName, "Alex Johnson");
  assert.equal(SAMPLE_COVER_LETTER_DATA.companyName, "Acme Cloud Technologies");
  assert.ok(SAMPLE_COVER_LETTER_DATA.opening.length > 50, "Opening paragraph must be rich and realistic");
  assert.ok(SAMPLE_COVER_LETTER_DATA.bodyParagraph1.length > 50, "Body paragraph 1 must be detailed");

  // 2. Sample data detection
  const sampleCopy = createSampleCoverLetterData();
  assert.ok(isSampleCoverLetter(sampleCopy), "isSampleCoverLetter must return true for sample data");

  const customLetter = {
    fullName: "Jane Doe",
    email: "jane@mycollege.edu",
    companyName: "Infosys",
  };
  assert.equal(isSampleCoverLetter(customLetter), false, "isSampleCoverLetter must return false for custom data");

  // 3. Page component integration
  const coverLetterPage = fs.readFileSync(
    path.join(ROOT_DIR, "src/app/student/cover-letter/page.tsx"),
    "utf8"
  );

  assert.ok(
    coverLetterPage.includes("You are previewing completed demonstration sample data"),
    "Must show sample demonstration banner"
  );
  assert.ok(
    coverLetterPage.includes("Build with this template"),
    "Must provide 'Build with this template' action"
  );
  assert.ok(
    coverLetterPage.includes("Sample Data Detected"),
    "Must include pre-export sample safety warning modal"
  );
});

// ============================================================================
// 5. SAAS LANDING PAGE REDESIGN 4.0
// ============================================================================

test("SaaS Landing Page 4.0: Product-first Hero, Instant Tool Discovery, and Honest Privacy", () => {
  const heroContent = fs.readFileSync(
    path.join(ROOT_DIR, "src/components/home/HeroSection.tsx"),
    "utf8"
  );
  const homeContent = fs.readFileSync(
    path.join(ROOT_DIR, "src/app/page.tsx"),
    "utf8"
  );

  // Hero layout invariants
  assert.ok(heroContent.includes("PRIVATE BY DESIGN • FAST BY DESIGN"));
  assert.ok(heroContent.includes("Your everyday tools."));
  assert.ok(heroContent.includes("One simple workspace."));
  assert.ok(heroContent.includes("Explore Tools"));
  assert.ok(heroContent.includes("Local processing"));
  assert.ok(heroContent.includes("Automatic download"));

  // Hero workspace preview
  assert.ok(
    heroContent.includes("Saarvi Interactive Workspace") || heroContent.includes("Workspace"),
    "Hero must feature live workspace preview"
  );

  // Home page: "Start with a tool" instant discovery section directly under hero
  assert.ok(
    homeContent.includes("Start with a tool"),
    "Landing page must feature immediate 'Start with a tool' section"
  );
  assert.ok(
    homeContent.includes("PDF to JPG") && homeContent.includes("VTU SGPA"),
    "Start with a tool must feature key canonical tools"
  );

  // Zero fake social proof
  assert.doesNotMatch(
    homeContent,
    /10,000\+ Happy Students|Over 1,000,000 conversions|4\.9\/5 from 5,000 reviews/i,
    "Home page must contain zero fabricated user counters or fake reviews"
  );
});
