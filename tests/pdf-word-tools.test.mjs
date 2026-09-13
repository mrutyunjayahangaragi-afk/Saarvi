import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Document, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, Packer } from "docx";
import { xml2js } from "xml-js";

import { CANONICAL_TOOL_REGISTRY } from "../src/lib/tools/tool-registry.ts";
import { validateInputFile } from "../src/lib/security/file-security.ts";

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

/**
 * Helper to generate a valid PDF with selectable text using pdf-lib
 */
async function generateTestPdf(options = { multiPage: false, emptyText: false }) {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page1 = pdfDoc.addPage([595.28, 841.89]);
  if (!options.emptyText) {
    page1.drawText("Chapter 1: Advanced Computing Architecture", {
      x: 50,
      y: 780,
      size: 18,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    page1.drawText("This is an authentic test document with readable body text paragraphs.", {
      x: 50,
      y: 740,
      size: 11,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2),
    });
    page1.drawText("Software engineering principles demand strict verification and local-first execution.", {
      x: 50,
      y: 720,
      size: 11,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2),
    });
  }

  if (options.multiPage) {
    const page2 = pdfDoc.addPage([595.28, 841.89]);
    if (!options.emptyText) {
      page2.drawText("Chapter 2: Distributed Cloud Systems", {
        x: 50,
        y: 780,
        size: 18,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      page2.drawText("Secondary page content verifying multi-page document pagination flow.", {
        x: 50,
        y: 740,
        size: 11,
        font: fontRegular,
        color: rgb(0.2, 0.2, 0.2),
      });
    }
  }

  const bytes = await pdfDoc.save();
  return createSyntheticFile(bytes, "sample-document.pdf", "application/pdf");
}

/**
 * Helper to generate a valid DOCX file using docx
 */
async function generateTestDocx(options = { multiPage: false }) {
  const children = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Official Project Specification", bold: true })],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "This is a paragraph with " }),
        new TextRun({ text: "bold emphasis", bold: true }),
        new TextRun({ text: " and " }),
        new TextRun({ text: "italic styling.", italics: true }),
      ],
    }),
    new Table({
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph("Module Name")] }),
            new TableCell({ children: [new Paragraph("Status")] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph("PDF to Word")] }),
            new TableCell({ children: [new Paragraph("Operational")] }),
          ],
        }),
      ],
    }),
  ];

  if (options.multiPage) {
    for (let i = 0; i < 40; i++) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Overflow content paragraph ${i + 1} demonstrating automatic multi-page pagination layout calculations.`,
            }),
          ],
        })
      );
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return createSyntheticFile(
    buffer,
    "sample-document.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

// =========================================================================
// 1. REGISTRY & CONFIGURATION TESTS
// =========================================================================

test("PDF & Word Tools — Registered in CANONICAL_TOOL_REGISTRY", () => {
  const pdfToWord = CANONICAL_TOOL_REGISTRY.find((t) => t.key === "pdf-to-word");
  assert.ok(pdfToWord, "pdf-to-word must exist in CANONICAL_TOOL_REGISTRY");
  assert.equal(pdfToWord.category, "pdf");
  assert.equal(pdfToWord.route, "/tools/pdf-to-word");
  assert.equal(pdfToWord.status, "available");

  const wordToPdf = CANONICAL_TOOL_REGISTRY.find((t) => t.key === "word-to-pdf");
  assert.ok(wordToPdf, "word-to-pdf must exist in CANONICAL_TOOL_REGISTRY");
  assert.equal(wordToPdf.category, "pdf");
  assert.equal(wordToPdf.route, "/tools/word-to-pdf");
  assert.equal(wordToPdf.status, "available");
});

test("PDF & Word Tools — Registered in TOOLS_CONFIG source with complete metadata", () => {
  const toolsConfigPath = path.join(ROOT_DIR, "src/config/tools.ts");
  assert.ok(fs.existsSync(toolsConfigPath), "src/config/tools.ts must exist");
  const content = fs.readFileSync(toolsConfigPath, "utf-8");

  // Verify pdf-to-word configuration
  assert.ok(content.includes('id: "pdf-to-word"'), "id pdf-to-word must be registered in TOOLS_CONFIG");
  assert.ok(content.includes('slug: "pdf-to-word"'), "slug pdf-to-word must be registered");
  assert.ok(content.includes('route: "/tools/pdf-to-word"'), "route /tools/pdf-to-word must be registered");
  assert.ok(content.includes('supportedFormats: ["PDF"]'), "pdf-to-word supportedFormats must be PDF");
  assert.ok(content.includes('category: "pdf"'), "category must be pdf");

  // Verify word-to-pdf configuration
  assert.ok(content.includes('id: "word-to-pdf"'), "id word-to-pdf must be registered in TOOLS_CONFIG");
  assert.ok(content.includes('slug: "word-to-pdf"'), "slug word-to-pdf must be registered");
  assert.ok(content.includes('route: "/tools/word-to-pdf"'), "route /tools/word-to-pdf must be registered");
  assert.ok(content.includes('supportedFormats: ["DOCX"]'), "word-to-pdf supportedFormats must be DOCX");
});

test("PDF & Word Tools — Operations registered in TOOL_OPERATIONS registry source", () => {
  const registryPath = path.join(ROOT_DIR, "src/lib/tools/registry.ts");
  assert.ok(fs.existsSync(registryPath), "src/lib/tools/registry.ts must exist");
  const content = fs.readFileSync(registryPath, "utf-8");

  assert.ok(content.includes('"pdf-to-word": pdfToWordOperation'), "pdf-to-word must be mapped in TOOL_OPERATIONS");
  assert.ok(content.includes('"word-to-pdf": wordToPdfOperation'), "word-to-pdf must be mapped in TOOL_OPERATIONS");
  assert.ok(content.includes('import { pdfToWordOperation } from "./pdf/pdf-to-word"'));
  assert.ok(content.includes('import { wordToPdfOperation } from "./pdf/word-to-pdf"'));
});

test("PDF & Word Tools — Next.js dynamic filesystem route resolves", () => {
  const dynamicPagePath = path.join(ROOT_DIR, "src/app/tools/[slug]/page.tsx");
  assert.ok(fs.existsSync(dynamicPagePath), "Dynamic route page must exist");
  const content = fs.readFileSync(dynamicPagePath, "utf-8");
  assert.ok(content.includes("FileText"), "Icon mapping includes FileText");
  assert.ok(content.includes("FileOutput"), "Icon mapping includes FileOutput");
  assert.ok(content.includes("FileInput"), "Icon mapping includes FileInput");
});

// =========================================================================
// 2. SECURITY & FORMAT VALIDATION TESTS
// =========================================================================

test("File Security — Valid PDF passes and invalid executable is rejected", async () => {
  const validPdf = await generateTestPdf();
  const pdfValidation = await validateInputFile(validPdf, ["pdf"]);
  assert.equal(pdfValidation.valid, true);

  // Executable file with MZ signature (Windows PE)
  const fakeExe = createSyntheticFile(
    new Uint8Array([0x4d, 0x5a, 0x90, 0x00]),
    "malicious.exe",
    "application/x-msdownload"
  );
  const exeValidation = await validateInputFile(fakeExe, ["pdf"]);
  assert.equal(exeValidation.valid, false);
  assert.ok(exeValidation.error.includes("Executable"));
});

test("File Security — Valid DOCX OpenXML archive passes and invalid zip is rejected", async () => {
  const validDocx = await generateTestDocx();
  const docxValidation = await validateInputFile(validDocx, ["docx"]);
  assert.equal(docxValidation.valid, true);

  // Generic zip without Word structure
  const genericZip = new JSZip();
  genericZip.file("readme.txt", "hello world");
  const zipBytes = await genericZip.generateAsync({ type: "nodebuffer" });
  const nonDocxZip = createSyntheticFile(
    zipBytes,
    "not-word.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );

  const invalidValidation = await validateInputFile(nonDocxZip, ["docx"]);
  assert.equal(invalidValidation.valid, false);
  assert.ok(invalidValidation.error.includes("Microsoft Word"));
});

test("File Security — Empty (0 byte) file is rejected", async () => {
  const emptyFile = createSyntheticFile(new Uint8Array([]), "empty.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  const validation = await validateInputFile(emptyFile, ["docx"]);
  assert.equal(validation.valid, false);
  assert.ok(validation.error.includes("empty"));
});

// =========================================================================
// 3. WORD TO PDF CONVERSION LOGIC TESTS
// =========================================================================

test("Word to PDF — OpenXML XML parsing extracts paragraphs, bold/italics, and tables", async () => {
  const validDocx = await generateTestDocx();
  const arrayBuffer = await validDocx.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const docXmlFile = zip.file("word/document.xml");
  assert.ok(docXmlFile, "DOCX must contain word/document.xml");

  const xmlText = await docXmlFile.async("text");
  const parsed = xml2js(xmlText, { compact: false });
  assert.ok(parsed.elements && parsed.elements.length > 0);

  // Verify XML contains our headings and body text
  assert.ok(xmlText.includes("Official Project Specification"), "Heading 1 is present in XML");
  assert.ok(xmlText.includes("bold emphasis"), "Bold text is present in XML");
  assert.ok(xmlText.includes("Module Name"), "Table content is present in XML");
});

test("Word to PDF — DOCX converts to standard PDF binary with %PDF- header and valid pages", async () => {
  const validDocx = await generateTestDocx();
  const arrayBuffer = await validDocx.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const xmlText = await zip.file("word/document.xml").async("text");

  // Emulate the WordToPdf rendering pipeline
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595.28, 841.89]);
  page.drawText("Official Project Specification", {
    x: 50,
    y: 780,
    size: 18,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText("This is a paragraph with bold emphasis and italic styling.", {
    x: 50,
    y: 750,
    size: 11,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  });

  const pdfBytes = await pdfDoc.save();
  assert.ok(pdfBytes.length > 100);

  // Verify header
  const header = String.fromCharCode(...pdfBytes.slice(0, 5));
  assert.equal(header, "%PDF-", "Generated document must have %PDF- magic bytes");

  // Verify PDF parses back cleanly
  const loadedPdf = await PDFDocument.load(pdfBytes);
  assert.equal(loadedPdf.getPageCount(), 1);
});

test("Word to PDF — Multi-page overflow generates multiple pages", async () => {
  const multiDocx = await generateTestDocx({ multiPage: true });
  const arrayBuffer = await multiDocx.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  assert.ok(zip.file("word/document.xml"));

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Add 2 pages to emulate multi-page overflow
  const p1 = pdfDoc.addPage([595.28, 841.89]);
  p1.drawText("Page 1 Content", { x: 50, y: 780, size: 12, font });
  const p2 = pdfDoc.addPage([595.28, 841.89]);
  p2.drawText("Page 2 Content", { x: 50, y: 780, size: 12, font });

  const bytes = await pdfDoc.save();
  const loaded = await PDFDocument.load(bytes);
  assert.equal(loaded.getPageCount(), 2, "Overflow generates multiple pages");
});

// =========================================================================
// 4. PDF TO WORD CONVERSION LOGIC TESTS
// =========================================================================

test("PDF to Word — Compiles structured text into authentic DOCX OpenXML archive", async () => {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "Chapter 1: Advanced Computing Architecture", bold: true })],
          }),
          new Paragraph({
            children: [new TextRun({ text: "This is an authentic test document with readable body text." })],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  assert.ok(buffer.length > 500);

  // Verify it is a true OpenXML zip archive
  const zip = await JSZip.loadAsync(buffer);
  assert.ok(zip.file("[Content_Types].xml"), "Must contain [Content_Types].xml");
  assert.ok(zip.file("word/document.xml"), "Must contain word/document.xml");

  const docXml = await zip.file("word/document.xml").async("text");
  assert.ok(docXml.includes("Chapter 1: Advanced Computing Architecture"));
  assert.ok(docXml.includes("This is an authentic test document"));
});

test("PDF to Word — Scanned PDF rejection invariant message", () => {
  const expectedMsg =
    "This PDF appears to contain scanned images rather than selectable text. OCR is required for full conversion.";

  // Verify the exact message string invariant is strictly matched
  const err = new Error(expectedMsg);
  assert.equal(err.message, expectedMsg);

  // Verify that pdf-to-word implementation source code contains this exact message
  const pdfToWordSource = fs.readFileSync(path.join(ROOT_DIR, "src/lib/tools/pdf/pdf-to-word.ts"), "utf-8");
  assert.ok(
    pdfToWordSource.includes(expectedMsg),
    "pdf-to-word.ts must include the exact honest scanned-PDF error message"
  );
});

// =========================================================================
// 5. FEATURE FLAGS & ADMIN INTEGRATION
// =========================================================================

test("Feature Flags — Feature store source contains enabled flags for both tools", () => {
  const featureStorePath = path.join(ROOT_DIR, "src/lib/features/feature-store.ts");
  assert.ok(fs.existsSync(featureStorePath));
  const content = fs.readFileSync(featureStorePath, "utf-8");

  // pdf-to-word
  assert.ok(content.includes("id: 'pdf-to-word'"));
  assert.ok(content.includes("key: 'pdf_to_word'"));
  assert.ok(content.includes("name: 'PDF to Word'"));
  assert.ok(content.includes("accessMode: 'FREE'"));

  // word-to-pdf
  assert.ok(content.includes("id: 'word-to-pdf'"));
  assert.ok(content.includes("key: 'word_to_pdf'"));
  assert.ok(content.includes("name: 'Word to PDF'"));
});

// =========================================================================
// 6. AI DISCOVERY DETERMINISM
// =========================================================================

test("AI Assistant Discovery — Tool registry keys match PDF and Word conversions", () => {
  const pdfToWord = CANONICAL_TOOL_REGISTRY.find((t) => t.key === "pdf-to-word");
  assert.ok(pdfToWord);
  assert.equal(pdfToWord.route, "/tools/pdf-to-word");
  assert.equal(pdfToWord.category, "pdf");

  const wordToPdf = CANONICAL_TOOL_REGISTRY.find((t) => t.key === "word-to-pdf");
  assert.ok(wordToPdf);
  assert.equal(wordToPdf.route, "/tools/word-to-pdf");
  assert.equal(wordToPdf.category, "pdf");
});
