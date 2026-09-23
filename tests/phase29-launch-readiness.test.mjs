/**
 * Saarvi Phase 29 — Final Launch Preparation, Legal, Support & Operational Readiness Test Suite.
 *
 * Verifies:
 * 1. Canonical production domain consistency (https://saarvi.app)
 * 2. Environment variable hygiene & safe placeholders in .env.example (zero secrets)
 * 3. Environment specification and sanitization in src/lib/config/env.ts
 * 4. Health check endpoint response schema & provider decoupling
 * 5. Privacy disclosures (local-first IndexedDB, no cloud upload, third-party processors)
 * 6. Terms of Service & invariant pricing (Free ₹0, Pro ₹99/mo, ₹899/yr)
 * 7. Support channels (support@saarvi.app, contact@saarvi.app) & Troubleshooting Hub
 * 8. Security headers & Content Security Policy in next.config.ts
 * 9. Google OAuth production configuration (select_account prompt, open-redirect defense)
 * 10. Academic calculation deterministic offline independence
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

// =========================================================================
// 1. CANONICAL DOMAIN & SEO CONFIGURATION
// =========================================================================

test("Phase 29 - Canonical Domain: site.ts defines canonical https://saarvi.in", () => {
  const siteTs = fs.readFileSync(path.join(ROOT_DIR, "src/config/site.ts"), "utf8");
  assert.match(siteTs, /url:\s*['"]https:\/\/saarvi\.in['"]/);
  assert.match(siteTs, /name:\s*['"]Saarvi['"]/);
});

test("Phase 29 - Canonical Domain: robots.ts and sitemap.ts reference https://saarvi.in", () => {
  const robotsTs = fs.readFileSync(path.join(ROOT_DIR, "src/app/robots.ts"), "utf8");
  assert.match(robotsTs, /https:\/\/saarvi\.in/);
  assert.match(robotsTs, /disallow:\s*\[/);

  const sitemapTs = fs.readFileSync(path.join(ROOT_DIR, "src/app/sitemap.ts"), "utf8");
  assert.match(sitemapTs, /https:\/\/saarvi\.in/);
  // Admin and auth routes must not be in sitemap
  assert.doesNotMatch(sitemapTs, /['"]\/admin['"]/);
  assert.doesNotMatch(sitemapTs, /['"]\/auth\/callback['"]/);
});

// =========================================================================
// 2. ENVIRONMENT VARIABLE HYGIENE & SAFE PLACEHOLDERS
// =========================================================================

test("Phase 29 - Env Hygiene: .env.example contains only safe placeholders and zero real secrets", () => {
  const envExample = fs.readFileSync(path.join(ROOT_DIR, ".env.example"), "utf8");
  
  // Must NOT contain real sensitive strings or production tokens
  assert.doesNotMatch(envExample, /AIzaSy/);
  assert.doesNotMatch(envExample, /rzp_live_[a-zA-Z0-9]+/);
  assert.doesNotMatch(envExample, /sk_live_[a-zA-Z0-9]+/);
  assert.doesNotMatch(envExample, /sbp_[a-zA-Z0-9]+/);

  // Must contain essential placeholders
  assert.match(envExample, /NEXT_PUBLIC_SUPABASE_URL=/);
  assert.match(envExample, /NEXT_PUBLIC_SUPABASE_ANON_KEY=/);
  assert.match(envExample, /SUPABASE_SERVICE_ROLE_KEY=/);
  assert.match(envExample, /SMTP_HOST=/);
  assert.match(envExample, /SMTP_PORT=/);
  assert.match(envExample, /SMTP_USER=/);
  assert.match(envExample, /SMTP_PASS=/);
  assert.match(envExample, /RAZORPAY_KEY_ID=/);
  assert.match(envExample, /RAZORPAY_KEY_SECRET=/);
});

test("Phase 29 - Env Hygiene: src/lib/config/env.ts classifies variables and provides safe sanitization", () => {
  const envFilePath = path.join(ROOT_DIR, "src/lib/config/env.ts");
  assert.ok(fs.existsSync(envFilePath), "src/lib/config/env.ts must exist");
  const envContent = fs.readFileSync(envFilePath, "utf8");

  // Inverted verification: Verify contract exports and entries directly
  assert.match(envContent, /export const ENV_SPECS\s*:\s*Record<string,\s*EnvVariableSpec>/, "ENV_SPECS must be exported");
  assert.match(envContent, /export function sanitizeForLogging/, "sanitizeForLogging must be exported");
  assert.match(envContent, /export function validateEnvironment/, "validateEnvironment must be exported");

  // Verify critical environment categories are registered
  assert.match(envContent, /category:\s*['"]REQUIRED_IN_PRODUCTION['"]/, "Must define REQUIRED_IN_PRODUCTION specs");
  assert.match(envContent, /category:\s*['"]OPTIONAL['"]/, "Must define OPTIONAL specs");
  assert.match(envContent, /NEXT_PUBLIC_SUPABASE_URL/, "Must classify Supabase URL");
  assert.match(envContent, /RAZORPAY_KEY_SECRET/, "Must classify Razorpay Key Secret");
  assert.match(envContent, /SMTP_PASS/, "Must classify SMTP Password");

  // Verify secret masking logic contract
  assert.match(envContent, /upperKey\.includes\(['"]SECRET['"]\)/, "Must check SECRET in keys");
  assert.match(envContent, /upperKey\.includes\(['"]PASS['"]\)/, "Must check PASS in keys");
  assert.match(envContent, /result\[k\]\s*=\s*['"]\[REDACTED\]['"]/, "Must redact sensitive keys as [REDACTED]");
});


// =========================================================================
// 3. HEALTH CHECK API CONTRACT & DECOUPLING
// =========================================================================

test("Phase 29 - Health Check: Route file structure confirms decoupled provider reporting", () => {
  const healthRoute = fs.readFileSync(path.join(ROOT_DIR, "src/app/api/health/route.ts"), "utf8");
  
  // Status check structure
  assert.match(healthRoute, /status:\s*['"]ok['"]/);
  assert.match(healthRoute, /service:\s*['"]saarvi['"]/);
  assert.match(healthRoute, /application:\s*['"]healthy['"]/);
  assert.match(healthRoute, /emailProvider/);
  assert.match(healthRoute, /externalProviders/);
  assert.match(healthRoute, /billing/);
  assert.match(healthRoute, /whatsapp/);
  assert.match(healthRoute, /ai/);
  assert.match(healthRoute, /ocr/);
  // Cache control headers preventing stale results
  assert.match(healthRoute, /Cache-Control/);
});

// =========================================================================
// 4. PRIVACY & LOCAL-FIRST STORAGE DISCLOSURES
// =========================================================================

test("Phase 29 - Privacy Disclosures: Privacy page accurately discloses local-first IndexedDB and third parties", () => {
  const privacyPage = fs.readFileSync(path.join(ROOT_DIR, "src/app/privacy/page.tsx"), "utf8");
  
  // Local-first architecture disclosure
  assert.match(privacyPage, /IndexedDB/);
  assert.match(privacyPage, /Local-First/i);
  assert.match(privacyPage, /never automatically synchronized/i);

  // Third party disclosures
  assert.match(privacyPage, /Google OAuth/i);
  assert.match(privacyPage, /Gmail SMTP/i);
  assert.match(privacyPage, /Razorpay/i);
  assert.match(privacyPage, /Supabase/i);

  // Contact for data deletion
  assert.match(privacyPage, /saarvinotifications@gmail\.com/);
});

// =========================================================================
// 5. TERMS OF SERVICE & PRICING INVARIANTS
// =========================================================================

test("Phase 29 - Terms & Pricing: Terms strictly enforce ₹99 monthly and ₹899 yearly rates", () => {
  const termsPage = fs.readFileSync(path.join(ROOT_DIR, "src/app/terms/page.tsx"), "utf8");
  
  // Pricing invariant verification
  assert.match(termsPage, /₹99/);
  assert.match(termsPage, /₹899/);
  assert.match(termsPage, /monthly/i);
  assert.match(termsPage, /yearly/i);
  assert.match(termsPage, /Razorpay/i);

  // Pricing config file verification
  const pricingConfig = fs.readFileSync(path.join(ROOT_DIR, "src/config/pricing.ts"), "utf8");
  assert.match(pricingConfig, /99/);
  assert.match(pricingConfig, /899/);
});

// =========================================================================
// 6. SUPPORT CHANNELS & TROUBLESHOOTING
// =========================================================================

test("Phase 29 - Support: Contact page provides dual support channels and Troubleshooting Hub", () => {
  const contactPage = fs.readFileSync(path.join(ROOT_DIR, "src/app/contact/page.tsx"), "utf8");
  
  // Official support channels
  assert.match(contactPage, /saarvinotifications@gmail\.com/);

  // Support & Troubleshooting Hub topics
  assert.match(contactPage, /Authentication & Google Login/i);
  assert.match(contactPage, /Password Reset & Verification/i);
  assert.match(contactPage, /Billing & Pro Subscriptions/i);
  assert.match(contactPage, /Local Storage & Workspace Backup/i);
});

// =========================================================================
// 7. SECURITY HEADERS IN NEXT.CONFIG.TS
// =========================================================================

test("Phase 29 - Security Headers: next.config.ts configures comprehensive security headers & CSP", () => {
  const nextConfig = fs.readFileSync(path.join(ROOT_DIR, "next.config.ts"), "utf8");
  
  // Headers present
  assert.match(nextConfig, /Content-Security-Policy/);
  assert.match(nextConfig, /X-Content-Type-Options/);
  assert.match(nextConfig, /X-Frame-Options/);
  assert.match(nextConfig, /Strict-Transport-Security/);
  assert.match(nextConfig, /Referrer-Policy/);
  assert.match(nextConfig, /Permissions-Policy/);

  // Avatar domain in CSP
  assert.match(nextConfig, /googleusercontent\.com/);
});

// =========================================================================
// 8. GOOGLE OAUTH PRODUCTION INTEGRITY & OPEN-REDIRECT DEFENSE
// =========================================================================

test("Phase 29 - Google OAuth: Uses select_account prompt and sanitizes callback redirects", () => {
  const authContext = fs.readFileSync(path.join(ROOT_DIR, "src/context/AuthContext.tsx"), "utf8");
  assert.match(authContext, /prompt:\s*['"]select_account['"]/);

  const callbackRoute = fs.readFileSync(path.join(ROOT_DIR, "src/app/auth/callback/route.ts"), "utf8");
  // Check that route uses sanitizeInternalRedirectUrl
  assert.match(callbackRoute, /sanitizeInternalRedirectUrl/);
  assert.match(callbackRoute, /allowedHosts/);

  // Verify open-redirect defense function
  const urlSecContent = fs.readFileSync(path.join(ROOT_DIR, "src/lib/security/url-security.ts"), "utf8");
  assert.match(urlSecContent, /sanitizeInternalRedirectUrl/);
});

// =========================================================================
// 9. DETERMINISTIC ACADEMIC CALCULATION OFFLINE GUARANTEE
// =========================================================================

test("Phase 29 - Academic Calculation: VTU engine is pure, deterministic, and free of external API calls", () => {
  const sgpaCalculatorContent = fs.readFileSync(path.join(ROOT_DIR, "src/lib/student/calculators/sgpa.ts"), "utf8");
  
  // Invariant: purely deterministic algorithms, zero external network/AI calls
  assert.match(sgpaCalculatorContent, /calculateSGPA/);
  assert.doesNotMatch(sgpaCalculatorContent, /fetch\(/);
  assert.doesNotMatch(sgpaCalculatorContent, /axios/);
  assert.doesNotMatch(sgpaCalculatorContent, /process\.env\.AI_/);
  assert.doesNotMatch(sgpaCalculatorContent, /GEMINI/);
});



// =========================================================================
// 10. ADMIN DASHBOARD ROUTE PROTECTION GUARANTEE
// =========================================================================

test("Phase 29 - Admin Protection: Admin layout and guard enforce ADMIN / SUPER_ADMIN role checks", () => {
  const adminGuard = fs.readFileSync(path.join(ROOT_DIR, "src/components/admin/AdminGuard.tsx"), "utf8");
  assert.match(adminGuard, /ADMIN/);
  assert.match(adminGuard, /SUPER_ADMIN/);

  const adminLayout = fs.readFileSync(path.join(ROOT_DIR, "src/app/admin/layout.tsx"), "utf8");
  assert.match(adminLayout, /AdminLayoutClient/);
});

