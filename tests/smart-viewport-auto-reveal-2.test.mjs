import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

test("Global Smart Viewport & Auto-Reveal System 2.0 - Core System Verification", async (t) => {
  await t.test("1. action-destination.ts exports required controllers and aliases", async () => {
    const actionDestContent = fs.readFileSync(
      path.join(ROOT, "src/lib/ux/action-destination.ts"),
      "utf8"
    );

    assert.ok(
      actionDestContent.includes("SmartRevealController"),
      "Must export SmartRevealController"
    );
    assert.ok(
      actionDestContent.includes("SaarviViewportManager"),
      "Must export SaarviViewportManager"
    );
    assert.ok(
      actionDestContent.includes("ActionRevealManager"),
      "Must export ActionRevealManager"
    );
    assert.ok(
      actionDestContent.includes("revealUpload("),
      "Must provide revealUpload helper method"
    );
    assert.ok(
      actionDestContent.includes("revealResult("),
      "Must provide revealResult helper method"
    );
    assert.ok(
      actionDestContent.includes("revealError("),
      "Must provide revealError helper method"
    );
    assert.ok(
      actionDestContent.includes("revealSearch("),
      "Must provide revealSearch helper method"
    );
  });

  await t.test("2. action-destination.ts supports flexible alignment modes", async () => {
    const actionDestContent = fs.readFileSync(
      path.join(ROOT, "src/lib/ux/action-destination.ts"),
      "utf8"
    );

    assert.ok(actionDestContent.includes('"start"'), 'Must support "start" alignment');
    assert.ok(actionDestContent.includes('"center"'), 'Must support "center" alignment');
    assert.ok(actionDestContent.includes('"nearest"'), 'Must support "nearest" alignment');
    assert.ok(actionDestContent.includes('"upload"'), 'Must support "upload" mode');
  });

  await t.test("3. action-destination.ts registers all critical action destinations", async () => {
    const actionDestContent = fs.readFileSync(
      path.join(ROOT, "src/lib/ux/action-destination.ts"),
      "utf8"
    );

    const requiredKeys = [
      "tool.file.selected",
      "tool.options",
      "tool.file.error",
      "tool.process.complete",
      "calculator.calculated",
      "search.submitted",
      "resume.template.selected",
      "resume.generated",
      "coverletter.generated",
      "template.preview",
      "template.import",
      "tracker.status",
      "feedback.submitted",
      "admin.publish"
    ];

    for (const key of requiredKeys) {
      assert.ok(
        actionDestContent.includes(`"${key}"`),
        `Must register destination configuration for: ${key}`
      );
    }
  });

  await t.test("4. Standardized UX components are implemented and cleanly exported", async () => {
    const uxBarrel = fs.readFileSync(
      path.join(ROOT, "src/components/ux/index.ts"),
      "utf8"
    );

    assert.ok(uxBarrel.includes("SmartFileUpload"), "Must export SmartFileUpload");
    assert.ok(uxBarrel.includes("SmartCalculatorResult"), "Must export SmartCalculatorResult");
    assert.ok(uxBarrel.includes("SmartBuilderSection"), "Must export SmartBuilderSection");
    assert.ok(uxBarrel.includes("SmartSearchResults"), "Must export SmartSearchResults");
    assert.ok(uxBarrel.includes("ResultReadyBar"), "Must export ResultReadyBar");
    assert.ok(uxBarrel.includes("SmartResultBanner"), "Must export SmartResultBanner");

    assert.ok(
      fs.existsSync(path.join(ROOT, "src/components/ux/SmartFileUpload.tsx")),
      "SmartFileUpload component file must exist"
    );
    assert.ok(
      fs.existsSync(path.join(ROOT, "src/components/ux/SmartCalculatorResult.tsx")),
      "SmartCalculatorResult component file must exist"
    );
    assert.ok(
      fs.existsSync(path.join(ROOT, "src/components/ux/SmartBuilderSection.tsx")),
      "SmartBuilderSection component file must exist"
    );
    assert.ok(
      fs.existsSync(path.join(ROOT, "src/components/ux/SmartSearchResults.tsx")),
      "SmartSearchResults component file must exist"
    );
    assert.ok(
      fs.existsSync(path.join(ROOT, "src/components/ux/ResultReadyBar.tsx")),
      "ResultReadyBar component file must exist"
    );
  });

  await t.test("5. ToolRunner.tsx automatically reveals selected files and options without manual scrolling", async () => {
    const toolRunnerContent = fs.readFileSync(
      path.join(ROOT, "src/components/tools/ToolRunner.tsx"),
      "utf8"
    );

    // Auto reveal invocation
    assert.ok(
      toolRunnerContent.includes('globalActionController.revealUpload("#selected-file-section")'),
      "ToolRunner must call revealUpload on handleFilesAdded"
    );
    assert.ok(
      toolRunnerContent.includes('globalActionController.revealError("#tool-error")'),
      "ToolRunner must call revealError on validation errors"
    );

    // Target attributes
    assert.ok(
      toolRunnerContent.includes('id="selected-file-section"'),
      "Selected file section must have stable id"
    );
    assert.ok(
      toolRunnerContent.includes('data-saarvi-target="selected-file"'),
      "Selected file section must have data-saarvi-target attribute"
    );
    assert.ok(
      toolRunnerContent.includes('id="tool-options"'),
      "Conversion options must have stable id"
    );
    assert.ok(
      toolRunnerContent.includes('data-saarvi-target="tool-options"'),
      "Conversion options must have data-saarvi-target attribute"
    );
    assert.ok(
      toolRunnerContent.includes('id="primary-action-btn"'),
      "Primary process button must have stable id"
    );
    assert.ok(
      toolRunnerContent.includes('data-saarvi-target="primary-action"'),
      "Primary process button must have data-saarvi-target attribute"
    );
    assert.ok(
      toolRunnerContent.includes('id="tool-progress"'),
      "Processing area must have stable id"
    );
    assert.ok(
      toolRunnerContent.includes('data-saarvi-target="tool-progress"'),
      "Processing area must have data-saarvi-target attribute"
    );
    assert.ok(
      toolRunnerContent.includes('id="tool-error"'),
      "Error banner must have stable id"
    );
    assert.ok(
      toolRunnerContent.includes('data-saarvi-target="tool-error"'),
      "Error banner must have data-saarvi-target attribute"
    );
  });

  await t.test("6. FileDropzone.tsx implements auto-reveal on file drop or selection", async () => {
    const fileDropzoneContent = fs.readFileSync(
      path.join(ROOT, "src/components/common/FileDropzone.tsx"),
      "utf8"
    );

    assert.ok(
      fileDropzoneContent.includes('globalActionController.revealUpload("#dropzone-selected-files")'),
      "FileDropzone must trigger auto-reveal on file selection"
    );
    assert.ok(
      fileDropzoneContent.includes('id="dropzone-selected-files"'),
      "FileDropzone must have id=dropzone-selected-files"
    );
    assert.ok(
      fileDropzoneContent.includes('data-saarvi-target="selected-file"'),
      "FileDropzone must have data-saarvi-target=selected-file"
    );
  });

  await t.test("7. Student calculators implement auto-reveal for calculation results", async () => {
    const marksContent = fs.readFileSync(
      path.join(ROOT, "src/app/student/marks-calculator/page.tsx"),
      "utf8"
    );
    assert.ok(
      marksContent.includes('id="marks-composite-result"'),
      "Marks calculator must have composite result id"
    );
    assert.ok(
      marksContent.includes('id="marks-required-result"'),
      "Marks calculator must have required result id"
    );
    assert.ok(
      marksContent.includes('revealDestination("#marks-composite-result"'),
      "Marks calculator must auto-reveal on tab/preset change"
    );

    const sgpaContent = fs.readFileSync(
      path.join(ROOT, "src/app/student/sgpa-calculator/page.tsx"),
      "utf8"
    );
    assert.ok(
      sgpaContent.includes("revealDestination("),
      "SGPA calculator must call revealDestination on calculation"
    );

    const cgpaContent = fs.readFileSync(
      path.join(ROOT, "src/app/student/cgpa-calculator/page.tsx"),
      "utf8"
    );
    assert.ok(
      cgpaContent.includes("revealDestination("),
      "CGPA calculator must call revealDestination on calculation"
    );
  });

  await t.test("8. Application Tracker auto-reveals updated status row", async () => {
    const appTrackerContent = fs.readFileSync(
      path.join(ROOT, "src/app/student/applications/page.tsx"),
      "utf8"
    );

    assert.ok(
      appTrackerContent.includes('revealDestination(`#app-card-${app.id}, #app-row-${app.id}`'),
      "Application tracker must auto-reveal on status change"
    );
    assert.ok(
      appTrackerContent.includes('data-saarvi-target="tracker-status"'),
      "Application tracker items must have data-saarvi-target attribute"
    );
  });

  await t.test("9. Jobs and Admin Dashboard feature Action Destination UX health reporting", async () => {
    const adminToolsContent = fs.readFileSync(
      path.join(ROOT, "src/app/admin/tools/page.tsx"),
      "utf8"
    );

    assert.ok(
      adminToolsContent.includes("Action Destination UX Health"),
      "Admin Tools must include Action Destination UX Health metric"
    );
    assert.ok(
      adminToolsContent.includes("Action Destination Audit Matrix (Section 62)"),
      "Admin Tools must include Section 62 Audit Matrix"
    );
    assert.ok(
      adminToolsContent.includes("Upload → Selected File"),
      "Admin Tools must report Upload -> Selected File pass status"
    );
  });

  await t.test("10. Auto-download is strictly decoupled from viewport reveal", async () => {
    const resultDownloadContent = fs.readFileSync(
      path.join(ROOT, "src/components/common/ResultDownload.tsx"),
      "utf8"
    );

    // Auto-download triggers purely via timer, does NOT invoke window.scrollTo or viewport reveal
    assert.ok(
      !resultDownloadContent.includes("window.scrollTo"),
      "ResultDownload must not hijack window.scrollTo during auto-download countdown"
    );
  });
});
