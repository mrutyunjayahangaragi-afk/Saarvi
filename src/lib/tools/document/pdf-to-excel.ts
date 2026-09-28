import "@/lib/polyfills/iterator";
import * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";
import { ToolOperation, SingleFileResult, MultiFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "../../utils";
import { validateInputFile, sanitizeFilename } from "../../security/file-security";
import { buildXlsxWorkbook, XlsxSheetData } from "./openxml-helper";

// Ensure worker is configured for browser execution
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

export interface PdfToExcelConfig {
  sheetPerPage?: boolean;
}

interface RawPdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

interface DetectedRow {
  y: number;
  items: RawPdfTextItem[];
}

/**
 * Extracts positioned text items from a PDF page
 */
async function extractPageItems(page: pdfjsLib.PDFPageProxy): Promise<RawPdfTextItem[]> {
  const textContent = await page.getTextContent();
  const items: RawPdfTextItem[] = [];

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

    items.push({ str, x, y, width, height, fontSize });
  }

  return items;
}

/**
 * Formats extracted text value safely:
 * - Preserves numbers with commas (e.g. 1,250)
 * - Preserves leading zeros (e.g. 0123)
 * - Preserves dates, currencies, percentages
 * - Converts pure integers/floats to numbers for native Excel calculation
 */
function parseCellValue(str: string): string | number {
  const trimmed = str.trim();
  if (!trimmed) return "";

  // 1. Leading zeros (e.g. "0123", "007", phone numbers, employee codes)
  if (/^0\d+/.test(trimmed) && trimmed.length > 1) {
    return trimmed;
  }

  // 2. Dates (e.g. 2026-09-28, 28/09/2026, 09/28/2026)
  if (/^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(trimmed)) {
    return trimmed;
  }

  // 3. Formatted numbers with commas (e.g. 1,250 or 1,250,500.50)
  if (/^[-+]?(\d{1,3}(,\d{3})+)(\.\d+)?$/.test(trimmed)) {
    return trimmed;
  }

  // 4. Currency and percentages ($100, ₹500, 25%)
  if (/^[$€£₹¥]?\s*[-+]?\d+(\.\d+)?%?$/.test(trimmed)) {
    return trimmed;
  }

  // 5. Clean plain integer or floating point number
  if (/^[-+]?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }
  }

  return trimmed;
}

/**
 * Detects whether a set of text items forms a valid tabular structure,
 * and compiles it into structured rows and column cells using adaptive clustering.
 */
function extractTableFromItems(items: RawPdfTextItem[]): (string | number | boolean | null)[][] | null {
  if (items.length < 4) return null;

  // 1. Group items into rows using adaptive vertical baseline clustering
  const rows: DetectedRow[] = [];
  const sortedItems = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

  for (const item of sortedItems) {
    const tolerance = Math.max(3.5, (item.fontSize || 10) * 0.45);
    let matchedRow = rows.find((r) => Math.abs(r.y - item.y) <= tolerance);

    if (!matchedRow) {
      matchedRow = { y: item.y, items: [] };
      rows.push(matchedRow);
    } else {
      // Centroid running average tracking
      matchedRow.y = (matchedRow.y * matchedRow.items.length + item.y) / (matchedRow.items.length + 1);
    }
    matchedRow.items.push(item);
  }

  // Sort items inside each row by X ascending
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
  }

  // Sort rows from top of page to bottom
  rows.sort((a, b) => b.y - a.y);

  // 2. Table detection heuristic:
  // Must have at least 2 rows with 2 or more distinct items
  const multiColumnRows = rows.filter((r) => r.items.length >= 2);
  if (multiColumnRows.length < 2) {
    return null;
  }

  // 3. Cluster horizontal X positions to establish column boundaries
  const allXPositions: number[] = [];
  for (const r of multiColumnRows) {
    for (const item of r.items) {
      allXPositions.push(item.x);
    }
  }
  allXPositions.sort((a, b) => a - b);

  const columnAnchors: number[] = [];
  const colClusterTolerance = 18;

  for (const x of allXPositions) {
    const last = columnAnchors[columnAnchors.length - 1];
    if (last === undefined || x - last > colClusterTolerance) {
      columnAnchors.push(x);
    }
  }

  if (columnAnchors.length < 2) {
    return null;
  }

  // 4. Construct dense 2D grid
  const tableData: (string | number | boolean | null)[][] = [];

  for (const row of rows) {
    const rowCells: (string | number | null)[] = new Array(columnAnchors.length).fill(null);
    let populatedCount = 0;

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

      const parsedVal = parseCellValue(item.str);
      const existingVal = rowCells[bestColIdx];

      if (existingVal !== null && existingVal !== undefined && String(existingVal).trim() !== "") {
        rowCells[bestColIdx] = `${existingVal} ${item.str}`;
      } else {
        rowCells[bestColIdx] = parsedVal;
      }
      populatedCount++;
    }

    if (populatedCount > 0) {
      // Trim trailing nulls
      while (rowCells.length > 0 && rowCells[rowCells.length - 1] === null) {
        rowCells.pop();
      }
      if (rowCells.length > 0) {
        tableData.push(rowCells);
      }
    }
  }

  // Must have at least 2 rows and at least 2 columns populated somewhere
  if (tableData.length < 2) return null;
  const maxCols = Math.max(...tableData.map((r) => r.length));
  if (maxCols < 2) return null;

  return tableData;
}

/**
 * Converts a single PDF file to an authentic XLSX workbook
 */
async function convertSinglePdfToXlsx(
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ filename: string; blob: Blob; originalSize: number; newSize: number; details?: Record<string, string | number> }> {
  const securityCheck = await validateInputFile(file, ["pdf"], 50 * 1024 * 1024);
  if (!securityCheck.valid) {
    throw new Error(securityCheck.error || "Invalid PDF file structure.");
  }

  if (onProgress) onProgress(15);

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
    throw new Error("The PDF document contains 0 pages.");
  }

  const sheets: XlsxSheetData[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const items = await extractPageItems(page);
    const table = extractTableFromItems(items);

    if (table && table.length > 0) {
      sheets.push({
        name: `Page ${pageNum}`,
        rows: table,
      });
    }

    if (onProgress) {
      onProgress(15 + Math.round((pageNum / numPages) * 65));
    }
  }

  // As required: For PDFs with no meaningful tables:
  // show: "This PDF does not contain a reliably detectable table. Saarvi requires structured rows and columns to generate clean Excel spreadsheets."
  // Do not generate an empty spreadsheet silently.
  if (sheets.length === 0) {
    throw new Error("This PDF does not contain a reliably detectable table. Saarvi requires structured rows and columns to generate clean Excel spreadsheets.");
  }

  if (onProgress) onProgress(85);

  const xlsxBytes = await buildXlsxWorkbook(sheets);
  const blob = new Blob([xlsxBytes.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const baseName = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ""));
  const filename = `${baseName}.xlsx`;

  if (onProgress) onProgress(100);

  const totalRows = sheets.reduce((sum, s) => sum + s.rows.length, 0);
  const maxCols = Math.max(...sheets.map((s) => Math.max(...s.rows.map((r) => r.length), 0)), 0);

  return {
    filename,
    blob,
    originalSize: file.size,
    newSize: blob.size,
    details: {
      "Sheets": sheets.length,
      "Total Rows Extracted": totalRows,
      "Columns Detected": maxCols,
      "Document Type": "Microsoft Excel (.xlsx)",
      "Engine": "Adaptive Table Classifier v2",
    },
  };
}

export const pdfToExcelOperation: ToolOperation<PdfToExcelConfig, SingleFileResult | MultiFileResult> = {
  id: "pdf-to-excel",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select a PDF document to convert to Excel." };
    }
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
        return { valid: false, error: `"${file.name}" is not a valid PDF document.` };
      }
      if (file.size > 50 * 1024 * 1024) {
        return { valid: false, error: `"${file.name}" exceeds the 50MB limit.` };
      }
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    _config: PdfToExcelConfig = {},
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult | MultiFileResult> {
    if (!files || files.length === 0) {
      throw new Error("Please select at least one PDF document to convert.");
    }

    // Single file conversion
    if (files.length === 1) {
      const res = await convertSinglePdfToXlsx(files[0], onProgress);
      return {
        type: "single",
        filename: res.filename,
        blob: res.blob,
        originalSize: res.originalSize,
        newSize: res.newSize,
      };
    }

    // Batch conversion
    const zip = new JSZip();
    const convertedFiles: MultiFileResult["files"] = [];
    let totalOriginalSize = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      totalOriginalSize += file.size;

      const singleProgress = (pct: number) => {
        if (onProgress) {
          const overall = Math.round(((i + pct / 100) / files.length) * 100);
          onProgress(overall);
        }
      };

      const res = await convertSinglePdfToXlsx(file, singleProgress);
      zip.file(res.filename, res.blob);
      const url = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(res.blob) : "";
      convertedFiles.push({ filename: res.filename, blob: res.blob, url, size: res.newSize });
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const firstBase = sanitizeFilename(files[0].name.replace(/\.[^/.]+$/, ""));
    const zipFilename = `${firstBase}_and_${files.length - 1}_more_excel.zip`;

    if (onProgress) onProgress(100);

    return {
      type: "multiple",
      zipBlob,
      zipFilename,
      files: convertedFiles,
      originalSize: totalOriginalSize,
      newSize: zipBlob.size,
    };
  },
};
