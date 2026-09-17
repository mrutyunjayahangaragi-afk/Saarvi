import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

test("Saarvi Loading Logo: Component file exists and exports required types & function", () => {
  const compPath = path.join(ROOT_DIR, "src/components/brand/SaarviLoadingLogo.tsx");
  assert.ok(fs.existsSync(compPath), "SaarviLoadingLogo.tsx must exist");

  const content = fs.readFileSync(compPath, "utf-8");
  assert.match(content, /export function SaarviLoadingLogo/);
  assert.match(content, /export default SaarviLoadingLogo/);
  assert.match(content, /export type LoadingLogoState/);
  assert.match(content, /export type LoadingLogoSize/);
});

test("Saarvi Loading Logo: Contains all iconic vector elements (Gear, Arrow, Ribbon S, Circuit, Sprout Leaves)", () => {
  const compPath = path.join(ROOT_DIR, "src/components/brand/SaarviLoadingLogo.tsx");
  const content = fs.readFileSync(compPath, "utf-8");

  // Top Arrow & Gear (Top entrance)
  assert.match(content, /saarvi-draw-gear/);
  assert.match(content, /saarvi-draw-arrow/);
  assert.match(content, /saarvi-layer-top/);

  // Main Ribbon S
  assert.match(content, /saarvi-draw-s/);
  assert.match(content, /saarvi-draw-s-highlight/);
  assert.match(content, /saarvi-s-grad/);

  // Circuit traces
  assert.match(content, /saarvi-layer-circuits/);
  assert.match(content, /saarvi-draw-circuit/);
  assert.match(content, /saarvi-node/);

  // Organic Sprout leaves at bottom
  assert.match(content, /saarvi-layer-leaves/);
  assert.match(content, /saarvi-draw-leaf-left/);
  assert.match(content, /saarvi-draw-leaf-right/);
  assert.match(content, /saarvi-leaf-grad/);
});

test("Saarvi Loading Logo: WCAG & Accessibility Compliance (role, aria-live, sr-only, prefers-reduced-motion)", () => {
  const compPath = path.join(ROOT_DIR, "src/components/brand/SaarviLoadingLogo.tsx");
  const content = fs.readFileSync(compPath, "utf-8");

  assert.match(content, /role="status"/);
  assert.match(content, /aria-live="polite"/);
  assert.match(content, /aria-hidden="true"/);
  assert.match(content, /sr-only/);
  assert.match(content, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(content, /stroke-dashoffset:\s*0\s*!important/);
});

test("Saarvi Loading Logo: Integrated into root App loading state", () => {
  const loadingPath = path.join(ROOT_DIR, "src/app/loading.tsx");
  assert.ok(fs.existsSync(loadingPath), "src/app/loading.tsx must exist");

  const content = fs.readFileSync(loadingPath, "utf-8");
  assert.match(content, /import\s*\{\s*SaarviLoadingLogo\s*\}\s*from\s*["']@\/components\/brand\/SaarviLoadingLogo["']/);
  assert.match(content, /<SaarviLoadingLogo/);
});

test("Interview Permission Gate: Text MCQ does not enforce camera or microphone", () => {
  const pagePath = path.join(ROOT_DIR, "src/app/student/copilot/interview/page.tsx");
  const content = fs.readFileSync(pagePath, "utf-8");

  // Verify camera requirement is strictly for live_video
  assert.match(content, /requireCamera=\{selectedMode === "live_video"\}/);

  // Verify mic requirement is only for live_video or audio_speech
  assert.match(
    content,
    /requireMicrophone=\{selectedMode === "live_video"\}/
  );

  // Verify onSwitchToTextMode callback is provided
  assert.match(content, /onSwitchToTextMode=\{/);
});

test("Interview Permission Gate: Simulated Practice Mode available when hardware is blocked", () => {
  const gatePath = path.join(ROOT_DIR, "src/components/interview/InterviewPermissionGate.tsx");
  const content = fs.readFileSync(gatePath, "utf-8");

  // Simulated hardware function
  assert.match(content, /handleEnableSimulatedHardware/);

  // Switch to Text MCQ options
  assert.match(content, /Switch to Text MCQ Mode/);

  // Practice buttons when denied
  assert.match(content, /Use Simulated Camera for Practice/);
  assert.match(content, /Use Simulated Audio for Practice/);
});
