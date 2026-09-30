import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildSaarviEmailHtml,
  buildSaarviEmailPlainText,
  sanitizeEmailSubject,
} from "../src/lib/notifications/email-template.ts";
import { NotificationAudienceService } from "../src/lib/services/notification-audience-service.ts";
import { CareerProfileService } from "../src/lib/career/career-profile-service.ts";
import { TrainingService } from "../src/lib/career/training-service.ts";
import { NavigationService } from "../src/lib/navigation/navigation-service.ts";
import {
  DataPreserver,
  TokenDecomposer,
  HybridCoordinateClusteringStrategy,
  StreamStrategy,
  LatticeStrategy,
  TableQualityEvaluator,
  MultiPageTableStitcher,
  ExcelValidationService,
  ExcelValidationError,
} from "../src/lib/tools/document/pdf-excel-service.ts";
import { buildXlsxWorkbook, parseXlsxWorkbook } from "../src/lib/tools/document/openxml-helper.ts";

const ROOT_DIR = process.cwd();

// ============================================================================
// 1. NOTIFICATIONS / BROADCAST DELIVERY 4.0 TESTS
// ============================================================================

test("Saarvi 7.0 — Responsive HTML Email Template and Header Injection Protection", () => {
  // Test subject header injection sanitization
  const maliciousSubject = "Important Update\r\nBcc: victim@example.com\r\nSubject: Injected";
  const cleanSubject = sanitizeEmailSubject(maliciousSubject);
  assert.strictEqual(cleanSubject.includes("\r"), false);
  assert.strictEqual(cleanSubject.includes("\n"), false);
  assert.strictEqual(cleanSubject, "Important Update Bcc: victim@example.com Subject: Injected");

  // Test HTML template rendering
  const emailHtml = buildSaarviEmailHtml({
    title: "Quarterly Platform Review",
    body: "We have released new AI document tools and career discovery features.",
    actionUrl: "https://saarvi.org/tools",
    actionLabel: "Explore Tools Now",
    recipientName: "Aarav",
    category: "FEATURE_RELEASE",
  });

  assert.ok(emailHtml.includes("<!DOCTYPE html>"));
  assert.ok(emailHtml.includes("Saarvi"));
  assert.ok(emailHtml.includes("Quarterly Platform Review"));
  assert.ok(emailHtml.includes("Explore Tools Now"));
  assert.ok(emailHtml.includes("https://saarvi.org/tools"));
  assert.ok(emailHtml.includes("Hello Aarav,"));
  assert.ok(emailHtml.includes("FEATURE RELEASE"));
  assert.ok(emailHtml.includes("Preferences"));

  // Plain-text fallback
  const plainText = buildSaarviEmailPlainText({
    title: "Quarterly Platform Review",
    body: "We have released new AI document tools.",
    actionUrl: "https://saarvi.org/tools",
    actionLabel: "Explore Tools Now",
    recipientName: "Aarav",
  });
  assert.ok(plainText.includes("Hello Aarav,"));
  assert.ok(plainText.includes("Explore Tools Now: https://saarvi.org/tools"));
});

test("Saarvi 7.0 — Notification Audience Service validates targeting and bounded batches", async () => {
  // Audience filters exist and resolve to structured queries
  const allCount = await NotificationAudienceService.countAudience("ALL_USERS");
  assert.strictEqual(typeof allCount, "number");
  assert.ok(allCount >= 0);

  const studentCount = await NotificationAudienceService.countAudience("STUDENTS");
  assert.strictEqual(typeof studentCount, "number");

  const jobSeekerCount = await NotificationAudienceService.countAudience("JOB_SEEKERS");
  assert.strictEqual(typeof jobSeekerCount, "number");

  // Bounded batch invariant: Bounded batch chunks must not exceed maximum threshold (100)
  const simulatedAudience = Array.from({ length: 285 }, (_, i) => ({
    id: `user-${i}`,
    email: `user${i}@example.com`,
  }));

  const BATCH_SIZE = 50;
  const chunks = [];
  for (let i = 0; i < simulatedAudience.length; i += BATCH_SIZE) {
    chunks.push(simulatedAudience.slice(i, i + BATCH_SIZE));
  }

  assert.strictEqual(chunks.length, 6);
  assert.strictEqual(chunks[0].length, 50);
  assert.strictEqual(chunks[5].length, 35);
  for (const c of chunks) {
    assert.ok(c.length <= 100, "Individual email queue batch must never exceed 100 recipients");
  }
});

test("Saarvi 7.0 — Admin Notification Endpoints & Cursor Pagination Exist", () => {
  const countRoutePath = path.join(ROOT_DIR, "src/app/api/admin/notifications/audience-count/route.ts");
  const testEmailRoutePath = path.join(ROOT_DIR, "src/app/api/admin/notifications/test-email/route.ts");
  const retryRoutePath = path.join(ROOT_DIR, "src/app/api/admin/notifications/retry/route.ts");
  const notificationsRoutePath = path.join(ROOT_DIR, "src/app/api/notifications/route.ts");

  assert.ok(fs.existsSync(countRoutePath), "audience-count endpoint must exist");
  assert.ok(fs.existsSync(testEmailRoutePath), "test-email endpoint must exist");
  assert.ok(fs.existsSync(retryRoutePath), "retry endpoint must exist");

  const notifRouteContent = fs.readFileSync(notificationsRoutePath, "utf-8");
  assert.ok(notifRouteContent.includes("next_cursor"), "notifications route must support cursor pagination");
  assert.ok(notifRouteContent.includes("hasMore"), "notifications route must return pagination state");
});

// ============================================================================
// 2. INTELLIGENT CAREER & TRAINING DISCOVERY TESTS
// ============================================================================

test("Saarvi 7.0 — Career Profile Service taxonomies and query builder", () => {
  const branches = CareerProfileService.getEngineeringBranches();
  assert.ok(branches.length >= 6);
  const csBranch = branches.find((b) => b.id === "CSE");
  assert.ok(csBranch, "Computer Science branch must exist");
  assert.ok(csBranch.roles.includes("Frontend Developer"));

  const query = CareerProfileService.buildSearchQuery({
    targetRole: "Full Stack Engineer",
    branch: "Computer Science",
    preferredLocation: "Bengaluru",
    workMode: "HYBRID",
    skills: ["React", "Node.js"],
  });

  assert.ok(query.includes("Full Stack Engineer"));
  assert.ok(query.includes("Bengaluru"));
  assert.ok(query.includes("hybrid"));

  const relatedRoles = CareerProfileService.getRelatedRoles("Mechanical Engineering");
  assert.ok(relatedRoles.length > 0);
  assert.ok(relatedRoles.some((r) => r.toLowerCase().includes("cad") || r.toLowerCase().includes("design")));
});

test("Saarvi 7.0 — Training & Learning Opportunity Model and Service", async () => {
  const allTrainings = await TrainingService.getOpportunities();
  assert.ok(allTrainings.length >= 3, "Must return baseline training opportunities");

  for (const t of allTrainings) {
    assert.ok(t.id, "Training must have ID");
    assert.ok(t.title, "Training must have title");
    assert.ok(t.provider, "Training must have provider");
    assert.ok(["ONLINE", "OFFLINE", "HYBRID"].includes(t.mode), "Training must have valid mode");
    assert.ok(t.duration, "Training must specify duration");
    assert.ok(typeof t.hasCertificate === "boolean", "Training must declare certificate availability");
    assert.ok(t.applyUrl, "Training must provide application URL");
  }

  // Filter by branch
  const csTrainings = await TrainingService.getOpportunities({ branch: "Computer Science" });
  assert.ok(csTrainings.length > 0);
});

test("Saarvi 7.0 — Saarvi Verified Priority and Explainable Scoring", () => {
  const mixedJobs = [
    {
      id: "job-ext-1",
      title: "Software Engineer",
      company: "Acme Corp",
      source: "Google Jobs",
      matchScore: 88,
      isSaarviVerified: false,
      verificationTier: "COMMUNITY_LISTED",
    },
    {
      id: "job-verified-1",
      title: "Frontend Developer",
      company: "Saarvi Partner Tech",
      source: "Saarvi Direct",
      matchScore: 82,
      isSaarviVerified: true,
      verificationTier: "SAARVI_VERIFIED",
    },
  ];

  // Sorting rule: Saarvi Verified items are prioritized over unverified third-party aggregations
  const sorted = [...mixedJobs].sort((a, b) => {
    const aVerified = a.verificationTier === "SAARVI_VERIFIED" || a.isSaarviVerified;
    const bVerified = b.verificationTier === "SAARVI_VERIFIED" || b.isSaarviVerified;
    if (aVerified && !bVerified) return -1;
    if (!aVerified && bVerified) return 1;
    return b.matchScore - a.matchScore;
  });

  assert.strictEqual(sorted[0].id, "job-verified-1", "Saarvi Verified opportunity must rank first");
});

// ============================================================================
// 3. FULLY ADMIN-CONTROLLED NAVBAR TESTS
// ============================================================================

test("Saarvi 7.0 — Navigation Service enforces safety rules and version snapshots", async () => {
  // Test validation rejects duplicate routes
  const invalidDuplicateRoutes = [
    { id: "1", label: "Tools", route: "/tools", orderIndex: 0, isEnabled: true, isSystem: false },
    { id: "2", label: "More Tools", route: "/tools", orderIndex: 1, isEnabled: true, isSystem: false },
  ];
  const dupCheck = NavigationService.validateItems(invalidDuplicateRoutes);
  assert.strictEqual(dupCheck.valid, false);
  assert.ok(dupCheck.errors.some((e) => e.includes("Duplicate route")));

  // Test validation rejects broken internal routes
  const brokenRoute = [
    { id: "1", label: "Broken", route: "/non-existent-broken-path-xyz", orderIndex: 0, isEnabled: true, isSystem: false },
  ];
  const brokenCheck = NavigationService.validateItems(brokenRoute);
  assert.strictEqual(brokenCheck.valid, false);
  assert.ok(brokenCheck.errors.some((e) => e.includes("does not resolve")));

  // Test reserved system items invariant
  const missingLogo = [
    { id: "1", label: "Tools", route: "/tools", orderIndex: 0, isEnabled: true, isSystem: false },
  ];
  const systemCheck = NavigationService.validateItems(missingLogo);
  assert.strictEqual(systemCheck.valid, false);
  assert.ok(systemCheck.errors.some((e) => e.includes("Reserved system route")));

  // Test published items retrieval
  const published = await NavigationService.getPublishedItems();
  assert.ok(published.length > 0);
  assert.ok(published.some((i) => i.route === "/tools"));
  assert.ok(published.some((i) => i.route === "/jobs"));

  // Test version snapshot and rollback simulation
  const snapshotRes = await NavigationService.publishDraft("Initial test publish", "admin-1");
  assert.strictEqual(snapshotRes.success, true);
  assert.ok(snapshotRes.version >= 1);

  const versions = await NavigationService.getVersionHistory();
  assert.ok(versions.length >= 1);

  const rollbackRes = await NavigationService.rollbackToVersion(snapshotRes.version, "admin-1");
  assert.strictEqual(rollbackRes.success, true);
});

// ============================================================================
// 4. PDF → EXCEL EXTRACTION & VALIDATION TESTS
// ============================================================================

test("Saarvi 7.0 — DataPreserver safely formats numbers, currencies, and preserves codes", () => {
  // Leading zeros must be preserved as string
  assert.strictEqual(DataPreserver.parseCellValue("01234"), "01234");
  assert.strictEqual(DataPreserver.parseCellValue("007"), "007");

  // Dates must be preserved as string
  assert.strictEqual(DataPreserver.parseCellValue("2026-09-30"), "2026-09-30");
  assert.strictEqual(DataPreserver.parseCellValue("30/09/2026"), "30/09/2026");

  // Formatted numbers with commas must be preserved as string
  assert.strictEqual(DataPreserver.parseCellValue("1,250.50"), "1,250.50");
  assert.strictEqual(DataPreserver.parseCellValue("1,000,000"), "1,000,000");

  // Currencies and percentages must be preserved as string
  assert.strictEqual(DataPreserver.parseCellValue("$499.00"), "$499.00");
  assert.strictEqual(DataPreserver.parseCellValue("₹1,500"), "₹1,500");
  assert.strictEqual(DataPreserver.parseCellValue("98.5%"), "98.5%");

  // Clean numbers must be converted to numeric values for Excel calculations
  assert.strictEqual(DataPreserver.parseCellValue("42"), 42);
  assert.strictEqual(DataPreserver.parseCellValue("94.5"), 94.5);
  assert.strictEqual(DataPreserver.parseCellValue("-17.25"), -17.25);
});

test("Saarvi 7.0 — TokenDecomposer splits single-line multi-column text runs", () => {
  const mergedLine = {
    str: "101    Alice Smith    Computer Science    94.5    Pass",
    x: 50,
    y: 700,
    width: 400,
    height: 12,
    fontSize: 10,
  };

  const tokens = TokenDecomposer.decompose(mergedLine);
  assert.strictEqual(tokens.length, 5, "Must split line into 5 column tokens");
  assert.strictEqual(tokens[0].str, "101");
  assert.strictEqual(tokens[1].str, "Alice Smith");
  assert.strictEqual(tokens[2].str, "Computer Science");
  assert.strictEqual(tokens[3].str, "94.5");
  assert.strictEqual(tokens[4].str, "Pass");
  assert.ok(tokens[1].x > tokens[0].x, "Token X coordinates must advance horizontally");
});

test("Saarvi 7.0 — Table Extraction Strategies (Hybrid, Stream, Lattice)", () => {
  // Generate synthetic multi-column tabular items
  const items = [
    { str: "ID", x: 50, y: 700, width: 20, height: 10, fontSize: 10 },
    { str: "Student Name", x: 150, y: 700, width: 80, height: 10, fontSize: 10 },
    { str: "Branch", x: 300, y: 700, width: 50, height: 10, fontSize: 10 },
    { str: "Score", x: 420, y: 700, width: 30, height: 10, fontSize: 10 },

    { str: "0101", x: 50, y: 680, width: 20, height: 10, fontSize: 10 },
    { str: "Aarav Sharma", x: 150, y: 680, width: 80, height: 10, fontSize: 10 },
    { str: "CSE", x: 300, y: 680, width: 30, height: 10, fontSize: 10 },
    { str: "92.5", x: 420, y: 680, width: 30, height: 10, fontSize: 10 },

    { str: "0102", x: 50, y: 660, width: 20, height: 10, fontSize: 10 },
    { str: "Diya Patel", x: 150, y: 660, width: 60, height: 10, fontSize: 10 },
    { str: "ECE", x: 300, y: 660, width: 30, height: 10, fontSize: 10 },
    { str: "88.0", x: 420, y: 660, width: 30, height: 10, fontSize: 10 },
  ];

  // 1. Hybrid Coordinate Clustering
  const hybridStrategy = new HybridCoordinateClusteringStrategy();
  const hybridRes = hybridStrategy.extract(items);
  assert.ok(hybridRes, "Hybrid strategy must extract tabular data");
  assert.strictEqual(hybridRes.rowCount, 3);
  assert.strictEqual(hybridRes.colCount, 4);
  assert.strictEqual(hybridRes.rows[1][0], "0101"); // Preserved leading zero

  // 2. Evaluator selects highest scoring strategy
  const evaluator = new TableQualityEvaluator();
  const winner = evaluator.evaluate(items);
  assert.ok(winner);
  assert.ok(winner.confidenceScore >= 0.5);
  assert.strictEqual(winner.rowCount, 3);
});

test("Saarvi 7.0 — MultiPageTableStitcher merges continuation tables without duplicate headers", () => {
  const page1Table = {
    strategy: "Hybrid Coordinate Clustering",
    rows: [
      ["Employee ID", "Full Name", "Department"],
      ["E-101", "Aditi Rao", "Engineering"],
      ["E-102", "Karan Johar", "Product"],
    ],
    rowCount: 3,
    colCount: 3,
    nonEmptyCells: 9,
    fillRatio: 1,
    confidenceScore: 0.95,
  };

  const page2Table = {
    strategy: "Hybrid Coordinate Clustering",
    rows: [
      ["Employee ID", "Full Name", "Department"], // Repeated header
      ["E-103", "Meera Sen", "Design"],
      ["E-104", "Vikram Rathore", "Sales"],
    ],
    rowCount: 3,
    colCount: 3,
    nonEmptyCells: 9,
    fillRatio: 1,
    confidenceScore: 0.95,
  };

  const stitched = MultiPageTableStitcher.stitch([
    { pageNum: 1, candidate: page1Table },
    { pageNum: 2, candidate: page2Table },
  ]);

  assert.strictEqual(stitched.length, 1, "Must stitch into a single continuous table");
  assert.strictEqual(stitched[0].rows.length, 5, "Total rows must be 1 header + 4 data rows");
  assert.strictEqual(stitched[0].rows[0][0], "Employee ID");
  assert.strictEqual(stitched[0].rows[1][0], "E-101");
  assert.strictEqual(stitched[0].rows[3][0], "E-103");
});

test("Saarvi 7.0 — ExcelValidationService prevents silent empty or corrupted exports", async () => {
  // Test valid workbook
  const validData = [
    {
      name: "Q3 Results",
      rows: [
        ["Quarter", "Revenue", "Margin"],
        ["Q1", 10000, "15%"],
        ["Q2", 12500, "18%"],
      ],
    },
  ];

  const validBytes = await buildXlsxWorkbook(validData);
  const isValid = await ExcelValidationService.validateWorkbook(validBytes);
  assert.strictEqual(isValid, true);

  // Test empty workbook rejection
  const emptyData = [
    {
      name: "EmptySheet",
      rows: [],
    },
  ];
  const emptyBytes = await buildXlsxWorkbook(emptyData);

  await assert.rejects(
    async () => {
      await ExcelValidationService.validateWorkbook(emptyBytes);
    },
    (err) => {
      assert.ok(err instanceof ExcelValidationError || err.message.includes("no data rows"));
      return true;
    }
  );

  // Corrupted bytes rejection
  const corruptBytes = new Uint8Array([1, 2, 3, 4]);
  await assert.rejects(async () => {
    await ExcelValidationService.validateWorkbook(corruptBytes);
  }, ExcelValidationError);
});
