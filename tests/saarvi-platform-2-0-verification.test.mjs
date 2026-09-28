import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  SAMPLE_RESUME_PROFILE,
  isSampleProfile,
  createSampleProfile,
  createEmptyUserProfile,
  RESUME_PLACEHOLDERS,
} from "../src/lib/services/resumeSampleData.ts";
import {
  extractSkillsFromText,
  inferRemoteType,
  inferEmploymentType,
  inferExperienceLevel,
  normalizeSerpApiJob,
} from "../src/lib/jobs/normalize.ts";

const ROOT_DIR = process.cwd();

test("Saarvi 2.0: Official Navbar Logo Integrity", () => {
  const officialLogoPath = path.join(ROOT_DIR, "public/brand/saarvi-official-logo.png");
  assert.ok(fs.existsSync(officialLogoPath), "Official logo asset must exist in public/brand/");
  const stat = fs.statSync(officialLogoPath);
  assert.ok(stat.size > 5000, "Official logo asset must be non-empty");

  const logoTsx = fs.readFileSync(path.join(ROOT_DIR, "src/components/brand/SaarviLogo.tsx"), "utf-8");
  assert.ok(logoTsx.includes("SaarviNavbarLogo"), "SaarviLogo.tsx must export SaarviNavbarLogo");
  assert.ok(logoTsx.includes("/brand/saarvi-official-logo.png"), "SaarviNavbarLogo must reference official logo asset");

  const navbarTsx = fs.readFileSync(path.join(ROOT_DIR, "src/components/layout/Navbar.tsx"), "utf-8");
  assert.ok(navbarTsx.includes("<SaarviNavbarLogo"), "Navbar.tsx must render SaarviNavbarLogo");
  assert.ok(!navbarTsx.includes('span className="font-black text-xl tracking-tight text-slate-900"'), "Navbar must not duplicate text wordmark beside official logo");
});

test("Saarvi 2.0: MegaMenu Pointer Containment & Dismissal", () => {
  const megaMenuTsx = fs.readFileSync(path.join(ROOT_DIR, "src/components/layout/MegaMenu.tsx"), "utf-8");
  assert.ok(megaMenuTsx.includes("pointer-events-none"), "MegaMenu outer wrapper must be pointer-events-none");
  assert.ok(megaMenuTsx.includes("pointer-events-auto"), "MegaMenu card surface must be pointer-events-auto");

  const navbarTsx = fs.readFileSync(path.join(ROOT_DIR, "src/components/layout/Navbar.tsx"), "utf-8");
  assert.ok(navbarTsx.includes("headerRef"), "Navbar must attach headerRef for outside click detection");
  assert.ok(navbarTsx.includes("Escape"), "Navbar must dismiss dropdown on Escape key");
});

test("Saarvi 2.0: Resume Builder 2.0 Sample Data & Decoupling", () => {
  assert.strictEqual(SAMPLE_RESUME_PROFILE.fullName, "Alex Johnson", "Sample profile must be Alex Johnson");
  assert.strictEqual(SAMPLE_RESUME_PROFILE.education[0].gpa, "8.7");
  assert.strictEqual(isSampleProfile(SAMPLE_RESUME_PROFILE), true);

  const emptyUser = createEmptyUserProfile("test_user");
  assert.strictEqual(isSampleProfile(emptyUser), false);
  assert.strictEqual(emptyUser.fullName, "");

  const studentResumeTsx = fs.readFileSync(path.join(ROOT_DIR, "src/app/student/resume/page.tsx"), "utf-8");
  assert.ok(studentResumeTsx.includes("You're viewing sample information"), "Must render sample notification banner");
  assert.ok(studentResumeTsx.includes("Replace with My Information"), "Must offer Replace with My Information action");
  assert.ok(studentResumeTsx.includes("createSampleProfile"), "Must initialize with sample profile when empty");

  const previewTsx = fs.readFileSync(path.join(ROOT_DIR, "src/components/career/ResumeLivePreview.tsx"), "utf-8");
  assert.ok(previewTsx.includes("linkedinUrl"), "Must support linkedinUrl property");
  assert.ok(previewTsx.includes("Sample Preview"), "Must render Sample Preview badge when isSample is true");
});

test("Saarvi 2.0: Admin Template Clean-Room Recreation Metadata", () => {
  const adminTemplatesTsx = fs.readFileSync(path.join(ROOT_DIR, "src/app/admin/career/templates/page.tsx"), "utf-8");
  assert.ok(adminTemplatesTsx.includes("Create from Reference") || adminTemplatesTsx.includes("openCreateFromReferenceModal"), "Admin templates must offer Create from Reference");
  assert.ok(adminTemplatesTsx.includes("REFERENCE_RECREATION"), "Must support REFERENCE_RECREATION source type");
  assert.ok(adminTemplatesTsx.includes("licenseNote"), "Must capture license notes");

  const careerTypes = fs.readFileSync(path.join(ROOT_DIR, "src/types/career.ts"), "utf-8");
  assert.ok(careerTypes.includes("sourceType?: \"ORIGINAL\" | \"REFERENCE_RECREATION\""), "Career types must type sourceType");
});

test("Saarvi 2.0: Jobs & Internships Honesty & Anti-Hallucination", () => {
  // Anti-hallucination skill extraction: only skills present in text are returned
  const skills = extractSkillsFromText("Looking for a developer with React, TypeScript, and SQL experience.");
  assert.ok(skills.includes("React"));
  assert.ok(skills.includes("TypeScript"));
  assert.ok(skills.includes("SQL"));
  assert.ok(!skills.includes("Python"), "Must not invent skills not mentioned in text");
  assert.ok(!skills.includes("Go"), "Must not invent skills not mentioned in text");

  // Salary & deadline honesty in normalization
  const normalized = normalizeSerpApiJob({
    title: "Frontend Engineer",
    company_name: "Acme Corp",
    location: "Bengaluru, India",
    description: "Build web apps using React.",
    // No salary or deadline provided in raw payload
  });

  assert.ok(normalized);
  assert.strictEqual(normalized.salary, "Salary not disclosed", "Must not guess or invent salary");
  assert.strictEqual(normalized.applicationDeadline, "Deadline not provided", "Must not invent application deadline");

  // Authenticated search requirement
  const searchRouteTsx = fs.readFileSync(path.join(ROOT_DIR, "src/app/api/jobs/search/route.ts"), "utf-8");
  assert.ok(searchRouteTsx.includes("getAuthenticatedUser"), "Job search endpoint must enforce user authentication");
  assert.ok(searchRouteTsx.includes("status: 401"), "Must return 401 when unauthenticated");
});

test("Saarvi 2.0: Landing Page 3.0 Platform Showcase", () => {
  const showcasePath = path.join(ROOT_DIR, "src/components/home/PlatformInteractiveShowcase.tsx");
  assert.ok(fs.existsSync(showcasePath), "PlatformInteractiveShowcase.tsx must exist");

  const showcaseContent = fs.readFileSync(showcasePath, "utf-8");
  assert.ok(showcaseContent.includes("Study. Work. Grow. In Action."), "Showcase must feature Study Work Grow headline");
  assert.ok(showcaseContent.includes("Deterministic SGPA"), "Study tab must present SGPA intelligence");
  assert.ok(showcaseContent.includes("Client-Side WebAssembly"), "Work tab must showcase client-side privacy architecture");
  assert.ok(showcaseContent.includes("Alex Johnson"), "Grow tab must showcase Alex Johnson demo");

  const homePageTsx = fs.readFileSync(path.join(ROOT_DIR, "src/app/page.tsx"), "utf-8");
  assert.ok(homePageTsx.includes("<PlatformInteractiveShowcase />"), "HomePage must render PlatformInteractiveShowcase");
});
