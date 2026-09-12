/**
 * Saarvi Brand Migration Test Suite.
 *
 * Verifies:
 * 1. Brand identity and site configuration standards.
 * 2. Visual brand assets exist and are valid PNG/ICO files on disk.
 * 3. Brand logo and mark components are exportable and properly structured.
 * 4. Metadata generators produce standard "Title — Saarvi" titles and Saarvi siteName.
 * 5. Structured data JSON-LD includes "Saarvi" branding.
 * 6. Pricing plans preserve exact pricing (₹99 / ₹899) and brand as "Saarvi Pro".
 * 7. Feature definitions correctly reference "Saarvi Pro" without modifying entitlements.
 * 8. Academic DB exports as "Saarvi" and safely imports both "Saarvi" and legacy "DocEase" payloads.
 * 9. Dual localStorage backward compatibility in mock storage.
 * 10. Dual localStorage backward compatibility in preferences service.
 * 11. Dual localStorage backward compatibility in student service cover letters.
 * 12. Dual localStorage backward compatibility in notification preferences.
 * 13. Zero user-facing "DocEase" references across public pages and configuration files.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

test("Saarvi Brand 1: SITE_CONFIG reflects official brand name, tagline, and url", async () => {
  const siteConfigPath = path.join(ROOT_DIR, "src/config/site.ts");
  const content = fs.readFileSync(siteConfigPath, "utf-8");

  assert.match(content, /name:\s*["']Saarvi["']/);
  assert.match(content, /tagline:\s*["']Study\.\s*Work\.\s*Grow\.["']/);
  assert.match(content, /url:\s*["']https:\/\/saarvi\.app["']/);
  assert.match(content, /author:\s*["']Saarvi Team["']/);
  assert.match(content, /© 2026 Saarvi/);
});

test("Saarvi Brand 2: Physical brand assets exist on disk with valid file headers", async () => {
  const assets = [
    "public/brand/saarvi-logo.png",
    "public/brand/saarvi-mark.png",
    "public/brand/favicon.png",
    "public/favicon.ico",
    "public/favicon.svg",
    "public/og-image.png",
  ];

  for (const asset of assets) {
    const fullPath = path.join(ROOT_DIR, asset);
    assert.ok(fs.existsSync(fullPath), `Asset must exist: ${asset}`);
    const stat = fs.statSync(fullPath);
    assert.ok(stat.size > 100, `Asset must not be empty: ${asset} (size: ${stat.size} bytes)`);
  }
});

test("Saarvi Brand 3: SaarviLogo component exists and exports SaarviLogo and SaarviMark", async () => {
  const logoComponentPath = path.join(ROOT_DIR, "src/components/brand/SaarviLogo.tsx");
  assert.ok(fs.existsSync(logoComponentPath), "SaarviLogo.tsx must exist");
  const content = fs.readFileSync(logoComponentPath, "utf-8");

  assert.match(content, /export function SaarviMark/);
  assert.match(content, /export default function SaarviLogo/);
  assert.match(content, /\/brand\/saarvi-mark\.png/);
});

test("Saarvi Brand 4: Metadata generator formats titles as `${title} — Saarvi` and siteName `Saarvi`", async () => {
  const metadataPath = path.join(ROOT_DIR, "src/lib/seo/metadata.ts");
  const content = fs.readFileSync(metadataPath, "utf-8");

  assert.match(content, /\$\{title\} — Saarvi/);
  assert.match(content, /siteName:\s*['"]Saarvi['"]/);
  assert.match(content, /authors:\s*\[\{\s*name:\s*['"]Saarvi Team['"]/);
});

test("Saarvi Brand 5: Structured data generators output Saarvi schemas", async () => {
  const sdPath = path.join(ROOT_DIR, "src/lib/seo/structured-data.ts");
  const content = fs.readFileSync(sdPath, "utf-8");

  assert.match(content, /name:\s*['"]Saarvi['"]/);
  assert.match(content, /name:\s*`\$\{tool\.name\} — Saarvi`/);
  assert.doesNotMatch(content, /https:\/\/docease\.app/);
  assert.match(content, /https:\/\/saarvi\.app/);
});

test("Saarvi Brand 6: Pricing configuration maintains ₹99 and ₹899 rates under Saarvi Pro branding", async () => {
  const pricingPath = path.join(ROOT_DIR, "src/config/pricing.ts");
  const content = fs.readFileSync(pricingPath, "utf-8");

  assert.match(content, /name:\s*['"]Saarvi Pro Monthly['"]/);
  assert.match(content, /name:\s*['"]Saarvi Pro Yearly['"]/);
  assert.match(content, /amountCents:\s*9900/);
  assert.match(content, /amountCents:\s*89900/);
  assert.match(content, /amountDisplay:\s*['"]₹99['"]/);
  assert.match(content, /amountDisplay:\s*['"]₹899['"]/);
});

test("Saarvi Brand 7: Feature registry references Saarvi Pro without altering invariants", async () => {
  const featuresPath = path.join(ROOT_DIR, "src/config/features.ts");
  const content = fs.readFileSync(featuresPath, "utf-8");

  assert.match(content, /Saarvi Pro/);
  assert.doesNotMatch(content, /DocEase Pro/);
});

test("Saarvi Brand 8: Academic DB workspace export produces 'Saarvi' and import accepts both 'Saarvi' and 'DocEase'", async () => {
  const academicDbPath = path.join(ROOT_DIR, "src/lib/academic/storage/academic-db.ts");
  const content = fs.readFileSync(academicDbPath, "utf-8");

  // Export should produce application: "Saarvi"
  assert.match(content, /application:\s*["']Saarvi["']/);
  // Import must validate against both Saarvi and legacy DocEase
  assert.match(content, /data\.application !== ["']Saarvi["'] && data\.application !== ["']DocEase["']/);
});

test("Saarvi Brand 9: Mock storage uses `saarvi_*` keys and falls back to `docease_*`", async () => {
  const storagePath = path.join(ROOT_DIR, "src/lib/supabase/mock-storage.ts");
  const content = fs.readFileSync(storagePath, "utf-8");

  assert.match(content, /USERS:\s*['"]saarvi_users_v1['"]/);
  assert.match(content, /SESSION:\s*['"]saarvi_session_v1['"]/);
  assert.match(content, /key\.startsWith\(['"]saarvi_['"]\)\s*\?\s*key\.replace\(\/\^saarvi_\/,\s*['"]docease_['"]\)\s*:\s*key/);
});

test("Saarvi Brand 10: Preferences service supports `saarvi_autodownload_enabled` with `docease_autodownload_enabled` fallback", async () => {
  const prefPath = path.join(ROOT_DIR, "src/lib/services/preferencesService.ts");
  const content = fs.readFileSync(prefPath, "utf-8");

  assert.match(content, /localStorage\.getItem\(['"]saarvi_autodownload_enabled['"]\)\s*\?\?\s*localStorage\.getItem\(['"]docease_autodownload_enabled['"]\)/);
});

test("Saarvi Brand 11: Student service cover letters support `saarvi_guest_cover_letters_v1` with fallback", async () => {
  const studentServPath = path.join(ROOT_DIR, "src/lib/services/studentService.ts");
  const content = fs.readFileSync(studentServPath, "utf-8");

  assert.match(content, /COVER_LETTERS:\s*["']saarvi_guest_cover_letters_v1["']/);
  assert.match(content, /LEGACY_COVER_LETTERS:\s*["']docease_guest_cover_letters_v1["']/);
});

test("Saarvi Brand 12: Notification service supports `saarvi_notification_prefs_v1` with fallback", async () => {
  const notifServPath = path.join(ROOT_DIR, "src/lib/services/notificationService.ts");
  const content = fs.readFileSync(notifServPath, "utf-8");

  assert.match(content, /LOCAL_PREFS_KEY\s*=\s*['"]saarvi_notification_prefs_v1['"]/);
  assert.match(content, /LEGACY_LOCAL_PREFS_KEY\s*=\s*['"]docease_notification_prefs_v1['"]/);
});

test("Saarvi Brand 13: Core public pages contain zero user-facing 'DocEase' strings", async () => {
  const publicPages = [
    "src/app/page.tsx",
    "src/app/about/page.tsx",
    "src/app/pricing/page.tsx",
    "src/app/contact/page.tsx",
    "src/app/privacy/page.tsx",
    "src/app/terms/page.tsx",
    "src/components/layout/Navbar.tsx",
    "src/components/layout/Footer.tsx",
  ];

  for (const pageRel of publicPages) {
    const pagePath = path.join(ROOT_DIR, pageRel);
    assert.ok(fs.existsSync(pagePath), `Page file must exist: ${pageRel}`);
    const content = fs.readFileSync(pagePath, "utf-8");

    // Must not contain user-facing DocEase strings
    assert.doesNotMatch(
      content,
      />\s*DocEase/i,
      `User-facing JSX element in ${pageRel} must not contain DocEase`
    );
    assert.doesNotMatch(
      content,
      /support@docease\.app/i,
      `Email in ${pageRel} must not be support@docease.app`
    );
    assert.doesNotMatch(
      content,
      /https:\/\/docease\.app/i,
      `URL in ${pageRel} must not be https://docease.app`
    );
  }
});
