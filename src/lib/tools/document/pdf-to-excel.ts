import type * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";
import { ToolOperation, SingleFileResult, MultiFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "../../utils";
import { validateInputFile, sanitizeFilename } from "../../security/file-security";
import { buildXlsxWorkbook, XlsxSheetData } from "./openxml-helper";
import { loadPdfjs } from "../pdf/pdfjs-loader";

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
 * Detects whether a set of text items forms a valid tabular structure,
 * and compiles it into structured rows and column cells.
 */
function extractTableFromItems(items: RawPdfTextItem[]): (string | number | boolean | null)[][] | null {
  if (items.length < 4) return null;

  // 1. Group items into rows by Y coordinate (tolerance 4 points)
  const rows: DetectedRow[] = [];
  const sortedItems = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

  for (const item of sortedItems) {
    let matchedRow = rows.find((r) => Math.abs(r.y - item.y) <= 4);
    if (!matchedRow) {
      matchedRow = { y: item.y, items: [] };
      rows.push(matchedRow);
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
  // Must have at least 2 rows with 2 or more distinct columns
  const multiColumnRows = rows.filter((r) => r.items.length >= 2);
  if (multiColumnRows.length < 2) {
    return null;
  }

  // Check if column alignments align across rows
  // Collect all unique X start positions
  const xPositions: number[] = [];
  for (const r of multiColumnRows) {
    for (const item of r.items) {
      const existing = xPositions.find((x) => Math.abs(x - item.x) <= 15);
      if (existing === undefined) {
        xPositions.push(item.x);
      }
    }
  }
  xPositions.sort((a, b) => a - b);

  if (xPositions.length < 2) {
    return null;
  }

  // 3. Construct dense 2D grid
  const tableData: (string | number | boolean | null)[][] = [];

  for (const row of rows) {
    // If a row has only 1 item and its length is very long (> 80 chars), it is likely body prose, skip or include as full-width
    const rowCells: (string | number | null)[] = new Array(xPositions.length).fill(null);
    let populatedCount = 0;

    for (const item of row.items) {
      // Find closest column index
      let bestColIdx = 0;
      let minDiff = Infinity;
      for (let c = 0; c < xPositions.length; c++) {
        const diff = Math.abs(xPositions[c] - item.x);
        if (diff < minDiff) {
          minDiff = diff;
          bestColIdx = c;
        }
      }

      // Check if value is numeric
      const cleanStr = item.str.replace(/,/g, "").trim();
      const num = Number(cleanStr);
      const isNum = cleanStr !== "" && !isNaN(num) && /^-?\d+(\.\d+)?$/.test(cleanStr);

      const existingVal = rowCells[bestColIdx];
      if (existingVal !== null && existingVal !== undefined) {
        rowCells[bestColIdx] = `${existingVal} ${item.str}`;
      } else {
        rowCells[bestColIdx] = isNum ? num : item.str;
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
): Promise<{ filename: string; blob: Blob; originalSize: number; newSize: number }> {
  const securityCheck = await validateInputFile(file, ["pdf"], 50 * 1024 * 1024);
  if (!securityCheck.valid) {
    throw new Error(securityCheck.error || "Invalid PDF file structure.");
  }

  if (onProgress) onProgress(15);

  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfjs = await loadPdfjs();

  const loadingTask = pdfjs.getDocument({
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
  // show: "This PDF does not contain a reliably detectable table."
  // Do not generate an empty spreadsheet silently.
  if (sheets.length === 0) {
    throw new Error("This PDF does not contain a reliably detectable table.");
  }

  if (onProgress) onProgress(85);

  const xlsxBytes = await buildXlsxWorkbook(sheets);
  const blob = new Blob([xlsxBytes.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const baseName = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ""));
  const filename = `${baseName}.xlsx`;

  if (onProgress) onProgress(100);

  return {
    filename,
    blob,
    originalSize: file.size,
    newSize: blob.size,
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
