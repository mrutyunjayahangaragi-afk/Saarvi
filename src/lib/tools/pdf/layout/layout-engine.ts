import type {
  DocumentModel,
  PageModel,
  LayoutElement,
  ParagraphElement,
  HeadingElement,
  ListElement,
  TableElement,
  ImageElement,
  TextSpan,
  TextStyle,
  ConversionQualityReport,
} from "./document-model.ts";
import { classifyDocument } from "./classifier.ts";

export interface RawPdfTextItem {
  str: string;
  x: number;
  y: number; // top-down coordinate
  width: number;
  height: number;
  fontSize: number;
  fontName?: string;
  hasEOL?: boolean;
}

export interface RawPdfPageData {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
  items: RawPdfTextItem[];
  images?: {
    x: number;
    y: number;
    width: number;
    height: number;
    dataUrl?: string;
    imageBuffer?: Uint8Array;
    mimeType: string;
  }[];
}

interface ProcessedLine {
  y: number;
  x: number;
  width: number;
  height: number;
  fontSize: number;
  items: RawPdfTextItem[];
  text: string;
  spans: TextSpan[];
  isHeading: boolean;
  headingLevel?: 1 | 2 | 3;
  isListItem: boolean;
  listMarker?: string;
  columns?: string[];
  columnIdx?: number;
}

/**
 * Normalizes PDF font name into standard metrically compatible font family
 */
export function normalizeFontFamily(rawName?: string): { family: string; bold: boolean; italic: boolean } {
  if (!rawName) return { family: "Calibri", bold: false, italic: false };

  const clean = rawName.replace(/^[A-Z]{6}\+/, "").toLowerCase();
  const bold = /bold|black|heavy|w[6-9]|semibold/i.test(clean);
  const italic = /italic|oblique|slanted/i.test(clean);

  if (/times|roman|serif|georgia/i.test(clean)) {
    return { family: "Times New Roman", bold, italic };
  }
  if (/arial|helvetica|sans/i.test(clean)) {
    return { family: "Arial", bold, italic };
  }
  if (/courier|mono|code|consolas/i.test(clean)) {
    return { family: "Courier New", bold, italic };
  }
  if (/georgia/i.test(clean)) {
    return { family: "Georgia", bold, italic };
  }
  if (/tahoma|verdana/i.test(clean)) {
    return { family: "Verdana", bold, italic };
  }

  return { family: "Calibri", bold, italic };
}

/**
 * Detects if a text line starts with a list bullet or numbering
 */
function detectListMarker(text: string): { isList: boolean; marker?: string; cleanText: string } {
  const bulletRegex = /^([•–\-\*▪▫○●✦\u2022\u2013\u2014])\s+(.+)$/;
  const numberedRegex = /^(\d{1,3}[\.\)]|\([a-zA-Z0-9]{1,3}\)|[a-zA-Z][\.\)])\s+(.+)$/;

  const bMatch = text.match(bulletRegex);
  if (bMatch) {
    return { isList: true, marker: bMatch[1], cleanText: bMatch[2].trim() };
  }

  const nMatch = text.match(numberedRegex);
  if (nMatch) {
    return { isList: true, marker: nMatch[1], cleanText: nMatch[2].trim() };
  }

  return { isList: false, cleanText: text };
}

/**
 * Analyzes raw PDF page data and constructs a geometry-preserving DocumentModel
 */
export function buildDocumentModel(
  rawPages: RawPdfPageData[],
  conversionDurationMs: number = 0
): DocumentModel {
  // 1. Calculate Document-wide font size metrics (body text median)
  const allFontSizes: number[] = [];
  for (const page of rawPages) {
    for (const item of page.items) {
      if (item.str.trim()) {
        allFontSizes.push(item.fontSize);
      }
    }
  }
  allFontSizes.sort((a, b) => a - b);
  const medianFontSize = allFontSizes.length > 0 ? allFontSizes[Math.floor(allFontSizes.length / 2)] : 11;

  // 2. Classify Document
  const classification = classifyDocument(
    rawPages.map((p) => ({
      pageNumber: p.pageNumber,
      charCount: p.items.reduce((acc, it) => acc + it.str.trim().length, 0),
      imageCount: p.images?.length || 0,
    }))
  );

  let totalParagraphCount = 0;
  let totalHeadingCount = 0;
  let totalTableCount = 0;
  let totalImageCount = 0;
  const fontSubstitutions: Record<string, string> = {};

  const pages: PageModel[] = [];

  // 3. Process each page
  for (const rawPage of rawPages) {
    const { pageNumber, widthPt, heightPt, items, images = [] } = rawPage;
    const isLandscape = widthPt > heightPt;

    // Calculate margins based on bounding box of text items
    let minX = widthPt;
    let maxX = 0;
    let minY = heightPt;
    let maxY = 0;

    for (const it of items) {
      if (!it.str.trim()) continue;
      if (it.x < minX) minX = it.x;
      if (it.x + it.width > maxX) maxX = it.x + it.width;
      if (it.y < minY) minY = it.y;
      if (it.y + it.height > maxY) maxY = it.y + it.height;
    }

    const marginLeft = items.length > 0 ? Math.max(36, Math.min(Math.round(minX), 72)) : 54;
    const marginRight = items.length > 0 ? Math.max(36, Math.min(Math.round(widthPt - maxX), 72)) : 54;
    const marginTop = items.length > 0 ? Math.max(36, Math.min(Math.round(minY), 72)) : 54;
    const marginBottom = items.length > 0 ? Math.max(36, Math.min(Math.round(heightPt - maxY), 72)) : 54;

    // Detect Multi-Column Layout
    // Check if there is a vertical gutter dividing the page horizontally into 2 columns
    const midX = widthPt / 2;
    const gutterThreshold = 18; // pt
    let hasTwoColumns = false;
    let col1Count = 0;
    let col2Count = 0;

    for (const it of items) {
      if (!it.str.trim()) continue;
      if (it.x + it.width < midX - gutterThreshold) col1Count++;
      else if (it.x > midX + gutterThreshold) col2Count++;
    }

    if (col1Count >= 10 && col2Count >= 10) {
      hasTwoColumns = true;
    }

    // Group items into lines
    const lines: ProcessedLine[] = [];
    const sortedItems = [...items].sort((a, b) => a.y - b.y || a.x - b.x);

    for (const item of sortedItems) {
      const existingLine = lines.find((l) => Math.abs(l.y - item.y) <= Math.max(3, item.fontSize * 0.35));
      if (existingLine) {
        existingLine.items.push(item);
      } else {
        lines.push({
          y: item.y,
          x: item.x,
          width: item.width,
          height: item.height || item.fontSize,
          fontSize: item.fontSize,
          items: [item],
          text: "",
          spans: [],
          isHeading: false,
          isListItem: false,
          columnIdx: hasTwoColumns ? (item.x < midX ? 1 : 2) : 1,
        });
      }
    }

    // Finalize each line: sort items by X, reconstruct text & spans, detect columns
    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x);
      line.x = line.items[0]?.x || 0;
      const lastItem = line.items[line.items.length - 1];
      line.width = lastItem ? lastItem.x + lastItem.width - line.x : 0;

      let lineStr = "";
      let prevEnd = -1;
      const tableColumns: string[] = [];
      let currColStr = "";

      for (const it of line.items) {
        const fontMeta = normalizeFontFamily(it.fontName);
        if (it.fontName && !fontSubstitutions[it.fontName]) {
          fontSubstitutions[it.fontName] = fontMeta.family;
        }

        if (prevEnd >= 0) {
          const gap = it.x - prevEnd;
          if (gap > 28) {
            if (currColStr.trim()) tableColumns.push(currColStr.trim());
            currColStr = it.str;
          } else if (gap > 3 && !lineStr.endsWith(" ") && !it.str.startsWith(" ")) {
            lineStr += " ";
            currColStr += " ";
          }
        }

        lineStr += it.str;
        currColStr += it.str;
        prevEnd = it.x + (it.width || it.str.length * (it.fontSize * 0.5));

        line.spans.push({
          text: it.str,
          style: {
            fontFamily: fontMeta.family,
            fontSizePt: Math.round(it.fontSize * 2) / 2,
            bold: fontMeta.bold,
            italic: fontMeta.italic,
            alignment: "left",
          },
        });
      }

      if (currColStr.trim()) tableColumns.push(currColStr.trim());
      line.text = lineStr.trim();

      if (tableColumns.length >= 2) {
        line.columns = tableColumns;
      }

      // Check Heading
      const isH1 = line.fontSize >= medianFontSize * 1.4 && line.text.length < 120;
      const isH2 = line.fontSize >= medianFontSize * 1.2 && line.text.length < 140;
      const isH3 = line.items.some((it) => normalizeFontFamily(it.fontName).bold) && line.fontSize >= medianFontSize && line.text.length < 100;

      if (isH1) {
        line.isHeading = true;
        line.headingLevel = 1;
      } else if (isH2) {
        line.isHeading = true;
        line.headingLevel = 2;
      } else if (isH3 && lines.length > 1) {
        line.isHeading = true;
        line.headingLevel = 3;
      }

      // Check List
      const listInfo = detectListMarker(line.text);
      if (listInfo.isList) {
        line.isListItem = true;
        line.listMarker = listInfo.marker;
      }
    }

    // Filter valid lines
    const validLines = lines.filter((l) => l.text.length > 0);

    // If multi-column: sort column 1 top-to-bottom, then column 2 top-to-bottom
    let orderedLines = validLines;
    if (hasTwoColumns) {
      const col1 = validLines.filter((l) => l.columnIdx === 1).sort((a, b) => a.y - b.y);
      const col2 = validLines.filter((l) => l.columnIdx === 2).sort((a, b) => a.y - b.y);
      orderedLines = [...col1, ...col2];
    }

    // 4. Reconstruct Page Layout Elements
    const elements: LayoutElement[] = [];

    // Add Embedded Images
    for (const img of images) {
      totalImageCount++;
      elements.push({
        type: "image",
        x: img.x,
        y: img.y,
        width: img.width,
        height: img.height,
        dataUrl: img.dataUrl,
        imageBuffer: img.imageBuffer,
        mimeType: img.mimeType || "image/png",
        aspectRatio: img.width / Math.max(1, img.height),
      });
    }

    let pendingParagraphSpans: TextSpan[] = [];
    let pendingParagraphAlignment: "left" | "center" | "right" | "justify" = "left";
    let pendingTableLines: ProcessedLine[] = [];

    const flushParagraph = () => {
      if (pendingParagraphSpans.length === 0) return;
      totalParagraphCount++;
      elements.push({
        type: "paragraph",
        x: marginLeft,
        y: 0,
        width: widthPt - marginLeft - marginRight,
        height: 14,
        spans: pendingParagraphSpans,
        alignment: pendingParagraphAlignment,
        lineSpacingMultiple: 1.15,
        spaceBeforePt: 2,
        spaceAfterPt: 6,
      });
      pendingParagraphSpans = [];
      pendingParagraphAlignment = "left";
    };

    const flushTable = () => {
      if (pendingTableLines.length === 0) return;
      totalTableCount++;

      // Compute column count
      const maxCols = Math.max(...pendingTableLines.map((l) => l.columns?.length || 1));
      const colWidthPt = (widthPt - marginLeft - marginRight) / Math.max(1, maxCols);

      const rows = pendingTableLines.map((line, rIdx) => ({
        isHeader: rIdx === 0,
        cells: (line.columns || [line.text]).map((colText) => ({
          widthPt: colWidthPt,
          hasTopBorder: true,
          hasBottomBorder: true,
          hasLeftBorder: true,
          hasRightBorder: true,
          paragraphs: [
            {
              type: "paragraph" as const,
              x: 0,
              y: 0,
              width: colWidthPt,
              height: 12,
              spans: [
                {
                  text: colText,
                  style: {
                    fontFamily: "Calibri",
                    fontSizePt: 10,
                    bold: rIdx === 0,
                    italic: false,
                    alignment: "left" as const,
                  },
                },
              ],
              alignment: "left" as const,
            },
          ],
        })),
      }));

      elements.push({
        type: "table",
        x: marginLeft,
        y: pendingTableLines[0]?.y || 0,
        width: widthPt - marginLeft - marginRight,
        height: pendingTableLines.length * 20,
        rows,
        columnWidthsPt: Array(maxCols).fill(colWidthPt),
        totalWidthPt: widthPt - marginLeft - marginRight,
      });

      pendingTableLines = [];
    };

    for (let i = 0; i < orderedLines.length; i++) {
      const line = orderedLines[i];

      // Table line
      if (line.columns && line.columns.length >= 2) {
        flushParagraph();
        pendingTableLines.push(line);
        continue;
      } else {
        flushTable();
      }

      // Heading line
      if (line.isHeading) {
        flushParagraph();
        totalHeadingCount++;
        elements.push({
          type: "heading",
          x: line.x,
          y: line.y,
          width: line.width,
          height: line.height,
          level: line.headingLevel || 1,
          text: line.text,
          style: line.spans[0]?.style || {
            fontFamily: "Calibri",
            fontSizePt: line.headingLevel === 1 ? 16 : 13,
            bold: true,
            italic: false,
            alignment: "left",
          },
          spaceBeforePt: line.headingLevel === 1 ? 12 : 8,
          spaceAfterPt: line.headingLevel === 1 ? 6 : 4,
        });
        continue;
      }

      // List line
      if (line.isListItem) {
        flushParagraph();
        elements.push({
          type: "list",
          x: line.x,
          y: line.y,
          width: line.width,
          height: line.height,
          listType: /^\d/.test(line.listMarker || "") ? "numbered" : "bullet",
          marker: line.listMarker || "•",
          level: 0,
          spans: line.spans,
        });
        continue;
      }

      // Alignment detection
      let lineAlignment: "left" | "center" | "right" | "justify" = "left";
      const centerDelta = Math.abs((widthPt - line.width) / 2 - line.x);
      const rightDelta = Math.abs(widthPt - marginRight - (line.x + line.width));

      if (centerDelta < 20 && line.width < widthPt * 0.75) {
        lineAlignment = "center";
      } else if (rightDelta < 20 && line.width < widthPt * 0.75) {
        lineAlignment = "right";
      }

      // Vertical gap paragraph break
      const prevLine = i > 0 ? orderedLines[i - 1] : null;
      const verticalGap = prevLine ? line.y - (prevLine.y + prevLine.height) : 0;
      const isParagraphBreak = prevLine && verticalGap > line.fontSize * 1.5;

      if (isParagraphBreak) {
        flushParagraph();
      }

      pendingParagraphAlignment = lineAlignment;
      if (pendingParagraphSpans.length > 0) {
        pendingParagraphSpans.push({
          text: " ",
          style: line.spans[0]?.style || {
            fontFamily: "Calibri",
            fontSizePt: 11,
            bold: false,
            italic: false,
            alignment: lineAlignment,
          },
        });
      }
      pendingParagraphSpans.push(...line.spans);
    }

    flushParagraph();
    flushTable();

    pages.push({
      pageNumber,
      widthPt,
      heightPt,
      isLandscape,
      marginsPt: {
        top: marginTop,
        bottom: marginBottom,
        left: marginLeft,
        right: marginRight,
      },
      columnCount: hasTwoColumns ? 2 : 1,
      elements,
      isScanned: items.length === 0 && images.length > 0,
    });
  }

  // 5. Quality Report Calculation
  let qualityState: "High" | "Medium" | "Needs Review" = "High";
  const formattingNotes: string[] = [];

  if (classification.documentType === "TYPE_B_SCANNED") {
    qualityState = "Medium";
    formattingNotes.push("Scanned document processed via OCR. Text extracted with best practical accuracy.");
  } else if (classification.documentType === "TYPE_D_COMPLEX") {
    qualityState = "High";
    formattingNotes.push("Complex multi-column or tabular layout reconstructed into native Word structures.");
  } else {
    formattingNotes.push("Digital text and geometry preserved with high fidelity.");
  }

  const qualityReport: ConversionQualityReport = {
    detectedType: classification.documentType,
    ocrUsed: classification.requiresOcr,
    pageCount: pages.length,
    paragraphCount: totalParagraphCount,
    headingCount: totalHeadingCount,
    tableCount: totalTableCount,
    imageCount: totalImageCount,
    fontSubstitutions,
    durationMs: conversionDurationMs,
    qualityState,
    formattingNotes,
  };

  return {
    pages,
    documentType: classification.documentType,
    qualityReport,
  };
}
