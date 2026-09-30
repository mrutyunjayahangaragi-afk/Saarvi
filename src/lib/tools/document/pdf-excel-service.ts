import type { PDFPageProxy, PDFDocumentProxy } from "pdfjs-dist";
import { buildXlsxWorkbook, parseXlsxWorkbook } from "./openxml-helper.ts";
import type { XlsxSheetData } from "./openxml-helper.ts";

export interface RawPdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

export interface DetectedRow {
  y: number;
  items: RawPdfTextItem[];
}

export interface ExtractedTableCandidate {
  strategy: string;
  rows: (string | number | boolean | null)[][];
  rowCount: number;
  colCount: number;
  nonEmptyCells: number;
  fillRatio: number;
  confidenceScore: number;
}

export type DocumentTypeClassification = "TEXT_PDF" | "SCANNED_PDF" | "MIXED_PDF";

export interface DocumentAnalysisResult {
  documentType: DocumentTypeClassification;
  pageCount: number;
  totalTextItems: number;
  avgItemsPerPage: number;
  hasEmbeddedText: boolean;
  recommendation?: string;
}

export interface TablePreviewData {
  sheetName: string;
  headers: (string | number | boolean | null)[];
  sampleRows: (string | number | boolean | null)[][];
  totalRows: number;
  totalCols: number;
  qualityScore: number;
  strategyUsed: string;
}

export interface PdfToExcelConversionResult {
  sheets: XlsxSheetData[];
  xlsxBytes: Uint8Array;
  analysis: DocumentAnalysisResult;
  previews: TablePreviewData[];
  totalRows: number;
  maxCols: number;
  overallQualityScore: number;
  primaryStrategy: string;
}

// ============================================================================
// 1. DATA PRESERVATION & VALUE PARSER
// ============================================================================

export class DataPreserver {
  /**
   * Safely formats and parses extracted cell strings:
   * - Preserves leading zeros (e.g. "0123", "007", roll numbers, postal codes)
   * - Preserves dates (e.g. 2026-09-30, 30/09/2026)
   * - Preserves formatted numbers with commas (e.g. 1,250 or 1,250,500.50)
   * - Preserves currency and percentages ($100, ₹500, 25.5%)
   * - Preserves phone numbers and formatted IDs (+91 98765 43210, (555) 123-4567)
   * - Converts unambiguous integers and floats to native numbers for Excel formulas
   */
  public static parseCellValue(str: string): string | number {
    const trimmed = str.trim();
    if (!trimmed) return "";

    // 1. Leading zeros (e.g. "0123", "007", roll numbers, employee codes)
    if (/^0\d+/.test(trimmed) && trimmed.length > 1) {
      return trimmed;
    }

    // 2. Dates (e.g. 2026-09-28, 28/09/2026, 09/28/2026, 2026/09/28)
    if (/^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(trimmed)) {
      return trimmed;
    }

    // 3. Formatted numbers with commas (e.g. 1,250 or 1,250,500.50)
    if (/^[-+]?(\d{1,3}(,\d{3})+)(\.\d+)?$/.test(trimmed)) {
      return trimmed;
    }

    // 4. Currency and percentages ($100, ₹500, €45, £99, 25%, 12.5%)
    if (/^([$€£₹¥]\s*[-+]?\d+(\.\d+)?|[-+]?\d+(\.\d+)?%)$/.test(trimmed)) {
      return trimmed;
    }

    // 5. Phone numbers / IDs with dashes, parentheses, or spaces
    if (/^(\+\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}$/.test(trimmed)) {
      return trimmed;
    }

    // 6. Clean plain integer or floating point number
    if (/^[-+]?\d+(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      if (!isNaN(num) && isFinite(num)) {
        return num;
      }
    }

    return trimmed;
  }
}

// ============================================================================
// 2. TOKEN DECOMPOSITION UTILITIES
// ============================================================================

export class TokenDecomposer {
  /**
   * Decomposes combined text items where multiple columns were flattened into a single run
   * separated by tabs (\t) or 2+ consecutive spaces.
   */
  public static decompose(item: RawPdfTextItem): RawPdfTextItem[] {
    const str = item.str;
    if (!str) return [];

    // If string has no tabs and no 2+ consecutive spaces, keep intact
    if (!str.includes("\t") && !/\s{2,}/.test(str)) {
      return [item];
    }

    const results: RawPdfTextItem[] = [];
    const charWidth = item.width > 0 && str.length > 0 ? item.width / str.length : item.fontSize * 0.5;

    // Match continuous non-whitespace sequences or single-space separated phrases
    const tokenRegex = /(\S+(?: [^\s\t]+)*)/g;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(str)) !== null) {
      const token = match[0].trim();
      if (!token) continue;

      const tokenStart = match.index;
      const tokenX = item.x + tokenStart * charWidth;
      const tokenW = token.length * charWidth;

      results.push({
        str: token,
        x: tokenX,
        y: item.y,
        width: tokenW,
        height: item.height,
        fontSize: item.fontSize,
      });
    }

    return results.length > 0 ? results : [item];
  }
}

// ============================================================================
// 3. TABLE EXTRACTION STRATEGIES (STRATEGY PATTERN)
// ============================================================================

export interface TableExtractionStrategy {
  readonly name: string;
  extract(items: RawPdfTextItem[]): ExtractedTableCandidate | null;
}

/**
 * Strategy 1: Hybrid Coordinate Clustering
 * Groups text runs by vertical baseline centroid and horizontal column anchors
 * with adaptive tolerances based on font size and inter-item spacing.
 */
export class HybridCoordinateClusteringStrategy implements TableExtractionStrategy {
  public readonly name = "Hybrid Coordinate Clustering";

  public extract(items: RawPdfTextItem[]): ExtractedTableCandidate | null {
    if (items.length < 4) return null;

    // Decompose any merged runs
    const decomposed: RawPdfTextItem[] = [];
    for (const item of items) {
      decomposed.push(...TokenDecomposer.decompose(item));
    }

    if (decomposed.length < 4) return null;

    // 1. Group items into rows using adaptive vertical baseline clustering
    const rows: DetectedRow[] = [];
    const sortedItems = [...decomposed].sort((a, b) => b.y - a.y || a.x - b.x);

    for (const item of sortedItems) {
      const tolerance = Math.max(3.2, (item.fontSize || 10) * 0.42);
      let matchedRow = rows.find((r) => Math.abs(r.y - item.y) <= tolerance);

      if (!matchedRow) {
        matchedRow = { y: item.y, items: [] };
        rows.push(matchedRow);
      } else {
        // Track running vertical centroid
        matchedRow.y = (matchedRow.y * matchedRow.items.length + item.y) / (matchedRow.items.length + 1);
      }
      matchedRow.items.push(item);
    }

    // Sort items inside each row by X ascending
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
    }

    // Sort rows from top of page to bottom (descending Y in PDF coordinate space)
    rows.sort((a, b) => b.y - a.y);

    // Multi-column rows detection
    const multiColumnRows = rows.filter((r) => r.items.length >= 2);
    if (multiColumnRows.length < 2) {
      return null;
    }

    // 2. Adaptive Horizontal Column Anchors Clustering
    const allXPositions: number[] = [];
    for (const r of multiColumnRows) {
      for (const item of r.items) {
        allXPositions.push(item.x);
      }
    }
    allXPositions.sort((a, b) => a - b);

    // Calculate adaptive column cluster tolerance based on median spacing
    let colClusterTolerance = 14;
    if (allXPositions.length > 3) {
      const deltas: number[] = [];
      for (let i = 1; i < allXPositions.length; i++) {
        const d = allXPositions[i] - allXPositions[i - 1];
        if (d > 4) deltas.push(d);
      }
      if (deltas.length > 0) {
        deltas.sort((a, b) => a - b);
        const medianDelta = deltas[Math.floor(deltas.length / 2)];
        colClusterTolerance = Math.min(24, Math.max(10, medianDelta * 0.35));
      }
    }

    const columnAnchors: number[] = [];
    for (const x of allXPositions) {
      const last = columnAnchors[columnAnchors.length - 1];
      if (last === undefined || x - last > colClusterTolerance) {
        columnAnchors.push(x);
      }
    }

    if (columnAnchors.length < 2) {
      return null;
    }

    // 3. Construct dense 2D grid
    const tableData: (string | number | boolean | null)[][] = [];
    let populatedCellCount = 0;

    for (const row of rows) {
      const rowCells: (string | number | null)[] = new Array(columnAnchors.length).fill(null);
      let rowHasItem = false;

      for (const item of row.items) {
        // Find closest column anchor
        let bestColIdx = 0;
        let minDiff = Infinity;
        for (let c = 0; c < columnAnchors.length; c++) {
          const diff = Math.abs(columnAnchors[c] - item.x);
          if (diff < minDiff) {
            minDiff = diff;
            bestColIdx = c;
          }
        }

        const parsedVal = DataPreserver.parseCellValue(item.str);
        const existingVal = rowCells[bestColIdx];

        if (existingVal !== null && existingVal !== undefined && String(existingVal).trim() !== "") {
          rowCells[bestColIdx] = `${existingVal} ${item.str}`;
        } else {
          rowCells[bestColIdx] = parsedVal;
        }
        rowHasItem = true;
        populatedCellCount++;
      }

      if (rowHasItem) {
        // Trim trailing nulls
        while (rowCells.length > 0 && rowCells[rowCells.length - 1] === null) {
          rowCells.pop();
        }
        if (rowCells.length > 0) {
          tableData.push(rowCells);
        }
      }
    }

    if (tableData.length < 2) return null;
    const maxCols = Math.max(...tableData.map((r) => r.length));
    if (maxCols < 2) return null;

    // Quality metrics
    const totalPotentialCells = tableData.length * maxCols;
    const fillRatio = totalPotentialCells > 0 ? populatedCellCount / totalPotentialCells : 0;
    const consistency = tableData.filter((r) => r.length >= 2).length / tableData.length;
    const confidenceScore = Math.min(1.0, 0.4 + fillRatio * 0.3 + consistency * 0.3);

    return {
      strategy: this.name,
      rows: tableData,
      rowCount: tableData.length,
      colCount: maxCols,
      nonEmptyCells: populatedCellCount,
      fillRatio,
      confidenceScore,
    };
  }
}

/**
 * Strategy 2: Stream / Whitespace Gutter Alignment
 * Detects vertical whitespace gutters between columns across all lines,
 * ideal for borderless tabular text layouts and aligned reports.
 */
export class StreamStrategy implements TableExtractionStrategy {
  public readonly name = "Stream Whitespace Alignment";

  public extract(items: RawPdfTextItem[]): ExtractedTableCandidate | null {
    if (items.length < 6) return null;

    // Decompose items
    const decomposed: RawPdfTextItem[] = [];
    for (const item of items) {
      decomposed.push(...TokenDecomposer.decompose(item));
    }

    // 1. Group into vertical lines
    const rows: DetectedRow[] = [];
    const sorted = [...decomposed].sort((a, b) => b.y - a.y || a.x - b.x);

    for (const item of sorted) {
      const tol = Math.max(3.0, (item.fontSize || 10) * 0.4);
      let r = rows.find((row) => Math.abs(row.y - item.y) <= tol);
      if (!r) {
        r = { y: item.y, items: [] };
        rows.push(r);
      } else {
        r.y = (r.y * r.items.length + item.y) / (r.items.length + 1);
      }
      r.items.push(item);
    }

    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
    }
    rows.sort((a, b) => b.y - a.y);

    if (rows.length < 2) return null;

    // 2. Detect inter-word horizontal gaps
    const minX = Math.min(...decomposed.map((i) => i.x));
    const maxX = Math.max(...decomposed.map((i) => i.x + i.width));
    const span = maxX - minX;
    if (span <= 50) return null;

    // Discretize horizontal space into 1-pt bins to find continuous white gutters
    const binCount = Math.ceil(span);
    const occupancy = new Uint8Array(binCount);

    for (const item of decomposed) {
      const startBin = Math.max(0, Math.floor(item.x - minX));
      const endBin = Math.min(binCount - 1, Math.ceil(item.x + item.width - minX));
      for (let b = startBin; b <= endBin; b++) {
        occupancy[b] = 1;
      }
    }

    // Find continuous 0s of width >= 12 pt as column gutters
    const gutters: { start: number; end: number; center: number }[] = [];
    let inGutter = false;
    let gutterStart = 0;

    for (let b = 0; b < binCount; b++) {
      if (occupancy[b] === 0) {
        if (!inGutter) {
          inGutter = true;
          gutterStart = b;
        }
      } else {
        if (inGutter) {
          inGutter = false;
          const gutterWidth = b - gutterStart;
          if (gutterWidth >= 12) {
            gutters.push({
              start: minX + gutterStart,
              end: minX + b,
              center: minX + (gutterStart + b) / 2,
            });
          }
        }
      }
    }

    if (gutters.length === 0) return null;

    // Define column bounds
    const colBounds: { start: number; end: number }[] = [];
    let curStart = minX;
    for (const g of gutters) {
      colBounds.push({ start: curStart, end: g.start });
      curStart = g.end;
    }
    colBounds.push({ start: curStart, end: maxX });

    if (colBounds.length < 2) return null;

    // 3. Assemble table
    const tableData: (string | number | boolean | null)[][] = [];
    let nonEmptyCount = 0;

    for (const row of rows) {
      const cells: (string | number | null)[] = new Array(colBounds.length).fill(null);
      let rowHasItem = false;

      for (const item of row.items) {
        const itemMid = item.x + item.width / 2;
        let assignedCol = -1;

        for (let c = 0; c < colBounds.length; c++) {
          if (itemMid >= colBounds[c].start - 4 && itemMid <= colBounds[c].end + 4) {
            assignedCol = c;
            break;
          }
        }

        if (assignedCol === -1) {
          // Find closest
          let minD = Infinity;
          for (let c = 0; c < colBounds.length; c++) {
            const colMid = (colBounds[c].start + colBounds[c].end) / 2;
            const diff = Math.abs(colMid - itemMid);
            if (diff < minD) {
              minD = diff;
              assignedCol = c;
            }
          }
        }

        if (assignedCol >= 0) {
          const parsed = DataPreserver.parseCellValue(item.str);
          if (cells[assignedCol] !== null) {
            cells[assignedCol] = `${cells[assignedCol]} ${item.str}`;
          } else {
            cells[assignedCol] = parsed;
          }
          rowHasItem = true;
          nonEmptyCount++;
        }
      }

      if (rowHasItem) {
        while (cells.length > 0 && cells[cells.length - 1] === null) {
          cells.pop();
        }
        if (cells.length > 0) {
          tableData.push(cells);
        }
      }
    }

    if (tableData.length < 2) return null;
    const maxCols = Math.max(...tableData.map((r) => r.length));
    if (maxCols < 2) return null;

    const totalPotential = tableData.length * maxCols;
    const fillRatio = totalPotential > 0 ? nonEmptyCount / totalPotential : 0;
    const confidenceScore = Math.min(1.0, 0.45 + fillRatio * 0.35);

    return {
      strategy: this.name,
      rows: tableData,
      rowCount: tableData.length,
      colCount: maxCols,
      nonEmptyCells: nonEmptyCount,
      fillRatio,
      confidenceScore,
    };
  }
}

/**
 * Strategy 3: Lattice Strict Alignment
 * For structured tables with strictly aligned cell starting points.
 */
export class LatticeStrategy implements TableExtractionStrategy {
  public readonly name = "Lattice Strict Alignment";

  public extract(items: RawPdfTextItem[]): ExtractedTableCandidate | null {
    if (items.length < 8) return null;

    const decomposed: RawPdfTextItem[] = [];
    for (const item of items) {
      decomposed.push(...TokenDecomposer.decompose(item));
    }

    // Cluster strict X coordinates with a small tolerance (6pt)
    const xFreq = new Map<number, number>();
    for (const item of decomposed) {
      const roundedX = Math.round(item.x / 5) * 5;
      xFreq.set(roundedX, (xFreq.get(roundedX) || 0) + 1);
    }

    // Candidates must appear in at least 3 distinct places
    const validAnchors = Array.from(xFreq.entries())
      .filter(([_, count]) => count >= 3)
      .map(([x]) => x)
      .sort((a, b) => a - b);

    if (validAnchors.length < 2) return null;

    // Group items into rows
    const rows: DetectedRow[] = [];
    for (const item of decomposed) {
      const tol = Math.max(3.0, (item.fontSize || 10) * 0.4);
      let r = rows.find((row) => Math.abs(row.y - item.y) <= tol);
      if (!r) {
        r = { y: item.y, items: [] };
        rows.push(r);
      } else {
        r.y = (r.y * r.items.length + item.y) / (r.items.length + 1);
      }
      r.items.push(item);
    }

    for (const r of rows) r.items.sort((a, b) => a.x - b.x);
    rows.sort((a, b) => b.y - a.y);

    const tableData: (string | number | boolean | null)[][] = [];
    let nonEmptyCount = 0;

    for (const row of rows) {
      const cells: (string | number | null)[] = new Array(validAnchors.length).fill(null);
      let hasItem = false;

      for (const item of row.items) {
        let bestIdx = 0;
        let minD = Infinity;
        for (let i = 0; i < validAnchors.length; i++) {
          const diff = Math.abs(validAnchors[i] - item.x);
          if (diff < minD) {
            minD = diff;
            bestIdx = i;
          }
        }

        if (minD <= 12) {
          const parsed = DataPreserver.parseCellValue(item.str);
          if (cells[bestIdx] !== null) {
            cells[bestIdx] = `${cells[bestIdx]} ${item.str}`;
          } else {
            cells[bestIdx] = parsed;
          }
          hasItem = true;
          nonEmptyCount++;
        }
      }

      if (hasItem) {
        while (cells.length > 0 && cells[cells.length - 1] === null) cells.pop();
        if (cells.length > 0) tableData.push(cells);
      }
    }

    if (tableData.length < 2) return null;
    const maxCols = Math.max(...tableData.map((r) => r.length));
    if (maxCols < 2) return null;

    const fillRatio = nonEmptyCount / (tableData.length * maxCols);
    const confidenceScore = Math.min(1.0, 0.5 + fillRatio * 0.35);

    return {
      strategy: this.name,
      rows: tableData,
      rowCount: tableData.length,
      colCount: maxCols,
      nonEmptyCells: nonEmptyCount,
      fillRatio,
      confidenceScore,
    };
  }
}

// ============================================================================
// 4. TABLE QUALITY EVALUATOR
// ============================================================================

export class TableQualityEvaluator {
  private strategies: TableExtractionStrategy[] = [
    new HybridCoordinateClusteringStrategy(),
    new StreamStrategy(),
    new LatticeStrategy(),
  ];

  /**
   * Evaluates all extraction strategies against the provided text items,
   * selecting the candidate with the highest structural confidence and data density.
   */
  public evaluate(items: RawPdfTextItem[]): ExtractedTableCandidate | null {
    if (!items || items.length === 0) return null;

    const candidates: ExtractedTableCandidate[] = [];

    for (const strategy of this.strategies) {
      try {
        const candidate = strategy.extract(items);
        if (candidate && candidate.rowCount >= 2 && candidate.colCount >= 2 && candidate.nonEmptyCells >= 4) {
          candidates.push(candidate);
        }
      } catch (err) {
        console.warn(`[TableQualityEvaluator] Strategy ${strategy.name} failed:`, err);
      }
    }

    if (candidates.length === 0) return null;

    // Sort by confidence score descending, then by non-empty cells count
    candidates.sort((a, b) => b.confidenceScore - a.confidenceScore || b.nonEmptyCells - a.nonEmptyCells);

    const winner = candidates[0];
    if (winner.confidenceScore < 0.35) return null;

    return winner;
  }
}

// ============================================================================
// 5. DOCUMENT CLASSIFIER & ANALYSIS SERVICE
// ============================================================================

export class PdfAnalysisService {
  /**
   * Analyzes PDF document proxy and classifies document type:
   * TEXT_PDF, SCANNED_PDF, or MIXED_PDF
   */
  public static async analyze(pdfDoc: PDFDocumentProxy): Promise<DocumentAnalysisResult> {
    const pageCount = pdfDoc.numPages;
    if (pageCount === 0) {
      return {
        documentType: "SCANNED_PDF",
        pageCount: 0,
        totalTextItems: 0,
        avgItemsPerPage: 0,
        hasEmbeddedText: false,
        recommendation: "Document contains 0 pages.",
      };
    }

    let totalTextCount = 0;
    let totalCharCount = 0;
    let pagesWithText = 0;

    for (let p = 1; p <= pageCount; p++) {
      const page = await pdfDoc.getPage(p);
      const textContent = await page.getTextContent();
      const items = textContent.items.filter((i) => "str" in i && (i.str?.trim()?.length || 0) > 0);
      const charCount = items.reduce((sum, item) => sum + (("str" in item && item.str?.length) || 0), 0);

      totalTextCount += items.length;
      totalCharCount += charCount;

      if (items.length > 2 && charCount > 15) {
        pagesWithText++;
      }
    }

    const avgItemsPerPage = totalTextCount / pageCount;
    const avgCharsPerPage = totalCharCount / pageCount;

    let documentType: DocumentTypeClassification = "TEXT_PDF";
    let recommendation: string | undefined;

    if (pagesWithText === 0 || avgCharsPerPage < 10) {
      documentType = "SCANNED_PDF";
      recommendation =
        "This document appears to be a scanned PDF or image without an embedded text layer. Please use Saarvi OCR or text recognition to extract text before tabular spreadsheet conversion.";
    } else if (pagesWithText < pageCount) {
      documentType = "MIXED_PDF";
      recommendation = "Some pages contain scanned images without text layer. Extracted tabular data from text-enabled pages.";
    }

    return {
      documentType,
      pageCount,
      totalTextItems: totalTextCount,
      avgItemsPerPage,
      hasEmbeddedText: documentType !== "SCANNED_PDF",
      recommendation,
    };
  }
}

// ============================================================================
// 6. MULTI-PAGE TABLE STITCHER
// ============================================================================

export class MultiPageTableStitcher {
  /**
   * Stitches continuation tables across consecutive pages when headers match,
   * avoiding duplicate headers and creating a unified primary sheet.
   */
  public static stitch(
    pageTables: { pageNum: number; candidate: ExtractedTableCandidate }[],
    sheetPerPage = false
  ): XlsxSheetData[] {
    if (pageTables.length === 0) return [];

    if (sheetPerPage) {
      return pageTables.map((pt) => ({
        name: `Page ${pt.pageNum}`,
        rows: pt.candidate.rows,
      }));
    }

    // Default: Check if consecutive tables share column count and should be stitched
    const sheets: XlsxSheetData[] = [];
    let currentSheet: XlsxSheetData | null = null;
    let currentCols = 0;

    for (let i = 0; i < pageTables.length; i++) {
      const pt = pageTables[i];
      const candidateRows = pt.candidate.rows;

      if (!currentSheet) {
        currentSheet = {
          name: "Table 1",
          rows: [...candidateRows],
        };
        currentCols = pt.candidate.colCount;
        sheets.push(currentSheet);
        continue;
      }

      // Check continuation: same or ±1 column count
      const isContinuation = Math.abs(pt.candidate.colCount - currentCols) <= 1;

      if (isContinuation) {
        // Check if row 0 of next page is identical to header of current sheet
        const firstRow = candidateRows[0];
        const headerRow = currentSheet.rows[0];
        const isHeaderRepeated =
          headerRow &&
          firstRow &&
          headerRow.length === firstRow.length &&
          headerRow.every((val, idx) => String(val).trim().toLowerCase() === String(firstRow[idx]).trim().toLowerCase());

        const rowsToAppend = isHeaderRepeated ? candidateRows.slice(1) : candidateRows;
        currentSheet.rows.push(...rowsToAppend);
      } else {
        // Start a new sheet
        currentSheet = {
          name: `Table ${sheets.length + 1}`,
          rows: [...candidateRows],
        };
        currentCols = pt.candidate.colCount;
        sheets.push(currentSheet);
      }
    }

    return sheets;
  }
}

// ============================================================================
// 7. EXCEL VALIDATION SERVICE (PRE-EXPORT SAFETY CHECK)
// ============================================================================

export class ExcelValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExcelValidationError";
  }
}

export class ExcelValidationService {
  /**
   * Reopens generated XLSX bytes to guarantee:
   * 1. sheet_count > 0
   * 2. At least one sheet has rows > 0
   * 3. Total non-empty cells > 0
   * 4. File size > 500 bytes
   * Throws ExcelValidationError if any verification fails.
   */
  public static async validateWorkbook(xlsxBytes: Uint8Array): Promise<boolean> {
    if (!xlsxBytes || xlsxBytes.byteLength < 500) {
      throw new ExcelValidationError("Generated Excel binary is corrupted or under minimum valid OpenXML file size.");
    }

    const parsedSheets = await parseXlsxWorkbook(xlsxBytes);

    if (!parsedSheets || parsedSheets.length === 0) {
      throw new ExcelValidationError("Generated Excel workbook contains 0 sheets.");
    }

    let totalRows = 0;
    let totalNonEmptyCells = 0;

    for (const sheet of parsedSheets) {
      totalRows += sheet.rows.length;
      for (const row of sheet.rows) {
        for (const cell of row) {
          if (cell !== null && cell !== undefined && String(cell).trim() !== "") {
            totalNonEmptyCells++;
          }
        }
      }
    }

    if (totalRows === 0 || totalNonEmptyCells === 0) {
      throw new ExcelValidationError("Extracted spreadsheet contains no data rows or populated cells.");
    }

    return true;
  }
}

// ============================================================================
// 8. HIGH-LEVEL PDF TO EXCEL CONVERSION ORCHESTRATOR
// ============================================================================

export class PdfExcelService {
  private evaluator = new TableQualityEvaluator();

  public async convert(
    pdfDoc: PDFDocumentProxy,
    sheetPerPage = false,
    onProgress?: (pct: number) => void
  ): Promise<PdfToExcelConversionResult> {
    const numPages = pdfDoc.numPages;
    if (numPages === 0) {
      throw new Error("The PDF document contains 0 pages.");
    }

    // 1. Analyze Document Structure
    if (onProgress) onProgress(10);
    const analysis = await PdfAnalysisService.analyze(pdfDoc);

    if (analysis.documentType === "SCANNED_PDF") {
      throw new Error(
        analysis.recommendation ||
          "This document appears to be a scanned PDF or image without an embedded text layer. Please use Saarvi OCR or text recognition to extract text before tabular spreadsheet conversion."
      );
    }

    if (onProgress) onProgress(20);

    // 2. Extract and Evaluate Tables Page by Page
    const pageTables: { pageNum: number; candidate: ExtractedTableCandidate }[] = [];
    const previews: TablePreviewData[] = [];

    for (let p = 1; p <= numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const textContent = await page.getTextContent();
      const rawItems: RawPdfTextItem[] = [];

      for (const item of textContent.items) {
        if (!("str" in item)) continue;
        const str = item.str?.trim();
        if (!str) continue;

        const tx = item.transform;
        const x = tx[4];
        const y = tx[5];
        const fontSize = Math.hypot(tx[0], tx[1]);
        const width = item.width || fontSize * (str.length * 0.5);
        const height = item.height || fontSize;

        rawItems.push({ str, x, y, width, height, fontSize });
      }

      const bestCandidate = this.evaluator.evaluate(rawItems);
      if (bestCandidate) {
        pageTables.push({ pageNum: p, candidate: bestCandidate });

        // Build preview sample
        const headers = bestCandidate.rows[0] || [];
        const sampleRows = bestCandidate.rows.slice(1, 6);
        previews.push({
          sheetName: `Page ${p}`,
          headers,
          sampleRows,
          totalRows: bestCandidate.rowCount,
          totalCols: bestCandidate.colCount,
          qualityScore: Math.round(bestCandidate.confidenceScore * 100),
          strategyUsed: bestCandidate.strategy,
        });
      }

      if (onProgress) {
        onProgress(20 + Math.round((p / numPages) * 50));
      }
    }

    if (pageTables.length === 0) {
      throw new Error(
        "This PDF does not contain a reliably detectable table. Saarvi requires structured rows and columns to generate clean Excel spreadsheets."
      );
    }

    // 3. Multi-page Table Stitching
    if (onProgress) onProgress(75);
    const sheets = MultiPageTableStitcher.stitch(pageTables, sheetPerPage);

    // 4. Generate Authenticated OpenXML XLSX Workbook
    if (onProgress) onProgress(85);
    const xlsxBytes = await buildXlsxWorkbook(sheets);

    // 5. Pre-Export Validation (Never deliver empty/corrupt spreadsheets)
    if (onProgress) onProgress(92);
    await ExcelValidationService.validateWorkbook(xlsxBytes);

    if (onProgress) onProgress(100);

    const totalRows = sheets.reduce((sum, s) => sum + s.rows.length, 0);
    const maxCols = Math.max(...sheets.map((s) => Math.max(...s.rows.map((r) => r.length), 0)), 0);
    const avgScore =
      pageTables.reduce((sum, pt) => sum + pt.candidate.confidenceScore, 0) / Math.max(1, pageTables.length);
    const primaryStrategy = pageTables[0]?.candidate.strategy || "Hybrid Coordinate Clustering";

    return {
      sheets,
      xlsxBytes,
      analysis,
      previews,
      totalRows,
      maxCols,
      overallQualityScore: Math.round(avgScore * 100),
      primaryStrategy,
    };
  }
}
