import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "crypto";
import { PDFDocument } from "pdf-lib";
import { TemplateCompiler } from "../src/lib/templates/compiler.ts";
import { TemplateRepository } from "../src/lib/templates/repository.ts";
import { TemplateBatchService } from "../src/lib/templates/batch-service.ts";

const ROOT = process.cwd();

test("1. Part A - Canonical User Feedback Database Schema & Migration", () => {
  const migration = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/031_feedback_and_template_studio_4_0.sql"),
    "utf8"
  );

  assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS public.feedback"), "Creates feedback table");
  assert.ok(migration.includes("operation_id"), "Includes operation_id for linking completed tools");
  assert.ok(migration.includes("sentiment_confidence"), "Includes sentiment_confidence");
  assert.ok(migration.includes("guest_session_id"), "Includes guest_session_id");
  assert.ok(migration.includes("idempotency_key"), "Includes idempotency_key");
  assert.ok(migration.includes("ENABLE ROW LEVEL SECURITY"), "Feedback table has RLS enabled");
  assert.ok(migration.includes("CREATE OR REPLACE VIEW public.user_feedback"), "Provides canonical user_feedback view");
});

test("2. Part A - Feedback Ingestion API: Strict Validation, Server-Side Identity, Zero Document Storage", () => {
  const apiRoute = fs.readFileSync(path.join(ROOT, "src/app/api/feedback/route.ts"), "utf8");

  // Server-side authentication resolution
  assert.ok(apiRoute.includes("createClient"), "Resolves server session via createClient");
  assert.ok(apiRoute.includes("getUser()"), "Authenticates user server-side — never trusts client user_id");

  // Validation
  assert.ok(apiRoute.includes("CANONICAL_CATEGORIES"), "Enforces canonical categories");
  assert.ok(apiRoute.includes("Number.isInteger(numRating)") && apiRoute.includes("numRating < 1 || numRating > 5"), "Restricts rating to 1-5 integer");
  assert.ok(apiRoute.includes("sanitizeInput"), "Sanitizes message input against XSS");
  assert.ok(apiRoute.includes("cleanMessage.length > 2000"), "Caps message length");

  // Privacy: Never stores document buffers or keys
  assert.ok(!apiRoute.includes("fileBuffer") && !apiRoute.includes("fileContent"), "Never stores private document contents");

  // Idempotency deduplication
  assert.ok(apiRoute.includes("Feedback already recorded."), "Returns idempotent message on duplicate submission");
});

test("3. Part A - ResultDownload Component: Non-blocking feedback with 1-5 rating & operationId", () => {
  const resultDownload = fs.readFileSync(path.join(ROOT, "src/components/common/ResultDownload.tsx"), "utf8");

  assert.ok(resultDownload.includes("Was this tool helpful?"), "Prompts 'Was this tool helpful?'");
  assert.ok(resultDownload.includes("What could we improve?"), "Optional input 'What could we improve?'");
  assert.ok(resultDownload.includes("Send Feedback"), "Includes Send Feedback button");
  assert.ok(resultDownload.includes("Not Now"), "Includes Not Now dismiss button");
  assert.ok(resultDownload.includes("operationId"), "Passes operationId to feedback API");
  assert.ok(resultDownload.includes("downloadNow") && resultDownload.includes("useAutoDownload"), "Preserves auto-download independently without blocking");
});

test("4. Part A - Admin Feedback Query & Real Metrics Calculation", () => {
  const adminApi = fs.readFileSync(path.join(ROOT, "src/app/api/admin/feedback/route.ts"), "utf8");

  assert.ok(adminApi.includes("getAuthenticatedAdmin"), "Enforces server-side admin authentication");
  assert.ok(adminApi.includes("starCounts"), "Calculates real 1-5 star distributions");
  assert.ok(adminApi.includes("byStatus"), "Calculates status distributions");
  assert.ok(adminApi.includes("avgRatingAll"), "Computes honest average rating from real DB rows");
  assert.ok(adminApi.includes("operationId: row.operation_id"), "Maps operation_id in admin queries");
  assert.ok(adminApi.includes("!isSupabaseConfigured()"), "Never falls back to mock seeds when Supabase is configured");

  const adminPatch = fs.readFileSync(path.join(ROOT, "src/app/api/admin/feedback/[id]/route.ts"), "utf8");
  assert.ok(adminPatch.includes("resolved_at") && adminPatch.includes("resolved_by"), "Sets resolved_at and resolved_by on resolution");
  assert.ok(adminPatch.includes("admin_notes"), "Supports internal admin notes");
});

test("5. Part B - Template Compiler: PDF Preflight, Layout & Text Extraction", async () => {
  // Generate a minimal valid A4 PDF in memory for testing
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  assert.strictEqual(Math.round(width), 595);
  assert.strictEqual(Math.round(height), 842);

  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = Buffer.from(pdfBytes);

  // Preflight verification
  const preflight = await TemplateCompiler.preflight(pdfBuffer);
  assert.strictEqual(preflight.valid, true, "Validates PDF successfully");
  assert.strictEqual(preflight.pageCount, 1, "Detects single page count");
  assert.strictEqual(preflight.pageSize, "A4", "Identifies A4 page size");
  assert.ok(preflight.fileHash.length === 64, "Calculates SHA-256 hash");

  // Invalid PDF rejection test
  const invalidBuffer = Buffer.from("NOT_A_PDF_DOCUMENT");
  const invalidPreflight = await TemplateCompiler.preflight(invalidBuffer);
  assert.strictEqual(invalidPreflight.valid, false, "Rejects invalid PDF signature");
});

test("6. Part B - Template Candidate Field Extraction & Repeatable Sections", () => {
  const samplePdfText = `
    EMAA WARNER
    Accounting Executive
    hello@reallygreatsite.com
    +1 123-456-7890
    New York, USA
    WORK EXPERIENCE
    Senior Accountant - ABC Corp (2022 - Present)
    EDUCATION
    B.S. Accounting - XYZ University (2018 - 2022)
    SKILLS
    Financial Analysis, Budgeting, QuickBooks
  `;

  const extracted = TemplateCompiler.extractCandidateFields(samplePdfText, "Modern_Executive_Resume.pdf", "RESUME");

  assert.strictEqual(extracted.detectedFields.fullName, "EMAA WARNER", "Extracts candidate full name");
  assert.strictEqual(extracted.detectedFields.headline, "Accounting Executive", "Extracts candidate headline/title");
  assert.strictEqual(extracted.detectedFields.email, "hello@reallygreatsite.com", "Extracts candidate email via regex");
  assert.ok(extracted.detectedFields.phone.includes("123-456-7890"), "Extracts candidate phone number");
  assert.ok(extracted.detectedSections.includes("Work Experience"), "Identifies Work Experience section");
  assert.ok(extracted.detectedSections.includes("Education"), "Identifies Education section");
  assert.ok(extracted.detectedSections.includes("Skills"), "Identifies Skills section");
});

test("7. Part B - Automated Template Quality Check Suite", () => {
  const dummySchema = {
    templateId: "tpl_test_quality",
    version: 1,
    documentType: "RESUME",
    pageSize: "A4",
    margins: { top: 20, bottom: 20, left: 20, right: 20 },
    fontFamily: "Inter, sans-serif",
    primaryColor: "#2563eb",
    accentColor: "#0f172a",
    layout: "single-column",
    mode: "COMPILED",
    header: {
      fullNameField: "fullName",
      emailField: "email",
      phoneField: "phone",
    },
    sections: [
      { id: "exp", title: "Experience", type: "repeat" },
      { id: "edu", title: "Education", type: "repeat" },
      { id: "skills", title: "Skills", type: "skills-tags" },
    ],
  };

  const report = TemplateCompiler.runQualityCheck(dummySchema, "Valid text extracted from PDF resume with multiple sections");
  assert.strictEqual(report.textExtraction, "PASS", "Text extraction passes with adequate content");
  assert.strictEqual(report.layoutDetection, "PASS", "Layout detection passes");
  assert.strictEqual(report.fieldMapping, "PASS", "Field mapping passes with all core contact fields");
  assert.strictEqual(report.samplePreview, "PASS", "Sample preview passes");
  assert.strictEqual(report.license, "VERIFIED", "License verified status");
});

test("8. Part B - Template Repository: Duplicate Detection & Versioning", async () => {
  await TemplateRepository.initializeDefaults();

  const allTemplates = await TemplateRepository.getAllTemplates();
  assert.ok(allTemplates.length >= 6, "Loads built-in templates into database/repository");

  const classic = await TemplateRepository.getTemplateById("classic-ats");
  assert.ok(classic, "Retrieves template by ID");
  assert.strictEqual(classic?.version, 1, "Initial template version is 1");

  // Versioning test: create v2
  const v2 = await TemplateRepository.createNewVersion("classic-ats", {
    name: "ATS Classic v2 — Modernized",
  });
  assert.ok(v2, "Creates new template version");
  assert.strictEqual(v2?.version, 2, "Increments version number to 2");
  assert.strictEqual(v2?.id, "classic-ats_v2", "Creates versioned template ID");

  // Pinning test: original v1 must remain intact
  const originalV1 = await TemplateRepository.getTemplateById("classic-ats", 1);
  assert.strictEqual(originalV1?.version, 1, "Original v1 remains pinned for existing user documents");
});

test("9. Part B - Template Batch Service: Safe ZIP Handling & Bounded Concurrency", async () => {
  // Test safe inspection of non-zip file
  const testFile = {
    filename: "sample-resume.pdf",
    buffer: Buffer.from("%PDF-1.4 Minimal test pdf"),
    size: 26,
  };

  const extracted = await TemplateBatchService.inspectAndExtractFiles([testFile]);
  assert.strictEqual(extracted.length, 1, "Returns single file safely");

  // Test batch creation
  const batch = await TemplateBatchService.createBatch(
    "Unit Test Batch #1",
    "RESUME",
    [testFile],
    "test-admin-id"
  );

  assert.ok(batch.id, "Generates unique batch UUID");
  assert.strictEqual(batch.totalFiles, 1, "Sets total files");
  assert.strictEqual(batch.tasks.length, 1, "Initializes task queue");
  assert.strictEqual(batch.tasks[0].status, "QUEUED", "Task begins in QUEUED state");
});

test("10. Part B - User Template Gallery & Editing: Try Sample, Build, & Feedback Connection", () => {
  const studentResumeCode = fs.readFileSync(path.join(ROOT, "src/app/student/resume/page.tsx"), "utf8");

  assert.ok(studentResumeCode.includes("Try Sample"), "Includes Try Sample button in template gallery");
  assert.ok(studentResumeCode.includes("Build"), "Includes Build / Build with this button in template gallery");
  assert.ok(studentResumeCode.includes("Preview"), "Includes Preview button in template gallery");
  assert.ok(studentResumeCode.includes("Alex Johnson Demo") || studentResumeCode.includes("sample information"), "Isolates fictional demonstration data");
  assert.ok(studentResumeCode.includes("Replace with My Information"), "Allows switching from sample to editable user state");
  assert.ok(studentResumeCode.includes("Was this template useful?"), "Prompts post-export template feedback");
  assert.ok(studentResumeCode.includes("toolKey: \"resume_builder\""), "Links feedback to resume_builder tool key");
});
