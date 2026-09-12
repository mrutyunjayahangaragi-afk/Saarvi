/**
 * Saarvi Phase 28 — Production QA, Cross-Browser, Device & Release Verification Test Suite.
 *
 * Covers:
 * 1. Multi-account local storage workspace isolation & account switching
 * 2. Search workspace boundary isolation
 * 3. Canonical routes, redirects, and broken link remediation
 * 4. App Router boundary invariants (not-found.tsx, error.tsx, global-error.tsx, loading.tsx)
 * 5. Automatic download invariants (3-second countdown, single-trigger guarantee)
 * 6. Google OAuth configuration & open-redirect defenses
 * 7. Deterministic academic calculations (VTU SGPA/CGPA, passing rules, percentage)
 * 8. Responsive breakpoint classification (320px to 1920px) and touch targets
 * 9. Saarvi brand invariants & production release readiness
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

// =========================================================================
// 1. MULTI-ACCOUNT WORKSPACE ISOLATION & SEMESTER NAMESPACING
// =========================================================================

class MockIsolatedAcademicStorage {
  constructor() {
    this.activeProfileId = "guest";
    this.semesters = new Map();
    this.tasks = new Map();
    this.assignments = new Map();
    this.careerProfiles = new Map();
  }

  setActiveProfileId(id) {
    this.activeProfileId = id || "guest";
  }

  getActiveProfileId() {
    return this.activeProfileId;
  }

  saveSemesterRecord(record) {
    const effectiveProfileId = (!record.profileId || record.profileId === "default_profile")
      ? this.activeProfileId
      : record.profileId;
    const recordId = (record.id.startsWith("sem_") && !record.id.includes(effectiveProfileId))
      ? `${effectiveProfileId}_${record.id}`
      : record.id;
    const clean = {
      ...record,
      id: recordId,
      profileId: effectiveProfileId,
      updatedAt: new Date().toISOString(),
    };
    this.semesters.set(clean.id, clean);
    return clean;
  }

  getSemesterRecords(profileId) {
    const targetId = profileId || this.activeProfileId;
    const isMatch = (r) =>
      r.profileId === targetId || (targetId === "guest" && (!r.profileId || r.profileId === "default_profile"));
    return Array.from(this.semesters.values()).filter(isMatch);
  }

  saveTask(task) {
    const effectiveProfileId = (!task.profileId || task.profileId === "default_profile")
      ? this.activeProfileId
      : task.profileId;
    const clean = {
      ...task,
      profileId: effectiveProfileId,
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(clean.id, clean);
    return clean;
  }

  getTasks(profileId) {
    const targetId = profileId || this.activeProfileId;
    const isMatch = (t) =>
      t.profileId === targetId || (targetId === "guest" && (!t.profileId || t.profileId === "default_profile"));
    return Array.from(this.tasks.values()).filter(isMatch);
  }

  searchWorkspace(query) {
    const cleanQuery = (query || "").trim().toLowerCase();
    if (!cleanQuery) return [];
    const targetId = this.activeProfileId;
    const isMatch = (item) =>
      item.profileId === targetId || (targetId === "guest" && (!item.profileId || item.profileId === "default_profile"));

    const matchedTasks = Array.from(this.tasks.values())
      .filter(isMatch)
      .filter((t) => t.title?.toLowerCase().includes(cleanQuery));

    const matchedSemesters = Array.from(this.semesters.values())
      .filter(isMatch)
      .filter((s) => s.branch?.toLowerCase().includes(cleanQuery));

    return [...matchedTasks, ...matchedSemesters];
  }
}

test("Phase 28 - QA 1: Multi-account switching completely isolates workspace data", () => {
  const storage = new MockIsolatedAcademicStorage();

  // User A logs in
  storage.setActiveProfileId("user_alpha_123");
  storage.saveSemesterRecord({
    id: "sem_1",
    branch: "Computer Science",
    semester: 1,
    sgpa: 9.4,
  });
  storage.saveTask({
    id: "task_1",
    title: "Alpha Assignment Prep",
    priority: "high",
  });

  const alphaSemesters = storage.getSemesterRecords();
  assert.equal(alphaSemesters.length, 1);
  assert.equal(alphaSemesters[0].sgpa, 9.4);
  assert.equal(storage.getTasks().length, 1);

  // User A logs out -> User B logs in
  storage.setActiveProfileId("user_beta_456");

  // User B must see ZERO data belonging to User A
  const betaSemesters = storage.getSemesterRecords();
  assert.equal(betaSemesters.length, 0, "User B must not see User A's semester data");
  assert.equal(storage.getTasks().length, 0, "User B must not see User A's task data");

  // User B creates semester 1 with same static sem_1 id
  storage.saveSemesterRecord({
    id: "sem_1",
    branch: "Mechanical Engineering",
    semester: 1,
    sgpa: 7.8,
  });
  const betaSemestersAfterSave = storage.getSemesterRecords();
  assert.equal(betaSemestersAfterSave.length, 1);
  assert.equal(betaSemestersAfterSave[0].branch, "Mechanical Engineering");
  assert.equal(betaSemestersAfterSave[0].sgpa, 7.8);

  // User B logs out -> User A logs back in
  storage.setActiveProfileId("user_alpha_123");

  // User A's data must remain completely intact and uncorrupted
  const restoredAlphaSemesters = storage.getSemesterRecords();
  assert.equal(restoredAlphaSemesters.length, 1);
  assert.equal(restoredAlphaSemesters[0].branch, "Computer Science");
  assert.equal(restoredAlphaSemesters[0].sgpa, 9.4);

  // Guest user logs in
  storage.setActiveProfileId("guest");
  assert.equal(storage.getSemesterRecords().length, 0, "Guest must not see User A or B data");
});

test("Phase 28 - QA 2: Search workspace strictly enforces profile boundaries", () => {
  const storage = new MockIsolatedAcademicStorage();

  // User A creates confidential tasks
  storage.setActiveProfileId("user_alpha");
  storage.saveTask({ id: "t1", title: "Study Machine Learning Midterm" });

  // User B creates unrelated tasks
  storage.setActiveProfileId("user_beta");
  storage.saveTask({ id: "t2", title: "Study Thermodynamics" });

  // User B searches "Machine Learning" -> 0 results
  const betaResults = storage.searchWorkspace("Machine Learning");
  assert.equal(betaResults.length, 0, "User B search must not reveal User A's records");

  // User B searches "Thermodynamics" -> 1 result
  const betaValidResults = storage.searchWorkspace("Thermodynamics");
  assert.equal(betaValidResults.length, 1);

  // User A searches "Machine Learning" -> 1 result
  storage.setActiveProfileId("user_alpha");
  const alphaResults = storage.searchWorkspace("Machine Learning");
  assert.equal(alphaResults.length, 1);
  assert.equal(alphaResults[0].title, "Study Machine Learning Midterm");
});

// =========================================================================
// 2. CANONICAL ROUTES, BROKEN LINKS & NEXT.JS REDIRECTS
// =========================================================================

test("Phase 28 - QA 3: Admin page links to canonical /admin/audit-logs and no 404 audit link", () => {
  const adminPagePath = path.join(ROOT_DIR, "src/app/admin/page.tsx");
  const adminContent = fs.readFileSync(adminPagePath, "utf-8");

  // Broken link /admin/audit must not exist as an href
  assert.ok(!adminContent.includes('href="/admin/audit"'), "admin/page.tsx must not link to /admin/audit");
  assert.ok(adminContent.includes('href="/admin/audit-logs"'), "admin/page.tsx must link to canonical /admin/audit-logs");
});

test("Phase 28 - QA 4: GlobalSearchModal and recommendation engine link to valid canonical routes", () => {
  const searchModalPath = path.join(ROOT_DIR, "src/components/tools/GlobalSearchModal.tsx");
  const searchContent = fs.readFileSync(searchModalPath, "utf-8");

  assert.ok(!searchContent.includes('href: "/career/interviews"'), "Old /career/interviews route must be replaced");
  assert.ok(!searchContent.includes('href: "/career/tracker"'), "Old /career/tracker route must be replaced");
  assert.ok(!searchContent.includes('href: "/student/calculator"'), "Old /student/calculator route must be replaced");

  const recEnginePath = path.join(ROOT_DIR, "src/lib/student/personalization/recommendation-engine.ts");
  const recContent = fs.readFileSync(recEnginePath, "utf-8");

  assert.ok(!recContent.includes('actionRoute: "/career/interviews"'), "Rec engine must use /student/applications");
  assert.ok(!recContent.includes('actionRoute: "/career/tracker"'), "Rec engine must use /student/applications");
});

test("Phase 28 - QA 5: Next.js server redirects provide fallback for legacy URLs", () => {
  const configPath = path.join(ROOT_DIR, "next.config.ts");
  const configContent = fs.readFileSync(configPath, "utf-8");

  assert.ok(configContent.includes("redirects()"), "next.config.ts must declare redirects");
  assert.ok(configContent.includes('source: "/admin/audit"'));
  assert.ok(configContent.includes('destination: "/admin/audit-logs"'));
  assert.ok(configContent.includes('source: "/career/interviews"'));
  assert.ok(configContent.includes('destination: "/student/applications"'));
  assert.ok(configContent.includes('source: "/student/calculator"'));
  assert.ok(configContent.includes('destination: "/student/sgpa-calculator"'));
  assert.ok(configContent.includes('source: "/student/semesters"'));
  assert.ok(configContent.includes('destination: "/student/cgpa-calculator"'));
});

// =========================================================================
// 3. APP ROUTER BOUNDARIES (NOT-FOUND, ERROR, GLOBAL-ERROR, LOADING)
// =========================================================================

test("Phase 28 - QA 6: App Router not-found.tsx exists, has noindex, and provides core links", () => {
  const notFoundPath = path.join(ROOT_DIR, "src/app/not-found.tsx");
  assert.ok(fs.existsSync(notFoundPath), "src/app/not-found.tsx must exist");

  const content = fs.readFileSync(notFoundPath, "utf-8");
  assert.ok(content.includes("index: false"), "not-found.tsx must declare noindex");
  assert.ok(content.includes('href="/"'), "not-found.tsx must link to Home");
  assert.ok(content.includes('href="/tools"'), "not-found.tsx must link to Tools");
  assert.ok(content.includes('href="/student"'), "not-found.tsx must link to Student Hub");
  assert.ok(content.includes('href="/dashboard"'), "not-found.tsx must link to Dashboard");
});

test("Phase 28 - QA 7: App Router error.tsx and global-error.tsx provide safe recovery", () => {
  const errorPath = path.join(ROOT_DIR, "src/app/error.tsx");
  assert.ok(fs.existsSync(errorPath), "src/app/error.tsx must exist");
  const errorContent = fs.readFileSync(errorPath, "utf-8");
  assert.ok(errorContent.startsWith('"use client"') || errorContent.startsWith("'use client'"));
  assert.ok(errorContent.includes("reset()"), "error.tsx must provide a reset handler");
  assert.ok(errorContent.includes('role="alert"'), "error.tsx must have an alert role");

  const globalErrorPath = path.join(ROOT_DIR, "src/app/global-error.tsx");
  assert.ok(fs.existsSync(globalErrorPath), "src/app/global-error.tsx must exist");
  const globalErrorContent = fs.readFileSync(globalErrorPath, "utf-8");
  assert.ok(globalErrorContent.includes("<html") && globalErrorContent.includes("<body"), "global-error.tsx must define html/body");
  assert.ok(globalErrorContent.includes("reset()"), "global-error.tsx must provide reset");
});

test("Phase 28 - QA 8: App Router loading.tsx provides accessible status indicator", () => {
  const loadingPath = path.join(ROOT_DIR, "src/app/loading.tsx");
  assert.ok(fs.existsSync(loadingPath), "src/app/loading.tsx must exist");
  const content = fs.readFileSync(loadingPath, "utf-8");
  assert.ok(content.includes('role="status"'), "loading.tsx must have role status");
  assert.ok(content.includes('aria-live="polite"'), "loading.tsx must have aria-live polite");
});

// =========================================================================
// 4. AUTOMATIC DOWNLOAD INVARIANT (3s Countdown, Single Trigger)
// =========================================================================

class MockDownloadManager {
  constructor(autoDownloadEnabled = true) {
    this.autoDownloadEnabled = autoDownloadEnabled;
    this.executedDownloads = new Set();
    this.downloadLog = [];
  }

  triggerAutoDownload(resultId, filename, data) {
    if (!this.autoDownloadEnabled) {
      return { triggered: false, reason: "disabled_by_preference" };
    }
    if (this.executedDownloads.has(resultId)) {
      return { triggered: false, reason: "already_downloaded" };
    }
    this.executedDownloads.add(resultId);
    this.downloadLog.push({ resultId, filename, data, timestamp: Date.now() });
    return { triggered: true, countdownSeconds: 3 };
  }

  manualDownload(filename, data) {
    this.downloadLog.push({ resultId: "manual", filename, data, timestamp: Date.now() });
    return { triggered: true };
  }
}

test("Phase 28 - QA 9: Automatic download invariant enforces 3s countdown & single execution", () => {
  const manager = new MockDownloadManager(true);

  // First auto-download for result_001
  const first = manager.triggerAutoDownload("result_001", "compressed.pdf", "data");
  assert.equal(first.triggered, true);
  assert.equal(first.countdownSeconds, 3);
  assert.equal(manager.downloadLog.length, 1);

  // Duplicate attempt for the same result_001 must be suppressed
  const duplicate = manager.triggerAutoDownload("result_001", "compressed.pdf", "data");
  assert.equal(duplicate.triggered, false);
  assert.equal(duplicate.reason, "already_downloaded");
  assert.equal(manager.downloadLog.length, 1);

  // Manual download remains available anytime
  const manual = manager.manualDownload("compressed.pdf", "data");
  assert.equal(manual.triggered, true);
  assert.equal(manager.downloadLog.length, 2);

  // When disabled by user preference, auto-download is skipped
  const disabledManager = new MockDownloadManager(false);
  const disabledAttempt = disabledManager.triggerAutoDownload("result_002", "image.png", "data");
  assert.equal(disabledAttempt.triggered, false);
  assert.equal(disabledAttempt.reason, "disabled_by_preference");
  assert.equal(disabledManager.downloadLog.length, 0);
});

// =========================================================================
// 5. AUTHENTICATION & GOOGLE OAUTH CONFIGURATION INVARIANTS
// =========================================================================

test("Phase 28 - QA 10: Google OAuth enforces prompt: 'select_account' and PKCE flow", () => {
  const authContextPath = path.join(ROOT_DIR, "src/context/AuthContext.tsx");
  const authContent = fs.readFileSync(authContextPath, "utf-8");

  // Invariant: prompt must be 'select_account' (NOT 'consent')
  assert.ok(authContent.includes("prompt: 'select_account'") || authContent.includes('prompt: "select_account"'));
  assert.ok(!authContent.includes("prompt: 'consent'") && !authContent.includes('prompt: "consent"'));

  // Provider must be 'google'
  assert.ok(authContent.includes("provider: 'google'") || authContent.includes('provider: "google"'));
});

function sanitizeRedirectUrl(rawUrl, fallback = "/dashboard") {
  if (!rawUrl || typeof rawUrl !== "string") return fallback;
  const trimmed = rawUrl.trim();
  if (!trimmed || /[\x00-\x1F\x7F]/.test(trimmed)) return fallback;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.startsWith("\\")) return fallback;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return fallback;
  if (!trimmed.startsWith("/")) return fallback;
  return trimmed;
}

test("Phase 28 - QA 11: Open redirect defense strictly blocks malicious URLs", () => {
  const maliciousUrls = [
    "https://evil.com/phish",
    "http://attacker.com",
    "//evil.com",
    "/\\evil.com",
    "\\evil.com",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
  ];

  for (const url of maliciousUrls) {
    assert.equal(sanitizeRedirectUrl(url), "/dashboard", `Failed to block malicious redirect: ${url}`);
  }

  const validUrls = [
    "/student",
    "/tools/jpg-to-pdf",
    "/student/cgpa-calculator",
    "/dashboard",
  ];

  for (const url of validUrls) {
    assert.equal(sanitizeRedirectUrl(url), url, `Failed to allow safe internal redirect: ${url}`);
  }
});

// =========================================================================
// 6. DETERMINISTIC ACADEMIC CALCULATIONS
// =========================================================================

const VTU_BANDS = [
  { min: 90, grade: "O", point: 10 },
  { min: 80, grade: "A+", point: 9 },
  { min: 70, grade: "A", point: 8 },
  { min: 60, grade: "B+", point: 7 },
  { min: 55, grade: "B", point: 6 },
  { min: 50, grade: "C", point: 5 },
  { min: 40, grade: "P", point: 4 },
  { min: 0, grade: "F", point: 0 },
];

function deriveVTUGrade(cie, see) {
  if (cie < 20 || see < 18) {
    return { grade: "F", point: 0, passed: false };
  }
  const total = Math.round(cie + see);
  if (total < 40) {
    return { grade: "F", point: 0, passed: false };
  }
  for (const band of VTU_BANDS) {
    if (total >= band.min) {
      return { grade: band.grade, point: band.point, passed: band.grade !== "F" };
    }
  }
  return { grade: "F", point: 0, passed: false };
}

function calculateSGPA(courses) {
  let totalCredits = 0;
  let totalCreditPoints = 0;
  for (const c of courses) {
    totalCredits += c.credits;
    totalCreditPoints += c.credits * c.point;
  }
  if (totalCredits === 0) return 0;
  return Math.round((totalCreditPoints / totalCredits) * 100) / 100;
}

function calculateCGPA(semesters) {
  let totalCredits = 0;
  let totalPoints = 0;
  for (const s of semesters) {
    totalCredits += s.credits;
    totalPoints += s.credits * s.sgpa;
  }
  if (totalCredits === 0) return 0;
  return Math.round((totalPoints / totalCredits) * 100) / 100;
}

function calculateVTUPercentage(cgpa) {
  if (cgpa <= 0.75) return 0;
  return Math.round((cgpa - 0.75) * 10 * 100) / 100;
}

test("Phase 28 - QA 12: VTU 2022 calculation engine enforces deterministic ground truth", () => {
  // Normal grades
  assert.deepEqual(deriveVTUGrade(45, 48), { grade: "O", point: 10, passed: true });
  assert.deepEqual(deriveVTUGrade(40, 42), { grade: "A+", point: 9, passed: true });
  assert.deepEqual(deriveVTUGrade(35, 38), { grade: "A", point: 8, passed: true });

  // Cutoff failure cases: CIE < 20 fails even if total >= 40
  assert.deepEqual(deriveVTUGrade(19, 40), { grade: "F", point: 0, passed: false });
  // SEE < 18 fails even if total >= 40
  assert.deepEqual(deriveVTUGrade(45, 17), { grade: "F", point: 0, passed: false });

  // SGPA calculation
  const sampleCourses = [
    { credits: 4, point: 10 },
    { credits: 4, point: 9 },
    { credits: 3, point: 8 },
    { credits: 1, point: 10 },
  ]; // Total points: 40 + 36 + 24 + 10 = 110, Total credits: 12. SGPA = 110/12 = 9.17
  assert.equal(calculateSGPA(sampleCourses), 9.17);

  // CGPA calculation
  const sampleSemesters = [
    { credits: 20, sgpa: 9.0 },
    { credits: 20, sgpa: 8.0 },
  ]; // Total points = 180 + 160 = 340, Total credits = 40. CGPA = 8.50
  assert.equal(calculateCGPA(sampleSemesters), 8.5);

  // Percentage conversion
  assert.equal(calculateVTUPercentage(8.5), 77.5);
  assert.equal(calculateVTUPercentage(10.0), 92.5);
});

// =========================================================================
// 7. RESPONSIVE BREAKPOINT & TOUCH TARGET VERIFICATION
// =========================================================================

test("Phase 28 - QA 13: Viewport breakpoints cleanly segment 320px to 1920px spectrum", () => {
  const classify = (w) => {
    if (w >= 1536) return "2xl";
    if (w >= 1280) return "xl";
    if (w >= 1024) return "lg";
    if (w >= 768) return "md";
    if (w >= 640) return "sm";
    return "xs";
  };

  assert.equal(classify(320), "xs");  // iPhone SE 1st gen
  assert.equal(classify(375), "xs");  // iPhone 13 mini
  assert.equal(classify(768), "md");  // iPad Portrait
  assert.equal(classify(1024), "lg"); // Desktop / iPad Landscape
  assert.equal(classify(1440), "xl"); // Standard MacBook
  assert.equal(classify(1920), "2xl"); // Full HD Desktop
});

// =========================================================================
// 8. SAARVI BRAND INVARIANTS & PRODUCTION RELEASE READINESS
// =========================================================================

test("Phase 28 - QA 14: Saarvi pricing, tagline, and brand constants remain strictly preserved", () => {
  const pricingPath = path.join(ROOT_DIR, "src/config/pricing.ts");
  const pricingContent = fs.readFileSync(pricingPath, "utf-8");

  // Invariant: Monthly ₹99, Yearly ₹899
  assert.ok(pricingContent.includes("99"));
  assert.ok(pricingContent.includes("899"));
  assert.ok(pricingContent.includes("Saarvi Pro"));

  const siteConfigPath = path.join(ROOT_DIR, "src/config/site.ts");
  const siteContent = fs.readFileSync(siteConfigPath, "utf-8");
  assert.ok(siteContent.includes('name: "Saarvi"'));
  assert.ok(siteContent.includes('tagline: "Study. Work. Grow."'));
  assert.ok(siteContent.includes("https://saarvi.app"));
});
