import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('1. Navbar Essential Tools Audit - Compress PDF replaces PDF to Excel', () => {
  const navbarPath = path.join(projectRoot, 'src/components/layout/Navbar.tsx');
  const navbarContent = fs.readFileSync(navbarPath, 'utf8');

  // Verify DEFAULT_ESSENTIAL_TOOLS includes compress-pdf and excludes pdf-to-excel
  const essentialMatch = navbarContent.match(/DEFAULT_ESSENTIAL_TOOLS\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(essentialMatch, 'DEFAULT_ESSENTIAL_TOOLS constant must exist in Navbar.tsx');
  const essentials = essentialMatch[1];
  assert.ok(essentials.includes("'compress-pdf'"), "DEFAULT_ESSENTIAL_TOOLS must contain 'compress-pdf'");
  assert.ok(!essentials.includes("'pdf-to-excel'"), "DEFAULT_ESSENTIAL_TOOLS must NOT contain 'pdf-to-excel'");

  // Verify navigation-store.ts isFeatured list
  const navStorePath = path.join(projectRoot, 'src/lib/navigation/navigation-store.ts');
  const navStoreContent = fs.readFileSync(navStorePath, 'utf8');
  assert.ok(navStoreContent.includes("'compress-pdf'"), "navigation-store.ts must feature 'compress-pdf'");
  assert.ok(!navStoreContent.includes("'pdf-to-excel'"), "navigation-store.ts must NOT feature 'pdf-to-excel'");

  // Verify tool-discovery-service fallbackKeys
  const discServicePath = path.join(projectRoot, 'src/lib/navigation/tool-discovery-service.ts');
  const discContent = fs.readFileSync(discServicePath, 'utf8');
  const fallbackMatch = discContent.match(/fallbackKeys\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(fallbackMatch, 'fallbackKeys must exist in tool-discovery-service.ts');
  assert.ok(fallbackMatch[1].includes("'compress-pdf'"), "fallbackKeys must feature 'compress-pdf'");
  assert.ok(!fallbackMatch[1].includes("'pdf-to-excel'"), "fallbackKeys must NOT feature 'pdf-to-excel'");
});

test('2. Retired and Consolidated Tools removed from CANONICAL_TOOL_REGISTRY', () => {
  const registryPath = path.join(projectRoot, 'src/lib/tools/tool-registry.ts');
  const registryContent = fs.readFileSync(registryPath, 'utf8');

  // Retired student tools
  assert.ok(!registryContent.includes("key: 'academic-goals'"), "academic-goals must be retired from CANONICAL_TOOL_REGISTRY");
  assert.ok(!registryContent.includes("key: 'assignment-tracker'"), "assignment-tracker must be retired from CANONICAL_TOOL_REGISTRY");
  assert.ok(!registryContent.includes("key: 'student-notes'"), "student-notes must be retired from CANONICAL_TOOL_REGISTRY");
  assert.ok(!registryContent.includes("key: 'certificate-manager'"), "certificate-manager must be retired from CANONICAL_TOOL_REGISTRY");

  // Retired overlapping scan tools
  assert.ok(!registryContent.includes("key: 'scan-to-pdf'"), "scan-to-pdf must be retired from CANONICAL_TOOL_REGISTRY");
  assert.ok(!registryContent.includes("key: 'photo-to-document'"), "photo-to-document must be retired from CANONICAL_TOOL_REGISTRY");
  assert.ok(registryContent.includes("key: 'document-scanner'"), "document-scanner must be active in CANONICAL_TOOL_REGISTRY");

  // Discontinued image tools
  assert.ok(!registryContent.includes("key: 'svg-to-png'"), "svg-to-png must be retired from CANONICAL_TOOL_REGISTRY");
  assert.ok(!registryContent.includes("key: 'heic-to-jpg'"), "heic-to-jpg must be retired from CANONICAL_TOOL_REGISTRY");
});

test('3. Permanent 301 Redirects configured in next.config.ts', () => {
  const nextConfigPath = path.join(projectRoot, 'next.config.ts');
  const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf8');

  // Scan tool redirects
  assert.ok(nextConfigContent.includes('"/scan-to-pdf"'), "Must redirect /scan-to-pdf");
  assert.ok(nextConfigContent.includes('"/tools/document-scanner"'), "Must redirect to /tools/document-scanner");
  assert.ok(nextConfigContent.includes("permanent: true"), "Redirects must be permanent (301)");

  // Image tool redirects
  assert.ok(nextConfigContent.includes('"/heic-to-jpg"'), "Must redirect /heic-to-jpg");
  assert.ok(nextConfigContent.includes('"/svg-to-png"'), "Must redirect /svg-to-png");
  assert.ok(nextConfigContent.includes('"/tools?category=image"'), "Must redirect to /tools?category=image");

  // Student tool redirects
  assert.ok(nextConfigContent.includes('"/student/goals"'), "Must redirect /student/goals");
  assert.ok(nextConfigContent.includes('"/student/certificates"'), "Must redirect /student/certificates");
  assert.ok(nextConfigContent.includes('"/student/assignments"'), "Must redirect /student/assignments");
  assert.ok(nextConfigContent.includes('"/student/notes"'), "Must redirect /student/notes");
  assert.ok(nextConfigContent.includes('destination: "/student"'), "Must redirect student tools to /student");
});

test('4. Access Control Single Source of Truth for PRO vs Free Tools', () => {
  const accessControlPath = path.join(projectRoot, 'src/lib/tools/access-control.ts');
  const accessControlContent = fs.readFileSync(accessControlPath, 'utf8');

  // PRO access tools
  assert.ok(accessControlContent.includes("'student-copilot': 'PRO'"), "student-copilot must be PRO in DEFAULT_TOOL_ACCESS_MODES");
  assert.ok(accessControlContent.includes("'copilot-interview': 'PRO'"), "copilot-interview must be PRO in DEFAULT_TOOL_ACCESS_MODES");

  // Free tools
  assert.ok(accessControlContent.includes("'ocr-pdf': 'PUBLIC_FREE'"), "ocr-pdf must be PUBLIC_FREE in DEFAULT_TOOL_ACCESS_MODES");
  assert.ok(accessControlContent.includes("'ocr-image': 'PUBLIC_FREE'"), "ocr-image must be PUBLIC_FREE in DEFAULT_TOOL_ACCESS_MODES");
});

test('5. OCR PDF Tool Error Repair and Pre-flight Validations', () => {
  const ocrPdfPagePath = path.join(projectRoot, 'src/app/tools/ocr-pdf/page.tsx');
  const ocrContent = fs.readFileSync(ocrPdfPagePath, 'utf8');

  // Pre-flight validation
  assert.ok(ocrContent.includes("if (!file)"), "OCR PDF must check for file presence in handleExecute");
  assert.ok(ocrContent.includes("No PDF selected"), "OCR PDF must show pre-flight error message if missing");
  assert.ok(ocrContent.includes("disabled={!file || disabled}"), "OCR PDF submit button must be disabled when no file is chosen");

  // AIToolRunner error handling resilience
  const runnerPath = path.join(projectRoot, 'src/components/ai/AIToolRunner.tsx');
  const runnerContent = fs.readFileSync(runnerPath, 'utf8');
  assert.ok(runnerContent.includes('state === "ERROR"'), "AIToolRunner must handle ERROR state");
  assert.ok(runnerContent.includes('Processing Issue'), "AIToolRunner must display actionable Processing Issue banner");
  assert.ok(runnerContent.includes('inputRender({'), "AIToolRunner must keep input controls accessible on error");
});

test('6. Saarvi Proactive AI Welcome Assistant Verification', () => {
  const proactivePath = path.join(projectRoot, 'src/components/ai/SaarviProactiveAssistant.tsx');
  assert.ok(fs.existsSync(proactivePath), "SaarviProactiveAssistant.tsx must exist");
  const proactiveContent = fs.readFileSync(proactivePath, 'utf8');

  // 5s inactivity timer
  assert.ok(proactiveContent.includes("INACTIVITY_DELAY_MS = 5000"), "Must define 5000ms inactivity window");
  assert.ok(proactiveContent.includes("setTimeout"), "Must use timer for delay");

  // Interaction cancel triggers
  assert.ok(proactiveContent.includes("pointerdown"), "Must cancel on pointerdown");
  assert.ok(proactiveContent.includes("keydown"), "Must cancel on keydown");
  assert.ok(proactiveContent.includes("scroll"), "Must cancel on scroll");

  // Session storage flags
  assert.ok(proactiveContent.includes("saarvi_proactive_welcomed"), "Must track welcomed flag in sessionStorage");
  assert.ok(proactiveContent.includes("saarvi_proactive_dismissed"), "Must track dismissed flag in sessionStorage");

  // Excluded routes
  assert.ok(proactiveContent.includes("/admin"), "Must exclude admin routes");
  assert.ok(proactiveContent.includes("/login"), "Must exclude login route");
  assert.ok(proactiveContent.includes("/signup"), "Must exclude signup route");

  // Custom event trigger
  assert.ok(proactiveContent.includes("saarvi:open-assistant"), "Must dispatch saarvi:open-assistant event");

  // Layout integration
  const layoutPath = path.join(projectRoot, 'src/app/layout.tsx');
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');
  assert.ok(layoutContent.includes("<SaarviProactiveAssistant />"), "SaarviProactiveAssistant must be mounted in RootLayout");

  // GlobalAIAssistant listener
  const globalAiPath = path.join(projectRoot, 'src/components/ai/GlobalAIAssistant.tsx');
  const globalAiContent = fs.readFileSync(globalAiPath, 'utf8');
  assert.ok(globalAiContent.includes("saarvi:open-assistant"), "GlobalAIAssistant must listen to saarvi:open-assistant");
});
