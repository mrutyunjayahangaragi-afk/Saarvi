import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { ToolOperation, SingleFileResult, MultiFileResult, ValidationResult } from "../types";
import { validateInputFile, sanitizeFilename } from "../../security/file-security";

export interface CsvToPdfConfig {
  delimiter?: string;
  orientation?: "auto" | "portrait" | "landscape";
}

/**
 * Automatically detects CSV delimiter (, ; \t) by analyzing line counts
 */
function detectCsvDelimiter(sampleText: string): string {
  const lines = sampleText.split(/\r?\n/).slice(0, 10).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return ",";

  const candidates = [",", ";", "\t", "|"];
  let bestDelim = ",";
  let bestConsistency = -1;

  for (const delim of candidates) {
    const counts = lines.map((l) => {
      // count delimiter outside quotes
      let inQuotes = false;
      let count = 0;
      for (let i = 0; i < l.length; i++) {
        if (l[i] === '"') inQuotes = !inQuotes;
        else if (l[i] === delim && !inQuotes) count++;
      }
      return count;
    });

    const first = counts[0];
    if (first > 0 && counts.every((c) => c === first)) {
      if (first > bestConsistency) {
        bestConsistency = first;
        bestDelim = delim;
      }
    }
  }

  return bestDelim;
}

/**
 * Robust CSV parser supporting quotes, escaped quotes (""), and multiline fields
 */
function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const nextCh = text[i + 1];

    if (ch === '"') {
      if (inQuotes && nextCh === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((ch === "\r" || ch === "\n") && !inQuotes) {
      if (ch === "\r" && nextCh === "\n") i++; // handle CRLF
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += ch;
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Wraps cell text to fit within column width
 */
function wrapCell(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testW = font.widthOfTextAtSize(testLine, fontSize);

    if (testW <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        let chunk = "";
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, fontSize) <= maxWidth) {
            chunk += ch;
          } else {
            lines.push(chunk);
            chunk = ch;
          }
        }
        currentLine = chunk;
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [""];
}

/**
 * Converts a single CSV file to a clean, genuine PDF document
 */
async function convertSingleCsvToPdf(
  file: File,
  config: CsvToPdfConfig = {},
  onProgress?: (pct: number) => void
): Promise<{ filename: string; blob: Blob; originalSize: number; newSize: number }> {
  const securityCheck = await validateInputFile(file, ["csv", "txt"], 25 * 1024 * 1024);
  if (!securityCheck.valid) {
    throw new Error(securityCheck.error || "Invalid CSV file structure.");
  }

  if (onProgress) onProgress(15);

  const rawText = await file.text();
  if (!rawText.trim()) {
    throw new Error("The CSV file is empty.");
  }

  const delimiter = config.delimiter || detectCsvDelimiter(rawText);
  const rows = parseCsv(rawText, delimiter);

  if (rows.length === 0) {
    throw new Error("No data rows found in this CSV file.");
  }

  const numCols = Math.max(...rows.map((r) => r.length));
  if (numCols === 0) {
    throw new Error("The CSV table has 0 columns.");
  }

  // Automatic Landscape detection if columns > 5 or user specified
  let isLandscape = config.orientation === "landscape";
  if (config.orientation === "portrait") {
    isLandscape = false;
  } else if (config.orientation !== "landscape") {
    isLandscape = numCols > 5;
  }

  const pageWidth = isLandscape ? 841.89 : 595.28;
  const pageHeight = isLandscape ? 595.28 : 841.89;
  const margin = 40;
  const printableWidth = pageWidth - margin * 2;

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const fontSize = 9;
  const headerFontSize = 9.5;
  const rowPaddingY = 5;

  // Calculate proportional column widths
  const colMaxChars: number[] = new Array(numCols).fill(5);
  for (const r of rows) {
    for (let c = 0; c < numCols; c++) {
      const val = r[c] || "";
      colMaxChars[c] = Math.max(colMaxChars[c], Math.min(val.length, 35));
    }
  }

  const totalChars = colMaxChars.reduce((sum, v) => sum + v, 0);
  const colWidths: number[] = colMaxChars.map((chars) => {
    return Math.max(40, (chars / totalChars) * printableWidth);
  });

  // Scale widths to fit exactly within printableWidth
  const actualTotalW = colWidths.reduce((sum, v) => sum + v, 0);
  const scaleFactor = printableWidth / actualTotalW;
  for (let c = 0; c < numCols; c++) {
    colWidths[c] = colWidths[c] * scaleFactor;
  }

  const pages: PDFPage[] = [];
  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  pages.push(currentPage);

  let currentY = pageHeight - margin;

  // Draw Document Title
  const titleText = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ""));
  currentPage.drawText(titleText, {
    x: margin,
    y: currentY - 14,
    size: 14,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.16),
  });
  currentY -= 30;

  // Row drawing function
  const drawRow = (
    page: PDFPage,
    rowValues: string[],
    y: number,
    isHeader: boolean,
    isEven: boolean
  ): number => {
    const font = isHeader ? fontBold : fontRegular;
    const fSize = isHeader ? headerFontSize : fontSize;
    const textColor = isHeader ? rgb(0.06, 0.09, 0.16) : rgb(0.2, 0.25, 0.33);

    const cellLines: string[][] = [];
    let maxLines = 1;

    for (let c = 0; c < numCols; c++) {
      const text = rowValues[c] || "";
      const maxW = colWidths[c] - 10;
      const lines = wrapCell(text, font, fSize, Math.max(20, maxW));
      cellLines.push(lines);
      maxLines = Math.max(maxLines, lines.length);
    }

    const lineHeight = fSize + 3;
    const rowHeight = maxLines * lineHeight + rowPaddingY * 2;

    // Background fill (header or alternating zebra rows)
    if (isHeader) {
      page.drawRectangle({
        x: margin,
        y: y - rowHeight,
        width: printableWidth,
        height: rowHeight,
        color: rgb(0.94, 0.96, 0.98),
      });
    } else if (isEven) {
      page.drawRectangle({
        x: margin,
        y: y - rowHeight,
        width: printableWidth,
        height: rowHeight,
        color: rgb(0.98, 0.99, 1.0),
      });
    }

    // Bottom border
    page.drawLine({
      start: { x: margin, y: y - rowHeight },
      end: { x: margin + printableWidth, y: y - rowHeight },
      thickness: 0.5,
      color: rgb(0.88, 0.91, 0.94),
    });

    // Cell text & vertical borders
    let colX = margin;
    for (let c = 0; c < numCols; c++) {
      const lines = cellLines[c];
      let textY = y - rowPaddingY - fSize;

      for (const line of lines) {
        if (line) {
          page.drawText(line, {
            x: colX + 5,
            y: textY,
            size: fSize,
            font,
            color: textColor,
          });
        }
        textY -= lineHeight;
      }

      colX += colWidths[c];

      page.drawLine({
        start: { x: colX, y },
        end: { x: colX, y: y - rowHeight },
        thickness: 0.5,
        color: rgb(0.88, 0.91, 0.94),
      });
    }

    // Left border
    page.drawLine({
      start: { x: margin, y },
      end: { x: margin, y: y - rowHeight },
      thickness: 0.5,
      color: rgb(0.88, 0.91, 0.94),
    });

    return rowHeight;
  };

  // Header row
  const headerRow = rows[0];
  let headerH = drawRow(currentPage, headerRow, currentY, true, false);
  currentY -= headerH;

  // Data rows
  for (let r = 1; r < rows.length; r++) {
    const rowData = rows[r];
    const maxChar = Math.max(...rowData.map((c) => (c || "").length));
    const estLines = Math.max(1, Math.ceil(maxChar / 15));
    const estH = estLines * (fontSize + 3) + rowPaddingY * 2;

    if (currentY - estH < margin + 20) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      pages.push(currentPage);
      currentY = pageHeight - margin;

      // Repeat header on new page
      headerH = drawRow(currentPage, headerRow, currentY, true, false);
      currentY -= headerH;
    }

    const actualH = drawRow(currentPage, rowData, currentY, false, r % 2 === 0);
    currentY -= actualH;

    if (onProgress && r % 25 === 0) {
      onProgress(20 + Math.round((r / rows.length) * 70));
    }
  }

  // Footer page numbers
  const totalPages = pages.length;
  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    const footer = `Page ${i + 1} of ${totalPages}`;
    const textW = fontRegular.widthOfTextAtSize(footer, 8);
    page.drawText(footer, {
      x: (pageWidth - textW) / 2,
      y: margin / 2,
      size: 8,
      font: fontRegular,
      color: rgb(0.6, 0.65, 0.72),
    });
  }

  if (onProgress) onProgress(95);

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });

  const baseName = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ""));
  const filename = `${baseName}.pdf`;

  if (onProgress) onProgress(100);

  return {
    filename,
    blob,
    originalSize: file.size,
    newSize: blob.size,
  };
}

export const csvToPdfOperation: ToolOperation<CsvToPdfConfig, SingleFileResult | MultiFileResult> = {
  id: "csv-to-pdf",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select a CSV file to convert to PDF." };
    }
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv" && file.type !== "text/plain") {
        return { valid: false, error: `"${file.name}" is not a valid CSV file.` };
      }
      if (file.size > 25 * 1024 * 1024) {
        return { valid: false, error: `"${file.name}" exceeds the 25MB limit.` };
      }
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    config: CsvToPdfConfig = {},
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult | MultiFileResult> {
    if (!files || files.length === 0) {
      throw new Error("Please select at least one CSV file to convert.");
    }

    // Single file conversion
    if (files.length === 1) {
      const res = await convertSingleCsvToPdf(files[0], config, onProgress);
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

      const res = await convertSingleCsvToPdf(file, config, singleProgress);
      zip.file(res.filename, res.blob);
      const url = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(res.blob) : "";
      convertedFiles.push({ filename: res.filename, blob: res.blob, url, size: res.newSize });
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const firstBase = sanitizeFilename(files[0].name.replace(/\.[^/.]+$/, ""));
    const zipFilename = `${firstBase}_and_${files.length - 1}_more_pdf.zip`;

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
