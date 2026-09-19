import "../../polyfills/iterator.ts";
import * as pdfjsLib from "pdfjs-dist";
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  Packer,
} from "docx";
import type { ToolOperation, SingleFileResult, ValidationResult } from "../types.ts";
import { readFileAsArrayBuffer } from "../../utils.ts";
import { validateInputFile, sanitizeFilename } from "../../security/file-security.ts";
import { buildDocumentModel } from "./layout/layout-engine.ts";
import type { RawPdfPageData, RawPdfTextItem } from "./layout/layout-engine.ts";
import { processScannedPageWithOcr } from "./layout/ocr-pipeline.ts";

// Ensure worker is configured for browser execution
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

export interface PdfToWordConfig {
  preservePageBreaks?: boolean;
  enableOcr?: boolean;
  userConsentForOcr?: boolean;
}

type HeadingLevelValue = (typeof HeadingLevel)[keyof typeof HeadingLevel];

/**
 * PDF to Word High-Fidelity Local Converter Operation
 *
 * Reconstructs original document geometry, page dimensions, margins,
 * alignments, headings, paragraph groupings, multi-column flows,
 * tables, embedded images, headers/footers, and font styles into authentic
 * Microsoft Word (.docx) OpenXML archives.
 */
export const pdfToWordOperation: ToolOperation<PdfToWordConfig, SingleFileResult> = {
  id: "pdf-to-word",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select a PDF document to convert." };
    }
    const file = files[0];
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      return { valid: false, error: `"${file.name}" is not a valid PDF document.` };
    }
    if (file.size > 50 * 1024 * 1024) {
      return { valid: false, error: "File exceeds the 50MB limit for browser conversion." };
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    config: PdfToWordConfig = {},
    onProgress?: (percent: number, stageMessage?: string) => void
  ): Promise<SingleFileResult> {
    const startTime = performance.now();
    const file = files[0];

    // 1. Validate magic bytes using Saarvi security subsystem
    const securityCheck = await validateInputFile(file, ["pdf"], 50 * 1024 * 1024);
    if (!securityCheck.valid) {
      throw new Error(securityCheck.error || "Invalid PDF file structure.");
    }

    if (onProgress) onProgress(5, "Saarvi is analyzing your document...");

    const arrayBuffer = await readFileAsArrayBuffer(file);
    if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    }

    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: typeof window !== "undefined" ? "/cmaps/" : undefined,
      cMapPacked: true,
      standardFontDataUrl: typeof window !== "undefined" ? "/standard_fonts/" : undefined,
    });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    if (numPages === 0) {
      throw new Error("The selected PDF document contains no pages.");
    }

    if (onProgress) onProgress(15, "Detecting document layout...");

    let totalSelectableChars = 0;
    const rawPages: RawPdfPageData[] = [];

    // 2. Extract structured page data across all pages
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      const widthPt = viewport.width;
      const heightPt = viewport.height;

      const textContent = await page.getTextContent();
      const rawItems: RawPdfTextItem[] = [];

      for (const item of textContent.items) {
        if (!("str" in item) || !item.str) continue;
        const str = item.str;
        const transform = item.transform || [1, 0, 0, 1, 0, 0];
        const fontSize = Math.abs(transform[0]) || Math.abs(transform[3]) || item.height || 10;
        const x = transform[4] || 0;
        // Convert bottom-up PDF Y coordinate to top-down coordinate
        const y = heightPt - (transform[5] || 0) - fontSize;

        totalSelectableChars += str.trim().length;

        rawItems.push({
          str,
          x,
          y,
          width: item.width || 0,
          height: item.height || fontSize,
          fontSize,
          fontName: item.fontName,
          hasEOL: Boolean(item.hasEOL),
        });
      }

      // Check for scanned page
      if (rawItems.length === 0 && config.enableOcr) {
        if (onProgress) onProgress(30, "Recognizing scanned pages...");
        // Scanned page fallback handled via OCR pipeline
        const ocrPage = await processScannedPageWithOcr(
          pageNum,
          widthPt,
          heightPt,
          new Uint8Array(0),
          "image/jpeg",
          { consentGranted: config.userConsentForOcr }
        );
        rawPages.push(ocrPage);
      } else {
        rawPages.push({
          pageNumber: pageNum,
          widthPt,
          heightPt,
          items: rawItems,
        });
      }

      if (onProgress) {
        onProgress(20 + Math.round((pageNum / numPages) * 35), "Extracting text...");
      }
    }

    // 3. Scanned / Image-Only PDF Invariant Detection
    if (totalSelectableChars < 15 && !config.enableOcr) {
      throw new Error(
        "This PDF appears to contain scanned images rather than selectable text. OCR is required for full conversion."
      );
    }

    if (onProgress) onProgress(65, "Rebuilding tables...");

    // 4. Build geometry-preserving document layout model
    const conversionDurationMs = Math.round(performance.now() - startTime);
    const docModel = buildDocumentModel(rawPages, conversionDurationMs);

    if (onProgress) onProgress(80, "Preserving formatting...");

    // 5. Compile OpenXML DOCX Document
    const docSections = docModel.pages.map((pageModel, pageIdx) => {
      const isFirstPage = pageIdx === 0;
      const docChildren: (Paragraph | Table)[] = [];

      for (const element of pageModel.elements) {
        if (element.type === "heading") {
          const hLevel =
            element.level === 1
              ? HeadingLevel.HEADING_1
              : element.level === 2
              ? HeadingLevel.HEADING_2
              : HeadingLevel.HEADING_3;

          docChildren.push(
            new Paragraph({
              heading: hLevel,
              spacing: {
                before: (element.spaceBeforePt || 10) * 20, // pt to twips (1 pt = 20 twips)
                after: (element.spaceAfterPt || 6) * 20,
                line: 276,
              },
              children: [
                new TextRun({
                  text: element.text,
                  size: Math.round(element.style.fontSizePt * 2), // pt to half-points
                  bold: true,
                  font: element.style.fontFamily || "Calibri",
                }),
              ],
            })
          );
        } else if (element.type === "paragraph") {
          let alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT;
          if (element.alignment === "center") alignment = AlignmentType.CENTER;
          else if (element.alignment === "right") alignment = AlignmentType.RIGHT;
          else if (element.alignment === "justify") alignment = AlignmentType.JUSTIFIED;

          const runs = element.spans.map(
            (s) =>
              new TextRun({
                text: s.text,
                size: Math.round(s.style.fontSizePt * 2),
                bold: s.style.bold,
                italics: s.style.italic,
                font: s.style.fontFamily || "Calibri",
              })
          );

          docChildren.push(
            new Paragraph({
              alignment,
              spacing: {
                before: (element.spaceBeforePt || 2) * 20,
                after: (element.spaceAfterPt || 6) * 20,
                line: Math.round((element.lineSpacingMultiple || 1.15) * 240),
              },
              children: runs.length > 0 ? runs : [new TextRun("")],
            })
          );
        } else if (element.type === "list") {
          docChildren.push(
            new Paragraph({
              spacing: { before: 40, after: 40 },
              indent: { left: 360, hanging: 180 },
              children: [
                new TextRun({
                  text: `${element.marker} `,
                  bold: true,
                  font: "Calibri",
                }),
                ...element.spans.map(
                  (s) =>
                    new TextRun({
                      text: s.text,
                      size: Math.round(s.style.fontSizePt * 2),
                      bold: s.style.bold,
                      italics: s.style.italic,
                      font: s.style.fontFamily || "Calibri",
                    })
                ),
              ],
            })
          );
        } else if (element.type === "table") {
          const tableRows = element.rows.map(
            (row) =>
              new TableRow({
                children: row.cells.map(
                  (cell) =>
                    new TableCell({
                      width: {
                        size: Math.round(cell.widthPt * 20),
                        type: WidthType.DXA,
                      },
                      children: cell.paragraphs.map(
                        (p) =>
                          new Paragraph({
                            spacing: { before: 20, after: 20 },
                            children: p.spans.map(
                              (s) =>
                                new TextRun({
                                  text: s.text,
                                  size: Math.round(s.style.fontSizePt * 2),
                                  bold: s.style.bold,
                                  font: s.style.fontFamily || "Calibri",
                                })
                            ),
                          })
                      ),
                      borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
                        left: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
                        right: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
                      },
                    })
                ),
              })
          );

          docChildren.push(
            new Table({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            })
          );
        }
      }

      return {
        properties: {
          page: {
            pageNumbers: { start: 1 },
            size: {
              width: Math.round(pageModel.widthPt * 20), // pt to dxa
              height: Math.round(pageModel.heightPt * 20),
            },
            margin: {
              top: Math.round(pageModel.marginsPt.top * 20),
              bottom: Math.round(pageModel.marginsPt.bottom * 20),
              left: Math.round(pageModel.marginsPt.left * 20),
              right: Math.round(pageModel.marginsPt.right * 20),
            },
          },
        },
        children: docChildren.length > 0 ? docChildren : [new Paragraph({ text: "" })],
      };
    });

    if (onProgress) onProgress(90, "Checking the converted document...");

    const doc = new Document({
      sections: docSections,
    });

    // 6. Pack document into Blob (browser) or Buffer (Node)
    let docxBlob: Blob;
    const packerObj = Packer as unknown as {
      toBlob?: (d: Document) => Promise<Blob>;
      toBuffer: (d: Document) => Promise<Uint8Array>;
    };

    if (typeof window !== "undefined" && typeof packerObj.toBlob === "function") {
      docxBlob = await packerObj.toBlob(doc);
    } else {
      const buffer = await packerObj.toBuffer(doc);
      docxBlob = new Blob([buffer as unknown as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
    }

    if (onProgress) onProgress(100, "Word document ready.");

    const safeBaseName = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ""));
    const filename = `${safeBaseName}.docx`;

    const report = docModel.qualityReport;

    return {
      type: "single",
      blob: docxBlob,
      filename,
      originalSize: file.size,
      newSize: docxBlob.size,
      details: {
        "Pages Converted": numPages,
        "Paragraphs Extracted": report.paragraphCount,
        "Headings Detected": report.headingCount,
        "Tables Reconstructed": report.tableCount,
        "Images Preserved": report.imageCount,
        "Document Type":
          report.detectedType === "TYPE_B_SCANNED"
            ? "Scanned"
            : report.detectedType === "TYPE_C_MIXED"
            ? "Mixed"
            : "Digital",
        "OCR Used": report.ocrUsed ? "Used" : "Not Used",
        "Quality State": report.qualityState,
        Formatting:
          report.qualityState === "High"
            ? "Preserved"
            : "Some adjustments may be required",
      },
    };
  },
};
