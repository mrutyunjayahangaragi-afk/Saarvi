import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Document, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, Packer } from "docx";

import { classifyDocument } from "../src/lib/tools/pdf/layout/classifier.ts";
import {
  normalizeFontFamily,
  buildDocumentModel,
} from "../src/lib/tools/pdf/layout/layout-engine.ts";
import { pdfToWordOperation } from "../src/lib/tools/pdf/pdf-to-word.ts";
import { wordToPdfOperation } from "../src/lib/tools/pdf/word-to-pdf.ts";

const ROOT_DIR = process.cwd();

function createSyntheticFile(buffer, name, type) {
  const blob = new Blob([buffer], { type });
  blob.name = name;
  blob.lastModified = Date.now();
  return blob;
}

// =========================================================================
// 1. DOCUMENT CLASSIFIER TESTS
// =========================================================================

test("Document Classifier — Identifies Type A Digital PDF correctly", () => {
  const pages = [
    { pageNumber: 1, charCount: 850, imageCount: 0 },
    { pageNumber: 2, charCount: 1200, imageCount: 1 },
  ];
  const res = classifyDocument(pages);
  assert.strictEqual(res.documentType, "TYPE_A_DIGITAL");
  assert.strictEqual(res.requiresOcr, false);
  assert.strictEqual(res.isMixed, false);
});

test("Document Classifier — Identifies Type B Scanned PDF correctly", () => {
  const pages = [
    { pageNumber: 1, charCount: 2, imageCount: 1 },
    { pageNumber: 2, charCount: 0, imageCount: 1 },
  ];
  const res = classifyDocument(pages);
  assert.strictEqual(res.documentType, "TYPE_B_SCANNED");
  assert.strictEqual(res.requiresOcr, true);
  assert.strictEqual(res.pages[0].useOcr, true);
  assert.strictEqual(res.pages[1].useOcr, true);
});

test("Document Classifier — Identifies Type C Mixed PDF correctly", () => {
  const pages = [
    { pageNumber: 1, charCount: 1200, imageCount: 0 },
    { pageNumber: 2, charCount: 4, imageCount: 1 }, // Scanned
    { pageNumber: 3, charCount: 950, imageCount: 0 },
  ];
  const res = classifyDocument(pages);
  assert.strictEqual(res.documentType, "TYPE_C_MIXED");
  assert.strictEqual(res.isMixed, true);
  assert.strictEqual(res.requiresOcr, true);
  assert.strictEqual(res.pages[0].useOcr, false);
  assert.strictEqual(res.pages[1].useOcr, true);
  assert.strictEqual(res.pages[2].useOcr, false);
});

test("Document Classifier — Identifies Type D Complex PDF correctly", () => {
  const pages = [
    { pageNumber: 1, charCount: 800, imageCount: 1, columnCountEstimate: 2, hasTables: true },
  ];
  const res = classifyDocument(pages);
  assert.strictEqual(res.documentType, "TYPE_D_COMPLEX");
  assert.strictEqual(res.isComplex, true);
});

// =========================================================================
// 2. FONT NORMALIZATION & METRIC TESTS
// =========================================================================

test("Font Engine — Normalizes embedded PDF font names into standard families", () => {
  const f1 = normalizeFontFamily("ABCDEF+Helvetica-Bold");
  assert.strictEqual(f1.family, "Arial");
  assert.strictEqual(f1.bold, true);
  assert.strictEqual(f1.italic, false);

  const f2 = normalizeFontFamily("XYZ+TimesNewRomanPS-Italic");
  assert.strictEqual(f2.family, "Times New Roman");
  assert.strictEqual(f2.bold, false);
  assert.strictEqual(f2.italic, true);

  const f3 = normalizeFontFamily("CourierNew-BoldItalic");
  assert.strictEqual(f3.family, "Courier New");
  assert.strictEqual(f3.bold, true);
  assert.strictEqual(f3.italic, true);

  const f4 = normalizeFontFamily("Calibri-Regular");
  assert.strictEqual(f4.family, "Calibri");
  assert.strictEqual(f4.bold, false);
});

// =========================================================================
// 3. LAYOUT ENGINE RECONSTRUCTION TESTS
// =========================================================================

test("Layout Engine — Reconstructs headings, paragraphs, lists, and tables with geometry", () => {
  const rawPage = {
    pageNumber: 1,
    widthPt: 595.28,
    heightPt: 841.89,
    items: [
      // Heading 1 (18pt)
      { str: "Executive Summary", x: 54, y: 60, width: 200, height: 18, fontSize: 18, fontName: "Arial-Bold" },
      // Body Paragraph
      { str: "This is a high-fidelity document conversion engine.", x: 54, y: 95, width: 350, height: 11, fontSize: 11 },
      { str: "It preserves original page margins and alignment.", x: 54, y: 112, width: 320, height: 11, fontSize: 11 },
      // List item
      { str: "• Native text geometry tracking", x: 54, y: 140, width: 250, height: 11, fontSize: 11 },
      // Table line (columns with gap > 28)
      { str: "Product", x: 54, y: 180, width: 60, height: 11, fontSize: 11 },
      { str: "Status", x: 200, y: 180, width: 50, height: 11, fontSize: 11 },
      { str: "PDF to Word", x: 54, y: 205, width: 80, height: 11, fontSize: 11 },
      { str: "Operational", x: 200, y: 205, width: 70, height: 11, fontSize: 11 },
    ],
  };

  const docModel = buildDocumentModel([rawPage], 120);
  assert.strictEqual(docModel.pages.length, 1);

  const page = docModel.pages[0];
  assert.strictEqual(page.widthPt, 595.28);
  assert.strictEqual(page.heightPt, 841.89);
  assert.ok(page.marginsPt.left >= 36);
  assert.ok(page.marginsPt.top >= 36);

  // Check detected element types
  const elementTypes = page.elements.map((e) => e.type);
  assert.ok(elementTypes.includes("heading"), "Must detect heading element");
  assert.ok(elementTypes.includes("paragraph"), "Must detect paragraph element");
  assert.ok(elementTypes.includes("list"), "Must detect list element");
  assert.ok(elementTypes.includes("table"), "Must detect table element");

  // Check Quality Report
  assert.strictEqual(docModel.qualityReport.qualityState, "High");
  assert.ok(docModel.qualityReport.headingCount >= 1);
  assert.ok(docModel.qualityReport.tableCount >= 1);
});

// =========================================================================
// 4. PDF TO WORD CONVERSION SUITE
// =========================================================================

test("PDF to Word — Compiles structured DOCX with exact page size and margins", async () => {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage([595.28, 841.89]);
  page.drawText("Saarvi Engineering Architecture", { x: 54, y: 780, size: 18, font: fontBold });
  page.drawText("High-fidelity document reconstruction preserves margins and styles.", {
    x: 54,
    y: 740,
    size: 11,
    font: fontRegular,
  });

  const pdfBytes = await pdfDoc.save();
  const file = createSyntheticFile(pdfBytes, "test-doc.pdf", "application/pdf");

  const result = await pdfToWordOperation.execute([file]);
  assert.strictEqual(result.type, "single");
  assert.ok(result.filename.endsWith(".docx"));
  assert.ok(result.newSize > 500);

  // Unpack and verify DOCX OpenXML structure
  const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
  assert.ok(zip.file("word/document.xml"), "DOCX must contain word/document.xml");
  const docXml = await zip.file("word/document.xml").async("text");

  assert.ok(docXml.includes("Saarvi Engineering Architecture"));
  assert.ok(docXml.includes("High-fidelity document reconstruction"));

  // Check details & Quality Report
  assert.strictEqual(result.details["Document Type"], "Digital");
  assert.strictEqual(result.details["Quality State"], "High");
});

test("PDF to Word — Honest Invariant Error for Scanned PDF without OCR", async () => {
  const pdfDoc = await PDFDocument.create();
  // Page with virtually zero text
  pdfDoc.addPage([595.28, 841.89]);
  const pdfBytes = await pdfDoc.save();
  const file = createSyntheticFile(pdfBytes, "scanned-doc.pdf", "application/pdf");

  await assert.rejects(
    async () => {
      await pdfToWordOperation.execute([file]);
    },
    (err) => {
      assert.ok(err.message.includes("This PDF appears to contain scanned images rather than selectable text. OCR is required for full conversion."));
      return true;
    }
  );
});

// =========================================================================
// 5. WORD TO PDF CONVERSION SUITE
// =========================================================================

test("Word to PDF — Preserves headings, tables, and page size into authentic PDF", async () => {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4 in twips
            margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
          },
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "System Specification Document", bold: true })],
          }),
          new Paragraph({
            children: [new TextRun({ text: "Body paragraph verifying Word to PDF conversion flow." })],
          }),
          new Table({
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Feature")] }),
                  new TableCell({ children: [new Paragraph("Status")] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Layout Preservation")] }),
                  new TableCell({ children: [new Paragraph("Verified")] }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  const docxBuffer = await Packer.toBuffer(doc);
  const file = createSyntheticFile(
    docxBuffer,
    "specification.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );

  const result = await wordToPdfOperation.execute([file]);
  assert.strictEqual(result.type, "single");
  assert.ok(result.filename.endsWith(".pdf"));

  // Verify PDF binary signature
  const pdfBytes = new Uint8Array(await result.blob.arrayBuffer());
  const header = String.fromCharCode(...pdfBytes.slice(0, 5));
  assert.strictEqual(header, "%PDF-");

  // Load and inspect PDF
  const loadedPdf = await PDFDocument.load(pdfBytes);
  assert.strictEqual(loadedPdf.getPageCount(), 1);
  assert.strictEqual(result.details["Paragraphs Converted"], 2);
  assert.strictEqual(result.details["Tables Converted"], 1);
});
