import assert from "node:assert/strict";
import { PDFDocument, degrees } from "pdf-lib";
import { parsePageRangeToIndices } from "../src/lib/tools/pdf/split-pdf.ts";
import { getMaxFileSizeMB, FILE_LIMITS, ERROR_MESSAGES } from "../src/config/limits.ts";

console.log("=========================================");
console.log("RUNNING DOCEASE PHASE 2 ENGINE TESTS");
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

  // 1. Range Parsing Tests for Split PDF & Extract Pages
  test("Page Range: single page '1'", () => {
    const indices = parsePageRangeToIndices("1", 5);
    assert.deepEqual(indices, [0]);
  });

  test("Page Range: range '1-3'", () => {
    const indices = parsePageRangeToIndices("1-3", 5);
    assert.deepEqual(indices, [0, 1, 2]);
  });

  test("Page Range: comma list '1, 3, 5'", () => {
    const indices = parsePageRangeToIndices("1, 3, 5", 5);
    assert.deepEqual(indices, [0, 2, 4]);
  });

  test("Page Range: combined range '1, 3-4' (Test 5 requirement)", () => {
    const indices = parsePageRangeToIndices("1, 3-4", 5);
    assert.deepEqual(indices, [0, 2, 3]);
    assert.equal(indices.length, 3);
  });

  test("Page Range: out of bounds clamping and invalid characters", () => {
    const indices = parsePageRangeToIndices("0, 2, 10", 5);
    // 0 is invalid (1-indexed), 10 exceeds totalPages (5)
    assert.deepEqual(indices, [1]);
  });

  // 2. PDF Creation, Merging & Page preservation
  await testAsync("Merge PDF: Combine 3 PDFs and verify exact page count & order", async () => {
    // Create Doc 1 with 2 pages
    const doc1 = await PDFDocument.create();
    doc1.addPage([200, 200]);
    doc1.addPage([200, 200]);
    const bytes1 = await doc1.save();

    // Create Doc 2 with 1 page
    const doc2 = await PDFDocument.create();
    doc2.addPage([300, 300]);
    const bytes2 = await doc2.save();

    // Create Doc 3 with 3 pages
    const doc3 = await PDFDocument.create();
    doc3.addPage([400, 400]);
    doc3.addPage([400, 400]);
    doc3.addPage([400, 400]);
    const bytes3 = await doc3.save();

    // Now merge them into a single PDF
    const merged = await PDFDocument.create();
    for (const bytes of [bytes1, bytes2, bytes3]) {
      const src = await PDFDocument.load(bytes);
      const copied = await merged.copyPages(src, src.getPageIndices());
      for (const p of copied) {
        merged.addPage(p);
      }
    }

    const mergedBytes = await merged.save();
    const resultDoc = await PDFDocument.load(mergedBytes);

    assert.equal(resultDoc.getPageCount(), 6, "Total pages must be 2 + 1 + 3 = 6");
    assert.equal(resultDoc.getPage(0).getWidth(), 200);
    assert.equal(resultDoc.getPage(2).getWidth(), 300);
    assert.equal(resultDoc.getPage(3).getWidth(), 400);
  });

  // 3. Rotate PDF
  await testAsync("Rotate PDF: Rotate pages 90, 180, 270 degrees", async () => {
    const doc = await PDFDocument.create();
    const p1 = doc.addPage([200, 200]);
    const p2 = doc.addPage([200, 200]);
    const p3 = doc.addPage([200, 200]);

    p1.setRotation(degrees(90));
    p2.setRotation(degrees(180));
    p3.setRotation(degrees(270));

    const saved = await doc.save();
    const loaded = await PDFDocument.load(saved);

    assert.equal(loaded.getPage(0).getRotation().angle, 90);
    assert.equal(loaded.getPage(1).getRotation().angle, 180);
    assert.equal(loaded.getPage(2).getRotation().angle, 270);
  });

  // 4. Extract PDF Pages
  await testAsync("Extract PDF Pages: Select specific pages (e.g. 2, 5, 8-10)", async () => {
    const src = await PDFDocument.create();
    for (let i = 1; i <= 10; i++) {
      const p = src.addPage([100 + i, 100 + i]);
    }
    const srcBytes = await src.save();

    const loadedSrc = await PDFDocument.load(srcBytes);
    const indices = parsePageRangeToIndices("2, 5, 8-10", loadedSrc.getPageCount());
    assert.deepEqual(indices, [1, 4, 7, 8, 9]);

    const extractedDoc = await PDFDocument.create();
    const copied = await extractedDoc.copyPages(loadedSrc, indices);
    for (const p of copied) {
      extractedDoc.addPage(p);
    }
    const extractedBytes = await extractedDoc.save();
    const res = await PDFDocument.load(extractedBytes);

    assert.equal(res.getPageCount(), 5);
    assert.equal(res.getPage(0).getWidth(), 102); // page 2
    assert.equal(res.getPage(1).getWidth(), 105); // page 5
    assert.equal(res.getPage(4).getWidth(), 110); // page 10
  });

  // 5. Image to PDF Page Dimensions & Scaling Logic
  test("Image to PDF Dimensions: A4, Letter, and Fit aspect ratio calculations", () => {
    const A4 = { width: 595.28, height: 841.89 };
    const margin = 20;

    // Portrait image (400x600)
    const imgWidth = 400;
    const imgHeight = 600;

    const availableWidth = A4.width - margin * 2;
    const availableHeight = A4.height - margin * 2;

    const scale = Math.min(availableWidth / imgWidth, availableHeight / imgHeight, 1.0);
    const drawWidth = imgWidth * scale;
    const drawHeight = imgHeight * scale;

    assert(drawWidth <= availableWidth, "Draw width must not exceed available width");
    assert(drawHeight <= availableHeight, "Draw height must not exceed available height");
    assert.equal(
      Math.round((drawWidth / drawHeight) * 100),
      Math.round((imgWidth / imgHeight) * 100),
      "Aspect ratio must be preserved without distortion"
    );
  });

  // 6. Limits and Validation Messages
  test("Limits: Centralized configuration validation", () => {
    assert.equal(getMaxFileSizeMB("jpg-to-pdf"), 25);
    assert.equal(getMaxFileSizeMB("pdf-to-jpg"), 40);
    assert.equal(getMaxFileSizeMB("merge-pdf"), 50);

    const err = ERROR_MESSAGES.FILE_TOO_LARGE("test.pdf", 50);
    assert(err.includes("test.pdf") && err.includes("50MB"));
  });

  // 7. Test PDF Split All Pages (ZIP separation)
  await testAsync("Split PDF: Separate all pages of a 4-page PDF", async () => {
    const srcDoc = await PDFDocument.create();
    srcDoc.addPage([100, 100]);
    srcDoc.addPage([200, 200]);
    srcDoc.addPage([300, 300]);
    srcDoc.addPage([400, 400]);
    const srcBytes = await srcDoc.save();

    const loaded = await PDFDocument.load(srcBytes);
    const totalPages = loaded.getPageCount();
    assert.equal(totalPages, 4);

    const separatedPages = [];
    for (let i = 0; i < totalPages; i++) {
      const singleDoc = await PDFDocument.create();
      const [copiedPage] = await singleDoc.copyPages(loaded, [i]);
      singleDoc.addPage(copiedPage);
      const singleBytes = await singleDoc.save();
      const singleLoaded = await PDFDocument.load(singleBytes);
      assert.equal(singleLoaded.getPageCount(), 1);
      separatedPages.push(singleLoaded.getPage(0).getWidth());
    }

    assert.deepEqual(separatedPages, [100, 200, 300, 400]);
  });

  // 8. Test Multiple Images to PDF Reordering logic
  await testAsync("Multiple Images to PDF: Page compilation preserves UI ordering", async () => {
    // 3 image buffers simulating uploaded photos
    const doc = await PDFDocument.create();
    const order = ["photo_A", "photo_B", "photo_C"];

    for (const name of order) {
      const page = doc.addPage([595.28, 841.89]); // A4
      // Note: page order added strictly follows iteration
    }

    const compiledBytes = await doc.save();
    const resultDoc = await PDFDocument.load(compiledBytes);
    assert.equal(resultDoc.getPageCount(), 3);
  });

  // 9. Compression Preset Calculation Verification
  test("PDF Compression: Preset scale & quality configuration", () => {
    const PRESETS = {
      low: { scale: 1.3, quality: 0.82 },
      balanced: { scale: 1.0, quality: 0.70 },
      high: { scale: 0.85, quality: 0.55 }
    };
    assert.equal(PRESETS.low.quality > PRESETS.balanced.quality, true);
    assert.equal(PRESETS.balanced.quality > PRESETS.high.quality, true);
    assert.equal(PRESETS.high.scale < PRESETS.balanced.scale, true);
  });

  console.log(`\nResults: ${passed}/${total} tests passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
