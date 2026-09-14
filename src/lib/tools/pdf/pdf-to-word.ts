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
  Packer,
} from "docx";
import { ToolOperation, SingleFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "../../utils";
import { validateInputFile, sanitizeFilename } from "../../security/file-security";
import { loadPdfjs } from "./pdfjs-loader";

export interface PdfToWordConfig {
  preservePageBreaks?: boolean;
}

interface RawTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName?: string;
  hasEOL?: boolean;
}

type HeadingLevelValue = (typeof HeadingLevel)[keyof typeof HeadingLevel];

interface LineItem {
  y: number;
  fontSize: number;
  items: RawTextItem[];
  text: string;
  isHeading: boolean;
  headingLevel?: HeadingLevelValue;
  columns?: string[];
}

/**
 * PDF to Word Local Converter Operation
 * Extracts structured text, headings, paragraphs, and tables from PDF documents
 * and compiles an authentic Microsoft Word (.docx) document.
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
    _config: PdfToWordConfig = {},
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult> {
    const file = files[0];

    // 1. Validate magic bytes using Saarvi security subsystem
    const securityCheck = await validateInputFile(file, ["pdf"], 50 * 1024 * 1024);
    if (!securityCheck.valid) {
      throw new Error(securityCheck.error || "Invalid PDF file structure.");
    }

    if (onProgress) onProgress(10);

    const arrayBuffer = await readFileAsArrayBuffer(file);
    const pdfjsLib = await loadPdfjs();
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

    let totalSelectableChars = 0;
    const pagesLines: LineItem[][] = [];

    // 2. Extract and structure text items across all pages
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const rawItems: RawTextItem[] = [];

      for (const item of textContent.items) {
        if (!("str" in item) || !item.str) continue;
        const str = item.str;
        const transform = item.transform || [1, 0, 0, 1, 0, 0];
        const fontSize = Math.abs(transform[0]) || Math.abs(transform[3]) || item.height || 10;
        const x = transform[4] || 0;
        const y = transform[5] || 0;

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

      // Group text items into lines based on Y position tolerance
      const lines: LineItem[] = [];
      const sortedItems = [...rawItems].sort((a, b) => b.y - a.y || a.x - b.x);

      for (const item of sortedItems) {
        // Find existing line with matching vertical position
        const existingLine = lines.find((l) => Math.abs(l.y - item.y) <= Math.max(3, item.fontSize * 0.35));
        if (existingLine) {
          existingLine.items.push(item);
        } else {
          lines.push({
            y: item.y,
            fontSize: item.fontSize,
            items: [item],
            text: "",
            isHeading: false,
          });
        }
      }

      // Finalize each line: sort items by X ascending, detect spaces and columns
      for (const line of lines) {
        line.items.sort((a, b) => a.x - b.x);
        let lineStr = "";
        let prevEnd = -1;
        const columns: string[] = [];
        let currColStr = "";

        for (const it of line.items) {
          if (prevEnd >= 0) {
            const gap = it.x - prevEnd;
            if (gap > 28) {
              // Wide gap suggests table column separation
              if (currColStr.trim()) columns.push(currColStr.trim());
              currColStr = it.str;
            } else if (gap > 3 && !lineStr.endsWith(" ") && !it.str.startsWith(" ")) {
              lineStr += " ";
              currColStr += " ";
            }
          }
          lineStr += it.str;
          currColStr += it.str;
          prevEnd = it.x + (it.width || it.str.length * (it.fontSize * 0.5));
        }

        if (currColStr.trim()) columns.push(currColStr.trim());
        line.text = lineStr.trim();
        if (columns.length >= 2) {
          line.columns = columns;
        }
      }

      // Filter out completely blank lines
      const validLines = lines.filter((l) => l.text.length > 0);
      pagesLines.push(validLines);

      if (onProgress) {
        onProgress(10 + Math.round((pageNum / numPages) * 50));
      }
    }

    // 3. Scanned / Image-Only PDF Detection
    // If the PDF has virtually zero selectable text, do NOT produce a silent blank document.
    if (totalSelectableChars < 15) {
      throw new Error(
        "This PDF appears to contain scanned images rather than selectable text. OCR is required for full conversion."
      );
    }

    // 4. Calculate baseline body text size for heading detection
    const allFontSizes = pagesLines.flatMap((page) => page.map((l) => l.fontSize));
    allFontSizes.sort((a, b) => a - b);
    const medianFontSize = allFontSizes.length > 0 ? allFontSizes[Math.floor(allFontSizes.length / 2)] : 11;

    // 5. Construct Document Elements (Headings, Paragraphs, Tables, Page Breaks)
    const docChildren: (Paragraph | Table)[] = [];
    let paragraphCount = 0;
    let headingCount = 0;

    for (let pageIdx = 0; pageIdx < pagesLines.length; pageIdx++) {
      const lines = pagesLines[pageIdx];
      const isFirstPage = pageIdx === 0;

      let currentParagraphText: string[] = [];
      let currentParagraphHeadingLevel: HeadingLevelValue | undefined = undefined;
      let pendingTableRows: TableRow[] = [];

      const flushParagraph = (pageBreakBefore: boolean = false) => {
        if (currentParagraphText.length === 0) return;
        const fullText = currentParagraphText.join(" ").trim();
        if (!fullText) {
          currentParagraphText = [];
          return;
        }

        paragraphCount++;
        docChildren.push(
          new Paragraph({
            heading: currentParagraphHeadingLevel,
            pageBreakBefore,
            spacing: {
              before: currentParagraphHeadingLevel ? 200 : 100,
              after: currentParagraphHeadingLevel ? 140 : 120,
              line: 276, // 1.15 line spacing
            },
            children: [
              new TextRun({
                text: fullText,
                size: currentParagraphHeadingLevel ? 28 : 22, // 14pt heading or 11pt body
                bold: Boolean(currentParagraphHeadingLevel),
                font: "Calibri",
              }),
            ],
          })
        );

        currentParagraphText = [];
        currentParagraphHeadingLevel = undefined;
      };

      const flushTable = () => {
        if (pendingTableRows.length === 0) return;
        docChildren.push(
          new Table({
            rows: pendingTableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
        pendingTableRows = [];
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isHeading1 = line.fontSize >= medianFontSize * 1.45 && line.text.length < 120;
        const isHeading2 = line.fontSize >= medianFontSize * 1.25 && line.text.length < 140;

        // Check if this line is part of a table (2+ detected aligned columns)
        if (line.columns && line.columns.length >= 2) {
          flushParagraph(isFirstPage && i === 0 ? false : false);

          const cells = line.columns.map(
            (colText) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: colText,
                        size: 20,
                        font: "Calibri",
                      }),
                    ],
                  }),
                ],
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                  left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                  right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                },
              })
          );

          pendingTableRows.push(new TableRow({ children: cells }));
          continue;
        } else {
          flushTable();
        }

        if (isHeading1 || isHeading2) {
          flushParagraph(isFirstPage && i === 0 ? false : false);
          headingCount++;
          currentParagraphHeadingLevel = isHeading1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2;
          currentParagraphText.push(line.text);
          flushParagraph(!isFirstPage && i === 0);
          continue;
        }

        // Regular paragraph flow
        const prevLine = i > 0 ? lines[i - 1] : null;
        const verticalGap = prevLine ? prevLine.y - line.y : 0;
        const isParagraphBreak = prevLine && verticalGap > line.fontSize * 1.75;

        if (isParagraphBreak) {
          flushParagraph(!isFirstPage && currentParagraphText.length === 0 && i === 0);
        }

        currentParagraphText.push(line.text);
      }

      flushParagraph(!isFirstPage);
      flushTable();
    }

    if (onProgress) onProgress(75);

    // 6. Compile Document using OOXML docx library
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440, // 1 inch
                bottom: 1440,
                left: 1440,
                right: 1440,
              },
            },
          },
          children: docChildren.length > 0 ? docChildren : [new Paragraph({ text: "" })],
        },
      ],
    });

    if (onProgress) onProgress(90);

    // 7. Pack document into Blob (browser) or Buffer (Node)
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

    if (onProgress) onProgress(100);

    const safeBaseName = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ""));
    const filename = `${safeBaseName}.docx`;

    return {
      type: "single",
      blob: docxBlob,
      filename,
      originalSize: file.size,
      newSize: docxBlob.size,
      details: {
        "Pages Converted": numPages,
        "Paragraphs Extracted": paragraphCount,
        "Headings Detected": headingCount,
      },
    };
  },
};
