import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

test("1. Official Saarvi Brand Assets Canonicalization", () => {
  const brandFiles = [
    "public/branding/saarvi-logo.png",
    "public/branding/saarvi-logo.webp",
    "public/brand/saarvi-logo.png",
    "public/brand/saarvi-official-logo.png",
    "public/brand/saarvi-mark.png",
    "public/brand/saarvi-logo.webp",
    "public/brand/saarvi-mark.webp",
    "public/favicon.ico",
    "src/app/favicon.ico",
  ];

  for (const relPath of brandFiles) {
    const fullPath = path.join(ROOT, relPath);
    assert.ok(fs.existsSync(fullPath), `Brand asset must exist: ${relPath}`);
    const stats = fs.statSync(fullPath);
    assert.ok(stats.size > 500, `Brand asset ${relPath} must have substantial file size (>500B), got ${stats.size}`);
  }

  // Favicon binary multi-res check (> 10KB)
  const pubFaviconStats = fs.statSync(path.join(ROOT, "public/favicon.ico"));
  assert.ok(pubFaviconStats.size > 10000, `Favicon must be multi-res ICO > 10KB, got ${pubFaviconStats.size}`);
});

test("2. Canonical SaarviLogo Component Invariants", () => {
  const logoCode = fs.readFileSync(path.join(ROOT, "src/components/brand/SaarviLogo.tsx"), "utf8");

  // Official logo image reference
  assert.ok(
    logoCode.includes("/brand/saarvi-official-logo.png") || logoCode.includes("/brand/saarvi-logo.png"),
    "SaarviLogo must reference the official brand asset"
  );

  // Preserved exports
  assert.ok(logoCode.includes("export function SaarviNavbarLogo"), "Must export SaarviNavbarLogo");
  assert.ok(logoCode.includes("export function SaarviMark"), "Must export SaarviMark");
  assert.ok(logoCode.includes("EngineeredSingleSMark"), "Must export EngineeredSingleSMark");
  assert.ok(logoCode.includes("export default function SaarviLogo"), "Must export default SaarviLogo");

  // Tagline and brand name
  assert.ok(logoCode.includes("Saarvi"), "Must render brand name Saarvi");
  assert.ok(logoCode.includes("Study. Work. Grow."), "Must render brand tagline");
});

test("3. Email Notification Template Brand Integration", () => {
  const emailTemplate = fs.readFileSync(path.join(ROOT, "src/lib/notifications/email-template.ts"), "utf8");

  assert.ok(
    emailTemplate.includes("/brand/saarvi-logo.png") || emailTemplate.includes("/brand/saarvi-mark.png"),
    "Email template must reference the canonical brand mark in header"
  );
  assert.ok(emailTemplate.includes("Study. Work. Grow."), "Email template must preserve tagline");
});

test("4. Mobile UX Architecture: Top Header & Two-Layer Navigation", () => {
  const navbarCode = fs.readFileSync(path.join(ROOT, "src/components/layout/Navbar.tsx"), "utf8");
  const bottomNavCode = fs.readFileSync(path.join(ROOT, "src/components/layout/MobileBottomNav.tsx"), "utf8");
  const profileSheetCode = fs.readFileSync(path.join(ROOT, "src/components/layout/MobileProfileSheet.tsx"), "utf8");
  const moreSheetCode = fs.readFileSync(path.join(ROOT, "src/components/layout/MobileMoreSheet.tsx"), "utf8");

  // Navbar top header mobile profile trigger and quick search
  assert.ok(navbarCode.includes("mobileProfileSheetOpen"), "Navbar must manage mobile profile sheet state");
  assert.ok(navbarCode.includes("aria-label=\"User account and profile menu\"") || navbarCode.includes("aria-label=\"Account and Profile\""), "Navbar mobile header must have accessible profile trigger");

  // Bottom Nav: 5 items, no Profile, integrates More Sheet
  assert.ok(bottomNavCode.includes("MobileMoreSheet"), "MobileBottomNav must integrate MobileMoreSheet");
  assert.ok(!bottomNavCode.includes("href: \"/profile\"") && !bottomNavCode.includes("label: \"Profile\""), "MobileBottomNav must NOT include Profile as a bottom tab");
  assert.ok(bottomNavCode.includes(">More</span>") || bottomNavCode.includes("aria-label=\"More navigation\""), "MobileBottomNav must include 'More' item");

  // MobileProfileSheet contents
  assert.ok(profileSheetCode.includes("theme") || profileSheetCode.includes("setTheme"), "MobileProfileSheet must provide theme/appearance switcher");
  assert.ok(profileSheetCode.includes("signOut") || profileSheetCode.includes("Log Out"), "MobileProfileSheet must provide logout trigger");
  assert.ok(profileSheetCode.includes("safe-area-inset-bottom"), "MobileProfileSheet must support safe-area insets");

  // MobileMoreSheet contents
  assert.ok(moreSheetCode.includes("Explore") || moreSheetCode.includes("NavigationRegistry"), "MobileMoreSheet must provide structured navigation groups");
});

test("5. Career Experience: Hero Recomposition & Opportunity Shortcut Cards", () => {
  const jobsCode = fs.readFileSync(path.join(ROOT, "src/app/jobs/page.tsx"), "utf8");

  // Eyebrow and Headline
  assert.ok(jobsCode.includes("CAREER &amp; INTERNSHIPS") || jobsCode.includes("CAREER & INTERNSHIPS"), "Hero must include CAREER & INTERNSHIPS eyebrow");
  assert.ok(jobsCode.includes("Find opportunities that fit you"), "Hero must include 'Find opportunities that fit you' headline");
  assert.ok(jobsCode.includes("Choose what you&apos;re looking for and Saarvi will find relevant opportunities") || jobsCode.includes("Choose what you're looking for and Saarvi will find relevant opportunities"), "Hero must include guided supporting description");

  // Search wrapper with rotating conic border
  assert.ok(jobsCode.includes("saarvi-search-wrapper"), "Search panel must be wrapped in saarvi-search-wrapper");
  assert.ok(jobsCode.includes("saarvi-search-inner"), "Search panel must include saarvi-search-inner");

  // 4 Contextual Opportunity Shortcut Cards
  assert.ok(jobsCode.includes("ACTIONABLE CONTEXTUAL OPPORTUNITY SHORTCUT CARDS"), "Must render 4 actionable opportunity shortcut cards");
  assert.ok(jobsCode.includes("Internships") && jobsCode.includes("Summer &amp; semester roles"), "Card 1 must target Internships");
  assert.ok(jobsCode.includes("Full-Time Jobs") && jobsCode.includes("Entry-level &amp; fresher roles"), "Card 2 must target Full-Time Jobs");
  assert.ok(jobsCode.includes("Remote Roles") && jobsCode.includes("Work from home / anywhere"), "Card 3 must target Remote Roles");
  assert.ok(jobsCode.includes("Verified Listings") && jobsCode.includes("Saarvi verified criteria"), "Card 4 must target Verified Listings");

  // VerifiedOnly state handling
  assert.ok(jobsCode.includes("verifiedOnly"), "Jobs page must maintain verifiedOnly state");
  assert.ok(jobsCode.includes("displayedJobs"), "Jobs page must compute displayedJobs with verified filtering");
});

test("6. Floating Saarvi AI Assistant & Conic-Gradient Ring", () => {
  const aiCode = fs.readFileSync(path.join(ROOT, "src/components/ai/GlobalAIAssistant.tsx"), "utf8");
  const cssCode = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");

  // Conic-gradient ring wrapper on trigger button
  assert.ok(aiCode.includes("saarvi-ai-ring-wrapper"), "GlobalAIAssistant trigger button must use saarvi-ai-ring-wrapper");
  assert.ok(aiCode.includes("aria-label=\"Open Saarvi AI\""), "Trigger button must maintain aria-label");
  assert.ok(aiCode.includes("min-h-[48px] min-w-[48px]"), "Trigger button must satisfy 48x48 touch target");

  // CSS Animation rules and reduced-motion fallback
  assert.ok(cssCode.includes(".saarvi-ai-ring-wrapper"), "globals.css must define .saarvi-ai-ring-wrapper");
  assert.ok(cssCode.includes("saarvi-search-border"), "globals.css must define keyframes saarvi-search-border");
  assert.ok(cssCode.includes("@media (prefers-reduced-motion: reduce)"), "globals.css must respect prefers-reduced-motion");

  // Elevation positioning above bottom navigation
  assert.ok(
    aiCode.includes("bottom-[calc(env(safe-area-inset-bottom,0px)+68px)]"),
    "Floating AI must be positioned above mobile bottom nav"
  );
});

test("7. Strict Dark Mode & Design System Hygiene", () => {
  // Check that no user-facing pages or components use forbidden heavy black backgrounds
  const targets = [
    "src/app/jobs/page.tsx",
    "src/components/layout/Navbar.tsx",
    "src/components/layout/MobileBottomNav.tsx",
    "src/components/layout/MobileProfileSheet.tsx",
    "src/components/layout/MobileMoreSheet.tsx",
    "src/components/ai/GlobalAIAssistant.tsx",
    "src/components/brand/SaarviLogo.tsx",
  ];

  for (const relPath of targets) {
    const code = fs.readFileSync(path.join(ROOT, relPath), "utf8");
    assert.ok(!code.includes("bg-slate-950"), `${relPath} must not contain forbidden bg-slate-950`);
    assert.ok(!code.includes("bg-gray-950"), `${relPath} must not contain forbidden bg-gray-950`);
  }
});
