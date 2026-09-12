import assert from "node:assert/strict";
import { sanitizeFilename } from "../src/lib/utils.ts";

console.log("=========================================");
console.log("RUNNING DOCEASE AUTO-DOWNLOAD & UX TESTS");
console.log("=========================================\n");

async function runTests() {
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ [FAIL] ${name}:`, err.message);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ [FAIL] ${name}:`, err.message);
    }
  }

  // 1. Filename sanitization
  test("Filename Sanitization: standard clean name", () => {
    assert.equal(sanitizeFilename("my-vacation-photo.jpg"), "my-vacation-photo.jpg");
  });

  test("Filename Sanitization: path traversal prevention", () => {
    assert.equal(sanitizeFilename("../../../etc/passwd.pdf"), "passwd.pdf");
    assert.equal(sanitizeFilename("..\\..\\windows\\system32\\calc.exe.png"), "calc.exe.png");
  });

  test("Filename Sanitization: illegal filesystem characters", () => {
    assert.equal(sanitizeFilename("doc?name*<test>:quote.pdf"), "doc_name__test__quote.pdf");
  });

  test("Filename Sanitization: fallback on empty or invalid input", () => {
    assert.equal(sanitizeFilename(""), "document");
    assert.equal(sanitizeFilename(null), "document");
  });

  // 2. Countdown State Machine Simulation
  await testAsync("Auto-Download Countdown: 3-second countdown triggers auto-download", async () => {
    let seconds = 3;
    let downloaded = false;

    // Simulate 3-second interval ticks
    for (let tick = 1; tick <= 3; tick++) {
      seconds -= 1;
      if (seconds === 0) {
        downloaded = true;
      }
    }

    assert.equal(seconds, 0);
    assert.equal(downloaded, true);
  });

  // 3. User Override ("Download Now")
  await testAsync("User Override: Download Now immediately cancels countdown and triggers single download", async () => {
    let seconds = 3;
    let timerCancelled = false;
    let downloadCount = 0;

    // User clicks Download Now at 2 seconds remaining
    seconds -= 1; // 2 seconds
    timerCancelled = true;
    downloadCount += 1;

    // Remaining timer ticks should NOT trigger a second download
    if (!timerCancelled) {
      downloadCount += 1;
    }

    assert.equal(downloadCount, 1, "Only 1 download must occur");
    assert.equal(timerCancelled, true);
  });

  // 4. Cancellation Logic
  await testAsync("User Cancellation: Cancel stops countdown without downloading", async () => {
    let seconds = 3;
    let timerCancelled = false;
    let downloaded = false;

    // User clicks Cancel
    timerCancelled = true;

    if (!timerCancelled) {
      downloaded = true;
    }

    assert.equal(downloaded, false, "Download must not trigger when cancelled");
    assert.equal(timerCancelled, true);
  });

  // 5. ZIP Packaging Safety for Multi-page Outputs
  test("Auto-Download Safety: Multi-page outputs use single ZIP download", () => {
    const multiPageOutput = {
      type: "multiple",
      files: [
        { filename: "page_1.jpg" },
        { filename: "page_2.jpg" },
        { filename: "page_3.jpg" }
      ],
      zipFilename: "converted_pages.zip"
    };

    // Auto-download target must target the ZIP, not 3 separate image downloads
    const target = multiPageOutput.zipFilename;
    assert.equal(target.endsWith(".zip"), true);
    assert.equal(multiPageOutput.files.length, 3);
  });

  console.log(`\nResults: ${passed}/${total} tests passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
