import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC_DIR = path.resolve("src");

describe("Saarvi Tool UI/UX Standardization Test Suite", () => {
  test("Zero instances of bg-slate-950 or bg-gray-950 across user-facing pages and components", () => {
    const scanPaths = [
      path.join(SRC_DIR, "app/tools"),
      path.join(SRC_DIR, "app/student"),
      path.join(SRC_DIR, "components/tools"),
      path.join(SRC_DIR, "components/ai"),
      path.join(SRC_DIR, "components/career"),
    ];

    function checkDir(dir) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDir(full);
        } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
          const content = fs.readFileSync(full, "utf-8");
          assert.ok(
            !content.includes("bg-slate-950"),
            `Found forbidden bg-slate-950 in ${full}`
          );
          assert.ok(
            !content.includes("bg-gray-950"),
            `Found forbidden bg-gray-950 in ${full}`
          );
        }
      }
    }

    for (const p of scanPaths) {
      checkDir(p);
    }
  });

  test("AI Tool Runner and AI Consent Modal use light design system", () => {
    const runnerContent = fs.readFileSync(
      path.join(SRC_DIR, "components/ai/AIToolRunner.tsx"),
      "utf-8"
    );
    assert.ok(
      runnerContent.includes("bg-white") && runnerContent.includes("border-slate-200"),
      "AIToolRunner must use white cards with slate borders"
    );
    assert.ok(
      runnerContent.includes("bg-blue-600"),
      "AIToolRunner must use Saarvi blue for primary action button"
    );

    const modalContent = fs.readFileSync(
      path.join(SRC_DIR, "components/ai/AIConsentModal.tsx"),
      "utf-8"
    );
    assert.ok(
      modalContent.includes("bg-slate-900/40 backdrop-blur-xs"),
      "AIConsentModal must use backdrop blur"
    );
    assert.ok(
      modalContent.includes("bg-white"),
      "AIConsentModal dialog must be white card"
    );
  });

  test("Document Summary and QA pages are standardized with breadcrumbs and light backgrounds", () => {
    const summaryContent = fs.readFileSync(
      path.join(SRC_DIR, "app/tools/document-summary/page.tsx"),
      "utf-8"
    );
    assert.ok(
      summaryContent.includes("aria-label=\"Breadcrumb\""),
      "document-summary must include Breadcrumbs"
    );
    assert.ok(
      summaryContent.includes("bg-[#f8fafc]"),
      "document-summary must use bg-[#f8fafc]"
    );
    assert.ok(
      !summaryContent.includes("bg-slate-950"),
      "document-summary must not have dark background"
    );

    const qaContent = fs.readFileSync(
      path.join(SRC_DIR, "app/tools/document-qa/page.tsx"),
      "utf-8"
    );
    assert.ok(
      qaContent.includes("aria-label=\"Breadcrumb\""),
      "document-qa must include Breadcrumbs"
    );
    assert.ok(
      qaContent.includes("bg-[#f8fafc]"),
      "document-qa must use bg-[#f8fafc]"
    );
  });

  test("OCR Image and PDF pages are standardized to PDF-to-JPG reference design", () => {
    const ocrImage = fs.readFileSync(
      path.join(SRC_DIR, "app/tools/ocr-image/page.tsx"),
      "utf-8"
    );
    assert.ok(
      ocrImage.includes("aria-label=\"Breadcrumb\""),
      "ocr-image must include Breadcrumbs"
    );
    assert.ok(
      ocrImage.includes("bg-[#f8fafc]"),
      "ocr-image must use light background"
    );

    const ocrPdf = fs.readFileSync(
      path.join(SRC_DIR, "app/tools/ocr-pdf/page.tsx"),
      "utf-8"
    );
    assert.ok(
      ocrPdf.includes("aria-label=\"Breadcrumb\""),
      "ocr-pdf must include Breadcrumbs"
    );
    assert.ok(
      ocrPdf.includes("bg-[#f8fafc]"),
      "ocr-pdf must use light background"
    );
  });

  test("Student Productivity tools use Saarvi blue (bg-blue-600) for active filters and primary CTAs", () => {
    const filesToCheck = [
      "app/student/hackathons/page.tsx",
      "app/student/internships/page.tsx",
      "app/student/study-planner/page.tsx",
      "app/student/certificates/page.tsx",
      "app/student/goals/page.tsx",
      "app/student/tasks/page.tsx",
      "app/student/StudentPortalView.tsx",
      "app/student/dashboard/page.tsx",
      "app/student/assignment-planner/page.tsx",
      "app/student/timetable/page.tsx",
    ];

    for (const f of filesToCheck) {
      const content = fs.readFileSync(path.join(SRC_DIR, f), "utf-8");
      assert.ok(
        content.includes("bg-blue-600"),
        `${f} should use bg-blue-600 for active accents/buttons`
      );
    }
  });

  test("Academic Calculators use consistent translucent banner styling (bg-white/15)", () => {
    const marksCalc = fs.readFileSync(
      path.join(SRC_DIR, "app/student/marks-calculator/page.tsx"),
      "utf-8"
    );
    assert.ok(
      marksCalc.includes("bg-white/15"),
      "marks-calculator must use bg-white/15 for explanation banner"
    );
    assert.ok(
      !marksCalc.includes("bg-black/15"),
      "marks-calculator must not use bg-black/15"
    );

    const attendance = fs.readFileSync(
      path.join(SRC_DIR, "app/student/attendance/page.tsx"),
      "utf-8"
    );
    assert.ok(
      attendance.includes("bg-white/15"),
      "attendance must use bg-white/15 for banner"
    );
    assert.ok(
      !attendance.includes("bg-black/15"),
      "attendance must not use bg-black/15"
    );
  });

  test("SGPA Calculator has deterministic title per university and breadcrumbs", () => {
    const sgpa = fs.readFileSync(
      path.join(SRC_DIR, "app/student/sgpa-calculator/page.tsx"),
      "utf-8"
    );
    assert.ok(
      sgpa.includes("aria-label=\"Breadcrumb\""),
      "sgpa-calculator must have Breadcrumb"
    );
    assert.ok(
      sgpa.includes("selectedUnivObj?.code === \"VTU\""),
      "sgpa-calculator must check VTU code for VTU title"
    );
    assert.ok(
      sgpa.includes("VTU SGPA Calculator"),
      "sgpa-calculator must provide VTU SGPA Calculator title"
    );
  });

  test("Career tools have breadcrumbs, standardized modal backdrops and empty states", () => {
    const resume = fs.readFileSync(
      path.join(SRC_DIR, "app/student/resume/page.tsx"),
      "utf-8"
    );
    assert.ok(
      resume.includes("aria-label=\"Breadcrumb\""),
      "resume page must have breadcrumb"
    );
    assert.ok(
      resume.includes("bg-slate-900/40 backdrop-blur-xs"),
      "resume modal must use backdrop-blur"
    );

    const coverLetter = fs.readFileSync(
      path.join(SRC_DIR, "app/student/cover-letter/page.tsx"),
      "utf-8"
    );
    assert.ok(
      coverLetter.includes("aria-label=\"Breadcrumb\""),
      "cover-letter must have breadcrumb"
    );
    assert.ok(
      coverLetter.includes("Your Name"),
      "cover-letter preview must default to Your Name"
    );

    const applications = fs.readFileSync(
      path.join(SRC_DIR, "app/student/applications/page.tsx"),
      "utf-8"
    );
    assert.ok(
      applications.includes("aria-label=\"Breadcrumb\""),
      "applications must have breadcrumb"
    );
    assert.ok(
      applications.includes("No applications tracked yet"),
      "applications must have clear 0 applications empty state"
    );
    assert.ok(
      applications.includes("bg-slate-900/40 backdrop-blur-xs"),
      "applications modals must use backdrop-blur"
    );

    const career = fs.readFileSync(
      path.join(SRC_DIR, "app/student/career/page.tsx"),
      "utf-8"
    );
    assert.ok(
      career.includes("aria-label=\"Breadcrumb\""),
      "career page must have breadcrumb"
    );
    assert.ok(
      career.includes("bg-slate-900/40 backdrop-blur-xs"),
      "career import modal must use backdrop-blur"
    );
  });

  test("ToolPageShell is available and properly exported", () => {
    const shellFile = fs.readFileSync(
      path.join(SRC_DIR, "components/tools/ToolPageShell.tsx"),
      "utf-8"
    );
    assert.ok(
      shellFile.includes("export default function ToolPageShell"),
      "ToolPageShell component must be default exported"
    );
    assert.ok(
      shellFile.includes("aria-label=\"Breadcrumb\""),
      "ToolPageShell must render breadcrumb navigation"
    );
  });
});
