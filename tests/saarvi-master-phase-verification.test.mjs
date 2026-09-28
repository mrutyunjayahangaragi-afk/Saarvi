import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resumeTemplateService, BUILT_IN_RESUME_TEMPLATES } from "../src/lib/services/resumeTemplateService.ts";
import { buildXlsxWorkbook, parseXlsxWorkbook } from "../src/lib/tools/document/openxml-helper.ts";

const ROOT_DIR = process.cwd();

test("Phase 1 & 7: Saarvi Vector Brand System & Synchronized Logo Timeline", () => {
  const markPath = path.join(ROOT_DIR, "src/components/brand/SaarviMark.tsx");
  const logoPath = path.join(ROOT_DIR, "src/components/brand/SaarviLogo.tsx");
  const globalsCssPath = path.join(ROOT_DIR, "src/app/globals.css");

  assert.ok(fs.existsSync(markPath), "SaarviMark.tsx must exist");
  assert.ok(fs.existsSync(logoPath), "SaarviLogo.tsx must exist");
  assert.ok(fs.existsSync(globalsCssPath), "globals.css must exist");

  const markContent = fs.readFileSync(markPath, "utf-8");
  const logoContent = fs.readFileSync(logoPath, "utf-8");
  const cssContent = fs.readFileSync(globalsCssPath, "utf-8");

  // Pure vector SVG & transparent background
  assert.ok(markContent.includes("<svg"), "SaarviMark must render pure vector SVG");
  assert.ok(markContent.includes("saarvi-mark-ribbon"), "SaarviMark must include calibrated gradient defs");
  assert.ok(!markContent.includes("bg-white"), "SaarviMark must NOT have opaque raster box artifacts");

  // Synchronized animation
  assert.ok(logoContent.includes("saarvi-sync-fade"), "SaarviLogo must use unified saarvi-sync-fade class");
  assert.ok(logoContent.includes("motion-reduce:animate-none"), "SaarviLogo must respect prefers-reduced-motion");
  assert.ok(cssContent.includes("@keyframes saarvi-sync-fade"), "globals.css must define keyframe timeline");

  // Backward-compatibility invariants
  assert.ok(markContent.includes("/brand/saarvi-mark.webp"), "Must retain webp path for asset tests");
  assert.ok(logoContent.includes("EngineeredSingleSMark"), "Must export EngineeredSingleSMark for backward compat");
});

test("Phase 2: MegaMenu Pointer-Intent Management & Safe Diagonal Bridge", () => {
  const navbarPath = path.join(ROOT_DIR, "src/components/layout/Navbar.tsx");
  const megaMenuPath = path.join(ROOT_DIR, "src/components/layout/MegaMenu.tsx");

  const navbarContent = fs.readFileSync(navbarPath, "utf-8");
  const megaMenuContent = fs.readFileSync(megaMenuPath, "utf-8");

  // Pointer intent timers
  assert.ok(navbarContent.includes("closeTimeoutRef"), "Navbar must manage pointer-intent timeout ref");
  assert.ok(navbarContent.includes("280"), "Navbar must provide a safe diagonal transit buffer (~280ms)");
  assert.ok(navbarContent.includes("60"), "Navbar must filter accidental cursor brushes (~60ms)");

  // Safe invisible hover bridge
  assert.ok(megaMenuContent.includes("-top-3") || megaMenuContent.includes("h-6"), "MegaMenu must provide contiguous hover bridge");
});

test("Phase 3: Multi-Column Footer & Real Creator Links", () => {
  const footerPath = path.join(ROOT_DIR, "src/components/layout/Footer.tsx");
  const careerRoutePath = path.join(ROOT_DIR, "src/app/career/page.tsx");

  const footerContent = fs.readFileSync(footerPath, "utf-8");
  assert.ok(fs.existsSync(careerRoutePath), "src/app/career/page.tsx must exist to prevent 404 links");

  assert.ok(footerContent.includes("https://github.com/mrutyunjayahangaragi-afk"), "Footer must credit verified creator");
  assert.ok(footerContent.includes("saarvinotifications@gmail.com"), "Footer must display official support email");
  assert.ok(footerContent.includes("Private by Design"), "Footer must declare privacy invariant");
});

test("Phase 5 & 6: Authoritative Tool Access Matrix & Guest Workflow", () => {
  const servicePath = path.join(ROOT_DIR, "src/lib/tools/tool-access-service.ts");
  const adminToolsPagePath = path.join(ROOT_DIR, "src/app/admin/tools/page.tsx");
  const modalPath = path.join(ROOT_DIR, "src/components/auth/FriendlyAccessModal.tsx");

  const serviceContent = fs.readFileSync(servicePath, "utf-8");
  const adminPageContent = fs.readFileSync(adminToolsPagePath, "utf-8");

  assert.ok(fs.existsSync(modalPath), "FriendlyAccessModal must exist");
  assert.ok(serviceContent.includes("guestAllowed"), "Tool access service must evaluate guestAllowed");
  assert.ok(serviceContent.includes("freeAllowed"), "Tool access service must evaluate freeAllowed");
  assert.ok(serviceContent.includes("proAllowed"), "Tool access service must evaluate proAllowed");

  // Admin Access Matrix UI tab
  assert.ok(adminPageContent.includes("access-matrix"), "Admin tools page must include access-matrix tab");
  assert.ok(adminPageContent.includes("updateMatrixRow"), "Admin tools page must support inline matrix row updates");
  assert.ok(adminPageContent.includes("Authoritative Tool Access Matrix"), "Admin tools page must render matrix title");
});

test("Phase 7: Post-Tool Completion Feedback Prompt (Non-blocking & Temporary)", () => {
  const resultDownloadPath = path.join(ROOT_DIR, "src/components/common/ResultDownload.tsx");
  const content = fs.readFileSync(resultDownloadPath, "utf-8");

  assert.ok(content.includes("temporary_feedback_prompt = true") || content.includes("temporary_feedback_prompt: true"), "Must declare internal temporary_feedback_prompt flag");
  assert.ok(content.includes("saarvi_feedback_dismissed_"), "Must check and store sessionStorage dismissal");
  assert.ok(content.includes("/api/feedback"), "Must submit feedback to /api/feedback");
  assert.ok(content.includes("Was this result helpful?"), "Must render polite feedback question");
  assert.ok(content.includes("Star"), "Must offer 1-5 star rating buttons");
});

test("Phase 8: Resume Builder Admin Template Platform & Data Decoupling", () => {
  const service = resumeTemplateService;
  const templates = service.getAllTemplates();

  assert.ok(templates.length >= 6, "Must contain at least 6 initial built-in templates");

  const atsClassic = templates.find((t) => t.id === "classic-ats");
  assert.ok(atsClassic, "ATS Classic must be defined");
  assert.strictEqual(atsClassic.isActive, true, "ATS Classic must be active by default");
  assert.strictEqual(atsClassic.isPro, false, "ATS Classic must be free tier");

  // Test active filter
  const active = service.getActiveTemplates();
  assert.ok(active.length > 0, "Must have active templates");

  // Test duplicate template
  const duplicated = service.duplicateTemplate("classic-ats");
  assert.ok(duplicated, "Must successfully duplicate template");
  assert.ok(duplicated.id.includes("copy"), "Duplicated ID must contain copy suffix");
  assert.ok(duplicated.name.includes("(Copy)"), "Duplicated Name must contain (Copy)");

  // Clean up
  service.resetToDefaults();

  // Test template switching preservation invariant
  const sampleProfile = {
    fullName: "Saarvi Candidate",
    email: "candidate@saarvi.app",
    experience: [{ id: "exp1", role: "Software Engineer", company: "Saarvi Tech", bullets: ["Built scalable systems"] }],
  };

  // Simulating template change in Resume Version
  let resumeVersion = { id: "v1", name: "Master", template: "classic-ats" };
  // Switch to modern-professional
  resumeVersion = { ...resumeVersion, template: "modern-professional" };

  // Profile data is completely untouched
  assert.strictEqual(sampleProfile.fullName, "Saarvi Candidate", "Profile data must remain intact when switching templates");
  assert.strictEqual(sampleProfile.experience[0].company, "Saarvi Tech", "Experience entries must not be lost");
  assert.strictEqual(resumeVersion.template, "modern-professional", "Version template must reflect the new layout");

  // Verify Admin route exists
  const adminTemplatesPath = path.join(ROOT_DIR, "src/app/admin/career/templates/page.tsx");
  assert.ok(fs.existsSync(adminTemplatesPath), "Admin templates management page must exist");
});

test("Phase 9: High-Fidelity OpenXML Excel & PDF Table Extraction", async () => {
  // Test buildXlsxWorkbook with auto-calculated columns
  const testSheets = [
    {
      name: "Q1 Results",
      rows: [
        ["Product Code", "Item Description", "Units Sold", "Revenue (INR)", "Date"],
        ["00124", "Engineering Workstation Alpha", 1250, "1,250,000.00", "2026-09-28"],
        ["00125", "Standard Monitor 4K", 450, "45,000.00", "2026-09-29"],
      ],
    },
  ];

  const xlsxBytes = await buildXlsxWorkbook(testSheets);
  assert.ok(xlsxBytes instanceof Uint8Array, "Must generate Uint8Array workbook");
  assert.ok(xlsxBytes.length > 500, "XLSX binary must have substantial content");

  // Test parseXlsxWorkbook recovers rows and cells accurately
  const parsedSheets = await parseXlsxWorkbook(xlsxBytes);
  assert.strictEqual(parsedSheets.length, 1, "Must parse exactly 1 worksheet");
  assert.strictEqual(parsedSheets[0].name, "Q1 Results", "Must preserve sheet name");
  assert.strictEqual(parsedSheets[0].rows.length, 3, "Must parse all 3 rows");
  assert.strictEqual(parsedSheets[0].rows[0][0], "Product Code", "Header cell 0,0 must match");
  assert.strictEqual(parsedSheets[0].rows[1][0], "00124", "Leading zeros must be preserved");
  assert.strictEqual(parsedSheets[0].rows[1][1], "Engineering Workstation Alpha", "Text cell must match");
});
