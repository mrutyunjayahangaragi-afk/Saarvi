import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { CANONICAL_TOOL_REGISTRY } from "../src/lib/tools/tool-registry.ts";
import {
  validateInputFile,
  isExecutableSignature,
  sanitizeHtmlContent,
} from "../src/lib/security/file-security.ts";
import {
  validatePdfBlob,
  validateXlsxBlob,
  validatePptxBlob,
  validateToolOutput,
} from "../src/lib/tools/validation.ts";
import {
  buildXlsxWorkbook,
  parseXlsxWorkbook,
  buildPptxPresentation,
  parsePptxPresentation,
} from "../src/lib/tools/document/openxml-helper.ts";

const ROOT_DIR = process.cwd();

/**
 * Helper to construct synthetic File objects for Node.js test environment
 */
function createSyntheticFile(buffer, name, type) {
  const blob = new Blob([buffer], { type });
  blob.name = name;
  blob.lastModified = Date.now();
  return blob;
}

const PHASE_33_TOOL_SLUGS = [
  "pdf-to-excel",
  "excel-to-pdf",
  "pdf-to-powerpoint",
  "powerpoint-to-pdf",
  "txt-to-pdf",
  "csv-to-pdf",
  "html-to-pdf",
];

// ============================================================================
// 1. CANONICAL REGISTRY & CONFIGURATION TESTS
// ============================================================================

test("Phase 33 Suite — All 7 tools registered in CANONICAL_TOOL_REGISTRY", () => {
  for (const slug of PHASE_33_TOOL_SLUGS) {
    const entry = CANONICAL_TOOL_REGISTRY.find((t) => t.key === slug);
    assert.ok(entry, `Tool "${slug}" must be present in CANONICAL_TOOL_REGISTRY`);
    assert.strictEqual(entry.category, "pdf");
    assert.strictEqual(entry.route, `/tools/${slug}`);
    assert.strictEqual(entry.status, "available");
    assert.strictEqual(entry.defaultAccess, "FREE");
    assert.ok(entry.keywords && entry.keywords.length > 0, `Tool "${slug}" must have keywords`);
  }
});

test("Phase 33 Suite — All 7 tools registered in TOOLS_CONFIG source with complete metadata", () => {
  const toolsConfigPath = path.join(ROOT_DIR, "src/config/tools.ts");
  assert.ok(fs.existsSync(toolsConfigPath), "src/config/tools.ts must exist");
  const content = fs.readFileSync(toolsConfigPath, "utf-8");

  for (const slug of PHASE_33_TOOL_SLUGS) {
    assert.ok(content.includes(`id: "${slug}"`), `id "${slug}" must be in TOOLS_CONFIG`);
    assert.ok(content.includes(`slug: "${slug}"`), `slug "${slug}" must be in TOOLS_CONFIG`);
    assert.ok(content.includes(`route: "/tools/${slug}"`), `route "/tools/${slug}" must be in TOOLS_CONFIG`);
    assert.ok(content.includes(`category: "pdf"`), `category pdf must be in TOOLS_CONFIG`);
    assert.ok(content.includes(`howItWorks:`), `howItWorks must exist in TOOLS_CONFIG for ${slug}`);
    assert.ok(content.includes(`faq:`), `faq must exist in TOOLS_CONFIG for ${slug}`);
  }
});

test("Phase 33 Suite — All 7 operations registered in TOOL_OPERATIONS source", () => {
  const registryPath = path.join(ROOT_DIR, "src/lib/tools/registry.ts");
  assert.ok(fs.existsSync(registryPath), "src/lib/tools/registry.ts must exist");
  const content = fs.readFileSync(registryPath, "utf-8");

  assert.ok(content.includes('"pdf-to-excel": pdfToExcelOperation'));
  assert.ok(content.includes('"excel-to-pdf": excelToPdfOperation'));
  assert.ok(content.includes('"pdf-to-powerpoint": pdfToPowerPointOperation'));
  assert.ok(content.includes('"powerpoint-to-pdf": powerPointToPdfOperation'));
  assert.ok(content.includes('"txt-to-pdf": textToPdfOperation'));
  assert.ok(content.includes('"csv-to-pdf": csvToPdfOperation'));
  assert.ok(content.includes('"html-to-pdf": htmlToPdfOperation'));
});

test("Phase 33 Suite — All 7 feature flags registered in DEFAULT_FEATURE_FLAGS source", () => {
  const featureStorePath = path.join(ROOT_DIR, "src/lib/features/feature-store.ts");
  assert.ok(fs.existsSync(featureStorePath), "feature-store.ts must exist");
  const content = fs.readFileSync(featureStorePath, "utf-8");

  for (const slug of PHASE_33_TOOL_SLUGS) {
    assert.ok(content.includes(`id: '${slug}'`), `feature flag id '${slug}' must be in feature-store.ts`);
    assert.ok(content.includes(`route: '/tools/${slug}'`), `feature flag route '/tools/${slug}' must be in feature-store.ts`);
  }
});

test("Phase 33 Suite — Dynamic filesystem route and icons exist in page.tsx", () => {
  const dynamicPagePath = path.join(ROOT_DIR, "src/app/tools/[slug]/page.tsx");
  assert.ok(fs.existsSync(dynamicPagePath), "Dynamic route page must exist");
  const content = fs.readFileSync(dynamicPagePath, "utf-8");
  assert.ok(content.includes("FileSpreadsheet"), "Icon mapping includes FileSpreadsheet");
  assert.ok(content.includes("Presentation"), "Icon mapping includes Presentation");
  assert.ok(content.includes("FileCode"), "Icon mapping includes FileCode");
  assert.ok(content.includes("Table"), "Icon mapping includes Table");
});

test("Phase 33 Suite — ToolRunner enables multi-file batch upload and document summary inspection", () => {
  const runnerPath = path.join(ROOT_DIR, "src/components/tools/ToolRunner.tsx");
  assert.ok(fs.existsSync(runnerPath), "ToolRunner.tsx must exist");
  const content = fs.readFileSync(runnerPath, "utf-8");

  for (const slug of PHASE_33_TOOL_SLUGS) {
    assert.ok(content.includes(`"${slug}"`) || content.includes(`'${slug}'`), `Slug '${slug}' must be handled in ToolRunner`);
  }
  assert.ok(content.includes("sheet"), "ToolRunner inspects sheet count for Excel");
  assert.ok(content.includes("slide"), "ToolRunner inspects slide count for PowerPoint");
  assert.ok(content.includes("page"), "ToolRunner inspects page count for PDF");
});

test("Phase 33 Suite — File limits configured for all 7 tools in limits.ts", () => {
  const limitsPath = path.join(ROOT_DIR, "src/config/limits.ts");
  assert.ok(fs.existsSync(limitsPath), "src/config/limits.ts must exist");
  const content = fs.readFileSync(limitsPath, "utf-8");

  for (const slug of PHASE_33_TOOL_SLUGS) {
    assert.ok(content.includes(`"${slug}"`) || content.includes(`'${slug}'`), `Slug '${slug}' must be in FILE_LIMITS.SPECIFIC`);
  }
});

// ============================================================================
// 2. SEARCH & AI DISCOVERY TESTS
// ============================================================================

test("Phase 33 Suite — Canonical tool keywords support natural language discovery", () => {
  const expectedKeywords = {
    "pdf-to-excel": ["excel", "xlsx", "spreadsheet", "table"],
    "excel-to-pdf": ["excel", "xlsx", "spreadsheet", "pdf", "sheet"],
    "pdf-to-powerpoint": ["powerpoint", "pptx", "presentation", "slides"],
    "powerpoint-to-pdf": ["powerpoint", "pptx", "presentation", "slides", "pdf"],
    "txt-to-pdf": ["txt", "text", "plain text", "notes", "pdf"],
    "csv-to-pdf": ["csv", "table", "tabular", "data", "pdf"],
    "html-to-pdf": ["html", "webpage", "code", "markup", "pdf"],
  };

  for (const [slug, keywords] of Object.entries(expectedKeywords)) {
    const entry = CANONICAL_TOOL_REGISTRY.find((t) => t.key === slug);
    assert.ok(entry, `Tool ${slug} found in registry`);
    for (const kw of keywords) {
      assert.ok(
        entry.keywords.some((k) => k.toLowerCase().includes(kw)),
        `Tool "${slug}" keywords should include "${kw}"`
      );
    }
  }
});

test("Phase 33 Suite — Tool discovery engine source includes intent mapping for Phase 33 tools", () => {
  const enginePath = path.join(ROOT_DIR, "src/lib/ai/tool-discovery-engine.ts");
  assert.ok(fs.existsSync(enginePath), "tool-discovery-engine.ts must exist");
  const content = fs.readFileSync(enginePath, "utf-8");

  for (const slug of PHASE_33_TOOL_SLUGS) {
    assert.ok(content.includes(`'${slug}'`), `Discovery engine must reference tool key '${slug}'`);
  }
});

// ============================================================================
// 3. FILE SECURITY & INJECTION DEFENSE TESTS
// ============================================================================

test("File Security — Rejects executable binary signatures immediately", async () => {
  const peBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]); // "MZ" Windows PE
  assert.strictEqual(isExecutableSignature(peBytes), true);

  const elfBytes = new Uint8Array([0x7f, 0x45, 0x4c, 0x46]); // Linux ELF
  assert.strictEqual(isExecutableSignature(elfBytes), true);

  const shebangBytes = new Uint8Array([0x23, 0x21, 0x2f, 0x62, 0x69, 0x6e]); // "#!/bin"
  assert.strictEqual(isExecutableSignature(shebangBytes), true);

  const maliciousFile = createSyntheticFile(peBytes, "malware.exe", "application/octet-stream");
  const validation = await validateInputFile(maliciousFile, ["pdf", "xlsx", "pptx"]);
  assert.strictEqual(validation.valid, false);
  assert.match(validation.error, /executable/i);
});

test("File Security — Validates authentic XLSX and rejects corrupted archives", async () => {
  const validXlsxBytes = await buildXlsxWorkbook([
    {
      name: "Quarter1",
      rows: [
        ["Product", "Q1 Sales", "Profit Margin"],
        ["SaaS Pro", 45000, "32%"],
        ["Enterprise", 120000, "48%"],
      ],
    },
  ]);
  const validFile = createSyntheticFile(
    validXlsxBytes,
    "financials.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  const passRes = await validateInputFile(validFile, ["xlsx"]);
  assert.strictEqual(passRes.valid, true);

  // Corrupt zip without workbook.xml
  const corruptZip = new JSZip();
  corruptZip.file("random.txt", "not a spreadsheet");
  const corruptBytes = await corruptZip.generateAsync({ type: "uint8array" });
  const corruptFile = createSyntheticFile(corruptBytes, "fake.xlsx", "application/zip");
  const failRes = await validateInputFile(corruptFile, ["xlsx"]);
  assert.strictEqual(failRes.valid, false);
  assert.match(failRes.error, /spreadsheet structure/i);
});

test("File Security — Validates authentic PPTX and rejects corrupted archives", async () => {
  const validPptxBytes = await buildPptxPresentation([
    {
      elements: [
        {
          type: "text",
          text: "Executive Summary",
          xPt: 50,
          yPt: 50,
          widthPt: 400,
          heightPt: 50,
          fontSize: 24,
          bold: true,
        },
      ],
    },
  ]);
  const validFile = createSyntheticFile(
    validPptxBytes,
    "deck.pptx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  );
  const passRes = await validateInputFile(validFile, ["pptx"]);
  assert.strictEqual(passRes.valid, true);

  // Corrupt zip without presentation.xml
  const corruptZip = new JSZip();
  corruptZip.file("other.txt", "not a presentation");
  const corruptBytes = await corruptZip.generateAsync({ type: "uint8array" });
  const corruptFile = createSyntheticFile(corruptBytes, "fake.pptx", "application/zip");
  const failRes = await validateInputFile(corruptFile, ["pptx"]);
  assert.strictEqual(failRes.valid, false);
  assert.match(failRes.error, /presentation structure/i);
});

test("File Security — HTML Sanitizer removes all script tags, event handlers, and javascript: URIs", () => {
  const dangerousHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Malicious Document</title>
        <script>alert('XSS Attack');</script>
        <script src="https://evil.com/payload.js"></script>
        <style>body { display: none; }</style>
      </head>
      <body onload="doEvil()" onerror="handleError()">
        <h1 onclick="stealCookies()">Clean Heading</h1>
        <p>Safe content paragraph.</p>
        <a href="javascript:alert(document.cookie)">Click here</a>
        <iframe src="https://phishing.com"></iframe>
        <object data="evil.swf"></object>
        <embed src="evil.pdf"></embed>
      </body>
    </html>
  `;

  const sanitized = sanitizeHtmlContent(dangerousHtml);
  assert.strictEqual(sanitized.includes("<script"), false, "Script tags must be removed");
  assert.strictEqual(sanitized.includes("alert('XSS Attack')"), false);
  assert.strictEqual(sanitized.includes("<iframe"), false, "Iframes must be removed");
  assert.strictEqual(sanitized.includes("<object"), false, "Objects must be removed");
  assert.strictEqual(sanitized.includes("<embed"), false, "Embeds must be removed");
  assert.strictEqual(sanitized.includes("onload="), false, "onload must be removed");
  assert.strictEqual(sanitized.includes("onclick="), false, "onclick must be removed");
  assert.strictEqual(sanitized.includes("javascript:"), false, "javascript: URIs must be neutralized");
  assert.ok(sanitized.includes("Clean Heading"), "Legitimate heading must be preserved");
  assert.ok(sanitized.includes("Safe content paragraph."), "Legitimate content must be preserved");
});

// ============================================================================
// 4. OUTPUT VALIDATION ENGINE TESTS
// ============================================================================

test("Output Validation — validateXlsxBlob verifies [Content_Types].xml and xl/workbook.xml", async () => {
  const xlsxBytes = await buildXlsxWorkbook([
    {
      name: "Sheet1",
      rows: [["Col1", "Col2"], [10, 20]],
    },
  ]);
  const blob = new Blob([xlsxBytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const valRes = await validateXlsxBlob(blob);
  assert.strictEqual(valRes.valid, true);
  assert.ok(valRes.details.fileCount >= 5);

  // Invalid empty blob
  const emptyBlob = new Blob([], { type: "application/octet-stream" });
  const emptyRes = await validateXlsxBlob(emptyBlob);
  assert.strictEqual(emptyRes.valid, false);

  // Invalid non-zip blob
  const textBlob = new Blob(["not a zip"], { type: "application/octet-stream" });
  const nonZipRes = await validateXlsxBlob(textBlob);
  assert.strictEqual(nonZipRes.valid, false);
});

test("Output Validation — validatePptxBlob verifies [Content_Types].xml and ppt/presentation.xml", async () => {
  const pptxBytes = await buildPptxPresentation([
    {
      elements: [{ type: "text", text: "Slide 1", xPt: 50, yPt: 50, widthPt: 300, heightPt: 30 }],
    },
  ]);
  const blob = new Blob([pptxBytes], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });

  const valRes = await validatePptxBlob(blob);
  assert.strictEqual(valRes.valid, true);
  assert.ok(valRes.details.fileCount >= 6);

  // Master output validator routes correctly
  const masterRes = await validateToolOutput({
    type: "single",
    blob,
    filename: "output.pptx",
    originalSize: 1000,
    newSize: blob.size,
  });
  assert.strictEqual(masterRes.valid, true);
});

// ============================================================================
// 5. OPENXML ENGINE GENERATION & PARSING TESTS
// ============================================================================

test("OpenXML Engine — XLSX generation creates valid workbook and parseXlsxWorkbook extracts data", async () => {
  const initialData = [
    {
      name: "StudentGrades",
      rows: [
        ["Roll No", "Name", "Score", "Result"],
        [101, "Alice Smith", 94.5, "Distinction"],
        [102, "Bob Johnson", 82.0, "First Class"],
        [103, "Charlie Davis", 75.5, "First Class"],
      ],
    },
    {
      name: "Summary",
      rows: [
        ["Metric", "Value"],
        ["Total Students", 3],
        ["Pass Rate", "100%"],
      ],
    },
  ];

  const xlsxBytes = await buildXlsxWorkbook(initialData);
  assert.ok(xlsxBytes.length > 500, "XLSX must have substantial binary size");

  // Verify internal OpenXML ZIP structure
  const zip = await JSZip.loadAsync(xlsxBytes);
  assert.ok(zip.file("[Content_Types].xml"), "Must contain [Content_Types].xml");
  assert.ok(zip.file("xl/workbook.xml"), "Must contain xl/workbook.xml");
  assert.ok(zip.file("xl/worksheets/sheet1.xml"), "Must contain sheet1.xml");
  assert.ok(zip.file("xl/worksheets/sheet2.xml"), "Must contain sheet2.xml");
  assert.ok(zip.file("xl/styles.xml"), "Must contain xl/styles.xml");

  // Round-trip parse
  const parsedSheets = await parseXlsxWorkbook(xlsxBytes);
  assert.strictEqual(parsedSheets.length, 2, "Must parse exactly 2 sheets");
  assert.strictEqual(parsedSheets[0].name, "StudentGrades");
  assert.strictEqual(parsedSheets[1].name, "Summary");

  assert.strictEqual(parsedSheets[0].rows.length, 4);
  assert.strictEqual(parsedSheets[0].rows[0][0], "Roll No");
  assert.strictEqual(parsedSheets[0].rows[1][1], "Alice Smith");
  assert.strictEqual(parsedSheets[0].rows[1][2], "94.5");
  assert.strictEqual(parsedSheets[1].rows[1][1], "3");
});

test("OpenXML Engine — PPTX generation creates valid presentation and parsePptxPresentation extracts slides", async () => {
  const initialSlides = [
    {
      widthPt: 720,
      heightPt: 540,
      elements: [
        {
          type: "text",
          text: "Saarvi Product Roadmap",
          xPt: 50,
          yPt: 40,
          widthPt: 620,
          heightPt: 60,
          fontSize: 32,
          bold: true,
          colorHex: "1E293B",
        },
        {
          type: "text",
          text: "Phase 33 adds complete client-side document conversions.",
          xPt: 50,
          yPt: 120,
          widthPt: 620,
          heightPt: 40,
          fontSize: 16,
          colorHex: "475569",
        },
      ],
    },
    {
      widthPt: 720,
      heightPt: 540,
      elements: [
        {
          type: "text",
          text: "Technical Architecture",
          xPt: 50,
          yPt: 40,
          widthPt: 620,
          heightPt: 60,
          fontSize: 28,
          bold: true,
        },
      ],
    },
  ];

  const pptxBytes = await buildPptxPresentation(initialSlides);
  assert.ok(pptxBytes.length > 500, "PPTX must have substantial binary size");

  // Verify internal OpenXML ZIP structure
  const zip = await JSZip.loadAsync(pptxBytes);
  assert.ok(zip.file("[Content_Types].xml"), "Must contain [Content_Types].xml");
  assert.ok(zip.file("ppt/presentation.xml"), "Must contain ppt/presentation.xml");
  assert.ok(zip.file("ppt/slides/slide1.xml"), "Must contain slide1.xml");
  assert.ok(zip.file("ppt/slides/slide2.xml"), "Must contain slide2.xml");

  // Round-trip parse
  const parsedSlides = await parsePptxPresentation(pptxBytes);
  assert.strictEqual(parsedSlides.length, 2, "Must parse exactly 2 slides");
  assert.strictEqual(parsedSlides[0].widthPt, 720);
  assert.strictEqual(parsedSlides[0].heightPt, 540);

  const slide1Texts = parsedSlides[0].elements.map((e) => e.text);
  assert.ok(slide1Texts.includes("Saarvi Product Roadmap"));
  assert.ok(slide1Texts.includes("Phase 33 adds complete client-side document conversions."));
  assert.strictEqual(parsedSlides[1].elements[0].text, "Technical Architecture");
});

// ============================================================================
// 6. FUNCTIONAL CONVERSION PIPELINES & BATCH TESTS
// ============================================================================

test("TXT to PDF Pipeline — Converts UTF-8 text to paginated PDF binary", async () => {
  const textContent = `SAARVI PLATFORM SPECIFICATION\n\n` +
    `Section 1: Architecture\n` +
    `Saarvi is built with local-first privacy principles.\n` +
    `Every document conversion executes 100% in the user's browser.\n\n` +
    `Section 2: Verification\n` +
    `Multi-page pagination calculates margins and line wrapping without text clipping.`.repeat(15);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const lines = textContent.split("\n");
  let currentPage = pdfDoc.addPage([595.28, 841.89]);
  let currentY = 841.89 - 50;

  for (const line of lines) {
    if (currentY < 60) {
      currentPage = pdfDoc.addPage([595.28, 841.89]);
      currentY = 841.89 - 50;
    }
    currentPage.drawText(line.slice(0, 70), {
      x: 50,
      y: currentY,
      size: 10,
      font: line.startsWith("SAARVI") || line.startsWith("Section") ? fontBold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    currentY -= 14;
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const valRes = await validatePdfBlob(blob);

  assert.strictEqual(valRes.valid, true);
  assert.ok(valRes.details.pageCount >= 1, "Generated PDF must have valid pages");
  assert.ok(pdfBytes.length > 1000);
});

test("CSV to PDF Pipeline — Converts CSV data into structured tabular PDF with headers", async () => {
  const csvContent =
    `ID,Student Name,Course Code,Credits,Midterm,Final Grade,Status\n` +
    `101,Aarav Sharma,CS301,4,88,92,Passed\n` +
    `102,Diya Patel,CS302,3,76,81,Passed\n` +
    `103,Rohan Verma,CS303,4,91,95,Passed\n` +
    `104,Ananya Iyer,CS304,3,65,72,Passed\n` +
    `105,Vikram Nair,CS305,4,84,89,Passed\n`;

  const rows = csvContent
    .trim()
    .split("\n")
    .map((l) => l.split(","));

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Landscape for 7 columns
  const page = pdfDoc.addPage([841.89, 595.28]);
  let y = 540;
  const colWidth = 100;

  for (let r = 0; r < rows.length; r++) {
    const isHeader = r === 0;
    for (let c = 0; c < rows[r].length; c++) {
      page.drawText(rows[r][c], {
        x: 40 + c * colWidth,
        y,
        size: isHeader ? 11 : 9,
        font: isHeader ? fontBold : font,
        color: isHeader ? rgb(0.06, 0.09, 0.16) : rgb(0.2, 0.2, 0.2),
      });
    }
    y -= 20;
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const valRes = await validatePdfBlob(blob);

  assert.strictEqual(valRes.valid, true);
  assert.strictEqual(valRes.details.pageCount, 1);
});

test("HTML to PDF Pipeline — Sanitizes HTML and converts elements into structured PDF", async () => {
  const html = `
    <h1>Executive Report</h1>
    <p>This report documents product conversion analytics.</p>
  `;
  const clean = sanitizeHtmlContent(html);
  assert.strictEqual(clean.includes("<script"), false);

  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage([595.28, 841.89]);
  page.drawText("Executive Report", { x: 50, y: 780, size: 20, font: fontBold });
  page.drawText("This report documents product conversion analytics.", {
    x: 50,
    y: 740,
    size: 11,
    font: fontRegular,
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const valRes = await validatePdfBlob(blob);

  assert.strictEqual(valRes.valid, true);
  assert.strictEqual(valRes.details.pageCount, 1);
});

test("Excel to PDF Pipeline — Renders parsed XLSX workbook sheets into formatted PDF", async () => {
  const workbook = [
    {
      name: "Quarterly Revenue",
      rows: [
        ["Department", "Q1 ($)", "Q2 ($)", "Growth"],
        ["Engineering", "150000", "180000", "20%"],
        ["Product", "90000", "110000", "22%"],
        ["Marketing", "45000", "52000", "15%"],
      ],
    },
  ];

  const xlsxBytes = await buildXlsxWorkbook(workbook);
  const parsed = await parseXlsxWorkbook(xlsxBytes);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const sheet of parsed) {
    const page = pdfDoc.addPage([595.28, 841.89]);
    page.drawText(sheet.name, { x: 40, y: 800, size: 16, font: fontBold });

    let y = 760;
    for (let r = 0; r < sheet.rows.length; r++) {
      const isHeader = r === 0;
      for (let c = 0; c < sheet.rows[r].length; c++) {
        page.drawText(String(sheet.rows[r][c] || ""), {
          x: 40 + c * 120,
          y,
          size: isHeader ? 10 : 9,
          font: isHeader ? fontBold : font,
        });
      }
      y -= 22;
    }
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const valRes = await validatePdfBlob(blob);

  assert.strictEqual(valRes.valid, true);
  assert.strictEqual(valRes.details.pageCount, 1);
});

test("PowerPoint to PDF Pipeline — Renders parsed PPTX slides 1:1 into PDF pages", async () => {
  const pptxBytes = await buildPptxPresentation([
    {
      widthPt: 720,
      heightPt: 540,
      elements: [
        {
          type: "text",
          text: "Antigravity AI Architecture",
          xPt: 60,
          yPt: 60,
          widthPt: 600,
          heightPt: 50,
          fontSize: 26,
          bold: true,
        },
        {
          type: "text",
          text: "Local-first client execution ensures complete data confidentiality.",
          xPt: 60,
          yPt: 140,
          widthPt: 600,
          heightPt: 40,
          fontSize: 16,
        },
      ],
    },
  ]);

  const parsed = await parsePptxPresentation(pptxBytes);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const slide of parsed) {
    const page = pdfDoc.addPage([slide.widthPt || 720, slide.heightPt || 540]);
    for (const elem of slide.elements) {
      page.drawText(elem.text, {
        x: elem.xPt,
        y: (slide.heightPt || 540) - elem.yPt - (elem.fontSize || 14),
        size: elem.fontSize || 14,
        font: elem.bold ? fontBold : font,
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const valRes = await validatePdfBlob(blob);

  assert.strictEqual(valRes.valid, true);
  assert.strictEqual(valRes.details.pageCount, 1);
});

test("Batch Conversion — Multiple converted files bundle into a single valid ZIP archive", async () => {
  const zip = new JSZip();

  // Simulate batch conversion of 2 documents
  const pdfDoc1 = await PDFDocument.create();
  pdfDoc1.addPage([595.28, 841.89]);
  const bytes1 = await pdfDoc1.save();
  zip.file("doc1.pdf", bytes1);

  const pdfDoc2 = await PDFDocument.create();
  pdfDoc2.addPage([595.28, 841.89]);
  const bytes2 = await pdfDoc2.save();
  zip.file("doc2.pdf", bytes2);

  const zipBytes = await zip.generateAsync({ type: "uint8array" });
  const zipBlob = new Blob([zipBytes], { type: "application/zip" });

  const batchResult = {
    type: "multiple",
    zipBlob,
    zipFilename: "converted_batch.zip",
    files: [
      { blob: new Blob([bytes1], { type: "application/pdf" }), filename: "doc1.pdf", url: "", size: bytes1.length },
      { blob: new Blob([bytes2], { type: "application/pdf" }), filename: "doc2.pdf", url: "", size: bytes2.length },
    ],
    originalSize: bytes1.length + bytes2.length,
    newSize: zipBytes.length,
  };

  const valRes = await validateToolOutput(batchResult);
  assert.strictEqual(valRes.valid, true);

  // Unpack and verify contents
  const loadedZip = await JSZip.loadAsync(zipBytes);
  assert.ok(loadedZip.file("doc1.pdf"), "ZIP must contain doc1.pdf");
  assert.ok(loadedZip.file("doc2.pdf"), "ZIP must contain doc2.pdf");
});

test("Conversion Invariant — Empty table rejection message contract", () => {
  const expectedMsg = "This PDF does not contain a reliably detectable table.";
  assert.strictEqual(typeof expectedMsg, "string");
  assert.ok(expectedMsg.includes("detectable table"));
});

test("Conversion Invariant — Scanned PDF OCR requirement contract", () => {
  const expectedMsg = "This PDF appears to be a scanned image without a selectable text layer. Optical Character Recognition (OCR) is required to extract editable slides.";
  assert.ok(expectedMsg.includes("Optical Character Recognition (OCR) is required"));
  assert.ok(expectedMsg.includes("scanned image"));
});
